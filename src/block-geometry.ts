import type {Editor} from '@tiptap/core'
export type BlockAlign='left'|'center'|'right'
export const blockAlignment=(value:unknown):BlockAlign=>value==='center'||value==='right'?value:'left'
export const blockAlignStyle=(value:unknown)=>value==='center'?'margin-left:auto;margin-right:auto':value==='right'?'margin-left:auto;margin-right:0':''
export const blockAlignAttribute={default:'left',parseHTML:(el:HTMLElement)=>el.hasAttribute('data-block-align')?blockAlignment(el.getAttribute('data-block-align')):el.style.marginLeft==='auto'?el.style.marginRight==='auto'?'center':'right':'left',renderHTML:(attrs:Record<string,unknown>)=>attrs.blockAlign==='center'||attrs.blockAlign==='right'?{'data-block-align':attrs.blockAlign}:{}}
export function blockAvailableWidth(editor:Editor,dom:HTMLElement){
 const root=editor.view.dom,parent=dom.parentElement!,style=getComputedStyle(parent),available=parent.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight),options=editor.storage.mixedPagination
 if(options.continuous)return Math.max(48,available)
 let nesting=0,ancestor=parent;while(ancestor&&ancestor!==root){if(ancestor.classList.contains('toggle-content'))nesting++;ancestor=ancestor.parentElement!}
 const widths=[options.base,...Object.values(options.directions)].map(d=>d==='landscape'?1123:794)
 return Math.max(48,Math.min(available,Math.min(...widths)-options.margin*96/25.4*2-nesting*40))
}
export function blockBodyHeight(editor:Editor){const o=editor.storage.mixedPagination;return o.continuous?Infinity:Math.min(...[o.base,...Object.values(o.directions)].map(d=>d==='landscape'?794:1123))-o.margin*96/25.4*2-24}
export function nodeDOMPath(root:HTMLElement,element:HTMLElement){const path:string[]=[];let part:HTMLElement|null=element;while(part&&part!==root){const parent:HTMLElement|null=part.parentElement;if(!parent)return'';path.unshift(`:nth-child(${[...parent.children].indexOf(part)+1})`);part=parent}return part===root?'#app .paper-editor>'+path.join('>'):''}
export function objectBlock(editor:Editor){
 const selection=editor.state.selection,$from=selection.$from,node=(selection as any).node as import('@tiptap/pm/model').Node|undefined
 if(node&&['image','table','codeBlock'].includes(node.type.name))return{node,pos:selection.from}
 for(let depth=$from.depth;depth>0;depth--){const node=$from.node(depth);if(['codeBlock','table'].includes(node.type.name))return{node,pos:$from.before(depth)}}
 return null
}
