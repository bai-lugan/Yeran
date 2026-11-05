<script setup lang="ts">
import { ref,shallowRef,computed,onMounted,onBeforeUnmount } from 'vue'
import type { Editor } from '@tiptap/core'
import { GripVertical,Plus,Copy,ArrowUp,ArrowDown,Trash2,Pilcrow,Heading1,Heading2,Heading3,List,ListOrdered,ListChecks,Quote } from 'lucide-vue-next'
import { blocks,blockAction,moveBlock,moveBlocks,selectedBlocks,duplicateBlocks,insertBlockAfter,type BlockInfo } from '../block-tools'
import {selectBlocks,selectionBlocks,deleteBlockSelection} from '../block-selection'
import {copyBlockNodes} from '../block-clipboard'
import {blockFragments,blockViewport,textBlockTypes} from '../block-fragments'
import { t } from '../i18n'
const props=defineProps<{editor:Editor}>(),emit=defineEmits<{insert:[];error:[unknown];copied:[]}>()
const selectionVersion=ref(0),multi=computed(()=>{selectionVersion.value;return !!target.value&&selectedBlocks(props.editor,target.value).length>1})
const target=shallowRef<BlockInfo>(),anchor=ref({left:0,top:0}),menu=ref(false),menuStyle=ref({left:'0px',top:'0px'}),dragging=ref(false)
let element:HTMLElement|undefined,ghost:HTMLElement|undefined,line:HTMLElement|undefined,sourceStyle:HTMLStyleElement|undefined,cleanup:(()=>void)|undefined
let hideTimer:ReturnType<typeof setTimeout>|undefined,pressed=false,ignoreClick=false
let restoreOnRelease:(()=>void)|undefined,restoreFrame=0
let fragmentIndex=0
const types:[string,string,object][]=[['paragraph','正文',Pilcrow],['h1','标题 1',Heading1],['h2','标题 2',Heading2],['h3','标题 3',Heading3],['bulletList','无序列表',List],['orderedList','有序列表',ListOrdered],['taskList','待办列表',ListChecks],['blockquote','引用',Quote]]
const current=(block:BlockInfo)=>block.node.type.name==='heading'?`h${block.node.attrs.level}`:block.node.type.name
function keep(){clearTimeout(hideTimer);hideTimer=undefined}
function clear(){keep();target.value=undefined;element=undefined;fragmentIndex=0}
function hideLater(){if(!hideTimer&&!menu.value&&!pressed&&!dragging.value)hideTimer=setTimeout(clear,500)}
function nodeDOM(block:BlockInfo){const el=props.editor.view.nodeDOM(block.pos);return el instanceof HTMLElement?el:undefined}
function rect(el:HTMLElement){return el.matches('details')?el.querySelector('summary')!.getBoundingClientRect():el.getBoundingClientRect()}
function position(){
  if(pressed||dragging.value)return
  if(!element?.isConnected||!element.getClientRects().length){clear();return}
  const fragments=blockFragments(props.editor,element),canvas=blockViewport(props.editor)
  let box=fragments[fragmentIndex]
  if(!box||canvas&&(box.bottom<canvas.top||box.top>canvas.bottom)){fragmentIndex=fragments.findIndex(r=>!canvas||r.bottom>canvas.top&&r.top<canvas.bottom);box=fragments[fragmentIndex]}
  if(!box){clear();return}
  anchor.value={left:Math.max((canvas?.left||0)+34,box.left-34),top:Math.max((canvas?.top||90)+3,box.top)+2}
}
function fromElement(el:Element|null,all:BlockInfo[]){
  const root=props.editor.view.dom
  while(el&&el!==root){const found=all.find(b=>nodeDOM(b)===el);if(found)return found;el=el.parentElement}
}
function inCorridor(x:number,y:number){
  if(!element||!target.value)return false
  const b=blockFragments(props.editor,element)[fragmentIndex];if(!b)return false
  return x>=anchor.value.left-40&&x<=b.left+3&&y>=anchor.value.top-9&&y<=anchor.value.top+37
}
function hover(event:MouseEvent){
  if(dragging.value||menu.value||pressed||document.body.classList.contains('block-marquee-active'))return
  const el=event.target instanceof Element?event.target:null,root=props.editor.view.dom
  if(el?.closest('.block-gutter,.block-actions')||inCorridor(event.clientX,event.clientY)){keep();return}
  const canvas=root.closest('.canvas');if(!el||!canvas?.contains(el)||el.closest('.canvas-meta')){hideLater();return}
  if(el.closest('.table-resizers,.block-controls,.mermaid-zoom-controls')){hideLater();return}
  const all=blocks(props.editor),direct=root.contains(el)?fromElement(el,all):undefined
  if(direct&&['table','pageBreak'].includes(direct.node.type.name)){clear();return}
  const hit=(block:BlockInfo,gutter:boolean)=>{if(['table','pageBreak'].includes(block.node.type.name))return;const dom=nodeDOM(block);if(!dom?.getClientRects().length)return;const bounds=rect(dom);if(event.clientY<bounds.top-10||event.clientY>bounds.bottom+10)return;const fragments=blockFragments(props.editor,dom),index=fragments.findIndex(r=>event.clientY>=r.top-8&&event.clientY<=r.bottom+8&&(!gutter||event.clientX<=r.left+8));return index<0?undefined:{block,dom,index}}
  let found=direct&&hit(direct,false)
  if(!found)for(const block of all){found=hit(block,true);if(found)break}
  if(!found){hideLater();return}
  keep();element=found.dom;target.value=found.block;fragmentIndex=found.index;position()
}
function outside(event:PointerEvent){if(!(event.target as Element).closest('.block-actions,.block-gutter'))menu.value=false}
function pointer(){ignoreClick=false;restoreOnRelease=undefined;cancelAnimationFrame(restoreFrame)}
function release(){if(restoreOnRelease){const restore=restoreOnRelease;restoreOnRelease=undefined;restoreFrame=requestAnimationFrame(restore)}}
function dropClick(event:MouseEvent){if(ignoreClick){ignoreClick=false;event.preventDefault();event.stopPropagation()}}
function escape(event:KeyboardEvent){if(event.key==='Escape'&&menu.value){event.preventDefault();menu.value=false;hideLater()}}
async function action(name:string){const block=target.value;if(!block)return;const sources=selectedBlocks(props.editor,block);menu.value=false
 try{if(name==='copy'){await copyBlockNodes(props.editor,sources.map(b=>b.node));emit('copied')}else if(name==='duplicate')duplicateBlocks(props.editor,sources);else if(name==='delete')deleteBlockSelection(props.editor);else blockAction(props.editor,block,name)}catch(error){emit('error',error)}clear()}
