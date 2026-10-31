use serde::Serialize;
use std::{fs,path::{Path,PathBuf}};
#[derive(Serialize,Clone)]
#[serde(rename_all="camelCase")]
pub struct Entry{path:String,name:String,relative:String,directory:bool}
#[derive(Serialize)]
pub struct Index{files:Vec<Entry>,truncated:bool}
#[derive(Serialize)]
pub struct Hit{path:String,name:String,line:usize,excerpt:String,occurrence:usize}
#[derive(Serialize)]
#[serde(rename_all="camelCase")]
pub struct Search{results:Vec<Hit>,truncated:bool,scanned:usize}
fn document(path:&Path)->bool{super::text_io::listed(&path.file_name().unwrap_or_default().to_string_lossy())}
pub fn display_path(path:&Path)->String{let p=path.to_string_lossy();if let Some(tail)=p.strip_prefix(r"\\?\UNC\"){format!(r"\\{}",tail)}else{p.strip_prefix(r"\\?\").unwrap_or(&p).to_owned()}}
fn entry(path:&Path,root:&Path,directory:bool)->Entry{Entry{path:display_path(path),name:path.file_name().unwrap_or_default().to_string_lossy().into_owned(),relative:path.strip_prefix(root).unwrap_or(path).to_string_lossy().into_owned(),directory}}
fn list(root:&Path,path:&Path)->Result<Vec<Entry>,String>{let root=root.canonicalize().map_err(|e|e.to_string())?;let path=path.canonicalize().map_err(|e|e.to_string())?;if !path.starts_with(&root){return Err("目录不在当前文件夹内。".into())}let mut result=Vec::new();for e in fs::read_dir(path).map_err(|e|e.to_string())?{let e=e.map_err(|e|e.to_string())?;let kind=e.file_type().map_err(|e|e.to_string())?;if kind.is_symlink(){continue}let p=e.path();if kind.is_dir()&&e.file_name().to_string_lossy().starts_with('.')||matches!(e.file_name().to_string_lossy().as_ref(),"node_modules"|"target"){continue}let bundle=p.extension().and_then(|s|s.to_str()).unwrap_or("").eq_ignore_ascii_case("textbundle");if kind.is_dir()||document(&p){result.push(entry(&p,&root,kind.is_dir()&&!bundle))}if result.len()>=5000{break}}result.sort_by_key(|e|(!e.directory,e.name.to_lowercase()));Ok(result)}
fn index(root:&Path)->Result<Index,String>{let root=root.canonicalize().map_err(|e|e.to_string())?;let mut dirs=vec![root.clone()];let mut files=Vec::new();let mut visited=0;let mut truncated=false;while let Some(dir)=dirs.pop(){visited+=1;if visited>2000{truncated=true;break}let entries=match list(&root,&dir){Ok(entries)=>entries,Err(e)=>{if dir==root{return Err(e)}truncated=true;continue}};for item in entries{if item.directory{dirs.push(PathBuf::from(&item.path))}else{files.push(item)}if files.len()>=5000{truncated=true;break}}if truncated{break}}files.sort_by_key(|e|e.relative.to_lowercase());Ok(Index{files,truncated})}
#[tauri::command]
pub async fn list_folder(root:String,path:String)->Result<Vec<Entry>,String>{tauri::async_runtime::spawn_blocking(move||list(Path::new(&root),Path::new(&path))).await.map_err(|e|e.to_string())?}
#[tauri::command]
pub async fn index_folder(root:String)->Result<Index,String>{tauri::async_runtime::spawn_blocking(move||index(Path::new(&root))).await.map_err(|e|e.to_string())?}
fn checked_directory(root:&Path,path:&Path)->Result<(PathBuf,PathBuf),String>{
 let root=root.canonicalize().map_err(|e|e.to_string())?;
 let path=path.canonicalize().map_err(|e|e.to_string())?;
 if !root.is_dir()||!path.is_dir()||!path.starts_with(&root){return Err("目录不在当前文件夹内。".into())}
 Ok((root,path))
}
fn creation_name(name:&str,directory:bool)->Result<String,String>{
 if name.is_empty()||name.starts_with('.')||name.ends_with([' ','.']){return Err("名称不能为空、以点开头或以空格、点结尾。".into())}
 if name.chars().any(|c|c.is_control()||"\\/<>:\"|?*".contains(c)){return Err("名称不能包含路径或 Windows 特殊字符。".into())}
 let base=name.split('.').next().unwrap_or("").trim_end().to_uppercase();
 if matches!(base.as_str(),"CON"|"PRN"|"AUX"|"NUL"|"CLOCK$"|"CONIN$"|"CONOUT$")||["COM","LPT"].iter().any(|prefix|base.strip_prefix(*prefix).is_some_and(|tail|["1","2","3","4","5","6","7","8","9","¹","²","³"].contains(&tail))){return Err("这个名称是 Windows 保留名称。".into())}
 let mut name=name.to_owned();
 if !directory {
  if Path::new(&name).extension().is_none(){name.push_str(".md")}
  if matches!(Path::new(&name).extension().and_then(|s|s.to_str()).unwrap_or("").to_lowercase().as_str(),"textpack"|"tetpack"|"textbundle")||!super::text_io::listed(&name){return Err("请选择文本类文件后缀。".into())}
 }else if name.to_lowercase().ends_with(".textbundle"){return Err("新建 TextBundle 请使用另存为。".into())}
 if name.encode_utf16().count()>255{return Err("名称过长。".into())}
 Ok(name)
}
#[tauri::command]
pub async fn create_library_entry(root:String,parent:String,name:String,directory:bool)->Result<Entry,String>{tauri::async_runtime::spawn_blocking(move||{
 let (root,parent)=checked_directory(Path::new(&root),Path::new(&parent))?;
 let name=creation_name(&name,directory)?;let target=parent.join(name);
 let created=if directory{fs::create_dir(&target)}else{fs::OpenOptions::new().write(true).create_new(true).open(&target).map(drop)};
 created.map_err(|e|if e.kind()==std::io::ErrorKind::AlreadyExists{"文件或文件夹已存在，请换个名称。".into()}else{e.to_string()})?;
 Ok(entry(&target,&root,directory))
 }).await.map_err(|e|e.to_string())?}
#[tauri::command]
pub async fn open_library_folder(root:String,path:String)->Result<(),String>{tauri::async_runtime::spawn_blocking(move||{
 let (_,folder)=checked_directory(Path::new(&root),Path::new(&path))?;
 tauri_plugin_opener::open_path(folder,None::<&str>).map_err(|e|e.to_string())
 }).await.map_err(|e|e.to_string())?}
#[tauri::command]
pub async fn search_folder(root:String,query:String,sensitive:bool)->Result<Search,String>{tauri::async_runtime::spawn_blocking(move||{
 let items=index(Path::new(&root))?;let mut result=Search{results:Vec::new(),truncated:items.truncated,scanned:0};if query.is_empty(){return Ok(result)}let needle=if sensitive{query.clone()}else{query.to_lowercase()};let mut bytes=0;
 for file in items.files{let p=Path::new(&file.path);if matches!(p.extension().and_then(|s|s.to_str()).unwrap_or("").to_lowercase().as_str(),"textpack"|"tetpack"|"textbundle"){continue}let size=fs::metadata(p).map(|m|m.len()).unwrap_or(0);if size>20*1024*1024{result.truncated=true;continue}bytes+=size;if bytes>64*1024*1024{result.truncated=true;break}let Ok((text,_))=super::text_io::read(p)else{result.truncated=true;continue};result.scanned+=1;let mut occurrence=0;
 for(line,content)in text.lines().enumerate(){let hay=if sensitive{content.to_owned()}else{content.to_lowercase()};for _ in hay.match_indices(&needle){result.results.push(Hit{path:file.path.clone(),name:file.relative.clone(),line:line+1,excerpt:content.chars().take(200).collect(),occurrence});occurrence+=1;if result.results.len()>=300{result.truncated=true;return Ok(result)}}}
 }Ok(result)
 }).await.map_err(|e|e.to_string())?}
