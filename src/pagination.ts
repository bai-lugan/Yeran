import { Extension, Node, mergeAttributes } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { DOMSerializer, type Node as PMNode } from '@tiptap/pm/model'
import { getPageSlices } from './document'
import { t, locale } from './i18n'
import { watch } from 'vue'
import { PaginationPlus } from 'tiptap-pagination-plus'
declare module '@tiptap/core' { interface Storage { paginationFeatures: {repeatTableHeaders:boolean} } }

// Keep float-clearing spacers outside inline marks. The upstream widget inherits
// the next mark, placing a display:table span inside <code> and hiding its caret.
export const CaretSafePagination = PaginationPlus.extend({
  addProseMirrorPlugins() {
    const plugins = (this.parent?.() || []).filter(plugin => !String((plugin as Plugin & {key:string}).key).startsWith('brDecoration$'))
    const key = new PluginKey('yeranLineBreaks')
    function build(doc: PMNode) {
      const widgets: Decoration[] = []
      doc.descendants((node,pos) => {
        if(node.type.name==='hardBreak') widgets.push(Decoration.widget(pos+1,() => {
          const span=document.createElement('span');span.className='yeran-line-break-spacer';span.setAttribute('aria-hidden','true');return span
        }, {side:-1,marks:[],ignoreSelection:true,key:`break-${pos}`}))
      })
      return DecorationSet.create(doc,widgets)
    }
    return [...plugins,new Plugin({key,state:{init:(_,state)=>build(state.doc),apply:(tr,previous)=>tr.docChanged?build(tr.doc):previous},props:{decorations(state){return key.getState(state)}}})]
  },
})

export const ManualPageBreak = Node.create({
  name: 'pageBreak', group: 'block', atom: true, selectable: true,
  parseHTML: () => [{ tag: 'div[data-page-break]' }],
  renderHTML: ({ HTMLAttributes }) => ['div', mergeAttributes(HTMLAttributes, { 'data-page-break': '', class: 'manual-page-break' })],
  addNodeView() {
    return () => { const dom = document.createElement('div'); dom.className = 'manual-page-break'; dom.dataset.pageBreak = ''; dom.contentEditable = 'false'; const label = document.createElement('span'); label.className = 'page-break-label'; const update = () => label.textContent = t('分页符 · 下一页'); update(); const unwatch = watch(locale, update); dom.append(label); return { dom, ignoreMutation: () => true, destroy: unwatch } }
  },
  addKeyboardShortcuts() { return { 'Mod-Enter': () => this.editor.isActive('codeBlock') ? this.editor.commands.exitCode() : !this.editor.isActive('table') && this.editor.commands.insertContent([{ type: this.name }, { type: 'paragraph' }]) } },
  markdownTokenName: 'pageBreak',
  markdownTokenizer: { name: 'pageBreak', level: 'block', start: (src: string) => src.search(/<!--\s*pagebreak\s*-->/i), tokenize(src: string) { const match = /^<!--\s*pagebreak\s*-->[^\S\r\n]*(?:\r?\n|$)/i.exec(src); return match ? { type: 'pageBreak', raw: match[0] } : undefined } },
  parseMarkdown: () => ({ type: 'pageBreak' }), renderMarkdown: () => '<!-- pagebreak -->',
})

