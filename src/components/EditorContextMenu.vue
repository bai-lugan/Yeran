<script setup lang="ts">
import {computed,ref,nextTick,onMounted,onBeforeUnmount} from 'vue'
import type {Editor} from '@tiptap/core'
import {NodeSelection,TextSelection} from '@tiptap/pm/state'
import {CellSelection} from '@tiptap/pm/tables'
import {Undo2,Redo2,Scissors,Copy,Clipboard,TextSelect,Trash2,Rows3,Columns3,Settings2,Files} from 'lucide-vue-next'
import {blocks,selectedBlocks,duplicateBlocks} from '../block-tools'
import {selectionBlocks,selectBlocks,deleteBlockSelection} from '../block-selection'
import {tableContext,tableSelectionKind,deleteTableSelection} from '../table'
import {copyEditorSelection,pasteEditorClipboard} from '../editor-clipboard'
import BlockLayoutControls from './BlockLayoutControls.vue'
import {t} from '../i18n'
const props=defineProps<{editor:Editor}>(),emit=defineEmits<{error:[unknown];table:[{x:number;y:number;kind:'row'|'column'|'all'}];opening:[]}>()
const menu=ref<{left:number;top:number}|null>(null),panel=ref<HTMLElement>(),version=ref(0)
const table=computed(()=>{version.value;return tableContext(props.editor)}),kind=computed(()=>{version.value;return tableSelectionKind(props.editor)}),block=computed(()=>{version.value;return selectionBlocks(props.editor.state.selection).length>0})
const canCopy=computed(()=>{version.value;return !props.editor.state.selection.empty}),removeLabel=computed(()=>kind.value==='row'?'删除所选行':kind.value==='column'?'删除所选列':kind.value==='table'?'删除表格':'删除块')
function close(){menu.value=null}
async function show(event:MouseEvent){
 const el=event.target instanceof Element?event.target:null,editor=props.editor,root=editor.view.dom
 if(!el)return
 if(!root.contains(el)){if(el.closest('#app')&&!el.closest('input,textarea,select'))event.preventDefault();return}
 if(el.closest('input,textarea,select'))return
 event.preventDefault();event.stopPropagation();emit('opening')
 const object=el.closest('img,.mermaid-preview,.table-block-handle,.code-controls'),wrapper=object?.matches('img')?object:object?.closest('.code-block,.paged-table')||object
 const target=wrapper&&blocks(editor).find(b=>editor.view.nodeDOM(b.pos)===wrapper),current=editor.state.selection
 if(target){if(!selectionBlocks(current).some(r=>r.from===target.pos))selectBlocks(editor,[{from:target.pos,to:target.end}])}
 else{
  const cell=el.closest('td,th'),selected=current instanceof CellSelection&&cell?.classList.contains('selectedCell')||current instanceof NodeSelection&&current.node.type.name==='table'&&!!editor.view.nodeDOM(current.from)?.contains(el)
  if(!selected){const point=editor.view.posAtCoords({left:event.clientX,top:event.clientY});if(point&&(current.empty||point.pos<current.from||point.pos>current.to))editor.view.dispatch(editor.state.tr.setSelection(TextSelection.near(editor.state.doc.resolve(point.pos))))}
 }
 version.value++;const caret=event.clientX||event.clientY?null:editor.view.coordsAtPos(editor.state.selection.from)
 menu.value={left:Math.max(8,Math.min(event.clientX||caret?.left||8,innerWidth-244)),top:Math.max(8,event.clientY||caret?.bottom||100)}
 await nextTick();if(menu.value&&panel.value){menu.value.top=Math.max(8,Math.min(menu.value.top,innerHeight-panel.value.getBoundingClientRect().height-8));panel.value.focus()}
}
async function run(action:string){
 close();const e=props.editor;e.view.focus()
 try{if(action==='copy'||action==='cut')await copyEditorSelection(e,action==='cut');if(action==='paste'||action==='plain')await pasteEditorClipboard(e,action==='plain');if(action==='undo')e.chain().focus().undo().run();if(action==='redo')e.chain().focus().redo().run();if(action==='all'){const s=e.state.selection;if(s.$from.parent.type.name==='codeBlock'&&s.$from.sameParent(s.$to))e.commands.setTextSelection({from:s.$from.start(),to:s.$from.end()});else e.commands.selectAll();e.view.focus()};if(action==='duplicate')duplicateBlocks(e,selectedBlocks(e));if(action==='delete'){if(!deleteTableSelection(e))deleteBlockSelection(e)}}catch(error){emit('error',error)}
}
function tableMenu(kind:'row'|'column'|'all'){const point=menu.value!;close();emit('table',{x:point.left,y:point.top,kind})}
function key(event:KeyboardEvent){if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();props.editor.view.focus();return}if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return;event.preventDefault();const buttons=[...panel.value!.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')],index=buttons.indexOf(document.activeElement as HTMLButtonElement);buttons[event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(event.key==='ArrowUp'?-1:1)+buttons.length)%buttons.length]?.focus()}
function outside(event:PointerEvent){if(!panel.value?.contains(event.target as Node))close()}
function scroll(event:Event){if(!panel.value?.contains(event.target as Node))close()}
function update({transaction}:any){version.value++;if(transaction.docChanged)close()}
onMounted(()=>{document.addEventListener('contextmenu',show,true);document.addEventListener('pointerdown',outside,true);window.addEventListener('scroll',scroll,true);window.addEventListener('resize',close);window.addEventListener('blur',close);props.editor.on('transaction',update)})
onBeforeUnmount(()=>{document.removeEventListener('contextmenu',show,true);document.removeEventListener('pointerdown',outside,true);window.removeEventListener('scroll',scroll,true);window.removeEventListener('resize',close);window.removeEventListener('blur',close);props.editor.off('transaction',update)})
</script>
<template><Teleport to="body"><section v-if="menu" ref="panel" class="table-context-menu editor-context-menu" role="menu" :aria-label="t('编辑菜单')" tabindex="-1" :style="{left:menu.left+'px',top:menu.top+'px'}" @mousedown.prevent @contextmenu.prevent @keydown="key">
 <button role="menuitem" :aria-label="t('撤销')" :disabled="!editor.can().undo()" @click="run('undo')"><Undo2 :size="14"/>{{t('撤销')}}<span>Ctrl+Z</span></button><button role="menuitem" :aria-label="t('重做')" :disabled="!editor.can().redo()" @click="run('redo')"><Redo2 :size="14"/>{{t('重做')}}<span>Ctrl+Y</span></button><hr>
 <button role="menuitem" :aria-label="t('剪切')" :disabled="!canCopy" @click="run('cut')"><Scissors :size="14"/>{{t('剪切')}}<span>Ctrl+X</span></button><button role="menuitem" :aria-label="t('复制')" :disabled="!canCopy" @click="run('copy')"><Copy :size="14"/>{{t('复制')}}<span>Ctrl+C</span></button><button role="menuitem" :aria-label="t('粘贴')" @click="run('paste')"><Clipboard :size="14"/>{{t('粘贴')}}<span>Ctrl+V</span></button><button role="menuitem" :aria-label="t('粘贴为纯文本')" @click="run('plain')"><Clipboard :size="14"/>{{t('粘贴为纯文本')}}<span>Ctrl+Shift+V</span></button><button role="menuitem" :aria-label="t('全选')" @click="run('all')"><TextSelect :size="14"/>{{t('全选')}}<span>Ctrl+A</span></button>
 <template v-if="table"><hr><button role="menuitem" @click="tableMenu('row')"><Rows3 :size="14"/>{{t('行操作')}}</button><button role="menuitem" @click="tableMenu('column')"><Columns3 :size="14"/>{{t('列操作')}}</button><button role="menuitem" @click="tableMenu('all')"><Settings2 :size="14"/>{{t('表格设置')}}</button></template>
 <template v-if="block"><hr><BlockLayoutControls :editor="editor" :version="version"/><button role="menuitem" @click="run('duplicate')"><Files :size="14"/>{{t('创建副本')}}</button></template>
 <template v-if="block||kind==='row'||kind==='column'"><hr><button role="menuitem" class="danger-action" @click="run('delete')"><Trash2 :size="14"/>{{t(removeLabel)}}</button></template>
</section></Teleport></template>
