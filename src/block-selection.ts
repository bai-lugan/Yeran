import {Extension,type Editor} from '@tiptap/core'
import {Selection,SelectionRange,NodeSelection,Plugin,PluginKey} from '@tiptap/pm/state'
import {Fragment,Slice,type Node as PMNode,type ResolvedPos} from '@tiptap/pm/model'
import type {Mappable} from '@tiptap/pm/transform'
import {Decoration,DecorationSet} from '@tiptap/pm/view'
import {closeHistory} from '@tiptap/pm/history'
import {serializeBlockNodes} from './block-clipboard'
import {textBlockTypes} from './block-fragments'
export type BlockRange={from:number;to:number}
function canonical(ranges:BlockRange[]){const sorted=ranges.filter(r=>r.to>r.from).sort((a,b)=>a.from-b.from||b.to-a.to),out:BlockRange[]=[];for(const r of sorted)if(!out.some(p=>p.from<=r.from&&p.to>=r.to))out.push(r);return out}
export class BlockSelection extends Selection{
 readonly blocks:BlockRange[]
 constructor(doc:PMNode,ranges:BlockRange[]){const list=canonical(ranges),resolved=list.map(r=>new SelectionRange(doc.resolve(r.from),doc.resolve(r.to)));super(resolved[0]!.$from,resolved.at(-1)!.$to,resolved);this.blocks=list}
 visible=false
 eq(other:Selection){return other instanceof BlockSelection&&JSON.stringify(this.blocks)===JSON.stringify(other.blocks)}
 content(){return new Slice(Fragment.fromArray(this.blocks.map(r=>this.$from.doc.nodeAt(r.from)!).filter(Boolean)),0,0)}
 map(doc:PMNode,mapping:Mappable):Selection{return BlockSelection.resolve(doc,this.blocks.map(r=>({from:mapping.map(r.from,1),to:mapping.map(r.to,-1)})))}
 toJSON(){return{type:'yeranBlocks',blocks:this.blocks}}
 static fromJSON(doc:PMNode,json:any){return BlockSelection.resolve(doc,json.blocks||[])}
 static resolve(doc:PMNode,ranges:BlockRange[]):Selection{const valid=canonical(ranges).filter(r=>r.from>=0&&r.to<=doc.content.size&&doc.nodeAt(r.from)?.nodeSize===r.to-r.from);return valid.length>1?new BlockSelection(doc,valid):valid.length?NodeSelection.create(doc,valid[0]!.from):Selection.near(doc.resolve(Math.max(0,Math.min(doc.content.size,ranges[0]?.from||0))))}
 getBookmark(){const ranges=this.blocks;return{map(mapping:Mappable){return bookmark(ranges.map(r=>({from:mapping.map(r.from,1),to:mapping.map(r.to,-1)})))},resolve(doc:PMNode){return BlockSelection.resolve(doc,ranges)}}}
}
function bookmark(ranges:BlockRange[]):ReturnType<BlockSelection['getBookmark']>{return{map(mapping:Mappable){return bookmark(ranges.map(r=>({from:mapping.map(r.from,1),to:mapping.map(r.to,-1)})))},resolve(doc:PMNode){return BlockSelection.resolve(doc,ranges)}}}
Selection.jsonID('yeranBlocks',BlockSelection)
export function selectBlocks(editor:Editor,ranges:BlockRange[]){const list=canonical(ranges);const selection=!list.length?Selection.near(editor.state.doc.resolve(Math.min(editor.state.doc.content.size,editor.state.selection.from))):list.length===1?NodeSelection.create(editor.state.doc,list[0]!.from):new BlockSelection(editor.state.doc,list);if(!selection.eq(editor.state.selection))editor.view.dispatch(editor.state.tr.setSelection(selection));editor.view.focus();return true}
export function selectionBlocks(selection:Selection):BlockRange[]{if(selection instanceof BlockSelection)return selection.blocks;if(selection instanceof NodeSelection&&selection.node.isBlock&&['doc','toggleContent'].includes(selection.$from.parent.type.name))return[{from:selection.from,to:selection.to}];return[]}
export function deleteBlockSelection(editor:Editor,replacement?:string){const ranges=selectionBlocks(editor.state.selection);if(!ranges.length)return false;const tr=closeHistory(editor.state.tr);for(const r of [...ranges].reverse()){const parent=tr.doc.resolve(r.from).parent;if(parent.childCount===1)tr.replaceWith(r.from,r.to,editor.schema.nodes.paragraph!.create());else tr.delete(r.from,r.to)}tr.setSelection(Selection.near(tr.doc.resolve(Math.min(tr.doc.content.size,tr.mapping.map(ranges[0]!.from)))));if(replacement!==undefined)tr.insertText(replacement);editor.view.dispatch(tr);editor.view.focus();return true}
export const BlockSelections=Extension.create({
 name:'yeranBlockSelections',priority:1100,
 addKeyboardShortcuts(){return{Delete:()=>deleteBlockSelection(this.editor),Backspace:()=>deleteBlockSelection(this.editor),Escape:()=>selectionBlocks(this.editor.state.selection).length?selectBlocks(this.editor,[]):false}},
 addProseMirrorPlugins(){const editor=this.editor;return[new Plugin({key:new PluginKey('yeranBlockSelection'),props:{
  decorations(state){const s=state.selection,ranges=selectionBlocks(s),paged=!editor.storage.mixedPagination.continuous;const marks=ranges.flatMap(r=>{const fragment=paged&&textBlockTypes.has(state.doc.nodeAt(r.from)!.type.name),classes=[s instanceof BlockSelection?'yeran-block-selected':'',fragment?'yeran-selection-fragments':''].filter(Boolean).join(' ');return classes?[Decoration.node(r.from,r.to,{class:classes})]:[]});return marks.length?DecorationSet.create(state.doc,marks):null},
  handleTextInput(_view,_from,_to,text){if(!(editor.state.selection instanceof BlockSelection))return false;return deleteBlockSelection(editor,text)},
  handleDOMEvents:{beforeinput(view,event){if(!(view.state.selection instanceof BlockSelection)||event.isComposing)return false;if(event.inputType==='insertText'&&event.data!==null){event.preventDefault();return deleteBlockSelection(editor,event.data)}if(event.inputType.startsWith('delete')){event.preventDefault();return deleteBlockSelection(editor)}return false},paste(view){if(view.state.selection instanceof BlockSelection)deleteBlockSelection(editor);return false},compositionstart(view){if(view.state.selection instanceof BlockSelection)deleteBlockSelection(editor);return false},copy(view,event){const ranges=selectionBlocks(view.state.selection);if(!ranges.length||!event.clipboardData)return false;const data=serializeBlockNodes(editor,ranges.map(r=>view.state.doc.nodeAt(r.from)!));event.clipboardData.setData('text/plain',data.text);event.clipboardData.setData('text/html',data.html);event.preventDefault();return true},cut(view,event){const ranges=selectionBlocks(view.state.selection);if(!ranges.length||!event.clipboardData)return false;const data=serializeBlockNodes(editor,ranges.map(r=>view.state.doc.nodeAt(r.from)!));event.clipboardData.setData('text/plain',data.text);event.clipboardData.setData('text/html',data.html);event.preventDefault();deleteBlockSelection(editor);return true}}
 }})]}
})
