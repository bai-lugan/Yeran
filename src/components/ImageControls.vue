<script setup lang="ts">
import{ref,watch}from'vue'
import type{Editor}from'@tiptap/core'
import{t}from'../i18n'
import{imageRatioLocked}from'../image-sizing'
import{LockKeyhole,LockKeyholeOpen,ImagePlus}from'lucide-vue-next'
const emit=defineEmits<{replace:[]}>()
const props=defineProps<{editor:Editor;version:number}>(),width=ref(''),height=ref(''),error=ref(''),controls=ref<HTMLElement>()
watch(()=>props.version,()=>{if(controls.value?.contains(document.activeElement))return;width.value=props.editor.getAttributes('image').width||'';height.value=props.editor.getAttributes('image').height||''},{immediate:true})
function apply(){if([width.value,height.value].some(v=>v&&!/^\d+(?:\.\d+)?%?$/.test(v))){error.value=t('尺寸请输入像素数或百分比');return}error.value='';const attrs=props.editor.getAttributes('image'),node=props.editor.view.nodeDOM(props.editor.state.selection.from) as HTMLImageElement|null,ratio=node?.naturalWidth&&node.naturalHeight?node.naturalWidth/node.naturalHeight:0;if(imageRatioLocked.value&&ratio){if(width.value&&width.value!==String(attrs.width||'')){height.value=width.value.endsWith('%')?'':String(Math.round(Number(width.value)/ratio))}else if(height.value&&height.value!==String(attrs.height||'')){width.value=height.value.endsWith('%')?'':String(Math.round(Number(height.value)*ratio))}}props.editor.chain().focus().updateAttributes('image',{width:width.value||null,height:height.value||null}).run()}
</script>
<template><div ref="controls" class="image-controls"><strong>{{t('图片尺寸')}}</strong><label>{{t('宽')}}<input v-model="width" :aria-label="t('图片宽度')" placeholder="auto" @keydown.enter="apply"></label><label>{{t('高')}}<input v-model="height" :aria-label="t('图片高度')" placeholder="auto" @keydown.enter="apply"></label><button class="icon-btn" :aria-label="t('锁定图片比例')" :aria-pressed="imageRatioLocked" :title="t('锁定图片比例')" @click="imageRatioLocked=!imageRatioLocked"><LockKeyhole v-if="imageRatioLocked" :size="14"/><LockKeyholeOpen v-else :size="14"/></button><button class="text-btn" @click="apply">{{t('应用')}}</button><button class="text-btn" @click="width='';height='';apply()">{{t('原始尺寸')}}</button><button class="text-btn" @click="emit('replace')"><ImagePlus :size="14"/>{{t('替换图片')}}</button><span v-if="error" role="alert">{{error}}</span></div></template>
