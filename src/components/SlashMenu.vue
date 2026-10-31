<script setup lang="ts">
import { t } from '../i18n'
import { watch, nextTick, ref } from 'vue'
import { Heading1, Heading2, Heading3, Text, List, ListOrdered, Quote, Code2, Table2, ImagePlus, Minus } from 'lucide-vue-next'
import type { useSlashMenu } from '../slash'
const props = defineProps<{ menu: ReturnType<typeof useSlashMenu> }>()
const list = ref<HTMLElement>()
const icons = { h1: Heading1, h2: Heading2, h3: Heading3, text: Text, list: List, ordered: ListOrdered, quote: Quote, code: Code2, table: Table2, image: ImagePlus, line: Minus }
watch(() => props.menu.selected.value, async () => { await nextTick(); list.value?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' }) })
</script>
<template>
  <Teleport to="body"><section v-if="menu.state.value" class="slash-menu" :style="{ left: `${menu.state.value.left}px`, top: `${menu.state.value.top}px` }" :aria-label="t('插入内容')">
    <header>{{ t('插入内容 ') }}<span>{{ t('↑ ↓ 选择 · Enter 插入') }}</span></header>
    <div ref="list" role="listbox" :aria-label="t('可插入的内容块')" class="slash-items">
      <button v-for="(item, index) in menu.items.value" :key="item.id" role="option" :aria-selected="index === menu.selected.value" @mousedown.prevent @mousemove="menu.selected.value = index" @click="menu.execute(index)"><span class="slash-icon"><component :is="icons[item.icon]" :size="20" /></span><span><strong>{{ t(item.label) }}</strong><small>{{ t(item.description) }}</small></span></button>
      <p v-if="!menu.items.value.length" class="slash-empty">{{ t('没有匹配的内容块') }}<br><small>{{ t('按 Esc 继续输入') }}</small></p>
    </div>
  </section></Teleport>
</template>
