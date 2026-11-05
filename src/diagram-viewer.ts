import { t } from './i18n'

export function openDiagramViewer(original:SVGSVGElement,onClose:()=>void):()=>void {
  const dialog=document.createElement('dialog');dialog.className='mermaid-viewer';dialog.setAttribute('aria-label',t('Mermaid 图表预览'))
  const header=document.createElement('header'),title=document.createElement('strong'),output=document.createElement('output')
  title.textContent=t('Mermaid 图表预览');header.append(title)
  const canvas=document.createElement('div');canvas.className='mermaid-viewer-canvas'
  const chart=document.createElement('div');chart.className='mermaid-viewer-chart'
  const svg=original.cloneNode(true) as SVGSVGElement
  svg.style.removeProperty('top');svg.style.removeProperty('position')
  // Keep a self-contained copy of the sanitized SVG and HTML labels. This is
  // a view only; opening or zooming the chart never touches the document.
  chart.append(svg);canvas.append(chart)
  const box=svg.viewBox.baseVal,width=box.width||original.width.baseVal.value||800,height=box.height||original.height.baseVal.value||600
  let zoom=1,closed=false
  function scale(value:number){zoom=Math.max(.05,Math.min(4,value));chart.style.width=`${width*zoom}px`;chart.style.height=`${height*zoom}px`;output.textContent=`${Math.round(zoom*100)}%`}
  function fit(){scale(Math.min((canvas.clientWidth-48)/width,(canvas.clientHeight-48)/height,1));canvas.scrollTo({left:0,top:0})}
  function button(label:string,action:()=>void){const el=document.createElement('button');el.type='button';el.textContent=t(label);el.setAttribute('aria-label',t(label));el.addEventListener('click',action);header.append(el);return el}
  button('缩小图表',()=>scale(zoom/1.25));header.append(output);button('放大图表',()=>scale(zoom*1.25));button('适合窗口',fit);button('实际大小',()=>scale(1))
  const close=button('关闭图表预览',()=>dialog.close());close.textContent='×'
  dialog.append(header,canvas);document.body.append(dialog)
  const dispose=()=>{if(closed)return;closed=true;window.removeEventListener('resize',fit);dialog.remove();onClose()}
  dialog.addEventListener('close',dispose,{once:true});dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close()}})
  dialog.showModal();fit();window.addEventListener('resize',fit)
  return dispose
}