function add(){const block=target.value;if(block&&insertBlockAfter(props.editor,block)){menu.value=false;clear();emit('insert')}}
interface Drop {pos:number;box:DOMRect;inside?:HTMLDetailsElement;after?:boolean}
function dropAt(x:number,y:number,source:BlockInfo,sources=[source]):Drop|undefined{
  const editor=props.editor,root=editor.view.dom,all=blocks(editor),hit=document.elementFromPoint(x,y)
  const allowed=(pos:number)=>sources.every(s=>pos<s.pos||pos>s.end)
  const toggleDrop=(block:BlockInfo,el:HTMLElement):Drop|undefined=>{
    if(block.node.type.name!=='toggleBlock')return
    const contentPos=block.pos+1+block.node.firstChild!.nodeSize+1,pos=contentPos+block.node.child(1).content.size
    if(!allowed(pos))return
    const content=el.querySelector<HTMLElement>(':scope>.toggle-content')!,last=content.lastElementChild as HTMLElement|null
    const b=(el as HTMLDetailsElement).open&&last?last.getBoundingClientRect():rect(el)
    return{pos,box:b,inside:el as HTMLDetailsElement,after:true}
  }
  const summary=hit?.closest('summary'),details=summary?.parentElement
  if(details&&root.contains(details)){
    const block=all.find(b=>nodeDOM(b)===details),b=summary!.getBoundingClientRect()
    if(block&&x>b.left+22&&y>b.top+5&&y<b.bottom-3)return toggleDrop(block,details)
  }
  let block=hit&&root.contains(hit)?fromElement(hit,all):undefined
  if(block&&block.parentPos>=0){
    const parent=all.filter(b=>b.node.type.name==='toggleBlock'&&b.pos<block!.pos&&b.end>block!.end).at(-1),el=parent&&nodeDOM(parent)
    if(el&&x<rect(el).left+22)block=parent
  }
  const content=hit?.closest<HTMLElement>('.toggle-content')
  if(content&&root.contains(content)&&(!block||nodeDOM(block)?.contains(content))){
    const parent=all.find(b=>nodeDOM(b)===content.parentElement)
    if(parent)return toggleDrop(parent,content.parentElement!)
  }
  if(!block){
    const roots=all.filter(b=>b.parentPos<0).map(b=>({block:b,el:nodeDOM(b)})).filter(x=>x.el&&x.el.getClientRects().length)
    roots.sort((a,b)=>{const ra=a.el!.getBoundingClientRect(),rb=b.el!.getBoundingClientRect();return Math.min(Math.abs(y-ra.top),Math.abs(y-ra.bottom))-Math.min(Math.abs(y-rb.top),Math.abs(y-rb.bottom))})
    block=roots[0]?.block
  }
  if(!block)return
  const dom=nodeDOM(block);if(!dom)return
  const fragments=blockFragments(editor,dom);if(!fragments.length)return
  const first=fragments[0]!,last=fragments.at(-1)!,after=y>(first.top+last.bottom)/2,pos=after?block.end:block.pos,guide=after?last:first
  return allowed(pos)?{pos,box:new DOMRect(guide.left,guide.top,guide.width,guide.height),after}:undefined
}
function start(event:PointerEvent){
  if(event.button!==0||!target.value||!element)return
  event.preventDefault();event.stopPropagation();keep();cleanup?.();pressed=true
  const source=target.value,startDoc=props.editor.state.doc,startSelection=props.editor.state.selection,startX=event.clientX,startY=event.clientY,original=element,bounds=blockFragments(props.editor,element)[fragmentIndex]||element.getBoundingClientRect(),canvas=props.editor.view.dom.closest<HTMLElement>('.canvas'),box={left:bounds.left,top:Math.max(bounds.top,blockViewport(props.editor)?.top??bounds.top),width:bounds.width}
  const sources=selectedBlocks(props.editor,source)
  let moved=false,last=event,drop:Drop|undefined,frame=0,scrollFrame=0,highlight:HTMLElement|undefined,expandTimer:ReturnType<typeof setTimeout>|undefined,expandTarget:HTMLDetailsElement|undefined
  const draw=()=>{
    frame=0;if(!moved)return
    drop=dropAt(last.clientX,last.clientY,source,sources)
    if(highlight!==drop?.inside){highlight?.classList.remove('block-drop-inside');highlight=drop?.inside;highlight?.classList.add('block-drop-inside')}
    if(expandTarget!==drop?.inside){clearTimeout(expandTimer);expandTarget=drop?.inside;if(expandTarget&&!expandTarget.open)expandTimer=setTimeout(()=>{if(expandTarget){expandTarget.open=true;draw()}},500)}
    if(line){line.hidden=!drop;if(drop){const b=drop.box;line.style.cssText=`left:${b.left+(drop.inside?28:0)}px;top:${drop.after?b.bottom:b.top}px;width:${Math.max(30,b.width-(drop.inside?28:0))}px`}}
    if(ghost)ghost.style.transform=sources.length>1?`translate3d(${last.clientX+12}px,${last.clientY+12}px,0)`:`translate3d(${last.clientX-(startX-box.left)}px,${last.clientY-(startY-box.top)}px,0)`
  }
  const move=(e:PointerEvent)=>{
    last=e
    if(!moved&&Math.hypot(e.clientX-startX,e.clientY-startY)>5){
      moved=true;dragging.value=true;menu.value=false
      document.body.classList.add('block-dragging')
      ghost=document.createElement('div');ghost.className='paper-editor block-drag-ghost'
      const root=props.editor.view.dom,scale=root.getBoundingClientRect().width/root.offsetWidth||1,selectors:string[]=[]
      ghost.style.cssText=`width:${box.width}px!important;font:${getComputedStyle(original).font}`
      for(const source of sources){const dom=nodeDOM(source);if(!dom)continue;const clone=dom.cloneNode(true) as HTMLElement
       clone.classList.remove('writing-muted','block-drag-source','yeran-block-selected','yeran-selection-fragments','ProseMirror-selectednode');clone.style.width=`${textBlockTypes.has(source.node.type.name)?(blockFragments(props.editor,dom)[0]?.width||dom.getBoundingClientRect().width)/scale:dom.offsetWidth}px`;clone.style.margin='0';clone.style.transform=`scale(${scale})`;clone.style.transformOrigin='top left'
       clone.querySelectorAll('button,input,textarea,.block-controls,.mermaid-zoom-controls,.table-resizers,.code-resize-handles,.diagram-resize-handles').forEach(el=>el.remove());ghost.append(clone)
       const path:string[]=[];let part:HTMLElement|null=dom;while(part&&part!==props.editor.view.dom){const parent:HTMLElement|null=part.parentElement;if(!parent)break;path.unshift(`:nth-child(${[...parent.children].indexOf(part)+1})`);part=parent}selectors.push('#app .paper-editor>'+path.join('>'))
      }
      document.body.append(ghost);line=document.createElement('div');line.className='block-drop-line';document.body.append(line)
      sourceStyle=document.createElement('style');sourceStyle.textContent=selectors.join(',')+'{visibility:hidden!important}';document.head.append(sourceStyle)
    }
    if(moved&&!frame)frame=requestAnimationFrame(draw)
  }
  const scroll=()=>{if(moved&&canvas){const b=canvas.getBoundingClientRect(),delta=last.clientY<b.top+30?-16:last.clientY>b.bottom-30?16:0;if(delta){canvas.scrollTop+=delta;if(!frame)frame=requestAnimationFrame(draw)}}scrollFrame=requestAnimationFrame(scroll)}
  scrollFrame=requestAnimationFrame(scroll)
  const clean=()=>{cancelAnimationFrame(frame);cancelAnimationFrame(scrollFrame);clearTimeout(expandTimer);highlight?.classList.remove('block-drop-inside');original.classList.remove('block-drag-source');sourceStyle?.remove();sourceStyle=undefined;ghost?.remove();line?.remove();ghost=undefined;line=undefined;dragging.value=false;pressed=false;document.body.classList.remove('block-dragging');document.removeEventListener('pointermove',move);document.removeEventListener('pointerup',up);document.removeEventListener('pointercancel',cancel);document.removeEventListener('keydown',key,true);window.removeEventListener('blur',cancel);cleanup=undefined}
  const cancel=()=>{ignoreClick=moved;clean();if(moved&&props.editor.state.doc.eq(startDoc)){const restore=()=>{if(!props.editor.isDestroyed&&props.editor.state.doc.eq(startDoc)){props.editor.view.dispatch(props.editor.state.tr.setSelection(startSelection));props.editor.view.focus()}};restore();restoreOnRelease=restore}}
  const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();cancel()}}
  const up=()=>{cancelAnimationFrame(frame);draw();const valid=props.editor.state.doc.eq(startDoc),destination=drop?.pos;ignoreClick=moved;clean();if(moved&&valid&&destination!==undefined){if(sources.length>1)moveBlocks(props.editor,sources,destination);else moveBlock(props.editor,source,destination)}if(moved)clear()}
  cleanup=cancel;document.addEventListener('pointermove',move);document.addEventListener('pointerup',up);document.addEventListener('pointercancel',cancel);document.addEventListener('keydown',key,true);window.addEventListener('blur',cancel)
}
function place(){const height=Math.min(window.innerHeight*.64,440),top=Math.min(Math.max(8,anchor.value.top+32),Math.max(8,window.innerHeight-height-8));menuStyle.value={left:`${Math.max(8,Math.min(anchor.value.left,window.innerWidth-214))}px`,top:`${top}px`}}
function click(event:MouseEvent){if(ignoreClick){ignoreClick=false;return}const block=target.value;if(!block)return
 const current=selectionBlocks(props.editor.state.selection)
 if(event.shiftKey&&current.length){const anchor=blocks(props.editor).find(b=>b.pos===current[0]!.from);selectBlocks(props.editor,blocks(props.editor).filter(b=>b.parentPos===block.parentPos&&b.pos>=Math.min(anchor?.pos??block.pos,block.pos)&&b.pos<=Math.max(anchor?.pos??block.pos,block.pos)).map(b=>({from:b.pos,to:b.end})));menu.value=false;return}
 if(event.ctrlKey||event.metaKey){const exists=current.some(r=>r.from===block.pos),next=exists?current.filter(r=>r.from!==block.pos):[...current,{from:block.pos,to:block.end}];selectBlocks(props.editor,next);menu.value=false;return}
 if(!current.some(r=>r.from===block.pos))selectBlocks(props.editor,[{from:block.pos,to:block.end}]);if(!menu.value)place();menu.value=!menu.value;keep()}