interface Repeat { pos: number; header: PMNode; headerPos: number }
const repeatKey = new PluginKey<{ signature: string; decorations: DecorationSet }>('yeranRepeatedHeaders')
export const PaginationFeatures = Extension.create<{ repeatTableHeaders: boolean }>({
  name: 'paginationFeatures',
  addOptions: () => ({ repeatTableHeaders: true }),
  addStorage() { return { repeatTableHeaders: this.options.repeatTableHeaders } },
  addProseMirrorPlugins() {
    const editor = this.editor, options = this.storage
    function decorations(doc: PMNode, rows: Repeat[]) {
      return DecorationSet.create(doc, rows.map(item => Decoration.widget(item.pos, () => {
        const widget = document.createElement('th'); widget.className = 'repeat-header-widget'; widget.colSpan = item.header.childCount; widget.contentEditable = 'false'; widget.setAttribute('aria-hidden', 'true'); widget.title = '重复表头，点击编辑原表头'
        const grid = document.createElement('div'); grid.className = 'repeat-header-grid'; const serializer = DOMSerializer.fromSchema(editor.schema)
        let cellPos = item.headerPos + 1
        item.header.forEach((cell, _offset, index) => {
          const div = document.createElement('div'); div.className = 'repeat-header-cell'; div.style.textAlign = cell.attrs.align || 'left'; div.style.gridColumn = `span ${cell.attrs.colspan || 1}`; div.append(serializer.serializeFragment(cell.content))
          const original = cellPos + 2; cellPos += cell.nodeSize
          div.addEventListener('mousedown', event => { event.preventDefault(); editor.chain().focus().setTextSelection(original).scrollIntoView().run() }); div.dataset.column = String(index); grid.append(div)
        })
        widget.append(grid); return widget
      }, { key: `${item.pos}/${JSON.stringify(item.header.toJSON())}`, stopEvent: () => true, ignoreSelection: true })))
    }
    return [new Plugin({
      key: repeatKey,
      state: {
        init: () => ({ signature: '', decorations: DecorationSet.empty }),
        apply(tr, previous) {
          const rows: Repeat[] | undefined = tr.getMeta(repeatKey)
          if (rows) return { signature: rows.map(row => `${row.pos}/${JSON.stringify(row.header.toJSON())}`).join('|'), decorations: decorations(tr.doc, rows) }
          return { ...previous, decorations: previous.decorations.map(tr.mapping, tr.doc) }
        },
      },
      props: { decorations: state => repeatKey.getState(state)?.decorations },
      view(view) {
        let frame = 0, destroyed = false
        function update() {
          if (destroyed) return
          const root = view.dom, scale = root.getBoundingClientRect().width / root.offsetWidth || 1, base = root.getBoundingClientRect().top
          if(root.classList.contains('continuous-doc')) {
            root.querySelectorAll<HTMLElement>('.manual-page-break').forEach(el=>el.style.height='22px')
            if(repeatKey.getState(view.state)?.signature)view.dispatch(view.state.tr.setMeta(repeatKey,[]).setMeta('addToHistory',false))
            return
          }
          const footers = [...root.querySelectorAll<HTMLElement>('.rm-page-break .rm-page-footer,.mixed-footer')].map(el => (el.getBoundingClientRect().top - base) / scale)
          view.state.doc.descendants((node, pos) => {
            if (node.type.name !== 'pageBreak') return
            const dom = view.nodeDOM(pos) as HTMLElement | null
            if (!dom) return
            dom.style.height = '1px'
            const top = (dom.getBoundingClientRect().top - base) / scale
            const footer = footers.find(y => y >= top - 1)
            if (footer === undefined) return
            // Leave a small rounding allowance when the DOM is serialized for PDF.
            const height = Math.max(1, footer - top - 2)
            dom.style.height = `${height}px`
          })
          const slices = getPageSlices(root), repeats: Repeat[] = []
          const pageAt = (top: number) => Math.max(0, slices.findIndex(slice => top < slice.top + slice.height - 1))
          view.state.doc.descendants((table, pos) => {
            if (table.type.name !== 'table') return
            if(!(table.attrs.repeatHeader??options.repeatTableHeaders))return false
            const header = table.firstChild
            if (!header || header.childCount === 0 || ![...Array(header.childCount)].every((_,i) => header.child(i).type.name === 'tableHeader')) return false
            const wrapper = view.nodeDOM(pos) as HTMLElement | null
            const rows = wrapper?.querySelectorAll<HTMLElement>('.table-plus > tr')
            if (!rows?.length || rows.length !== table.childCount) return false
            const pageHeight = parseFloat(getComputedStyle(root).getPropertyValue('--rm-page-height')) || 1123
            if (rows[0]!.getBoundingClientRect().height / scale > pageHeight / 3) return false
            let previousPage = pageAt((rows[0]!.getBoundingClientRect().top - base) / scale), rowPos = pos + 1
            table.forEach((row, _offset, index) => {
              const page = pageAt((rows[index]!.getBoundingClientRect().top - base) / scale)
              if (index && page > previousPage) repeats.push({ pos: rowPos + 1, header, headerPos: pos + 1 })
              previousPage = page; rowPos += row.nodeSize
            })
            return false
          })
          const signature = repeats.map(row => `${row.pos}/${JSON.stringify(row.header.toJSON())}`).join('|')
          if (signature !== repeatKey.getState(view.state)?.signature) view.dispatch(view.state.tr.setMeta(repeatKey, repeats).setMeta('addToHistory', false))
        }
        function schedule() { view.dom.querySelectorAll('.math-block,img,details,.code-block,.paged-table,.manual-page-break').forEach(el=>observer.observe(el)); cancelAnimationFrame(frame); frame = requestAnimationFrame(update) }
        const observer = new ResizeObserver(schedule); observer.observe(view.dom); schedule()
        return { update: schedule, destroy() { destroyed = true; observer.disconnect(); cancelAnimationFrame(frame) } }
      },
    })]
  },
})
