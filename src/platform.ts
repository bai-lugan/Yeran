import { invoke, convertFileSrc } from '@tauri-apps/api/core'
import { open, save, ask } from '@tauri-apps/plugin-dialog'
import { prepareMarkdown } from './markdown-assets'
import { t } from './i18n'
import { recordHistory } from './history'
import { browserHandles } from './file-handles'
import { documentFormat, readBundleDocument, saveBundleDocument, browserDirectoryStamp, type BundleResources } from './bundle-platform'
import { bundleAssetURL,unpackTextPack,storeBundle,type DocumentFormat } from './textbundle'
import { decodeText,encodeText,editingMode,TEXT_EXTENSIONS,type TextEncoding,type EditingMode } from './plain-text'

export const native = '__TAURI_INTERNALS__' in window
export interface OpenedFile { content: string; path: string; modified: string; handleKey?: string; format?:DocumentFormat; bundleKey?:string;textEncoding?:TextEncoding;mode?:EditingMode }
export async function readTextFile(file:File){return file.arrayBuffer?decodeText(new Uint8Array(await file.arrayBuffer())):{content:await file.text(),textEncoding:'utf8' as const}}
export async function pickDocuments(): Promise<OpenedFile[]> {
  if (native) {
    const paths = await open({ multiple: true, filters: [{name:t('文稿与文本文件'),extensions:['*']},{ name: 'Markdown / TextPack', extensions: ['md', 'markdown','textpack','tetpack'] },{name:t('文本文件'),extensions:TEXT_EXTENSIONS}] })
    return Promise.all((typeof paths === 'string' ? [paths] : paths || []).map(path => readDocument(path)))
  }
  if ('showOpenFilePicker' in window) {
    try {
      const handles = await (window as any).showOpenFilePicker({ multiple: true,excludeAcceptAllOption:false, types: [{ description: 'Markdown / TextPack / Text', accept: { 'text/markdown': ['.md', '.markdown'], 'text/plain':TEXT_EXTENSIONS.map(extension=>'.'+extension),'application/zip':['.textpack','.tetpack'] } }] })
      return Promise.all(handles.map(async (handle: any) => {
        const file: File = await handle.getFile()
        let handleKey: string | undefined
        for (const [key, existing] of browserHandles) { if (existing === handle || existing.isSameEntry && await existing.isSameEntry(handle)) { handleKey = key; break } }
        handleKey ||= crypto.randomUUID(); browserHandles.set(handleKey, handle)
        if(documentFormat(file.name)!=='markdown')return readBundleDocument(file.name,handleKey)
        return { ...await readTextFile(file),mode:editingMode(file.name), path: file.name, modified: String(file.lastModified), handleKey }
      }))
    } catch (e) { if ((e as Error).name === 'AbortError') return []; throw e }
  }
  return new Promise((resolve,reject) => {
    const input = document.createElement('input'); input.type = 'file'; input.multiple = true
    input.onchange = async () => {try{resolve(await Promise.all([...(input.files || [])].map(async file => {if(documentFormat(file.name)==='markdown')return {...await readTextFile(file),mode:editingMode(file.name),path:file.name,modified:String(file.lastModified)};const data=unpackTextPack(new Uint8Array(await file.arrayBuffer()));await storeBundle(data);return{content:data.content,path:file.name,modified:String(file.lastModified),format:'textpack' as const,bundleKey:data.key}})))}catch(e){reject(e)}}
    input.oncancel = () => resolve([])
    input.click()
  })
}
// One dialog lists every format Yeran writes, so the Windows "save as type" box is
// the only place a format is chosen. Picking TextPack here is what turns a Markdown
// draft into a package on its next save.
export async function chooseSaveTarget(suggested: string | null, hasImages=false,plain=false): Promise<{ path: string; format: DocumentFormat } | null> {
  // rfd uses the first filter extension as Windows' default extension. A "*"
  // save filter can produce an invalid "name.*" for an extensionless name.
  // Omitting filters leaves the exact filename editable, including no suffix.
  const path = await save({ title: t(hasImages?'保存图片：Markdown 配图片文件夹，或 TextPack 单文件':'保存文稿'), defaultPath: suggested || (plain?'未命名.txt':'未命名.md'), filters: plain?undefined:[{ name: 'Markdown', extensions: ['md', 'markdown'] }, { name: 'TextPack', extensions: ['textpack'] }, { name: 'TextBundle folder', extensions: ['textbundle'] },{name:t('文本文件'),extensions:['txt']}] })
  if (!path) return null
  return { path, format: documentFormat(path) }
}
export async function saveDocument(content: string, path: string | null, modified: string | null, saveAs = false, handleKey?: string, reserved: { paths: string[]; handles: string[] } = { paths: [], handles: [] },packageOptions?:{format:DocumentFormat;resources:BundleResources;automatic?:boolean;mode?:EditingMode;textEncoding?:TextEncoding;canWrite?:()=>boolean},explicitTarget?:string): Promise<{ path: string; modified: string; handleKey?: string; historyWarning?: string;format?:DocumentFormat;bundleKey?:string;writtenContent?:string;rewrites?:Record<string,string> } | null> {
  const canWrite=()=>!packageOptions?.canWrite||packageOptions.canWrite()
  if(!canWrite())return null
  if(packageOptions&&packageOptions.format!=='markdown')return saveBundleDocument({content,path,modified,saveAs,handleKey,reserved,format:packageOptions.format,resources:packageOptions.resources,automatic:packageOptions.automatic,explicitTarget,canWrite:packageOptions.canWrite})
  if (native) {
    let target = explicitTarget || path
    if (!explicitTarget && (!target || saveAs)) target = await save({ defaultPath: path || (packageOptions?.mode==='text'?'未命名.txt':'未命名.md'), filters: packageOptions?.mode==='text'?undefined:[{ name: 'Markdown', extensions: ['md'] }] })
    if (!target) return null
    const normalized = target.replace(/\\/g, '/').toLowerCase()
    if (reserved.paths.some(other => other.replace(/\\/g, '/').toLowerCase() === normalized)) throw new Error('目标文件已在其他标签页打开，请切换到该标签保存，或选择不同的文件名。')
    const prepared=packageOptions&&packageOptions.mode!=='text'?await prepareMarkdown(packageOptions.resources,target,path):{content,rewrites:{}}
    if(!canWrite())return null
    const result=await invoke<{path:string;modified:string;historyWarning?:string}>('write_document', { path: target, content:prepared.content, failIfMissing:packageOptions?.automatic||false, textEncoding:packageOptions?.textEncoding||'utf8',expectedModified: normalized === path?.replace(/\\/g,'/').toLowerCase() ? modified : null })
    return {...result,format:'markdown',bundleKey:undefined,writtenContent:prepared.content,rewrites:prepared.rewrites}
  }
  if ('showSaveFilePicker' in window) {
    try {
      const existingHandle = handleKey ? browserHandles.get(handleKey) : undefined
      const handle = !saveAs && existingHandle ? existingHandle : await (window as any).showSaveFilePicker({ suggestedName: path?.split(/[\\/]/).pop() || (packageOptions?.mode==='text'?'未命名.txt':'未命名.md'),excludeAcceptAllOption:false, types: packageOptions?.mode==='text'?[{description:'Text',accept:{'text/plain':['.txt']}}]:[{ description: 'Markdown / Text', accept: { 'text/markdown': ['.md'], 'text/plain':['.txt'] } }] })
      for (const key of reserved.handles) { const other = browserHandles.get(key); if (other && (other === handle || other.isSameEntry && await other.isSameEntry(handle))) throw new Error('目标文件已在其他标签页打开，请选择不同的文件名。') }
      const file: File = await handle.getFile()
      if (!saveAs && existingHandle && modified && String(file.lastModified) !== modified) throw new Error('文件已被其他应用修改。请另存为，避免覆盖新的内容。')
      await recordHistory(handle.name, (await readTextFile(file)).content, '保存前版本')
      if(!canWrite())return null
      const stream = await handle.createWritable()
      if(!canWrite()){await stream.abort();return null}
      await stream.write(packageOptions?.mode==='text'||packageOptions?.textEncoding&&packageOptions.textEncoding!=='utf8'?encodeText(content,packageOptions.textEncoding):content)
      if(!canWrite()){await stream.abort();return null}
      await stream.close()
      const key = saveAs || !handleKey ? crypto.randomUUID() : handleKey
      browserHandles.set(key, handle)
      let historyWarning: string | undefined
      try { await recordHistory(handle.name, content, '已保存') } catch(e) { historyWarning = String(e) }
      return { path: !saveAs && existingHandle && path ? path : handle.name, modified: String((await handle.getFile()).lastModified), handleKey: key, historyWarning }
    } catch (e) { if ((e as Error).name === 'AbortError') return null; throw e }
  }
  const filename=path?.split(/[\\/]/).pop() || (packageOptions?.mode==='text'?'未命名.txt':'未命名.md')
  if(!canWrite())return null
  download(encodeText(content,packageOptions?.textEncoding),filename,packageOptions?.mode==='text'?'text/plain':'text/markdown')
  return { path: path || filename, modified: '' }
}
export async function documentStatus(path: string, handleKey?: string): Promise<{ modified: string | null; missing: boolean } | null> {
  if (native) return invoke('document_status', { path })
  const handle = handleKey ? browserHandles.get(handleKey) : undefined
  if (!handle) return null
  try { return { modified: handle.kind==='directory'?await browserDirectoryStamp(handle):String((await handle.getFile()).lastModified), missing: false } } catch(e) { if ((e as Error).name === 'NotFoundError') return { modified: null, missing: true }; throw e }
}
export async function readDocument(path: string, handleKey?: string): Promise<OpenedFile> {
  if(documentFormat(path)!=='markdown')return readBundleDocument(path,handleKey)
  if (native) return {...await invoke<OpenedFile>('read_document', { path }),mode:editingMode(path)}
  const handle = handleKey ? browserHandles.get(handleKey) : undefined
  if (!handle) throw new Error('请使用“打开”重新选择此文件，以重新取得读取权限。')
  const file = await handle.getFile()
  return { path,...await readTextFile(file),mode:editingMode(path), modified: String(file.lastModified), handleKey }
}
export function download(content: string|Uint8Array<ArrayBuffer>, filename: string, mime: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }))
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 2000)
}
export async function confirmDiscard() {
  return native ? ask('当前内容尚未保存到 Markdown 文件。继续后，恢复草稿将被新的文档替换。', { title: '放弃当前修改？', kind: 'warning', okLabel: '放弃修改', cancelLabel: '继续编辑' }) : window.confirm('当前内容尚未保存到文件。确定放弃修改并继续吗？')
}
export async function exportPdf(html: string, name: string) {
  if (native) {
    const path = await save({ defaultPath: `${name.replace(/\.(md|markdown|txt)$/i, '')}.pdf`, filters: [{ name: 'PDF', extensions: ['pdf'] }] })
    if (!path) return null
    await invoke('export_pdf', { html, path })
    return path
  }
  const printWindow = window.open('', 'yeran-print')
  if (!printWindow) throw new Error('请允许弹出打印窗口后重试。')
    printWindow.document.open(); printWindow.document.write(html); printWindow.document.close()
  await printWindow.document.fonts.ready
  await new Promise(resolve => setTimeout(resolve, 350))
  printWindow.focus(); printWindow.print()
  return 'print-dialog'
}
export async function resolveImages(editor: import('@tiptap/core').Editor, path: string, bundleKey?:string) {
  if (!native&&!bundleKey) return
  const base = path.slice(0, Math.max(path.lastIndexOf('\\'), path.lastIndexOf('/')))
  const updates: { pos: number; src: string; originalSrc: string }[] = []
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === 'image' && node.attrs.src && !/^(data:|https?:|asset:|blob:)/i.test(node.attrs.src)) {
      const originalSrc = String(node.attrs.src)
      const absolute = /^[A-Za-z]:[\\/]/.test(originalSrc) ? originalSrc : `${base}/${originalSrc}`
      updates.push({ pos, src: bundleKey ? '' : convertFileSrc(absolute), originalSrc })
    }
  })
  if (updates.length) {
    if(bundleKey)for(const update of updates)update.src=await bundleAssetURL(bundleKey,update.originalSrc)
    const tr = editor.state.tr
    updates.forEach(update => tr.setNodeMarkup(update.pos, undefined, { ...tr.doc.nodeAt(update.pos)?.attrs, src: update.src, originalSrc: update.originalSrc }))
    editor.view.dispatch(tr.setMeta('addToHistory', false))
  }
}
