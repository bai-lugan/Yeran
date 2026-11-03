import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table'
import { CellSelection, TableMap } from '@tiptap/pm/tables'
import { Plugin, PluginKey, NodeSelection, TextSelection } from '@tiptap/pm/state'
import { closeHistory } from '@tiptap/pm/history'
import { Fragment, Slice, DOMSerializer, type Schema, type Node as PMNode } from '@tiptap/pm/model'
import type { Editor } from '@tiptap/core'
import type { NodeView, ViewMutationRecord } from '@tiptap/pm/view'
import { t, locale } from './i18n'
import { watch } from 'vue'
import { colorValue } from './colors'

const TABLE_GRIP_ICON = '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><circle cx="5" cy="4" r="1.2"/><circle cx="11" cy="4" r="1.2"/><circle cx="5" cy="8" r="1.2"/><circle cx="11" cy="8" r="1.2"/><circle cx="5" cy="12" r="1.2"/><circle cx="11" cy="12" r="1.2"/></svg>'

export function tableContext(editor: Editor) {
  const selection = editor.state.selection
  if (selection instanceof NodeSelection && selection.node.type.name === 'table') {
    const table = selection.node, map = TableMap.get(table)
    return { table, pos: selection.from, map, cell: selection.from + 2, row: 1, column: 1, rows: map.height, columns: map.width, selected: map.width * map.height }
  }
  const $pos = selection instanceof CellSelection ? selection.$anchorCell : selection.$from
  let depth = $pos.depth
  while (depth > 0 && $pos.node(depth).type.name !== 'table') depth--
  if (!depth) return null
  const table = $pos.node(depth), pos = $pos.before(depth), map = TableMap.get(table)
  let cell = selection instanceof CellSelection ? selection.$anchorCell.pos : -1
  if (cell < 0) for (let d = $pos.depth; d > depth; d--) {
    if (['tableCell', 'tableHeader'].includes($pos.node(d).type.name)) { cell = $pos.before(d); break }
  }
  if (cell < 0) return null
  const rect = map.findCell(cell - pos - 1)
  let selected = 1
  if (selection instanceof CellSelection) { selected = 0; selection.forEachCell(() => selected++) }
  return { table, pos, map, cell, row: rect.top + 1, column: rect.left + 1, rows: map.height, columns: map.width, selected }
}

