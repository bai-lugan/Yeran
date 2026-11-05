import type {Editor} from '@tiptap/core'
import {getPageSlices,mm} from './document'

export const textBlockTypes=new Set(['paragraph','heading','bulletList','orderedList','taskList','blockquote'])
export interface BlockFragment {left:number;top:number;right:number;bottom:number;width:number;height:number}
export function blockViewport(editor:Editor){const canvas=editor.view.dom.closest('.canvas');if(!canvas)return null;const box=canvas.getBoundingClientRect(),meta=canvas.querySelector('.canvas-meta')?.getBoundingClientRect();return{left:box.left,right:box.right,top:Math.max(box.top,meta?.bottom||box.top),bottom:box.bottom}}
export function blockFragments(editor:Editor,element:HTMLElement):BlockFragment[]{
 if(element.matches('details'))return [element.querySelector('summary')!.getBoundingClientRect()]
 if(!element.getClientRects().length||element.closest('details:not([open])'))return []
 const root=editor.view.dom,box=element.getBoundingClientRect()
 if(element.matches('.paged-table')){
  const rows=[...element.querySelectorAll<HTMLElement>(':scope>.table-plus>tr')].map(r=>r.getBoundingClientRect()).filter(r=>r.height>0)
  if(!rows.length)return[]
  if(editor.storage.mixedPagination.continuous){const left=Math.min(...rows.map(r=>r.left)),right=Math.max(...rows.map(r=>r.right)),top=rows[0]!.top,bottom=rows.at(-1)!.bottom;return[{left,right,top,bottom,width:right-left,height:bottom-top}]}
  const base=root.getBoundingClientRect(),scale=base.width/root.offsetWidth||1,margin=mm(editor.storage.mixedPagination.margin)*scale,result:BlockFragment[]=[]
  for(const sheet of getPageSlices(root)){
   const top=base.top+sheet.top*scale+margin,bottom=base.top+(sheet.top+sheet.height)*scale-margin-24*scale,parts=rows.filter(r=>r.bottom>top&&r.top<bottom)
   if(!parts.length)continue
   const left=Math.min(...parts.map(r=>r.left)),right=Math.max(...parts.map(r=>r.right)),start=Math.max(top,Math.min(...parts.map(r=>r.top))),end=Math.min(bottom,Math.max(...parts.map(r=>r.bottom)))
   if(end>start)result.push({left,right,top:start,bottom:end,width:right-left,height:end-start})
  }
  return result
 }
 if(editor.storage.mixedPagination.continuous||!element.matches('p,h1,h2,h3,h4,h5,h6,ul,ol,blockquote'))return [box]
 const base=root.getBoundingClientRect(),scale=base.width/root.offsetWidth||1,margin=mm(editor.storage.mixedPagination.margin)*scale
 const lines:DOMRect[]=[],range=document.createRange(),walker=document.createTreeWalker(element,NodeFilter.SHOW_TEXT)
 while(walker.nextNode()){
  const node=walker.currentNode,parent=node.parentElement
  if(!node.textContent||parent?.closest('button,select,textarea,.katex-mathml,.block-controls,.math-input'))continue
  range.selectNodeContents(node);for(const rect of range.getClientRects())if(rect.height>1)lines.push(rect)
 }
 if(!lines.length){range.selectNodeContents(element);for(const rect of range.getClientRects())if(rect.height>1)lines.push(rect);if(!lines.length&&box.height<100)lines.push(box)}
 const leading=Math.max(2,(parseFloat(getComputedStyle(element).lineHeight)||20)*scale*.18),result:BlockFragment[]=[]
 for(const sheet of getPageSlices(root)){
  const top=base.top+sheet.top*scale+margin,bottom=base.top+(sheet.top+sheet.height)*scale-margin-24*scale
  const matching=lines.filter(r=>r.bottom>top&&r.top<bottom);if(!matching.length)continue
  const left=Math.max(box.left,base.left+(sheet.left||0)*scale+margin),right=Math.min(box.right,base.left+((sheet.left||0)+(sheet.width||root.offsetWidth))*scale-margin)
  const y=Math.max(top,Math.min(...matching.map(r=>r.top))-leading),end=Math.min(bottom,Math.max(...matching.map(r=>r.bottom))+leading)
  if(right>left&&end>y)result.push({left,top:y,right,bottom:end,width:right-left,height:end-y})
 }
 return result
}
