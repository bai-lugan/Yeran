<script setup lang="ts">
import {ref,computed,onMounted,onBeforeUnmount} from 'vue'
import type {Editor} from '@tiptap/core'
import {Copy,Files,Trash2} from 'lucide-vue-next'
import {blocks,selectedBlocks,duplicateBlocks,type BlockInfo} from '../block-tools'
import {BlockSelection,selectBlocks,selectionBlocks,deleteBlockSelection,type BlockRange} from '../block-selection'
import {Selection} from '@tiptap/pm/state'
import {copyBlockNodes} from '../block-clipboard'
import {t} from '../i18n'
import {blockFragments} from '../block-fragments'
import {getPageSlices,mm} from '../document'
const props=defineProps<{editor:Editor}>(),emit=defineEmits<{error:[unknown];copied:[]}>(),version=ref(0),rectangle=ref<{left:number;top:number;width:number;height:number}|null>(null)
const count=computed(()=>{version.value;const s=props.editor.state.selection;return s instanceof BlockSelection?s.blocks.length:0})
let cleanup:(()=>void)|undefined,ignoreClick=false
function boxes(block:BlockInfo){const el=props.editor.view.nodeDOM(block.pos) as HTMLElement|null;if(!el||el.closest('details:not([open])'))return[];return blockFragments(props.editor,el)}
function outsideTextColumn(x:number,y:number){
 const root=props.editor.view.dom,b=root.getBoundingClientRect(),scale=b.width/root.offsetWidth||1,style=getComputedStyle(root)
 let left=b.left+parseFloat(style.paddingLeft)*scale,right=b.right-parseFloat(style.paddingRight)*scale
 if(!props.editor.storage.mixedPagination.continuous){const slices=getPageSlices(root),sheet=slices.find(s=>y<b.top+(s.top+s.height)*scale)||slices.at(-1);if(sheet){const margin=mm(props.editor.storage.mixedPagination.margin)*scale;left=b.left+(sheet.left||0)*scale+margin;right=b.left+((sheet.left||0)+(sheet.width||root.offsetWidth))*scale-margin}}
 return x<left||x>right
}
function down(event:PointerEvent){
 ignoreClick=false
 cleanup?.()
 if(event.button!==0||event.pointerType==='touch'||!(event.target instanceof Element))return
 const root=props.editor.view.dom,canvas=root.closest<HTMLElement>('.canvas'),el=event.target
 if(!canvas?.contains(el)||el.closest('button,input,textarea,select,td,th,pre,code,img,summary,.mermaid-preview,.table-resizers,.canvas-meta,.block-selection-tools'))return
 if(!outsideTextColumn(event.clientX,event.clientY))return
 const initial=props.editor.state.selection,doc=props.editor.state.doc,start={x:event.clientX,y:event.clientY},initialScroll={x:canvas.scrollLeft,y:canvas.scrollTop},add=event.ctrlKey||event.metaKey,kept=add?selectionBlocks(initial):[],pointerId=event.pointerId
 let active=true,moved=false,last=event,frame=0,scrollFrame=0,current:BlockRange[]=[]
 const paint=()=>{frame=0;if(!active||!moved)return;const anchor={x:start.x-(canvas.scrollLeft-initialScroll.x),y:start.y-(canvas.scrollTop-initialScroll.y)},r={left:Math.min(anchor.x,last.clientX),top:Math.min(anchor.y,last.clientY),width:Math.abs(last.clientX-anchor.x),height:Math.abs(last.clientY-anchor.y)},clip=canvas.getBoundingClientRect();rectangle.value={left:Math.max(clip.left,r.left),top:Math.max(clip.top,r.top),width:Math.max(0,Math.min(clip.right,r.left+r.width)-Math.max(clip.left,r.left)),height:Math.max(0,Math.min(clip.bottom,r.top+r.height)-Math.max(clip.top,r.top))}
  const matches=blocks(props.editor).filter(b=>b.node.type.name!=='pageBreak'&&boxes(b).some(box=>box.width&&box.height&&r.left<box.right&&r.left+r.width>box.left&&r.top<box.bottom&&r.top+r.height>box.top)).map(b=>({from:b.pos,to:b.end}))
  current=[...kept,...matches];if(current.length)selectBlocks(props.editor,current);else props.editor.view.dispatch(props.editor.state.tr.setSelection(Selection.near(props.editor.state.doc.resolve(Math.min(props.editor.state.doc.content.size,initial.from)))))
 }
 const move=(e:PointerEvent)=>{if(!active||e.pointerId!==pointerId)return;last=e;if(!(e.buttons&1)){up(e);return}if(!moved&&Math.hypot(e.clientX-start.x,e.clientY-start.y)>5){moved=true;document.body.classList.add('block-marquee-active');try{canvas.setPointerCapture(pointerId)}catch{/* Capture can be unavailable after a window transition. */}}if(moved){e.preventDefault();if(!frame)frame=requestAnimationFrame(paint)}}
 const scroll=()=>{if(!active)return;if(moved){const b=canvas.getBoundingClientRect(),delta=last.clientY<b.top+26?-14:last.clientY>b.bottom-26?14:0;if(delta){canvas.scrollTop+=delta;if(!frame)frame=requestAnimationFrame(paint)}}scrollFrame=requestAnimationFrame(scroll)};scrollFrame=requestAnimationFrame(scroll)
 const nativeDrag=(e:DragEvent)=>{e.preventDefault();e.stopPropagation()}
 const clean=()=>{active=false;cancelAnimationFrame(frame);cancelAnimationFrame(scrollFrame);frame=scrollFrame=0;document.body.classList.remove('block-marquee-active');rectangle.value=null;document.removeEventListener('pointermove',move,true);window.removeEventListener('pointerup',up,true);window.removeEventListener('mouseup',up,true);window.removeEventListener('pointercancel',cancel,true);canvas.removeEventListener('lostpointercapture',cancel);document.removeEventListener('visibilitychange',visibility);document.removeEventListener('keydown',key,true);document.removeEventListener('dragstart',nativeDrag,true);window.removeEventListener('blur',cancel);cleanup=undefined;if(canvas.hasPointerCapture(pointerId))canvas.releasePointerCapture(pointerId)}
 const cancel=()=>{if(!active)return;const same=!props.editor.isDestroyed&&props.editor.state.doc===doc;clean();if(same&&moved)props.editor.view.dispatch(props.editor.state.tr.setSelection(initial))},key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();cancel()}},visibility=()=>{if(document.visibilityState==='hidden')cancel()}
 const up=(e:MouseEvent)=>{if(!active||e.button>0||e instanceof PointerEvent&&e.pointerId!==pointerId)return;try{cancelAnimationFrame(frame);frame=0;if(moved)paint()}finally{ignoreClick=moved;clean()}if(moved&&current.length)props.editor.view.focus();else if(!moved&&!add&&!root.contains(e.target as globalThis.Node))clearSelection()}
 cleanup=cancel;document.addEventListener('pointermove',move,{passive:false,capture:true});window.addEventListener('pointerup',up,true);window.addEventListener('mouseup',up,true);window.addEventListener('pointercancel',cancel,true);canvas.addEventListener('lostpointercapture',cancel);document.addEventListener('visibilitychange',visibility);document.addEventListener('keydown',key,true);document.addEventListener('dragstart',nativeDrag,true);window.addEventListener('blur',cancel)
}
function clearSelection(){if(selectionBlocks(props.editor.state.selection).length)selectBlocks(props.editor,[])}
function escape(event:KeyboardEvent){if(event.key==='Escape'&&!event.defaultPrevented&&!cleanup&&!(event.target as Element)?.closest?.('input,textarea,select,[role="dialog"]')&&selectionBlocks(props.editor.state.selection).length){event.preventDefault();clearSelection()}}
function click(event:MouseEvent){if(ignoreClick){ignoreClick=false;event.preventDefault();event.stopPropagation()}}
function update({transaction}:any){version.value++;if(transaction.docChanged)cleanup?.()}
async function copy(){try{await copyBlockNodes(props.editor,selectedBlocks(props.editor).map(b=>b.node));emit('copied')}catch(error){emit('error',error)}}
onMounted(()=>{document.addEventListener('pointerdown',down,true);document.addEventListener('click',click,true);document.addEventListener('keydown',escape);props.editor.on('transaction',update)})
onBeforeUnmount(()=>{cleanup?.();document.removeEventListener('pointerdown',down,true);document.removeEventListener('click',click,true);document.removeEventListener('keydown',escape);props.editor.off('transaction',update)})
</script>
<template><Teleport to="body"><div v-if="rectangle" class="block-marquee" :style="{left:rectangle.left+'px',top:rectangle.top+'px',width:rectangle.width+'px',height:rectangle.height+'px'}"></div><div v-if="count>1&&!rectangle" class="block-selection-tools" role="toolbar" :aria-label="t('选中块操作')" @mousedown.prevent><span>{{count}} {{t('个块')}}</span><button :aria-label="t('复制选中块')" @click="copy"><Copy :size="15"/>{{t('复制')}}</button><button :aria-label="t('创建选中块副本')" @click="duplicateBlocks(editor,selectedBlocks(editor))"><Files :size="15"/>{{t('创建副本')}}</button><button :aria-label="t('删除选中块')" @click="deleteBlockSelection(editor)"><Trash2 :size="15"/>{{t('删除')}}</button></div></Teleport></template>
