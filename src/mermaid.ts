import DOMPurify from 'dompurify'
import type { Mermaid } from 'mermaid'

let runtime:Promise<Mermaid>|undefined,sequence=0
let queue:Promise<unknown>=Promise.resolve()
const pending=new Set<Promise<void>>()
const activeTags=['script','iframe','object','embed','image','img','a','audio','video','input','textarea','button','select','link','meta','base','form']

function load() {
  return runtime ||= import('mermaid').then(({default:mermaid})=>{
    // Use the full, locally bundled runtime. Its diagrams and layout engines
    // load on demand, so ordinary Markdown does not initialize Mermaid.
    mermaid.initialize({startOnLoad:false,securityLevel:'strict',theme:'base',look:'classic',layout:'dagre',
      fontFamily:'Segoe UI, Microsoft YaHei, sans-serif',htmlLabels:true,
      themeVariables:{primaryColor:'#e3f2fd',primaryTextColor:'#07599e',primaryBorderColor:'#cfdbe5',
        secondaryColor:'#f3f9ff',secondaryTextColor:'#07599e',secondaryBorderColor:'#cfdbe5',
        tertiaryColor:'#f5faff',tertiaryTextColor:'#07599e',lineColor:'#8c9197',textColor:'#07599e',
        edgeLabelBackground:'#f3f9ff',background:'#ffffff',fontSize:'16px',radius:14,useGradient:false},
      themeCSS:'.node rect{rx:14px;ry:14px}.node .label-container{stroke-width:1.2px;filter:none}.nodeLabel{font-weight:600}.edgeLabel .labelBkg:has(p:not(:empty)){background:#f3f9ff;border:1px solid #cbddec;border-radius:999px;padding:2px 8px}.edgeLabel p{border-radius:12px}.edgeLabel rect{rx:12px;ry:12px;opacity:1}.flowchart-link{stroke-width:1.2px;stroke-linecap:round;stroke-linejoin:round}.node path,.node polygon,.node rect{filter:none}',
      flowchart:{htmlLabels:true,wrappingWidth:320,curve:'linear'},suppressErrorRendering:true,maxTextSize:200000,maxEdges:2000,
      dompurifyConfig:{FORBID_TAGS:[...activeTags,'style']},
      secure:['secure','securityLevel','startOnLoad','maxTextSize','maxEdges','htmlLabels','themeCSS','fontFamily','dompurifyConfig']})
    return mermaid
  }).catch(error=>{runtime=undefined;throw error})
}

export function sanitizeMermaidSvg(svg:string):string {
  // Mermaid's HTML labels live inside SVG foreignObject. Keep that namespace
  // bridge and its formatting (including <br> and KaTeX), then remove active
  // content. A plain SVG profile would silently delete every HTML label.
  return DOMPurify.sanitize(svg,{
    USE_PROFILES:{html:true,svg:true,svgFilters:true,mathMl:true},
    ADD_TAGS:['foreignObject'],HTML_INTEGRATION_POINTS:{foreignobject:true,'annotation-xml':true},
    FORBID_TAGS:activeTags,
  })
}

export function renderMermaid(source:string):Promise<string> {
  const job=queue.then(async()=>{
    const mermaid=await load(),id=`yeran-mermaid-${++sequence}`
    const {svg}=await mermaid.render(id,source)
    return sanitizeMermaidSvg(svg)
  })
  queue=job.catch(()=>{})
  return job
}

export function trackDiagram(job:Promise<void>) {
  pending.add(job);void job.then(()=>pending.delete(job),()=>pending.delete(job))
}

export async function waitForMermaid() {
  document.querySelectorAll('.paper-editor .mermaid-block').forEach(el=>el.dispatchEvent(new Event('yeran:render-mermaid')))
  while(pending.size)await Promise.all([...pending])
}

export function resetMermaidViews(root:HTMLElement) {
  root.querySelectorAll('.mermaid-block').forEach(el=>el.dispatchEvent(new Event('yeran:reset-mermaid')))
}