export type TableSelectionKind = 'row' | 'column' | null
const tableSelectionKey = new PluginKey<TableSelectionKind>('yeranTableSelection')
export function selectTable(editor: Editor, pos = tableContext(editor)?.pos) {
  if (typeof pos !== 'number') return false
  editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, pos))); editor.view.focus(); return true
}
export function selectTableRow(editor: Editor, tablePos: number, rowIndex: number) {
  const table = editor.state.doc.nodeAt(tablePos)
  if (!table || table.type.name !== 'table' || rowIndex < 0 || rowIndex >= table.childCount) return false
  let rowPos = tablePos + 1
  for (let i = 0; i < rowIndex; i++) rowPos += table.child(i).nodeSize
  let lastCell = rowPos + 1
  const row = table.child(rowIndex)
  for (let i = 0; i < row.childCount - 1; i++) lastCell += row.child(i).nodeSize
  const selection = CellSelection.rowSelection(editor.state.doc.resolve(rowPos + 1), editor.state.doc.resolve(lastCell))
  editor.view.dispatch(editor.state.tr.setSelection(selection).setMeta(tableSelectionKey, 'row')); editor.view.focus(); return true
}
export function selectTableColumn(editor: Editor, tablePos: number, columnIndex: number) {
  const table = editor.state.doc.nodeAt(tablePos)
  if (!table || table.type.name !== 'table') return false
  const map = TableMap.get(table)
  if (columnIndex < 0 || columnIndex >= map.width) return false
  const start = tablePos + 1
  const top = map.map[columnIndex]
  const bottom = map.map[(map.height - 1) * map.width + columnIndex]
  if (typeof top !== 'number' || typeof bottom !== 'number') return false
  const selection = CellSelection.colSelection(editor.state.doc.resolve(start + top), editor.state.doc.resolve(start + bottom))
  editor.view.dispatch(editor.state.tr.setSelection(selection).setMeta(tableSelectionKey, 'column')); editor.view.focus(); return true
}
// Merged cells would need a layout rewrite rather than a reorder, so both moves
// stay disabled until every cell is a plain 1 × 1 cell again.
export function hasMergedCells(table: PMNode) {
  let merged = false
  table.descendants(node => {
    if (node.type.name === 'tableCell' || node.type.name === 'tableHeader') {
      if ((node.attrs.colspan || 1) > 1 || (node.attrs.rowspan || 1) > 1) merged = true
    }
  })
  return merged
}
export function tableAction(editor:Editor,action:'appendRow'|'appendColumn'|'duplicateRow'|'duplicateColumn'|'fit'|'clear',pos=tableContext(editor)?.pos,index?:number){
  if(typeof pos!=='number')return false
  const table=editor.state.doc.nodeAt(pos);if(!table||table.type.name!=='table')return false
  const context=tableContext(editor),map=TableMap.get(table),rows:PMNode[]=[];table.forEach(row=>rows.push(row))
  const at=index??(action==='duplicateRow'?(context?.row||1)-1:(context?.column||1)-1)
  if(action==='fit'){editor.view.dispatch(closeHistory(editor.state.tr).setNodeMarkup(pos,undefined,{...table.attrs,columnSize:''}));return true}
  if(action==='clear'){
    const targets=new Set<number>(),selection=editor.state.selection
    if(selection instanceof CellSelection)selection.forEachCell((_node,at)=>targets.add(at))
    else if(selection instanceof NodeSelection)map.map.forEach(at=>targets.add(pos+1+at))
    else if(context)targets.add(context.cell)
    const tr=closeHistory(editor.state.tr);for(const at of [...targets].sort((a,b)=>b-a)){const node=editor.state.doc.nodeAt(at);if(node)tr.replaceWith(at+1,at+node.nodeSize-1,editor.schema.nodes.paragraph!.create())}editor.view.dispatch(tr);return true
  }
  if(action.startsWith('duplicate')&&hasMergedCells(table))return false
  const empty=(header=false)=>editor.schema.nodes[header?'tableHeader':'tableCell']!.createAndFill()!
  let widths=String(table.attrs.columnSize||'').split(',').map(Number)
  if(action==='appendRow')rows.push(editor.schema.nodes.tableRow!.create(null,Array.from({length:map.width},()=>empty())))
  if(action==='duplicateRow'){if(!rows[at])return false;let copy=rows[at]!;if(at===0){const cells:PMNode[]=[];copy.forEach(cell=>cells.push(editor.schema.nodes.tableCell!.create(cell.attrs,cell.content)));copy=copy.copy(Fragment.fromArray(cells))}rows.splice(at+1,0,copy)}
  if(action==='appendColumn'||action==='duplicateColumn'){
    if(action==='duplicateColumn'&&(at<0||at>=map.width))return false
    for(let i=0;i<rows.length;i++){const cells:PMNode[]=[];rows[i]!.forEach(cell=>cells.push(cell));if(action==='appendColumn')cells.push(empty(i===0&&cells[0]?.type.name==='tableHeader'));else cells.splice(at+1,0,cells[at]!);rows[i]=rows[i]!.copy(Fragment.fromArray(cells))}
    if(widths.length===map.width&&widths.every(n=>n>0))widths.splice(action==='appendColumn'?map.width:at+1,0,action==='appendColumn'?100/map.width:widths[at]!);else widths=[]
  }
  const replacement=table.type.create({...table.attrs,columnSize:widths.length===TableMap.get(table).width+(action.includes('Column')?1:0)?widths.join(','):table.attrs.columnSize},Fragment.fromArray(rows))
  // Replacing the whole table otherwise maps a caret inside it to the paragraph
  // after it. Place the caret in the inserted cell before restoring focus.
  const nextMap=TableMap.get(replacement)
  const row=action==='appendRow'?nextMap.height-1:action==='duplicateRow'?at+1:Math.max(0,Math.min(index??(context?.row||1)-1,nextMap.height-1))
  const column=action==='appendColumn'?nextMap.width-1:action==='duplicateColumn'?at+1:Math.min((context?.column||1)-1,nextMap.width-1)
  const tr=closeHistory(editor.state.tr).replaceWith(pos,pos+table.nodeSize,replacement)
  const cell=pos+1+nextMap.map[row*nextMap.width+column]!
  editor.view.dispatch(tr.setSelection(TextSelection.near(tr.doc.resolve(cell+1))).scrollIntoView());editor.view.focus();return true
}
export function headerColumnEnabled(table:PMNode){return !!table.attrs.headerColumn||table.childCount>1&&Array.from({length:table.childCount-1},(_,i)=>table.child(i+1).firstChild?.type.name==='tableHeader').every(Boolean)}
export function toggleFirstHeaderColumn(editor:Editor){
 const c=tableContext(editor);if(!c||hasMergedCells(c.table))return false
 const enabled=!headerColumnEnabled(c.table),tr=closeHistory(editor.state.tr).setNodeMarkup(c.pos,undefined,{...c.table.attrs,headerColumn:enabled})
 let rowPos=c.pos+1;c.table.forEach((row,_offset,index)=>{const at=rowPos+1,node=row.firstChild!;const keepHeader=index===0&&Array.from({length:row.childCount},(_,i)=>row.child(i).type.name==='tableHeader').every(Boolean);const type=enabled||keepHeader?editor.schema.nodes.tableHeader!:editor.schema.nodes.tableCell!;if(node.type!==type)tr.setNodeMarkup(at,type,node.attrs);rowPos+=row.nodeSize})
 editor.view.dispatch(tr);editor.view.focus();return true
}
export function paintTableCells(editor:Editor,value:string,scope:'selection'|'row'|'column'='selection'){
 const c=tableContext(editor);if(!c)return false
 const selection=editor.state.selection,start=c.pos+1,rect=selection instanceof CellSelection?c.map.rectBetween(selection.$anchorCell.pos-start,selection.$headCell.pos-start):{left:c.column-1,right:c.column,top:c.row-1,bottom:c.row}
 if(scope==='row'){rect.left=0;rect.right=c.columns}else if(scope==='column'){rect.top=0;rect.bottom=c.rows}
 if(selection instanceof NodeSelection){rect.left=0;rect.right=c.columns;rect.top=0;rect.bottom=c.rows}
 const tr=closeHistory(editor.state.tr),background=colorValue(value)
 for(const at of c.map.cellsInRect(rect)){const node=c.table.nodeAt(at)!;tr.setNodeMarkup(start+at,undefined,{...node.attrs,background})}
 editor.view.dispatch(tr);editor.view.focus();return true
}
function styledTableHTML(json:any,schema:Schema){
 const copy=structuredClone(json);function portable(node:any){if(node.type==='image'&&node.attrs?.originalSrc)node.attrs.src=node.attrs.originalSrc;node.content?.forEach(portable)}portable(copy)
 const element=DOMSerializer.fromSchema(schema).serializeNode(schema.nodeFromJSON(copy)) as HTMLElement
 element.querySelector('colgroup')?.remove();return element.outerHTML
}
export function moveTableColumn(editor: Editor, tablePos: number, from: number, insertAt: number) {
  const table = editor.state.doc.nodeAt(tablePos)
  if (!table || table.type.name !== 'table' || hasMergedCells(table)) return false
  const width = TableMap.get(table).width
  if (from < 0 || from >= width) return false
  const target = Math.max(0, Math.min(insertAt, width)) - (insertAt > from ? 1 : 0)
  if (target === from) return false
  const rows: PMNode[] = []
  table.forEach(row => { const cells: PMNode[] = []; row.forEach(cell => cells.push(cell)); cells.splice(target, 0, cells.splice(from, 1)[0]!); rows.push(row.copy(Fragment.fromArray(cells))) })
  const widths = String(table.attrs.columnSize || '').split(',')
  if (widths.length === width) widths.splice(target, 0, widths.splice(from, 1)[0]!)
  const moved = table.type.create({...table.attrs, columnSize: widths.length === width ? widths.join(',') : table.attrs.columnSize}, Fragment.fromArray(rows))
  const tr = closeHistory(editor.state.tr).replaceWith(tablePos, tablePos + table.nodeSize, moved)
  editor.view.dispatch(tr); selectTableColumn(editor, tablePos, target); return true
}
export function moveTableRow(editor: Editor, tablePos: number, from: number, insertAt: number) {
  const table = editor.state.doc.nodeAt(tablePos)
  if (!table || table.type.name !== 'table' || from < 1 || from >= table.childCount) return false
  if (hasMergedCells(table)) return false
  const rows: PMNode[] = []; table.forEach(row => rows.push(row))
  const target = Math.max(1, Math.min(insertAt, rows.length)) - (insertAt > from ? 1 : 0)
  if (target === from) return false
  rows.splice(target, 0, rows.splice(from, 1)[0]!)
  const tr = closeHistory(editor.state.tr).replaceWith(tablePos, tablePos + table.nodeSize, table.copy(Fragment.fromArray(rows)))
  editor.view.dispatch(tr); selectTableRow(editor, tablePos, target); return true
}
function deleteTableSelection(editor: Editor) {
  const selection = editor.state.selection
  if (selection instanceof NodeSelection && selection.node.type.name === 'table') return editor.commands.deleteSelection()
  const kind = tableSelectionKey.getState(editor.state)
  if (!(selection instanceof CellSelection)) return false
  if (kind === 'row') return editor.commands.deleteRow()
  if (kind === 'column') return editor.commands.deleteColumn()
  return false
}

export function alignTableColumn(editor: Editor, align: 'left' | 'center' | 'right') {
  const context = tableContext(editor)
  if (!context) return false
  const { map, table, pos } = context
  const selection = editor.state.selection
  const rect = selection instanceof CellSelection
    ? map.rectBetween(selection.$anchorCell.pos - pos - 1, selection.$headCell.pos - pos - 1)
    : { left: context.column - 1, right: context.column }
  const cells = map.cellsInRect({ left: rect.left, right: rect.right, top: 0, bottom: map.height })
  const tr = editor.state.tr
  for (const cell of cells) { const node = table.nodeAt(cell); if (node) tr.setNodeMarkup(pos + 1 + cell, undefined, { ...node.attrs, align }) }
  editor.view.dispatch(tr)
  editor.commands.focus(undefined, { scrollIntoView: false })
  return true
}

