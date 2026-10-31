<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import type { Editor } from '@tiptap/core'
import { t } from '../i18n'
import { TextSelection } from '@tiptap/pm/state'
import { Bold, Italic, Palette, Type, Underline, Highlighter, Link, Strikethrough, AlignLeft, AlignCenter, AlignRight, Code, Superscript, Subscript, Eraser } from 'lucide-vue-next'
import { TEXT_COLORS, BACKGROUND_COLORS } from '../colors'
const props = defineProps<{ editor: Editor }>()
const open = ref(false), linking = ref(false), url = ref(''), linkInput = ref<HTMLInputElement>(), version = ref(0), error = ref('')
const floating=ref<{left:number;top:number}|null>(null),fromSelection=ref(false),selectionAnchor=ref({left:8,top:100})
const innerWidthSafe=ref(window.innerWidth),heightSafe=ref(window.innerHeight)
let frame=0,selecting=false,dismissed='',lastSelectionKey=''
function refresh(){version.value++;cancelAnimationFrame(frame);frame=requestAnimationFrame(place)}
function place(){
 innerWidthSafe.value=innerWidth;heightSafe.value=innerHeight
 const editor=props.editor,selection=editor.state.selection,key=selection.from+'-'+selection.to
 if(key!==lastSelectionKey){dismissed='';lastSelectionKey=key}
 if(selecting||editor.view.composing||!(selection instanceof TextSelection)||selection.empty||selection.$from.parent.type.spec.code||!editor.view.hasFocus()||dismissed===key||!editor.state.doc.textBetween(selection.from,selection.to).trim()){floating.value=null;return}
 const canvas=editor.view.dom.closest('.canvas')?.getBoundingClientRect(),range=window.getSelection()?.rangeCount?window.getSelection()!.getRangeAt(0):null
 if(!canvas||!range){floating.value=null;return}
 const rect=[...range.getClientRects()].find(r=>r.width>0&&r.height>0&&r.top<canvas.bottom&&r.bottom>canvas.top)
 if(!rect){floating.value=null;return}
 const left=Math.max(8,Math.min(innerWidth-220,rect.left+Math.min(rect.width,220)/2-105)),top=rect.top-44>=canvas.top?rect.top-44:rect.bottom+8
 floating.value={left,top:Math.min(innerHeight-48,Math.max(canvas.top+4,top))}
}
function selectionPanel(link=false){if(floating.value)selectionAnchor.value={...floating.value};fromSelection.value=true;open.value=true;if(link)void editLink()}
function pointerDown(event:PointerEvent){if(props.editor.view.dom.contains(event.target as Node)){selecting=true;floating.value=null}outside(event)}
function pointerUp(){selecting=false;dismissed='';refresh()}
function escape(event:KeyboardEvent){if(event.key==='Escape'){open.value=false;linking.value=false;dismissed=props.editor.state.selection.from+'-'+props.editor.state.selection.to;floating.value=null}}
function blur(){floating.value=null}

