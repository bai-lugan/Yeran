import DOMPurify from 'dompurify'
import type { Editor } from '@tiptap/core'
import { waitForMath } from './blocks'
import { waitForCodeHighlighting } from './code-highlighting'

export const STARTER = `# 把文字，写在纸上

打开一篇 Markdown，就从这里开始。直接点击文字修改，标题、列表和表格会保留排版。写到页底，内容会自动流入下一张 A4。

## 先写，再调整

输入 \`#\` 加空格创建标题，输入 \`-\` 加空格开始列表。选中文字后，按 **Ctrl+B** 加粗，按 **Ctrl+I** 斜体。你也可以使用上方工具栏。

好的写作工具应该让人忘记工具本身。纸张的边界留在视野里，想法不必为了导出而反复中断。

> 写作时看见的页边距和分页，也应该出现在最后交出去的文档里。

## 一份简短的写作清单

- 给文档起一个清楚的标题
- 用小标题组织内容
- 在页面设置中调整字体、字号和页边距
- 导出前检查表格、图片与跨页段落

## 记录一个想法

| 阶段 | 要做的事 | 带走的结果 |
| --- | --- | --- |
| 起草 | 把想到的事情写下来 | 完整的初稿 |
| 整理 | 调整段落与顺序 | 清楚的结构 |
| 交付 | 检查分页并导出 | 可以分享的 PDF |

按 **Ctrl+O** 打开本地文件，按 **Ctrl+S** 保存 Markdown。页然会在本机保留恢复草稿，意外关闭后可以接着写。

## 为下一页留一点空间

页然使用 A4 纸张，默认页边距为 20 毫米。你可以在右上角的页面设置里切换为宋体，增加行距，或把页边距调得更宽。

文档的内容仍然保存在 Markdown 文件里。字体与页边距属于当前应用的排版设置，不会把普通段落变成复杂的格式代码。

继续写，下一页就在下面。
`

export interface Layout { font: 'sans' | 'serif'; fontSize: number; lineHeight: number; margin: number; orientation: 'portrait' | 'landscape'; repeatTableHeaders: boolean }
export const DEFAULT_LAYOUT: Layout = { font: 'sans', fontSize: 16, lineHeight: 1.8, margin: 20, orientation: 'portrait', repeatTableHeaders: true }
export const PAGE_WIDTH = 794
export const PAGE_HEIGHT = 1123
export const PAGE_GAP = 28
export function pageSize(layout: Layout) { return layout.orientation === 'landscape' ? { width: PAGE_HEIGHT, height: PAGE_WIDTH } : { width: PAGE_WIDTH, height: PAGE_HEIGHT } }
export const mm = (value: number) => value * 96 / 25.4
export interface PrintSettings {headerLeft:string;headerRight:string;footerLeft:string;footerRight:string;bookmarks:boolean;margin?:number}
export const DEFAULT_PRINT:PrintSettings={headerLeft:'',headerRight:'',footerLeft:'',footerRight:'{page}',bookmarks:true}

export function safeMarkdown(markdown: string) {
  // Code is literal text. Protect fenced/indented blocks and inline code before
  // rejecting active HTML elsewhere, so script examples survive opening files.
  const code:string[]=[],prefix='\u0000yeran-code-'+crypto.randomUUID()+':'
  const keep=(text:string)=>prefix+(code.push(text)-1)+'\u0000'
  const opening=/^[ \t]*(?:>[ \t]*)*(?:(?:[-+*]|\d+[.)])[ \t]+)?(`{3,}|~{3,})([^\r\n]*)(?:\r?\n|$)/gm
  let result='',from=0,match:RegExpExecArray|null
  while((match=opening.exec(markdown))){
    const fence=match[1]!
    if(fence[0]==='`'&&match[2]!.includes('`'))continue
    const closing=new RegExp('^[ \\t]*(?:>[ \\t]*)*'+fence[0]+'{'+fence.length+',}[ \\t]*(?:\\r?\\n|$)','gm')
    closing.lastIndex=opening.lastIndex
    const end=closing.exec(markdown),to=end?closing.lastIndex:markdown.length
    result+=markdown.slice(from,match.index)+keep(markdown.slice(match.index,to));from=to;opening.lastIndex=to
  }
  result+=markdown.slice(from)
  result=result.replace(/^(?:(?: {4}|\t)[^\r\n]*(?:\r?\n|$))+/gm,keep)
  result=result.replace(/(?<![\\`])(`+)(?!`)([\s\S]*?[^`])?\1(?!`)/g,keep)
  result=result.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi,'')
  for(let i=code.length-1;i>=0;i--)result=result.replaceAll(prefix+i+'\u0000',code[i]!)
  return result
}

