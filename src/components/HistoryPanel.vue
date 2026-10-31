<script setup lang="ts">
import { t, locale } from '../i18n'
import { onMounted, ref } from 'vue'
import { X, History, FilePlus2 } from 'lucide-vue-next'
import { listHistory, readHistory, type HistoryEntry } from '../history'
const props = defineProps<{ keys: string[]; title: string }>()
const emit = defineEmits<{ close: []; restore: [content: string] }>()
const entries = ref<HistoryEntry[]>([]), selected = ref<HistoryEntry>(), content = ref(''), loading = ref(true), error = ref('')
let request = 0
async function select(entry: HistoryEntry) { const token = ++request; selected.value = entry; loading.value = true; try { const text = await readHistory(entry); if (token === request) content.value = text } catch(e) { error.value = String(e) } finally { if (token === request) loading.value = false } }
onMounted(async () => { try { entries.value = await listHistory(props.keys); if (entries.value[0]) await select(entries.value[0]) } catch(e) { error.value = String(e) } finally { loading.value = false } })
function date(value: string) { return new Date(Number(value)).toLocaleString(locale.value, { hour12: false }) }
</script>
<template>
  <div class="modal-backdrop history-backdrop" @keydown.esc="emit('close')"><section role="dialog" aria-modal="true" :aria-label="t('文件历史')" class="history-modal">
    <header><div><h2><History :size="18" />{{ t('文件历史') }}</h2><p>{{ title }}</p></div><button class="icon-btn" :aria-label="t('关闭文件历史')" @click="emit('close')"><X :size="18" /></button></header>
    <div v-if="error" role="alert" class="history-error">{{ t(error) }}</div>
    <div class="history-body"><nav :aria-label="t('历史版本')"><button v-for="entry in entries" :key="entry.key + entry.id" :class="{selected:selected?.id === entry.id}" @click="select(entry)"><strong>{{ date(entry.created) }}</strong><span>{{ t(entry.reason) }} · {{ entry.characters.toLocaleString() }}{{ t(' 字符') }}</span></button><p v-if="!entries.length && !loading">{{ t('尚无历史版本。保存文件或持续编辑后会在这里留下版本。') }}</p></nav><div class="history-preview"><span v-if="loading">{{ t('正在读取版本…') }}</span><textarea v-else :aria-label="t('历史版本内容')" :value="content" readonly spellcheck="false"></textarea></div></div>
    <footer><span>{{ t('最近 30 个版本。打开历史版本会新建标签，当前文稿继续保留。') }}</span><button class="primary-btn" :disabled="!selected || loading || !!error" @click="emit('restore',content)"><FilePlus2 :size="15" />{{ t('在新标签打开此版本') }}</button></footer>
  </section></div>
</template>
