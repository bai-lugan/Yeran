<script setup lang="ts">
import { BACKGROUND_COLORS } from '../colors'
import { t } from '../i18n'
import { onBeforeUnmount, onMounted, ref } from 'vue'
import type { Editor } from '@tiptap/core'
import { ChevronDown, Plus, AlignLeft, AlignCenter, AlignRight, MoreHorizontal, CornerDownLeft, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Copy, Trash2, Maximize2, Eraser, Table2, Rows3, Columns3, MousePointerSquareDashed } from 'lucide-vue-next'
import { tableContext, alignTableColumn, leaveTable, selectTableRow, selectTableColumn, selectTable, moveTableRow, moveTableColumn, tableAction, hasMergedCells, toggleFirstHeaderColumn,headerColumnEnabled,paintTableCells } from '../table'
const props = defineProps<{ editor: Editor; context: NonNullable<ReturnType<typeof tableContext>> }>()
const menu = ref<{ kind: 'row' | 'column' | 'all'; left: number; top: number } | null>(null)
function open(kind: 'row' | 'column' | 'all', event: MouseEvent) {
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  menu.value = menu.value?.kind === kind ? null : { kind, left: Math.max(8, Math.min(rect.left, window.innerWidth - 218)), top: Math.max(8, Math.min(rect.bottom + 5, window.innerHeight - (kind === 'all' ? 550 : 152))) }
}
function openContext(x: number, y: number) { menu.value = { kind: 'all', left: Math.max(8, Math.min(x, window.innerWidth - 218)), top: Math.max(8, Math.min(y, window.innerHeight - 550)) } }
function run(action: string) {
  menu.value = null
  const chain = props.editor.chain().focus()
  if(action==='headerColumn'){toggleFirstHeaderColumn(props.editor);return}
  if(['duplicateRow','duplicateColumn','fit','clear'].includes(action)){tableAction(props.editor,action as 'duplicateRow'|'duplicateColumn'|'fit'|'clear');return}
  if (action === 'rowBefore') chain.addRowBefore().run()
  if (action === 'rowAfter') chain.addRowAfter().run()
  if (action === 'columnBefore') chain.addColumnBefore().run()
  if (action === 'columnAfter') chain.addColumnAfter().run()
  if (action === 'deleteRow') chain.deleteRow().run()
  if (action === 'deleteColumn') chain.deleteColumn().run()
  if (action === 'deleteTable') chain.deleteTable().run()
  if (action === 'leave') leaveTable(props.editor)
  if (action === 'selectTable') selectTable(props.editor)
  if (action === 'selectRow') selectTableRow(props.editor, props.context.pos, props.context.row - 1)
  if (action === 'selectColumn') selectTableColumn(props.editor, props.context.pos, props.context.column - 1)
  if (action === 'moveUp') moveTableRow(props.editor, props.context.pos, props.context.row - 1, props.context.row - 2)
  if (action === 'moveDown') moveTableRow(props.editor, props.context.pos, props.context.row - 1, props.context.row + 1)
  if (action === 'moveLeft') moveTableColumn(props.editor, props.context.pos, props.context.column - 1, props.context.column - 2)
  if (action === 'moveRight') moveTableColumn(props.editor, props.context.pos, props.context.column - 1, props.context.column + 1)
  if (['left', 'center', 'right'].includes(action)) alignTableColumn(props.editor, action as 'left' | 'center' | 'right')
}
function paint(value:string){paintTableCells(props.editor,value,menu.value?.kind==='row'?'row':menu.value?.kind==='column'?'column':'selection');menu.value=null}
function outside(event: PointerEvent) { if (!(event.target as Element).closest('.table-tools,.table-context-menu')) menu.value = null }
function escape(event: KeyboardEvent) { if (event.key === 'Escape') menu.value = null }
onMounted(() => { document.addEventListener('pointerdown', outside); document.addEventListener('keydown', escape) })
onBeforeUnmount(() => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape) })
defineExpose({ openContext })
</script>

