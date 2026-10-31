import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate'
import type { JSONContent } from '@tiptap/core'
import { imageBytes,imageDigest,imageExtension } from './image-resources'

export type DocumentFormat = 'markdown'|'textpack'|'textbundle'
export interface BundleData { key:string; info:Record<string,unknown>; files:Record<string,Uint8Array>; textPath:string; content:string }
const memory=new Map<string,BundleData>(),urls=new Map<string,Map<string,string>>()
const LIMIT=64*1024*1024, COUNT=1024
let database:Promise<IDBDatabase>|undefined
function db(){return database ||= new Promise((resolve,reject)=>{const r=indexedDB.open('yeran-bundles-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('bundles',{keyPath:'key'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
export async function storeBundle(data:BundleData){const d=await db();await new Promise<void>((resolve,reject)=>{const tx=d.transaction('bundles','readwrite');tx.objectStore('bundles').put(data);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)});memory.set(data.key,data)}
export async function getBundle(key:string){if(memory.has(key))return memory.get(key)!;const d=await db();const data=await new Promise<BundleData>((resolve,reject)=>{const r=d.transaction('bundles').objectStore('bundles').get(key);r.onsuccess=()=>r.result?resolve(r.result):reject(new Error('文稿素材缓存未找到，请重新打开原始 TextPack。'));r.onerror=()=>reject(r.error)});memory.set(key,data);return data}
export function packagePath(name:string){
  const path=name.replace(/\\/g,'/');if(path.startsWith('/')||path.replace(/\/$/,'').split('/').some(part=>!part||part==='..'||part==='.'||/[. ]$/.test(part)||/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(part)||part.includes(':')||/[\u0000-\u001f]/.test(part)))throw new Error('TextPack 包含无效资源路径。')
  return path
}
export function parseBundle(input:Record<string,Uint8Array>):BundleData {
  const files:Record<string,Uint8Array>=Object.create(null),names=new Set<string>();let total=0,count=0
  for(const[name,bytes]of Object.entries(input)){
    const path=packagePath(name);if(path.endsWith('/')||path.split('/').some(p=>p==='__MACOSX'||p==='.DS_Store'||p.startsWith('._')))continue
    if(names.has(path.toLowerCase()))throw new Error('TextPack 包含重名或仅大小写不同的文件。');names.add(path.toLowerCase())
    if(++count>COUNT||(total+=bytes.byteLength)>LIMIT)throw new Error('TextBundle 超过 64 MB 或 1024 个文件的限制。')
    files[path]=bytes
  }
  const infoPaths=Object.keys(files).filter(p=>p==='info.json'||p.endsWith('/info.json'))
  if(infoPaths.length!==1)throw new Error('未找到唯一的 TextBundle info.json。')
  const prefix=infoPaths[0]!.slice(0,-'info.json'.length),normalized:Record<string,Uint8Array>=Object.create(null)
  for(const[path,bytes]of Object.entries(files)){if(!path.startsWith(prefix))throw new Error('TextPack 中有多个文稿或包外文件。');normalized[path.slice(prefix.length)]=bytes}
  let info:Record<string,unknown>;try{info=JSON.parse(strFromU8(normalized['info.json']!))}catch{throw new Error('TextBundle info.json 不是有效 JSON。')}
  if(!info||Array.isArray(info)||![1,2].includes(info.version as number))throw new Error('仅支持 TextBundle v1 / v2。')
  if(info.type&&info.type!=='net.daringfireball.markdown'&&info.type!=='public.plain-text')throw new Error('此 TextBundle 不是 Markdown 或纯文本文稿。')
  const texts=Object.keys(normalized).filter(p=>/^text\.(markdown|md|txt)$/i.test(p));if(texts.length!==1)throw new Error('TextBundle 必须包含唯一的 text.markdown、text.md 或 text.txt。')
  const textPath=texts[0]!,content=new TextDecoder('utf-8',{fatal:true}).decode(normalized[textPath])
  if(content.length>20*1024*1024)throw new Error('Markdown 正文超过 20 MB。')
  return{key:crypto.randomUUID(),info,files:normalized,textPath,content}
}
export function unpackTextPack(bytes:Uint8Array){if(bytes.byteLength>LIMIT)throw new Error('TextPack 文件超过 64 MB。');let total=0,count=0;const names=new Set<string>()
  return parseBundle(unzipSync(bytes,{filter:file=>{const name=packagePath(file.name).toLowerCase();if(names.has(name))throw new Error('TextPack 包含重名或仅大小写不同的文件。');names.add(name);if(++count>COUNT||file.originalSize>LIMIT||(total+=file.originalSize)>LIMIT)throw new Error('TextPack 解压内容超过安全大小限制。');return true}}))
}
function mediaType(path:string){const extension=path.split('.').pop()?.toLowerCase();return({png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',gif:'image/gif',svg:'image/svg+xml',webp:'image/webp',avif:'image/avif',bmp:'image/bmp',pdf:'application/pdf'} as Record<string,string>)[extension||'']||'application/octet-stream'}
export async function bundleAssetURL(key:string,path:string){const normalized=packagePath(decodeURIComponent(path.replace(/^\.\//,''))),data=await getBundle(key),bytes=data.files[normalized];if(!bytes)throw new Error(`TextBundle 缺少资源：${normalized}`)
  let cache=urls.get(key);if(!cache){cache=new Map();urls.set(key,cache)}if(!cache.has(normalized))cache.set(normalized,URL.createObjectURL(new Blob([bytes.slice().buffer],{type:mediaType(normalized)})));return cache.get(normalized)!
}
export function releaseBundleURLs(){for(const cache of urls.values())for(const url of cache.values())URL.revokeObjectURL(url);urls.clear()}
export async function createBundleDocument(options:{json:JSONContent;prefix:string;serialize:(doc:JSONContent)=>string;bundleKey?:string;images:Record<string,string>;documentPath?:string}) {
  const original=options.bundleKey?await getBundle(options.bundleKey):undefined
  const data:BundleData={key:original?.key||crypto.randomUUID(),info:{...(original?.info||{}),version:2,type:'net.daringfireball.markdown'},files:{...original?.files},textPath:original?.textPath||'text.markdown',content:''}
  if(!original){data.info.transient=false;data.info.creatorIdentifier='com.yeran.editor'}
  const json=structuredClone(options.json),rewrites:Record<string,string>={}
  async function visit(node:JSONContent):Promise<void>{if(node.type==='image'){
    const attrs=node.attrs||{},source=String(attrs.originalSrc||attrs.src||''),normalized=source.replace(/^\.\//,'')
    if(original?.files[normalized])return
    if(!source)throw new Error('图片缺少资源地址，无法生成 TextPack。')
    const actual=options.images[source]||String(attrs.src||source)
    const {bytes,mime}=await imageBytes(source,actual,options.documentPath)
    if(bytes.length>LIMIT)throw new Error('图片超过包大小限制。')
    const digest=await imageDigest(bytes),ext=imageExtension(bytes,mime,source)
    const path=`assets/${digest}.${ext}`;data.files[path]=bytes;attrs.originalSrc=path;attrs.src=path;node.attrs=attrs;rewrites[source]=path
  }for(const child of node.content||[])await visit(child)}
  await visit(json)
  data.content=options.prefix+options.serialize(json)
  data.files[data.textPath]=strToU8(data.content);data.files['info.json']=strToU8(JSON.stringify(data.info,null,2)+'\n')
  const entries=Object.entries(data.files);if(entries.length>COUNT||entries.reduce((n,[,b])=>n+b.length,0)>LIMIT)throw new Error('TextBundle 超过 64 MB 或 1024 个文件的限制。')
  return{data,rewrites}
}
export function packBundle(data:BundleData){return zipSync(Object.fromEntries(Object.entries(data.files).map(([name,bytes])=>['document.textbundle/'+name,bytes])),{level:6})}
