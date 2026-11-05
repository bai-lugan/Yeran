import { Node, Extension, type Editor, type JSONContent } from '@tiptap/core'
import { Plugin, TextSelection } from '@tiptap/pm/state'
import { Mapping, ReplaceStep } from '@tiptap/pm/transform'
import type { Node as PMNode } from '@tiptap/pm/model'

export type EditingMode='markdown'|'text'
export type TextEncoding='utf8'|'utf16le'|'utf16be'
export const TEXT_EXTENSIONS=['txt','text','log','csv','tsv','json','jsonc','jsonl','yaml','yml','xml','html','htm','css','scss','less','js','jsx','mjs','cjs','ts','tsx','py','pyw','bat','cmd','ps1','psm1','psd1','sh','bash','zsh','ksh','fish','ini','cfg','conf','config','toml','properties','env','gitignore','gitattributes','editorconfig','rst','tex','sql','c','h','cpp','hpp','cs','go','rs','java','rb','php','swift','kt','kts','vue','svelte']
export function editingMode(path?:string|null):EditingMode{return !path||/\.(md|markdown|textpack|tetpack|textbundle)[\\/]?$/i.test(path)?'markdown':'text'}
export function listedTextFile(name:string){return !name.replace(/^\./,'').includes('.')||TEXT_EXTENSIONS.includes(name.split('.').pop()!.toLowerCase())||/^\.env(?:\.|$)/i.test(name)}
export function textEncoding(value:unknown):TextEncoding{return value==='utf16le'||value==='utf16be'?value:'utf8'}
export function decodeText(bytes:Uint8Array):{content:string;textEncoding:TextEncoding}{
 if(bytes.byteLength>20*1024*1024)throw Error('支持 20 MB 以内的文本文件。')
 const encoding:TextEncoding=bytes[0]===255&&bytes[1]===254?'utf16le':bytes[0]===254&&bytes[1]===255?'utf16be':'utf8'
 let content:string
 try{content=new TextDecoder(encoding==='utf8'?'utf-8':encoding==='utf16le'?'utf-16le':'utf-16be',{fatal:true,ignoreBOM:true}).decode(bytes)}catch{throw Error('文件不是支持的 UTF-8 / UTF-16 文本，未作为文本打开。')}
 if(/[\u0000-\u0008\u000b\u000e-\u001a\u001c-\u001f\u007f]/.test(content))throw Error('文件包含二进制数据，未作为文本打开。')
 return{content,textEncoding:encoding}
}
export function encodeText(content:string,encoding:TextEncoding='utf8'){
 if(encoding==='utf8')return new TextEncoder().encode(content)
 const bytes=new Uint8Array(content.length*2),view=new DataView(bytes.buffer)
 for(let i=0;i<content.length;i++)view.setUint16(i*2,content.charCodeAt(i),encoding==='utf16le')
 return bytes
}
export function plainContent(content:string):JSONContent{
 const lines:JSONContent[]=[];let from=0
 for(const match of content.matchAll(/\r\n|\r|\n/g)){const text=content.slice(from,match.index);lines.push({type:'plainLine',attrs:{eol:match[0]},content:text?[{type:'text',text}]:[]});from=match.index!+match[0].length}
 const text=content.slice(from);lines.push({type:'plainLine',attrs:{eol:''},content:text?[{type:'text',text}]:[]})
 return{type:'doc',content:lines}
}
export function plainString(doc:PMNode){let text='';doc.forEach(node=>{text+=node.textContent+(node.attrs.eol||'')});return text}
function lineAt(doc:PMNode,pos:number){let resolved=doc.resolve(Math.max(1,Math.min(doc.content.size-1,pos)));if(!resolved.depth)resolved=TextSelection.near(resolved,1).$from;return{node:resolved.parent,pos:resolved.before(),offset:resolved.parentOffset}}
export function replacePlainSelection(editor:Editor,text:string,from=editor.state.selection.from,to=editor.state.selection.to){
 const state=editor.state,start=lineAt(state.doc,from),end=lineAt(state.doc,to),combined=start.node.textContent.slice(0,start.offset)+text+end.node.textContent.slice(end.offset)
 const json=plainContent(combined).content!,last=json.at(-1)!;last.attrs={eol:end.node.attrs.eol}
 const nodes=json.map(node=>state.schema.nodeFromJSON(node)),tr=state.tr.replaceWith(start.pos,end.pos+end.node.nodeSize,nodes)
 const before=start.node.textContent.slice(0,start.offset)+text,parts=plainContent(before).content!;let cursor=start.pos+1
 for(let i=0;i<parts.length-1;i++)cursor+=nodes[i]!.nodeSize
 cursor+=parts.at(-1)!.content?.[0]?.text?.length||0
 editor.view.dispatch(tr.setSelection(TextSelection.create(tr.doc,cursor)).scrollIntoView());return true
}
export function selectedPlainText(editor:Editor){const {from,to}=editor.state.selection;let result='';editor.state.doc.forEach((node,pos)=>{const a=Math.max(0,from-pos-1),b=Math.min(node.content.size,to-pos-1);if(b>a)result+=node.textContent.slice(a,b);if(to>pos+node.nodeSize&&from<=pos+node.nodeSize-1)result+=node.attrs.eol||''});return result}
declare module '@tiptap/core'{interface Storage{plainTextMode:{enabled:boolean;eol:string}}}
export const PlainLine=Node.create({name:'plainLine',priority:50,group:'block',content:'text*',marks:'',code:true,defining:true,whitespace:'pre',addAttributes:()=>({eol:{default:'',rendered:false}}),parseHTML:()=>[{tag:'p[data-plain-line]'}],renderHTML:()=>['p',{'data-plain-line':'',class:'plain-line'},0]})
export const PlainTextMode=Extension.create({
 name:'plainTextMode',priority:20000,addStorage:()=>({enabled:false,eol:'\n'}),
 addKeyboardShortcuts(){const editor=this.editor,enabled=()=>this.storage.enabled
  const backspace=()=>{if(!enabled())return false;const {selection,doc}=editor.state;if(!selection.empty)return replacePlainSelection(editor,'');const at=lineAt(doc,selection.from);if(at.offset||at.pos===0)return false;return replacePlainSelection(editor,'',at.pos-1,at.pos+1)}
  const forward=()=>{if(!enabled())return false;const{selection,doc}=editor.state;if(!selection.empty)return replacePlainSelection(editor,'');const at=lineAt(doc,selection.from);if(at.offset!==at.node.content.size||at.pos+at.node.nodeSize>=doc.content.size)return false;return replacePlainSelection(editor,'',selection.from,at.pos+at.node.nodeSize+1)}
  return{Enter:()=>enabled()&&replacePlainSelection(editor,this.storage.eol),'Shift-Enter':()=>enabled()&&replacePlainSelection(editor,this.storage.eol),Tab:()=>enabled()&&replacePlainSelection(editor,'\t'),'Shift-Tab':()=>enabled(),
   Backspace:backspace,'Mod-Backspace':backspace,'Shift-Backspace':backspace,Delete:forward,'Mod-Delete':forward,
   'Mod-Enter':()=>enabled()&&replacePlainSelection(editor,this.storage.eol)}
 },
 addProseMirrorPlugins(){const editor=this.editor,settings=this.storage;return[new Plugin({
  filterTransaction(tr){if(!settings.enabled||!tr.docChanged)return true;let valid=true;tr.doc.descendants(node=>{if(!['plainLine','text'].includes(node.type.name)||node.marks.length)valid=false});return valid},
  // Native word deletion/IME can join DOM paragraphs before a keyboard handler
  // sees the new selection. A joined line inherits the ending of its last old
  // line, rather than the first line's attributes chosen by the DOM parser.
  appendTransaction(transactions,oldState,state){
   if(!settings.enabled||oldState.doc.childCount===state.doc.childCount||!transactions.some(tr=>tr.docChanged))return
   const mapping=new Mapping(),endings=new Map<number,string>(),openJoin=transactions.some(tr=>tr.steps.some(step=>step instanceof ReplaceStep&&(step.slice.openStart||step.slice.openEnd)));for(const tr of transactions)mapping.appendMapping(tr.mapping)
   oldState.doc.forEach((node,pos)=>{const mapped=mapping.mapResult(pos+node.nodeSize-1,1),end=mapped.pos;if(end<1||end>state.doc.content.size)return;let at=state.doc.resolve(end);if(!at.depth&&openJoin&&mapped.deleted&&end>1)at=state.doc.resolve(end-1);if(at.depth&&at.parent.type.name==='plainLine'&&at.parentOffset===at.parent.content.size)endings.set(at.before(),node.attrs.eol)})
   let tr=state.tr;state.doc.forEach((node,pos,index)=>{const eol=index===state.doc.childCount-1?'':endings.get(pos)||node.attrs.eol||settings.eol;if(node.attrs.eol!==eol)tr=tr.setNodeMarkup(pos,undefined,{...node.attrs,eol})});return tr.docChanged?tr:undefined
  },
  props:{handleTextInput(view,from,to,text){const start=view.state.doc.resolve(from);if(!settings.enabled||start.parent.type.name==='plainLine'&&start.sameParent(view.state.doc.resolve(to)))return false;return replacePlainSelection(editor,text,from,to)},handlePaste(_view,event){if(!settings.enabled)return false;event.preventDefault();if(!event.clipboardData?.types.includes('text/plain'))return true;return replacePlainSelection(editor,event.clipboardData.getData('text/plain'))},handleDrop(view,event,_slice,moved){
   if(!settings.enabled)return false;event.preventDefault();if(!event.dataTransfer?.types.includes('text/plain'))return true
   const target=view.posAtCoords({left:event.clientX,top:event.clientY});if(!target)return true
   const text=event.dataTransfer.getData('text/plain'),{from,to}=view.state.selection;let pos=target.pos
   if(moved){if(pos>=from&&pos<=to)return true;const size=view.state.doc.content.size;replacePlainSelection(editor,'');if(pos>to)pos+=view.state.doc.content.size-size}
   return replacePlainSelection(editor,text,pos,pos)
  },handleDOMEvents:{compositionstart(view){const{from,to}=view.state.selection,start=view.state.doc.resolve(from);if(settings.enabled&&(start.parent.type.name!=='plainLine'||!start.sameParent(view.state.doc.resolve(to))))replacePlainSelection(editor,'');return false},copy(_view,event){if(!settings.enabled)return false;event.preventDefault();event.clipboardData?.setData('text/plain',selectedPlainText(editor));return true},cut(_view,event){if(!settings.enabled)return false;event.preventDefault();event.clipboardData?.setData('text/plain',selectedPlainText(editor));return replacePlainSelection(editor,'')}}}
 })]}
})
