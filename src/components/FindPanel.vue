<script setup lang="ts">
import { t } from '../i18n'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { Editor } from '@tiptap/core'
import { closeHistory } from '@tiptap/pm/history'
import { ChevronDown, ChevronRight, ChevronUp, X, CaseSensitive, WholeWord, Regex } from 'lucide-vue-next'
import { findMatches, searchKey, type Match } from '../search'
const props = defineProps<{ editor: Editor; replace: boolean }>()
const emit = defineEmits<{ close: [] }>()
const query = ref(''), replacement = ref('')
const sensitive = ref(false), wholeWord = ref(false), regex = ref(false)
const showReplace = ref(props.replace)
const index = ref(0), matches = ref<Match[]>([]), invalid = ref(false)
const queryInput = ref<HTMLInputElement>(), replaceInput = ref<HTMLInputElement>(), root = ref<HTMLElement>()
let updating = false
const options = () => ({ sensitive: sensitive.value, wholeWord: wholeWord.value, regex: regex.value })
function update() {
  if (updating || props.editor.isDestroyed) return
  const probe = { value: false }
  matches.value = findMatches(props.editor.state.doc, query.value, options(), probe)
  invalid.value = probe.value
  index.value = Math.max(0, Math.min(index.value, matches.value.length - 1))
  updating = true
  props.editor.view.dispatch(props.editor.state.tr.setMeta(searchKey, { ...options(), query: query.value, active: matches.value.length ? index.value : -1 }).setMeta('addToHistory', false))
  updating = false
}
function reveal() {
  const match = matches.value[index.value]
  if (!match) return
  let node = props.editor.view.domAtPos(match.from).node
  let element = node instanceof Element ? node : node.parentElement
  while (element && element !== props.editor.view.dom) { if (element instanceof HTMLDetailsElement) element.open = true; element = element.parentElement }
  props.editor.commands.setTextSelection(match)
  props.editor.commands.scrollIntoView()
}
function step(delta: number) {
  update()
  if (!matches.value.length) return
  index.value = (index.value + delta + matches.value.length) % matches.value.length
  update(); reveal()
}
function replaceOne() {
  update(); const match = matches.value[index.value]
  if (!match) return
  props.editor.view.dispatch(closeHistory(props.editor.state.tr).insertText(replacement.value, match.from, match.to))
  props.editor.view.focus(); update()
  if (matches.value.length) reveal()
}
function replaceAll() {
  update(); if (!matches.value.length) return
  const tr = closeHistory(props.editor.state.tr)
  for (const match of [...matches.value].reverse()) tr.insertText(replacement.value, match.from, match.to)
  props.editor.view.dispatch(tr); props.editor.view.focus(); index.value = 0; update()
}
const count = computed(() => invalid.value ? t('正则无效') : !query.value ? '' : matches.value.length ? `${index.value + 1} / ${matches.value.length}` : t('无结果'))
// Editing the query snaps to the first hit instead of stepping past it, so the counter
// always reads "1 / n" the way VS Code does.
watch([query, sensitive, wholeWord, regex], () => { update(); if (!matches.value.length) return; index.value = 0; update(); reveal() })
watch(showReplace, async value => { if (!value) return; await nextTick(); replaceInput.value?.focus() })
onMounted(async () => {
  const selection = props.editor.state.selection
  if (!selection.empty) query.value = props.editor.state.doc.textBetween(selection.from, selection.to, '\n').slice(0, 300)
  props.editor.on('update', update); update()
  await nextTick(); queryInput.value?.focus(); queryInput.value?.select()
})
// Clicking back into the document leaves the bar open, as VS Code does, but drops the focus ring.
function blurOutside(event: PointerEvent) { if (root.value && !root.value.contains(event.target as Node)) queryInput.value?.blur() }
onMounted(() => document.addEventListener('pointerdown', blurOutside, true))
onBeforeUnmount(() => { document.removeEventListener('pointerdown', blurOutside, true); props.editor.off('update', update); if (!props.editor.isDestroyed) props.editor.view.dispatch(props.editor.state.tr.setMeta(searchKey, { query: '', sensitive: false, wholeWord: false, regex: false, active: -1 }).setMeta('addToHistory', false)) })
defineExpose({ focus: () => { queryInput.value?.focus(); queryInput.value?.select() } })
</script><template>
  <section ref="root" class="find-panel" :class="{ 'with-replace': showReplace }" role="search" :aria-label="t('查找与替换')" @keydown.esc.stop.prevent="emit('close')">
    <div class="find-row">
      <button class="find-toggle" :aria-label="t(showReplace ? '收起替换' : '展开替换')" :aria-expanded="showReplace" :title="t('替换 Ctrl+H')" @click="showReplace = !showReplace"><component :is="showReplace ? ChevronDown : ChevronRight" :size="15" /></button>
      <div class="find-field"><input ref="queryInput" v-model="query" :aria-label="t('查找内容')" :placeholder="t('查找')" spellcheck="false" @keydown.enter.prevent="step($event.shiftKey ? -1 : 1)"><span class="find-count" aria-live="polite" :class="{ warn: invalid }">{{ count }}</span>
        <div class="find-options"><button class="find-option" :class="{ on: sensitive }" :aria-label="t('区分大小写')" :aria-pressed="sensitive" :title="t('区分大小写')" @click="sensitive = !sensitive"><CaseSensitive :size="16" /></button><button class="find-option" :class="{ on: wholeWord }" :aria-label="t('全字匹配')" :aria-pressed="wholeWord" :title="t('全字匹配')" @click="wholeWord = !wholeWord"><WholeWord :size="16" /></button><button class="find-option" :class="{ on: regex }" :aria-label="t('使用正则表达式')" :aria-pressed="regex" :title="t('使用正则表达式')" @click="regex = !regex"><Regex :size="16" /></button></div>
      </div>
      <button class="icon-btn" :aria-label="t('上一处')" :title="t('上一处 · Shift+Enter')" :disabled="!matches.length" @click="step(-1)"><ChevronUp :size="16" /></button>
      <button class="icon-btn" :aria-label="t('下一处')" :title="t('下一处 · Enter')" :disabled="!matches.length" @click="step(1)"><ChevronDown :size="16" /></button>
      <button class="icon-btn" :aria-label="t('关闭查找')" :title="t('关闭 · Esc')" @click="emit('close')"><X :size="16" /></button>
    </div>
    <div v-if="showReplace" class="find-row">
      <span class="find-toggle-spacer"></span>
      <div class="find-field"><input ref="replaceInput" v-model="replacement" :aria-label="t('替换为')" :placeholder="t('替换')" spellcheck="false" @keydown.enter.prevent="replaceOne"></div>
      <button class="text-btn find-action" :disabled="!matches.length" :title="t('替换当前匹配')" @click="replaceOne">{{ t('替换') }}</button>
      <button class="text-btn find-action" :disabled="!matches.length" :title="t('替换全部匹配')" @click="replaceAll">{{ t('全部替换') }}</button>
    </div>
  </section>
</template>
