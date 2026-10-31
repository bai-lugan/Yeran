use serde::Serialize;
use std::{fs, path::{Path, PathBuf}};
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlacedImage { pub relative: String, pub absolute: String }
fn safe_stem(name: &str) -> String {
    let stem:String=name.chars().map(|c|if c.is_alphanumeric()||"-_ .".contains(c){c}else{'_'}).take(80).collect();
    let stem=stem.trim().trim_end_matches('.');
    let reserved=matches!(stem.split('.').next().unwrap_or("").to_uppercase().as_str(),"CON"|"PRN"|"AUX"|"NUL"|"COM1"|"COM2"|"COM3"|"COM4"|"COM5"|"COM6"|"COM7"|"COM8"|"COM9"|"LPT1"|"LPT2"|"LPT3"|"LPT4"|"LPT5"|"LPT6"|"LPT7"|"LPT8"|"LPT9");
    if stem.is_empty(){"image".into()}else if reserved{format!("_{stem}")}else{stem.into()}
}
#[tauri::command]
pub async fn save_image_asset(document_path:String,filename:String,data:Vec<u8>)->Result<PlacedImage,String>{
 tauri::async_runtime::spawn_blocking(move||{
    if data.is_empty()||data.len()>40*1024*1024{return Err("图片为空或超过 40 MB。".into())}
    let document=PathBuf::from(document_path);let parent=document.parent().ok_or("文稿路径无效")?;
    let parent=parent.canonicalize().map_err(|e|e.to_string())?;
    let stem=safe_stem(document.file_stem().and_then(|s|s.to_str()).unwrap_or("image"));
    let folder=parent.join(format!("{stem}.assets"));fs::create_dir_all(&folder).map_err(|e|e.to_string())?;
    if !folder.canonicalize().map_err(|e|e.to_string())?.starts_with(&parent){return Err("图片目录不能指向文稿目录以外。".into())}
    let name=safe_stem(&filename);let target=folder.join(&name);
    let placed=PlacedImage{relative:format!("{stem}.assets/{name}"),absolute:target.to_string_lossy().into_owned()};
    if target.exists(){if fs::read(&target).map_err(|e|e.to_string())?==data{return Ok(placed)}return Err("同名图片内容不同，原图未覆盖。".into())}
    let temp=tempfile::NamedTempFile::new_in(&folder).map_err(|e|e.to_string())?;
    fs::write(temp.path(),data).map_err(|e|e.to_string())?;temp.as_file().sync_all().map_err(|e|e.to_string())?;
    temp.persist_noclobber(target).map_err(|e|format!("无法保存图片，已有文件未覆盖：{e}"))?;
    Ok(placed)
 }).await.map_err(|e|e.to_string())?
}
#[tauri::command]
pub async fn read_image_asset(path:String,document_path:Option<String>)->Result<tauri::ipc::Response,String>{
 tauri::async_runtime::spawn_blocking(move||{
    let file=if path.starts_with("file:"){url::Url::parse(&path).map_err(|e|e.to_string())?.to_file_path().map_err(|_|"图片文件地址无效")?}
      else if Path::new(&path).is_absolute(){PathBuf::from(path)}
      else {let base=PathBuf::from(document_path.ok_or("图片缺少原文稿路径")?);url::Url::from_file_path(base).map_err(|_|"文稿路径无效")?.join(&path).map_err(|e|e.to_string())?.to_file_path().map_err(|_|"图片地址不是本地文件")?};
    let meta=fs::metadata(&file).map_err(|e|format!("找不到图片：{e}"))?;
    if !meta.is_file()||meta.len()>40*1024*1024{return Err("图片不是文件或超过 40 MB。".into())}
    Ok(tauri::ipc::Response::new(fs::read(file).map_err(|e|e.to_string())?))
 }).await.map_err(|e|e.to_string())?
}
