import type {Editor} from '@tiptap/core'
import {watch} from 'vue'
import {blockAvailableWidth,blockBodyHeight} from './block-geometry'
import {locale,t} from './i18n'
export function createCodeLayout(block:HTMLElement,pre:HTMLElement,editor:Editor,size:{get:()=>{width:number|null;scale:number};set:(width:number,scale:number)=>void}){
 const handles=document.createElement('div');handles.className='code-resize-handles';handles.contentEditable='false';block.append(handles)
 let frame=0,printing=false,destroyed=false,cleanup:(()=>void)|undefined,live:{width:number;scale:number}|undefined,actualWidth=0,actualScale=1,signature='',observedRoot:HTMLElement|undefined
 for(const corner of ['nw','ne','sw','se']){const button=document.createElement('button');button.type='button';button.className='diagram-resize-handle handle-'+corner;button.dataset.corner=corner;button.addEventListener('pointerdown',e=>start(e,corner));handles.append(button)}
 const labels=()=>handles.querySelectorAll('button').forEach(b=>{b.setAttribute('aria-label',t('拖动调整代码块尺寸')+' '+b.dataset.corner);b.title=t('拖动等比缩放代码和文字')});labels();const unwatch=watch(locale,labels)
 function layout(force=false){
  frame=0;if(destroyed||!block.isConnected||block.closest('details:not([open])'))return
  const current=live||size.get(),width=Number(current.width),scale=Number(current.scale)||1,sized=width>0,root=editor.view.dom,rootScale=root.getBoundingClientRect().width/root.offsetWidth||1
  if(observedRoot!==root){observedRoot=root;observer.observe(root)}
  block.classList.toggle('code-sized',sized);block.classList.toggle('code-printing',printing)
  const key=[width,scale,printing,blockAvailableWidth(editor,block),blockBodyHeight(editor),pre.textContent].join('|')
  if(force||signature!==key){signature=key
   if(sized){
    const virtual=width/scale;pre.style.width=virtual+'px';pre.style.zoom=String(scale);const height=pre.scrollHeight*scale,fit=Math.min(1,blockAvailableWidth(editor,block)/width,(blockBodyHeight(editor)-80)/Math.max(1,height))
    actualWidth=width*fit;actualScale=scale*fit;block.style.width=Math.max(100,actualWidth)+'px';pre.style.zoom=String(actualScale);block.dataset.blockWidth=String(Math.max(100,actualWidth))
   }else{block.style.removeProperty('width');pre.style.removeProperty('width');pre.style.removeProperty('zoom');delete block.dataset.blockWidth;actualScale=1;actualWidth=pre.getBoundingClientRect().width/rootScale}
  }
  const b=block.getBoundingClientRect(),p=pre.getBoundingClientRect();handles.style.cssText=`left:${(p.left-b.left)/rootScale}px;top:${(p.top-b.top)/rootScale}px;width:${p.width/rootScale}px;height:${p.height/rootScale}px`
 }
 function schedule(){if(!destroyed&&!frame)frame=requestAnimationFrame(()=>layout())}
 function start(event:PointerEvent,corner:string){
  if(event.button!==0)return;event.preventDefault();event.stopPropagation();cleanup?.()
  const doc=editor.state.doc,root=editor.view.dom,scale=root.getBoundingClientRect().width/root.offsetWidth||1,b=pre.getBoundingClientRect(),width=b.width/scale,height=b.height/scale,originalScale=actualScale,max=Math.min(blockAvailableWidth(editor,block)/width,(blockBodyHeight(editor)-80)/Math.max(1,height),4/originalScale),min=Math.min(max,Math.max(100/width,.15/originalScale)),x=event.clientX,y=event.clientY
  let moved=false,last=event,paintFrame=0,factor=1
  const paint=()=>{paintFrame=0;const dx=(last.clientX-x)/scale*(corner.includes('e')?1:-1),dy=(last.clientY-y)/scale*(corner.includes('s')?1:-1),ratio=width/height,delta=Math.abs(dx)>Math.abs(dy*ratio)?dx:dy*ratio;factor=Math.max(min,Math.min(max,(width+delta)/width));live={width:width*factor,scale:originalScale*factor};layout(true)}
  const move=(e:PointerEvent)=>{last=e;if(Math.hypot(e.clientX-x,e.clientY-y)>3)moved=true;if(moved&&!paintFrame)paintFrame=requestAnimationFrame(paint)}
  const clean=()=>{cancelAnimationFrame(paintFrame);block.classList.remove('code-resizing');document.removeEventListener('pointermove',move);document.removeEventListener('pointerup',up);document.removeEventListener('pointercancel',cancel);document.removeEventListener('keydown',key,true);window.removeEventListener('blur',cancel);cleanup=undefined;live=undefined;signature='';schedule()}
  const cancel=()=>{clean();layout(true)},key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();cancel()}}
  const up=()=>{if(moved)paint();const next=live,valid=editor.state.doc.eq(doc);clean();if(moved&&valid&&next)size.set(Math.round(next.width),Math.round(next.scale*10000)/10000);layout(true);editor.view.focus()}
  cleanup=cancel;block.classList.add('code-resizing');document.addEventListener('pointermove',move);document.addEventListener('pointerup',up);document.addEventListener('pointercancel',cancel);document.addEventListener('keydown',key,true);window.addEventListener('blur',cancel)
 }
 function transaction({transaction}:{transaction:import('@tiptap/pm/state').Transaction}){if(transaction.docChanged)cleanup?.();schedule()}
 const observer=new ResizeObserver(schedule);observer.observe(block);editor.on('transaction',transaction);schedule()
 return{handles,configure(value:boolean){printing=value;layout()},flush(){layout(true)},destroy(){destroyed=true;cleanup?.();cancelAnimationFrame(frame);observer.disconnect();editor.off('transaction',transaction);unwatch();handles.remove();block.classList.remove('code-sized','code-printing');block.style.removeProperty('width');pre.style.removeProperty('width');pre.style.removeProperty('zoom');delete block.dataset.blockWidth}}
}
