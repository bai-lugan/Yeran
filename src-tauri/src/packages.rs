use serde::{Deserialize,Serialize};
use std::{fs,path::{Path,PathBuf}};

#[derive(Serialize,Deserialize)]
pub struct PackageFile { pub name:String, pub data:Vec<u8> }
fn valid_name(name:&str)->bool { !name.is_empty()&&!name.starts_with('/')&&!name.contains('\\')&&name.split('/').all(|p|{let stem=p.split('.').next().unwrap_or("").to_uppercase();!p.is_empty()&&p!="."&&p!=".."&&!p.ends_with('.')&&!p.ends_with(' ')&&!p.contains(':')&&!p.chars().any(|c|c<' ')&&!matches!(stem.as_str(),"CON"|"PRN"|"AUX"|"NUL"|"COM1"|"COM2"|"COM3"|"COM4"|"COM5"|"COM6"|"COM7"|"COM8"|"COM9"|"LPT1"|"LPT2"|"LPT3"|"LPT4"|"LPT5"|"LPT6"|"LPT7"|"LPT8"|"LPT9")}) }
fn read_tree(root:&Path,path:&Path,files:&mut Vec<PackageFile>,bytes:&mut u64)->Result<(),String>{
    for entry in fs::read_dir(path).map_err(|e|e.to_string())? { let entry=entry.map_err(|e|e.to_string())?;let meta=entry.file_type().map_err(|e|e.to_string())?;
        if meta.is_symlink(){return Err("TextBundle 不能包含符号链接。".into())}
        let name=entry.path().strip_prefix(root).map_err(|e|e.to_string())?.to_string_lossy().replace('\\',"/");
        if name.split('/').any(|part|part=="__MACOSX"||part.starts_with("._")){continue}
        if meta.is_dir(){read_tree(root,&entry.path(),files,bytes)?}else if meta.is_file(){
            if !valid_name(&name){return Err("TextBundle 资源路径无效。".into())}
            *bytes+=entry.metadata().map_err(|e|e.to_string())?.len();if *bytes>64*1024*1024||files.len()>=1024{return Err("TextBundle 超过大小或文件数限制。".into())}
            files.push(PackageFile{name,data:fs::read(entry.path()).map_err(|e|e.to_string())?});
        }
    }Ok(())
}
pub fn directory_stamp(path:&Path)->Result<String,String>{
    fn walk(root:&Path,current:&Path,entries:&mut Vec<String>)->Result<(),String>{for entry in fs::read_dir(current).map_err(|e|e.to_string())?{let e=entry.map_err(|e|e.to_string())?;let m=e.file_type().map_err(|e|e.to_string())?;if m.is_symlink(){return Err("包内不支持符号链接".into())}if m.is_dir(){walk(root,&e.path(),entries)?}else{let meta=e.metadata().map_err(|e|e.to_string())?;entries.push(format!("{}:{}:{}",e.path().strip_prefix(root).map_err(|e|e.to_string())?.display(),meta.len(),super::stamp(&e.path())?));if entries.len()>1024{return Err("包内文件过多".into())}}}Ok(())}
    let mut entries=Vec::new();walk(path,path,&mut entries)?;entries.sort();let mut hash:u64=0xcbf29ce484222325;for b in entries.join("\n").bytes(){hash^=b as u64;hash=hash.wrapping_mul(0x100000001b3)}Ok(format!("bundle-{hash:016x}"))
}
#[tauri::command]
pub async fn read_textbundle(path:String)->Result<Vec<PackageFile>,String>{tauri::async_runtime::spawn_blocking(move||{let root=PathBuf::from(path);if !root.join("info.json").is_file(){return Err("目录不是有效的 TextBundle。".into())}let mut files=Vec::new();let mut bytes=0;read_tree(&root,&root,&mut files,&mut bytes)?;Ok(files)}).await.map_err(|e|e.to_string())?}
#[tauri::command]
pub async fn read_binary_document(path:String)->Result<tauri::ipc::Response,String>{tauri::async_runtime::spawn_blocking(move||{let p=PathBuf::from(path);if fs::metadata(&p).map_err(|e|e.to_string())?.len()>64*1024*1024{return Err("TextPack 文件超过 64 MB。".into())}Ok(tauri::ipc::Response::new(fs::read(p).map_err(|e|e.to_string())?))}).await.map_err(|e|e.to_string())?}
#[tauri::command]
pub async fn write_binary_document(path:String,data:Vec<u8>,expected_modified:Option<String>,fail_if_missing:Option<bool>)->Result<super::Saved,String>{tauri::async_runtime::spawn_blocking(move||{
    if data.len()>64*1024*1024{return Err("TextPack 文件超过 64 MB。".into())}let target=PathBuf::from(&path);if fail_if_missing.unwrap_or(false)&&!target.is_file(){return Err("自动保存已停止：原文件已移走或删除。".into())}let old=if target.exists(){Some(super::stamp(&target)?)}else{None};if expected_modified.is_some()&&expected_modified!=old{return Err("文件已被其他应用修改。".into())}
    let temp=tempfile::NamedTempFile::new_in(target.parent().ok_or("无效文件路径")?).map_err(|e|e.to_string())?;fs::write(temp.path(),data).map_err(|e|e.to_string())?;temp.as_file().sync_all().map_err(|e|e.to_string())?;
    if (if target.exists(){Some(super::stamp(&target)?)}else{None})!=old{return Err("保存期间文件已被其他应用修改。".into())}temp.persist(&target).map_err(|e|e.to_string())?;Ok(super::Saved{path,modified:super::stamp(&target)?,history_warning:None})
}).await.map_err(|e|e.to_string())?}
#[tauri::command]
pub async fn write_textbundle(path:String,files:Vec<PackageFile>,expected_modified:Option<String>,fail_if_missing:Option<bool>)->Result<super::Saved,String>{tauri::async_runtime::spawn_blocking(move||{
    let target=PathBuf::from(&path);if fail_if_missing.unwrap_or(false)&&!target.is_dir(){return Err("自动保存已停止：原文件夹已移走或删除。".into())}if target.extension().and_then(|s|s.to_str()).map(|s|s.to_lowercase())!=Some("textbundle".into()){return Err("目标目录必须使用 .textbundle 后缀。".into())}
    if files.len()>1024||files.iter().map(|f|f.data.len()).sum::<usize>()>64*1024*1024||!files.iter().any(|f|f.name=="info.json"){return Err("TextBundle 内容或大小无效。".into())}
    let old=if target.exists(){Some(directory_stamp(&target)?)}else{None};if expected_modified.is_some()&&expected_modified!=old{return Err("TextBundle 已被其他应用修改。".into())}
    let temp=tempfile::tempdir_in(target.parent().ok_or("目录路径无效")?).map_err(|e|e.to_string())?;let stage=temp.path().join("next");fs::create_dir(&stage).map_err(|e|e.to_string())?;
    for file in files{if !valid_name(&file.name){return Err("包内路径无效。".into())}let entry=stage.join(&file.name);if let Some(parent)=entry.parent(){fs::create_dir_all(parent).map_err(|e|e.to_string())?}fs::write(entry,file.data).map_err(|e|e.to_string())?}
    if (if target.exists(){Some(directory_stamp(&target)?)}else{None})!=old{return Err("保存期间 TextBundle 已被其他应用修改。".into())}
    let backup=temp.path().join("previous");if target.exists(){fs::rename(&target,&backup).map_err(|e|e.to_string())?}if let Err(error)=fs::rename(&stage,&target){if backup.exists(){let _=fs::rename(&backup,&target);}return Err(error.to_string())}
    Ok(super::Saved{path,modified:directory_stamp(&target)?,history_warning:None})
}).await.map_err(|e|e.to_string())?}

#[tauri::command]
pub fn resolve_document_path(base:String,href:String)->Result<String,String>{
    let base=PathBuf::from(base);let file=if base.is_dir(){base.join("text.markdown")}else{base};
    let url=url::Url::from_file_path(file).map_err(|_|"原文稿路径无效")?.join(&href).map_err(|e|e.to_string())?;
    if url.scheme()!="file"{return Err("只能读取本地文稿链接".into())}
    let target=url.to_file_path().map_err(|_|"文件链接无效")?;
    if !["md","markdown","txt","textpack","tetpack","textbundle"].contains(&target.extension().and_then(|s|s.to_str()).unwrap_or("").to_lowercase().as_str()){return Err("仅支持跳转到 Markdown / TextBundle 文稿。".into())}
    target.canonicalize().map(|p|p.to_string_lossy().into_owned()).map_err(|e|format!("找不到链接文稿：{e}"))
}