function update({transaction}:{transaction:import('@tiptap/pm/state').Transaction}){selectionVersion.value++;if(dragging.value&&transaction.docChanged){cleanup?.();clear();return}if(transaction.docChanged&&menu.value||!dragging.value&&target.value&&(target.value.pos>props.editor.state.doc.content.size||!props.editor.state.doc.nodeAt(target.value.pos)?.eq(target.value.node))){menu.value=false;clear()}}
function externalDrag(event:Event){const e=event as CustomEvent;if(!props.editor.view.dom.contains(e.target as globalThis.Node))return;const block=blocks(props.editor).find(b=>b.pos===e.detail.pos);if(!block)return;target.value=block;element=nodeDOM(block);fragmentIndex=element?Math.max(0,blockFragments(props.editor,element).findIndex(r=>e.detail.pointer.clientY<=r.bottom)):0;start(e.detail.pointer)}
onMounted(()=>{document.addEventListener('mousemove',hover);document.addEventListener('yeran:block-drag',externalDrag);props.editor.on('transaction',update);document.addEventListener('pointerdown',outside);document.addEventListener('pointerdown',pointer,true);document.addEventListener('pointerup',release,true);document.addEventListener('click',dropClick,true);document.addEventListener('keydown',escape,true);window.addEventListener('scroll',position,true)})
onBeforeUnmount(()=>{cleanup?.();keep();cancelAnimationFrame(restoreFrame);restoreOnRelease=undefined;document.removeEventListener('mousemove',hover);document.removeEventListener('yeran:block-drag',externalDrag);props.editor.off('transaction',update);document.removeEventListener('pointerdown',outside);document.removeEventListener('pointerdown',pointer,true);document.removeEventListener('pointerup',release,true);document.removeEventListener('click',dropClick,true);document.removeEventListener('keydown',escape,true);window.removeEventListener('scroll',position,true)})
</script>
<template><Teleport to="body">
  <div v-if="target&&!dragging&&target.node.type.name!=='table'" class="block-gutter" :style="{left:(anchor.left-30)+'px',top:anchor.top+'px'}" @pointerenter="keep" @pointerleave="hideLater">
    <button class="block-add" :aria-label="t('添加块')" :title="t('在下方插入块')" @pointerdown.prevent @click="add"><Plus :size="18" /></button>
    <button class="block-grip" :class="{active:menu}" :aria-label="t('块操作')" :title="t('拖动块或点击打开菜单')" :aria-expanded="menu" @pointerdown="start" @click="click"><GripVertical :size="18" /></button>
  </div>
  <section v-if="menu&&target" class="block-actions" role="menu" :aria-label="t('块操作')" :style="menuStyle" @keydown.esc.stop="menu=false" @pointerenter="keep">
    <button role="menuitem" @click="action('copy')"><Copy :size="14" />{{t('复制块')}}</button>
    <button role="menuitem" @click="action('duplicate')"><Copy :size="14" />{{t('创建副本')}}</button>
    <button v-if="!multi" role="menuitem" @click="action('up')"><ArrowUp :size="14" />{{t('上移块')}}</button>
    <button v-if="!multi" role="menuitem" @click="action('down')"><ArrowDown :size="14" />{{t('下移块')}}</button><hr>
    <template v-if="!multi&&['paragraph','heading','bulletList','orderedList','taskList','blockquote'].includes(target.node.type.name)"><small>{{t('转换为')}}</small>
      <button v-for="[type,label,icon] in types" :key="type" role="menuitem" :class="{chosen:current(target)===type}" :aria-current="current(target)===type?'true':undefined" @click="action(type)"><component :is="icon" :size="14" />{{t(label)}}</button><hr>
    </template>
    <button class="danger-action" role="menuitem" @click="action('delete')"><Trash2 :size="14" />{{t('删除块')}}</button>
  </section>
</Teleport></template>
