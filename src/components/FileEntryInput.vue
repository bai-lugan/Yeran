<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'
import { FileText, Folder } from 'lucide-vue-next'
import { t } from '../i18n'
const props=defineProps<{directory:boolean;depth:number;pending:boolean;error:string;rename?:boolean;initialName?:string}>()
const emit=defineEmits<{create:[string];cancel:[]}>()
const name=ref(props.initialName??(t(props.directory?'新建文件夹':'未命名')+(props.directory?'':'.md'))),input=ref<HTMLInputElement>()
onMounted(async()=>{await nextTick();input.value?.focus();const dot=name.value.lastIndexOf('.');input.value?.setSelectionRange(0,props.directory?name.value.length:dot>0?dot:name.value.length)})
watch(()=>props.pending,async pending=>{if(!pending){await nextTick();input.value?.focus()}})
</script>
<template>
  <form class="file-entry-create" :style="{paddingLeft:25+depth*16+'px'}" @submit.prevent="emit('create',name)" @keydown.esc.stop.prevent="!pending&&emit('cancel')" @contextmenu.stop>
    <div><component :is="directory?Folder:FileText" :size="15"/><input ref="input" v-model="name" :aria-label="t(rename?'新的文件名称':directory?'文件夹名称':'文件名称')" :aria-invalid="!!error" :disabled="pending" autocomplete="off" spellcheck="false" @keydown.enter.stop></div>
    <p v-if="error" role="alert">{{ t(error) }}</p><small v-else>{{t(rename?'Enter 重命名 · Esc 取消':directory?'Enter 创建 · Esc 取消':'默认 .md · Enter 创建 · Esc 取消')}}</small>
  </form>
</template>
