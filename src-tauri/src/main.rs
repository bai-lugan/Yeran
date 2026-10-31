#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use serde::{Serialize, Deserialize};
mod packages;
mod assets;
mod library;
mod text_io;
mod rename;
use tauri::{Manager,Emitter};
use std::sync::Mutex;
struct PendingFiles(Mutex<Vec<String>>);
fn launch_paths(args:impl Iterator<Item=String>,cwd:&Path)->Vec<String>{args.filter_map(|arg|{let p=PathBuf::from(arg);let p=if p.is_absolute(){p}else{cwd.join(p)};if p.is_file()||p.is_dir()&&p.extension().is_some_and(|e|e.eq_ignore_ascii_case("textbundle")){Some(p.to_string_lossy().into_owned())}else{None}}).collect()}
#[tauri::command]
fn take_open_file(pending:tauri::State<PendingFiles>)->Option<String>{let mut files=pending.0.lock().ok()?;if files.is_empty(){None}else{Some(files.remove(0))}}
use std::{fs, path::{Path, PathBuf}, process::Command, time::{Duration, Instant, UNIX_EPOCH}};
#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[derive(Serialize)]
#[serde(rename_all="camelCase")]
struct Document { content: String, path: String, modified: String, text_encoding:String }
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Saved { path: String, modified: String, history_warning: Option<String> }
#[derive(Serialize, Deserialize, Clone)]
struct HistoryEntry { id: String, created: String, reason: String, characters: usize }
fn history_dir(app: &tauri::AppHandle, key: &str) -> Result<PathBuf, String> {
    let mut hash: u64 = 0xcbf29ce484222325;
    for byte in key.replace('\\', "/").to_lowercase().as_bytes() { hash ^= *byte as u64; hash = hash.wrapping_mul(0x100000001b3); }
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?.join("history-v1").join(format!("{hash:016x}"));
    fs::create_dir_all(&dir).map_err(|e| format!("无法创建历史目录：{e}"))?;
    Ok(dir)
}
fn history_entries(dir: &Path) -> Vec<HistoryEntry> {
    let mut entries: Vec<HistoryEntry> = fs::read_dir(dir).into_iter().flatten().flatten().filter_map(|entry| {
        if entry.path().extension().and_then(|s| s.to_str()) != Some("json") { return None }
        fs::read(entry.path()).ok().and_then(|bytes| serde_json::from_slice(&bytes).ok())
    }).collect();
    entries.sort_by(|a,b| b.id.cmp(&a.id)); entries
}
fn snapshot(app: &tauri::AppHandle, key: &str, content: &str, reason: &str) -> Result<(), String> {
    let dir = history_dir(app, key)?;
    let entries = history_entries(&dir);
    if let Some(latest) = entries.first() {
        if fs::read_to_string(dir.join(format!("{}.md", latest.id))).ok().as_deref() == Some(content) { return Ok(()) }
    }
    let now = std::time::SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default();
    let entry = HistoryEntry { id: now.as_nanos().to_string(), created: now.as_millis().to_string(), reason: reason.to_owned(), characters: content.chars().count() };
    let data = tempfile::NamedTempFile::new_in(&dir).map_err(|e| e.to_string())?;
    fs::write(data.path(), content).map_err(|e| e.to_string())?;
    data.as_file().sync_all().map_err(|e| e.to_string())?;
    data.persist(dir.join(format!("{}.md", entry.id))).map_err(|e| e.to_string())?;
    let meta = serde_json::to_vec(&entry).map_err(|e| e.to_string())?;
    fs::write(dir.join(format!("{}.json", entry.id)), meta).map_err(|e| e.to_string())?;
    let mut bytes = content.len() as u64;
    for (index, old) in entries.iter().enumerate() {
        let file = dir.join(format!("{}.md", old.id)); bytes += fs::metadata(&file).map(|m| m.len()).unwrap_or(0);
        if index >= 29 || index > 0 && bytes > 64 * 1024 * 1024 { let _ = fs::remove_file(file); let _ = fs::remove_file(dir.join(format!("{}.json", old.id))); }
    }
    Ok(())
}
#[tauri::command]
async fn record_history(app: tauri::AppHandle, key: String, content: String, reason: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || snapshot(&app, &key, &content, &reason)).await.map_err(|e| e.to_string())?
}
#[tauri::command]
async fn list_history(app: tauri::AppHandle, key: String) -> Result<Vec<HistoryEntry>, String> {
    tauri::async_runtime::spawn_blocking(move || history_dir(&app, &key).map(|dir| history_entries(&dir))).await.map_err(|e| e.to_string())?
}
#[tauri::command]
async fn read_history(app: tauri::AppHandle, key: String, id: String) -> Result<String, String> {
    if id.is_empty() || !id.bytes().all(|b| b.is_ascii_digit()) { return Err("历史版本编号无效".into()) }
    tauri::async_runtime::spawn_blocking(move || fs::read_to_string(history_dir(&app, &key)?.join(format!("{id}.md"))).map_err(|e| e.to_string())).await.map_err(|e| e.to_string())?
}
#[derive(Serialize)]
struct DocumentStatus { modified: Option<String>, missing: bool }
#[tauri::command]
fn document_status(path: String) -> Result<DocumentStatus, String> {
    let target = PathBuf::from(path);
    if !target.exists() { return Ok(DocumentStatus { modified: None, missing: true }) }
    Ok(DocumentStatus { modified: Some(if target.is_dir() { packages::directory_stamp(&target)? } else { stamp(&target)? }), missing: false })
}
fn stamp(path: &Path) -> Result<String, String> {
    fs::metadata(path).and_then(|m| m.modified()).map(|t| t.duration_since(UNIX_EPOCH).unwrap_or_default().as_nanos().to_string()).map_err(|e| e.to_string())
}
#[tauri::command]
fn read_document(path: String) -> Result<Document, String> {
    let target = PathBuf::from(&path);
    let metadata = fs::metadata(&target).map_err(|e| format!("无法打开文件：{e}"))?;
    if metadata.len() > 20 * 1024 * 1024 { return Err("支持 20 MB 以内的文本文件。".into()) }
    let (content,encoding)=text_io::read(&target)?;
    Ok(Document { content, modified: stamp(&target)?, path,text_encoding:encoding.into() })
}
#[tauri::command]
async fn write_document(app: tauri::AppHandle, path: String, content: String, expected_modified: Option<String>, fail_if_missing: Option<bool>,text_encoding:Option<String>) -> Result<Saved, String> {
    tauri::async_runtime::spawn_blocking(move || {
    let target = PathBuf::from(&path);
    if fail_if_missing.unwrap_or(false) && !target.is_file() { return Err("自动保存已停止：原文件已移走或删除。".into()) }
    let original_stamp = if target.exists() { Some(stamp(&target)?) } else { None };
    if target.exists() {
        if let Some(expected) = expected_modified.as_ref() {
            if original_stamp.as_ref() != Some(expected) { return Err("文件已被其他应用修改。请另存为，避免覆盖新的内容。".into()) }
        }
    }
    if target.is_file() {
        let previous = text_io::read(&target)?.0;
        snapshot(&app, &path, &previous, "保存前版本").map_err(|e| format!("历史备份失败，原文件未覆盖：{e}"))?;
    }
    let parent = target.parent().ok_or("文件路径无效")?;
    let temp = tempfile::NamedTempFile::new_in(parent).map_err(|e| format!("无法创建临时文件：{e}"))?;
    let bytes=text_io::encode(&content,text_encoding.as_deref().unwrap_or("utf8"))?;
    fs::write(temp.path(), bytes).map_err(|e| format!("保存失败：{e}"))?;
    temp.as_file().sync_all().map_err(|e| e.to_string())?;
    if (if target.exists() { Some(stamp(&target)?) } else { None }) != original_stamp { return Err("备份期间文件又被其他应用修改，原文件未覆盖。".into()) }
    // tempfile::persist atomically replaces the target; the original remains intact on failure.
    temp.persist(&target).map_err(|e| format!("无法完成保存，原文件未替换：{e}"))?;
    let history_warning = snapshot(&app, &path, &content, "已保存").err();
    Ok(Saved { modified: stamp(&target)?, path, history_warning })
    }).await.map_err(|e| e.to_string())?
}
#[tauri::command]
fn launch_file() -> Option<String> {
    launch_paths(std::env::args().skip(1),&std::env::current_dir().unwrap_or_default()).into_iter().next()
}
fn find_browser() -> Option<PathBuf> {
    let candidates = [
        ("PROGRAMFILES(X86)", "Microsoft/Edge/Application/msedge.exe"),
        ("PROGRAMFILES", "Microsoft/Edge/Application/msedge.exe"),
        ("PROGRAMFILES", "Google/Chrome/Application/chrome.exe"),
        ("LOCALAPPDATA", "Microsoft/Edge/Application/msedge.exe"),
        ("LOCALAPPDATA", "Google/Chrome/Application/chrome.exe"),
    ];
    candidates.iter().filter_map(|(base, suffix)| std::env::var_os(base).map(|p| PathBuf::from(p).join(suffix))).find(|p| p.is_file())
}
#[tauri::command]
async fn export_pdf(html: String, path: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let outline=html.contains("<meta name=\"yeran-pdf-outline\" content=\"true\">");
        let browser = find_browser().ok_or("未找到 Microsoft Edge 或 Chrome，无法导出 PDF。")?;
        let temp = tempfile::tempdir().map_err(|e| e.to_string())?;
        let source = temp.path().join("document.html");
        let output = temp.path().join("document.pdf");
        fs::write(&source, html).map_err(|e| e.to_string())?;
        let url = url::Url::from_file_path(&source).map_err(|_| "临时路径无效")?;
        let mut command = Command::new(browser);
        if outline {command.arg("--generate-pdf-document-outline");}
        command.args(["--headless=new", "--disable-gpu", "--no-pdf-header-footer", "--no-first-run", "--disable-extensions", "--disable-background-networking", "--allow-file-access-from-files"])
            .arg(format!("--user-data-dir={}", temp.path().join("profile").display()))
            .arg(format!("--print-to-pdf={}", output.display()))
            .arg(url.as_str()).stdout(std::process::Stdio::null()).stderr(std::process::Stdio::null());
        #[cfg(windows)] command.creation_flags(0x08000000);
        let mut child = command.spawn().map_err(|e| format!("无法启动 PDF 导出：{e}"))?;
        let started = Instant::now();
        let mut previous_size = 0;
        let mut stable_size = 0;
        loop {
            match child.try_wait().map_err(|e| e.to_string())? {
                Some(status) => { if !status.success() { return Err("PDF 导出进程失败，文稿未受影响。".into()) } },
                None if started.elapsed() > Duration::from_secs(60) => { let _ = child.kill(); let _ = child.wait(); return Err("PDF 导出超时，请缩小文档或检查图片后重试。".into()) },
                None => {},
            }
            // On Windows the Edge launcher may exit before its browser process writes the PDF.
            let size = fs::metadata(&output).map(|m| m.len()).unwrap_or(0);
            if size > 100 && size == previous_size { stable_size += 1; } else { stable_size = 0; }
            if stable_size >= 3 { break; }
            if started.elapsed() > Duration::from_secs(60) { let _ = child.kill(); let _ = child.wait(); return Err("未能生成 PDF，请检查 Edge 后重试。".into()); }
            previous_size = size;
            std::thread::sleep(Duration::from_millis(150));
        }
        if !output.is_file() || fs::metadata(&output).map_err(|e| e.to_string())?.len() < 100 { return Err("没有生成有效的 PDF 文件。".into()) }
        let target = PathBuf::from(path);
        let parent = target.parent().ok_or("输出路径无效")?;
        let dest = tempfile::NamedTempFile::new_in(parent).map_err(|e| e.to_string())?;
        fs::copy(&output, dest.path()).map_err(|e| e.to_string())?;
        dest.persist(target).map_err(|e| e.to_string())?;
        Ok(())
    }).await.map_err(|e| e.to_string())?
}
fn copy_tree(from: &Path, to: &Path) -> std::io::Result<()> {
    fs::create_dir_all(to)?;
    for entry in fs::read_dir(from)? {
        let entry = entry?;
        let target = to.join(entry.file_name());
        let kind = entry.file_type()?;
        if kind.is_dir() { copy_tree(&entry.path(), &target)? }
        else if kind.is_file() { let _ = fs::copy(entry.path(), &target); }
    }
    Ok(())
}
// 0.x builds used the com.paperleaf.editor identifier, so drafts, settings and
// document history live in that directory. Copy it across once; the original is
// kept so a downgrade still finds its data.
fn migrate_legacy_data() {
    for base in [std::env::var_os("APPDATA"), std::env::var_os("LOCALAPPDATA")].into_iter().flatten() {
        let base = PathBuf::from(base);
        let legacy = base.join("com.paperleaf.editor");
        let current = base.join("com.yeran.editor");
        if !legacy.is_dir() || current.exists() { continue }
        let staging = base.join("com.yeran.editor.migrating");
        let _ = fs::remove_dir_all(&staging);
        if copy_tree(&legacy, &staging).is_ok() { let _ = fs::rename(&staging, &current); }
        let _ = fs::remove_dir_all(&staging);
    }
}
fn main() {
    migrate_legacy_data();
    tauri::Builder::default()
        .manage(PendingFiles(Mutex::new(launch_paths(std::env::args().skip(1),&std::env::current_dir().unwrap_or_default()))))
        .plugin(tauri_plugin_single_instance::init(|app,args,cwd|{
            let files=launch_paths(args.into_iter().skip(1),Path::new(&cwd));
            if let Ok(mut pending)=app.state::<PendingFiles>().0.lock(){pending.extend(files)}
            let _=app.emit("yeran-open-files",());
            if let Some(window)=app.get_webview_window("main"){let _=window.show();let _=window.unminimize();let _=window.set_focus();}
        }))
        .plugin(tauri_plugin_dialog::init()).plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![read_document, write_document, export_pdf, launch_file, take_open_file, record_history, list_history, read_history, document_status, packages::read_textbundle, packages::read_binary_document, packages::write_binary_document, packages::write_textbundle, packages::resolve_document_path, assets::save_image_asset, assets::read_image_asset, library::list_folder,library::index_folder,library::search_folder,library::create_library_entry,library::open_library_folder,rename::rename_document])
        .run(tauri::generate_context!()).expect("无法启动页然");
}
