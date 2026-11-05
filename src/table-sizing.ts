import type {Editor} from '@tiptap/core'
import {closeHistory} from '@tiptap/pm/history'
import {NodeSelection} from '@tiptap/pm/state'
import {blockAvailableWidth,blockAlignment} from './block-geometry'
export const tableWidthAttribute={default:null,parseHTML:(el:HTMLElement)=>{const n=Number(el.getAttribute('data-table-width'));return n>=24&&n<=10000?n:null},renderHTML:(a:Record<string,unknown>)=>a.tableWidth?{'data-table-width':a.tableWidth}:{}}
export const tableScaleAttribute={default:1,parseHTML:(el:HTMLElement)=>{const n=Number(el.getAttribute('data-table-scale'));return n>=.01&&n<=4?n:1},renderHTML:(a:Record<string,unknown>)=>a.tableScale!==1?{'data-table-scale':a.tableScale}:{}}
export function applyTableSize(dom:HTMLElement,attrs:Record<string,any>,editor:Editor){
 const width=Number(attrs.tableWidth),scale=Math.max(.01,Math.min(4,Number(attrs.tableScale)||1)),sized=width>=24&&width<=10000
 // Node views are constructed before Editor.view exists, including print snapshots.
 // Use the stored width until the connected wrapper can be measured next frame.
 if(sized){dom.dataset.tableSized='';const effective=dom.isConnected?Math.min(width,blockAvailableWidth(editor,dom)):width;for(const [name,value] of [['--yeran-table-width',effective+'px'],['--yeran-table-scale',String(scale)],['--yeran-table-layout-width',effective/scale+'px']])if(dom.style.getPropertyValue(name)!==value)dom.style.setProperty(name!,value!)}
 else{delete dom.dataset.tableSized;for(const name of ['--yeran-table-width','--yeran-table-scale','--yeran-table-layout-width'])dom.style.removeProperty(name)}
 dom.dataset.blockAlign=blockAlignment(attrs.blockAlign)
}
export function setTableSize(editor:Editor,pos:number,width:number,scale:number){const node=editor.state.doc.nodeAt(pos);if(node?.type.name!=='table')return false;const tr=closeHistory(editor.state.tr).setNodeMarkup(pos,undefined,{...node.attrs,tableWidth:Math.round(width),tableScale:Math.round(scale*10000)/10000});if(editor.state.selection instanceof NodeSelection&&editor.state.selection.from===pos)tr.setSelection(NodeSelection.create(tr.doc,pos));editor.view.dispatch(tr);return true}
