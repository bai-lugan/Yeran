<script setup lang="ts">
import { t, locale } from './i18n'
import { computed, markRaw, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch, type Ref } from 'vue'
import { EditorContent, Editor } from '@tiptap/vue-3'
import { TextSelection } from '@tiptap/pm/state'
import { EditorState } from '@tiptap/pm/state'
import { FileText, PanelLeft, FolderOpen, FilePlus2, Save, Download, SlidersHorizontal, Bold, Italic, Strikethrough, List, ListOrdered, Quote, Code2, ImagePlus, Table2, Undo2, Redo2, Minus, Plus, Check, X, AlignLeft, Braces, Maximize2, CircleHelp, Printer, Eye, Files, ChevronDown, Pilcrow, Heading1, Heading2, Heading3, Heading4, Heading5, Heading6 } from 'lucide-vue-next'
import { extensions, getMarkdown as getBodyMarkdown } from './editor'
import { STARTER, DEFAULT_LAYOUT, DEFAULT_PRINT, type PrintSettings, type Layout, safeMarkdown, mm, getPageSlices, createPrintHtml, pageSize } from './document'
import { native, pickDocuments, saveDocument, chooseSaveTarget, exportPdf, resolveImages, documentStatus, readDocument, type OpenedFile } from './platform'
import { loadWorkspace, newTab, persistWorkspace, splitFrontmatter, type DocumentTab } from './workspace'
import { useSlashMenu } from './slash'
import SlashMenu from './components/SlashMenu.vue'
import TableControls from './components/TableControls.vue'
import { tableContext as getTableContext, readTableWidths, restoreTableWidths } from './table'
import { CellSelection } from '@tiptap/pm/tables'
import { Search, History, RotateCw, FileInput, FileOutput, FolderOutput } from 'lucide-vue-next'
import FindPanel from './components/FindPanel.vue'
import HistoryPanel from './components/HistoryPanel.vue'
import { recordHistory } from './history'
import TextMenu from './components/TextMenu.vue'
import ImageControls from './components/ImageControls.vue'
import { printDocumentHtml, disposePrintFrame } from './printing'
import { pickBundleFolder,saveBundleDocument } from './bundle-platform'
import { releaseBundleURLs,bundleAssetURL,getBundle } from './textbundle'
import{openUrl}from'@tauri-apps/plugin-opener'
import { browserHandles } from './file-handles'
import ImageResize from './components/ImageResize.vue'
import { hasEmbeddedImages } from './image-resources'
import { Focus } from 'lucide-vue-next'
import { toggleRed } from './colors'
import BlockControls from './components/BlockControls.vue'
import FilePanel from './components/FilePanel.vue'
import QuickOpen from './components/QuickOpen.vue'
import { rememberFile,rememberRename,renameDocument,renameName,samePath,parentPath,type RenameTarget,type SearchHit } from './library'
import { findMatches } from './search'
import { plainContent,plainString,editingMode,textEncoding,type EditingMode } from './plain-text'

const SETTINGS_KEY = 'yeran.settings.v2'
function readJson<T>(key: string): T | null { try { return JSON.parse(localStorage.getItem(key) || 'null') } catch { return null } }
// Settings saved by the 0.x builds used the Paperleaf key. Adopt them once so an
// upgrade keeps the page setup; the legacy entry is left untouched for rollback.
function readSettings<T>(): T | null {
  const current = readJson<T>(SETTINGS_KEY)
  if (current) return current
  const legacy = readJson<T>('paperleaf.settings.v1')
  if (!legacy) return null
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(legacy)) } catch { /* Storage may be unavailable; defaults still load. */ }
  return legacy
}
const session = loadWorkspace()
const tabs = ref(session.tabs) as Ref<DocumentTab[]>
const activeId = ref(session.activeId)
const currentTab = computed(() => tabs.value.find(tab => tab.id === activeId.value) || tabs.value[0])
const recovered = currentTab.value
const plain=computed(()=>currentTab.value.mode==='text')
const frontmatter = computed({ get: () => currentTab.value.frontmatter, set: value => currentTab.value.frontmatter = value })
function getPrefix(tab:DocumentTab) {
  if(tab.mode==='text')return tab.textBom?'\uFEFF':''
  const pages = tab.baseOrientation || Object.keys(tab.pageDirections || {}).length ? `<!-- yeran:pages ${JSON.stringify({default:tab.baseOrientation || layout.value.orientation,pages:tab.pageDirections || {}})} -->\n\n` : ''
  return (tab.textBom?'\uFEFF':'')+tab.frontmatter + (tab.frontmatter && !tab.frontmatter.endsWith('\n') ? '\n' : '') + pages
}
function getMarkdown(ed: import('@tiptap/core').Editor) {
  return getPrefix(currentTab.value) + (currentTab.value.mode==='text'?plainString(ed.state.doc):getBodyMarkdown(ed))
}
const savedLayout = readSettings<Layout>()
const savedPrint=readJson<PrintSettings>('yeran.print-settings.v1')
const printSettings=ref<PrintSettings>({...DEFAULT_PRINT,...Object.fromEntries(Object.entries(savedPrint||{}).filter(([key,value])=>['headerLeft','headerRight','footerLeft','footerRight'].includes(key)&&typeof value==='string').map(([key,value])=>[key,(value as string).slice(0,160)])),bookmarks:savedPrint?.bookmarks!==false})
const layout = ref<Layout>({
  orientation: recovered.baseOrientation || (savedLayout?.orientation === 'landscape' ? 'landscape' : 'portrait'),
  repeatTableHeaders: savedLayout?.repeatTableHeaders !== false,
  font: savedLayout?.font === 'serif' ? 'serif' : 'sans',
  fontSize: [14,16,18,20].includes(savedLayout?.fontSize || 0) ? savedLayout!.fontSize : DEFAULT_LAYOUT.fontSize,
  lineHeight: [1.5,1.8,2].includes(savedLayout?.lineHeight || 0) ? savedLayout!.lineHeight : DEFAULT_LAYOUT.lineHeight,
  margin: [15,20,25,30].includes(savedLayout?.margin || 0) ? savedLayout!.margin : DEFAULT_LAYOUT.margin,
})
const viewMode = ref<'pages'|'continuous'>(localStorage.getItem('yeran.view-mode.v1') === 'continuous' ? 'continuous' : 'pages')
const savedWriting = readJson<{ focus: boolean; typewriter: boolean }>('yeran.writing-modes.v1')
const writing = ref({ focus: savedWriting?.focus === true, typewriter: savedWriting?.typewriter === true })
const writingMenu = ref(false)
const autoPair = ref(readJson<boolean>('yeran.auto-pair.v1')!==false)
const editor = shallowRef<Editor>()
const tableTools = ref<InstanceType<typeof TableControls>>()
const textTools = ref<InstanceType<typeof TextMenu>>()
const findPanel = ref<InstanceType<typeof FindPanel>>()
const filePanel = ref<InstanceType<typeof FilePanel>>()
const find = ref<{ replace: boolean } | null>(null)
const historyDialog = ref<{ keys: string[]; title: string } | null>(null)
const reloadCandidate = ref<{ tabId: string; doc: OpenedFile; current: string } | null>(null)
const path = computed({ get: () => currentTab.value.path, set: value => currentTab.value.path = value })
const modified = computed({ get: () => currentTab.value.modified, set: value => currentTab.value.modified = value })
const dirty = computed({ get: () => currentTab.value.dirty, set: value => currentTab.value.dirty = value })
const autoSave=ref(readJson<boolean>('yeran.auto-save.v1')===true)
const autoBlocked=new Set<string>(),lastEdit=new Map<string,number>()
let autoTimer:ReturnType<typeof setInterval>|undefined,pointerDown=false
const automaticSaving=ref(false)
const sidebar = ref(true)
const sidebarPane=ref<'outline'|'files'>(readJson<string>('yeran.sidebar-pane.v1')==='outline'?'outline':'files'),quickOpen=ref(false)
const settings = ref(false)
const fileMenu = ref(false)
const showHelp = ref(false)
const sourceOpen = ref(false)
const sourceValue = ref('')
const tabMenu = ref<{ id: string; left: number; top: number } | null>(null)
const closeDialog = shallowRef<{ tabs: DocumentTab[]; resolve: (choice: 'save' | 'discard' | 'cancel') => void } | null>(null)
const closeChoicePending = ref(false)
const zoom = ref(100)
const fit = ref(true)
const canvasWidth = ref(1000)
const scroller = ref<HTMLElement>()
const pageCount = ref(1)
const currentPage = ref(1)
const wordCount = ref(0)
const headings = ref<{ text: string; level: number; pos: number }[]>([])
const blockType = ref('paragraph')
const selectedHeading = ref(-1)
const busy = ref(false)
const saving = ref(false)
const toast = ref('')
const error = ref('')
const recoveryStatus = ref(recovered?.dirty ? '已恢复上次草稿' : '')
const imageInput = ref<HTMLInputElement>()
const slash = useSlashMenu(() => editor.value, () => imageInput.value?.click())
const version = ref(0)
function tabLabel(tab: DocumentTab): string {
  if (tab.path) return tab.path.split(/[\\/]/).pop()!
  if (tab.customName) return tab.customName
  if (tab.displayName) return t(tab.displayName)
  if(tab.mode==='text')return t(`未命名 ${tabs.value.indexOf(tab)+1}.txt`)
  const heading = tab.id === activeId.value ? headings.value[0]?.text : splitFrontmatter(tab.markdown).body.match(/^#{1,6}\s+(.+)$/m)?.[1]
  return heading ? `${heading.replace(/[*_`]/g, '').replace(/[<>:"/\\|?\u0000-\u001f]/g, ' ').trim().slice(0, 60) || t('未命名')}.md` : t(`未命名 ${tabs.value.indexOf(tab) + 1}.md`)
}
const title = computed(() => tabLabel(currentTab.value))
const mixed = computed(() => Object.values(currentTab.value.pageDirections || {}).some(direction => direction !== layout.value.orientation))
const paper = computed(() => viewMode.value === 'continuous' ? {width:Math.max(520,Math.min(1100,canvasWidth.value-64)),height:0} : mixed.value ? {width:1123,height:1123} : pageSize(layout.value))
const settingPage = ref(1)
const pageDirection = computed({get:()=>currentTab.value.pageDirections?.[String(settingPage.value)] || '',set:(direction:string)=>{
  const pages = {...currentTab.value.pageDirections}; if(direction) pages[String(settingPage.value)] = direction as 'portrait'|'landscape'; else delete pages[String(settingPage.value)]
  currentTab.value.pageDirections = pages; currentTab.value.baseOrientation = layout.value.orientation
  syncMixedPages(); dirty.value = true; scheduleDraft()
}})
function syncMixedPages() {
  const ed = editor.value; if(!ed) return
  Object.assign(ed.storage.mixedPagination,{directions:currentTab.value.pageDirections || {},base:layout.value.orientation,margin:layout.value.margin,continuous:viewMode.value==='continuous'})
  // Disable uniform page measurement before changing a continuous/mixed layout.
  // Otherwise it can count the old mixed-page furniture as new document content.
  if ((viewMode.value==='continuous' || mixed.value) && ed.storage.PaginationPlus.enabled) ed.commands.disablePagination()
  ed.storage.paginationFeatures.repeatTableHeaders = layout.value.repeatTableHeaders
  const size = pageSize(layout.value), margin = mm(layout.value.margin)
  ed.commands.updateMargins({top:margin,bottom:margin,left:margin,right:margin})
  ed.chain().updatePageWidth(size.width).updatePageHeight(size.height).run()
  ed.view.dispatch(ed.state.tr.setMeta('yeranLayout',true).setMeta('addToHistory',false))
}
function applyPageMetadata(parts: ReturnType<typeof splitFrontmatter>) {
  currentTab.value.pageDirections = parts.pageDirections; currentTab.value.baseOrientation = parts.baseOrientation
  if(parts.baseOrientation) layout.value.orientation = parts.baseOrientation
  syncMixedPages()
}
const tableContext = computed(() => { version.value; return editor.value ? getTableContext(editor.value) : null })
const effectiveZoom = computed(() => fit.value ? Math.min(1, Math.max(.35, (canvasWidth.value - 96) / paper.value.width)) : zoom.value / 100)
const fontFamily = computed(() => layout.value.font === 'serif' ? '"Noto Serif CJK SC", "SimSun", "Songti SC", serif' : '"Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", sans-serif')
const documentStyle = computed(() => ({ fontFamily: fontFamily.value, fontSize: `${layout.value.fontSize}px`, lineHeight: String(layout.value.lineHeight) }))
let draftTimer: ReturnType<typeof setTimeout> | undefined
let messageTimer: ReturnType<typeof setTimeout> | undefined
let observer: ResizeObserver | undefined
let frame = 0
let diskTimer: ReturnType<typeof setInterval> | undefined, historyTimer: ReturnType<typeof setInterval> | undefined
let checkingDisk = false, recordingHistory = false
const lastHistory = new Map<string, number>()
const diskContent = computed({ get: () => currentTab.value.baseline, set: value => currentTab.value.baseline = value })
let removeCloseListener: (() => void) | undefined
function notify(message: string) { toast.value = message; clearTimeout(messageTimer); messageTimer = setTimeout(() => toast.value = '', 3500) }
function report(e: unknown) { error.value = e instanceof Error ? e.message : String(e) }

function captureCurrent() {
  if (!editor.value) return
  const tab = currentTab.value
  tab.markdown = getMarkdown(editor.value)
  if (tab.baseline !== null) tab.dirty = tab.markdown !== tab.baseline
  tab.state = markRaw(editor.value.state)
  tab.tableWidths = readTableWidths(editor.value)
  tab.scrollTop = scroller.value?.scrollTop || 0
}
function storeDraft() {
  if (!editor.value) return
  try {
    captureCurrent()
    persistWorkspace(tabs.value, activeId.value)
    recoveryStatus.value = dirty.value ? '草稿已保护' : path.value ? '已保存' : '未保存到文件'
  } catch { error.value = '恢复草稿保存失败。请立即按 Ctrl+S 保存到文件，避免关闭后丢失内容。' }
}
function scheduleDraft() { lastEdit.set(activeId.value,Date.now()); clearTimeout(draftTimer); recoveryStatus.value = '正在保护草稿…'; draftTimer = setTimeout(storeDraft, 500) }
function refreshStats() {
  if (!editor.value) return
  const ed = editor.value
  pageCount.value = getPageSlices(ed.view.dom).length
  const text = ed.getText()
  wordCount.value = (text.match(/[\p{Script=Han}]/gu)?.length || 0) + (text.replace(/[\p{Script=Han}]/gu, ' ').match(/[\p{L}\p{N}]+/gu)?.length || 0)
  const result: typeof headings.value = []
  ed.state.doc.descendants((node, pos) => { if (node.type.name === 'heading') result.push({ text: node.textContent || '未命名标题', level: node.attrs.level, pos }) })
  headings.value = result
  refreshSelection()
}
function refreshSelection() {
  if (!editor.value) return
  const ed = editor.value
  version.value++
  blockType.value = ed.isActive('heading') ? 'h'+ed.getAttributes('heading').level : 'paragraph'
  selectedHeading.value = headings.value.filter(h => h.pos <= ed.state.selection.from).at(-1)?.pos ?? -1
  try {
    const y = ed.view.coordsAtPos(ed.state.selection.from).top
    const top = ed.view.dom.getBoundingClientRect().top
    const at = (y - top) / effectiveZoom.value
    const slices = getPageSlices(ed.view.dom)
    currentPage.value = Math.min(pageCount.value, Math.max(1, slices.findIndex(s => at < s.top + s.height) + 1))
  } catch { /* Editor may be mounting. */ }
}
function active(name: string) { version.value; return editor.value?.isActive(name) }
async function toggleWriting(mode: 'focus' | 'typewriter') {
  writing.value = { ...writing.value, [mode]: !writing.value[mode] }
  await nextTick()
  editor.value?.view.focus()
}
function scheduleStats() { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => { refreshStats(); slash.refresh() }) }