export function leaveTable(editor: Editor) {
  const context = tableContext(editor)
  if (!context) return false
  const end = context.pos + context.table.nodeSize
  if (!editor.state.doc.nodeAt(end)?.isTextblock) editor.commands.insertContentAt(end, { type: 'paragraph' })
  editor.chain().focus().setTextSelection(end + 1).scrollIntoView().run()
  return true
}

export function readTableWidths(editor: Editor) {
  const widths: string[] = []
  editor.state.doc.descendants(node => { if (node.type.name === 'table') { widths.push(node.attrs.columnSize || ''); return false } })
  return widths
}
export function restoreTableWidths(editor: Editor, widths?: string[]) {
  if (!widths?.some(Boolean)) return
  const tr = editor.state.tr; let index = 0
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name !== 'table') return
    const value = widths[index++]
    if (value && value !== node.attrs.columnSize) tr.setNodeMarkup(pos, undefined, { ...node.attrs, columnSize: value })
    return false
  })
  if (tr.docChanged) editor.view.dispatch(tr.setMeta('addToHistory', false))
}

// The table keeps standard ProseMirror rows and editing plugins. Grid rows allow
// the pagination floats to move complete rows to the next sheet.
class PagedTableView implements NodeView {
  dom = document.createElement('div')
  contentDOM = document.createElement('table')
  private controls = document.createElement('div')
  private handles: HTMLElement[] = []
  private cancelDrag?: () => void
  private widths: number[] = []
  private rowHandle?: HTMLButtonElement
  private columnHandle?: HTMLButtonElement
  private hoveredRow = -1
  private hoveredColumn = -1
  private merged = false
  private rowFrame = 0
  private hideTimer?: ReturnType<typeof setTimeout>
  private observer: ResizeObserver
  private rowDrag?: { from: number; table: PMNode; insertAt: number; moved: boolean }
  private columnDrag?: { from: number; table: PMNode; insertAt: number; moved: boolean }
  private ghost?: HTMLElement
  private ghostAxis: 'row' | 'column' = 'row'
  private ghostOffset = 0
  private ghostAnchor?: {left:number;top:number;scrollLeft:number;scrollTop:number;canvas:HTMLElement|null}
  private hoveredCell?: HTMLElement
  private addRow=document.createElement('button')
  private addColumn=document.createElement('button')
  private dropLine = document.createElement('div')
  private columnDropLine = document.createElement('div')
  private unwatch: () => void
  private scrolled=(event:Event)=>{if((event.target as HTMLElement)?.contains?.(this.dom))this.scheduleRows()}
  constructor(private node: PMNode, private editor: Editor, private getPos: () => number | undefined) {
    this.dom.className = 'paged-table'
    this.contentDOM.className = 'table-plus'
    this.controls.className = 'table-resizers'
    this.controls.contentEditable = 'false'
    this.dom.append(this.contentDOM, this.controls)
    const tableHandle = document.createElement('button')
    tableHandle.className = 'table-block-handle'; tableHandle.innerHTML = '<svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="16" height="16" rx="2"/><path d="M2 8h16M8 2v16"/></svg>'; tableHandle.type = 'button'
    const labels = () => { tableHandle.title = t('选择整个表格，Delete / Backspace 删除'); tableHandle.setAttribute('aria-label', t('选择整个表格')); this.handles.forEach((handle,i) => handle.setAttribute('aria-label', t(`调整第 ${i+1} 列宽`))); this.labelRow(); this.labelColumn(); this.addRow.setAttribute('aria-label',t('在表格末尾添加行')); this.addColumn.setAttribute('aria-label',t('在表格末尾添加列')) }
    labels(); this.unwatch = watch(locale, labels)
    tableHandle.addEventListener('pointerdown', event => { event.preventDefault(); const pos = this.getPos(); if (typeof pos === 'number') selectTable(editor, pos) })
    // One shared row grip follows the hovered row, mirroring the single column grip.
    const rowHandle = document.createElement('button')
    rowHandle.type = 'button'; rowHandle.className = 'table-axis-handle table-row-handle'
    rowHandle.innerHTML = TABLE_GRIP_ICON
    rowHandle.hidden = true
    rowHandle.addEventListener('pointerdown', event => this.startRowDrag(event))
    rowHandle.addEventListener('keydown', event => {
      if (!event.altKey || !['ArrowUp', 'ArrowDown'].includes(event.key)) return
      event.preventDefault()
      const pos = this.getPos(), index = this.hoveredRow
      if (typeof pos === 'number' && index > 0) moveTableRow(this.editor, pos, index, index + (event.key === 'ArrowUp' ? -1 : 2))
    })
    this.rowHandle = rowHandle
    // One shared grip follows the hovered column instead of one grip per column.
    const columnHandle = document.createElement('button')
    columnHandle.type = 'button'; columnHandle.className = 'table-axis-handle table-column-handle'
    columnHandle.innerHTML = TABLE_GRIP_ICON
    columnHandle.hidden = true
    columnHandle.addEventListener('pointerdown', event => this.startColumnDrag(event))
    columnHandle.addEventListener('keydown', event => {
      if (!event.altKey || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return
      event.preventDefault()
      const pos = this.getPos(), index = this.hoveredColumn
      if (typeof pos === 'number' && index >= 0) moveTableColumn(this.editor, pos, index, index + (event.key === 'ArrowLeft' ? -1 : 2))
    })
    this.columnHandle = columnHandle
    for(const [button,axis]of [[this.addRow,'Row'],[this.addColumn,'Column']] as const){button.type='button';button.className=axis==='Row'?'table-add-row':'table-add-column';button.textContent='+';button.setAttribute('aria-label',t(axis==='Row'?'在表格末尾添加行':'在表格末尾添加列'));button.title=t(axis==='Row'?'在表格末尾添加行':'在表格末尾添加列');button.addEventListener('pointerdown',event=>{event.preventDefault();event.stopPropagation();this.showControls()});button.addEventListener('click',()=>tableAction(editor,axis==='Row'?'appendRow':'appendColumn',this.getPos(),axis==='Column'?Math.max(0,this.hoveredRow):undefined))}
    rowHandle.addEventListener('mouseenter', () => this.previewAxis('row', this.hoveredRow))
    columnHandle.addEventListener('mouseenter', () => this.previewAxis('column', this.hoveredColumn))
    for (const handle of [rowHandle,columnHandle]) handle.addEventListener('mouseleave', () => { if (!this.rowDrag && !this.columnDrag) this.clearAxisPreview() })
    this.dom.addEventListener('mousemove', event => this.trackPointer(event))
    // Like Notion, the top border itself is draggable: grab it anywhere over a column.
    this.dom.addEventListener('pointerdown', event => this.grabTableBorder(event))
    this.dom.addEventListener('mouseenter', () => this.showControls())
    // Bridge the small gap between the table edge and its external controls.
    // Leaving the table must not hide/move the button while approaching it.
    this.dom.addEventListener('mouseleave', () => {
      clearTimeout(this.hideTimer)
      this.hideTimer=setTimeout(()=>{if(!this.columnDrag&&!this.rowDrag){this.dom.classList.remove('table-controls-visible');this.hideGrips()}},220)
    })
    this.dropLine.className = 'table-row-drop-line'; this.dropLine.hidden = true
    this.columnDropLine.className = 'table-column-drop-line'; this.columnDropLine.hidden = true
    this.controls.append(tableHandle, rowHandle, columnHandle, this.addRow, this.addColumn, this.dropLine, this.columnDropLine)
    this.observer = new ResizeObserver(() => this.scheduleRows()); this.observer.observe(this.dom)
    document.addEventListener('scroll',this.scrolled,true)
    this.update(node)
  }
  update(node: PMNode) {
    if (node.type !== this.node.type) return false
    this.node = node
    this.merged = hasMergedCells(node)
    const count = TableMap.get(node).width
    const saved = String(node.attrs.columnSize || '').split(',').map(Number)
    this.widths = saved.length === count && saved.every(n => Number.isFinite(n) && n > 0)
      ? saved.map(n => n / saved.reduce((sum, value) => sum + value, 0) * 100) : Array(count).fill(100 / count)
    while (this.handles.length > Math.max(0, count - 1)) this.handles.pop()!.remove()
    while (this.handles.length < count - 1) {
      const index = this.handles.length
      const handle = document.createElement('div')
      handle.className = 'table-column-resizer'; handle.role = 'separator'; handle.tabIndex = 0
      handle.setAttribute('aria-orientation', 'vertical'); handle.setAttribute('aria-label', t(`调整第 ${index + 1} 列宽`))
      handle.title = t('拖动调整列宽；方向键微调')
      handle.addEventListener('mousedown', event => this.drag(event, index))
      handle.addEventListener('keydown', event => {
        if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return
        event.preventDefault(); const widths = [...this.widths]
        const delta = Math.max(-widths[index] + 5, Math.min(widths[index + 1] - 5, event.key === 'ArrowLeft' ? -1 : 1))
        widths[index] += delta; widths[index + 1] -= delta; this.commit(widths)
      })
      this.controls.append(handle); this.handles.push(handle)
    }
    if (this.hoveredColumn >= count) this.hideColumnHandle()
    this.paint(this.widths)
    this.scheduleRows()
    return true
  }
  private scheduleRows() {
    cancelAnimationFrame(this.rowFrame)
    this.rowFrame = requestAnimationFrame(() => {
      const rows = [...this.contentDOM.querySelectorAll<HTMLElement>(':scope > tr')]
      if (this.hoveredRow >= rows.length) this.hideRowHandle()
      const rect = this.controls.getBoundingClientRect(), scale = rect.width / this.controls.offsetWidth || 1
      const first = rows[0]?.getBoundingClientRect()
      if(first) {
        const tableHandle = this.controls.querySelector<HTMLElement>('.table-block-handle')!
        tableHandle.style.left = `${(first.left - rect.left) / scale - 26}px`; tableHandle.style.top = `${(first.top - rect.top) / scale - 25}px`
        let left = 0
        this.handles.forEach((handle,i)=>{ left += this.widths[i]!; handle.style.left = `${(first.left - rect.left + first.width * left / 100) / scale}px`; handle.style.top = `${(first.top - rect.top) / scale}px`; handle.style.height = `${first.height / scale}px` })
        // Single shared grips follow whichever row and column the pointer is over.
        this.positionColumnHandle(this.cells_(rows[0]), rect, scale)
        this.positionRowHandle(rows, rect, scale)
        this.positionAddButtons(rows,rect,scale)
      }
    })
  }
  // Pointer-driven row drag, for the same reason as columns: preventing mousedown
  // suppresses HTML5 drag, and selecting the row would re-render the drag source.
  private startRowDrag(event: PointerEvent, row = this.hoveredRow) {
    if (event.button !== 0) return
    const pos = this.getPos(), from = row
    if (typeof pos !== 'number' || from < 0) return
    if (from === 0) { event.preventDefault(); selectTableRow(this.editor, pos, 0); return }
    if (this.merged) { event.preventDefault(); selectTableRow(this.editor,pos,from); return }
    event.preventDefault(); event.stopPropagation()
    const handle = this.rowHandle!, table = this.node
    const rows = this.rows_()
    if (!rows[from]) return
    const startY = event.clientY
    this.rowDrag = { from, table, insertAt: from, moved: false }
    handle.setPointerCapture?.(event.pointerId)
    this.dom.classList.add('dragging-table-row')
    const showDrop = (clientY: number) => {
      const current = this.rows_()
      const rect = this.controls.getBoundingClientRect(), scale = rect.width / this.controls.offsetWidth || 1
      let insertAt = this.rowAtY(current,clientY,true)
      insertAt = Math.max(1, Math.min(insertAt, current.length))
      this.rowDrag!.insertAt = insertAt
      const last = current.at(-1)!.getBoundingClientRect()
      const top = insertAt < current.length ? current[insertAt]!.getBoundingClientRect().top : last.bottom
      const target=current[Math.min(insertAt,current.length-1)]!.getBoundingClientRect()
      this.dropLine.style.left=`${(target.left-rect.left)/scale}px`;this.dropLine.style.width=`${target.width/scale}px`
      this.dropLine.style.top = `${(top - rect.top) / scale}px`; this.dropLine.hidden = false
      return current
    }
    const pointer=this.framePointer((moveEvent: PointerEvent) => {
      if (Math.abs(moveEvent.clientY - startY) > 3) this.rowDrag!.moved = true
      if(!this.rowDrag!.moved)return
      this.showGhost('row',from,event)
      showDrop(moveEvent.clientY); this.moveGhost(moveEvent)
    })
    const move=pointer.move
    const stopScroll=this.autoScroll(move)
    const clean = () => {
      stopScroll()
      pointer.cancel()
      document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up)
      document.removeEventListener('pointercancel', cancel); document.removeEventListener('keydown', escape, true)
      window.removeEventListener('blur',cancel)
      handle.releasePointerCapture?.(event.pointerId); this.cancelDrag = undefined
    }
    const cancel = () => { clean(); this.endRowDrag() }
    const escape = (keyEvent: KeyboardEvent) => { if (keyEvent.key === 'Escape') { keyEvent.preventDefault(); cancel() } }
    const up = () => {
      pointer.flush()
      const drag = this.rowDrag
      clean()
      if (drag && drag.moved) { if (this.tableUnchanged(pos, drag.table)) moveTableRow(this.editor, pos, drag.from, drag.insertAt); this.endRowDrag() }
      else { this.endRowDrag(); selectTableRow(this.editor, pos, from) }
    }
    this.cancelDrag = () => { clean(); this.endRowDrag() }
    document.addEventListener('pointermove', move); document.addEventListener('pointerup', up)
    document.addEventListener('pointercancel', cancel); document.addEventListener('keydown', escape, true)
    window.addEventListener('blur',cancel)
  }
  private endRowDrag() { this.rowDrag = undefined; this.dropLine.hidden = true; this.clearGhost(); this.dom.classList.remove('dragging-table-row') }
  // Undo/redo replaces the table node with an equal but different instance at the same
  // position, so identity checks silently cancelled drags. Compare the content instead:
  // if the table still holds the same rows, the row indexes captured at drag start remain
  // valid and the move is safe.
  private tableUnchanged(pos: number, dragged: PMNode) {
    const current = this.editor.state.doc.nodeAt(pos)
    if (!current || current.type.name !== 'table') return false
    if (current === dragged) return true
    return current.eq(dragged)
  }
  private endColumnDrag() { this.columnDrag = undefined; this.columnDropLine.hidden = true; this.clearGhost(); this.dom.classList.remove('dragging-table-column') }
  private clearGhost() { this.ghost?.remove(); this.ghost = undefined;this.ghostAnchor=undefined; this.contentDOM.querySelectorAll('.table-drag-source').forEach(el=>el.classList.remove('table-drag-source')); this.clearAxisPreview() }
  private clearAxisPreview() { this.contentDOM.querySelectorAll('.table-axis-preview').forEach(el=>el.classList.remove('table-axis-preview')) }
  private previewAxis(axis:'row'|'column',index:number) {
    this.clearAxisPreview()
    const rows=this.rows_(); const cells=axis==='row'?this.cells_(rows[index]):rows.map(row=>this.cells_(row)[index]).filter(Boolean)
    cells.forEach(cell=>cell.classList.add('table-axis-preview'))
  }
  // Clone the whole axis with real cell dimensions and content, rather than a label.
  private showGhost(axis:'row'|'column', index:number, event:PointerEvent) {
    if(this.ghost)return
    const rows=this.rows_(), source=axis==='row'?[rows[index]!]:rows
    const first=(axis==='row'?rows[index]:this.cells_(rows[0])[index]) as HTMLElement
    if(!first)return
    const box=first.getBoundingClientRect(), scale=this.dom.getBoundingClientRect().width/this.dom.offsetWidth||1
    this.ghostAxis=axis; this.ghostOffset=axis==='row'?event.clientY-box.top:event.clientX-box.left
    const canvas=this.dom.closest<HTMLElement>('.canvas')
    this.ghostAnchor={left:box.left,top:box.top,scrollLeft:canvas?.scrollLeft||0,scrollTop:canvas?.scrollTop||0,canvas}
    const ghost=document.createElement('div'),table=document.createElement('table'),body=document.createElement('tbody')
    ghost.className='table-drag-ghost';ghost.dataset.axis=axis;ghost.setAttribute('aria-hidden','true');ghost.style.width=`${box.width}px`
    table.className='table-drag-preview';table.append(body);ghost.append(table)
    const originals:HTMLElement[]=[]
    for(const row of source){
      const line=document.createElement('tr'),cells=axis==='row'?this.cells_(row):[this.cells_(row)[index]!]
      for(const cell of cells){
        if(!(cell instanceof HTMLElement))continue
        const clone=cell.cloneNode(true) as HTMLElement, rect=cell.getBoundingClientRect(), css=getComputedStyle(cell)
        clone.className='';clone.removeAttribute('contenteditable');clone.querySelectorAll('[contenteditable]').forEach(el=>el.removeAttribute('contenteditable'))
        clone.querySelectorAll('button,input,textarea,.block-controls,.table-resizers').forEach(el=>el.remove())
        clone.querySelectorAll('[id]').forEach(el=>el.removeAttribute('id'))
        clone.style.cssText=`box-sizing:border-box;position:relative;vertical-align:top;width:${rect.width}px;min-width:${rect.width}px;height:${rect.height}px;border:1px solid ${css.borderTopColor};background:${css.backgroundColor==='rgba(0, 0, 0, 0)'?getComputedStyle(this.dom.closest('.paper-editor')!).backgroundColor:css.backgroundColor};font-family:${css.fontFamily};font-size:${parseFloat(css.fontSize)*scale}px;line-height:${css.lineHeight==='normal'?'normal':parseFloat(css.lineHeight)*scale+'px'};color:${css.color};text-align:${css.textAlign};white-space:normal;overflow-wrap:anywhere;padding:${['Top','Right','Bottom','Left'].map(side=>parseFloat(css.getPropertyValue('padding-'+side.toLowerCase()))*scale+'px').join(' ')}`
        originals.push(cell);line.append(clone)
      }
      body.append(line)
    }
    // Finish all layout/style reads before changing the live cells.
    originals.forEach(cell=>cell.classList.add('table-drag-source'))
    document.body.append(ghost);this.ghost=ghost
  }
  private moveGhost(event: PointerEvent) {
    if (!this.ghost || !this.ghostAnchor) return
    const anchor=this.ghostAnchor,dx=(anchor.canvas?.scrollLeft||0)-anchor.scrollLeft,dy=(anchor.canvas?.scrollTop||0)-anchor.scrollTop
    const x=this.ghostAxis==='row'?anchor.left-dx:event.clientX-this.ghostOffset
    const y=this.ghostAxis==='column'?anchor.top-dy:event.clientY-this.ghostOffset
    this.ghost.style.transform=`translate3d(${x}px,${y}px,0)`
  }
  private labelRow() {
    const handle = this.rowHandle; if (!handle || this.hoveredRow < 0) return
    const header = this.hoveredRow === 0
    handle.setAttribute('aria-label', t(header ? '选择表头行' : `选择第 ${this.hoveredRow + 1} 行`))
    handle.title = t(header ? '选择表头行（表头固定在首行）' : this.merged ? '合并单元格的表格暂不支持拖动排序' : '点击选中整行；拖动排序；Delete 删除；Alt+↑↓ 移动')
  }
  private hideRowHandle() {
    this.hoveredRow = -1
    if (this.rowHandle) this.rowHandle.hidden = true
  }
  private hideGrips() { this.hideRowHandle(); this.hideColumnHandle(); this.hoveredCell?.classList.remove('table-cell-hovered'); this.hoveredCell=undefined;this.clearAxisPreview() }
  private showControls(){clearTimeout(this.hideTimer);this.dom.classList.add('table-controls-visible')}
  private rows_() { return [...this.contentDOM.querySelectorAll<HTMLElement>(':scope > tr')] }
  // Repeated print headers are decoration widgets, never document cells.
  private cells_(row?:HTMLElement){return row?[...row.querySelectorAll<HTMLElement>(':scope > :is(th,td):not(.repeat-header-widget)')]:[]}
  private positionAddButtons(rows:HTMLElement[],rect:DOMRect,scale:number){const last=rows.at(-1)?.getBoundingClientRect(),side=rows[Math.max(0,this.hoveredRow)]?.getBoundingClientRect();if(last){this.addRow.style.left=`${(last.left+last.width/2-rect.left)/scale-12}px`;this.addRow.style.top=`${(last.bottom-rect.top)/scale+2}px`}if(side){this.addColumn.style.left=`${(side.right-rect.left)/scale+3}px`;this.addColumn.style.top=`${(side.top+side.height/2-rect.top)/scale-12}px`}}
  // The row grip straddles the table's left border, centred on the hovered row.
  private positionRowHandle(rows: HTMLElement[], rect: DOMRect, scale: number) {
    const handle = this.rowHandle; if (!handle || handle.hidden) return
    const row = rows[this.hoveredRow]
    if (!row) { handle.hidden = true; return }
    const box = row.getBoundingClientRect(), width = handle.offsetWidth || 30, height = handle.offsetHeight || 30
    handle.style.left = `${(box.left - rect.left) / scale - width / 2}px`
    handle.style.top = `${(box.top + box.height / 2 - rect.top) / scale - height / 2}px`
  }
  private trackPointer(event: MouseEvent) {
    if (this.columnDrag || this.rowDrag) return
    const target=event.target as HTMLElement, cell=target.closest<HTMLElement>('td,th')
    if(cell&&this.contentDOM.contains(cell)){
      if(cell===this.hoveredCell&&!this.rowHandle?.hidden&&!this.columnHandle?.hidden){this.scheduleRows();return}
      const rows=this.rows_(), row=cell.closest('tr')!, index=rows.indexOf(row)
      if(index<0)return
      if(cell.classList.contains('repeat-header-widget'))return
      const cells=this.cells_(row),column=cells.slice(0,cells.indexOf(cell)).reduce((n,el)=>n+((el as HTMLTableCellElement).colSpan||1),0)
      this.hoveredRow=index;this.hoveredColumn=column;this.rowHandle!.hidden=false;this.columnHandle!.hidden=false;this.labelRow();this.labelColumn()
      const rect=this.controls.getBoundingClientRect(),scale=rect.width/this.controls.offsetWidth||1
      this.positionRowHandle(rows,rect,scale);this.positionColumnHandle(this.cells_(rows[0]),rect,scale)
      this.positionAddButtons(rows,rect,scale)
      if(this.hoveredCell!==cell){this.hoveredCell?.classList.remove('table-cell-hovered');this.hoveredCell=cell;cell.classList.add('table-cell-hovered')}
      return
    }
    if(this.controls.contains(target))return
    // Pointer resting on a grip keeps that grip so it stays grabbable.
    const onColumn = !!this.columnHandle && this.columnHandle.contains(event.target as globalThis.Node)
    const onRow = !!this.rowHandle && this.rowHandle.contains(event.target as globalThis.Node)
    if (!onColumn) this.trackColumn(event)
    if (!onRow) this.trackRow(event)
  }
  // Like Notion, the row grip appears while the pointer is over a row close to the
  // table's left border; it then sits just outside that border.
  private trackRow(event: MouseEvent) {
    const rows = this.rows_()
    if (!rows.length) return this.hideRowHandle()
    const first = rows[0]!.getBoundingClientRect(), last = rows.at(-1)!.getBoundingClientRect()
    const left = first.left
    if (event.clientX < left - 40 || event.clientX > left + 20) return this.hideRowHandle()
    if (event.clientY < first.top || event.clientY > last.bottom) return this.hideRowHandle()
    let index = rows.findIndex(row => { const box = row.getBoundingClientRect(); return event.clientY >= box.top && event.clientY <= box.bottom })
    if (index < 0) index = rows.length - 1
    const changed = index !== this.hoveredRow
    this.hoveredRow = index
    const handle = this.rowHandle; if (!handle) return
    handle.hidden = false
    if (changed) this.labelRow()
    const rect = this.controls.getBoundingClientRect(), scale = rect.width / this.controls.offsetWidth || 1
    this.positionRowHandle(rows, rect, scale)
  }
  private labelColumn() {
    const handle = this.columnHandle; if (!handle || this.hoveredColumn < 0) return
    handle.setAttribute('aria-label', t(`选择第 ${this.hoveredColumn + 1} 列`))
    handle.title = t(this.merged ? '合并单元格的表格暂不支持拖动排序' : '点击选中整列；拖动排序；Delete 删除；Alt+←→ 移动')
  }
  private hideColumnHandle() {
    this.hoveredColumn = -1
    if (this.columnHandle) this.columnHandle.hidden = true
  }
  // Place the shared grip exactly on the table's top border, centred on the column.
  private positionColumnHandle(header: HTMLElement[], rect: DOMRect, scale: number) {
    const handle = this.columnHandle; if (!handle) return
    const index = this.hoveredColumn
    if (handle.hidden || index < 0) return
    const cell = (this.cells_(this.rows_()[this.hoveredRow])[index]||header[index])?.getBoundingClientRect()
    if (!cell) { handle.hidden = true; return }
    // Centre the grip on the border with plain geometry: a CSS translate would jump
    // back to zero on :active while the pointer is already holding it.
    const width = handle.offsetWidth || 30, height = handle.offsetHeight || 30
    handle.style.left = `${(cell.left + cell.width / 2 - rect.left) / scale - width / 2}px`
    const canvas=this.dom.closest<HTMLElement>('.canvas'),top=header[index]?.getBoundingClientRect().top??cell.top
    // A long table's first row can be several pages above the viewport. Keep
    // column controls reachable without scrolling back to its first page.
    const visibleTop=canvas?canvas.getBoundingClientRect().top+(canvas.querySelector('.canvas-meta')?.getBoundingClientRect().height||0)+height*scale/2:top
    handle.style.top = `${(Math.max(top,visibleTop,top<visibleTop?cell.top:top) - rect.top) / scale - height / 2}px`
  }
  private trackColumn(event: MouseEvent) {
    if (this.columnDrag) return
    const header = this.cells_(this.rows_()[0])
    if (!header.length) return this.hideColumnHandle()
    const first = header[0]!.getBoundingClientRect(), last = header[header.length - 1]!.getBoundingClientRect()
    // Like Notion: the grip only appears when the pointer touches the top border band.
    if (event.clientY > first.top + 14 || event.clientY < first.top - 28) return this.hideColumnHandle()
    if (event.clientX < first.left || event.clientX > last.right) return this.hideColumnHandle()
    let index = header.findIndex(cell => event.clientX <= cell.getBoundingClientRect().right)
    if (index < 0) index = header.length - 1
    const changed = index !== this.hoveredColumn
    this.hoveredColumn = index
    if (!this.columnHandle) return
    this.columnHandle.hidden = false
    if (changed) this.labelColumn()
    const rect = this.controls.getBoundingClientRect(), scale = rect.width / this.controls.offsetWidth || 1
    this.positionColumnHandle(header, rect, scale)
  }
  // Pressing anywhere on the table's border grabs what is under the pointer, the same
  // way Notion lets you drag a row or column straight off its edge.
  private grabTableBorder(event: PointerEvent) {
    if (event.button !== 0 || this.columnDrag || this.rowDrag) return
    const target = event.target as HTMLElement
    if (this.controls.contains(target)) return
    if (!this.contentDOM.contains(target)) return
    const header = this.cells_(this.rows_()[0])
    if (!header.length) return
    const first = header[0]!.getBoundingClientRect(), last = header[header.length - 1]!.getBoundingClientRect()
    // Top edge: grab the column under the pointer.
    if (Math.abs(event.clientY - first.top) <= 8 && event.clientX >= first.left && event.clientX <= last.right) {
      let index = header.findIndex(cell => event.clientX <= cell.getBoundingClientRect().right)
      if (index < 0) index = header.length - 1
      this.hoveredColumn = index
      this.labelColumn()
      this.startColumnDrag(event, index)
      return
    }
    // Left edge: grab the row under the pointer.
    const rows = this.rows_()
    const top = rows[0]!.getBoundingClientRect(), bottom = rows.at(-1)!.getBoundingClientRect()
    if (Math.abs(event.clientX - top.left) <= 8 && event.clientY >= top.top && event.clientY <= bottom.bottom) {
      let index = rows.findIndex(row => { const box = row.getBoundingClientRect(); return event.clientY >= box.top && event.clientY <= box.bottom })
      if (index < 0) index = rows.length - 1
      this.hoveredRow = index
      this.labelRow()
      this.startRowDrag(event, index)
    }
  }
  // Pointer-driven column drag: HTML5 drag-and-drop cannot start once mousedown is
  // prevented, and selecting the column would re-render the drag source away.
  private startColumnDrag(event: PointerEvent, column = this.hoveredColumn) {
    if (event.button !== 0) return
    const pos = this.getPos(), from = column
    if (typeof pos !== 'number' || from < 0) return
    if (this.merged) { event.preventDefault(); selectTableColumn(this.editor,pos,from); return }
    event.preventDefault(); event.stopPropagation()
    const handle = this.columnHandle!, table = this.node
    const header = this.cells_(this.rows_()[0])
    if (!header.length) return
    const startX = event.clientX
    this.columnDrag = { from, table, insertAt: from, moved: false }
    handle.setPointerCapture?.(event.pointerId)
    this.dom.classList.add('dragging-table-column')
    let dropSignature=''
    let measuredNode=this.node,dragRows=this.rows_()
    const showDrop = (clientX: number, clientY:number) => {
      if(measuredNode!==this.node){measuredNode=this.node;dragRows=this.rows_()}
      const rows=dragRows,under=document.elementFromPoint(clientX,clientY)?.closest<HTMLElement>('tr')
      const candidate=under&&this.contentDOM.contains(under)?under:rows[this.rowAtY(rows,clientY)]
      const box=candidate?.getBoundingClientRect(),hit=box&&clientY>=box.top?candidate:undefined
      const cells=hit?this.cells_(hit):header
      let insertAt = cells.findIndex(cell => { const box = cell.getBoundingClientRect(); return clientX < box.left + box.width / 2 })
      if (insertAt < 0) insertAt = header.length
      insertAt = Math.max(0, Math.min(insertAt, header.length))
      this.columnDrag!.insertAt = insertAt
      const signature=`${insertAt}/${this.dom.offsetWidth}/${this.dom.offsetHeight}`
      if(signature===dropSignature)return
      dropSignature=signature
      const rect=this.controls.getBoundingClientRect(),scale=rect.width/this.controls.offsetWidth||1
      const segments=rows.map(row=>{const cells=this.cells_(row),box=cells[Math.min(insertAt,cells.length-1)]!.getBoundingClientRect(),line=document.createElement('i');line.style.cssText=`left:${((insertAt<cells.length?box.left:box.right)-rect.left)/scale}px;top:${(box.top-rect.top)/scale}px;height:${box.height/scale}px`;return line})
      this.columnDropLine.replaceChildren(...segments)
      this.columnDropLine.hidden = false
    }
    const pointer=this.framePointer((moveEvent: PointerEvent) => {
      if (Math.abs(moveEvent.clientX - startX) > 3) this.columnDrag!.moved = true
      if(!this.columnDrag!.moved)return
      this.showGhost('column',from,event)
      showDrop(moveEvent.clientX,moveEvent.clientY); this.moveGhost(moveEvent)
    })
    const move=pointer.move
    const stopScroll=this.autoScroll(move)
    const clean = () => {
      stopScroll()
      pointer.cancel()
      document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); document.removeEventListener('pointercancel', cancel)
      window.removeEventListener('blur',cancel)
      handle.releasePointerCapture?.(event.pointerId); this.cancelDrag = undefined
    }
    const cancel = () => { clean(); document.removeEventListener('keydown', escape, true); this.endColumnDrag() }
    const escape = (keyEvent: KeyboardEvent) => { if (keyEvent.key === 'Escape') { keyEvent.preventDefault(); cancel() } }
    const up = () => {
      pointer.flush()
      const drag = this.columnDrag
      clean(); document.removeEventListener('keydown', escape, true)
      if (drag && drag.moved) { if (this.tableUnchanged(pos, drag.table)) moveTableColumn(this.editor, pos, drag.from, drag.insertAt); this.endColumnDrag() }
      else { this.endColumnDrag(); selectTableColumn(this.editor, pos, from) }
    }
    this.cancelDrag = () => { clean(); document.removeEventListener('keydown', escape, true); this.endColumnDrag() }
    document.addEventListener('pointermove', move); document.addEventListener('pointerup', up); document.addEventListener('pointercancel', cancel); document.addEventListener('keydown', escape, true)
    window.addEventListener('blur',cancel)
  }
  private rowAtY(rows:HTMLElement[],y:number,midpoint=false) {
    let low=0,high=rows.length
    while(low<high){const mid=(low+high)>>>1,box=rows[mid]!.getBoundingClientRect();if(y<(midpoint?box.top+box.height/2:box.bottom))high=mid;else low=mid+1}
    return low
  }
  private framePointer(paint:(event:PointerEvent)=>void) {
    let frame=0,last:PointerEvent|undefined
    const flush=()=>{cancelAnimationFrame(frame);frame=0;const event=last;last=undefined;if(event)paint(event)}
    return{move:(event:PointerEvent)=>{last=event;if(!frame)frame=requestAnimationFrame(flush)},flush,cancel:()=>{cancelAnimationFrame(frame);frame=0;last=undefined}}
  }
  private autoScroll(move:(event:PointerEvent)=>void) {
    const canvas=this.dom.closest<HTMLElement>('.canvas');let frame=0,last:PointerEvent|undefined
    const track=(event:PointerEvent)=>{last=event}
    const tick=()=>{if(canvas&&last&&(this.rowDrag?.moved||this.columnDrag?.moved)){const b=canvas.getBoundingClientRect(),speed=(p:number,start:number,end:number)=>p<start+32?-Math.min(20,(start+32-p)/2):p>end-32?Math.min(20,(p-end+32)/2):0;const before=canvas.scrollTop,left=canvas.scrollLeft;canvas.scrollTop+=speed(last.clientY,b.top,b.bottom);canvas.scrollLeft+=speed(last.clientX,b.left,b.right);if(canvas.scrollTop!==before||canvas.scrollLeft!==left)move(last)}frame=requestAnimationFrame(tick)}
    document.addEventListener('pointermove',track);frame=requestAnimationFrame(tick)
    return()=>{cancelAnimationFrame(frame);document.removeEventListener('pointermove',track)}
  }
  private paint(widths: number[]) {
    this.dom.style.setProperty('--cell-percentage', widths.map(n => `${n}%`).join(' '))
    let left = 0
    this.handles.forEach((handle, i) => { left += widths[i]; handle.style.left = `${left}%`; handle.setAttribute('aria-valuenow', String(Math.round(widths[i]))) })
  }
  private commit(widths: number[]) {
    const pos = this.getPos()
    if (typeof pos !== 'number' || this.editor.isDestroyed) return
    const node = this.editor.state.doc.nodeAt(pos)
    if (node?.type.name === 'table') this.editor.view.dispatch(this.editor.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, columnSize: widths.map(n => n.toFixed(3)).join(',') }))
  }
  private drag(event: MouseEvent, index: number) {
    if (event.button !== 0) return
    event.preventDefault(); this.cancelDrag?.()
    const startX = event.clientX, initial = [...this.widths], total = this.contentDOM.querySelector('tr')?.getBoundingClientRect().width || this.dom.getBoundingClientRect().width
    let widths = [...initial]
    this.dom.classList.add('resizing-table')
    const move = (event: MouseEvent) => {
      const minimum = Math.min(8, 56 / total * 100)
      const delta = Math.max(minimum - initial[index], Math.min(initial[index + 1] - minimum, (event.clientX - startX) / total * 100))
      widths = [...initial]; widths[index] += delta; widths[index + 1] -= delta; this.paint(widths)
    }
    const clean = () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', done); this.dom.classList.remove('resizing-table'); this.cancelDrag = undefined }
    const done = () => { clean(); this.commit(widths) }
    this.cancelDrag = clean
    document.addEventListener('mousemove', move); document.addEventListener('mouseup', done)
  }
  stopEvent(event: Event) { return this.controls.contains(event.target as globalThis.Node) }
  ignoreMutation(mutation: ViewMutationRecord) {
    if (mutation.type === 'selection') return false
    return !this.contentDOM.contains(mutation.target)
  }
  destroy() { document.removeEventListener('scroll',this.scrolled,true);clearTimeout(this.hideTimer);this.cancelDrag?.(); this.clearGhost(); this.observer.disconnect(); this.unwatch(); cancelAnimationFrame(this.rowFrame) }
}

