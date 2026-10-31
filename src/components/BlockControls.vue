<script setup lang="ts">
import { ref,shallowRef,onMounted,onBeforeUnmount } from 'vue'
import type { Editor } from '@tiptap/core'
import { GripVertical,Copy,ArrowUp,ArrowDown,Trash2,Pilcrow,Heading1,Heading2,Heading3,List,ListOrdered,ListChecks,Quote } from 'lucide-vue-next'
import { blocks,blockAction,moveBlock,type BlockInfo } from '../block-tools'
import { t } from '../i18n'
const props=defineProps<{editor:Editor}>(),target=shallowRef<BlockInfo>(),anchor=ref({left:0,top:0}),menu=ref(false),menuStyle=ref({left:'0px',top:'0px'}),dragging=ref(false)
let element:HTMLElement|undefined,lastElement:HTMLElement|undefined,ghost:HTMLElement|undefined,line:HTMLElement|undefined,sourceStyle:HTMLStyleElement|undefined,cleanup:(()=>void)|undefined
// Turning a block into another type is the same verb in every row, so the icon carries
// the outcome and the label stays short enough to scan in one pass.
const types:[string,string,object][]=[['paragraph','正文',Pilcrow],['h1','标题 1',Heading1],['h2','标题 2',Heading2],['h3','标题 3',Heading3],['bulletList','无序列表',List],['orderedList','有序列表',ListOrdered],['taskList','待办列表',ListChecks],['blockquote','引用',Quote]]
// Mark the row the block already is, so the menu shows the current type instead of a bare list.
const current=(block:BlockInfo)=>block.node.type.name==='heading'?`h${block.node.attrs.level}`:block.node.type.name
function position(){if(!element?.isConnected){target.value=undefined;return}const box=element.getBoundingClientRect(),canvas=props.editor.view.dom.closest('.canvas')?.getBoundingClientRect();if(canvas&&(box.bottom<canvas.top||box.top>canvas.bottom)){target.value=undefined;lastElement=undefined;return}anchor.value={left:box.left-34,top:Math.max(canvas?.top||90,box.top)+2}}
function hover(event:MouseEvent){if(dragging.value||menu.value)return;let top=event.target as HTMLElement;if(top.closest('.table-resizers,.block-controls'))return;while(top&&top.parentElement!==props.editor.view.dom)top=top.parentElement!;if(!top||top===lastElement)return;lastElement=top
  try{const pos=props.editor.view.posAtDOM(top,0),block=blocks(props.editor).find(b=>pos>=b.pos&&pos<b.end);if(!block||block.node.type.name==='table'){target.value=undefined;return}element=top;target.value=block;position()}catch{target.value=undefined}}
