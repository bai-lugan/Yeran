use std::{fs,io::Write,path::{Path,PathBuf}};

fn family(path:&Path)->u8{match path.extension().and_then(|s|s.to_str()).unwrap_or("").to_lowercase().as_str(){"md"|"markdown"=>0,"textpack"|"tetpack"=>1,"textbundle"=>2,_=>3}}
fn checked_name(name:&str,source:&Path)->Result<(),String>{
 if name.is_empty()||name=="."||name==".."||name.ends_with([' ','.']){return Err("名称不能为空或以空格、点结尾。".into())}
 if name.chars().any(|c|c.is_control()||"\\/<>:\"|?*".contains(c)){return Err("名称不能包含路径或 Windows 特殊字符。".into())}
 let base=name.split('.').next().unwrap_or("").trim_end().to_uppercase();
 if matches!(base.as_str(),"CON"|"PRN"|"AUX"|"NUL"|"CLOCK$"|"CONIN$"|"CONOUT$")||["COM","LPT"].iter().any(|p|base.strip_prefix(p).is_some_and(|s|["1","2","3","4","5","6","7","8","9","¹","²","³"].contains(&s))){return Err("这个名称是 Windows 保留名称。".into())}
 if name.encode_utf16().count()>255{return Err("名称过长。".into())}
 if family(source)!=family(Path::new(name)){return Err("更改文稿格式请使用另存为。".into())}
 Ok(())
}
#[cfg(windows)]
fn move_without_replace(source:&Path,target:&Path)->Result<(),String>{
 use std::os::windows::ffi::OsStrExt;
 #[link(name="kernel32")] extern "system"{fn MoveFileExW(old:*const u16,new:*const u16,flags:u32)->i32;}
 let old:Vec<u16>=source.as_os_str().encode_wide().chain(Some(0)).collect();let new:Vec<u16>=target.as_os_str().encode_wide().chain(Some(0)).collect();
 // No MOVEFILE_REPLACE_EXISTING: an intervening creator cannot be overwritten.
 if unsafe{MoveFileExW(old.as_ptr(),new.as_ptr(),8)}==0{let e=std::io::Error::last_os_error();return Err(if matches!(e.raw_os_error(),Some(80|183)){"文件或文件夹已存在，请换个名称。".into()}else{e.to_string()})}Ok(())
}
#[cfg(not(windows))]
fn move_without_replace(_source:&Path,_target:&Path)->Result<(),String>{Err("当前平台暂不支持磁盘重命名。".into())}

fn rename_file(path:&Path,name:&str,expected:Option<&str>,root:Option<&Path>)->Result<(PathBuf,String),String>{
 checked_name(name,path)?;
 if fs::symlink_metadata(path).map_err(|e|e.to_string())?.file_type().is_symlink(){return Err("不支持重命名符号链接。".into())}
 let source=path.canonicalize().map_err(|e|e.to_string())?;
 if !source.is_file()&&!(source.is_dir()&&family(&source)==2){return Err("请选择文稿文件。".into())}
 if let Some(root)=root{let root=root.canonicalize().map_err(|e|e.to_string())?;if !source.starts_with(root){return Err("目录不在当前文件夹内。".into())}}
 let stamp=if source.is_dir(){super::packages::directory_stamp(&source)?}else{super::stamp(&source)?};
 if expected.is_some_and(|value|value!=stamp){return Err("文件已在外部修改，请重新加载后再重命名。".into())}
 let target=source.parent().ok_or("文件路径无效")?.join(name);
 if target==source&&source.file_name()==Some(std::ffi::OsStr::new(name)){return Ok((source,stamp))}
 if target.exists()&&!target.to_string_lossy().eq_ignore_ascii_case(&source.to_string_lossy()){return Err("文件或文件夹已存在，请换个名称。".into())}
 move_without_replace(&source,&target)?;Ok((target,stamp))
}
fn copy_history(app:&tauri::AppHandle,old:&str,new:&str)->Result<(),String>{
 if old.replace('\\',"/").eq_ignore_ascii_case(&new.replace('\\',"/")){return Ok(())}
 let source=super::history_dir(app,old)?;let target=super::history_dir(app,new)?;
 for item in fs::read_dir(source).map_err(|e|e.to_string())?{let item=item.map_err(|e|e.to_string())?;let path=item.path();if !item.file_type().map_err(|e|e.to_string())?.is_file()||!matches!(path.extension().and_then(|s|s.to_str()),Some("md"|"json")){continue}
  match fs::OpenOptions::new().write(true).create_new(true).open(target.join(item.file_name())){Ok(mut file)=>file.write_all(&fs::read(path).map_err(|e|e.to_string())?).map_err(|e|e.to_string())?,Err(e) if e.kind()==std::io::ErrorKind::AlreadyExists=>{},Err(e)=>return Err(e.to_string())}
 }Ok(())
}
#[tauri::command]
pub async fn rename_document(app:tauri::AppHandle,path:String,name:String,expected_modified:Option<String>,root:Option<String>)->Result<super::Saved,String>{tauri::async_runtime::spawn_blocking(move||{
 let (target,modified)=rename_file(Path::new(&path),&name,expected_modified.as_deref(),root.as_deref().map(Path::new))?;
 // Keep the pre-move stamp so a concurrent external edit is still detected by
 // subsequent saving, instead of adopting its timestamp with an older buffer.
 let new=super::library::display_path(&target);
 let history_warning=copy_history(&app,&path,&new).err();Ok(super::Saved{path:new,modified,history_warning})
 }).await.map_err(|e|e.to_string())?}

