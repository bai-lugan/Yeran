import {ref} from 'vue'
import{invoke}from'@tauri-apps/api/core'
import{open}from'@tauri-apps/plugin-dialog'
import{browserHandles}from'./file-handles'
import{listedTextFile,decodeText}from'./plain-text'
const native='__TAURI_INTERNALS__'in window
export const canOpenSystemFolder=native
export function samePath(a?:string|null,b?:string|null){if(!a||!b)return false;const normalize=(path:string)=>{const value=path.replace(/\\/g,'/').replace(/\/$/,'');return native?value.toLowerCase():value};return normalize(a)===normalize(b)}
export interface LibraryEntry{path:string;name:string;relative:string;directory:boolean;handleKey?:string}
export interface SearchHit{path:string;name:string;line:number;excerpt:string;occurrence:number;query?:string;handleKey?:string}
export interface RenameTarget{path?:string|null;tabId?:string}
export function parentPath(path:string){const at=Math.max(path.lastIndexOf('/'),path.lastIndexOf('\\'));return at<0?'':at===0?path.slice(0,1):at===2&&/^[a-z]:/i.test(path)?path.slice(0,3):path.slice(0,at)}
export function withinFolder(path:string,root:string){const normalize=(s:string)=>s.replace(/\\/g,'/').replace(/\/$/,'').toLowerCase();return !!root&&(samePath(path,root)||normalize(path).startsWith(normalize(root)+'/'))}
function fileFamily(name:string){return /\.(md|markdown)$/i.test(name)?'md':/\.(textpack|tetpack)$/i.test(name)?'pack':/\.textbundle$/i.test(name)?'bundle':'text'}
export function renameName(name:string,source:string){
 if(!name||name==='.'||name==='..'||/[ .]$/.test(name))throw Error('名称不能为空或以空格、点结尾。')
 if(/[\\/<>:"|?*\u0000-\u001f\u007f]/.test(name))throw Error('名称不能包含路径或 Windows 特殊字符。')
 if(/^(CON|PRN|AUX|NUL|CLOCK\$|CONIN\$|CONOUT\$|(?:COM|LPT)[1-9¹²³])$/i.test(name.split('.')[0]!.trimEnd()))throw Error('这个名称是 Windows 保留名称。')
 if(name.length>255)throw Error('名称过长。')
 if(fileFamily(name)!==fileFamily(source))throw Error('更改文稿格式请使用另存为。')
 return name
}
export async function renameDocument(target:RenameTarget,name:string,modified?:string|null){
 if(!native||!target.path)throw Error('磁盘重命名请使用桌面版。')
 renameName(name,target.path)
 return invoke<{path:string;modified:string;historyWarning?:string}>('rename_document',{path:target.path,name,expectedModified:modified||null,root:withinFolder(target.path,libraryRoot.value)?libraryRoot.value:parentPath(target.path)})
}
export function rememberRename(oldPath:string,newPath:string){
 recentFiles.value=recentFiles.value.map(file=>samePath(file.path,oldPath)?{...file,path:newPath}:file).filter((file,index,all)=>all.findIndex(other=>samePath(other.path,file.path))===index)
 try{localStorage.setItem('yeran.recent-files.v1',JSON.stringify(recentFiles.value))}catch{}
 libraryIndex.value=libraryIndex.value.map(entry=>samePath(entry.path,oldPath)?{...entry,path:newPath,name:newPath.split(/[\\/]/).pop()!,relative:withinFolder(newPath,libraryRoot.value)?newPath.slice(libraryRoot.value.length+1):newPath}:entry)
}
export interface RecentFile{path:string;handleKey?:string;opened:number}
function stored<T>(key:string,fallback:T):T{try{return JSON.parse(localStorage.getItem(key)||'null')??fallback}catch{return fallback}}
const savedRoot=stored<unknown>('yeran.library-root.v1','');export const libraryRoot=ref(native&&typeof savedRoot==='string'?savedRoot:'')
const savedRecent=stored<unknown>('yeran.recent-files.v1',[]);export const recentFiles=ref<RecentFile[]>((Array.isArray(savedRecent)?savedRecent:[]).filter(f=>f&&typeof f.path==='string').slice(0,40))
export const libraryIndex=ref<LibraryEntry[]>([]),indexLimited=ref(false)
const directories=new Map<string,any>(),fileKeys=new Map<string,string>()
function fileKey(path:string,handle:any){const key=fileKeys.get(path)||crypto.randomUUID();fileKeys.set(path,key);browserHandles.set(key,handle);return key}
export function rememberFile(path:string,handleKey?:string){recentFiles.value=[{path,handleKey,opened:Date.now()},...recentFiles.value.filter(f=>native?f.path.toLowerCase()!==path.toLowerCase():f.path!==path)].slice(0,40);try{localStorage.setItem('yeran.recent-files.v1',JSON.stringify(recentFiles.value))}catch{}}
export function forgetRecent(path:string){recentFiles.value=recentFiles.value.filter(f=>f.path!==path);try{localStorage.setItem('yeran.recent-files.v1',JSON.stringify(recentFiles.value))}catch{}}
export async function chooseLibrary(){if(native){const result=await open({directory:true,multiple:false,title:'打开写作文件夹'});if(typeof result!=='string')return false;libraryRoot.value=result;localStorage.setItem('yeran.library-root.v1',result)}else{if(!('showDirectoryPicker'in window))throw Error('此浏览器不支持文件夹访问，请使用桌面版。');try{const handle=await(window as any).showDirectoryPicker();libraryRoot.value=handle.name;directories.clear();fileKeys.clear();directories.set(handle.name,handle)}catch(e){if((e as Error).name==='AbortError')return false;throw e}}libraryIndex.value=[];return true}
export async function folderChildren(path=libraryRoot.value):Promise<LibraryEntry[]>{
 if(native)return invoke('list_folder',{root:libraryRoot.value,path})
 const handle=directories.get(path);if(!handle)throw Error('请重新选择写作文件夹。');const result:LibraryEntry[]=[]
 for await(const[name,child]of handle.entries()){if(child.kind==='directory'&&name.startsWith('.')||['node_modules','target'].includes(name))continue;const at=path+'/'+name;if(child.kind==='directory'){directories.set(at,child);const bundle=name.toLowerCase().endsWith('.textbundle'),key=bundle?fileKey(at,child):undefined;result.push({name,path:at,relative:at.slice(libraryRoot.value.length+1),directory:!bundle,handleKey:key})}else if(/\.(md|markdown|textpack|tetpack)$/i.test(name)||listedTextFile(name)){const key=fileKey(at,child);result.push({name,path:at,relative:at.slice(libraryRoot.value.length+1),directory:false,handleKey:key})}if(result.length>=5000)break}
 return result.sort((a,b)=>Number(b.directory)-Number(a.directory)||a.name.localeCompare(b.name,undefined,{numeric:true}))
}
export function creationName(raw:string,directory:boolean){
 if(!raw||raw.startsWith('.')||/[ .]$/.test(raw))throw Error('名称不能为空、以点开头或以空格、点结尾。')
 if(/[\\/<>:"|?*\u0000-\u001f\u007f]/.test(raw))throw Error('名称不能包含路径或 Windows 特殊字符。')
 if(/^(CON|PRN|AUX|NUL|CLOCK\$|CONIN\$|CONOUT\$|(?:COM|LPT)[1-9¹²³])$/i.test(raw.split('.')[0]!.trimEnd()))throw Error('这个名称是 Windows 保留名称。')
 const name=directory||raw.includes('.')?raw:raw+'.md'
 if(name.length>255)throw Error('名称过长。')
 if(!directory&&!/\.(md|markdown)$/i.test(name)&&!listedTextFile(name))throw Error('请选择文本类文件后缀。')
 if(directory&&/\.textbundle$/i.test(name))throw Error('新建 TextBundle 请使用另存为。')
 return name
}
export async function createLibraryEntry(parent:string,raw:string,directory:boolean,scope=libraryRoot.value):Promise<LibraryEntry>{
 const name=creationName(raw,directory),root=scope
 if(native)return invoke('create_library_entry',{root,parent,name,directory})
 const handle=directories.get(parent)
 if(!handle||!samePath(root,parent)&&!parent.startsWith(root+'/'))throw Error('请重新选择写作文件夹。')
 for await(const [existing]of handle.entries())if(existing.toLowerCase()===name.toLowerCase())throw Error('文件或文件夹已存在，请换个名称。')
 const child=directory?await handle.getDirectoryHandle(name,{create:true}):await handle.getFileHandle(name,{create:true}),path=parent+'/'+name
 if(directory)directories.set(path,child)
 return{name,path,relative:path.slice(root.length+1),directory,handleKey:directory?undefined:fileKey(path,child)}
}
export async function openLibraryFolder(path=libraryRoot.value){
 if(!native)throw Error('请使用桌面版打开 Windows 文件夹。')
 if(!path)throw Error('请先保存文稿或选择文件夹。')
 // Open editors can live outside the workspace, or without a workspace at all.
 const root=withinFolder(path,libraryRoot.value)?libraryRoot.value:path
 try{await invoke('open_library_folder',{root,path})}catch(error){if(/\(os error [23]\)|NotFoundError/.test(String(error)))throw Error('文件夹已移走或删除，请重新选择文件夹。');throw error}
}
export async function refreshLibrary(){if(!libraryRoot.value)return[];if(native){const data=await invoke<{files:LibraryEntry[];truncated:boolean}>('index_folder',{root:libraryRoot.value});libraryIndex.value=data.files;indexLimited.value=data.truncated}else{const files:LibraryEntry[]=[],queue=[libraryRoot.value];let count=0;while(queue.length&&files.length<5000&&++count<2000){for(const entry of await folderChildren(queue.shift()!)){if(entry.directory)queue.push(entry.path);else files.push(entry)}}libraryIndex.value=files;indexLimited.value=queue.length>0}return libraryIndex.value}
export async function searchLibrary(query:string,sensitive=false):Promise<{results:SearchHit[];truncated:boolean;scanned:number}>{
 if(native)return invoke('search_folder',{root:libraryRoot.value,query,sensitive})
 const files=await refreshLibrary(),results:SearchHit[]=[];let bytes=0,scanned=0,truncated=indexLimited.value
 for(const entry of files){if(/\.(textpack|tetpack)$/i.test(entry.path))continue;const handle=entry.handleKey?browserHandles.get(entry.handleKey):undefined;if(!handle)continue;const file=await handle.getFile();if(file.size>20*1024*1024){truncated=true;continue}bytes+=file.size;if(bytes>64*1024*1024){truncated=true;break}let text:string;try{text=file.arrayBuffer?decodeText(new Uint8Array(await file.arrayBuffer())).content:await file.text()}catch{truncated=true;continue}scanned++;let occurrence=0;for(const[index,line]of text.split(/\r\n|\r|\n/).entries()){const hay=sensitive?line:line.toLocaleLowerCase(),needle=sensitive?query:query.toLocaleLowerCase();let from=0,at:number;while(needle&&(at=hay.indexOf(needle,from))>=0){results.push({path:entry.path,name:entry.relative,line:index+1,excerpt:line.slice(0,200),occurrence:occurrence++,handleKey:entry.handleKey});from=at+needle.length;if(results.length>=300)return{results,truncated:true,scanned}}}}return{results,truncated,scanned}
}
