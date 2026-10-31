import { invoke } from '@tauri-apps/api/core'
import type { JSONContent } from '@tiptap/core'

export interface ImageResources {
  json: JSONContent
  prefix: string
  serialize: (json: JSONContent) => string
  images: Record<string,string>
  bundleKey?: string
}
export function hasEmbeddedImages(json: JSONContent): boolean {
  return json.type === 'image' && /^data:/i.test(json.attrs?.originalSrc || json.attrs?.src || '') || (json.content || []).some(hasEmbeddedImages)
}
export async function imageBytes(source: string, actual: string, documentPath?: string) {
  if (actual.startsWith('data:')) {
    const match = /^data:([^;,]*)(;base64)?,([\s\S]*)$/.exec(actual)
    if (!match || !match[1]?.startsWith('image/')) throw new Error('图片数据无效。')
    const bytes = match[2] ? Uint8Array.from(atob(match[3]!), c => c.charCodeAt(0)) : new TextEncoder().encode(decodeURIComponent(match[3]!))
    return {bytes,mime:match[1]}
  }
  if ('__TAURI_INTERNALS__' in window && !/^(https?:|blob:)/i.test(source)) {
    let path = source
    if (/^asset:/i.test(path)) path = decodeURIComponent(new URL(path).pathname.slice(1))
    const bytes = new Uint8Array(await invoke<ArrayBuffer>('read_image_asset', {path,documentPath:documentPath || null}))
    return {bytes,mime:''}
  }
  const response = await fetch(actual)
  if (!response.ok) throw new Error(`无法读取图片：${source.slice(0,120)}`)
  return {bytes:new Uint8Array(await response.arrayBuffer()),mime:response.headers.get('content-type')?.split(';')[0] || ''}
}
export function imageExtension(bytes: Uint8Array, mime: string, source: string) {
  const signature=String.fromCharCode(...bytes.slice(0,12))
  if(signature.startsWith('\x89PNG'))return 'png'
  if(signature.startsWith('\xff\xd8\xff'))return 'jpg'
  if(signature.startsWith('GIF8'))return 'gif'
  if(signature.startsWith('RIFF')&&signature.includes('WEBP'))return 'webp'
  if(/^\s*(?:<\?xml[^>]*>\s*)?<svg\b/i.test(new TextDecoder().decode(bytes.slice(0,512))))return 'svg'
  return ({'image/avif':'avif','image/bmp':'bmp','image/tiff':'tiff','image/x-icon':'ico'} as Record<string,string>)[mime] || source.match(/\.(png|jpe?g|gif|webp|svg|avif|bmp|ico|tiff?)(?:[?#].*)?$/i)?.[1]?.toLowerCase() || 'png'
}
export async function imageDigest(bytes:Uint8Array) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new Uint8Array(bytes).buffer))].map(n=>n.toString(16).padStart(2,'0')).join('').slice(0,24)
}
