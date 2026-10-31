use std::path::Path;
pub fn decode(bytes:&[u8])->Result<(String,&'static str),String>{
 let (content,encoding)=if bytes.starts_with(&[255,254])||bytes.starts_with(&[254,255]){
  if bytes.len()%2!=0{return Err("文件不是支持的 UTF-8 / UTF-16 文本，未作为文本打开。".into())}
  let little=bytes[0]==255;let words:Vec<u16>=bytes.chunks_exact(2).map(|b|if little{u16::from_le_bytes([b[0],b[1]])}else{u16::from_be_bytes([b[0],b[1]])}).collect();
  (String::from_utf16(&words).map_err(|_|"文件不是支持的 UTF-8 / UTF-16 文本，未作为文本打开。")?,if little{"utf16le"}else{"utf16be"})
 }else{(String::from_utf8(bytes.to_vec()).map_err(|_|"文件不是支持的 UTF-8 / UTF-16 文本，未作为文本打开。")?,"utf8")};
 if content.chars().any(|c|c=='\0'||(c.is_ascii_control()&&!['\t','\n','\r','\u{c}','\u{1b}'].contains(&c))){return Err("文件包含二进制数据，未作为文本打开。".into())}
 Ok((content,encoding))
}
pub fn read(path:&Path)->Result<(String,&'static str),String>{decode(&std::fs::read(path).map_err(|e|e.to_string())?)}
pub fn encode(content:&str,encoding:&str)->Result<Vec<u8>,String>{
 match encoding{
  "utf8"=>Ok(content.as_bytes().to_vec()),
  "utf16le"|"utf16be"=>Ok(content.encode_utf16().flat_map(|word|if encoding=="utf16le"{word.to_le_bytes()}else{word.to_be_bytes()}).collect()),
  _=>Err("文本编码无效，原文件未覆盖。".into())
 }
}
pub fn listed(name:&str)->bool{
 let name=name.to_lowercase();let extension=name.rsplit('.').next().unwrap_or("");
 !name.trim_start_matches('.').contains('.')||name.starts_with(".env.")||["md","markdown","textpack","tetpack","textbundle","txt","text","log","csv","tsv","json","jsonc","jsonl","yaml","yml","xml","html","htm","css","scss","less","js","jsx","mjs","cjs","ts","tsx","py","pyw","bat","cmd","ps1","psm1","psd1","sh","bash","zsh","ksh","fish","ini","cfg","conf","config","toml","properties","env","gitignore","gitattributes","editorconfig","rst","tex","sql","c","h","cpp","hpp","cs","go","rs","java","rb","php","swift","kt","kts","vue","svelte"].contains(&extension)
}
