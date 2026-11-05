<script setup lang="ts">
import {ref,computed,onMounted,onBeforeUnmount} from 'vue'
import type {Editor} from '@tiptap/core'
import {NodeSelection} from '@tiptap/pm/state'
import {blockAvailableWidth,blockBodyHeight,nodeDOMPath} from '../block-geometry'
import {setTableSize} from '../table-sizing'
import {blockFragments,blockViewport} from '../block-fragments'
import {t} from '../i18n'
const props=defineProps<{editor:Editor}>(),frames=ref<{left:number;top:number;width:number;height:number}[]>([]),dragging=ref(false),pointer=ref({x:0,y:0}),size=ref({width:0,scale:1})
let frame=0,cleanup:(()=>void)|undefined
const viewport=ref({top:0,bottom:Infinity}),visibleFrames=computed(()=>frames.value.flatMap(r=>{const top=Math.max(r.top,viewport.value.top),bottom=Math.min(r.top+r.height,viewport.value.bottom);return bottom>top?[{...r,top,height:bottom-top}]:[]}))
function position(){
 const {selection}=props.editor.state
 if(!(selection instanceof NodeSelection)||selection.node.type.name!=='table'){frames.value=[];return}
 const root=props.editor.view.dom,wrapper=props.editor.view.nodeDOM(selection.from) as HTMLElement,rows=[...wrapper.querySelectorAll<HTMLElement>(':scope>.table-plus>tr')].filter(r=>r.getClientRects().length)
 if(!rows.length||wrapper.closest('details:not([open])')){frames.value=[];return}
 frames.value=blockFragments(props.editor,wrapper)
 const clip=blockViewport(props.editor);if(clip)viewport.value=clip
}
function schedule({transaction}:any={}){if(transaction?.docChanged&&dragging.value)cleanup?.();cancelAnimationFrame(frame);frame=requestAnimationFrame(position)}
function start(event:PointerEvent,corner:string){
 const {selection,doc}=props.editor.state;if(event.button!==0||!(selection instanceof NodeSelection)||selection.node.type.name!=='table')return
 event.preventDefault();event.stopPropagation();cleanup?.()
 const editor=props.editor,root=editor.view.dom,dom=editor.view.nodeDOM(selection.from) as HTMLElement,rows=[...dom.querySelectorAll<HTMLElement>(':scope>.table-plus>tr')],scale=root.getBoundingClientRect().width/root.offsetWidth||1
 const width=rows[0]!.getBoundingClientRect().width/scale,height=rows.reduce((sum,r)=>sum+r.getBoundingClientRect().height/scale,0),originalScale=Number(selection.node.attrs.tableScale)||1,maxWidth=blockAvailableWidth(editor,dom),maxRow=Math.max(...rows.map(r=>r.getBoundingClientRect().height/scale))
 const maximum=Math.min(maxWidth/width,4/originalScale,blockBodyHeight(editor)/maxRow),minimum=Math.min(maximum,Math.max(64/width,.2/originalScale)),path=nodeDOMPath(root,dom),startX=event.clientX,startY=event.clientY
 if(!path)return
 let factor=1,moved=false,paintFrame=0,last=event
 const style=document.createElement('style');document.head.append(style);dragging.value=true;size.value={width,scale:originalScale}
 const paint=()=>{paintFrame=0;const dx=(last.clientX-startX)/scale*(corner.includes('e')?1:-1),dy=(last.clientY-startY)/scale*(corner.includes('s')?1:-1),ratio=width/height,delta=Math.abs(dx)>Math.abs(dy*ratio)?dx:dy*ratio
  factor=Math.max(minimum,Math.min(maximum,(width+delta)/width));const next=width*factor,zoom=originalScale*factor;size.value={width:Math.round(next),scale:zoom};pointer.value={x:Math.min(innerWidth-150,last.clientX+15),y:Math.min(innerHeight-35,last.clientY+12)}
  style.textContent=`${path}{--yeran-table-width:${next}px!important;--yeran-table-scale:${zoom}!important;--yeran-table-layout-width:${next/zoom}px!important}${path}>.table-plus>tr{zoom:${zoom}!important;width:${next/zoom}px!important;min-width:0!important}${path}>.table-resizers{visibility:hidden!important}`;position()
 }
 const move=(e:PointerEvent)=>{last=e;if(Math.hypot(e.clientX-startX,e.clientY-startY)>3)moved=true;if(moved&&!paintFrame)paintFrame=requestAnimationFrame(paint)}
 const clean=()=>{cancelAnimationFrame(paintFrame);style.remove();dragging.value=false;document.removeEventListener('pointermove',move);document.removeEventListener('pointerup',up);document.removeEventListener('pointercancel',cancel);document.removeEventListener('keydown',key,true);window.removeEventListener('blur',cancel);cleanup=undefined;schedule()}
 const cancel=()=>clean(),key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();cancel()}}
 const up=()=>{if(moved)paint();const valid=editor.state.doc.eq(doc);clean();if(moved&&valid)setTableSize(editor,selection.from,width*factor,originalScale*factor);editor.view.focus()}
 cleanup=cancel;document.addEventListener('pointermove',move);document.addEventListener('pointerup',up);document.addEventListener('pointercancel',cancel);document.addEventListener('keydown',key,true);window.addEventListener('blur',cancel)
}
function cornerStyle(corner:string){const b=corner.includes('n')?frames.value[0]:frames.value.at(-1)!,y=b.top+(corner.includes('s')?b.height:0);return{left:(b.left+(corner.includes('e')?b.width:0)-10)+'px',top:(y-10)+'px',display:y<viewport.value.top+10||y>viewport.value.bottom-10?'none':undefined}}
onMounted(()=>{props.editor.on('transaction',schedule);window.addEventListener('scroll',schedule,true);window.addEventListener('resize',schedule);schedule()})
onBeforeUnmount(()=>{cleanup?.();cancelAnimationFrame(frame);props.editor.off('transaction',schedule);window.removeEventListener('scroll',schedule,true);window.removeEventListener('resize',schedule)})
</script>
<template><Teleport to="body"><div v-for="(box,index) in visibleFrames" :key="index" class="image-resize-frame table-resize-frame" :style="{left:box.left+'px',top:box.top+'px',width:box.width+'px',height:box.height+'px'}"></div><template v-if="frames.length"><button v-for="corner in ['nw','ne','sw','se']" :key="corner" :class="['image-resize-handle','table-resize-handle','handle-'+corner]" :aria-label="t('拖动缩放整个表格')+' '+corner" :title="t('拖动等比缩放表格和文字')" :style="cornerStyle(corner)" @pointerdown="start($event,corner)"></button></template><output v-if="dragging" class="block-resize-output" :style="{left:pointer.x+'px',top:pointer.y+'px'}">{{size.width}} px · {{Math.round(size.scale*100)}}%</output></Teleport></template>
