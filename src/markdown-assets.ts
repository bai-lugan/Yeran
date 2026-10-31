import { invoke } from '@tauri-apps/api/core'
import { getBundle } from './textbundle'
import { imageBytes,imageDigest,imageExtension,type ImageResources } from './image-resources'
import type { JSONContent } from '@tiptap/core'

// Prepare a new resource graph before writing the document. The editor is only
// rewritten after the atomic document write succeeds; the source is never removed.
export async function prepareMarkdown(resources:ImageResources,target:string,sourcePath:string|null) {
  const json=structuredClone(resources.json),rewrites:Record<string,string>={}
  const bundle=resources.bundleKey?await getBundle(resources.bundleKey):undefined
  const samePath=target.replace(/\\/g,'/').toLowerCase()===sourcePath?.replace(/\\/g,'/').toLowerCase()
  async function visit(node:JSONContent):Promise<void> {
    if(node.type==='image') {
      const attrs=node.attrs||{},source=String(attrs.originalSrc||attrs.src||'')
      if(!source)throw new Error('图片缺少资源地址。')
      const draftRelative=!sourcePath&&!/^(?:[a-z][a-z0-9+.-]*:|[/\\])/i.test(source)
      if(!/^https?:/i.test(source)&&!(!bundle&&(samePath||draftRelative)&&!/^(data:|blob:|asset:)/i.test(source))) {
        if(!rewrites[source]) {
          const bundled=bundle?.files[decodeURIComponent(source.replace(/^\.\//,''))]
          const image=bundled?{bytes:bundled,mime:''}:await imageBytes(source,resources.images[source]||String(attrs.src||source),sourcePath||undefined)
          const name=await imageDigest(image.bytes)+'.'+imageExtension(image.bytes,image.mime,source)
          const saved=await invoke<{relative:string}>('save_image_asset',{documentPath:target,filename:name,data:Array.from(image.bytes)})
          rewrites[source]=saved.relative
        }
        attrs.originalSrc=rewrites[source];attrs.src=rewrites[source];node.attrs=attrs
      }
    }
    for(const child of node.content||[])await visit(child)
  }
  await visit(json)
  return {content:resources.prefix+resources.serialize(json),rewrites}
}
