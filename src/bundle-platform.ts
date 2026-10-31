import { invoke } from '@tauri-apps/api/core'
import { open,save } from '@tauri-apps/plugin-dialog'
import { browserHandles } from './file-handles'
import { createBundleDocument,parseBundle,unpackTextPack,packBundle,storeBundle,getBundle,type DocumentFormat } from './textbundle'
import { recordHistory } from './history'
import type { JSONContent } from '@tiptap/core'
const native='__TAURI_INTERNALS__' in window
export interface BundleResources {json:JSONContent;prefix:string;serialize:(json:JSONContent)=>string;images:Record<string,string>;bundleKey?:string;documentPath?:string}
export function documentFormat(path:string):DocumentFormat {return /\.textbundle[\\/]?$/i.test(path)?'textbundle':/\.(textpack|tetpack)$/i.test(path)?'textpack':'markdown'}
async function directoryFiles(handle:any,prefix='',files:Record<string,Uint8Array>=Object.create(null),budget={bytes:0,count:0}){for await(const[name,entry]of handle.entries()){if(entry.kind==='directory')await directoryFiles(entry,prefix+name+'/',files,budget);else{const file=await entry.getFile();if((budget.bytes+=file.size)>64*1024*1024||++budget.count>1024)throw new Error('TextBundle 资源过大。');files[prefix+name]=new Uint8Array(await file.arrayBuffer())}}return files}
export async function readBundleDocument(path:string,handleKey?:string,cache=true){
  const format=documentFormat(path),handle=handleKey?browserHandles.get(handleKey):undefined
  let data,modified:string
  if(native){
    const before=await invoke<{modified:string;missing:boolean}>('document_status',{path});if(before.missing)throw new Error('TextBundle 文件未找到。')
    if(format==='textbundle'){const files=await invoke<{name:string;data:number[]}[]>('read_textbundle',{path});data=parseBundle(Object.fromEntries(files.map(f=>[f.name,new Uint8Array(f.data)])))}
    else data=unpackTextPack(new Uint8Array(await invoke<ArrayBuffer>('read_binary_document',{path})))
    const after=await invoke<{modified:string}>('document_status',{path});if(before.modified!==after.modified)throw new Error('读取期间 TextBundle 已被其他应用修改，请重试。');modified=after.modified
  }else{
    if(!handle)throw new Error('请重新选择 TextPack 文件。')
    if(format==='textbundle'){data=parseBundle(await directoryFiles(handle));modified=await browserDirectoryStamp(handle)}else{const file=await handle.getFile();data=unpackTextPack(new Uint8Array(await file.arrayBuffer()));modified=String(file.lastModified)}
  }
  if(cache)await storeBundle(data)
  return{path,content:data.content,modified,handleKey,format,bundleKey:cache?data.key:undefined}
}
export async function pickBundleFolder(){
  if(native){const path=await open({directory:true,multiple:false,title:'打开 TextBundle 文件夹'});return typeof path==='string'?[await readBundleDocument(path)]:[]}
  if(!('showDirectoryPicker' in window))throw new Error('此浏览器无法打开 TextBundle 文件夹，请改用 TextPack 文件或桌面版。')
  try{const handle=await(window as any).showDirectoryPicker(),key=crypto.randomUUID();browserHandles.set(key,handle);return[await readBundleDocument(handle.name,key)]}catch(e){if((e as Error).name==='AbortError')return[];throw e}
}
export async function browserDirectoryStamp(handle:any){const rows:string[]=[];async function scan(dir:any,prefix:string){for await(const[name,entry]of dir.entries()){if(entry.kind==='directory')await scan(entry,prefix+name+'/');else{const file=await entry.getFile();rows.push(`${prefix}${name}:${file.size}:${file.lastModified}`)}}}await scan(handle,'');return rows.sort().join('|')}
export async function saveBundleDocument(options:{content:string;path:string|null;modified:string|null;saveAs:boolean;handleKey?:string;format:Exclude<DocumentFormat,'markdown'>;resources:BundleResources;reserved:{paths:string[];handles:string[]};explicitTarget?:string;automatic?:boolean}){
  let target=options.explicitTarget||options.path,handle=!options.saveAs&&options.handleKey?browserHandles.get(options.handleKey):undefined
  const ext=options.format==='textbundle'?'textbundle':'textpack'
  if(native&&!options.explicitTarget&&(!target||options.saveAs)){target=await save({defaultPath:target||`未命名.${ext}`,filters:[{name:ext,extensions:[ext]}]});if(!target)return null}
  if(!native&&!handle){
    if(options.format==='textbundle')throw new Error('浏览器版请导出 TextPack；TextBundle 文件夹保存请使用桌面版。')
    if('showSaveFilePicker' in window){try{handle=await(window as any).showSaveFilePicker({suggestedName:target||'未命名.textpack',types:[{description:'TextPack',accept:{'application/zip':['.textpack']}}]});target=handle.name}catch(e){if((e as Error).name==='AbortError')return null;throw e}}
  }
  target ||= '未命名.textpack'
  if(options.reserved.paths.some(p=>p.replace(/\\/g,'/').toLowerCase()===target!.replace(/\\/g,'/').toLowerCase()))throw new Error('目标文件已在其他标签页打开。')
  for(const key of options.reserved.handles){const other=browserHandles.get(key);if(handle&&other&&(handle===other||other.isSameEntry&&await other.isSameEntry(handle)))throw new Error('目标文件已在其他标签页打开。')}
  const {data,rewrites}=await createBundleDocument(options.resources)
  if(options.saveAs||target!==options.path)data.key=crypto.randomUUID()
  let expected:string|null=null
  if(native){const status=await invoke<{modified:string|null;missing:boolean}>('document_status',{path:target});if(!status.missing){expected=status.modified;if(target===options.path&&options.modified!==expected)throw new Error('文件已被其他应用修改。');const previous=await readBundleDocument(target,undefined,false);await recordHistory(target,previous.content,'保存前版本')}}
  else if(handle){if(options.format==='textbundle'){expected=await browserDirectoryStamp(handle);if(options.modified&&expected!==options.modified)throw new Error('TextBundle 已被其他应用修改。');if(options.resources.bundleKey)await recordHistory(target,(await getBundle(options.resources.bundleKey)).content,'保存前版本')}
    else{const file=await handle.getFile();expected=String(file.lastModified);if(!options.saveAs&&options.modified&&expected!==options.modified)throw new Error('文件已被其他应用修改。');if(file.size)await recordHistory(target,unpackTextPack(new Uint8Array(await file.arrayBuffer())).content,'保存前版本')}}
  let modified=''
  await storeBundle(data)
  if(native){const result=options.format==='textbundle'?await invoke<{modified:string}>('write_textbundle',{path:target,files:Object.entries(data.files).map(([name,bytes])=>({name,data:Array.from(bytes)})),expectedModified:expected,failIfMissing:options.automatic||false}):await invoke<{modified:string}>('write_binary_document',{path:target,data:Array.from(packBundle(data)),expectedModified:expected});modified=result.modified}
  else if(handle){if(options.format==='textbundle'){for(const[path,bytes]of Object.entries(data.files)){let dir=handle;const parts=path.split('/');for(const part of parts.slice(0,-1))dir=await dir.getDirectoryHandle(part,{create:true});const file=await dir.getFileHandle(parts.at(-1),{create:true}),stream=await file.createWritable();await stream.write(bytes);await stream.close()}modified=await browserDirectoryStamp(handle)}
    else{const stream=await handle.createWritable();await stream.write(packBundle(data));await stream.close();modified=String((await handle.getFile()).lastModified)}}
  else{const bytes=packBundle(data),url=URL.createObjectURL(new Blob([bytes.slice().buffer],{type:'application/zip'})),a=document.createElement('a');a.href=url;a.download=target;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000)}
  let historyWarning:string|undefined
  try{await recordHistory(target,data.content,'已保存')}catch(e){historyWarning=String(e)}
  const key=handle?(options.handleKey||crypto.randomUUID()):undefined;if(handle&&key)browserHandles.set(key,handle)
  return{path:target,modified,handleKey:key,historyWarning,format:options.format,bundleKey:data.key,writtenContent:data.content,rewrites}
}