#[cfg(all(test,windows))]mod tests{
 use super::*;
 #[test]fn rename_preserves_bytes_and_refuses_overwrite(){let dir=tempfile::tempdir().unwrap();let old=dir.path().join("old.md");fs::write(&old,b"# unchanged\r\n").unwrap();let new=rename_file(&old,"new.md",None,Some(dir.path())).unwrap().0;assert!(!old.exists());assert_eq!(fs::read(&new).unwrap(),b"# unchanged\r\n");fs::write(&old,"keep").unwrap();assert!(rename_file(&new,"old.md",None,None).is_err());assert_eq!(fs::read_to_string(old).unwrap(),"keep");}
 #[test]fn validation_and_external_change_keep_source(){let dir=tempfile::tempdir().unwrap();let old=dir.path().join("old.md");fs::write(&old,"keep").unwrap();for name in ["../escape.md","CON.md","bad.","","new.txt"]{assert!(rename_file(&old,name,None,None).is_err())}assert!(rename_file(&old,"new.md",Some("outdated"),None).is_err());assert_eq!(fs::read_to_string(old).unwrap(),"keep");}
 #[test]fn native_move_refuses_a_target_created_after_preflight(){let dir=tempfile::tempdir().unwrap();let old=dir.path().join("old.md");let target=dir.path().join("new.md");fs::write(&old,"source").unwrap();fs::write(&target,"concurrent creator").unwrap();assert!(move_without_replace(&old,&target).is_err());assert_eq!(fs::read_to_string(old).unwrap(),"source");assert_eq!(fs::read_to_string(target).unwrap(),"concurrent creator");}
 #[test]fn case_only_dotfiles_and_extensionless_names(){let dir=tempfile::tempdir().unwrap();let old=dir.path().join("lower.txt");fs::write(&old,b"text").unwrap();let upper=rename_file(&old,"LOWER.txt",None,None).unwrap().0;assert_eq!(upper.file_name().unwrap(),"LOWER.txt");let dot=rename_file(&upper,".env",None,None).unwrap().0;let raw=rename_file(&dot,"LICENSE",None,None).unwrap().0;assert_eq!(fs::read(raw).unwrap(),b"text");}
 #[test]fn textbundle_and_root_boundaries(){let dir=tempfile::tempdir().unwrap();let old=dir.path().join("old.textbundle");fs::create_dir(&old).unwrap();fs::write(old.join("text.md"),"keep").unwrap();let outside=tempfile::tempdir().unwrap();assert!(rename_file(&old,"new.textbundle",None,Some(outside.path())).is_err());assert!(rename_file(&old,"new.textpack",None,None).is_err());let new=rename_file(&old,"new.textbundle",None,Some(dir.path())).unwrap().0;assert_eq!(fs::read_to_string(new.join("text.md")).unwrap(),"keep");}
}
