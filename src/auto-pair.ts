import { Extension } from '@tiptap/core'
import { Plugin, TextSelection } from '@tiptap/pm/state'
const pairs:Record<string,string>={'(':')','[':']','{':'}','"':'"',"'":"'",'（':'）','【':'】','《':'》','「':'」','『':'』','“':'”','‘':'’','*':'*','_':'_','~':'~','^':'^','`':'`'}
const marks:Record<string,string[]>={'*':['italic'],'_':['italic'],'**':['bold'],'__':['bold'],'***':['bold','italic'],'~~':['strike'],'~':['subscript'],'==':['highlight'],'^':['superscript'],'`':['code']}
declare module '@tiptap/core' { interface Storage { autoPair:{enabled:boolean} } }
export const AutoPair=Extension.create({
  name:'autoPair',priority:10000,
  addStorage:()=>({enabled:true}),
  addProseMirrorPlugins(){const settings=this.storage,editor=this.editor
    return[new Plugin({props:{
      handleTextInput(view,from,to,text){
        if(!settings.enabled||view.composing||text.length!==1)return false
        const state=view.state,$from=state.doc.resolve(from),before=$from.parent.textBetween(0,$from.parentOffset),after=$from.parent.textBetween($from.parentOffset,$from.parent.content.size)
        if($from.parent.type.spec.code||$from.marks().some(m=>m.type.name==='code')||/\\(?:\\\\)*$/.test(before))return false
        if((before.match(/(?<!\\)\$/g)?.length||0)%2===1||text==='^'&&before.endsWith('['))return false
        if(text!=='`'&&!before.startsWith('```')&&(before.match(/(?<!\\)`/g)?.length||0)%2===1)return false
        if(text===' '&&/^\*{1,3}$/.test(before)&&after===before){view.dispatch(state.tr.delete(from,from+after.length));return false}
        if((text==='`'&&/^ {0,3}`{2,}$/.test(before)||text==='~'&&/^ {0,3}~{3,}$/.test(before))&&!after){view.dispatch(state.tr.insertText(text,from,to));return true}
        if(text==='~'&&/^ {0,3}~~$/.test(before)&&after==='~~'){const tr=state.tr.insertText('~',from,from+after.length);tr.setSelection(TextSelection.create(tr.doc,from+1));view.dispatch(tr);return true}
        if(text===' '&&/^\[[ xX]\]$/.test(before)&&!after&&$from.depth>=2&&$from.node(-1).type.name==='listItem'){view.dispatch(state.tr.delete($from.start(),from));editor.commands.toggleTaskList();if(/[xX]/.test(before))editor.commands.updateAttributes('taskItem',{checked:true});return true}
        const close=pairs[text],selected=from!==to
        if(selected&&marks[text]){const tr=state.tr;for(const name of marks[text]!){const mark=state.schema.marks[name];if(mark)tr.addMark(from,to,mark.create())}view.dispatch(tr);return true}
        if(selected&&close){const tr=state.tr.insertText(close,to).insertText(text,from);tr.setSelection(TextSelection.create(tr.doc,from+1,to+1));view.dispatch(tr);return true}
        if(!selected&&'_*~'.includes(text)){
          const run=before.match(new RegExp(`(\\${text}{1,2})$`))?.[1]
          if(run&&after.startsWith(run)&&(!before.slice(0,-run.length)||/[\s([{]$/.test(before.slice(0,-run.length)))){const tr=state.tr.insertText(text+text,from);tr.setSelection(TextSelection.create(tr.doc,from+1));view.dispatch(tr);return true}
        }
        if(!selected&&after.startsWith(text)&&Object.values(pairs).includes(text)){
          const prefix=before+text,note=/\[\^([^\]\n]+)\]$/.exec(prefix)
          const link=/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+|#[^\s)]+)\)$/.exec(prefix)
          if(text===')'&&link&&state.schema.marks.link&&before[link.index-1]!=='!'){const start=$from.start()+link.index,tr=state.tr.replaceWith(start,from+1,state.schema.text(link[1]!,[state.schema.marks.link.create({href:link[2]})]));tr.setSelection(TextSelection.create(tr.doc,start+link[1]!.length));tr.setStoredMarks([]);view.dispatch(tr);return true}
          if(note&&text===']'&&state.schema.nodes.footnoteReference){const start=$from.start()+note.index;view.dispatch(state.tr.replaceWith(start,from+1,state.schema.nodes.footnoteReference.create({label:note[1]})));return true}
          const match=/(?<![*_~=^`])(?<marker>\*\*\*|\*\*|__|~~|==|\*|_|~|\^|`)(?<body>(?![*_~=^`])[^\n]+?)\k<marker>$/.exec(prefix)
          if(match?.groups&&marks[match.groups.marker!]){
            const marker=match.groups.marker!,start=$from.start()+match.index,end=from+1,length=marker.length,tr=state.tr.delete(end-length,end).delete(start,start+length)
            for(const name of marks[marker]!){const type=state.schema.marks[name];if(type){tr.addMark(start,end-length*2,type.create());tr.removeStoredMark(type)}}tr.setSelection(TextSelection.create(tr.doc,end-length*2));tr.setStoredMarks($from.marks().filter(m=>!marks[marker]!.includes(m.type.name)));view.dispatch(tr);return true
          }
          view.dispatch(state.tr.setSelection(TextSelection.create(state.doc,from+1)));return true
        }
        if(!close)return false
        if((text==="'"||text==='_'||text==='*')&&/[\p{L}\p{N}]$/u.test(before))return false
        if(after&&/^[\p{L}\p{N}]/u.test(after))return false
        const tr=state.tr.insertText(text+close,from,to)
        // Selection is resolved against the edited transaction, not its original document.
        tr.setSelection(TextSelection.create(tr.doc,from+text.length));view.dispatch(tr);return true
      },
      handleKeyDown(view,event){if(!settings.enabled||view.composing||event.ctrlKey||event.metaKey||!view.state.selection.empty)return false
        const {from,$from}=view.state.selection;if($from.parent.type.spec.code||$from.marks().some(m=>m.type.name==='code'))return false;const before=$from.parent.textBetween(0,$from.parentOffset),after=$from.parent.textBetween($from.parentOffset,$from.parent.content.size)
        if(event.key!=='Backspace')return false
        const closing=before?pairs[before.at(-1)!]:undefined
        if(closing&&closing===after[0]){event.preventDefault();view.dispatch(view.state.tr.delete(from-1,from+1));return true}return false
      },
    }})]
  },
})
