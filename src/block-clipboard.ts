import type {Editor} from '@tiptap/core'
import {DOMSerializer,type Node as PMNode} from '@tiptap/pm/model'
export function serializeBlockNodes(editor:Editor,nodes:PMNode[]){
 const content=document.createElement('div'),serializer=DOMSerializer.fromSchema(editor.schema)
 for(const node of nodes)content.append(serializer.serializeNode(node))
 content.firstElementChild?.setAttribute('data-pm-slice','0 0 []')
 return{html:content.innerHTML,text:editor.markdown!.serialize({type:'doc',content:nodes.map(n=>n.toJSON())})}
}
export async function copyBlockNodes(editor:Editor,nodes:PMNode[]){
 const data=serializeBlockNodes(editor,nodes)
 try{
  if(typeof ClipboardItem!=='undefined'&&navigator.clipboard?.write)await navigator.clipboard.write([new ClipboardItem({'text/plain':new Blob([data.text],{type:'text/plain'}),'text/html':new Blob([data.html],{type:'text/html'})})])
  else await navigator.clipboard.writeText(data.text)
 }catch(error){
  const handler=(event:ClipboardEvent)=>{event.preventDefault();event.stopImmediatePropagation();event.clipboardData?.setData('text/plain',data.text);event.clipboardData?.setData('text/html',data.html)}
  document.addEventListener('copy',handler,true)
  try{if(!document.execCommand('copy'))throw error}finally{document.removeEventListener('copy',handler,true)}
 }
}
