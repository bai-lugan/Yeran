<script setup lang="ts">
import {BACKGROUND_COLORS} from '../colors'
import {t} from '../i18n'
import {computed,onBeforeUnmount,onMounted,ref,nextTick} from 'vue'
import type {Editor} from '@tiptap/core'
import {ChevronDown,Plus,AlignLeft,AlignCenter,AlignRight,MoreHorizontal,CornerDownLeft,Copy,Trash2,Columns3,Rows3,Columns2} from 'lucide-vue-next'
import {tableContext,alignTableColumn,leaveTable,tableAction,hasMergedCells,toggleFirstHeaderColumn,headerColumnEnabled,paintTableCells,tableSelectionKind,deleteTableSelection,repeatTableHeader,toggleRepeatTableHeader} from '../table'
const props=defineProps<{editor:Editor;context:NonNullable<ReturnType<typeof tableContext>>}>()
const menu=ref<{kind:'row'|'column'|'all';left:number;top:number}|null>(null),panel=ref<HTMLElement>()
const selectedKind=computed(()=>{props.context;return tableSelectionKind(props.editor)}),deleteLabel=computed(()=>selectedKind.value==='row'?'删除所选行':selectedKind.value==='column'?'删除所选列':'删除表格')
function deleteSelected(){menu.value=null;if(deleteTableSelection(props.editor))props.editor.view.focus()}
function alignmentLabel(side:string){return selectedKind.value==='table'?side==='center'?'整表居中':side==='left'?'整表左对齐':'整表右对齐':side==='center'?'整列居中':side==='left'?'整列左对齐':'整列右对齐'}
async function openContext(x:number,y:number,kind:'row'|'column'|'all'='all'){
 menu.value={kind,left:Math.max(8,Math.min(x,innerWidth-226)),top:Math.max(8,y)};await nextTick();if(menu.value&&panel.value)menu.value.top=Math.max(8,Math.min(y,innerHeight-panel.value.getBoundingClientRect().height-8))
}
function open(kind:'row'|'column'|'all',event:MouseEvent){if(menu.value?.kind===kind){menu.value=null;return}const r=(event.currentTarget as HTMLElement).getBoundingClientRect();void openContext(r.left,r.bottom+5,kind)}
function run(action:string){
 menu.value=null;const chain=props.editor.chain().focus()
 if(action==='headerColumn'){toggleFirstHeaderColumn(props.editor);return}
 if(action==='repeatHeader'){toggleRepeatTableHeader(props.editor);return}
 if(action==='duplicateRow'||action==='duplicateColumn'||action==='equalize'){tableAction(props.editor,action);return}
 if(action==='deleteRow'&&props.context.rows===1||action==='deleteColumn'&&props.context.columns===1){chain.deleteTable().run();return}
 if(action==='rowBefore')chain.addRowBefore().run()
 if(action==='rowAfter')chain.addRowAfter().run()
 if(action==='columnBefore')chain.addColumnBefore().run()
 if(action==='columnAfter')chain.addColumnAfter().run()
 if(action==='deleteRow')chain.deleteRow().run()
 if(action==='deleteColumn')chain.deleteColumn().run()
 if(action==='leave')leaveTable(props.editor)
 if(['left','center','right'].includes(action))alignTableColumn(props.editor,action as 'left'|'center'|'right')
}
function paint(value:string){paintTableCells(props.editor,value,menu.value?.kind==='row'?'row':menu.value?.kind==='column'?'column':'selection');menu.value=null}
function outside(event:PointerEvent){if(!(event.target as Element).closest('.table-tools,.table-context-menu'))menu.value=null}
function escape(event:KeyboardEvent){if(event.key==='Escape')menu.value=null}
onMounted(()=>{document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape)})
onBeforeUnmount(()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape)})
defineExpose({openContext,close:()=>menu.value=null})
</script>
<template>
 <div class="table-tools" role="toolbar" :aria-label="t('表格编辑')" @mousedown.prevent>
  <span class="table-location">{{context.rows}} × {{context.columns}}<span>{{t(`第 ${context.row} 行 · 第 ${context.column} 列`)}}</span></span>
  <div class="table-tool-group"><button class="text-btn" :aria-label="t('向下插入行')" :title="t('在当前行下方插入')" @click="run('rowAfter')"><Plus :size="14"/>{{t('行')}}</button><button class="icon-btn table-menu-toggle" :aria-label="t('行操作')" @click="open('row',$event)"><ChevronDown :size="12"/></button></div>
  <div class="table-tool-group"><button class="text-btn" :aria-label="t('向右插入列')" :title="t('在当前列右侧插入')" @click="run('columnAfter')"><Plus :size="14"/>{{t('列')}}</button><button class="icon-btn table-menu-toggle" :aria-label="t('列操作')" @click="open('column',$event)"><ChevronDown :size="12"/></button></div>
  <div class="table-tool-group table-alignment"><button class="icon-btn" :aria-label="t(alignmentLabel('left'))" :title="t(alignmentLabel('left'))" @click="run('left')"><AlignLeft :size="15"/></button><button class="icon-btn" :aria-label="t(alignmentLabel('center'))" :title="t(alignmentLabel('center'))" @click="run('center')"><AlignCenter :size="15"/></button><button class="icon-btn" :aria-label="t(alignmentLabel('right'))" :title="t(alignmentLabel('right'))" @click="run('right')"><AlignRight :size="15"/></button></div>
  <button v-if="selectedKind" class="text-btn danger-action table-delete-selection" :aria-label="t(deleteLabel)" :title="t(deleteLabel)+' · Delete / Backspace'" @click="deleteSelected"><Trash2 :size="15"/><span>{{t(deleteLabel)}}</span></button>
  <button class="icon-btn" :aria-label="t('更多表格操作')" :title="t('表格设置')" @click="open('all',$event)"><MoreHorizontal :size="17"/></button>
  <button class="text-btn table-leave" :aria-label="t('退出表格')" :title="t('移到表格后 · Ctrl+Enter')" @click="run('leave')"><CornerDownLeft :size="14"/><span>{{t('退出表格')}}</span></button>
 </div>
 <Teleport to="body"><div v-if="menu" ref="panel" role="menu" :aria-label="t('表格操作')" class="table-context-menu" :class="`menu-${menu.kind}`" :style="{left:menu.left+'px',top:menu.top+'px',maxHeight:'calc(100dvh - 16px)'}" @mousedown.prevent>
  <template v-if="menu.kind==='row'"><button role="menuitem" @click="run('rowBefore')"><Plus :size="14"/>{{t('在上方插入行')}}</button><button role="menuitem" @click="run('rowAfter')"><Plus :size="14"/>{{t('在下方插入行')}}</button><button role="menuitem" :disabled="hasMergedCells(context.table)" @click="run('duplicateRow')"><Copy :size="14"/>{{t('复制当前行')}}</button><button role="menuitem" class="danger-action" @click="run('deleteRow')"><Trash2 :size="14"/>{{t(selectedKind==='row'?'删除所选行':'删除当前行')}}</button></template>
  <template v-else-if="menu.kind==='column'"><button role="menuitem" @click="run('columnBefore')"><Plus :size="14"/>{{t('在左侧插入列')}}</button><button role="menuitem" @click="run('columnAfter')"><Plus :size="14"/>{{t('在右侧插入列')}}</button><button role="menuitem" :disabled="hasMergedCells(context.table)" @click="run('duplicateColumn')"><Copy :size="14"/>{{t('复制当前列')}}</button><button role="menuitem" class="danger-action" @click="run('deleteColumn')"><Trash2 :size="14"/>{{t(selectedKind==='column'?'删除所选列':'删除当前列')}}</button></template>
  <template v-else><button role="menuitemcheckbox" :aria-checked="repeatTableHeader(editor)" @click="run('repeatHeader')"><Rows3 :size="14"/>{{t('跨页重复表头')}}</button><button role="menuitemcheckbox" :aria-checked="headerColumnEnabled(context.table)" :disabled="hasMergedCells(context.table)" @click="run('headerColumn')"><Columns3 :size="14"/>{{t('首列作为表头')}}</button><button role="menuitem" @click="run('equalize')"><Columns2 :size="14"/>{{t('均分列宽')}}</button></template>
  <hr><div class="table-cell-colors"><small>{{t('单元格底色')}}</small><div role="group" :aria-label="t('单元格底色')"><button v-for="[name,value] in BACKGROUND_COLORS" :key="name" :title="t(name)" :aria-label="t(name)+' · '+t('单元格底色')" :style="{background:value||'white'}" @click="paint(value)"><span v-if="!value">×</span></button></div></div>
 </div></Teleport>
</template>
