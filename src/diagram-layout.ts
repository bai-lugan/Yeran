import {watch} from 'vue'
import type {Editor} from '@tiptap/core'
import {t,locale} from './i18n'

// Width belongs to the document, like image dimensions. Drag previews stay out
// of history; committing a resize creates one undoable document change.
export function createDiagramLayout(block:HTMLElement,preview:HTMLElement,editor:Editor,size:{get:()=>number|null;set:(width:number|null)=>void}){
  let svg:SVGSVGElement|undefined,version=0,frame=0,signature='',editing=false,printing=false,destroyed=false
  let actualWidth=0,autoWidth=0,maxWidth=0,minWidth=0,liveWidth:number|undefined,cleanup:(()=>void)|undefined,wheelTimer:ReturnType<typeof setTimeout>|undefined
  const controls=document.createElement('div');controls.className='mermaid-zoom-controls';controls.contentEditable='false'
  const handles=document.createElement('div');handles.className='diagram-resize-handles';handles.contentEditable='false'
  const output=document.createElement('output'),label=document.createElement('span')
  function button(text:string,visible:string,action:()=>void){const button=document.createElement('button');button.type='button';button.textContent=visible;button.dataset.label=text;button.addEventListener('pointerdown',e=>e.preventDefault());button.addEventListener('click',action);return button}
  const minus=button('缩小页面中的图表','−',()=>commit(actualWidth/1.25)),plus=button('放大页面中的图表','+',()=>commit(actualWidth*1.25)),reset=button('重置图表缩放','↺',()=>commit(null))
  controls.append(label,minus,output,plus,reset)
  for(const corner of ['nw','ne','sw','se']){const handle=document.createElement('button');handle.type='button';handle.className='diagram-resize-handle handle-'+corner;handle.dataset.corner=corner;handle.addEventListener('pointerdown',e=>start(e,corner));handles.append(handle)}
  block.append(controls,handles)
  function labels(){label.textContent=t('图表尺寸');controls.setAttribute('aria-label',t('图表缩放'));controls.title=t('拖动四角等比调整，尺寸随文稿保存并用于打印');controls.querySelectorAll<HTMLButtonElement>('button').forEach(button=>{button.setAttribute('aria-label',t(button.dataset.label!));button.title=t(button.dataset.label!)});handles.querySelectorAll<HTMLButtonElement>('button').forEach(button=>{button.setAttribute('aria-label',t('拖动调整图表尺寸')+' '+button.dataset.corner);button.title=t('拖动等比缩放图表')})}
  labels();const unwatch=watch(locale,labels)
  function clamp(width:number){return Math.max(minWidth,Math.min(maxWidth,width))}
  function commit(width:number|null){clearTimeout(wheelTimer);liveWidth=undefined;size.set(width===null?null:Math.round(clamp(width)));layout(true)}
  function layout(force=false){
    frame=0;if(destroyed||!svg||!block.isConnected||block.closest('details:not([open])')||!block.getClientRects().length)return
    const options=editor.storage.mixedPagination,margin=options.margin*96/25.4,continuous=options.continuous,directions=[options.base,...Object.values(options.directions)]
    const pageHeight=directions.includes('landscape')?794:1123,pageWidth=directions.includes('portrait')?794:1123,body=pageHeight-margin*2-24
    const parent=block.parentElement!,style=getComputedStyle(parent),parentWidth=parent.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight)
    let nesting=0,ancestor=block.parentElement;while(ancestor&&ancestor!==editor.view.dom){if(ancestor.classList.contains('toggle-content'))nesting++;ancestor=ancestor.parentElement}
    const available=Math.max(40,Math.min(parentWidth,continuous?Infinity:pageWidth-margin*2-nesting*40)-48)
    const box=svg.viewBox.baseVal,naturalWidth=box.width||800,naturalHeight=box.height||600,ratio=naturalWidth/naturalHeight
    maxWidth=Math.max(40,Math.min(available,continuous?Infinity:Math.max(60,body-240-(editing?194:0))*ratio));minWidth=Math.min(120,maxWidth)
    autoWidth=Math.max(minWidth,Math.min(naturalWidth,maxWidth));actualWidth=clamp(liveWidth??size.get()??autoWidth)
    const height=actualWidth/ratio,key=JSON.stringify([version,actualWidth,height,editing,printing])
    if(force||key!==signature){
      signature=key;svg.style.cssText=`display:block;width:${actualWidth}px;height:${height}px;max-width:none;max-height:none;margin:0 auto;position:static`
      block.style.width=`${actualWidth+48}px`;block.dataset.blockWidth=String(actualWidth+48);preview.style.height='auto';preview.classList.add('mermaid-managed')
      output.textContent=`${Math.round(actualWidth/autoWidth*100)}%`;minus.disabled=actualWidth<=minWidth+.5;plus.disabled=actualWidth>=maxWidth-.5;reset.disabled=size.get()===null&&liveWidth===undefined
    }
    block.dataset.diagramReady='true'
  }
  function schedule(){if(destroyed||!svg||frame)return;frame=requestAnimationFrame(()=>layout())}
  function start(event:PointerEvent,corner:string){
    if(event.button!==0||!svg)return
    event.preventDefault();event.stopPropagation();cleanup?.();clearTimeout(wheelTimer)
    const root=editor.view.dom,scale=root.getBoundingClientRect().width/root.offsetWidth||1,doc=editor.state.doc,startWidth=actualWidth,ratio=svg.viewBox.baseVal.width/svg.viewBox.baseVal.height,startX=event.clientX,startY=event.clientY
    let moved=false,last=event,paintFrame=0
    const paint=()=>{paintFrame=0;const dx=(last.clientX-startX)/scale*(corner.includes('e')?1:-1),dy=(last.clientY-startY)/scale*(corner.includes('s')?1:-1);liveWidth=clamp(startWidth+(Math.abs(dx)>Math.abs(dy*ratio)?dx:dy*ratio));layout(true)}
    const move=(e:PointerEvent)=>{last=e;if(Math.hypot(e.clientX-startX,e.clientY-startY)>3)moved=true;if(moved&&!paintFrame)paintFrame=requestAnimationFrame(paint)}
    const clean=()=>{cancelAnimationFrame(paintFrame);block.classList.remove('diagram-resizing');document.removeEventListener('pointermove',move);document.removeEventListener('pointerup',up);document.removeEventListener('pointercancel',cancel);document.removeEventListener('keydown',key,true);window.removeEventListener('blur',cancel);cleanup=undefined}
    const cancel=()=>{clean();liveWidth=undefined;signature='';schedule()},key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();cancel()}}
    const up=()=>{if(moved)paint();const width=liveWidth,valid=editor.state.doc.eq(doc);clean();liveWidth=undefined;if(moved&&valid&&width!==undefined)commit(width);else{signature='';schedule()}}
    block.classList.add('diagram-resizing');cleanup=cancel;document.addEventListener('pointermove',move);document.addEventListener('pointerup',up);document.addEventListener('pointercancel',cancel);document.addEventListener('keydown',key,true);window.addEventListener('blur',cancel)
  }
  function wheel(event:WheelEvent){
    if(!event.ctrlKey&&!event.metaKey)return
    event.preventDefault();event.stopPropagation();clearTimeout(wheelTimer);liveWidth=clamp(actualWidth*(event.deltaY<0?1.1:1/1.1));layout(true)
    const doc=editor.state.doc;wheelTimer=setTimeout(()=>{const width=liveWidth;liveWidth=undefined;if(width!==undefined&&editor.state.doc.eq(doc))commit(width);else{signature='';schedule()}},200)
  }
  preview.addEventListener('wheel',wheel,{passive:false})
  function transaction({transaction}:{transaction:import('@tiptap/pm/state').Transaction}){if(transaction.docChanged)cleanup?.();schedule()}
  const observer=new ResizeObserver(schedule);observer.observe(block.parentElement!);observer.observe(editor.view.dom);editor.on('transaction',transaction)
  return{
    controls,handles,getSvg:()=>svg,
    setGraphic(graph:SVGSVGElement){svg=graph;svg.dataset.yeranDiagramSvg='true';version++;signature='';delete block.dataset.diagramReady;schedule()},
    configure(value:{editing:boolean;printing:boolean}){const changed=editing!==value.editing||printing!==value.printing;editing=value.editing;printing=value.printing;block.classList.toggle('mermaid-printing',printing);if(changed)layout(true);else schedule()},
    reset(){signature='';schedule()},
    flush(){cancelAnimationFrame(frame);layout(true)},
    destroy(){destroyed=true;cleanup?.();clearTimeout(wheelTimer);cancelAnimationFrame(frame);observer.disconnect();editor.off('transaction',transaction);unwatch();preview.removeEventListener('wheel',wheel);controls.remove();handles.remove();block.classList.remove('mermaid-printing');block.style.removeProperty('width');preview.classList.remove('mermaid-managed');preview.style.removeProperty('height');delete block.dataset.diagramReady;delete block.dataset.blockWidth},
  }
}
