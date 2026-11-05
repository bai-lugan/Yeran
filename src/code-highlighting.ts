import { Extension } from '@tiptap/core'
import { Plugin,PluginKey } from '@tiptap/pm/state'
import { Decoration,DecorationSet } from '@tiptap/pm/view'
const loaders:Record<string,()=>Promise<any>>={javascript:()=>import('highlight.js/lib/languages/javascript'),typescript:()=>import('highlight.js/lib/languages/typescript'),python:()=>import('highlight.js/lib/languages/python'),json:()=>import('highlight.js/lib/languages/json'),sql:()=>import('highlight.js/lib/languages/sql'),bash:()=>import('highlight.js/lib/languages/bash'),xml:()=>import('highlight.js/lib/languages/xml'),css:()=>import('highlight.js/lib/languages/css'),markdown:()=>import('highlight.js/lib/languages/markdown')}
Object.assign(loaders,{c:()=>import('highlight.js/lib/languages/c'),cpp:()=>import('highlight.js/lib/languages/cpp'),csharp:()=>import('highlight.js/lib/languages/csharp'),java:()=>import('highlight.js/lib/languages/java'),go:()=>import('highlight.js/lib/languages/go'),rust:()=>import('highlight.js/lib/languages/rust'),php:()=>import('highlight.js/lib/languages/php'),ruby:()=>import('highlight.js/lib/languages/ruby'),yaml:()=>import('highlight.js/lib/languages/yaml'),powershell:()=>import('highlight.js/lib/languages/powershell'),swift:()=>import('highlight.js/lib/languages/swift'),kotlin:()=>import('highlight.js/lib/languages/kotlin')})
loaders.dos=()=>import('highlight.js/lib/languages/dos')
const aliases:Record<string,string>={js:'javascript',ts:'typescript',py:'python',py3:'python',python3:'python',ps:'powershell',ps1:'powershell',pwsh:'powershell',bat:'dos',batch:'dos',cmd:'dos',sh:'bash',shell:'bash',shellscript:'bash',zsh:'bash',ksh:'bash',html:'xml',md:'markdown'}
export const CODE_LANGUAGES:[string,string][]=[['','纯文本'],['mermaid','Mermaid'],['python','Python'],['bat','BAT / CMD'],['powershell','PowerShell'],['bash','Shell (Bash / sh)'],['zsh','Shell (Zsh)'],['javascript','JavaScript'],['typescript','TypeScript'],['json','JSON'],['sql','SQL'],['html','HTML'],['css','CSS'],['markdown','Markdown'],['c','C'],['cpp','C++'],['csharp','C#'],['java','Java'],['go','Go'],['rust','Rust'],['php','PHP'],['ruby','Ruby'],['yaml','YAML'],['swift','Swift'],['kotlin','Kotlin']]
let runtime:typeof import('highlight.js/lib/core')['default']|undefined
const loading=new Map<string,Promise<void>>()
function load(language:string){if(!loading.has(language))loading.set(language,Promise.all([import('highlight.js/lib/core'),loaders[language]!()]).then(([core,module])=>{runtime=core.default;runtime.registerLanguage(language,module.default)}));return loading.get(language)!}
export async function waitForCodeHighlighting(){await Promise.allSettled([...loading.values()]);await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())))}
export const CodeHighlighting=Extension.create({
  name:'codeHighlighting',addProseMirrorPlugins(){const editor=this.editor,key=new PluginKey('yeranSyntaxColors'),requested=new Set<string>(),cache=new Map<string,{from:number;to:number;classes:string}[]>()
    function build(doc:import('@tiptap/pm/model').Node){const decorations:Decoration[]=[]
      doc.descendants((node,pos)=>{if(node.type.name!=='codeBlock')return;const raw=String(node.attrs.language||'').toLowerCase(),language=aliases[raw]||raw;if(!loaders[language]||node.textContent.length>200000)return false
        if(!runtime?.getLanguage(language)){if(!requested.has(language)){requested.add(language);void load(language).then(()=>{if(!editor.isDestroyed)requestAnimationFrame(()=>{if(!editor.isDestroyed)editor.view.dispatch(editor.state.tr.setMeta(key,true).setMeta('addToHistory',false))})}).catch(()=>{})}return false}
        const signature=language+'\n'+node.textContent;let spans=cache.get(signature)
        if(!spans){spans=[];const container=document.createElement('div');container.innerHTML=runtime.highlight(node.textContent,{language,ignoreIllegals:true}).value;let offset=0
          function walk(element:globalThis.Node,classes:string[]){if(element.nodeType===3){const size=element.textContent?.length||0;if(classes.length&&size)spans!.push({from:offset,to:offset+size,classes:classes.join(' ')});offset+=size}else for(const child of element.childNodes)walk(child,child instanceof HTMLElement?[...classes,...child.classList]:classes)}walk(container,[]);cache.set(signature,spans);if(cache.size>40)cache.delete(cache.keys().next().value!)}
        for(const span of spans)decorations.push(Decoration.inline(pos+1+span.from,pos+1+span.to,{class:span.classes}));return false
      });return DecorationSet.create(doc,decorations)
    }
    return[new Plugin({key,state:{init:(_,state)=>build(state.doc),apply:(tr,previous)=>tr.docChanged||tr.getMeta(key)?build(tr.doc):previous},props:{decorations(state){return this.getState(state)}}})]
  },
})
