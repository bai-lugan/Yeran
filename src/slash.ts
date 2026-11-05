import { computed, ref } from 'vue'
import type { Editor } from '@tiptap/core'
import type { EditorView } from '@tiptap/pm/view'
import { t } from './i18n'
import {insertFootnote}from'./markdown-basics'

export const BLOCKS = [
  { id: 'h1', label: '标题 1', description: '文稿的大标题', keys: 'biaoti heading h1 title', icon: 'h1' },
  { id: 'h2', label: '标题 2', description: '划分章节', keys: 'biaoti heading h2 title', icon: 'h2' },
  { id: 'h3', label: '标题 3', description: '较小的章节标题', keys: 'biaoti heading h3 title', icon: 'h3' },
  { id: 'paragraph', label: '正文', description: '普通文本段落', keys: 'zhengwen text paragraph', icon: 'text' },
  { id: 'bulletList', label: '无序列表', description: '按条目整理想法', keys: 'wuxu liebiao bullet list', icon: 'list' },
  { id: 'orderedList', label: '有序列表', description: '有顺序的步骤', keys: 'youxu liebiao ordered number list', icon: 'ordered' },
  { id: 'blockquote', label: '引用', description: '突出一段引文', keys: 'yinyong quote', icon: 'quote' },
  { id: 'codeBlock', label: '代码块', description: '等宽字体的代码段落', keys: 'daima code', icon: 'code' },
  { id: 'mermaid', label: 'Mermaid 图表', description: '用代码绘制流程图与时序图', keys: 'mermaid chart diagram liuchengtu tuxing', icon: 'code' },
  { id: 'table', label: '表格', description: '插入 3 × 3 表格', keys: 'biaoge table', icon: 'table' },
  { id: 'image', label: '图片', description: '从本机选择图片', keys: 'tupian image photo', icon: 'image' },
  { id: 'horizontalRule', label: '分隔线', description: '在段落之间分隔', keys: 'fengexian divider hr line', icon: 'line' },
  { id: 'toggleBlock', label: '折叠块', description: '展开或收起一段内容', keys: 'zhedie toggle details collapse', icon: 'quote' },
  { id: 'mathBlock', label: '公式块', description: '用 LaTeX 排版公式', keys: 'gongshi math equation latex', icon: 'code' },
  { id: 'taskList', label: '待办列表', description: '带复选框的事项清单', keys: 'daiban task todo checklist', icon: 'list' },
  {id:'inlineMath',label:'行内公式',description:'在文字中插入公式',keys:'hangnei inline math latex',icon:'code'},
  {id:'footnote',label:'脚注',description:'插入脚注引用和说明',keys:'jiaozhu footnote',icon:'text'},
  {id:'tableOfContents',label:'目录',description:'自动列出文稿标题',keys:'mulu toc contents',icon:'list'},
  {id:'callout',label:'提示块',description:'提示、警告或说明',keys:'tishi callout alert note',icon:'quote'},
  { id: 'pageBreak', label: '分页符', description: '从下一张纸继续', keys: 'fenye page break', icon: 'line' },
] as const
export function useSlashMenu(getEditor: () => Editor | undefined, insertImage: () => void) {
  const state = ref<{ from: number; to: number; query: string; left: number; top: number; inTable: boolean; button: boolean } | null>(null)
  const selected = ref(0)
  let dismissed = '',buttonAt:number|undefined
  const items = computed(() => {
    const query = state.value?.query.toLowerCase() || ''
    return BLOCKS.filter(item => (!state.value?.inTable || ['paragraph','image','inlineMath','footnote'].includes(item.id)) && `${item.label} ${t(item.label)} ${item.keys}`.toLowerCase().includes(query))
  })
  function close() { if (state.value) dismissed = `${state.value.from}/${state.value.query}`;buttonAt=undefined;state.value = null }
  function reset() { dismissed = '';buttonAt=undefined;state.value = null }
  function openAtSelection(){const ed=getEditor();if(!ed||ed.state.selection.$from.parent.type.name!=='paragraph')return;buttonAt=ed.state.selection.$from.start();dismissed='';refresh()}
  function refresh() {
    const editor = getEditor()
    if (!editor || editor.isDestroyed || !editor.isFocused || editor.view.composing) { state.value = null; return }
    const { empty, $from, from } = editor.state.selection
    if (!empty || $from.parent.type.name !== 'paragraph' || editor.isActive('codeBlock')) { state.value = null; return }
    const text = $from.parent.textBetween(0, $from.parentOffset, '\n', '\ufffc')
    const button=buttonAt===$from.start(),match=button?/^([^\s/]{0,24})$/u.exec(text):/^\/([^\s/]{0,24})$/u.exec(text)
    if (!match) { reset(); return }
    if (dismissed === `${$from.start()}/${match[1]}`) { state.value = null; return }
    const previous = state.value
    const rect = editor.view.coordsAtPos(from)
    const height = Math.min(370, window.innerHeight - 40)
    const below = window.innerHeight - rect.bottom - 12
    const top = below >= height ? rect.bottom + 7 : Math.max(12, rect.top - height - 8)
    state.value = { from: $from.start(), to: from, query: match[1], left: Math.max(12, Math.min(rect.left, window.innerWidth - 310)), top, inTable: editor.isActive('table'),button }
    if (!previous || previous.query !== match[1] || previous.from !== state.value.from) selected.value = 0
  }
  function execute(index = selected.value) {
    const editor = getEditor(), range = state.value, item = items.value[index]
    if (!editor || !range || !item) return
    if (editor.state.doc.textBetween(range.from, range.to) !== `${range.button?'':'/'}${range.query}`) { close(); return }
    state.value = null; dismissed = '';buttonAt=undefined
    const chain = editor.chain().focus().deleteRange({ from: range.from, to: range.to })
    if (item.id === 'h1' || item.id === 'h2' || item.id === 'h3') chain.setHeading({ level: Number(item.id[1]) as 1 | 2 | 3 }).run()
    else if (item.id === 'paragraph') chain.setParagraph().run()
    else if (item.id === 'bulletList') chain.toggleBulletList().run()
    else if (item.id === 'orderedList') chain.toggleOrderedList().run()
    else if (item.id === 'blockquote') chain.toggleBlockquote().run()
    else if (item.id === 'codeBlock') chain.toggleCodeBlock().run()
    else if (item.id === 'mermaid') chain.insertContent([{type:'codeBlock',attrs:{language:'mermaid'},content:[{type:'text',text:'flowchart LR\n  A[开始] --> B[完成]'}]},{type:'paragraph'}]).run()
    else if (item.id === 'table') chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
    else if (item.id === 'horizontalRule') chain.setHorizontalRule().run()
    else if (item.id === 'pageBreak') chain.insertContent([{ type: 'pageBreak' }, { type: 'paragraph' }]).run()
    else if (item.id === 'mathBlock') chain.insertContent({ type: 'mathBlock', attrs: { latex: 'E=mc^2' } }).run()
    else if(item.id==='inlineMath')chain.insertContent({type:'inlineMath',attrs:{latex:'x^2'}}).run()
    else if(item.id==='footnote'){chain.run();insertFootnote(editor)}
    else if(item.id==='tableOfContents')chain.insertContent([{type:'tableOfContents'},{type:'paragraph'}]).run()
    else if(item.id==='callout')chain.insertContent({type:'callout',attrs:{kind:'NOTE'},content:[{type:'paragraph'}]}).run()
    else if (item.id === 'taskList') chain.toggleTaskList().run()
    else if (item.id === 'toggleBlock') chain.insertContent({ type: 'toggleBlock', content: [{ type: 'toggleSummary', content: [{ type:'text',text:t('折叠标题') }] }, { type: 'toggleContent', content: [{ type:'paragraph' }] }] }).run()
    else { chain.run(); insertImage() }
  }
  function keyDown(_view: EditorView, event: KeyboardEvent) {
    if (event.isComposing || _view.composing) return false
    refresh()
    if (!state.value) return false
    if (event.key === 'Escape') { close(); return true }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (items.value.length) selected.value = (selected.value + (event.key === 'ArrowDown' ? 1 : -1) + items.value.length) % items.value.length
      return true
    }
    if (event.key === 'Enter' && items.value.length) { execute(); return true }
    return false
  }
  return { state, selected, items, refresh, close, reset, execute, keyDown, openAtSelection }
}
