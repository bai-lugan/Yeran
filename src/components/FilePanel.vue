<script setup lang="ts">
import { computed,nextTick, onMounted, onBeforeUnmount, ref } from 'vue'
import { ChevronRight, FileArchive, FilePlus2, FileText, FolderOpen, FolderPlus, History, ListTree, RotateCw, SaveAll, Search, X, Pencil } from 'lucide-vue-next'
import { libraryRoot, recentFiles, chooseLibrary, folderChildren, refreshLibrary, searchLibrary, forgetRecent, samePath, createLibraryEntry, openLibraryFolder, canOpenSystemFolder,parentPath,withinFolder, type LibraryEntry, type SearchHit,type RenameTarget } from '../library'
import FileTree from './FileTree.vue'
import FileEntryInput from './FileEntryInput.vue'
import { t } from '../i18n'
const props = defineProps<{ tabs: { id: string; label: string; path: string | null; dirty: boolean }[]; activeId: string; activePath: string | null;renameFile:(target:RenameTarget,name:string)=>Promise<string|null>;busy?:boolean }>()
const emit = defineEmits<{ open: [{ path?: string; handleKey?: string; tabId?: string }]; hit: [SearchHit]; error: [unknown]; close: [string]; saveAll: [];newDocument:[] }>()
const tab = ref('tree'), entries = ref<LibraryEntry[]>([]), query = ref(''), hits = ref<SearchHit[]>([]), loading = ref(false), limited = ref(false), searched = ref(false)
const editorsOpen = ref(true), rootOpen = ref(true), revision = ref(0), tree = ref<InstanceType<typeof FileTree>>()
const creating=ref<{parent:string;directory:boolean;editorId?:string;root?:string}|null>(null),creationPending=ref(false),creationError=ref('')
const renaming=ref<{target:RenameTarget;name:string;place:'editor'|'tree'}|null>(null),renamePending=ref(false),renameError=ref('')
const treeRenaming=computed(()=>renaming.value?.place==='tree'&&renaming.value.target.path?{path:renaming.value.target.path,name:renaming.value.name}:null)
const context=ref<{left:number;top:number;parent:string;entry?:LibraryEntry;editorId?:string}|null>(null),contextMenu=ref<HTMLElement>()
const panel=ref<HTMLElement>()
let contextTrigger:HTMLElement|null=null
let generation = 0
async function load() {
  if (!libraryRoot.value) return
  const id = ++generation
  loading.value = true
  try { const result = await folderChildren(); if (id === generation) { entries.value = result; revision.value++; void refreshLibrary().catch(error => emit('error', error)) } }
  catch (error) { emit('error', error) } finally { if (id === generation) loading.value = false }
}
async function choose() {
  if(creationPending.value)return
  context.value=null
  try { if (await chooseLibrary()) { generation++; creating.value=null; context.value=null; hits.value = []; searched.value = false; limited.value = false; rootOpen.value = true; tab.value = 'tree'; await load() } }
  catch (error) { emit('error', error) }
}
async function search() {
  const id = ++generation
  if (!query.value.trim()) { hits.value = []; searched.value = false; loading.value = false; return }
  loading.value = true
  try { const result = await searchLibrary(query.value); if (id !== generation) return; hits.value = result.results; limited.value = result.truncated; searched.value = true }
  catch (error) { emit('error', error) } finally { if (id === generation) loading.value = false }
}
async function beginCreate(directory:boolean,parent=libraryRoot.value){
  if(!parent||creationPending.value||renamePending.value||props.busy)return
  renaming.value=null
  context.value=null;tab.value='tree';rootOpen.value=true;await nextTick()
  if(!await tree.value?.expand(parent))return
  creationError.value='';creating.value={parent,directory}
}
async function beginCreateForDocument(id:string,directory=false){
  if(creationPending.value||renamePending.value||props.busy)return
  const document=props.tabs.find(tab=>tab.id===id);if(!document)return
  context.value=null;renaming.value=null
  if(!document.path){emit('newDocument');return}
  const parent=parentPath(document.path);if(!parent){emit('newDocument');return}
  tab.value='tree';editorsOpen.value=true;creationError.value='';creating.value={parent,directory,editorId:id,root:withinFolder(parent,libraryRoot.value)?libraryRoot.value:parent}
}
async function beginRename(target:RenameTarget,name:string,place:'editor'|'tree'){
  if(creationPending.value||renamePending.value||props.busy)return
  context.value=null;creating.value=null;renameError.value='';tab.value='tree';editorsOpen.value=true;rootOpen.value=true;renaming.value={target,name,place}
}
function beginRenameDocument(id:string){const document=props.tabs.find(tab=>tab.id===id);if(document)return beginRename({tabId:id,path:document.path},document.path?.split(/[\\/]/).pop()||document.label,'editor')}
async function cancelRename(){if(renamePending.value)return;const old=renaming.value;renaming.value=null;await nextTick();if(old?.place==='tree'&&old.target.path)await tree.value?.focusPath(old.target.path);else if(old?.target.tabId)[...panel.value?.querySelectorAll<HTMLButtonElement>('[data-editor-id]')||[]].find(el=>el.dataset.editorId===old.target.tabId)?.focus()}
async function rename(name:string){
  if(!renaming.value||renamePending.value)return
  const request=renaming.value;renamePending.value=true;renameError.value=''
  try{const path=await props.renameFile(request.target,name);renaming.value=null;hits.value=[];searched.value=false;if(libraryRoot.value)await load();await nextTick();if(request.place==='tree'&&path){await tree.value?.reveal(path);await tree.value?.focusPath(path)}else if(request.target.tabId)[...panel.value?.querySelectorAll<HTMLButtonElement>('[data-editor-id]')||[]].find(el=>el.dataset.editorId===request.target.tabId)?.focus()}
  catch(error){renameError.value=error instanceof Error?error.message:String(error)}finally{renamePending.value=false}
}
async function create(name:string){
  if(!creating.value||creationPending.value)return
  const request={...creating.value};creationPending.value=true;creationError.value=''
  try{
    const entry=await createLibraryEntry(request.parent,name,request.directory,request.root||libraryRoot.value)
    creating.value=null;if(libraryRoot.value)await load();await nextTick();await tree.value?.reveal(entry.path)
    if(entry.directory)await tree.value?.focusPath(entry.path);else emit('open',entry)
  }catch(error){creationError.value=error instanceof Error?error.message:String(error)}
  finally{creationPending.value=false}
}
async function openSystemFolder(parent=libraryRoot.value){context.value=null;try{await openLibraryFolder(parent)}catch(error){emit('error',error)}}
async function showContext(event:MouseEvent|KeyboardEvent,parent=libraryRoot.value,entry?:LibraryEntry,editorId?:string){
  if((!parent&&!editorId)||creationPending.value||renamePending.value||props.busy)return
  const bounds=(event.currentTarget as HTMLElement)?.getBoundingClientRect()
  contextTrigger=(event.target as HTMLElement)?.closest('button')||null
  context.value={parent,entry,editorId,left:Math.max(8,Math.min(window.innerWidth-224,event instanceof MouseEvent?event.clientX:(bounds?.left||0)+20)),top:Math.max(8,Math.min(window.innerHeight-286,event instanceof MouseEvent?event.clientY:bounds?.bottom||0))}
  await nextTick();contextMenu.value?.querySelector<HTMLButtonElement>('button')?.focus()
}
function contextKey(event:KeyboardEvent){
  if(event.key==='F2'&&context.value){event.preventDefault();event.stopPropagation();const selected=context.value;if(selected.editorId)void beginRenameDocument(selected.editorId);else if(selected.entry&&!selected.entry.directory)void beginRename({path:selected.entry.path},selected.entry.name,'tree');return}
  const buttons=[...contextMenu.value?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')||[]],index=buttons.indexOf(document.activeElement as HTMLButtonElement)
  if(event.key==='Escape'){event.preventDefault();event.stopPropagation();context.value=null;contextTrigger?.focus();return}
  if(['ArrowUp','ArrowDown','Home','End'].includes(event.key)){event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(event.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length;buttons[next]?.focus()}
}
function outside(event:PointerEvent){if(!(event.target as Element).closest('.library-context-menu'))context.value=null}
onMounted(() => {void load();document.addEventListener('pointerdown',outside)})
onBeforeUnmount(()=>document.removeEventListener('pointerdown',outside))
defineExpose({ choose, load,beginRenameDocument,beginCreateForDocument })
</script>
<template>
  <section ref="panel" class="file-panel" :aria-label="t('文件管理')">
    <div class="file-panel-tabs" role="group" :aria-label="t('文件视图')"><button v-for="[value, label, icon] in [['tree', '文件树', ListTree], ['search', '跨文件搜索', Search], ['recent', '最近文件', History]]" :key="String(value)" :class="{ selected: tab === value }" :aria-pressed="tab === value" :title="t(String(label))" @click="tab = String(value)"><component :is="icon" :size="13" /><span>{{ t(String(label)) }}</span></button></div>
    <div v-show="tab === 'tree'" class="explorer-body">
      <div class="explorer-section-heading"><button :aria-expanded="editorsOpen" @click="editorsOpen = !editorsOpen"><ChevronRight :size="12" :class="{ expanded: editorsOpen }" /><span>{{ t('已打开文件') }}</span><small>{{ tabs.length }}</small></button><button class="icon-btn" :aria-label="t('新建未命名文件')" :title="t('新建文件 · Ctrl+N')" :disabled="busy" @click="emit('newDocument')"><FilePlus2 :size="14"/></button><button class="icon-btn" :aria-label="t('全部保存')" :title="t('全部保存')" @click="emit('saveAll')"><SaveAll :size="14" /></button></div>
      <div v-show="editorsOpen" class="explorer-editors">
        <template v-for="document in tabs" :key="document.id"><FileEntryInput v-if="renaming?.place==='editor'&&renaming.target.tabId===document.id" :directory="false" :depth="0" :pending="renamePending" :error="renameError" rename :initial-name="renaming.name" @create="rename" @cancel="cancelRename"/><div v-else class="explorer-editor" :class="{ active: document.id === activeId }">
          <button :data-editor-id="document.id" @keydown.f2.stop.prevent="beginRenameDocument(document.id)" @contextmenu.prevent.stop="showContext($event,document.path?parentPath(document.path):'',undefined,document.id)" @keydown.shift.f10.prevent.stop="showContext($event,document.path?parentPath(document.path):'',undefined,document.id)" @keydown.contextmenu.prevent.stop="showContext($event,document.path?parentPath(document.path):'',undefined,document.id)" :title="document.path || document.label" :aria-current="document.id === activeId ? 'page' : undefined" @click="emit('open', { tabId: document.id })"><FileText :size="14" /><span>{{ document.label }}</span><i v-if="document.dirty" class="dirty-dot" :aria-label="t('尚未保存')"></i></button>
          <button class="explorer-close" :aria-label="t('关闭标签') + ' ' + document.label" @click="emit('close', document.id)"><X :size="13" /></button>
        </div><FileEntryInput v-if="creating?.editorId===document.id" :key="document.id+':create'" :directory="creating.directory" :depth="0" :pending="creationPending" :error="creationError" @create="create" @cancel="creating=null"/></template>
      </div>
      <div class="explorer-section-heading explorer-root" @contextmenu.prevent="showContext($event)"><button :title="libraryRoot || t('未打开文件夹')" :aria-expanded="rootOpen" @click="rootOpen = !rootOpen"><ChevronRight :size="12" :class="{ expanded: rootOpen }" /><span>{{ libraryRoot ? libraryRoot.split(/[\\/]/).pop() : t('未打开文件夹') }}</span></button><div v-if="libraryRoot" class="explorer-actions"><button class="icon-btn" :aria-label="t('新建文件')" :title="t('新建文件')" :disabled="creationPending" @click="beginCreate(false)"><FilePlus2 :size="14" /></button><button class="icon-btn" :aria-label="t('新建文件夹')" :title="t('新建文件夹')" :disabled="creationPending" @click="beginCreate(true)"><FolderPlus :size="14" /></button><button class="icon-btn" :aria-label="t('刷新文件列表')" :title="t('刷新文件列表')" :disabled="loading||creationPending" @click="load"><RotateCw :size="14" /></button><button class="icon-btn" :aria-label="t('在 Windows 资源管理器中打开')" :title="t(canOpenSystemFolder?'在 Windows 资源管理器中打开':'仅桌面版支持')" :disabled="!canOpenSystemFolder" @click="openSystemFolder()"><FolderOpen :size="14" /></button></div></div>
      <div v-show="rootOpen" class="file-panel-list" @contextmenu.prevent="showContext($event)"><FileTree ref="tree" :entries="entries" :active-path="activePath" :root="libraryRoot" :revision="revision" :creating="creating?.editorId?null:creating" :renaming="treeRenaming" :rename-pending="renamePending" :rename-error="renameError" :pending="creationPending" :creation-error="creationError" @create="create" @cancel="creating=null" @context="showContext($event.event,$event.parent,$event.entry)" @rename="beginRename({path:$event.path},$event.name,'tree')" @rename-submit="rename" @rename-cancel="cancelRename" @open="emit('open', $event)" @error="emit('error', $event)" /><div v-if="!libraryRoot" class="explorer-empty"><p>{{ t('选择写作文件夹，浏览文稿与子目录。') }}</p><button class="primary-btn" @click="choose"><FolderOpen :size="14" />{{ t('打开文件夹') }}</button></div><p v-else-if="!entries.length && !loading" class="file-panel-note">{{ t('文件夹中没有支持的文稿') }}</p><p v-if="loading" class="file-panel-note" role="status">{{ t('正在读取文件…') }}</p></div>
    </div>
    <template v-if="tab === 'search'"><div class="library-search"><form @submit.prevent="search"><input v-model="query" :aria-label="t('跨文件搜索内容')" :placeholder="t('输入文字，Enter 搜索')" :disabled="!libraryRoot"><button class="icon-btn" :aria-label="t('搜索')" :disabled="!libraryRoot || loading"><Search :size="15" /></button></form><p v-if="!libraryRoot" class="file-panel-note">{{ t('先打开文件夹以搜索文稿') }}</p><p v-if="searched && !hits.length">{{ t('无匹配') }}</p><p v-if="limited">{{ t('结果已截断，请缩小搜索范围') }}</p><p v-if="loading" role="status">{{ t('正在读取文件…') }}</p></div><div class="file-panel-list"><button v-for="hit in hits" :key="hit.path + ':' + hit.line + ':' + hit.occurrence" class="library-hit" @click="emit('hit', { ...hit, query })"><strong>{{ hit.name }}<small>{{ hit.line }}</small></strong><span>{{ hit.excerpt }}</span></button></div></template>
    <div v-else-if="tab==='recent'" class="file-panel-list recent-files"><div v-for="file in recentFiles" :key="file.path" class="recent-file" :class="{ active: samePath(activePath, file.path) }"><button :title="file.path" @click="emit('open', file)"><component :is="/\.(textpack|tetpack|textbundle)$/i.test(file.path) ? FileArchive : FileText" :size="14" /><span>{{ file.path.split(/[\\/]/).pop() }}<small>{{ file.path.replace(/[\\/][^\\/]+$/, '') }}</small></span></button><button class="icon-btn" :aria-label="t('从最近列表移除')" @click="forgetRecent(file.path)"><X :size="12" /></button></div><p v-if="!recentFiles.length" class="file-panel-note">{{ t('尚无最近文件') }}</p></div>
    <Teleport to="body"><section v-if="context" ref="contextMenu" class="library-context-menu" role="menu" :aria-label="t('文件夹操作')" :style="{left:context.left+'px',top:context.top+'px'}" @keydown="contextKey">
      <button role="menuitem" @click="context.editorId?beginCreateForDocument(context.editorId):beginCreate(false,context.parent)"><FilePlus2 :size="15"/>{{t('新建文件')}}</button><button v-if="context.parent" role="menuitem" @click="context.editorId?beginCreateForDocument(context.editorId,true):beginCreate(true,context.parent)"><FolderPlus :size="15"/>{{t('新建文件夹')}}</button><button v-if="context.editorId||context.entry&&!context.entry.directory" role="menuitem" @click="context.editorId?beginRenameDocument(context.editorId):beginRename({path:context.entry!.path},context.entry!.name,'tree')"><Pencil :size="15"/>{{t('重命名')}}<kbd>F2</kbd></button><hr><button v-if="context.parent" role="menuitem" @click="context=null;load()"><RotateCw :size="15"/>{{t('刷新文件列表')}}</button><button v-if="context.parent" role="menuitem" :disabled="!canOpenSystemFolder" @click="openSystemFolder(context.parent)"><FolderOpen :size="15"/>{{t('在 Windows 资源管理器中打开')}}</button><hr><button role="menuitem" @click="choose"><FolderOpen :size="15"/>{{t('打开其他文件夹…')}}</button>
    </section></Teleport>
  </section>
</template>
