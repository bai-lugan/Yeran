import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { mm } from './document'
export type Orientation = 'portrait' | 'landscape'
export interface MixedOptions { directions: Record<string, Orientation>; base: Orientation; margin: number; continuous: boolean }
declare module '@tiptap/core' { interface Storage { mixedPagination: MixedOptions } }
interface Sheet { index: number; top: number; width: number; height: number; left: number; bodyTop: number; bodyBottom: number }
interface MixedState { count: number; signature: string; sheets: Sheet[]; decorations: DecorationSet }
const key = new PluginKey<MixedState>('yeranMixedPages')
const OUTER = 1123, GAP = 28, FOOTER = 24
function plan(options: MixedOptions, count: number): Sheet[] {
  let top = 0
  return Array.from({ length: count }, (_, i) => {
    const direction = options.directions[String(i + 1)] || options.base
    const width = direction === 'landscape' ? 1123 : 794, height = direction === 'landscape' ? 794 : 1123
    const sheet = { index: i + 1, top, width, height, left: (OUTER - width) / 2, bodyTop: top + mm(options.margin), bodyBottom: top + height - mm(options.margin) - FOOTER }
    top += height + GAP; return sheet
  })
}
function furniture(sheets: Sheet[], margin: number) {
  const root = document.createElement('div'); root.className = 'mixed-pagination'; root.contentEditable = 'false'; root.setAttribute('aria-hidden','true')
  for (const sheet of sheets) {
    const paper = document.createElement('div'); paper.className = 'mixed-sheet-background'
    Object.assign(paper.style, { top: `${sheet.top}px`, left: `${sheet.left}px`, width: `${sheet.width}px`, height: `${sheet.height}px` })
    paper.dataset.sheet = String(sheet.index); root.append(paper)
  }
  const first = document.createElement('div'); first.className = 'mixed-first-header'; first.style.height = `${margin}px`; root.append(first)
  for (const sheet of sheets) {
    const left = document.createElement('div'), right = document.createElement('div')
    left.className = 'mixed-side-left'; right.className = 'mixed-side-right'
    for (const side of [left,right]) { side.style.width = `${sheet.left + margin}px`; side.style.height = `${sheet.bodyBottom - sheet.bodyTop}px` }
    const breaker = document.createElement('div'); breaker.className = 'mixed-breaker'
    const footer = document.createElement('div'); footer.className = 'mixed-footer'; footer.style.height = `${margin + FOOTER}px`
    const number = document.createElement('span'); number.textContent = String(sheet.index); number.style.right = `${sheet.left + margin}px`; footer.append(number); breaker.append(footer)
    if (sheet.index !== sheets.length) { const gap = document.createElement('div'); gap.className = 'mixed-gap'; gap.style.height = `${GAP}px`; const header = document.createElement('div'); header.className = 'mixed-next-header'; header.style.height = `${margin}px`; breaker.append(gap,header) }
    root.append(left,right,breaker)
  }
  return root
}
export const MixedPagination = Extension.create<MixedOptions>({
  name: 'mixedPagination',
  addOptions: () => ({ directions: {}, base: 'portrait', margin: 20, continuous: false }),
  addStorage() { return { directions: {} as Record<string, Orientation>, base: 'portrait' as Orientation, margin: 20, continuous: false } },
  addProseMirrorPlugins() {
    const options = this.storage as MixedOptions, editor = this.editor
    return [new Plugin<MixedState>({
      key,
      state: {
        init: () => ({ count: 1, signature: '', sheets: [], decorations: DecorationSet.empty }),
        apply(tr, previous) {
          const update: { count: number; active: boolean; config: MixedOptions } | undefined = tr.getMeta(key)
          if (!update) return { ...previous, decorations: previous.decorations.map(tr.mapping,tr.doc) }
          const sheets = update.active ? plan(update.config, update.count) : []
          return { count: update.count, sheets, signature: JSON.stringify([update.active,update.config,update.count]), decorations: sheets.length ? DecorationSet.create(tr.doc,[Decoration.widget(0,()=>furniture(sheets,mm(update.config.margin)),{side:-2,key:JSON.stringify(sheets) + update.config.margin,ignoreSelection:true})]) : DecorationSet.empty }
        },
      },
      props: { decorations: state => key.getState(state)?.decorations },
      view(view) {
        let frame = 0, destroyed = false, count = 1, active = false
        function update() {
          if (destroyed || editor.isDestroyed) return
          const wanted = !options.continuous && Object.values(options.directions).some(direction => direction !== options.base)
          const config = { directions: { ...options.directions }, base: options.base, margin: options.margin, continuous: options.continuous }
          const root = view.dom
          if (options.continuous) {
            if(editor.storage.PaginationPlus.enabled) editor.commands.disablePagination()
            root.classList.remove('mixed-page-doc','rm-with-pagination');root.classList.add('continuous-doc')
            root.querySelectorAll<HTMLElement>('[data-mixed-sized]').forEach(el=>{el.style.removeProperty('width');el.style.removeProperty('margin-left');delete el.dataset.mixedSized})
            if(active || key.getState(view.state)?.sheets.length){active=false;view.dispatch(view.state.tr.setMeta(key,{count:1,active:false,config}).setMeta('addToHistory',false))}
            return
          }
          root.classList.remove('continuous-doc')
          if (!wanted) {
            if (active) {
              active = false; root.classList.remove('mixed-page-doc'); root.classList.add('rm-with-pagination'); root.style.width = 'var(--rm-page-width)'; root.style.minHeight = 'var(--rm-page-height)'
              root.querySelectorAll<HTMLElement>('[data-mixed-sized]').forEach(el=>{el.style.removeProperty('width');el.style.removeProperty('margin-left');delete el.dataset.mixedSized})
              view.dispatch(view.state.tr.setMeta(key,{count:1,active:false,config}).setMeta('addToHistory',false)); editor.commands.enablePagination()
            }
            if(!editor.storage.PaginationPlus.enabled) editor.commands.enablePagination()
            return
          }
          if (!active) { count = Math.max(1,root.querySelector('[data-rm-pagination]')?.children.length || 1); active = true }
          if (editor.storage.PaginationPlus.enabled) editor.commands.disablePagination()
          root.classList.remove('rm-with-pagination'); root.classList.add('mixed-page-doc'); root.style.width = `${OUTER}px`
          const current = key.getState(view.state)!
          const desired = JSON.stringify([true,config,count])
          if (current.signature !== desired) {
            const minimum = Math.floor(Math.min(...plan(config,Math.max(count,2)).map(sheet=>sheet.width - mm(config.margin) * 2)))
            root.querySelectorAll<HTMLElement>('.table-plus > tr,.manual-page-break').forEach(el=>{if(!el.dataset.mixedSized){el.style.width=`${minimum}px`;el.dataset.mixedSized=''}})
            view.dispatch(view.state.tr.setMeta(key,{count,active:true,config}).setMeta('addToHistory',false)); return
          }
          const sheets = current.sheets, scale = root.getBoundingClientRect().width / OUTER || 1, base = root.getBoundingClientRect().top, margin = mm(options.margin)
          const at = (y: number) => sheets.find(sheet=>y < sheet.bodyBottom - 1) || sheets[sheets.length-1]!
          const rows = root.querySelectorAll<HTMLElement>('.table-plus > tr')
          for (const row of rows) {
            const prior = row.previousElementSibling as HTMLElement | null
            let y = prior ? (prior.getBoundingClientRect().bottom - base) / scale : (row.closest('.paged-table')!.getBoundingClientRect().top - base) / scale
            let sheet = at(y), height = row.getBoundingClientRect().height / scale
            if (y > sheet.bodyTop && y + height > sheet.bodyBottom && sheets[sheet.index]) sheet = sheets[sheet.index]!
            const width = Math.floor(sheet.width - 2 * margin)
            if (Math.abs(row.getBoundingClientRect().width / scale - width) > 1) row.style.width = `${width}px`
            row.dataset.mixedSized = ''
          }
          for (const block of root.querySelectorAll<HTMLElement>(':scope > .code-block,:scope > .math-block,:scope > details,:scope > blockquote,:scope > .callout,:scope > .document-toc,:scope > .footnote-definition,.manual-page-break')) {
            const sheet = at((block.getBoundingClientRect().top - base) / scale)
            block.style.width = `${Math.floor(sheet.width - 2 * margin)}px`; block.style.marginLeft = block.matches('.manual-page-break') ? '0px' : `${sheet.left + margin}px`; block.dataset.mixedSized = ''
          }
          const last = root.lastElementChild as HTMLElement | null
          let bottom = last ? (last.getBoundingClientRect().bottom - base) / scale : sheets[0]!.bodyTop
          if (last?.matches('p,h1,h2,h3,h4,h5,h6')) { const range = document.createRange(); range.selectNodeContents(last); const rect = range.getBoundingClientRect(); if(rect.height) bottom = (rect.bottom - base) / scale }
          let needed = sheets.findIndex(sheet=>bottom <= sheet.bodyBottom + 1) + 1
          if (!needed) needed = count + Math.max(1,Math.ceil((bottom - sheets.at(-1)!.bodyBottom) / (794 - margin*2 - FOOTER)))
          needed = Math.max(1,Math.min(2000,needed))
          const total = sheets.at(-1)!.top + sheets.at(-1)!.height
          if (root.style.getPropertyValue('--mixed-total-height') !== `${total}px`) root.style.setProperty('--mixed-total-height',`${total}px`)
          if (needed !== count) { count = needed; schedule() }
        }
        function schedule() { view.dom.querySelectorAll('.math-block,img,details,.code-block,.paged-table,.manual-page-break').forEach(el=>observer.observe(el)); cancelAnimationFrame(frame); frame = requestAnimationFrame(update) }
        const observer = new ResizeObserver(schedule); observer.observe(view.dom); schedule()
        return { update: schedule, destroy() { destroyed = true; observer.disconnect(); cancelAnimationFrame(frame) } }
      },
    })]
  },
})
