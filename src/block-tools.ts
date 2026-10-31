import type { Editor } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'
import { Fragment } from '@tiptap/pm/model'
import { NodeSelection, TextSelection } from '@tiptap/pm/state'
import { closeHistory } from '@tiptap/pm/history'
export interface BlockInfo {pos:number;node:PMNode;end:number}
export function blocks(editor:Editor){const result:BlockInfo[]=[];editor.state.doc.forEach((node,pos)=>result.push({node,pos,end:pos+node.nodeSize}));return result}
export function moveBlock(editor:Editor,source:BlockInfo,target:number){
  if(target>=source.pos&&target<=source.end)return false
  const tr=closeHistory(editor.state.tr).delete(source.pos,source.end),at=target>source.end?target-source.node.nodeSize:target
  tr.insert(at,source.node).setSelection(NodeSelection.create(tr.doc,at));editor.view.dispatch(tr);editor.view.focus();return true
}
export function blockAction(editor:Editor,source:BlockInfo,action:string){
  if(!editor.state.doc.nodeAt(source.pos)?.eq(source.node))return false
  const tr=closeHistory(editor.state.tr)
  if(action==='duplicate'){tr.insert(source.end,source.node);tr.setSelection(NodeSelection.create(tr.doc,source.end))}
  else if(action==='delete'){if(editor.state.doc.childCount===1){tr.replaceWith(0,editor.state.doc.content.size,editor.schema.nodes.paragraph!.create());tr.setSelection(TextSelection.create(tr.doc,1))}else tr.delete(source.pos,source.end)}
  else if(action==='up'||action==='down'){const all=blocks(editor),index=all.findIndex(b=>b.pos===source.pos);return action==='up'&&index>0?moveBlock(editor,source,all[index-1]!.pos):action==='down'&&index<all.length-1?moveBlock(editor,source,all[index+1]!.end):false}
  else {
    const flat:PMNode[]=[]
    const flatten=(node:PMNode)=>{if(['bulletList','orderedList','taskList','listItem','taskItem','blockquote'].includes(node.type.name))node.forEach(flatten);else if(node.type.name==='heading')flat.push(editor.schema.nodes.paragraph!.create(node.attrs,node.content));else flat.push(node)}
    flatten(source.node)
    let content:PMNode[]
    if(action==='paragraph')content=flat
    else if(/^h[1-6]$/.test(action))content=flat.map(node=>node.type.name==='paragraph'?editor.schema.nodes.heading!.create({...node.attrs,level:+action[1]!},node.content):node)
    else if(action==='blockquote')content=[editor.schema.nodes.blockquote!.create(null,Fragment.fromArray(flat))]
    else if(['bulletList','orderedList','taskList'].includes(action)){const item=editor.schema.nodes[action==='taskList'?'taskItem':'listItem']!;content=[editor.schema.nodes[action]!.create(null,flat.map(node=>item.create(action==='taskList'?{checked:false}:null,node.type.name==='paragraph'?[node]:[editor.schema.nodes.paragraph!.create(),node])))]}
    else return false
    if(!content.length)content=[editor.schema.nodes.paragraph!.create()]
    tr.replaceWith(source.pos,source.end,Fragment.fromArray(content));tr.setSelection(NodeSelection.create(tr.doc,source.pos))
  }
  editor.view.dispatch(tr);editor.view.focus();return true
}
