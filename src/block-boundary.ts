import {Extension} from '@tiptap/core'
import {Plugin,PluginKey,NodeSelection,TextSelection} from '@tiptap/pm/state'

// Rendered Mermaid is a whole object at a paragraph boundary. Joining the
// paragraph into its code node changes the diagram source and can erase it.
export const BlockBoundary=Extension.create({
 name:'yeranBlockBoundary',priority:1200,
 addProseMirrorPlugins(){const editor=this.editor;let protectedPos:number|undefined
  const protect=()=>{
   const {selection,doc}=editor.state
   if(!(selection instanceof TextSelection)||!selection.empty||selection.$from.parentOffset||!['paragraph','heading'].includes(selection.$from.parent.type.name))return false
   const $from=selection.$from,depth=$from.depth-1,index=$from.index(depth)
   if(!index)return false
   const previous=$from.node(depth).child(index-1)
   if(previous.type.name!=='codeBlock'||String(previous.attrs.language).toLowerCase()!=='mermaid')return false
   protectedPos=$from.before()-previous.nodeSize
   editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(doc,protectedPos)));editor.view.focus();return true
  }
  return[new Plugin({key:new PluginKey('yeranBlockBoundary'),props:{
   handleKeyDown(view,event){if(event.key!=='Backspace'){protectedPos=undefined;return false}if(view.composing)return false
    const s=view.state.selection
    if(event.repeat&&protectedPos!==undefined&&s instanceof NodeSelection&&s.from===protectedPos&&s.node.type.name==='codeBlock')return true
    return protect()
   },
   handleDOMEvents:{keyup(_view,event){if(event.key==='Backspace')protectedPos=undefined;return false},blur(){protectedPos=undefined;return false},beforeinput(_view,event){if(event.inputType==='deleteContentBackward'&&!event.isComposing&&protect()){event.preventDefault();return true}return false}},
  }})]
 },
})
