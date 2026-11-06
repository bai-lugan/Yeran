<script setup lang="ts">
import {ref,watch,nextTick,onMounted,onBeforeUnmount} from 'vue'
import {t} from '../i18n'
import type {useEmojiMenu} from '../emoji'
const props=defineProps<{menu:ReturnType<typeof useEmojiMenu>}>(),list=ref<HTMLElement>()
watch(()=>props.menu.selected.value,async()=>{await nextTick();list.value?.querySelector('[aria-selected="true"]')?.scrollIntoView({block:'nearest'})})
function outside(event:PointerEvent){if(!(event.target as Element)?.closest('.emoji-menu'))props.menu.close()}
onMounted(()=>{document.addEventListener('pointerdown',outside,true);window.addEventListener('blur',props.menu.close);window.addEventListener('scroll',props.menu.refresh,true);window.addEventListener('resize',props.menu.refresh)})
onBeforeUnmount(()=>{document.removeEventListener('pointerdown',outside,true);window.removeEventListener('blur',props.menu.close);window.removeEventListener('scroll',props.menu.refresh,true);window.removeEventListener('resize',props.menu.refresh);props.menu.dispose()})
</script>
<template><Teleport to="body"><section v-if="menu.state.value" class="slash-menu emoji-menu" :style="{left:menu.state.value.left+'px',top:menu.state.value.top+'px',maxHeight:menu.state.value.height+'px'}" :aria-label="t('表情符号')">
 <header>{{t('表情符号')}}<span>{{t('↑ ↓ 选择 · Enter / Tab 插入')}}</span></header>
 <div ref="list" class="slash-items" role="listbox" :aria-label="t('表情候选')" :style="{maxHeight:menu.state.value.height-40+'px'}">
  <button v-for="(item,index) in menu.items.value" :key="item.emoji" role="option" :aria-selected="index===menu.selected.value" @mousedown.prevent @mousemove="menu.selected.value=index" @click="menu.execute(index)"><span class="emoji-glyph" aria-hidden="true">{{item.emoji}}</span><span><strong>:{{item.aliases[0]}}:</strong><small>{{item.description}}</small></span></button>
  <p v-if="!menu.items.value.length" class="slash-empty" role="status">{{t(menu.loading.value?'正在加载表情…':menu.failed.value?'表情词库加载失败':'没有匹配的表情')}}<br><small>{{t('按 Esc 继续输入')}}</small></p>
 </div>
</section></Teleport></template>
<style scoped>
.emoji-menu{width:330px;max-width:calc(100vw - 24px)}.emoji-glyph{display:grid;place-items:center;flex:none;width:34px;height:34px;font-family:'Segoe UI Emoji','Apple Color Emoji',sans-serif;font-size:24px;line-height:1}.emoji-menu strong,.emoji-menu small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.emoji-menu strong{color:inherit}.emoji-menu small,.emoji-menu>header,.emoji-menu>header>span{color:var(--muted)}.emoji-menu button>span:last-child{min-width:0}.emoji-menu>header>span{font-size:10px}
</style>
