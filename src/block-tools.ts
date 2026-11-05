import type { Editor } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'
import { Fragment } from '@tiptap/pm/model'
import { NodeSelection, TextSelection } from '@tiptap/pm/state'
import { closeHistory } from '@tiptap/pm/history'
import {BlockSelection,selectBlocks} from './block-selection'
export interface BlockInfo {pos:number;node:PMNode;end:number;parentPos:number}
export function blocks(editor:Editor){
  const result:BlockInfo[]=[],doc=editor.state.doc
  doc.descendants((node,pos,parent)=>{
    if(parent===doc||parent?.type.name==='toggleContent'){
      const $pos=doc.resolve(pos)
      result.push({node,pos,end:pos+node.nodeSize,parentPos:$pos.depth?$pos.before($pos.depth):-1})
    }
    // Lists, quotes and tables keep their existing whole-block behaviour.
    return node.type.name==='toggleBlock'||node.type.name==='toggleContent'
  })
  return result
}
export function selectedBlocks(editor:Editor,fallback?:BlockInfo){
 const selection=editor.state.selection
 if(selection instanceof BlockSelection&&(!fallback||selection.blocks.some(r=>r.from===fallback.pos)))return selection.blocks.map(r=>{const node=editor.state.doc.nodeAt(r.from)!,$pos=editor.state.doc.resolve(r.from);return{pos:r.from,end:r.to,node,parentPos:$pos.depth?$pos.before($pos.depth):-1}})
 return fallback?[fallback]:selection instanceof NodeSelection?blocks(editor).filter(b=>b.pos===selection.from):[]
}
export function moveBlocks(editor:Editor,sources:BlockInfo[],target:number){
 if(!sources.length||sources.some(s=>!editor.state.doc.nodeAt(s.pos)?.eq(s.node)||target>=s.pos&&target<=s.end))return false
 const $target=editor.state.doc.resolve(target),fragment=Fragment.fromArray(sources.map(s=>s.node));if(!$target.parent.canReplace($target.index(),$target.index(),fragment))return false
 const tr=closeHistory(editor.state.tr);for(const source of [...sources].sort((a,b)=>b.pos-a.pos))removeBlock(tr,source)
 let at=tr.mapping.map(target,-1),$at=tr.doc.resolve(at)
 const empty=$at.parent.type.name==='toggleContent'&&$at.parent.childCount===1&&$at.parent.firstChild?.type.name==='paragraph'&&!$at.parent.firstChild.content.size
 if(empty){at=$at.start();tr.replaceWith(at,at+$at.parent.firstChild!.nodeSize,fragment)}else tr.insert(at,fragment)
 editor.view.dispatch(tr);const ranges=sources.map(s=>{const from=at;at+=s.node.nodeSize;return{from,to:at}});selectBlocks(editor,ranges);return true
}
export function duplicateBlocks(editor:Editor,sources:BlockInfo[]){const last=sources.at(-1);if(!last)return false;const fragment=Fragment.fromArray(sources.map(s=>s.node));const tr=closeHistory(editor.state.tr).insert(last.end,fragment);editor.view.dispatch(tr);let pos=last.end;selectBlocks(editor,sources.map(s=>{const from=pos;pos+=s.node.nodeSize;return{from,to:pos}}));return true}
function removeBlock(tr:import('@tiptap/pm/state').Transaction,source:BlockInfo){
  const parent=tr.doc.resolve(source.pos).parent
  if(parent.childCount===1)tr.replaceWith(source.pos,source.end,tr.doc.type.schema.nodes.paragraph!.create())
  else tr.delete(source.pos,source.end)
  return tr
}
export function insertBlockAfter(editor:Editor,source:BlockInfo){
  if(!editor.state.doc.nodeAt(source.pos)?.eq(source.node))return false
  const tr=closeHistory(editor.state.tr).insert(source.end,editor.schema.nodes.paragraph!.create())
  tr.setSelection(TextSelection.create(tr.doc,source.end+1)).scrollIntoView();editor.view.dispatch(tr);editor.view.focus();return true
}
export function moveBlock(editor:Editor,source:BlockInfo,target:number){
  if(!editor.state.doc.nodeAt(source.pos)?.eq(source.node)||target<0||target>editor.state.doc.content.size||target>=source.pos&&target<=source.end)return false
  const $target=editor.state.doc.resolve(target)
  if(!$target.parent.canReplace($target.index(),$target.index(),Fragment.from(source.node)))return false
  const tr=removeBlock(closeHistory(editor.state.tr),source),at=tr.mapping.map(target,-1),$at=tr.doc.resolve(at)
  const empty=$at.parent.type.name==='toggleContent'&&$at.parent.childCount===1&&$at.parent.firstChild?.type.name==='paragraph'&&!$at.parent.firstChild.content.size
  const insertAt=empty?$at.start():at
  if(empty)tr.replaceWith(insertAt,insertAt+$at.parent.firstChild!.nodeSize,source.node)
  else tr.insert(insertAt,source.node)
  tr.setSelection(NodeSelection.create(tr.doc,insertAt));editor.view.dispatch(tr);editor.view.focus();return true
}
export function blockAction(editor:Editor,source:BlockInfo,action:string){
  if(!editor.state.doc.nodeAt(source.pos)?.eq(source.node))return false
  const tr=closeHistory(editor.state.tr)
  if(action==='duplicate'){tr.insert(source.end,source.node);tr.setSelection(NodeSelection.create(tr.doc,source.end))}
  else if(action==='delete')removeBlock(tr,source)
  else if(action==='up'||action==='down'){const all=blocks(editor).filter(b=>b.parentPos===source.parentPos),index=all.findIndex(b=>b.pos===source.pos);return action==='up'&&index>0?moveBlock(editor,source,all[index-1]!.pos):action==='down'&&index<all.length-1?moveBlock(editor,source,all[index+1]!.end):false}
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