function outside(event:PointerEvent){if(!(event.target as Element).closest('.block-actions,.block-grip'))menu.value=false}
function action(name:string){if(target.value)blockAction(props.editor,target.value,name);menu.value=false;target.value=undefined;lastElement=undefined}
let ignoreClick=false
function start(event:PointerEvent){if(event.button!==0||!target.value||!element)return;event.preventDefault();event.stopPropagation();cleanup?.()
  const source=target.value,startDoc=props.editor.state.doc,startX=event.clientX,startY=event.clientY,original=element,box=original.getBoundingClientRect(),canvas=props.editor.view.dom.closest<HTMLElement>('.canvas');let moved=false,last=event,drop=source.pos,frame=0
  const draw=()=>{frame=0;if(!moved)return;const at=props.editor.view.posAtCoords({left:last.clientX,top:last.clientY});if(at){const block=blocks(props.editor).find(b=>at.pos>=b.pos&&at.pos<b.end);if(block){const dom=props.editor.view.nodeDOM(block.pos) as HTMLElement,b=dom.getBoundingClientRect(),after=last.clientY>b.top+b.height/2;drop=after?block.end:block.pos;if(line)line.style.cssText=`left:${b.left}px;top:${after?b.bottom:b.top}px;width:${b.width}px`}}if(ghost)ghost.style.transform=`translate3d(${last.clientX-(startX-box.left)}px,${last.clientY-(startY-box.top)}px,0)`}
  const move=(e:PointerEvent)=>{last=e;if(!moved&&Math.hypot(e.clientX-startX,e.clientY-startY)>5){moved=true;dragging.value=true;menu.value=false;ghost=document.createElement('div');ghost.className='paper-editor block-drag-ghost';ghost.style.cssText=`width:${box.width}px!important;font:${getComputedStyle(original).font}`;const clone=original.cloneNode(true) as HTMLElement;clone.classList.remove('writing-muted');clone.querySelectorAll('button,input,textarea,.block-controls').forEach(el=>el.remove());ghost.append(clone);document.body.append(ghost);line=document.createElement('div');line.className='block-drop-line';document.body.append(line);original.classList.add('block-drag-source');sourceStyle=document.createElement('style');sourceStyle.textContent=`#app .paper-editor>:nth-child(${[...props.editor.view.dom.children].indexOf(original)+1}){visibility:hidden!important}`;document.head.append(sourceStyle)}if(moved&&!frame)frame=requestAnimationFrame(draw)}
  let scrollFrame=0
  const scroll=()=>{if(moved&&canvas){const b=canvas.getBoundingClientRect(),delta=last.clientY<b.top+30?-16:last.clientY>b.bottom-30?16:0;if(delta){canvas.scrollTop+=delta;if(!frame)frame=requestAnimationFrame(draw)}}scrollFrame=requestAnimationFrame(scroll)};scrollFrame=requestAnimationFrame(scroll)
  const clean=()=>{cancelAnimationFrame(frame);cancelAnimationFrame(scrollFrame);original.classList.remove('block-drag-source');sourceStyle?.remove();sourceStyle=undefined;ghost?.remove();line?.remove();ghost=undefined;line=undefined;dragging.value=false;document.removeEventListener('pointermove',move);document.removeEventListener('pointerup',up);document.removeEventListener('pointercancel',cancel);document.removeEventListener('keydown',key,true);window.removeEventListener('blur',cancel);cleanup=undefined}
  const cancel=()=>{ignoreClick=moved;clean();setTimeout(()=>ignoreClick=false,0)}
  const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();cancel()}}
  const up=()=>{cancelAnimationFrame(frame);draw();const valid=props.editor.state.doc.eq(startDoc);ignoreClick=moved;clean();if(moved&&valid)moveBlock(props.editor,source,drop);if(moved){target.value=undefined;lastElement=undefined;setTimeout(()=>ignoreClick=false,0)}}
  cleanup=cancel;document.addEventListener('pointermove',move);document.addEventListener('pointerup',up);document.addEventListener('pointercancel',cancel);document.addEventListener('keydown',key,true);window.addEventListener('blur',cancel)
}
// The menu is 206px wide and up to 64dvh tall: clamp it to the viewport so a block near
// the bottom edge does not open a menu that runs off-screen.
function place(){const height=Math.min(window.innerHeight*.64,440),top=Math.min(Math.max(8,anchor.value.top+32),Math.max(8,window.innerHeight-height-8));menuStyle.value={left:`${Math.max(8,Math.min(anchor.value.left,window.innerWidth-214))}px`,top:`${top}px`}}
function click(){if(ignoreClick){ignoreClick=false;return}if(!menu.value)place();menu.value=!menu.value}
function update(){if(!dragging.value&&target.value&&(target.value.pos>props.editor.state.doc.content.size||!props.editor.state.doc.nodeAt(target.value.pos)?.eq(target.value.node))){target.value=undefined;menu.value=false;lastElement=undefined}}
onMounted(()=>{props.editor.view.dom.addEventListener('mousemove',hover);props.editor.on('transaction',update);document.addEventListener('pointerdown',outside);window.addEventListener('scroll',position,true)})
onBeforeUnmount(()=>{cleanup?.();props.editor.view.dom.removeEventListener('mousemove',hover);props.editor.off('transaction',update);document.removeEventListener('pointerdown',outside);window.removeEventListener('scroll',position,true)})
</script>
<template><Teleport to="body"><button v-if="target&&!dragging" class="block-grip" :class="{ active: menu }" :style="{left:anchor.left+'px',top:anchor.top+'px'}" :aria-label="t('块操作')" :title="t('拖动块或点击打开菜单')" :aria-expanded="menu" @pointerdown="start" @click="click"><GripVertical :size="17" /></button><section v-if="menu&&target" class="block-actions" role="menu" :aria-label="t('块操作')" :style="menuStyle" @keydown.esc.stop="menu=false">
  <button role="menuitem" @click="action('duplicate')"><Copy :size="14" />{{t('复制块')}}</button>
  <button role="menuitem" @click="action('up')"><ArrowUp :size="14" />{{t('上移块')}}</button>
  <button role="menuitem" @click="action('down')"><ArrowDown :size="14" />{{t('下移块')}}</button>
  <hr>
  <template v-if="['paragraph','heading','bulletList','orderedList','taskList','blockquote'].includes(target.node.type.name)"><small>{{t('转换为')}}</small>
    <button v-for="[type,label,icon] in types" :key="type" role="menuitem" :class="{ chosen: current(target) === type }" :aria-current="current(target) === type ? 'true' : undefined" @click="action(type!)"><component :is="icon" :size="14" />{{t(label!)}}</button>
    <hr>
  </template>
  <button class="danger-action" role="menuitem" @click="action('delete')"><Trash2 :size="14" />{{t('删除块')}}</button>
</section></Teleport></template>