export interface PageSlice { top: number; height: number; left?: number; width?: number }
export function getPageSlices(root: HTMLElement): PageSlice[] {
  const scale = root.getBoundingClientRect().width / root.offsetWidth || 1
  const base = root.getBoundingClientRect().top
  if (root.classList.contains('mixed-page-doc')) {
    const sheets = [...root.querySelectorAll<HTMLElement>(':scope > .mixed-pagination > .mixed-sheet-background')]
    if (sheets.length) return sheets.map(sheet => ({ top: parseFloat(sheet.style.top), height: sheet.offsetHeight, left: parseFloat(sheet.style.left), width: sheet.offsetWidth }))
  }
  const gaps = [...root.querySelectorAll<HTMLElement>('.rm-pagination-gap')]
    .filter(el => el.offsetHeight > 0 && getComputedStyle(el).display !== 'none')
  const slices: PageSlice[] = []
  let top = 0
  for (const gap of gaps) {
    const rect = gap.getBoundingClientRect()
    const end = (rect.top - base) / scale
    if (end > top + 30) slices.push({ top, height: end - top })
    top = (rect.bottom - base) / scale
  }
  const height = root.offsetHeight
  if (height > top + 5) slices.push({ top, height: height - top })
  return slices.length ? slices : [{ top: 0, height: PAGE_HEIGHT }]
}

