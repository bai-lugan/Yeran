import type { EditorState } from '@tiptap/pm/state'
import { STARTER } from './document'
import type { Orientation } from './mixed-pages'
import type { DocumentFormat } from './textbundle'
import { editingMode,textEncoding,type EditingMode,type TextEncoding } from './plain-text'
export const SESSION_KEY = 'yeran.session.v3'
export interface DocumentTab {
  id: string; path: string | null; modified: string | null; dirty: boolean; markdown: string;
  baseline: string | null; frontmatter: string; scrollTop: number; state?: EditorState; handleKey?: string; tableWidths?: string[];
  displayName?: string; customName?:string; diskChanged?: boolean; diskMissing?: boolean; ignoredModified?: string;
  pageDirections?: Record<string, Orientation>; baseOrientation?: Orientation;
  format?:DocumentFormat;bundleKey?:string;
  mode:EditingMode;textEncoding:TextEncoding;textBom:boolean;textEol:string;textNeedsReload?:boolean;
}
export function splitFrontmatter(markdown: string) {
  const match = /^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/.exec(markdown)
  let body = match ? markdown.slice(match[0].length) : markdown
  let pageDirections: Record<string, Orientation> = {}, baseOrientation: Orientation | undefined
  const pages = /^\s*<!-- yeran:pages ([^\r\n]+) -->\s*(?:\r?\n|$)/.exec(body)
  if (pages) try {
    const parsed = JSON.parse(pages[1]!)
    if (parsed.default === 'portrait' || parsed.default === 'landscape') {
      baseOrientation = parsed.default
      for (const [page,direction] of Object.entries(parsed.pages || {})) if (/^[1-9]\d{0,3}$/.test(page) && (direction === 'portrait' || direction === 'landscape')) pageDirections[page] = direction
      body = body.slice(pages[0].length)
    }
  } catch { /* Preserve unknown comments as normal Markdown. */ }
  return { head: match?.[0] || '', body, pageDirections, baseOrientation }
}
export function newTab(markdown = '', path: string | null = null, modified: string | null = null, dirty = false,mode:EditingMode=editingMode(path)): DocumentTab {
  const parts = mode==='text'?{head:'',pageDirections:{},baseOrientation:undefined}:splitFrontmatter(markdown.replace(/^\uFEFF/,''))
  return { id: crypto.randomUUID(), path, modified, dirty, markdown, baseline: dirty ? null : markdown, frontmatter: parts.head, pageDirections: parts.pageDirections, baseOrientation: parts.baseOrientation, scrollTop: 0, format: 'markdown',mode,textEncoding:'utf8',textBom:markdown.startsWith('\uFEFF'),textEol:/\r\n|\r|\n/.exec(markdown)?.[0]||'\n' }
}
// Sessions saved by the 0.x builds live under the Paperleaf key. They are read
// once and re-persisted under the Yeran key, so upgrading keeps every open tab.
const LEGACY_SESSION_KEY = 'paperleaf.session.v2'
const LEGACY_DRAFT_KEY = 'paperleaf.draft.v1'
function readSession() {
  const current = localStorage.getItem(SESSION_KEY)
  if (current) return current
  const legacy = localStorage.getItem(LEGACY_SESSION_KEY)
  if (legacy) try { localStorage.setItem(SESSION_KEY, legacy) } catch { /* Keep reading the legacy value below. */ }
  return legacy
}
export function loadWorkspace(): { tabs: DocumentTab[]; activeId: string } {
  try {
    const session = JSON.parse(readSession() || 'null')
    if (session?.tabs?.length && session.tabs.every((tab: any) => typeof tab.id === 'string' && typeof tab.markdown === 'string')) {
      const tabs = session.tabs.map((tab: any) => ({ ...newTab(tab.markdown, typeof tab.path === 'string' ? tab.path : null, tab.modified || null, Boolean(tab.dirty),tab.mode==='text'?'text':editingMode(tab.path)), id: tab.id, baseline: typeof tab.baseline === 'string' ? tab.baseline : null, scrollTop: Number(tab.scrollTop) || 0, format: ['markdown','textpack','textbundle'].includes(tab.format)?tab.format:'markdown',textEncoding:textEncoding(tab.textEncoding),textEol:['\r\n','\n','\r'].includes(tab.textEol)?tab.textEol:(/\r\n|\r|\n/.exec(tab.markdown)?.[0]||'\n'),pageDirections:tab.mode==='text'&&tab.pageDirections&&typeof tab.pageDirections==='object'?Object.fromEntries(Object.entries(tab.pageDirections).filter(([key,value])=>/^[1-9]\d{0,3}$/.test(key)&&['portrait','landscape'].includes(String(value)))):newTab(tab.markdown,tab.path).pageDirections,baseOrientation:['portrait','landscape'].includes(tab.baseOrientation)?tab.baseOrientation:newTab(tab.markdown,tab.path).baseOrientation,textNeedsReload:!tab.mode&&editingMode(tab.path)==='text'&&!tab.dirty,bundleKey: typeof tab.bundleKey === 'string'?tab.bundleKey:undefined, customName:typeof tab.customName==='string'?tab.customName:undefined, displayName: typeof tab.displayName === 'string' ? tab.displayName : undefined, tableWidths: Array.isArray(tab.tableWidths) ? tab.tableWidths.filter((value: unknown) => typeof value === 'string') : undefined }))
      return { tabs, activeId: tabs.some((tab: DocumentTab) => tab.id === session.activeId) ? session.activeId : tabs[0].id }
    }
    const legacy = JSON.parse(localStorage.getItem(LEGACY_DRAFT_KEY) || 'null')
    if (typeof legacy?.markdown === 'string') { const tab = newTab(legacy.markdown, legacy.path, legacy.modified, legacy.dirty); return { tabs: [tab], activeId: tab.id } }
  } catch { /* A damaged recovery file must not prevent opening the application. */ }
  const tab = newTab(STARTER)
  return { tabs: [tab], activeId: tab.id }
}
export function persistWorkspace(tabs: DocumentTab[], activeId: string) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ version: 2, activeId, tabs: tabs.map(({ state: _state, handleKey: _handle, ...tab }) => tab), date: Date.now() }))
}
