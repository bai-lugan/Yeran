<script setup lang="ts">
import {ref,onMounted,onBeforeUnmount} from 'vue'
import type {Editor} from '@tiptap/core'
import {NodeSelection} from '@tiptap/pm/state'
import {closeHistory} from '@tiptap/pm/history'
import {imageRatioLocked} from '../image-sizing'
import {getPageSlices,mm} from '../document'
import {t} from '../i18n'
const props=defineProps<{editor:Editor}>(),box=ref<{left:number;top:number;width:number;height:number}|null>(null),dragging=ref(false),size=ref({width:0,height:0})
let frame=0,cleanup:(()=>void)|undefined
function position(){
 const {selection}=props.editor.state
 if(!(selection instanceof NodeSelection)||selection.node.type.name!=='image'){if(!dragging.value)box.value=null;return}
 const img=props.editor.view.nodeDOM(selection.from) as HTMLElement|null,canvas=props.editor.view.dom.closest('.canvas')?.getBoundingClientRect()
 if(!img||!canvas){box.value=null;return}
 const b=img.getBoundingClientRect();box.value=b.width>0&&b.height>0&&b.bottom>canvas.top&&b.top<canvas.bottom?{left:b.left,top:b.top,width:b.width,height:b.height}:null
}
function schedule(){cancelAnimationFrame(frame);frame=requestAnimationFrame(position)}
function start(event:PointerEvent,corner:string){
 if(event.button!==0)return
 const editor=props.editor,{selection,doc}=editor.state
 if(!(selection instanceof NodeSelection)||selection.node.type.name!=='image')return
 const img=editor.view.nodeDOM(selection.from) as HTMLImageElement,root=editor.view.dom,b=img.getBoundingClientRect(),scale=root.getBoundingClientRect().width/root.offsetWidth||1,parent=img.parentElement!,style=getComputedStyle(parent)
 if(!b.width||!b.height)return
 event.preventDefault();event.stopPropagation();cleanup?.()
 const path:string[]=[];let element:HTMLElement=img
 while(element!==root){const container=element.parentElement!;path.unshift(`:nth-child(${[...container.children].indexOf(element)+1})`);element=container}
 const sheet=getPageSlices(root).find(s=>(b.top-root.getBoundingClientRect().top)/scale<s.top+s.height),margin=mm(editor.storage.mixedPagination.margin),continuous=editor.storage.mixedPagination.continuous
 const available=parent.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight),maxWidth=Math.max(24,Math.min(available,(sheet?.width||root.offsetWidth)-margin*2)),maxHeight=continuous?Infinity:(sheet?.height||1123)-margin*2-28
 const baseWidth=b.width/scale,baseHeight=b.height/scale,ratio=baseWidth/baseHeight,startX=event.clientX,startY=event.clientY,pos=selection.from
 let width=baseWidth,height=baseHeight,last=event,moved=false,paintFrame=0
 const preview=document.createElement('style');document.head.append(preview);dragging.value=true
 const paint=()=>{paintFrame=0;const dx=(last.clientX-startX)/scale*(corner.includes('e')?1:-1),dy=(last.clientY-startY)/scale*(corner.includes('s')?1:-1),locked=imageRatioLocked.value!==last.shiftKey
  if(locked){const delta=Math.abs(dx)>Math.abs(dy*ratio)?dx:dy*ratio;width=Math.max(Math.min(24,maxWidth),Math.min(maxWidth,maxHeight*ratio,baseWidth+delta));height=width/ratio}
  else{width=Math.max(24,Math.min(maxWidth,baseWidth+dx));height=Math.max(24,Math.min(maxHeight,baseHeight+dy))}
  size.value={width:Math.round(width),height:Math.round(height)};preview.textContent=`#app .paper-editor > ${path.join(' > ')}{width:${width}px!important;height:${height}px!important;max-width:none!important;max-height:none!important}`;position()
 }
 const move=(e:PointerEvent)=>{last=e;if(Math.hypot(e.clientX-startX,e.clientY-startY)>3)moved=true;if(moved&&!paintFrame)paintFrame=requestAnimationFrame(paint)}
 const clean=()=>{cancelAnimationFrame(paintFrame);preview.remove();dragging.value=false;document.removeEventListener('pointermove',move);document.removeEventListener('pointerup',up);document.removeEventListener('pointercancel',cancel);document.removeEventListener('keydown',key,true);window.removeEventListener('blur',cancel);cleanup=undefined;schedule()}
 const cancel=()=>clean(),key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();cancel()}}
 const up=()=>{if(moved)paint();const valid=editor.state.doc.eq(doc);clean();if(moved&&valid){const tr=closeHistory(editor.state.tr).setNodeMarkup(pos,undefined,{...selection.node.attrs,width:String(Math.round(width)),height:String(Math.round(height))});tr.setSelection(NodeSelection.create(tr.doc,pos));editor.view.dispatch(tr)}editor.view.focus()}
 cleanup=cancel;document.addEventListener('pointermove',move);document.addEventListener('pointerup',up);document.addEventListener('pointercancel',cancel);document.addEventListener('keydown',key,true);window.addEventListener('blur',cancel)
}
onMounted(()=>{props.editor.on('transaction',schedule);window.addEventListener('scroll',schedule,true);window.addEventListener('resize',schedule);schedule()})
onBeforeUnmount(()=>{cleanup?.();cancelAnimationFrame(frame);props.editor.off('transaction',schedule);window.removeEventListener('scroll',schedule,true);window.removeEventListener('resize',schedule)})
</script>
<template><Teleport to="body"><div v-if="box" class="image-resize-frame" :class="{dragging}" :style="{left:box.left+'px',top:box.top+'px',width:box.width+'px',height:box.height+'px'}"><button v-for="corner in ['nw','ne','sw','se']" :key="corner" :class="['image-resize-handle','handle-'+corner]" :aria-label="t('拖动调整图片尺寸')+' '+corner" :title="t('拖动等比缩放，Shift 临时切换比例锁定')" @pointerdown="start($event,corner)"></button><output v-if="dragging">{{size.width}} × {{size.height}}</output></div></Teleport></template>
