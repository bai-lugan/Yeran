import { Editor, Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import { Markdown } from '@tiptap/markdown'
import { createPagedTable, PagedTableRow, PagedTableCell, PagedTableHeader } from './table'
import { mm, PAGE_GAP, pageSize, type Layout } from './document'
import { ManualPageBreak, PaginationFeatures, CaretSafePagination } from './pagination'
import { SearchHighlight } from './search'
import { MathBlock, InlineMath, YeranCodeBlock, ToggleBlock, ToggleSummary, ToggleContent } from './blocks'
import { ColorHighlight, TextColor } from './colors'
import { TextAlign } from '@tiptap/extension-text-align'
import { TaskList, TaskItem } from '@tiptap/extension-list'
import { YeranParagraph, YeranHeading } from './rich-text'
import { MixedPagination } from './mixed-pages'
import { YeranSubscript, YeranSuperscript, YeranLink, FootnoteReference, FootnoteDefinition, TableOfContents, Callout, DocumentLinks } from './markdown-basics'
import { CodeHighlighting } from './code-highlighting'
import { WritingModes } from './writing-modes'
import { AutoPair } from './auto-pair'
import { PlainLine,PlainTextMode } from './plain-text'
import {blockAlignAttribute,blockAlignStyle} from './block-geometry'
import {BlockSelections} from './block-selection'
import {BlockBoundary} from './block-boundary'

export const LocalImage = Image.extend({
  addAttributes() { return { ...this.parent?.(),blockAlign:blockAlignAttribute, originalSrc: { default: null, rendered: false },width:{default:null,parseHTML:element=>element.getAttribute('width')||element.style.width||null},height:{default:null,parseHTML:element=>element.getAttribute('height')||element.style.height||null} } },
  renderHTML({HTMLAttributes}) {const attrs={...HTMLAttributes};const valid=(v:unknown)=>typeof v==='number'||typeof v==='string'&&/^\d+(?:\.\d+)?(?:px|%)?$/.test(v);const size=(v:unknown)=>String(v).match(/(?:px|%)$/)?String(v):`${v}px`;attrs.style=`${valid(attrs.width)?`width:${size(attrs.width)};`:''}${valid(attrs.height)?`height:${size(attrs.height)};`:''}${blockAlignStyle(attrs['data-block-align'])?'display:block;'+blockAlignStyle(attrs['data-block-align'])+';':''}`;return['img',attrs]},
  renderMarkdown(node: any, helpers: any) {
    const attrs = node.attrs || {}
    const alt = String(attrs.alt || '').replace(/([\[\]\\])/g, '\\$1')
    const src = attrs.originalSrc || attrs.src || ''
    if(attrs.width||attrs.height||blockAlignStyle(attrs.blockAlign)){const escape=(s:unknown)=>String(s||'').replace(/[&"<>]/g,c=>({'&':'&amp;','"':'&quot;','<':'&lt;','>':'&gt;'}[c]!));return `<img src="${escape(src)}" alt="${escape(attrs.alt)}"${attrs.title?` title="${escape(attrs.title)}"`:''}${attrs.width?` width="${escape(attrs.width)}"`:''}${attrs.height?` height="${escape(attrs.height)}"`:''}${blockAlignStyle(attrs.blockAlign)?` data-block-align="${attrs.blockAlign}" style="display:block;${blockAlignStyle(attrs.blockAlign)}"`:''}>`}
    const title=attrs.title?` "${String(attrs.title).replace(/\\/g,'\\\\').replace(/"/g,'\\"')}"`:''
    return `![${alt}](${/[\s()]/.test(String(src)) ? `<${src}>` : src}${title})`
  },
})
const PaginationLayoutSync = Extension.create({
  name: 'paginationLayoutSync',
  addProseMirrorPlugins() {
    return [new Plugin({
      key: new PluginKey('yeranPaginationLayout'),
      view(view) {
        let frame = 0, previous = ''
        const observer = new ResizeObserver(() => {
          const geometry = `${view.dom.offsetWidth}/${view.dom.offsetHeight}`
          if (geometry === previous) return
          previous = geometry; cancelAnimationFrame(frame)
          frame = requestAnimationFrame(() => view.dispatch(view.state.tr.setMeta('addToHistory', false).setMeta('yeranLayout', true)))
        })
        observer.observe(view.dom)
        return { destroy() { observer.disconnect(); cancelAnimationFrame(frame) } }
      },
    })]
  },
})

export function extensions(layout: Layout) {
  return [
    StarterKit.configure({ link: false, heading: false, paragraph: false, codeBlock: false }), BlockBoundary,BlockSelections,YeranLink,PlainLine,PlainTextMode,
    YeranParagraph, YeranHeading,
    YeranCodeBlock, CodeHighlighting, MathBlock, ToggleBlock, ToggleSummary, ToggleContent, ColorHighlight, TextColor, TextAlign.configure({ types: ['paragraph','heading'] }), TaskList, TaskItem.configure({ nested: true }),
    InlineMath, YeranSubscript, YeranSuperscript, FootnoteReference, FootnoteDefinition, TableOfContents, Callout, DocumentLinks, WritingModes, AutoPair, Markdown,
    LocalImage.configure({ allowBase64: true }),
    Placeholder.configure({ placeholder: ({node})=>node.type.name==='plainLine'?'开始输入文本…':'输入 / 插入内容，或直接开始写作…' }),
    createPagedTable(), PagedTableRow, PagedTableCell, PagedTableHeader, PaginationLayoutSync, ManualPageBreak, SearchHighlight,
    PaginationFeatures.configure({ repeatTableHeaders: layout.repeatTableHeaders }), MixedPagination,
    CaretSafePagination.configure({
      pageWidth: pageSize(layout).width, pageHeight: pageSize(layout).height, pageGap: PAGE_GAP,
      marginTop: mm(layout.margin), marginBottom: mm(layout.margin),
      marginLeft: mm(layout.margin), marginRight: mm(layout.margin),
      contentMarginTop: 0, contentMarginBottom: 0,
      pageBreakBackground: '#eef0f3', pageGapBorderColor: '#dfe2e7', pageGapBorderSize: 1,
      headerLeft: '', headerRight: '', footerLeft: '', footerRight: '{page}',
    }),
  ]
}
export function getMarkdown(editor: Editor): string { return editor.getMarkdown() }