function cellView(tag: 'td' | 'th', node: PMNode): NodeView {
  const dom = document.createElement(tag)
  function apply(node: PMNode) {
    dom.colSpan = node.attrs.colspan || 1; dom.rowSpan = node.attrs.rowspan || 1
    dom.style.gridColumn = `span ${dom.colSpan}`; dom.style.textAlign = node.attrs.align || '';dom.style.backgroundColor=colorValue(node.attrs.background)||''
  }
  apply(node)
  return { dom, contentDOM: dom, update(next) { if (next.type !== node.type) return false; node = next; apply(node); return true }, ignoreMutation: mutation => mutation.type === 'attributes' && mutation.target === dom }
}

export function parseTsv(text: string): string[][] | null {
  if (!text.includes('\t')) return null
  const rows: string[][] = [[]]; let value = '', quoted = false
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (char === '"' && (quoted || value === '')) { if (quoted && text[i + 1] === '"') { value += '"'; i++ } else quoted = !quoted }
    else if (!quoted && (char === '\t' || char === '\n' || char === '\r')) {
      rows[rows.length - 1].push(value); value = ''
      if (char !== '\t') { if (char === '\r' && text[i + 1] === '\n') i++; rows.push([]) }
    } else value += char
  }
  rows[rows.length - 1].push(value)
  if (rows.length > 1 && rows.at(-1)?.length === 1 && rows.at(-1)?.[0] === '') rows.pop()
  const columns = Math.max(...rows.map(row => row.length))
  if (columns < 2 || rows.length * columns > 10000) return null
  return rows.map(row => Array.from({ length: columns }, (_, i) => row[i] || ''))
}

