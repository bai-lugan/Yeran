import type {Editor} from '@tiptap/core'
import {CellSelection} from '@tiptap/pm/tables'
import {selectionBlocks,deleteBlockSelection} from './block-selection'
import {copyBlockNodes} from './block-clipboard'
import {tableAction} from './table'
import {t} from './i18n'
import {selectedPlainText,replacePlainSelection} from './plain-text'
export async function copyEditorSelection(editor:Editor,cut=false){
 const {doc,selection}=editor.state;if(selection.empty)return false
 const ranges=selectionBlocks(selection)
 if(ranges.length)await copyBlockNodes(editor,ranges.map(r=>doc.nodeAt(r.from)!))
 else{
  const {dom,text:serialized}=editor.view.serializeForClipboard(selection.content()),text=editor.storage.plainTextMode.enabled?selectedPlainText(editor):serialized
  try{await navigator.clipboard.write([new ClipboardItem({'text/plain':new Blob([text],{type:'text/plain'}),'text/html':new Blob([dom.innerHTML],{type:'text/html'})})])}
  catch(error){editor.view.focus();if(!document.execCommand('copy'))throw error}
 }
 if(cut&&editor.state.doc.eq(doc)&&editor.state.selection.eq(selection)){
  if(ranges.length)deleteBlockSelection(editor)
  else if(editor.storage.plainTextMode.enabled)replacePlainSelection(editor,'')
  else if(selection instanceof CellSelection)tableAction(editor,'clear')
  else editor.chain().focus().deleteSelection().run()
 }
 return true
}
export async function pasteEditorClipboard(editor:Editor,plain=false){
 const {doc,selection}=editor.state;editor.view.focus()
 // WebView2 can perform the trusted paste directly, including image files.
 if(!plain){let received=false;const seen=()=>{received=true};editor.view.dom.addEventListener('paste',seen,true);try{document.execCommand('paste')}finally{editor.view.dom.removeEventListener('paste',seen,true)}if(received)return}
 const data=new DataTransfer()
 if(plain)data.setData('application/x-yeran-plain-text','true')
 try{
  if(plain||!navigator.clipboard.read)data.setData('text/plain',await navigator.clipboard.readText())
  else for(const item of await navigator.clipboard.read())for(const type of item.types){if(type==='text/plain'||type==='text/html')data.setData(type,await(await item.getType(type)).text());else if(type.startsWith('image/'))data.items.add(new File([await item.getType(type)],'clipboard.'+(type.split('/')[1]||'png'),{type}))}
 }catch{throw Error(t('无法访问剪贴板，请使用 Ctrl+V 粘贴。'))}
 if(editor.isDestroyed||!editor.state.doc.eq(doc)||!editor.state.selection.eq(selection))return
 editor.view.focus();editor.view.dom.dispatchEvent(new ClipboardEvent('paste',{bubbles:true,cancelable:true,clipboardData:data}))
}