function active(name: string) { version.value; return props.editor.isActive(name) }
function color(kind:'textColor'|'highlight',value:string){const chain=props.editor.chain().focus();if(value)chain.setMark(kind,{color:value}).run();else chain.unsetMark(kind).run()}
function selected(kind:string,value:string){version.value;return (props.editor.getAttributes(kind).color||'')===value}
function format(action: string) {
  const chain = props.editor.chain().focus()
  if (action === 'underline') chain.toggleUnderline().run()
  if (action === 'highlight') chain.toggleHighlight().run()
  if (action === 'strike') chain.toggleStrike().run()
  if (action === 'code') chain.toggleCode().run()
  if (action === 'superscript') chain.toggleSuperscript().run()
  if (action === 'subscript') chain.toggleSubscript().run()
  if (action === 'clear') chain.unsetAllMarks().unsetTextAlign().run()
  if (['left','center','right'].includes(action)) chain.setTextAlign(action).run()
}
async function editLink() { linking.value = true; error.value = ''; url.value = props.editor.getAttributes('link').href || ''; await nextTick(); linkInput.value?.focus() }
function applyLink() {
  if (url.value && (/^[a-z][a-z0-9+.-]*:/i.test(url.value.trim())&&!/^(https?:\/\/|mailto:|tel:)/i.test(url.value.trim())||/[\u0000-\u001f]/.test(url.value))) { error.value = t('链接地址无效'); return }
  const chain = props.editor.chain().focus().extendMarkRange('link')
  if (url.value.trim()) chain.setLink({ href: url.value.trim() }).run(); else chain.unsetLink().run()
  open.value = false; linking.value = false
}
function outside(event: PointerEvent) { if (!(event.target as Element).closest('.text-menu,.floating-format-bar,.text-format-popover')) { open.value = false; linking.value = false } }
onMounted(() => { props.editor.on('transaction',refresh);props.editor.on('blur',refresh);document.addEventListener('pointerdown',pointerDown);document.addEventListener('pointerup',pointerUp);document.addEventListener('pointercancel',pointerUp);document.addEventListener('keydown',escape);window.addEventListener('scroll',refresh,true);window.addEventListener('resize',refresh);window.addEventListener('blur',blur) })
onBeforeUnmount(() => { cancelAnimationFrame(frame);props.editor.off('transaction',refresh);props.editor.off('blur',refresh);document.removeEventListener('pointerdown',pointerDown);document.removeEventListener('pointerup',pointerUp);document.removeEventListener('pointercancel',pointerUp);document.removeEventListener('keydown',escape);window.removeEventListener('scroll',refresh,true);window.removeEventListener('resize',refresh);window.removeEventListener('blur',blur) })
defineExpose({editLink:()=>{fromSelection.value=false;open.value=true;void editLink()}})
</script>
<template>
  <div class="text-menu"><button class="icon-btn" :class="{selected:open}" :aria-label="t('更多文字格式')" :title="t('更多文字格式')" @mousedown.prevent @click="fromSelection=false;open = !open"><Type :size="18" /></button>
    <Teleport to="body" :disabled="!fromSelection"><section v-if="open" class="text-format-popover" :class="{'selection-format-popover':fromSelection}" :style="fromSelection?{position:'fixed',left:Math.max(8,Math.min(innerWidthSafe-280,selectionAnchor.left))+'px',top:Math.max(96,Math.min(heightSafe-360,(selectionAnchor.top)+38))+'px'}:{}" :aria-label="t('文字格式')" @keydown.esc.stop="open = false">
      <div class="text-format-marks"><button class="icon-btn" :class="{selected:active('underline')}" :aria-label="t('下划线')" :title="t('下划线 · Ctrl+U')" @mousedown.prevent @click="format('underline')"><Underline :size="18" /></button><button class="icon-btn" :class="{selected:active('strike')}" :aria-label="t('删除线')" @mousedown.prevent @click="format('strike')"><Strikethrough :size="18" /></button><button class="icon-btn" :class="{selected:active('highlight')}" :aria-label="t('文字高亮')" @mousedown.prevent @click="format('highlight')"><Highlighter :size="18" /></button><button class="icon-btn" :class="{selected:active('link')}" :aria-label="t('编辑链接')" @mousedown.prevent @click="editLink"><Link :size="18" /></button></div>
      <div class="text-format-marks"><button class="text-btn" :aria-label="t('段落左对齐')" @mousedown.prevent @click="format('left')"><AlignLeft :size="16" />{{t('左对齐')}}</button><button class="text-btn" :aria-label="t('段落居中')" @mousedown.prevent @click="format('center')"><AlignCenter :size="16" />{{t('居中')}}</button><button class="text-btn" :aria-label="t('段落右对齐')" @mousedown.prevent @click="format('right')"><AlignRight :size="16" />{{t('右对齐')}}</button></div>
      <div class="text-format-marks"><button class="icon-btn" :aria-label="t('行内代码')" :class="{selected:active('code')}" @mousedown.prevent @click="format('code')"><Code :size="17" /></button><button class="icon-btn" :aria-label="t('上标')" :class="{selected:active('superscript')}" @mousedown.prevent @click="format('superscript')"><Superscript :size="17" /></button><button class="icon-btn" :aria-label="t('下标')" :class="{selected:active('subscript')}" @mousedown.prevent @click="format('subscript')"><Subscript :size="17" /></button><button class="text-btn" :aria-label="t('清除格式')" @mousedown.prevent @click="format('clear')"><Eraser :size="16" />{{t('清除格式')}}</button></div>
      <div class="color-palette"><header>{{t('文字颜色')}}</header><div role="group" :aria-label="t('文字颜色')"><button v-for="[name,value] in TEXT_COLORS" :key="name" :aria-label="t(name)+' · '+t('文字颜色')" :aria-pressed="selected('textColor',value)" :title="t(name)" :style="{color:value||'inherit'}" @mousedown.prevent @click="color('textColor',value)">A</button></div><header>{{t('背景高亮')}}</header><div role="group" :aria-label="t('背景高亮')"><button v-for="[name,value] in BACKGROUND_COLORS" :key="name" :aria-label="t(name)+' · '+t('背景高亮')" :aria-pressed="selected('highlight',value)" :title="t(name)" @mousedown.prevent @click="color('highlight',value)"><span :style="{background:value||'transparent'}">A</span></button></div><small>Ctrl+E · {{t('红字与淡红背景')}}</small></div>
      <form v-if="linking" class="link-form" @submit.prevent="applyLink"><input ref="linkInput" v-model="url" :aria-label="t('链接地址')" placeholder="https://"><div><button type="button" class="text-btn" @click="url='';applyLink()">{{t('移除链接')}}</button><button class="primary-btn" type="submit">{{t('应用')}}</button></div><p v-if="error" role="alert">{{error}}</p></form>
    </section></Teleport>
  </div>
  <Teleport to="body"><Transition name="popover"><div v-if="floating" class="floating-format-bar" role="toolbar" :aria-label="t('选中文字工具条')" :style="{left:floating.left+'px',top:floating.top+'px'}" @mousedown.prevent>
   <button :aria-label="t('选区加粗')" :title="t('加粗')" :aria-pressed="active('bold')" @click="editor.chain().focus().toggleBold().run()"><Bold :size="16"/></button>
   <button :aria-label="t('选区斜体')" :title="t('斜体')" :aria-pressed="active('italic')" @click="editor.chain().focus().toggleItalic().run()"><Italic :size="16"/></button>
   <button :aria-label="t('选区下划线')" :title="t('下划线')" :aria-pressed="active('underline')" @click="format('underline')"><Underline :size="16"/></button><i></i>
   <button :aria-label="t('选区链接')" :title="t('编辑链接')" @click="selectionPanel(true)"><Link :size="16"/></button>
   <button :aria-label="t('选区颜色与格式')" :title="t('文字颜色与背景高亮')" @click="selectionPanel()"><Palette :size="17"/></button>
  </div></Transition></Teleport>
</template>
