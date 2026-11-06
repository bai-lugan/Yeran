import {Extension} from '@tiptap/core'
import {Plugin,PluginKey,TextSelection} from '@tiptap/pm/state'
import {Fragment,type Node as PMNode} from '@tiptap/pm/model'
import {TableMap} from '@tiptap/pm/tables'
import {closeHistory} from '@tiptap/pm/history'

function headerCells(paragraph:PMNode) {
  const text=paragraph.textBetween(0,paragraph.content.size,'\n','\ufffc')
  if(!/^ {0,3}\|/.test(text)||!text.trimEnd().endsWith('|')||text.includes('\n'))return
  const separators:number[]=[];let slashes=0
  for(let i=0;i<text.length;i++){
    const char=text[i]!,code=char==='|'&&paragraph.childAfter(i).node?.marks.some(mark=>mark.type.name==='code')
    if(char==='|'&&slashes%2===0&&!code)separators.push(i)
    slashes=char==='\\'?slashes+1:0
  }
  if(separators.length<2||separators[0]!==text.indexOf('|')||separators.at(-1)!==text.trimEnd().length-1||separators.length>129)return
  const cells:PMNode[]=[]
  for(let i=1;i<separators.length;i++){
    let from=separators[i-1]!+1,to=separators[i]!
    while(from<to&&/[ \t]/.test(text[from]!))from++
    while(to>from&&/[ \t]/.test(text[to-1]!))to--
    const nodes:PMNode[]=[]
    paragraph.content.cut(from,to).forEach(node=>{
      if(!node.isText){nodes.push(node);return}
      const value=node.text!.replace(/\\([\\|])/g,'$1')
      if(value)nodes.push(paragraph.type.schema.text(value,node.marks))
    })
    cells.push(paragraph.type.create(paragraph.attrs,Fragment.fromArray(nodes)))
  }
  if(!cells.some(cell=>cell.content.size))return
  return cells
}

export const TableInput=Extension.create({
  name:'tableInput',priority:10500,
  addProseMirrorPlugins(){const editor=this.editor;return[new Plugin({
    key:new PluginKey('yeranTableInput'),props:{handleKeyDown(view,event){
      if(event.key!=='Enter'||event.shiftKey||event.ctrlKey||event.metaKey||event.altKey||event.isComposing||view.composing||editor.storage.plainTextMode.enabled||editor.isActive('table'))return false
      const {$from,empty}=view.state.selection
      if(!empty||$from.parent.type.name!=='paragraph'||$from.parentOffset!==$from.parent.content.size)return false
      const cells=headerCells($from.parent);if(!cells)return false
      const schema=view.state.schema,header=schema.nodes.tableRow!.create(null,cells.map(cell=>schema.nodes.tableHeader!.create(null,cell)))
      const body=schema.nodes.tableRow!.create(null,cells.map(()=>schema.nodes.tableCell!.createAndFill()!))
      const table=schema.nodes.table!.create(null,[header,body]),pos=$from.before(),tr=closeHistory(view.state.tr)
      tr.replaceWith(pos,$from.after(),table)
      let tablePos=pos,found=false
      tr.doc.nodesBetween(pos,Math.min(tr.doc.content.size,$from.after()+tr.doc.content.size-view.state.doc.content.size),(node,at)=>{if(!found&&node.type.name==='table'){tablePos=at;found=true;return false}})
      if(!found)return false
      const map=TableMap.get(tr.doc.nodeAt(tablePos)!),cell=tablePos+1+map.map[map.width]!
      tr.setSelection(TextSelection.near(tr.doc.resolve(cell+1))).setStoredMarks([])
      view.dispatch(tr.scrollIntoView());view.dispatch(closeHistory(view.state.tr));return true
    }},
  })]},
})