export function createPagedTable(){let tableSchema:Schema
return Table.extend({
  onBeforeCreate(){tableSchema=this.editor.schema},
  renderMarkdown(node,helpers,context){const styled=!!node.attrs?.headerColumn||node.content?.some((row:any,index:number)=>row.content?.some((cell:any)=>colorValue(cell.attrs?.background)||index>0&&cell.type==='tableHeader'));return styled?styledTableHTML(node,tableSchema):this.parent?.(node,helpers,context)||''},
  addAttributes() { return { ...this.parent?.(),headerColumn:{default:false,parseHTML:el=>el.getAttribute('data-header-column')==='true',renderHTML:attrs=>attrs.headerColumn?{'data-header-column':'true'}:{}}, columnSize: { default: '', parseHTML: element => element.getAttribute('data-column-size') || '', renderHTML: attrs => ({ 'data-column-size': attrs.columnSize }) } } },
  addNodeView() { return ({ node, editor, getPos }) => new PagedTableView(node, editor, getPos) },
  addKeyboardShortcuts() {
    const parent = this.parent?.() || {}
    return { ...parent, 'Mod-Enter': () => leaveTable(this.editor), Backspace: () => deleteTableSelection(this.editor) || parent.Backspace?.({ editor: this.editor }) || false, Delete: () => deleteTableSelection(this.editor) || parent.Delete?.({ editor: this.editor }) || false,
      'Alt-ArrowUp': () => { const c = tableContext(this.editor); return !!c && tableSelectionKey.getState(this.editor.state) === 'row' && moveTableRow(this.editor, c.pos, c.row - 1, c.row - 2) },
      'Alt-ArrowDown': () => { const c = tableContext(this.editor); return !!c && tableSelectionKey.getState(this.editor.state) === 'row' && moveTableRow(this.editor, c.pos, c.row - 1, c.row + 1) },
      'Alt-ArrowLeft': () => { const c = tableContext(this.editor); return !!c && tableSelectionKey.getState(this.editor.state) === 'column' && moveTableColumn(this.editor, c.pos, c.column - 1, c.column - 2) },
      'Alt-ArrowRight': () => { const c = tableContext(this.editor); return !!c && tableSelectionKey.getState(this.editor.state) === 'column' && moveTableColumn(this.editor, c.pos, c.column - 1, c.column + 1) },
    }
  },
  addProseMirrorPlugins() {
    const editor = this.editor
    return [new Plugin({key:new PluginKey('yeranHeaderColumn'),appendTransaction(transactions,_old,state){
      if(!transactions.some(tr=>tr.docChanged))return null
      const tr=state.tr;state.doc.descendants((table,pos)=>{if(table.type.name!=='table')return; if(!table.attrs.headerColumn||hasMergedCells(table))return false
      let rowPos=pos+1;table.forEach((row,_offset,index)=>{const fullHeader=index===0&&Array.from({length:row.childCount},(_,i)=>row.child(i).type.name==='tableHeader').every(Boolean);let cellPos=rowPos+1;row.forEach((cell,_offset,column)=>{const type=fullHeader||column===0?state.schema.nodes.tableHeader!:state.schema.nodes.tableCell!;if(cell.type!==type)tr.setNodeMarkup(cellPos,type,cell.attrs);cellPos+=cell.nodeSize});rowPos+=row.nodeSize});return false});return tr.docChanged?tr:null
    }}),new Plugin({ key: tableSelectionKey, state: { init: () => null, apply(tr, previous) { return tr.getMeta(tableSelectionKey) || (tr.selectionSet || tr.docChanged ? null : previous) } } }), new Plugin({
      key: new PluginKey('yeranTablePaste'),
      props: {
        clipboardTextParser(text) {
          if (editor.isActive('codeBlock')) return null as any
          const rows = parseTsv(text)
          if (!rows) return null as any
          const schema = editor.schema
          const table = schema.nodes.table!.create(null, rows.map((row, index) => schema.nodes.tableRow!.create(null, row.map(text => {
            const content = text ? text.split('\n').flatMap((line, i) => [...(i ? [schema.nodes.hardBreak!.create()] : []), ...(line ? [schema.text(line)] : [])]) : []
            return schema.nodes[index === 0 && !editor.isActive('table') ? 'tableHeader' : 'tableCell']!.create(null, schema.nodes.paragraph!.create(null, content))
          }))))
          return new Slice(Fragment.from(table), 1, 1)
        },
      },
    }), ...(this.parent?.() || [])]
  },
}).configure({ resizable: false, allowTableNodeSelection: true })
}
export const PagedTableRow = TableRow.extend({ addNodeView() { return () => { const dom = document.createElement('tr'); dom.style.display = 'grid'; dom.style.gridTemplateColumns = 'var(--cell-percentage)'; return { dom, contentDOM: dom, ignoreMutation: mutation => mutation.type === 'attributes' && mutation.target === dom } } } })
const backgroundAttribute={default:null,parseHTML:(el:HTMLElement)=>colorValue(el.style.backgroundColor),renderHTML:(attrs:Record<string,any>)=>colorValue(attrs.background)?{style:'background-color:'+colorValue(attrs.background)}:{}}
export const PagedTableCell = TableCell.extend({ addAttributes(){return{...this.parent?.(),background:backgroundAttribute}}, addNodeView() { return ({ node }) => cellView('td', node) } })
export const PagedTableHeader = TableHeader.extend({ addAttributes(){return{...this.parent?.(),background:backgroundAttribute}}, addNodeView() { return ({ node }) => cellView('th', node) } })
