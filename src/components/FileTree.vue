<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { ChevronRight, FileArchive, FileText, Folder, FolderOpen, LoaderCircle } from 'lucide-vue-next'
import { folderChildren, samePath, type LibraryEntry } from '../library'
import { t } from '../i18n'
import FileEntryInput from './FileEntryInput.vue'
const props = defineProps<{ entries: LibraryEntry[]; activePath?: string | null; root: string; revision: number; creating?:{parent:string;directory:boolean}|null; pending?:boolean; creationError?:string;renaming?:{path:string;name:string}|null;renamePending?:boolean;renameError?:string }>()
const emit = defineEmits<{ open: [LibraryEntry]; error: [unknown]; context:[{event:MouseEvent|KeyboardEvent;parent:string;entry?:LibraryEntry}]; create:[string]; cancel:[];rename:[LibraryEntry];renameSubmit:[string];renameCancel:[] }>()
const tree = ref<HTMLElement>(), focused = ref('')
const children = ref<Record<string, LibraryEntry[]>>({}), expanded = ref<Record<string, boolean>>({}), loading = ref<Record<string, boolean>>({})
let generation = 0,revealId=0
type EntryRow = { kind:'entry';entry: LibraryEntry; depth: number; parent: string; index: number; total: number }
type Row=EntryRow|{kind:'create';depth:number;parent:string}
const rows = computed(() => {
  const result: Row[] = []
  function walk(entries: LibraryEntry[], depth: number, parent: string) {
    if(props.creating&&samePath(parent,props.creating.parent))result.push({kind:'create',depth,parent})
    entries.forEach((entry, index) => {
      result.push({kind:'entry',entry, depth, parent:depth===0?'':parent, index, total: entries.length })
      if (entry.directory && expanded.value[entry.path]) walk(children.value[entry.path] || [], depth + 1, entry.path)
    })
  }
  walk(props.entries, 0, props.root)
  return result
})
async function read(entry: LibraryEntry) {
  if (children.value[entry.path]) return true
  const current = generation
  loading.value[entry.path] = true
  try {
    const entries = await folderChildren(entry.path)
    if (current !== generation) return false
    children.value[entry.path] = entries
    return true
  } catch (error) { if (current === generation) emit('error', error); return false }
  finally { if (current === generation) delete loading.value[entry.path] }
}
async function choose(entry: LibraryEntry) {
  revealId++
  focused.value = entry.path
  if (!entry.directory) { emit('open', entry); return }
  if (expanded.value[entry.path]) expanded.value[entry.path] = false
  else if (await read(entry)) expanded.value[entry.path] = true
}
async function focus(path: string) {
  focused.value = path
  await nextTick()
  ;[...tree.value?.querySelectorAll<HTMLButtonElement>('button[data-path]') || []].find(button => samePath(button.dataset.path, path))?.focus()
}
async function key(event: KeyboardEvent, row: EntryRow) {
  if(event.key==='F2'&&!row.entry.directory){event.preventDefault();event.stopPropagation();emit('rename',row.entry);return}
  if(event.key==='ContextMenu'){event.preventDefault();context(event,row.entry);return}
  const entries=rows.value.filter((row):row is EntryRow=>row.kind==='entry'),index = entries.indexOf(row), { entry } = row
  if (!['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'Enter', ' '].includes(event.key)) return
  event.preventDefault()
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') return focus(entries[Math.max(0, Math.min(entries.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)))]!.entry.path)
  if (event.key === 'Home' || event.key === 'End') return focus(entries[event.key === 'Home' ? 0 : entries.length - 1]!.entry.path)
  if (event.key === 'ArrowLeft') { if (expanded.value[entry.path]) expanded.value[entry.path] = false; else if (row.parent) await focus(row.parent); return }
  if (event.key === 'ArrowRight') {
    if (!entry.directory) return
    if (!expanded.value[entry.path]) { if (await read(entry)) expanded.value[entry.path] = true }
    else if (children.value[entry.path]?.length) await focus(children.value[entry.path]![0]!.path)
    return
  }
  await choose(entry)
}
async function reveal(target = props.activePath) {
  const request=++revealId
  if (!target || !props.root) return
  const current = generation
  let entries = props.entries
  while (true) {
    const parent = entries.find(entry => entry.directory && samePath(target.slice(0, entry.path.length), entry.path) && /[\\/]/.test(target[entry.path.length] || ''))
    if (!parent || !await read(parent) || current !== generation || request!==revealId) break
    expanded.value[parent.path] = true
    entries = children.value[parent.path] || []
  }
  await nextTick()
  if (current !== generation || request!==revealId) return
  const selected = [...tree.value?.querySelectorAll<HTMLElement>('[aria-selected="true"]') || []].find(element => element.getBoundingClientRect().height > 0)
  selected?.scrollIntoView({ block: 'nearest' })
}
function context(event:MouseEvent|KeyboardEvent,entry?:LibraryEntry){const row=entry?rows.value.find((row):row is EntryRow=>row.kind==='entry'&&samePath(row.entry.path,entry.path)):undefined;emit('context',{event,parent:entry?.directory?entry.path:row?.parent||props.root,entry})}
async function expand(parent:string){revealId++;if(samePath(parent,props.root))return true;const row=rows.value.find((row):row is EntryRow=>row.kind==='entry'&&row.entry.directory&&samePath(row.entry.path,parent));if(!row||!await read(row.entry))return false;expanded.value[parent]=true;return true}
watch(() => [props.root, props.revision], () => { generation++; children.value = {}; expanded.value = {}; loading.value = {}; focused.value = ''; void reveal() })
watch(() => [props.activePath, props.entries], () => void reveal(), { immediate: true })
defineExpose({ reveal,expand,focusPath:focus })
</script>
<template>
  <div ref="tree" class="explorer-tree" role="tree" :aria-label="t('文件树')" @contextmenu.prevent.stop="context($event)">
    <template v-for="row in rows" :key="row.kind==='create'?'create':row.entry.path">
    <FileEntryInput v-if="row.kind==='create'&&creating" :key="creating.parent+':'+creating.directory" :directory="creating.directory" :depth="row.depth" :pending="!!pending" :error="creationError||''" @create="emit('create',$event)" @cancel="emit('cancel')"/>
    <div v-else-if="row.kind==='entry'" role="treeitem" :aria-level="row.depth + 1" :aria-posinset="row.index + 1" :aria-setsize="row.total" :aria-expanded="row.entry.directory ? !!expanded[row.entry.path] : undefined" :aria-selected="samePath(activePath, row.entry.path)">
      <FileEntryInput v-if="renaming&&samePath(renaming.path,row.entry.path)" :directory="false" :depth="row.depth" :pending="!!renamePending" :error="renameError||''" rename :initial-name="renaming.name" @create="emit('renameSubmit',$event)" @cancel="emit('renameCancel')"/><button v-else class="file-tree-row" :class="{ active: samePath(activePath, row.entry.path), directory: row.entry.directory }" :style="{ paddingLeft: 8 + row.depth * 16 + 'px', '--tree-depth': row.depth }" :data-path="row.entry.path" :title="row.entry.path" :tabindex="focused ? (samePath(focused, row.entry.path) ? 0 : -1) : (row === rows[0] ? 0 : -1)" @focus="focused = row.entry.path" @click="choose(row.entry)" @keydown="key($event, row)" @contextmenu.prevent.stop="context($event,row.entry)" @keydown.shift.f10.prevent.stop="context($event,row.entry)" @keydown.contextmenu.prevent.stop="context($event,row.entry)">
        <LoaderCircle v-if="loading[row.entry.path]" class="tree-loading" :size="12" />
        <ChevronRight v-else-if="row.entry.directory" class="tree-chevron" :class="{ expanded: expanded[row.entry.path] }" :size="12" />
        <span v-else class="tree-indent"></span>
        <component :is="row.entry.directory ? (expanded[row.entry.path] ? FolderOpen : Folder) : /\.(textpack|tetpack|textbundle)$/i.test(row.entry.name) ? FileArchive : FileText" :size="15" class="tree-file-icon" :class="{ bundle: /\.(textpack|tetpack|textbundle)$/i.test(row.entry.name) }" />
        <span>{{ row.entry.name }}</span>
      </button>
    </div>
    </template>
  </div>
</template>