function adoptTextMeta(tab:DocumentTab,doc:OpenedFile){
  tab.mode=doc.mode||editingMode(doc.path);tab.textEncoding=textEncoding(doc.textEncoding);tab.textBom=doc.content.startsWith('\uFEFF');tab.textEol=/\r\n|\r|\n/.exec(doc.content)?.[0]||'\n';tab.textNeedsReload=false
}
function prepareMode(tab:DocumentTab){const ed=editor.value;if(!ed)return;ed.storage.plainTextMode.enabled=tab.mode==='text';ed.storage.plainTextMode.eol=tab.textEol;ed.view.dom.classList.toggle('plain-editor',tab.mode==='text')}
function setTabContent(tab:DocumentTab,content:string){
  const ed=editor.value!;prepareMode(tab)
  if(tab.mode==='text')ed.commands.setContent(plainContent(content.replace(/^\uFEFF/,'')),{emitUpdate:false})
  else ed.commands.setContent(safeMarkdown(splitFrontmatter(content.replace(/^\uFEFF/,'')).body),{contentType:'markdown',emitUpdate:false})
}
async function reloadLegacyText(tab:DocumentTab){
  if(!tab.textNeedsReload||!tab.path||tab.dirty||!native&&!tab.handleKey)return
  try{const doc=await readDocument(tab.path,tab.handleKey);if(!tab.dirty){tab.markdown=doc.content;tab.baseline=doc.content;tab.modified=doc.modified;adoptTextMeta(tab,doc)}}catch(e){report(e)}
}
async function replaceDocument(markdown: string, newPath: string | null, newModified: string | null, isDirty = false, meta?: Pick<OpenedFile,'format'|'bundleKey'|'mode'|'textEncoding'>) {
  if (!editor.value) return
  autoBlocked.delete(activeId.value)
  adoptTextMeta(currentTab.value,{content:markdown,path:newPath||'',modified:newModified||'',...meta,mode:meta?.mode||(newPath?editingMode(newPath):'markdown')})
  const parts = plain.value?{head:'',body:markdown,pageDirections:{},baseOrientation:undefined}:splitFrontmatter(markdown.replace(/^\uFEFF/,''))
  frontmatter.value = parts.head
  currentTab.value.bundleKey=meta?.bundleKey;currentTab.value.format=meta?.format||'markdown'
  applyPageMetadata(parts)
  setTabContent(currentTab.value,markdown)
  path.value = newPath; modified.value = newModified; dirty.value = isDirty
  if (!plain.value&&(newPath || currentTab.value.bundleKey)) await resolveImages(editor.value, newPath||'',currentTab.value.bundleKey)
  // New/open documents start with their own undo history.
  const ed = editor.value
  ed.view.updateState(EditorState.create({ schema: ed.schema, doc: ed.state.doc, plugins: ed.state.plugins }))
  syncMixedPages()
  dirty.value = isDirty
  diskContent.value = isDirty ? null : getMarkdown(editor.value)
  editor.value.commands.setTextSelection(1)
  editor.value.view.focus()
  scroller.value?.scrollTo({ top: 0 })
  scheduleStats(); storeDraft(); error.value = ''; toast.value = ''
}
async function activateTab(id: string, capture = true) {
  if (!editor.value || id === activeId.value || busy.value && !saving.value) return
  if (capture) captureCurrent()
  const tab = tabs.value.find(tab => tab.id === id)
  if (!tab) return
  await reloadLegacyText(tab)
  const scroll = tab.scrollTop, wasDirty = tab.dirty
  clearTimeout(draftTimer); slash.reset(); tabMenu.value = null; settings.value = false
  activeId.value = id
  prepareMode(tab)
  if(tab.baseOrientation) layout.value.orientation = tab.baseOrientation
  syncMixedPages()
  find.value = null
  if (tab.state) editor.value.view.updateState(tab.state)
  else {
    setTabContent(tab,tab.markdown)
    restoreTableWidths(editor.value, tab.tableWidths)
    if (tab.mode!=='text'&&(tab.path || tab.bundleKey)) await resolveImages(editor.value, tab.path||'',tab.bundleKey)
    const ed = editor.value
    ed.view.updateState(EditorState.create({ schema: ed.schema, doc: ed.state.doc, plugins: ed.state.plugins }))
    tab.markdown = getMarkdown(ed)
    if (!wasDirty) tab.baseline = tab.markdown
    tab.dirty = wasDirty
  }
  syncMixedPages()
  toast.value = ''; error.value = ''
  recoveryStatus.value = tab.dirty ? '草稿已保护' : tab.path ? '已保存' : '未保存到文件'
  await nextTick(); scheduleStats()
  editor.value.view.focus()
  if (scroller.value) scroller.value.scrollTop = scroll
  requestAnimationFrame(() => { if (activeId.value === tab.id) { if (scroller.value) scroller.value.scrollTop = scroll; storeDraft() } })
  void checkExternal()
}
async function newDocument(asText:unknown=false) {
  if (busy.value && !saving.value) return
  captureCurrent()
  const tab = newTab('',null,null,false,asText===true?'text':'markdown'); tabs.value.push(tab)
  await activateTab(tab.id, false)
  editor.value?.commands.focus('start')
}
async function openLinkedDocument(href:string) {
  try{
    if(/^(https?:\/\/|mailto:|tel:)/i.test(href)){if(native)await openUrl(href);else window.open(href,'_blank','noopener');return}
    if(/^[a-z][a-z0-9+.-]*:/i.test(href))throw new Error('不支持此链接协议。')
    const [file,fragment]=href.split('#'),key=currentTab.value.bundleKey
    if(key){const bundle=await getBundle(key),entry=bundle.files[decodeURIComponent(file!)];if(entry){if(/\.(md|markdown|txt)$/i.test(file!)){captureCurrent();const tab=newTab(new TextDecoder().decode(entry),null,null,true);tab.bundleKey=key;tab.displayName=file;tabs.value.push(tab);await activateTab(tab.id,false);return}else{window.open(await bundleAssetURL(key,file!),'_blank','noopener');return}}}
    if(!native||!path.value)throw new Error('本地文件跳转请使用桌面版，并先保存当前文稿。')
    const target=await import('@tauri-apps/api/core').then(api=>api.invoke<string>('resolve_document_path',{base:path.value,href:file})),existing=tabs.value.find(tab=>tab.path?.toLowerCase()===target.toLowerCase())
    if(existing)await activateTab(existing.id);else{const doc=await readDocument(target);captureCurrent();const tab=newTab(doc.content,doc.path,doc.modified);tab.bundleKey=doc.bundleKey;tab.format=doc.format;adoptTextMeta(tab,doc);tabs.value.push(tab);await activateTab(tab.id,false)}
    if(fragment){await nextTick();editor.value?.view.dom.querySelector('#'+CSS.escape(decodeURIComponent(fragment)))?.scrollIntoView({block:'center'})}
  }catch(e){report(e)}
}
async function openDocument(folder = false) {
  if (busy.value) return
  try {
    fileMenu.value=false
    const docs = folder ? await pickBundleFolder() : await pickDocuments()
    for (const doc of docs) {
      rememberFile(doc.path,doc.handleKey)
      const existing = tabs.value.find(tab => native ? tab.path?.toLowerCase() === doc.path.toLowerCase() : doc.handleKey && tab.handleKey === doc.handleKey)
      if (existing) { await activateTab(existing.id); continue }
      captureCurrent()
      const tab = newTab(doc.content, doc.path, doc.modified); tab.handleKey = doc.handleKey; tab.bundleKey = doc.bundleKey; tab.format = doc.format; adoptTextMeta(tab,doc)
      tabs.value.push(tab); await activateTab(tab.id, false)
    }
    if (docs.length) notify(`已打开 ${docs.length > 1 ? `${docs.length} 份文稿` : title.value}`)
  } catch (e) { report(e) }
}
async function openLibraryFile(file:{path?:string;handleKey?:string;tabId?:string}){
  quickOpen.value=false;if(file.tabId){await activateTab(file.tabId);return true}if(!file.path||busy.value)return false
  try{const existing=tabs.value.find(tab=>native?tab.path?.replace(/^\\\\\?\\/,'').toLowerCase()===file.path!.replace(/^\\\\\?\\/,'').toLowerCase():tab.path===file.path&&tab.handleKey===file.handleKey)
    if(existing){await activateTab(existing.id);rememberFile(file.path,file.handleKey);return true}
    busy.value=true;const doc=await readDocument(file.path,file.handleKey);busy.value=false;captureCurrent();const tab=newTab(doc.content,doc.path,doc.modified);tab.handleKey=doc.handleKey;tab.bundleKey=doc.bundleKey;tab.format=doc.format;adoptTextMeta(tab,doc);tabs.value.push(tab);await activateTab(tab.id,false);rememberFile(doc.path,doc.handleKey);notify(`已打开 ${title.value}`);return true
  }catch(e){report(e);return false}finally{busy.value=false}
}
async function renameFile(target:RenameTarget,name:string):Promise<string|null>{
  if(busy.value)throw Error('正在处理文稿，请稍后重试。')
  const selected=target.tabId?tabs.value.find(tab=>tab.id===target.tabId):tabs.value.find(tab=>samePath(tab.path,target.path))
  const source=selected?.path||target.path
  renameName(name,source||((selected?.mode||'markdown')==='text'?'untitled.txt':'untitled.md'))
  if(!source){if(!selected)throw Error('文稿已关闭。');selected.customName=name;storeDraft();notify('已重命名');return null}
  const parent=parentPath(source),destination=parent+(/[\\/]$/.test(parent)?'':/\\/.test(source)?'\\':'/')+name
  if(tabs.value.some(tab=>tab!==selected&&samePath(tab.path,destination)))throw Error('目标文件已在其他标签页打开，请选择不同的名称。')
  busy.value=true
  try{
    captureCurrent();const result=await renameDocument({path:source},name,selected?.modified)
    for(const tab of tabs.value.filter(tab=>samePath(tab.path,source))){tab.path=result.path;tab.modified=result.modified;tab.diskChanged=false;tab.diskMissing=false;tab.ignoredModified=undefined;autoBlocked.delete(tab.id)}
    rememberRename(source,result.path);storeDraft();notify('已重命名')
    if(result.historyWarning)report(Error('文件已重命名，历史仍保留在原路径下：'+result.historyWarning))
    return result.path
  }finally{busy.value=false}
}
async function renameTab(id=activeId.value){tabMenu.value=null;sidebar.value=true;sidebarPane.value='files';await nextTick();await filePanel.value?.beginRenameDocument(id)}
async function newFileBeside(id:string){tabMenu.value=null;sidebar.value=true;sidebarPane.value='files';await nextTick();await filePanel.value?.beginCreateForDocument(id)}
let openingFiles=false,removeOpenListener:(()=>void)|undefined
async function receiveOpenFiles(){
  if(!native||!editor.value||openingFiles||busy.value||sourceOpen.value||showHelp.value||closeDialog.value||historyDialog.value||reloadCandidate.value)return
  openingFiles=true
  try{while(!busy.value&&!sourceOpen.value&&!showHelp.value&&!closeDialog.value&&!historyDialog.value&&!reloadCandidate.value){const path=await import('@tauri-apps/api/core').then(api=>api.invoke<string|null>('take_open_file'));if(!path)break;await openLibraryFile({path})}}catch(e){report(e)}finally{openingFiles=false}
}
async function openSearchHit(hit:SearchHit){if(!await openLibraryFile(hit)||!editor.value)return;const matches=findMatches(editor.value.state.doc,hit.query||hit.excerpt.trim().replace(/^[#>\s]+/,''));const match=matches[Math.min(hit.occurrence,matches.length-1)];if(match)editor.value.chain().focus().setTextSelection(match).scrollIntoView().run();else notify('匹配位于源码中，可打开源码查看。')}
function bundleResources(tab:DocumentTab) {
  if(tab.mode==='text')return{json:plainContent(tab.markdown.replace(/^\uFEFF/,'')),prefix:'',serialize:()=>tab.markdown,images:{}}
  const ed=editor.value!,state=tab.id===activeId.value?ed.state:tab.state
  const json=state?.doc.toJSON() || ed.markdown!.parse(splitFrontmatter(tab.markdown).body),images:Record<string,string>={}
  function scan(node:any){if(node.type==='image')images[node.attrs.originalSrc||node.attrs.src]=node.attrs.src;node.content?.forEach(scan)}scan(json)
  return{json,prefix:getPrefix(tab),serialize:(doc:any)=>ed.markdown!.serialize(doc),images,bundleKey:tab.bundleKey,documentPath:tab.path||undefined}
}
function rewriteSavedImages(tab:DocumentTab,rewrites:Record<string,string>) {
  const ed=editor.value!,state=tab.id===activeId.value?ed.state:tab.state
  if(!state){const json=ed.markdown!.parse(splitFrontmatter(tab.markdown).body);function scan(node:any){if(node.type==='image'){const src=node.attrs.originalSrc||node.attrs.src;if(rewrites[src])node.attrs.originalSrc=rewrites[src]}node.content?.forEach(scan)}scan(json);tab.markdown=getPrefix(tab)+ed.markdown!.serialize(json);return}
  let tr=state.tr;state.doc.descendants((node,pos)=>{if(node.type.name==='image'){const source=node.attrs.originalSrc||node.attrs.src;if(rewrites[source])tr=tr.setNodeMarkup(pos,undefined,{...node.attrs,originalSrc:rewrites[source]})}})
  tr.setMeta('addToHistory',false)
  if(tab.id===activeId.value)ed.view.dispatch(tr);else{tab.state=markRaw(state.apply(tr));tab.markdown=getPrefix(tab)+ed.markdown!.serialize(tab.state.doc.toJSON())}
}
async function exportTextBundle(format:'textpack'|'textbundle') {
  if(plain.value)return
  const ed=editor.value;if(!ed||busy.value)return;fileMenu.value=false;busy.value=true
  try{const result=await saveBundleDocument({content:getMarkdown(ed),path:null,modified:null,saveAs:true,format,resources:bundleResources(currentTab.value),reserved:{paths:tabs.value.flatMap(tab=>tab.path?[tab.path]:[]),handles:tabs.value.flatMap(tab=>tab.handleKey?[tab.handleKey]:[])}});if(result)notify('已导出 TextBundle / TextPack')}catch(e){report(e)}finally{busy.value=false}
}
async function saveOne(tab: DocumentTab, saveAs = false, automatic = false) {
    const content = tab.id === activeId.value && editor.value ? getMarkdown(editor.value) : tab.markdown
    const others = tabs.value.filter(other => other.id !== tab.id)
    // The first save and Save As both open one dialog whose "save as type" list holds
    // Markdown and TextPack, so the extension the user picks decides the writer.
    let format = tab.format || 'markdown', target: string | undefined
    const resources=bundleResources(tab),withImages=hasEmbeddedImages(resources.json)
    if (native && (saveAs || !tab.path || (format==='markdown'&&withImages&&!automatic))) {
      const choice = await chooseSaveTarget(tab.path || tabLabel(tab).replace(/[\\/:*?"<>|]/g, '_'),withImages,tab.mode==='text')
      if (!choice) return false
      if(tab.mode==='text'&&choice.format!=='markdown')throw Error('纯文本请保存为文本文件。')
      format = choice.format; target = choice.path
    }
    const result = await saveDocument(content, tab.path, tab.modified, saveAs, tab.handleKey, { paths: others.flatMap(other => other.path ? [other.path] : []), handles: others.flatMap(other => other.handleKey ? [other.handleKey] : []) }, {format,resources,automatic,mode:tab.mode,textEncoding:tab.textEncoding}, target)
    if (result) {
      const oldMode=tab.mode
      tab.path = result.path; tab.modified = result.modified; tab.handleKey = result.handleKey; tab.baseline = result.writtenContent ?? content
      rememberFile(result.path,result.handleKey)
      tab.format=result.format||'markdown';tab.bundleKey=tab.format==='markdown'?undefined:result.bundleKey||tab.bundleKey
      if(tab.mode!=='text'&&result.rewrites&&Object.keys(result.rewrites).length)rewriteSavedImages(tab,result.rewrites)
      const nextMode:EditingMode=tab.format!=='markdown'?'markdown':editingMode(tab.path)
      if(nextMode!==oldMode){
        const current=tab.id===activeId.value&&editor.value?getMarkdown(editor.value):tab.markdown
        tab.mode=nextMode;tab.frontmatter=nextMode==='text'?'':splitFrontmatter(current.replace(/^\uFEFF/,'')).head
        if(tab.id===activeId.value&&editor.value){setTabContent(tab,current);const ed=editor.value;ed.view.updateState(EditorState.create({schema:ed.schema,doc:ed.state.doc,plugins:ed.state.plugins}));tab.markdown=getMarkdown(ed)}else{tab.markdown=current;tab.state=undefined}
        if(current===(result.writtenContent??content))tab.baseline=tab.markdown
      }

      tab.markdown = tab.id === activeId.value && editor.value ? getMarkdown(editor.value) : tab.markdown
      tab.dirty = tab.markdown !== tab.baseline
      tab.diskChanged = false; tab.diskMissing = false; tab.ignoredModified = undefined
      if (result.historyWarning) report(new Error(`文件已保存，但历史记录写入失败：${result.historyWarning}`))
      autoBlocked.delete(tab.id); storeDraft(); return true
    }
    return false
}
async function runAutoSave(){
  const ed=editor.value
  if(!autoSave.value||!ed||busy.value||pointerDown||ed.view.composing||sourceOpen.value||showHelp.value||closeDialog.value||historyDialog.value||reloadCandidate.value)return
  captureCurrent()
  const tab=tabs.value.find(tab=>tab.path&&tab.dirty&&!tab.diskChanged&&!tab.diskMissing&&!autoBlocked.has(tab.id)&&Date.now()-(lastEdit.get(tab.id)||0)>=2000&&(native||!!tab.handleKey&&browserHandles.has(tab.handleKey)))
  if(!tab)return
  const handle=tab.handleKey?browserHandles.get(tab.handleKey):undefined
  busy.value=true;saving.value=true;automaticSaving.value=true
  try{
    if(!native&&handle?.queryPermission&&await handle.queryPermission({mode:'readwrite'})!=='granted'){autoBlocked.add(tab.id);report(new Error('自动保存需要写入权限，请先手动保存一次。'));return}
    const status=await documentStatus(tab.path!,tab.handleKey)
    if(!status||status.missing||status.modified!==tab.modified){tab.diskMissing=!!status?.missing;tab.diskChanged=!status?.missing;autoBlocked.add(tab.id);return}
    if(await saveOne(tab,false,true)){if(tab.id===activeId.value&&!tab.dirty)recoveryStatus.value='已自动保存'}
  }catch(e){autoBlocked.add(tab.id);report(new Error(t('自动保存已暂停，修改仍保留。请手动保存或重新加载。')+' '+String(e)))}
  finally{busy.value=false;saving.value=false;automaticSaving.value=false}
}
function releasePointer(){pointerDown=false}
function historyKey(tab = currentTab.value) { return tab.path || `draft:${tab.id}` }
async function checkpoint(reason = '自动编辑快照', force = false) {
  if (!editor.value || recordingHistory || busy.value) return
  captureCurrent(); const tab = currentTab.value, key = historyKey(tab)
  if (!force && (!tab.dirty || Date.now() - (lastHistory.get(key) || 0) < 60000)) return
  recordingHistory = true
  try { await recordHistory(key, tab.markdown, reason); lastHistory.set(key, Date.now()) } catch(e) { report(new Error(`历史快照写入失败，当前内容仍在：${String(e)}`)) } finally { recordingHistory = false }
}
async function openHistory() {
  if (!editor.value || busy.value) return
  await checkpoint('当前草稿', true)
  historyDialog.value = { keys: [...new Set([historyKey(), `draft:${currentTab.value.id}`])], title: title.value }
}
async function restoreVersion(content: string) {
  const label = historyDialog.value?.title || title.value
  historyDialog.value = null; captureCurrent()
  const tab = newTab(content, null, null, true,currentTab.value.mode); tab.displayName = `历史 · ${label}`; tabs.value.push(tab)
  tab.bundleKey=currentTab.value.bundleKey;tab.textEncoding=currentTab.value.textEncoding
  await activateTab(tab.id, false); notify('历史版本已在新标签打开，原文稿保留')
}
async function checkExternal() {
  if (checkingDisk || busy.value || !editor.value || document.visibilityState === 'hidden') return
  const tab = currentTab.value
  if (!tab.path) return
  checkingDisk = true
  try {
    const status = await documentStatus(tab.path, tab.handleKey)
    if (!status || !tabs.value.includes(tab)) return
    tab.diskMissing = status.missing
    tab.diskChanged = !status.missing && !!tab.modified && status.modified !== tab.modified && status.modified !== tab.ignoredModified
  } catch { /* A temporary access failure must not disturb editing. Explicit reload reports it. */ }
  finally { checkingDisk = false }
}
async function reloadFromDisk() {
  if (busy.value || !editor.value || !path.value) return
  busy.value = true
  try {
    const tab = currentTab.value, doc = await readDocument(tab.path!, tab.handleKey); captureCurrent()
    if (tab.dirty) reloadCandidate.value = { tabId: tab.id, doc, current: tab.markdown }
    else await applyReload(tab, doc, false)
  } catch(e) { report(e) } finally { busy.value = false }
}
async function applyReload(tab: DocumentTab, doc: OpenedFile, keepDraft: boolean) {
  await recordHistory(historyKey(tab), tab.markdown, '重新加载前版本')
  if (keepDraft) {
    const backup = newTab(tab.markdown, null, null, true,tab.mode); backup.displayName = `保留稿 · ${tabLabel(tab)}`; backup.textEncoding=tab.textEncoding; backup.state = tab.state; backup.bundleKey=tab.bundleKey; backup.tableWidths = tab.tableWidths; tabs.value.push(backup)
  }
  await replaceDocument(doc.content, doc.path, doc.modified,false,doc)
  tab.diskChanged = false; tab.diskMissing = false; tab.ignoredModified = undefined
  await recordHistory(historyKey(tab), doc.content, '从磁盘重新加载')
  notify(keepDraft ? '已重新加载磁盘版本，未保存稿保留在另一个标签' : '已重新加载磁盘版本')
}
async function confirmReload() {
  const candidate = reloadCandidate.value
  if (!candidate || busy.value) return
  const tab = tabs.value.find(tab => tab.id === candidate.tabId)
  if (!tab || tab.id !== activeId.value) return
  busy.value = true
  try { captureCurrent(); await applyReload(tab, candidate.doc, true); reloadCandidate.value = null } catch(e) { report(e) } finally { busy.value = false }
}
async function ignoreExternal() { const tab = currentTab.value; if (!tab.path) return; try { const status = await documentStatus(tab.path, tab.handleKey); tab.ignoredModified = status?.modified || undefined; tab.diskChanged = false; tab.diskMissing = false } catch(e) { report(e) } }
function openFind(replace = false) { if (historyDialog.value || reloadCandidate.value || closeDialog.value || sourceOpen.value) return; find.value = { replace }; void nextTick(() => findPanel.value?.focus()) }
async function closeFind() { find.value = null; await nextTick(); editor.value?.view.focus() }
function insertPageBreak() { if (plain.value || !editor.value || editor.value.isActive('table')) return; editor.value.chain().focus().insertContent([{ type: 'pageBreak' }, { type: 'paragraph' }]).run() }
function appFocus() { if (document.visibilityState !== 'hidden') void checkExternal() }
async function save(saveAs = false, id = activeId.value) {
  if (!editor.value || busy.value) return
  const tab = tabs.value.find(tab => tab.id === id); if (!tab) return
  busy.value = true; saving.value = true; tabMenu.value = null
  try {
    if (await saveOne(tab, saveAs)) notify(`已保存 ${tab.path?.split(/[\\/]/).pop()}`)
    else notify('已取消保存，草稿仍保留')
  } catch (e) { report(e) } finally { busy.value = false; saving.value = false }
}
async function saveAll() {
  if (busy.value) return
  captureCurrent(); tabMenu.value = null; busy.value = true; saving.value = true
  let saved = 0
  try {
    const pending = tabs.value.filter(tab => tab.dirty)
    if (!pending.length) { notify('没有待保存的修改'); return }
    for (const tab of pending) {
      if (!await saveOne(tab)) { notify(`已保存 ${saved} 份；剩余文稿仍保留在标签页中`); return }
      saved++
    }
    notify(`已保存全部 ${saved} 份文稿`)
  } catch (e) { report(e) } finally { busy.value = false; saving.value = false }
}
function chooseClose(choice: 'save' | 'discard' | 'cancel') { closeDialog.value?.resolve(choice); closeDialog.value = null }
async function prepareClose(targets: DocumentTab[]) {
  captureCurrent()
  const pending = targets.filter(tab => tab.dirty)
  if (!pending.length) return true
  const choice = await new Promise<'save' | 'discard' | 'cancel'>(resolve => closeDialog.value = { tabs: pending, resolve })
  if (choice === 'cancel') return false
  if (choice === 'save') {
    busy.value = true
    try { for (const tab of pending) if (!await saveOne(tab)) { notify('已取消关闭，全部标签仍保留'); return false } }
    catch (e) { report(e); return false } finally { busy.value = false }
  }
  return true
}
async function closeTabs(ids: string[]) {
  if (busy.value || closeChoicePending.value) return
  tabMenu.value = null; closeChoicePending.value = true
  try {
    const targets = tabs.value.filter(tab => ids.includes(tab.id))
    if (!await prepareClose(targets)) return
    const keep = tabs.value.filter(tab => !ids.includes(tab.id))
    if (!keep.length) keep.push(newTab())
    if (ids.includes(activeId.value)) {
      const previousIndex = tabs.value.findIndex(tab => tab.id === activeId.value)
      const next = keep[Math.min(previousIndex, keep.length - 1)]
      tabs.value = [...keep, currentTab.value]
      await activateTab(next.id, false)
    }
    tabs.value = keep; storeDraft()
  } finally { closeChoicePending.value = false }
}
function showTabMenu(event: MouseEvent, id: string) {
  if (busy.value) return
  slash.close(); tabMenu.value = { id, left: Math.min(event.clientX, window.innerWidth - 200), top: Math.min(event.clientY, window.innerHeight - 240) }
}
async function makePrintHtml() {
  const current=editor.value!;const options={...printSettings.value,margin:layout.value.margin};if(viewMode.value==='pages')return createPrintHtml(current,title.value,options)
  const host=document.createElement('div');host.style.cssText='position:absolute;left:-20000px;top:0;width:1123px;pointer-events:none';document.body.append(host)
  const snapshot=new Editor({element:host,extensions:extensions(layout.value),content:current.getJSON(),editable:false,editorProps:{attributes:{class:'paper-editor',style:current.view.dom.getAttribute('style')||''}}})
  Object.assign(snapshot.storage.mixedPagination,{directions:{...currentTab.value.pageDirections},base:layout.value.orientation,margin:layout.value.margin,continuous:false})
  snapshot.view.dispatch(snapshot.state.tr.setMeta('yeranLayout',true).setMeta('addToHistory',false))
  try{return await createPrintHtml(snapshot,title.value,options)}finally{snapshot.destroy();host.remove()}
}
async function printPdf() {
  if (!editor.value || busy.value) return
  busy.value = true
  try {
    const html = await makePrintHtml()
    const result = await exportPdf(html, title.value)
    if (result) notify(result === 'print-dialog' ? '在打印窗口选择“另存为 PDF”' : 'PDF 已导出')
    else notify('已取消导出')
  } catch (e) { report(e) } finally { busy.value = false }
}
// Printing goes straight from the frozen page snapshot, so the A4 view the user
// already sees is the only preview. No second window, no duplicated pagination.
async function printDirect() {
  if (!editor.value || busy.value) return
  busy.value = true
  slash.close(); settings.value = false; tabMenu.value = null
  try { await printDocumentHtml(await makePrintHtml()) }
  catch (e) { report(e) } finally { busy.value = false }
}
// The tab strip only fades at its edges while it actually scrolls; a strip that fits
// should read as plain pills with a crisp last tab.
const tabStrip = ref<HTMLElement | null>(null)
const tabsOverflow = ref(false)
function measureTabs() {
  const el = tabStrip.value
  if (!el) return
  tabsOverflow.value = el.scrollWidth > el.clientWidth + 1
}
onMounted(() => { measureTabs(); window.addEventListener('resize', measureTabs) })
onBeforeUnmount(() => window.removeEventListener('resize', measureTabs))
watch(tabs, async () => { await nextTick(); measureTabs() }, { deep: true })
function setBlock() {
  const ed = editor.value; if (!ed) return
  if (blockType.value === 'paragraph') ed.chain().focus().setParagraph().run()
  else ed.chain().focus().setHeading({ level: Number(blockType.value.slice(1)) as 1 | 2 | 3 | 4 | 5 | 6 }).run()
}
// A native <select> cannot show six heading levels the way the rest of the toolbar looks,
// so the style picker is a normal menu that reads the same in both locales.
const styleMenu = ref(false)
const styleOptions = [
  { value: 'paragraph', label: '正文', icon: Pilcrow },
  { value: 'h1', label: '标题 1', icon: Heading1 },
  { value: 'h2', label: '标题 2', icon: Heading2 },
  { value: 'h3', label: '标题 3', icon: Heading3 },
  { value: 'h4', label: '标题 4', icon: Heading4 },
  { value: 'h5', label: '标题 5', icon: Heading5 },
  { value: 'h6', label: '标题 6', icon: Heading6 }
]
function chooseStyle(value: string) { blockType.value = value; setBlock(); styleMenu.value = false }
function jump(pos: number) {
  const ed = editor.value; if (!ed) return
  ed.chain().focus().setTextSelection(pos + 1).scrollIntoView().run()
  refreshSelection()
}
function changeZoom(delta: number) { const current = effectiveZoom.value; fit.value = false; zoom.value = Math.max(40, Math.min(150, Math.round(current * 100 / 5) * 5 + delta)) }
let imageReplacement:{tabId:string;pos:number;source:string}|null=null
function beginImageReplacement(){const ed=editor.value;if(!ed)return;const node=ed.state.doc.nodeAt(ed.state.selection.from);if(node?.type.name!=='image')return;imageReplacement={tabId:activeId.value,pos:ed.state.selection.from,source:node.attrs.src};imageInput.value?.click()}
async function insertImage(file?: File) {
  const replacement=imageReplacement;imageReplacement=null
  if (!file || !editor.value || plain.value) return
  if (!file.type.startsWith('image/')) { report(new Error('请选择图片文件。')); return }
  if (file.size > 5 * 1024 * 1024) { report(new Error('单张图片请小于 5 MB，以免 Markdown 文件和恢复草稿过大。')); return }
  try {
    const tabId=replacement?.tabId||activeId.value,selection=editor.value.state.selection.getBookmark()
    const src=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=reject;reader.readAsDataURL(file)})
    const tab=tabs.value.find(tab=>tab.id===tabId);if(!tab)return
    const attrs={src,alt:file.name,originalSrc:null}
    if(replacement){const state=tab.id===activeId.value?editor.value.state:tab.state,node=state?.doc.nodeAt(replacement.pos);if(!state||node?.type.name!=='image'||node.attrs.src!==replacement.source)throw new Error('原图片已改变，请重新选择。');const tr=state.tr.setNodeMarkup(replacement.pos,undefined,{...node.attrs,...attrs,height:null});if(tab.id===activeId.value)editor.value.view.dispatch(tr);else{tab.state=markRaw(state.apply(tr));tab.markdown=getPrefix(tab)+editor.value.markdown!.serialize(tab.state.doc.toJSON());tab.dirty=true;storeDraft()}}
    else if(tab.id===activeId.value)editor.value.chain().focus().setImage(attrs).run()
    else if(tab.state){let tr=tab.state.tr;const selected=selection.resolve(tab.state.doc);tr=tr.insert(selected.from,editor.value.schema.nodes.image!.create(attrs));tab.state=markRaw(tab.state.apply(tr));tab.markdown=getPrefix(tab)+editor.value.markdown!.serialize(tab.state.doc.toJSON());tab.dirty=true;storeDraft()}
  } catch (e) { report(e) }
  if (imageInput.value) imageInput.value.value = ''
}
function openSource() { if (editor.value) { sourceValue.value = getMarkdown(editor.value); sourceOpen.value = true } }
async function applySource() {
  if (!editor.value) return
  const parts = splitFrontmatter(sourceValue.value)
  frontmatter.value = parts.head
  applyPageMetadata(parts)
  editor.value.commands.setContent(safeMarkdown(parts.body), { contentType: 'markdown' })
  if (path.value) await resolveImages(editor.value, path.value,currentTab.value.bundleKey)
  sourceOpen.value = false; notify('已应用 Markdown 修改')
}
function handleKey(event: KeyboardEvent) {
  if(event.key==='F2'&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&!event.shiftKey&&!busy.value&&!sourceOpen.value&&!showHelp.value&&!closeDialog.value&&!historyDialog.value&&!reloadCandidate.value&&!(event.target as Element)?.closest?.('input,textarea,select,.file-panel,.library-context-menu')){event.preventDefault();event.stopPropagation();void renameTab(tabMenu.value?.id||(event.target as Element)?.closest?.<HTMLElement>('[data-tab-id]')?.dataset.tabId||activeId.value);return}
  if ((event.key === 'F8' || event.key === 'F9') && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey && !sourceOpen.value && !closeDialog.value && !historyDialog.value && !reloadCandidate.value && !(event.target as Element)?.closest?.('input,textarea,select')) {
    event.preventDefault(); event.stopPropagation(); void toggleWriting(event.key === 'F8' ? 'focus' : 'typewriter'); return
  }
  if (event.key === 'Escape') { if (closeDialog.value) chooseClose('cancel'); else if (historyDialog.value) historyDialog.value = null; else if (reloadCandidate.value) reloadCandidate.value = null; else if (find.value) void closeFind(); else { fileMenu.value=false; styleMenu.value=false; tabMenu.value = null; settings.value = false; writingMenu.value = false; showHelp.value = false; slash.close() } return }
  if (!(event.ctrlKey || event.metaKey) || event.altKey) return
  const key = event.key.toLowerCase()
  if(quickOpen.value){if(['p','s','n','o','w'].includes(key))event.preventDefault();return}
  if(key==='o'&&event.shiftKey&&!closeDialog.value&&!historyDialog.value&&!reloadCandidate.value&&!sourceOpen.value){event.preventDefault();event.stopPropagation();quickOpen.value=true;fileMenu.value=false;return}
  if (closeDialog.value || historyDialog.value || reloadCandidate.value) { if (['p','s','n','o','w','f','h'].includes(key)) event.preventDefault(); return }
  if (sourceOpen.value) { if (key === 's') { event.preventDefault(); applySource() } else if (['p','n','o','w'].includes(key)) event.preventDefault(); return }
  if((event.target as Element)?.closest?.('input,textarea,select')&&!['s','o','n','p','w'].includes(key)&&!(key==='e'&&event.shiftKey))return
  if(plain.value&&(!event.shiftKey&&['b','i','u','e','k','t','0','1','2','3','4','5','6','\\'].includes(key)||event.shiftKey&&['k','m','q'].includes(key))){event.preventDefault();event.stopPropagation();return}
  if(key==='e'&&!event.shiftKey&&!(event.target as Element)?.closest?.('input,textarea,select')){event.preventDefault();event.stopPropagation();if(editor.value)toggleRed(editor.value);return}
  if(/^[0-6]$/.test(key)){event.preventDefault();event.stopPropagation();const chain=editor.value?.chain().focus();if(key==='0')chain?.setParagraph().run();else chain?.setHeading({level:Number(key) as 1|2|3|4|5|6}).run();return}
  if(event.shiftKey&&key==='k'){event.preventDefault();event.stopPropagation();editor.value?.chain().focus().toggleCodeBlock().run();return}
  if(event.shiftKey&&key==='m'){event.preventDefault();event.stopPropagation();editor.value?.chain().focus().insertContent({type:'mathBlock',attrs:{latex:'E=mc^2'}}).run();return}
  if(event.shiftKey&&key==='q'){event.preventDefault();event.stopPropagation();editor.value?.chain().focus().toggleBlockquote().run();return}
  if(key==='t'){event.preventDefault();event.stopPropagation();editor.value?.chain().focus().insertTable({rows:3,cols:3,withHeaderRow:true}).run();return}
  if(key === 'k'){event.preventDefault();event.stopPropagation();textTools.value?.editLink();return}
  if(key === '\\'){event.preventDefault();event.stopPropagation();editor.value?.chain().focus().unsetAllMarks().unsetTextAlign().run();return}
  if (key === 'f' || key === 'h') { event.preventDefault(); openFind(key === 'h'); return }
  if (key === 'r') { event.preventDefault(); void reloadFromDisk(); return }
  if (key === 'Tab'.toLowerCase()) { event.preventDefault(); const index = tabs.value.findIndex(tab => tab.id === activeId.value); void activateTab(tabs.value[(index + (event.shiftKey ? -1 : 1) + tabs.value.length) % tabs.value.length].id); return }
  if (['s','o','n','p','w'].includes(key) || (key === 'e' && event.shiftKey)) {
    event.preventDefault(); event.stopPropagation()
    if (key === 's') { if (event.shiftKey) void saveAll(); else void save() }
    if (key === 'o') void openDocument()
    if (key === 'n') void newDocument()
    if (key === 'p') void printDirect()
    if (key === 'w') void closeTabs([activeId.value])
    if (key === 'e' && event.shiftKey) void printPdf()
  }
}
function beforeUnload(event: BeforeUnloadEvent) { storeDraft(); if (tabs.value.some(tab => tab.dirty)) { event.preventDefault(); event.returnValue = '' } }
function adaptSidebar() { if (window.innerWidth < 1100) sidebar.value = false }
function outsideClick(event: PointerEvent) {
  pointerDown=event.buttons!==0
  const element = event.target as Element
  if (!element.closest('.file-menu-wrap')) fileMenu.value=false
  if (!element.closest('.writing-menu')) writingMenu.value=false
  if (!element.closest('.slash-menu') && !element.closest('.paper-editor')) slash.close()
  if (!element.closest('.tab-context-menu')) tabMenu.value = null
}

onMounted(async () => {
  await reloadLegacyText(recovered)
  adaptSidebar()
  editor.value = new Editor({
    extensions: extensions(layout.value), content: recovered.mode==='text'?plainContent(recovered.markdown.replace(/^\uFEFF/,'')):safeMarkdown(splitFrontmatter(recovered.markdown.replace(/^\uFEFF/,'')).body), contentType: recovered.mode==='text'?'json':'markdown',
    editorProps: {
      attributes: { class: 'paper-editor', 'aria-label': '文档正文', role: 'textbox', 'aria-multiline': 'true', spellcheck: 'false', style: `font-family:${fontFamily.value};font-size:${layout.value.fontSize}px;line-height:${layout.value.lineHeight}` },
      handlePaste(_view, event) { if(plain.value)return false; const image = [...(event.clipboardData?.files || [])].find(f => f.type.startsWith('image/')); if (image) { void insertImage(image); return true }
        const text=event.clipboardData?.getData('text/plain')||''
        if(!event.clipboardData?.getData('text/html')&&!editor.value?.isActive('codeBlock')&&!editor.value?.isActive('table')&&/^(?:#{1,6}\s|[-*+]\s|\d+\.\s|>\s|\[TOC\]|\[\^)/im.test(text)){editor.value?.commands.insertContent(safeMarkdown(text),{contentType:'markdown'});return true}return false },
      handleDrop(_view, event, _slice, moved) { if(plain.value)return false; if (moved) return false; const file = event.dataTransfer?.files[0]; if (file?.type.startsWith('image/')) { void insertImage(file); return true } return false },
      handleKeyDown: slash.keyDown,
      handleDOMEvents: {
        contextmenu(view, event) {
          const cell = (event.target as Element).closest?.('td,th')
          if (!cell || !editor.value) return false
          event.preventDefault()
          if (!(view.state.selection instanceof CellSelection && cell.classList.contains('selectedCell'))) editor.value.commands.setTextSelection(view.posAtDOM(cell, 0) + 1)
          scheduleStats(); void nextTick(() => { refreshSelection(); void nextTick(() => tableTools.value?.openContext(event.clientX, event.clientY)) })
          return true
        },
      },
    },
    onUpdate() { dirty.value = true; scheduleDraft(); scheduleStats() },
    onSelectionUpdate: refreshSelection, onTransaction: scheduleStats,
  })
  prepareMode(recovered)
  editor.value.storage.documentLinks.open = href=>void openLinkedDocument(href)
  editor.value.commands.setWritingModes(writing.value)
  editor.value.storage.autoPair.enabled=autoPair.value
  restoreTableWidths(editor.value, recovered.tableWidths)
  syncMixedPages()
  if (recovered.mode!=='text'&&(recovered?.path || recovered?.bundleKey)) await resolveImages(editor.value, recovered.path||'',recovered.bundleKey)
  dirty.value = recovered?.dirty || false
  if (!dirty.value) diskContent.value = getMarkdown(editor.value)
  observer = new ResizeObserver(entries => { canvasWidth.value = entries[0].contentRect.width; scheduleStats() })
  if (scroller.value) observer.observe(scroller.value)
  window.addEventListener('keydown', handleKey,true)
  window.addEventListener('resize', adaptSidebar)
  window.addEventListener('beforeunload', beforeUnload)
  document.addEventListener('visibilitychange', storeDraft)
  document.addEventListener('visibilitychange', appFocus); window.addEventListener('focus', appFocus)
  diskTimer = setInterval(() => void checkExternal(), 2500)
  historyTimer = setInterval(() => void checkpoint(), 30000)
  autoTimer=setInterval(()=>void runAutoSave(),1000)
  document.addEventListener('pointerup',releasePointer);document.addEventListener('pointercancel',releasePointer);window.addEventListener('blur',releasePointer)
  document.addEventListener('pointerdown', outsideClick)
  window.addEventListener('scroll', slash.refresh, true)
  if (native) {
    const { getCurrentWindow } = await import('@tauri-apps/api/window')
    removeCloseListener = await getCurrentWindow().onCloseRequested(async event => {
      event.preventDefault()
      if (closeChoicePending.value || busy.value) return
      closeChoicePending.value = true
      storeDraft()
      try { if (await prepareClose(tabs.value)) { storeDraft(); await getCurrentWindow().destroy() } } finally { closeChoicePending.value = false }
    })
    const {listen}=await import('@tauri-apps/api/event')
    removeOpenListener=await listen('yeran-open-files',()=>void receiveOpenFiles())
    await receiveOpenFiles()
  }
  // Only development builds expose an inspection hook for the browser acceptance tests.
  if (import.meta.env.DEV) (window as any).__yeran = { editor: editor.value, flushDraft: storeDraft, getMarkdown: () => getMarkdown(editor.value!), createPrintHtml: () => makePrintHtml(), replaceDocument, layout, tabs, activeId, activateTab, checkExternal, checkpoint, getPageSlices: () => getPageSlices(editor.value!.view.dom), viewMode }
  requestAnimationFrame(() => { if (scroller.value) scroller.value.scrollTop = recovered.scrollTop })
  scheduleStats()
})
watch([busy,sourceOpen,showHelp,closeDialog,historyDialog,reloadCandidate],()=>{void receiveOpenFiles()})
watch(layout, async value => {
  const ed = editor.value; if (!ed) return
  ed.view.dom.style.fontFamily = fontFamily.value
  ed.view.dom.style.fontSize = `${value.fontSize}px`
  ed.view.dom.style.lineHeight = String(value.lineHeight)
  const pagination = ed.extensionManager.extensions.find(extension => extension.name === 'PaginationPlus')
  const size = pageSize(value)
  if (pagination) Object.assign(pagination.options, { pageWidth: size.width, pageHeight: size.height, marginTop: mm(value.margin), marginBottom: mm(value.margin), marginLeft: mm(value.margin), marginRight: mm(value.margin) })
  const features = ed.extensionManager.extensions.find(extension => extension.name === 'paginationFeatures')
  if (features) features.options.repeatTableHeaders = value.repeatTableHeaders
  ed.commands.updateMargins({ top: mm(value.margin), bottom: mm(value.margin), left: mm(value.margin), right: mm(value.margin) })
  ed.chain().updatePageWidth(size.width).updatePageHeight(size.height).run()
  if(currentTab.value.baseOrientation) currentTab.value.baseOrientation = value.orientation
  syncMixedPages(); scheduleDraft()
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(value)) } catch { report(new Error('页面设置无法保存到本机。')) }
  await nextTick(); scheduleStats()
}, { deep: true })
watch(viewMode,async mode=>{try{localStorage.setItem('yeran.view-mode.v1',mode)}catch{};const scroll=scroller.value?.scrollTop||0;syncMixedPages();await nextTick();if(scroller.value)scroller.value.scrollTop=scroll;scheduleStats()})
watch(writing, async preferences => {
  try { localStorage.setItem('yeran.writing-modes.v1', JSON.stringify(preferences)) } catch { report(new Error('写作模式无法保存到本机。')) }
  await nextTick()
  editor.value?.commands.setWritingModes(preferences)
})
watch(autoPair,enabled=>{if(editor.value)editor.value.storage.autoPair.enabled=enabled;try{localStorage.setItem('yeran.auto-pair.v1',JSON.stringify(enabled))}catch{report(new Error('写作模式无法保存到本机。'))}})
watch(sidebarPane,value=>{try{localStorage.setItem('yeran.sidebar-pane.v1',JSON.stringify(value))}catch{}})
watch(autoSave,value=>{autoBlocked.clear();try{localStorage.setItem('yeran.auto-save.v1',JSON.stringify(value))}catch{report(new Error('写作模式无法保存到本机。'))}})
watch(printSettings,value=>{try{localStorage.setItem('yeran.print-settings.v1',JSON.stringify(value))}catch{report(new Error('页面设置无法保存到本机。'))}},{deep:true})
watch(title, name => document.title = `${name} — 页然 · Yeran`)
onBeforeUnmount(() => { clearInterval(autoTimer);document.removeEventListener('pointerup',releasePointer);document.removeEventListener('pointercancel',releasePointer);window.removeEventListener('blur',releasePointer);removeOpenListener?.(); disposePrintFrame(); releaseBundleURLs(); clearInterval(diskTimer); clearInterval(historyTimer); document.removeEventListener('visibilitychange', appFocus); window.removeEventListener('focus', appFocus); clearTimeout(draftTimer); storeDraft(); observer?.disconnect(); removeCloseListener?.(); cancelAnimationFrame(frame); editor.value?.destroy(); window.removeEventListener('keydown', handleKey,true); window.removeEventListener('resize', adaptSidebar); window.removeEventListener('beforeunload', beforeUnload); document.removeEventListener('visibilitychange', storeDraft); document.removeEventListener('pointerdown', outsideClick); window.removeEventListener('scroll', slash.refresh, true) })
</script>

<template>
  <div class="app-shell" :class="{ 'sidebar-hidden': !sidebar, 'focus-writing': writing.focus, 'typewriter-writing': writing.typewriter,'plain-document':plain }">
    <header class="app-header">
      <div class="identity"><div class="app-mark"><FileText :size="20" /></div><span>{{ t('页然 ') }}<small>· Yeran</small></span></div>
    <div class="tabs-bar">
      <div class="document-tabs" :class="{ overflowing: tabsOverflow }" ref="tabStrip" role="tablist" :aria-label="t('打开的文稿')">
        <div v-for="tab in tabs" :key="tab.id" role="tab" :data-tab-id="tab.id" :aria-selected="activeId === tab.id" :tabindex="activeId === tab.id ? 0 : -1" :class="['document-tab', { active: activeId === tab.id }]" :title="tab.path || tabLabel(tab)" @click="activateTab(tab.id)" @keydown.enter.self.prevent="activateTab(tab.id)" @keydown.space.self.prevent="activateTab(tab.id)" @contextmenu.prevent="showTabMenu($event, tab.id)">
          <FileText :size="14" /><span>{{ tabLabel(tab) }}</span><i v-if="tab.dirty" class="tab-dirty" :title="t('尚未保存到文件')"></i><button :disabled="busy" :aria-label="t(`关闭 ${tabLabel(tab)}`)" :title="t('关闭标签')" @click.stop="closeTabs([tab.id])"><X :size="13" /></button>
        </div>
      </div>
      <button class="icon-btn" :title="t('新建文稿 · Ctrl+N')" :aria-label="t('新建标签')" :disabled="busy" @click="newDocument"><Plus :size="16" /></button>
      <button class="icon-btn save-all-btn" :aria-label="t('全部保存')" :title="t('全部保存 · Ctrl+Shift+S')" :disabled="busy" @click="saveAll"><Files :size="16" /></button>
    </div>
      <div class="header-actions">
        <select class="language-select" :aria-label="t('界面语言')" v-model="locale"><option value="zh-CN">{{ t('简体中文') }}</option><option value="zh-TW">{{ t('繁體中文') }}</option><option value="en">English</option></select>
        <button class="text-btn export-action" :aria-label="t('导出 PDF')" :title="t('导出 PDF · Ctrl+Shift+E')" :disabled="busy" @click="printPdf"><Download :size="16" /><span>{{ t('导出 PDF') }}</span></button>
        <button class="primary-btn direct-print-action" :aria-label="t('打印')" :title="t('打印 · Ctrl+P')" :disabled="busy" @click="printDirect"><Printer :size="16" /><span>{{ t('打印') }}</span></button>
      </div>
    </header>
    <div class="toolbar" role="toolbar" :aria-label="t('文档工具栏')">
      <div class="tools-group file-tools"><div class="file-menu-wrap"><button class="icon-btn file-menu-toggle" :aria-label="t('更多文件操作')" :aria-expanded="fileMenu" @click="fileMenu = !fileMenu"><ChevronDown :size="12" /></button><div v-if="fileMenu" class="file-context-menu" role="menu" :aria-label="t('更多文件操作')"><button role="menuitem" @click="newDocument(true);fileMenu=false"><FileText :size="14"/><span>{{t('新建纯文本')}}</span></button><button role="menuitem" @click="quickOpen=true;fileMenu=false"><Search :size="14" /><span>{{t('快速打开')}}</span><kbd>Ctrl+Shift+O</kbd></button><button role="menuitemcheckbox" :aria-checked="autoSave" @click="autoSave=!autoSave"><Check v-if="autoSave" :size="14" /><span>{{t('自动保存到文件')}}</span></button><p class="auto-save-note">{{t('首次手动保存后，停止输入约 2 秒自动保存。')}}</p><hr><button role="menuitem" @click="openDocument(true)"><FolderOpen :size="14" /><span>{{t('打开 TextBundle 文件夹')}}</span></button><button v-if="!plain" role="menuitem" @click="exportTextBundle('textpack')"><FileOutput :size="14" /><span>{{t('导出 TextPack')}}</span></button><button v-if="native&&!plain" role="menuitem" @click="exportTextBundle('textbundle')"><FolderOutput :size="14" /><span>{{t('导出 TextBundle 文件夹')}}</span></button></div></div>
        <button class="icon-btn" :class="{ selected: sidebar }" :title="t('切换大纲')" :aria-label="t('切换大纲')" @click="sidebar = !sidebar"><PanelLeft :size="17" /></button>
        <button class="icon-btn" :title="t('打开 · Ctrl+O')" :aria-label="t('打开 Markdown')" @click="openDocument()"><FolderOpen :size="17" /></button>
        <button class="icon-btn" :title="t('保存 · Ctrl+S；右键标签可另存为')" :aria-label="t('保存 Markdown')" :disabled="busy" @click="save(false)"><Save :size="17" /></button>
      </div>
      <div class="tools-group undo-tools"><button class="icon-btn" :aria-label="t('撤销')" :title="t('撤销 · Ctrl+Z')" @click="editor?.chain().focus().undo().run()"><Undo2 :size="16" /></button><button class="icon-btn" :aria-label="t('重做')" :title="t('重做 · Ctrl+Shift+Z')" @click="editor?.chain().focus().redo().run()"><Redo2 :size="16" /></button></div>
      <span v-if="plain" class="plain-mode-label">{{t('纯文本')}}</span><div v-if="!plain" class="tools-group format-tools">
        <div class="style-menu-wrap"><button class="style-trigger" :aria-label="t('段落样式')" :aria-expanded="styleMenu" :title="t('段落样式')" @mousedown.prevent @click="styleMenu = !styleMenu"><span>{{ t(blockType === 'paragraph' ? '正文' : '标题 ' + blockType.slice(1)) }}</span><ChevronDown :size="13" /></button>
          <section v-if="styleMenu" class="style-popover" role="menu" :aria-label="t('段落样式')" @keydown.esc.stop="styleMenu = false">
            <button v-for="item in styleOptions" :key="item.value" role="menuitem" :class="{ chosen: blockType === item.value }" @mousedown.prevent @click="chooseStyle(item.value)"><component :is="item.icon" :size="14" /><span>{{ t(item.label) }}</span><Check v-if="blockType === item.value" :size="14" /></button>
          </section>
        </div>
        <button class="icon-btn" :class="{ selected: active('bold') }" :aria-label="t('加粗')" :title="t('加粗 · Ctrl+B')" @mousedown.prevent @click="editor?.chain().focus().toggleBold().run()"><Bold :size="16" /></button>
        <button class="icon-btn" :class="{ selected: active('italic') }" :aria-label="t('斜体')" :title="t('斜体 · Ctrl+I')" @mousedown.prevent @click="editor?.chain().focus().toggleItalic().run()"><Italic :size="16" /></button>
        <button class="icon-btn optional" :class="{ selected: active('strike') }" :aria-label="t('删除线')" :title="t('删除线')" @mousedown.prevent @click="editor?.chain().focus().toggleStrike().run()"><Strikethrough :size="16" /></button>
      </div>
      <div v-if="!plain" class="tools-group insert-tools">
        <button class="icon-btn" :class="{ selected: active('bulletList') }" :aria-label="t('无序列表')" :title="t('无序列表')" @mousedown.prevent @click="editor?.chain().focus().toggleBulletList().run()"><List :size="18" /></button>
        <button class="icon-btn" :class="{ selected: active('orderedList') }" :aria-label="t('有序列表')" :title="t('有序列表')" @mousedown.prevent @click="editor?.chain().focus().toggleOrderedList().run()"><ListOrdered :size="18" /></button>
        <button class="icon-btn optional" :class="{ selected: active('blockquote') }" :aria-label="t('引用')" :title="t('引用')" @mousedown.prevent @click="editor?.chain().focus().toggleBlockquote().run()"><Quote :size="16" /></button>
        <button class="icon-btn optional" :class="{ selected: active('codeBlock') }" :aria-label="t('代码块')" :title="t('代码块')" @mousedown.prevent @click="editor?.chain().focus().toggleCodeBlock().run()"><Code2 :size="17" /></button>
        <button class="icon-btn" :aria-label="t('插入表格')" :title="t('插入表格')" @mousedown.prevent @click="editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()"><Table2 :size="16" /></button>
        <button class="icon-btn" :aria-label="t('插入图片')" :title="t('插入图片，也可直接粘贴截图')" @click="imageInput?.click()"><ImagePlus :size="17" /></button>
      </div>
      <div class="toolbar-end"><button class="text-btn view-mode-btn" :aria-label="t('连续模式')" :aria-pressed="viewMode === 'continuous'" :class="{selected:viewMode === 'continuous'}" :title="t('连续 / A4 分页切换')" @click="viewMode = viewMode === 'pages' ? 'continuous' : 'pages'"><AlignLeft :size="15" /><span>{{t(viewMode === 'continuous' ? '连续' : '分页')}}</span></button>
        <div class="writing-menu"><button class="icon-btn" :class="{selected:writing.focus || writing.typewriter}" :aria-label="t('写作模式')" :title="t('写作模式 · F8 / F9')" :aria-expanded="writingMenu" @click="writingMenu = !writingMenu"><Focus :size="17" /></button>
          <section v-if="writingMenu" class="writing-popover" role="menu" :aria-label="t('写作模式')" @keydown.esc.stop="writingMenu = false">
            <button role="menuitemcheckbox" :aria-checked="writing.focus" @click="toggleWriting('focus')"><span><strong>{{t('专注模式')}}</strong><small>{{t('突出当前段落或内容块')}}</small></span><kbd>F8</kbd><Check v-if="writing.focus" :size="16" /></button>
            <button role="menuitemcheckbox" :aria-checked="writing.typewriter" @click="toggleWriting('typewriter')"><span><strong>{{t('打字机模式')}}</strong><small>{{t('让输入行保持在视区中部')}}</small></span><kbd>F9</kbd><Check v-if="writing.typewriter" :size="16" /></button>
            <button class="auto-pair-toggle" role="menuitemcheckbox" :aria-checked="autoPair" @click="autoPair=!autoPair"><span><strong>{{t('自动配对')}}</strong><small>{{t('括号、引号与 Markdown 标记')}}</small></span><Check v-if="autoPair" :size="16" /></button>
          </section>
        </div>
        <ImageResize v-if="editor&&!plain" :editor="editor" /><TextMenu v-if="editor&&!plain" ref="textTools" :editor="editor" /><BlockControls v-if="editor&&!plain" :editor="editor" />
        <span class="tool-divider" aria-hidden="true"></span>
        <button class="icon-btn" :aria-label="t('查找与替换')" :title="t('查找 Ctrl+F · 替换 Ctrl+H')" @click="openFind(true)"><Search :size="17" /></button>
        <button v-if="!plain" class="icon-btn" :aria-label="t('插入分页符')" :title="t('插入分页符 · Ctrl+Enter')" :disabled="active('table')" @mousedown.prevent @click="insertPageBreak"><FileInput :size="17" /></button>
        <span class="tool-divider" aria-hidden="true"></span>
        <button class="icon-btn" :aria-label="t('文件历史')" :title="t('文件历史')" :disabled="busy" @click="openHistory"><History :size="17" /></button>
        <button class="icon-btn" :aria-label="t('从磁盘重新加载')" :title="t('从磁盘重新加载 · Ctrl+R')" :disabled="!path || busy" @click="reloadFromDisk"><RotateCw :size="16" /></button>
        <span class="tool-divider" aria-hidden="true"></span>
        <button v-if="!plain" class="icon-btn source-btn" :aria-label="t('源码')" :title="t('查看与编辑 Markdown 源码')" @click="openSource"><Braces :size="17" /></button><button class="icon-btn page-settings-btn" :aria-label="t('页面设置')" :title="t('页面设置')" :class="{ selected: settings }" @click="settings = !settings"><SlidersHorizontal :size="17" /></button>
        <button class="icon-btn help-action" :title="t('使用帮助')" :aria-label="t('使用帮助')" @click="showHelp = true"><CircleHelp :size="17" /></button>
      </div>
    </div>
    <aside class="outline-panel"><div class="sidebar-switch"><button :class="{selected:sidebarPane==='files'}" @click="sidebarPane='files'">{{t('文件')}}</button><button :class="{selected:sidebarPane==='outline'}" @click="sidebarPane='outline'">{{t('大纲')}}</button></div><FilePanel ref="filePanel" :rename-file="renameFile" :busy="busy" @new-document="newDocument()" v-show="sidebarPane==='files'" :tabs="tabs.map(tab=>({id:tab.id,label:tabLabel(tab),path:tab.path,dirty:tab.dirty}))" :active-id="activeId" :active-path="path" @open="openLibraryFile" @hit="openSearchHit" @error="report" @close="id=>closeTabs([id])" @save-all="saveAll"/><template v-if="sidebarPane==='outline'">
      <div class="outline-heading"><AlignLeft :size="15" /><span>{{ t('文档大纲') }}</span><span class="heading-count">{{ headings.length }}</span></div>
      <nav :aria-label="t('文档大纲')"><button v-for="heading in headings" :key="heading.pos" :class="['outline-item', { active: selectedHeading === heading.pos }]" :style="{ paddingLeft: `${16 + (heading.level - 1) * 14}px` }" @click="jump(heading.pos)"><span :class="`outline-level level-${heading.level}`"></span><span>{{ heading.text }}</span></button><p v-if="plain" class="outline-empty">{{t('纯文本不生成标题大纲。')}}</p><p v-else-if="!headings.length" class="outline-empty">{{ t('添加标题后，') }}<br>{{ t('会在这里显示文档结构。') }}</p></nav>
    </template></aside>
    <main ref="scroller" class="canvas" @click.self="settings = false">
      <div v-if="currentTab.diskChanged || currentTab.diskMissing" class="external-change-bar" role="status"><span>{{ t(currentTab.diskMissing ? '文件已移走或删除，当前内容仍保留。保存可重建文件。' : '文件已在外部修改，当前编辑仍保留。') }}</span><button v-if="!currentTab.diskMissing" class="text-btn" @click="reloadFromDisk">{{ t('重新加载') }}</button><button class="text-btn" @click="save(true)">{{ t('另存为') }}</button><button class="icon-btn" :aria-label="t('暂时保留当前内容')" @click="ignoreExternal"><X :size="15" /></button></div>
      <div class="canvas-meta" :class="{ 'table-meta': tableContext }" :style="{ maxWidth: `${paper.width}px` }"><TableControls v-if="editor && tableContext" ref="tableTools" :editor="editor" :context="tableContext" /><ImageControls v-else-if="editor && active('image')" :editor="editor" :version="version" @replace="beginImageReplacement" /><template v-else><span><span class="live-dot"></span>{{ t(viewMode === 'continuous' ? '连续编辑' : '分页编辑') }}</span><span><template v-if="viewMode==='pages'">A4 <span class="meta-separator">/</span></template> {{ viewMode === 'continuous' ? t('不分页') : mixed ? t('横竖混排') : layout.orientation === 'landscape' ? '297 × 210' : '210 × 297' }}{{ mixed || viewMode === 'continuous' ? '' : ' mm' }}</span></template></div>
      <div class="paper-zoom" :style="{ zoom: effectiveZoom, width: `${paper.width}px` }"><EditorContent v-if="editor" :editor="editor" :style="{...documentStyle,'--continuous-width':`${paper.width}px`}" /></div>
      <div class="canvas-tail"><span>{{ t('文稿到这里，想法还可以继续。') }}</span></div>
    </main>
    <footer class="status-bar"><span class="status-save" role="status" :title="busy ? t(automaticSaving?'正在自动保存…':'正在处理文稿…') : toast || recoveryStatus"><Check v-if="!dirty || toast" :size="13" /><span class="status-dot" v-else></span>{{ t(busy ? (automaticSaving?'正在自动保存…':'正在处理文稿…') : toast || recoveryStatus || (dirty ? '尚未保存' : '就绪')) }}</span><div class="status-middle"><span>{{ viewMode === 'continuous' ? t('连续模式') : t(`第 ${currentPage} 页，共 ${pageCount} 页`) }}</span><i></i><span>{{ wordCount.toLocaleString() }}{{ t(' 字') }}</span></div><div class="zoom-controls"><button :aria-label="t('缩小')" @click="changeZoom(-10)"><Minus :size="13" /></button><button class="zoom-number" @click="fit = !fit" :title="t(fit ? '点击切换到 100%' : '点击适合窗口')">{{ t(fit ? '适合窗口' : `${zoom}%`) }}</button><button :aria-label="t('放大')" @click="changeZoom(10)"><Plus :size="13" /></button><button :aria-label="t('适合窗口')" :title="t('适合窗口')" @click="fit = true"><Maximize2 :size="13" /></button></div></footer>
    <Transition name="popover"><section v-if="settings" class="settings-panel" :aria-label="t('页面设置')">
      <header><div><strong>{{ t('页面设置') }}</strong><p>{{ t('调整后，分页会自动更新。') }}</p></div><button class="icon-btn" :aria-label="t('关闭页面设置')" @click="settings = false"><X :size="16" /></button></header>
      <div class="paper-size-row"><FileText :size="24" /><div><strong>A4</strong><span>{{ t(layout.orientation === 'landscape' ? '297 × 210 mm · 横向' : '210 × 297 mm · 纵向') }}</span></div><Check :size="16" /></div>
      <label>{{ t('默认方向') }}<select :aria-label="t('纸张方向')" v-model="layout.orientation" @change="currentTab.baseOrientation = layout.orientation; dirty = true; scheduleDraft()"><option value="portrait">{{ t('纵向 · 210 × 297 mm') }}</option><option value="landscape">{{ t('横向 · 297 × 210 mm') }}</option></select></label>
      <div class="settings-columns"><label>{{ t('指定页面') }}<select :aria-label="t('指定页面')" v-model.number="settingPage"><option v-for="n in pageCount" :key="n" :value="n">{{ n }}</option></select></label><label>{{ t('本页方向') }}<select :aria-label="t('本页方向')" v-model="pageDirection"><option value="">{{ t('跟随默认') }}</option><option value="portrait">{{ t('纵向') }}</option><option value="landscape">{{ t('横向') }}</option></select></label></div>
      <label>{{ t('正文字体') }}<select :aria-label="t('正文字体')" v-model="layout.font"><option value="sans">{{ t('微软雅黑 / 系统黑体') }}</option><option value="serif">{{ t('宋体 / 系统衬线') }}</option></select></label>
      <div class="settings-columns"><label>{{ t('字号') }}<select :aria-label="t('字号')" v-model.number="layout.fontSize"><option v-for="size in [14,16,18,20]" :value="size">{{ size }} px</option></select></label><label>{{ t('行距') }}<select :aria-label="t('行距')" v-model.number="layout.lineHeight"><option v-for="line in [1.5,1.8,2]" :value="line">{{ line }}{{ t(' 倍') }}</option></select></label></div>
      <label>{{ t('四周页边距') }}<select :aria-label="t('页边距')" v-model.number="layout.margin"><option v-for="margin in [15,20,25,30]" :value="margin">{{ margin }} mm{{ t(margin === 20 ? ' · 标准' : '') }}</option></select></label><button class="reset-btn" @click="layout = { ...DEFAULT_LAYOUT }">{{ t('恢复默认排版') }}</button>
      <label class="checkbox-row"><input type="checkbox" v-model="layout.repeatTableHeaders" :aria-label="t('跨页重复表头')">{{ t('跨页重复表头') }}</label>
      <details class="print-settings"><summary>{{t('打印页眉与页脚')}}</summary><p>{{t('在打印预览、打印和 PDF 中生效')}}</p><div class="settings-columns"><label>{{t('页眉左侧')}}<input :aria-label="t('页眉左侧')" maxlength="160" v-model="printSettings.headerLeft"></label><label>{{t('页眉右侧')}}<input :aria-label="t('页眉右侧')" maxlength="160" v-model="printSettings.headerRight"></label></div><div class="settings-columns"><label>{{t('页脚左侧')}}<input :aria-label="t('页脚左侧')" maxlength="160" v-model="printSettings.footerLeft"></label><label>{{t('页脚右侧')}}<input :aria-label="t('页脚右侧')" maxlength="160" v-model="printSettings.footerRight"></label></div><p class="print-variables">{title} · {page} / {pages} · {date}</p><label class="checkbox-row"><input type="checkbox" v-model="printSettings.bookmarks">{{t('从标题生成 PDF 书签')}}</label></details>
    </section></Transition>
    <div v-if="error" class="error-message" role="alert"><span>{{ t(error) }}</span><button :aria-label="t('关闭错误提示')" @click="error = ''"><X :size="16" /></button></div>
    <Teleport to="body"><div v-if="tabMenu" class="tab-context-menu" role="menu" :aria-label="t('标签操作')" :style="{ left: `${tabMenu.left}px`, top: `${tabMenu.top}px` }"><button role="menuitem" @click="newFileBeside(tabMenu.id)">{{t('新建文件')}}</button><button role="menuitem" @click="renameTab(tabMenu.id)">{{t('重命名')}}<kbd>F2</kbd></button><hr><button role="menuitem" @click="save(false, tabMenu.id)">{{ t('保存当前标签') }}</button><button role="menuitem" @click="save(true, tabMenu.id)">{{ t('另存为…') }}</button><button role="menuitem" @click="saveAll">{{ t('全部保存') }}</button><hr><button role="menuitem" @click="closeTabs([tabMenu.id])">{{ t('关闭此标签') }}</button><button role="menuitem" :disabled="tabs.length < 2" @click="closeTabs(tabs.filter(tab => tab.id !== tabMenu!.id).map(tab => tab.id))">{{ t('关闭其他标签') }}</button><button role="menuitem" @click="closeTabs(tabs.map(tab => tab.id))">{{ t('关闭全部标签') }}</button></div></Teleport>
    <div v-if="closeDialog" class="modal-backdrop close-backdrop"><section class="close-modal" role="dialog" aria-modal="true" :aria-label="t('保存后关闭文稿')"><h2>{{ t('保存修改后再关闭？') }}</h2><p>{{ closeDialog.tabs.length }}{{ t(' 份文稿尚未保存到文件。') }}</p><ul><li v-for="tab in closeDialog.tabs.slice(0, 8)" :key="tab.id">{{ tabLabel(tab) }}</li><li v-if="closeDialog.tabs.length > 8">{{ t('以及另外 ') }}{{ closeDialog.tabs.length - 8 }}{{ t(' 份文稿') }}</li></ul><footer><button class="text-btn" @click="chooseClose('discard')">{{ t('放弃修改') }}</button><div><button class="text-btn" @click="chooseClose('cancel')">{{ t('取消') }}</button><button class="primary-btn" @click="chooseClose('save')">{{ t('保存并关闭') }}</button></div></footer></section></div>
    <FindPanel v-if="find && editor" ref="findPanel" :editor="editor" :replace="find.replace" @close="closeFind" />
    <QuickOpen v-if="quickOpen" :tabs="tabs.map(tab=>({id:tab.id,label:tabLabel(tab),path:tab.path,handleKey:tab.handleKey}))" @close="quickOpen=false; editor?.view.focus()" @open="openLibraryFile" @error="report"/><HistoryPanel v-if="historyDialog" v-bind="historyDialog" @close="historyDialog = null" @restore="restoreVersion" />
    <div v-if="reloadCandidate" class="modal-backdrop history-backdrop"><section class="reload-modal" role="dialog" aria-modal="true" :aria-label="t('重新加载磁盘版本')"><header><h2>{{ t('重新加载磁盘版本') }}</h2><button class="icon-btn" :aria-label="t('取消重新加载')" @click="reloadCandidate = null"><X :size="17" /></button></header><p>{{ t('当前有未保存的修改。重新加载时，会把当前内容保留到另一个标签。') }}</p><div class="reload-comparison"><label>{{ t('当前未保存稿') }}<textarea readonly :value="reloadCandidate.current" :aria-label="t('当前未保存稿')"></textarea></label><label>{{ t('磁盘版本') }}<textarea readonly :value="reloadCandidate.doc.content" :aria-label="t('磁盘版本')"></textarea></label></div><footer><button class="text-btn" @click="reloadCandidate = null">{{ t('取消') }}</button><button class="primary-btn" :disabled="busy" @click="confirmReload">{{ t('保留草稿并重新加载') }}</button></footer></section></div>
    <SlashMenu :menu="slash" />
    <div v-if="showHelp || sourceOpen" class="modal-backdrop" @click.self="showHelp = false">
      <section v-if="showHelp" class="help-modal" role="dialog" aria-modal="true" :aria-label="t('使用帮助')"><header><div class="app-mark"><FileText :size="21" /></div><h2>{{ '页然 · Yeran' }}</h2><button class="icon-btn" :aria-label="t('关闭帮助')" @click="showHelp = false"><X :size="18" /></button></header><p><strong>{{ t('所见即所得的 Markdown 分页编辑器') }}</strong><br>{{ t('像 Word 一样排版，像 Typora 一样写作。') }}</p><dl><div><dt>{{ t('新建 / 打开文稿') }}</dt><dd>Ctrl + N / Ctrl + O</dd></div><div><dt>{{ t('快速打开 / 全部保存') }}</dt><dd>Ctrl + Shift + O / Ctrl + Shift + S</dd></div><div><dt>{{ t('保存 / 关闭标签') }}</dt><dd>Ctrl + S / Ctrl + W</dd></div><div><dt>{{ t('查找 / 替换') }}</dt><dd>Ctrl + F / Ctrl + H</dd></div><div><dt>{{ t('打印 / 导出 PDF') }}</dt><dd>Ctrl + P / Ctrl + Shift + E</dd></div><div><dt>{{ t('加粗 / 斜体 / 标红') }}</dt><dd>Ctrl + B / Ctrl + I / Ctrl + E</dd></div><div><dt>{{ t('正文 / 标题 1–6') }}</dt><dd>Ctrl + 0 / Ctrl + 1–6</dd></div><div><dt>{{ t('代码块 / 公式块 / 引用') }}</dt><dd>Ctrl + Shift + K / M / Q</dd></div><div><dt>{{ t('插入表格 / 清除格式') }}</dt><dd>Ctrl + T / Ctrl + \</dd></div><div><dt>{{ t('分页符 / 从磁盘重新加载') }}</dt><dd>Ctrl + Enter / Ctrl + R</dd></div><div><dt>{{ t('专注模式 / 打字机模式') }}</dt><dd>F8 / F9</dd></div></dl><p class="help-note">{{ t('右键标签可另存为、关闭其他或关闭全部。正文保存为 Markdown。恢复草稿保存在本机，不能替代文件备份。图片可粘贴，或从工具栏插入。') }}</p><button class="primary-btn" @click="showHelp = false">{{ t('继续写作') }}</button></section>
      <section v-if="sourceOpen" class="source-modal" role="dialog" aria-modal="true" :aria-label="t('Markdown 源码')"><header><h2><Braces :size="18" />{{ t('Markdown 源码') }}</h2><button class="icon-btn" :aria-label="t('取消源码修改')" @click="sourceOpen = false"><X :size="18" /></button></header><textarea :aria-label="t('Markdown 源码内容')" v-model="sourceValue" spellcheck="false"></textarea><footer><span>{{ t('应用后会重新排版全文。') }}</span><button class="text-btn" @click="sourceOpen = false">{{ t('取消') }}</button><button class="primary-btn" @click="applySource">{{ t('应用修改') }}</button></footer></section>
    </div>
    <input ref="imageInput" class="visually-hidden" type="file" accept="image/*" @cancel="imageReplacement=null" @change="insertImage(($event.target as HTMLInputElement).files?.[0])">
  </div>
</template>
