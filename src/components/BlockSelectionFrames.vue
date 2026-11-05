<script setup lang="ts">
import {ref,onMounted,onBeforeUnmount} from 'vue'
import type {Editor} from '@tiptap/core'
import {selectionBlocks} from '../block-selection'
import {blockFragments,blockViewport,textBlockTypes,type BlockFragment} from '../block-fragments'
const props=defineProps<{editor:Editor}>(),frames=ref<BlockFragment[]>([])
let frame=0,observer:ResizeObserver|undefined
function position(){
 frame=0;if(props.editor.isDestroyed)return
 const canvas=blockViewport(props.editor),next:BlockFragment[]=[]
 if(!props.editor.storage.mixedPagination.continuous&&canvas)for(const range of selectionBlocks(props.editor.state.selection)){
  const node=props.editor.state.doc.nodeAt(range.from),dom=props.editor.view.nodeDOM(range.from)
  if(!node||!textBlockTypes.has(node.type.name)||!(dom instanceof HTMLElement))continue
  for(const r of blockFragments(props.editor,dom)){const top=Math.max(r.top,canvas.top),bottom=Math.min(r.bottom,canvas.bottom);if(bottom>top)next.push({...r,top,bottom,height:bottom-top})}
 }
 frames.value=next
}
function schedule(){cancelAnimationFrame(frame);frame=requestAnimationFrame(position)}
onMounted(()=>{props.editor.on('transaction',schedule);window.addEventListener('scroll',schedule,true);window.addEventListener('resize',schedule);observer=new ResizeObserver(schedule);observer.observe(props.editor.view.dom);schedule()})
onBeforeUnmount(()=>{cancelAnimationFrame(frame);observer?.disconnect();props.editor.off('transaction',schedule);window.removeEventListener('scroll',schedule,true);window.removeEventListener('resize',schedule)})
</script>
<template><Teleport to="body"><div v-for="(r,index) in frames" :key="index" class="block-selection-fragment" aria-hidden="true" :style="{left:r.left+'px',top:r.top+'px',width:r.width+'px',height:r.height+'px'}"></div></Teleport></template>