<template>
  <div class="table-tools" role="toolbar" :aria-label="t('表格编辑')" @mousedown.prevent>
    <span class="table-location">{{ context.rows }} × {{ context.columns }}<span>{{ t(`第 ${context.row} 行 · 第 ${context.column} 列`) }}</span></span>
    <div class="table-tool-group"><button class="text-btn" :aria-label="t('向下插入行')" :title="t('在当前行下方插入')" @click="run('rowAfter')"><Plus :size="14" />{{ t('行') }}</button><button class="icon-btn table-menu-toggle" :aria-label="t('行操作')" @click="open('row', $event)"><ChevronDown :size="12" /></button></div>
    <div class="table-tool-group"><button class="text-btn" :aria-label="t('向右插入列')" :title="t('在当前列右侧插入')" @click="run('columnAfter')"><Plus :size="14" />{{ t('列') }}</button><button class="icon-btn table-menu-toggle" :aria-label="t('列操作')" @click="open('column', $event)"><ChevronDown :size="12" /></button></div>
    <div class="table-tool-group table-alignment"><button class="icon-btn" :aria-label="t('整列左对齐')" :title="t('整列左对齐')" @click="run('left')"><AlignLeft :size="15" /></button><button class="icon-btn" :aria-label="t('整列居中')" :title="t('整列居中')" @click="run('center')"><AlignCenter :size="15" /></button><button class="icon-btn" :aria-label="t('整列右对齐')" :title="t('整列右对齐')" @click="run('right')"><AlignRight :size="15" /></button></div>
    <button class="icon-btn" :aria-label="t('更多表格操作')" :title="t('更多操作，也可右键单元格')" @click="open('all', $event)"><MoreHorizontal :size="17" /></button>
    <button class="text-btn table-leave" :title="t('移到表格后 · Ctrl+Enter')" @click="run('leave')"><CornerDownLeft :size="14" /><span>{{ t('退出表格') }}</span></button>
    <Teleport to="body"><div v-if="menu" role="menu" :aria-label="t('表格操作')" class="table-context-menu" :class="`menu-${menu.kind}`" :style="{ left: `${menu.left}px`, top: `${menu.top}px`, maxHeight: `max(140px, calc(100dvh - ${menu.top + 8}px))` }" @mousedown.prevent>
      <template v-if="menu.kind !== 'column'"><small>{{ t('行') }}</small><button role="menuitem" @click="run('rowBefore')"><Plus :size="14" />{{ t('在上方插入行') }}</button><button role="menuitem" @click="run('rowAfter')"><Plus :size="14" />{{ t('在下方插入行') }}</button><button role="menuitem" :disabled="hasMergedCells(context.table)" @click="run('duplicateRow')"><Copy :size="14" />{{ t('复制当前行') }}</button><button role="menuitem" class="danger-action" @click="run('deleteRow')"><Trash2 :size="14" />{{ t('删除当前行') }}{{ t(context.selected > 1 ? '（含所选行）' : '') }}</button></template>
      <hr v-if="menu.kind === 'all'">
      <template v-if="menu.kind !== 'row'"><small>{{ t('列') }}</small><button role="menuitem" @click="run('columnBefore')"><Plus :size="14" />{{ t('在左侧插入列') }}</button><button role="menuitem" @click="run('columnAfter')"><Plus :size="14" />{{ t('在右侧插入列') }}</button><button role="menuitem" :disabled="hasMergedCells(context.table)" @click="run('duplicateColumn')"><Copy :size="14" />{{ t('复制当前列') }}</button><button role="menuitemcheckbox" :aria-checked="headerColumnEnabled(context.table)" :disabled="hasMergedCells(context.table)" @click="run('headerColumn')"><Columns3 :size="14"/>{{t('首列作为表头')}}</button><button role="menuitem" class="danger-action" @click="run('deleteColumn')"><Trash2 :size="14" />{{ t('删除当前列') }}{{ t(context.selected > 1 ? '（含所选列）' : '') }}</button></template>
      <template v-if="menu.kind === 'all'"><hr><small>{{ t('选择') }}</small><button role="menuitem" @click="run('selectRow')"><Rows3 :size="14" />{{ t('选择当前行') }}</button><button role="menuitem" @click="run('selectColumn')"><Columns3 :size="14" />{{ t('选择当前列') }}</button><button role="menuitem" @click="run('selectTable')"><Table2 :size="14" />{{ t('选择整个表格') }}</button>
        <hr><small>{{ t('移动') }}</small><button role="menuitem" :disabled="context.row <= 2" @click="run('moveUp')"><ArrowUp :size="14" />{{ t('上移一行') }}</button><button role="menuitem" :disabled="context.row <= 1 || context.row === context.rows" @click="run('moveDown')"><ArrowDown :size="14" />{{ t('下移一行') }}</button><button role="menuitem" :disabled="context.column <= 1" @click="run('moveLeft')"><ArrowLeft :size="14" />{{ t('左移一列') }}</button><button role="menuitem" :disabled="context.column >= context.columns" @click="run('moveRight')"><ArrowRight :size="14" />{{ t('右移一列') }}</button>
        <hr><small>{{ t('对齐') }}</small><div class="menu-alignment"><button role="menuitem" :title="t('整列左对齐')" :aria-label="t('整列左对齐')" @click="run('left')"><AlignLeft :size="15" /></button><button role="menuitem" :title="t('整列居中')" :aria-label="t('整列居中')" @click="run('center')"><AlignCenter :size="15" /></button><button role="menuitem" :title="t('整列右对齐')" :aria-label="t('整列右对齐')" @click="run('right')"><AlignRight :size="15" /></button></div>
        <hr><small>{{ t('格式') }}</small><button role="menuitem" @click="run('clear')"><Eraser :size="14" />{{ t('清空选中单元格') }}</button><button role="menuitem" :title="t('均分列宽并铺满页面')" @click="run('fit')"><Maximize2 :size="14" />{{ t('适合页宽') }}</button>
        <hr><button role="menuitem" @click="run('leave')"><CornerDownLeft :size="14" />{{ t('移到表格后') }}<span>Ctrl+Enter</span></button><button role="menuitem" class="danger-action" @click="run('deleteTable')"><Trash2 :size="14" />{{ t('删除表格') }}</button></template>
<div class="table-cell-colors"><small>{{t('单元格底色')}}</small><div role="group" :aria-label="t('单元格底色')"><button v-for="[name,value] in BACKGROUND_COLORS" :key="name" :title="t(name)" :aria-label="t(name)+' · '+t('单元格底色')" :style="{background:value||'white'}" @click="paint(value)"><span v-if="!value">×</span></button></div></div></div></Teleport>
  </div>
</template>
