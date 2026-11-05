<script setup lang="ts">
import {computed} from 'vue'
import type {Editor} from '@tiptap/core'
import {closeHistory} from '@tiptap/pm/history'
import {NodeSelection} from '@tiptap/pm/state'
import {CellSelection} from '@tiptap/pm/tables'
import {tableSelectionKey,tableSelectionKind} from '../table'
import {AlignHorizontalJustifyStart,AlignHorizontalJustifyCenter,AlignHorizontalJustifyEnd,RotateCcw} from 'lucide-vue-next'
import {objectBlock} from '../block-geometry'
import {t} from '../i18n'
const props=defineProps<{editor:Editor;version:number}>()
const target=computed(()=>{props.version;return objectBlock(props.editor)})
const choices=[['left',AlignHorizontalJustifyStart],['center',AlignHorizontalJustifyCenter],['right',AlignHorizontalJustifyEnd]] as const
function label(side:string){const n=target.value?.node,prefix=n?.type.name==='image'?'图片':n?.type.name==='table'?'表格整体':String(n?.attrs.language).toLowerCase()==='mermaid'?'图表':'代码块';return prefix+(side==='center'?'居中':side==='left'?'靠左':'靠右')}
const sized=computed(()=>{const n=target.value?.node;return n&&n.type.name!=='image'&&(n.attrs.tableWidth||n.attrs.diagramWidth||n.attrs.codeWidth)})
function apply(attrs:Record<string,unknown>){const b=target.value;if(!b)return;const selection=props.editor.state.selection,tr=closeHistory(props.editor.state.tr).setNodeMarkup(b.pos,undefined,{...b.node.attrs,...attrs});if(selection instanceof NodeSelection)tr.setSelection(NodeSelection.create(tr.doc,b.pos));if(selection instanceof CellSelection)tr.setSelection(new CellSelection(tr.doc.resolve(selection.$anchorCell.pos),tr.doc.resolve(selection.$headCell.pos))).setMeta(tableSelectionKey,tableSelectionKind(props.editor));props.editor.view.dispatch(tr);props.editor.view.focus()}
function reset(){const n=target.value!.node;apply(n.type.name==='table'?{tableWidth:null,tableScale:1}:{diagramWidth:null,codeWidth:null,codeScale:1})}
</script>
<template><div v-if="target" class="object-layout-controls" role="group" :aria-label="t('块布局')"><button v-for="[side,icon] in choices" :key="side" class="icon-btn" :class="{selected:(target.node.attrs.blockAlign||'left')===side}" :aria-pressed="(target.node.attrs.blockAlign||'left')===side" :aria-label="t(label(side))" :title="t(label(side))" @mousedown.prevent @click="apply({blockAlign:side})"><component :is="icon" :size="16"/></button><button v-if="sized" class="icon-btn" :aria-label="t('重置块尺寸')" :title="t('重置块尺寸')" @mousedown.prevent @click="reset"><RotateCcw :size="15"/></button></div></template>