export async function createPrintHtml(editor: Editor, title: string, print?:PrintSettings) {
  const root = editor.view.dom
  const folded = [...root.querySelectorAll<HTMLDetailsElement>('details:not([open])')]
  folded.forEach(detail => detail.open = true)
  try {
  await Promise.all([waitForMath(),waitForCodeHighlighting()])
  await document.fonts.ready
  // Wait for local images and allow the pagination extension to settle.
  await Promise.all([...root.querySelectorAll('img')].map(img => img.decode().catch(() => {})))
  await new Promise<void>(resolve => {
    let previous = '', stable = 0, frames = 0
    const settle = () => {
      const geometry = `${root.offsetWidth}/${root.offsetHeight}/${root.querySelector('[data-rm-pagination]')?.children.length}/${root.lastElementChild?.getBoundingClientRect().bottom}`
      stable = geometry === previous ? stable + 1 : 0; previous = geometry
      if (stable >= 6 || ++frames >= 120) resolve()
      else requestAnimationFrame(settle)
    }
    requestAnimationFrame(settle)
  })
  const pageWidth = root.offsetWidth
  const pageHeight = parseFloat(getComputedStyle(root).getPropertyValue('--rm-page-height')) || PAGE_HEIGHT
  const slices = getPageSlices(root)
  const headingPages=[...root.querySelectorAll<HTMLElement>('h1,h2,h3,h4,h5,h6')].map(heading=>{const y=(heading.getBoundingClientRect().top-root.getBoundingClientRect().top)/(root.getBoundingClientRect().width/root.offsetWidth||1);return Math.max(0,slices.findIndex(slice=>y>=slice.top-1&&y<slice.top+slice.height))})
  let css = [...document.styleSheets].map(sheet => {
    try { return [...sheet.cssRules].map(rule => rule.cssText).join('\n') } catch { return '' }
  }).join('\n')
  const clone = root.cloneNode(true) as HTMLElement
  clone.removeAttribute('contenteditable')
  clone.querySelectorAll('[contenteditable]').forEach(el => el.removeAttribute('contenteditable'))
  clone.querySelectorAll('.ProseMirror-selectednode').forEach(el => el.classList.remove('ProseMirror-selectednode'))
  clone.querySelectorAll('.writing-muted').forEach(el => el.classList.remove('writing-muted'))
  clone.querySelectorAll('.block-drag-source').forEach(el=>el.classList.remove('block-drag-source'))
  clone.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach((heading,index)=>heading.setAttribute('data-pdf-heading-index',String(index)))
  clone.querySelectorAll('.table-cell-hovered,.table-axis-preview,.table-drag-source').forEach(el => el.classList.remove('table-cell-hovered','table-axis-preview','table-drag-source'))
  clone.querySelectorAll('.handle').forEach(el => el.remove())
  clone.querySelectorAll('.table-resizers').forEach(el => el.remove())
  clone.querySelectorAll('.page-break-label').forEach(el => el.remove())
  clone.querySelectorAll('.find-match').forEach(el => el.classList.remove('find-match', 'current-find-match'))
  clone.querySelectorAll('.block-controls,.math-input,.toggle-arrow').forEach(el => el.remove())
  clone.querySelectorAll('details').forEach(el => el.open = true)
  if (clone.querySelector('.katex')) {
    const rules = css.match(/@font-face\s*\{[^}]*\}/gi) || []
    for (const rule of rules) {
      const match = /url\(["']?([^\)"']+\.woff2)["']?\)/i.exec(rule)
      if (!match) continue
      const response = await fetch(new URL(match[1]!, document.baseURI))
      if (!response.ok) throw new Error('公式字体无法读取，请重试导出。')
      const blob = await response.blob()
      const data = await new Promise<string>((resolve,reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(blob) })
      css = css.replace(rule, rule.replace(/src\s*:[^;]+;/i, `src:url("${data}") format("woff2");`))
    }
  }
  clone.querySelectorAll('.selectedCell').forEach(el => el.classList.remove('selectedCell'))
  // Local app asset URLs cannot be loaded by headless Edge; embed the images.
  await Promise.all([...clone.querySelectorAll('img')].map(async img => {
    if (!img.src || img.src.startsWith('data:')) return
    try {
      const response = await fetch(img.src)
      if (!response.ok) throw new Error('图片读取失败')
      const blob = await response.blob()
      img.src = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(blob)
      })
    } catch { throw new Error('有图片无法读取，请检查图片路径后再导出。') }
  }))
  const markup = DOMPurify.sanitize(clone.outerHTML, { ADD_ATTR: ['contenteditable'] })
  // Each PDF page is a vector clipping of the actual editor layout. No second text layout.
  const escape=(value:string)=>value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!))
  const field=(value:string,page:number)=>escape(value.slice(0,160).replace(/\{(title|page|pages|date)\}/g,(_all,key:string)=>({title:title.replace(/\.(md|markdown|txt|textpack|tetpack)$/i,''),page:String(page),pages:String(slices.length),date:new Date().toLocaleDateString('sv-SE')}[key]!)))
  const pages = slices.map((slice,index) => {
    const width = slice.width || pageWidth, height = slice.width ? slice.height : pageHeight
    const direction = width > height ? 'landscape' : 'portrait'
    const style = slice.width ? ` style="width:${direction === 'landscape' ? '297mm' : '210mm'};height:${direction === 'landscape' ? '210mm' : '297mm'};page:yeran-${direction}"` : ''
    const content=markup.replace(/(<h[1-6]\b[^>]*data-pdf-heading-index="(\d+)"[^>]*)(>)/g,(_all,tag:string,id:string)=>`${tag}${headingPages[+id]!==index?' aria-hidden="true" role="presentation"':''}>`)
    const margin=mm(print?.margin??20),furniture=print?`<header class="print-page-header" style="left:${margin}px;right:${margin}px;top:${Math.max(10,margin/2-7)}px"><span>${field(print.headerLeft,index+1)}</span><span>${field(print.headerRight,index+1)}</span></header><footer class="print-page-footer" style="left:${margin}px;right:${margin}px;bottom:${Math.max(10,margin/2-7)}px"><span>${field(print.footerLeft,index+1)}</span><span>${field(print.footerRight,index+1)}</span></footer>`:''
    return `<section class="pdf-sheet"${print?' data-print-furniture':''}${style}><div class="pdf-clip" style="width:${width}px;height:${Math.min(slice.height,height)}px;max-height:${height}px"><div class="pdf-content" style="left:-${slice.left || 0}px;top:-${slice.top}px">${content}</div></div>${furniture}</section>`
  }).join('')
  const safeTitle = title.replace(/[&<>"']/g, '')
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">${print?.bookmarks?'<meta name="yeran-pdf-outline" content="true">':''}<title>${safeTitle}</title><style>${css}\n
  html,body{margin:0!important;padding:0!important;background:white!important;overflow:visible!important;height:auto!important}
  *{-webkit-print-color-adjust:exact;print-color-adjust:exact;animation:none!important;transition:none!important}
  .pdf-sheet{position:relative;width:${pageWidth > pageHeight ? '297mm' : '210mm'};height:${pageWidth > pageHeight ? '210mm' : '297mm'};overflow:hidden;break-after:page;page-break-after:always;background:white}
  .pdf-sheet:last-child{break-after:auto;page-break-after:auto}
  .pdf-clip{position:relative;width:${pageWidth}px;overflow:hidden;max-height:${pageHeight}px}
  .pdf-content{position:absolute;left:0;width:${pageWidth}px}
  .pdf-content .paper-editor{margin:0!important;box-shadow:none!important;border-color:transparent!important;outline:0!important}
  /* HTML parsing inserts tbody around the extension's direct tr children. */
  .pdf-content .table-plus>tbody:not(.table-row-group){display:contents!important}
  .pdf-content .table-plus>tbody:not(.table-row-group)>tr{display:grid!important}
  .pdf-content .paper-editor:not(.mixed-page-doc) .table-plus>tbody:not(.table-row-group)>tr{min-width:100%}
  .pdf-content .paper-editor p.is-editor-empty:first-child:before{display:none}
  [data-print-furniture] .mixed-footer span,[data-print-furniture] .rm-page-header-content,[data-print-furniture] .rm-page-footer-content{visibility:hidden!important}
  .print-page-header,.print-page-footer{position:absolute;display:flex;justify-content:space-between;gap:20px;z-index:5;pointer-events:none;font:11px/1.5 "Segoe UI","Microsoft YaHei",sans-serif;color:#7d8796;background:white}
  .print-page-header span,.print-page-footer span{max-width:48%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  @page{size:A4 ${pageWidth > pageHeight ? 'landscape' : 'portrait'};margin:0}
  @page yeran-portrait{size:A4 portrait;margin:0}
  @page yeran-landscape{size:A4 landscape;margin:0}
  </style></head><body>${pages}</body></html>`
  } finally { folded.forEach(detail => detail.open = false) }
}
