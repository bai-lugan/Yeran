import { Extension, Node, mergeAttributes, InputRule, textblockTypeInputRule } from '@tiptap/core'
import { CodeBlock } from '@tiptap/extension-code-block'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { t, locale } from './i18n'
import { watch } from 'vue'
import { CODE_LANGUAGES } from './code-highlighting'
import { renderMermaid, trackDiagram } from './mermaid'
import { NodeSelection, TextSelection } from '@tiptap/pm/state'
import { Fragment } from '@tiptap/pm/model'
import { closeHistory } from '@tiptap/pm/history'
import { openDiagramViewer } from './diagram-viewer'
import { createDiagramLayout } from './diagram-layout'
import {createCodeLayout} from './code-layout'
import {blockAlignAttribute,blockAlignment,blockAlignStyle} from './block-geometry'

let mathRuntime: Promise<typeof import('katex')> | undefined
const pendingMath = new Set<Promise<void>>()
export async function waitForMath() { document.querySelectorAll('.paper-editor .math-block,.paper-editor .inline-math').forEach(dom => dom.dispatchEvent(new Event('yeran:render-math'))); await Promise.all([...pendingMath]); await document.fonts.ready }
export const InlineMath = Node.create({
  name:'inlineMath',group:'inline',inline:true,atom:true,
  addAttributes:()=>({latex:{default:'x^2'}}),
  parseHTML:()=>[{tag:'span[data-inline-math]',getAttrs:el=>({latex:(el as HTMLElement).dataset.inlineMath})}],
  renderHTML:({node})=>['span',{'data-inline-math':node.attrs.latex,class:'inline-math'},node.attrs.latex],
  markdownTokenName:'inlineMath',
  markdownTokenizer:{name:'inlineMath',level:'inline',start:(src:string)=>src.search(/\$(?!\$)/),tokenize(src:string){const m=/^\$(?!\$)((?:\\.|[^$\n])+?)\$/.exec(src);return m&&!/^\s|\s$/.test(m[1]!)?{type:'inlineMath',raw:m[0],latex:m[1]}:undefined}},
  parseMarkdown:token=>({type:'inlineMath',attrs:{latex:token.latex}}),renderMarkdown:node=>`$${node.attrs?.latex}$`,
  addInputRules(){return[new InputRule({find:/(?<![$\\])\$(?!\$)((?:\\.|[^$\n])+?)\$$/,handler:({state,range,match})=>{state.tr.replaceWith(range.from,range.to,this.type.create({latex:match[1]}))}})]},
  addNodeView(){return({node,editor,getPos})=>{
    let current=node,token=0,editing=false
    const dom=document.createElement('span');dom.className='inline-math';dom.contentEditable='false'
    const rendered=document.createElement('span');rendered.className='math-rendered';rendered.tabIndex=0
    const input=document.createElement('input');input.className='math-input inline-math-input';input.hidden=true;input.setAttribute('aria-label',t('行内 LaTeX 公式'))
    async function render(){const version=++token;dom.dataset.inlineMath=current.attrs.latex
      const job=(async()=>{const katex=await(mathRuntime ||= Promise.all([import('katex'),import('katex/dist/katex.min.css')]).then(([runtime])=>runtime));if(version!==token||!dom.isConnected)return;katex.render(current.attrs.latex,rendered,{displayMode:false,throwOnError:false,trust:false,maxExpand:1000})})()
      pendingMath.add(job);try{await job}finally{pendingMath.delete(job)}
    }
    function edit(){editing=!editing;input.hidden=!editing;if(editing){input.value=current.attrs.latex;input.focus();input.select()}else{void render();editor.view.focus()}}
    rendered.addEventListener('click',edit);rendered.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();edit()}})
    input.addEventListener('input',()=>{const pos=getPos();if(typeof pos==='number')editor.view.dispatch(editor.state.tr.setNodeMarkup(pos,undefined,{latex:input.value}))})
    input.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key==='Escape'){e.preventDefault();e.stopPropagation();edit()}})
    input.addEventListener('blur',()=>{if(editing)edit()});dom.addEventListener('yeran:render-math',()=>void render());dom.append(rendered,input);requestAnimationFrame(()=>void render())
    return{dom,ignoreMutation:()=>true,stopEvent:()=>true,update(next){if(next.type!==current.type)return false;current=next;if(!editing)void render();return true},destroy(){token++}}
  }},
})
export const MathBlock = Node.create({
  name: 'mathBlock', group: 'block', atom: true, selectable: true,
  addAttributes: () => ({ latex: { default: 'E=mc^2', parseHTML: element => element.getAttribute('data-latex') || '', renderHTML: attributes => ({ 'data-latex': attributes.latex }) } }),
  parseHTML: () => [{ tag: 'div[data-math-block]' }],
  renderHTML: ({ HTMLAttributes }) => ['div', mergeAttributes(HTMLAttributes, { 'data-math-block': '', class: 'math-block' })],
  markdownTokenName: 'mathBlock',
  markdownTokenizer: { name: 'mathBlock', level: 'block', start: (src: string) => src.indexOf('$$'), tokenize(src: string) { const match = /^\$\$[ \t]*(?:\r?\n)?([\s\S]*?)\$\$[ \t]*(?:\r?\n|$)/.exec(src); return match ? { type: 'mathBlock', raw: match[0], latex: match[1]!.trim() } : undefined } },
  parseMarkdown: token => ({ type: 'mathBlock', attrs: { latex: token.latex } }),
  renderMarkdown: node => `$$\n${node.attrs?.latex || ''}\n$$`,
  addNodeView() {
    return ({ node, editor, getPos }) => {
      let current = node, editing = false, token = 0
      const dom = document.createElement('div'); dom.className = 'math-block'; dom.dataset.mathBlock = ''; dom.contentEditable = 'false'
      const rendered = document.createElement('div'); rendered.className = 'math-rendered'; rendered.tabIndex = 0
      const controls = document.createElement('div'); controls.className = 'block-controls'
      const edit = document.createElement('button'); edit.type = 'button'
      const input = document.createElement('textarea'); input.className = 'math-input'; input.spellcheck = false; input.hidden = true; input.rows = 3
      function labels() { edit.textContent = t(editing ? '完成' : '编辑公式'); input.placeholder = t('输入 LaTeX 公式'); input.setAttribute('aria-label', t('LaTeX 公式')); rendered.setAttribute('aria-label', t('公式块')) }
      async function render() {
        const version = ++token; dom.dataset.latex = current.attrs.latex
        const job = (async () => {
          const katex = await (mathRuntime ||= Promise.all([import('katex'), import('katex/dist/katex.min.css')]).then(([runtime]) => runtime))
          if (version !== token || !dom.isConnected) return
          katex.render(String(current.attrs.latex), rendered, { displayMode: true, throwOnError: false, trust: false, strict: 'warn', maxExpand: 1000 })
        })()
        pendingMath.add(job); try { await job } finally { pendingMath.delete(job) }
      }
      function toggle() { editing = !editing; input.hidden = !editing; edit.textContent = t(editing ? '完成' : '编辑公式'); if (editing) { input.value = current.attrs.latex; input.focus() } else { void render(); editor.view.focus() } }
      rendered.addEventListener('click', () => { if (!editing) toggle() }); rendered.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); toggle() } })
      edit.addEventListener('click', toggle)
      input.addEventListener('input', () => { const pos = getPos(); if (typeof pos === 'number') editor.view.dispatch(editor.state.tr.setNodeMarkup(pos, undefined, { latex: input.value })) })
      input.addEventListener('keydown', event => { if (event.key === 'Escape' || event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); event.stopPropagation(); toggle() } })
      controls.append(edit); dom.append(controls, rendered, input); labels(); const unwatch = watch(locale, labels)
      dom.addEventListener('yeran:render-math', () => void render())
      requestAnimationFrame(() => void render())
      return { dom, stopEvent: event => controls.contains(event.target as globalThis.Node) || input === event.target || rendered.contains(event.target as globalThis.Node), ignoreMutation: () => true, update(next) { if (next.type !== current.type) return false; current = next; dom.dataset.latex = current.attrs.latex; if (!editing) void render(); return true }, destroy() { token++; unwatch() } }
    }
  },
})

export const YeranCodeBlock = CodeBlock.extend({
  addAttributes(){return{...this.parent?.(),blockAlign:blockAlignAttribute,codeWidth:{default:null,parseHTML:el=>{const n=Number(el.getAttribute('data-code-width'));return n>=24&&n<=10000?n:null},renderHTML:a=>a.codeWidth?{'data-code-width':a.codeWidth}:{}},codeScale:{default:1,parseHTML:el=>{const n=Number(el.getAttribute('data-code-scale'));return n>=.01&&n<=4?n:1},renderHTML:a=>a.codeScale!==1?{'data-code-scale':a.codeScale}:{}},diagramWidth:{default:null,parseHTML:el=>{const width=Number(el.getAttribute('data-diagram-width'));return width>0&&width<=10000?width:null},renderHTML:attrs=>attrs.diagramWidth?{'data-diagram-width':attrs.diagramWidth}:{}}}},
  parseMarkdown(token,helpers){
    const fence=/^ {0,3}(`{3,}|~{3,})/.exec(token.raw||'')
    if(token.raw&&!fence&&token.codeBlockStyle!=='indented')return[]
    let text=String(token.text||''),width:number|null=null,align='left'
    if(String(token.lang||'').toLowerCase()==='mermaid'){for(let i=0;i<2;i++){const m=/^%% yeran:(width=(\d+(?:\.\d+)?)|align=(center|left|right))\r?\n/.exec(text);if(!m)break;if(m[2]){if(Number(m[2])<=0||Number(m[2])>10000)break;width=Number(m[2])}else align=m[3]!;text=text.slice(m[0].length)}}
    return helpers.createNode('codeBlock',{language:token.lang||null,fenceMarker:fence?.[1]||'```',diagramWidth:width,blockAlign:align},text?[helpers.createTextNode(text)]:[])
  },
  renderMarkdown(node,helpers){
    const language=node.attrs?.language||'',width=Number(node.attrs?.diagramWidth),text=helpers.renderChildren(node.content||[])
    const mermaid=String(language).toLowerCase()==='mermaid',align=blockAlignment(node.attrs?.blockAlign),aligned=align!=='left',escape=(v:unknown)=>String(v??'').replace(/[&"<>]/g,c=>({'&':'&amp;','"':'&quot;','<':'&lt;','>':'&gt;'}[c]!))
    if(!mermaid&&(node.attrs?.codeWidth||aligned))return`<pre${node.attrs?.codeWidth?` data-code-width="${Number(node.attrs.codeWidth)}" data-code-scale="${Number(node.attrs.codeScale)||1}"`:''}${aligned?` data-block-align="${align}" style="${blockAlignStyle(align)}"`:''}><code${language?` class="language-${escape(language)}"`:''}>${escape(text)}</code></pre>`
    const size=mermaid?`${width>0&&width<=10000?`%% yeran:width=${width}\n`:''}${aligned?`%% yeran:align=${align}\n`:''}`:''
    let length=3;for(const match of text.matchAll(/`+/g))length=Math.max(length,match[0].length+1)
    const fence='`'.repeat(length)
    return`${fence}${language}\n${size}${text}\n${fence}`
  },
  addInputRules(){return[textblockTypeInputRule({find:/^ {0,3}(`{3,}|~{3,})([A-Za-z0-9_+#.-]*)[ \t\n]$/,type:this.type,getAttributes:match=>({language:match[2]||null,fenceMarker:match[1]})})]},
  addKeyboardShortcuts() { return { ...this.parent?.(), 'Mod-a':()=>{const {$from,$to}=this.editor.state.selection;if($from.parent.type!==this.type||!$from.sameParent($to))return false;return this.editor.commands.setTextSelection({from:$from.start(),to:$from.end()})},Tab: () => this.editor.isActive('codeBlock') && this.editor.commands.insertContent('  ') } },
  addNodeView() {
    return ({ node, editor, getPos }) => {
      let current = node,editing=String(node.attrs.language||'').toLowerCase()==='mermaid'&&(!node.textContent||editor.isFocused&&editor.state.selection.$from.parent===node),printing=false,token=0,timer:ReturnType<typeof setTimeout>|undefined,lastSource:string|undefined,scheduledSource:string|undefined
      const dom = document.createElement('div'); dom.className = 'code-block'
      const controls = document.createElement('div'); controls.className = 'block-controls code-controls'; controls.contentEditable = 'false'
      const language = document.createElement('select')
      for (const [value,label] of CODE_LANGUAGES) { const option = document.createElement('option'); option.value = value; option.textContent = t(label); language.append(option) }
      const copy = document.createElement('button'); copy.type = 'button'
      const edit = document.createElement('button'); edit.type='button'
      const expand=document.createElement('button');expand.type='button';let closeViewer:(()=>void)|undefined
      let diagramView:ReturnType<typeof createDiagramLayout>|undefined
      let codeView:ReturnType<typeof createCodeLayout>|undefined
      const preview=document.createElement('div');preview.className='mermaid-preview';preview.contentEditable='false';preview.tabIndex=0
      function labels() { language.setAttribute('aria-label', t('代码语言')); language.options[0]!.textContent=t('纯文本'); copy.textContent = t('复制代码'); copy.setAttribute('aria-label', t('复制代码'));edit.textContent=t(editing?'查看图表':'编辑图表');expand.textContent=t('放大图表');expand.setAttribute('aria-label',t('放大图表'));preview.setAttribute('aria-label',t('Mermaid 图表'));preview.title=t('点击编辑图表') }
      labels(); const unwatch = watch(locale, labels)
      function syncLanguage(value:string){if(value&&![...language.options].some(option=>option.value===value)){const extra=document.createElement('option');extra.value=value;extra.textContent=value;language.append(extra)}language.value=value}
      syncLanguage(node.attrs.language || ''); language.addEventListener('change', () => { const pos = getPos(); if (typeof pos === 'number') {const tr=editor.state.tr.setNodeMarkup(pos,undefined,{...current.attrs,language:language.value});if(language.value==='mermaid'&&!editing)tr.setSelection(NodeSelection.create(tr.doc,pos));editor.view.dispatch(tr)} })
      copy.addEventListener('click', async () => { try { await navigator.clipboard.writeText(current.textContent); copy.textContent = t('已复制') } catch { copy.textContent = t('复制失败，请手动选择') } })
      const pre = document.createElement('pre'), code = document.createElement('code');pre.append(code);controls.append(language,edit,expand,copy);dom.append(controls,pre,preview)
      // Commit the native code selection before a following keyboard shortcut.
      // Chromium may deliver selectionchange after a fast click + Ctrl+A.
      code.addEventListener('click',()=>{
        const selection=window.getSelection();if(!selection?.anchorNode||!selection.focusNode||!code.contains(selection.anchorNode)||!code.contains(selection.focusNode))return
        const view=editor.view,from=view.posAtDOM(selection.anchorNode,selection.anchorOffset),to=view.posAtDOM(selection.focusNode,selection.focusOffset),next=TextSelection.create(view.state.doc,from,to)
        if(!next.eq(view.state.selection))view.dispatch(view.state.tr.setSelection(next))
      })
      const isDiagram=()=>String(current.attrs.language||'').toLowerCase()==='mermaid'
      function render() {
        clearTimeout(timer);if(!isDiagram()||!dom.isConnected)return
        const source=current.textContent;if(source===lastSource)return;lastSource=source
        const version=++token;preview.setAttribute('aria-busy','true')
        trackDiagram((async()=>{
          try{
            if(!source.trim()){diagramView?.destroy();diagramView=undefined;preview.textContent=t('输入 Mermaid 代码以生成图表');preview.classList.remove('mermaid-error');return}
            const svg=await renderMermaid(source)
            if(version!==token||!dom.isConnected)return
            preview.innerHTML=svg;preview.classList.remove('mermaid-error');diagramView ||= createDiagramLayout(dom,preview,editor,{get:()=>current.attrs.diagramWidth,set:width=>{const pos=getPos();if(typeof pos==='number'&&current.attrs.diagramWidth!==width)editor.view.dispatch(closeHistory(editor.state.tr).setNodeMarkup(pos,undefined,{...current.attrs,diagramWidth:width}))}});diagramView.setGraphic(preview.querySelector('svg')!);diagramView.configure({editing:editing&&!printing,printing})
          }catch{
            if(version!==token||!dom.isConnected)return
            diagramView?.destroy();diagramView=undefined;preview.textContent=t('图表语法有误，请检查 Mermaid 代码。');preview.classList.add('mermaid-error')
          }finally{if(version===token)preview.removeAttribute('aria-busy')}
        })())
      }
      function sync(){
        const diagram=isDiagram();dom.dataset.blockAlign=blockAlignment(current.attrs.blockAlign)
        dom.classList.toggle('mermaid-block',diagram);dom.classList.toggle('mermaid-editing',diagram&&editing&&!printing);pre.hidden=diagram&&(!editing||printing);preview.hidden=!diagram;edit.hidden=expand.hidden=!diagram;labels()
        if(diagram){
          codeView?.destroy();codeView=undefined;diagramView?.configure({editing:editing&&!printing,printing})
          const source=current.textContent;if(source!==lastSource&&source!==scheduledSource){scheduledSource=source;clearTimeout(timer);timer=setTimeout(render,180)}
        }else{
          token++;clearTimeout(timer);scheduledSource=lastSource=undefined;diagramView?.destroy();diagramView=undefined;preview.replaceChildren();preview.removeAttribute('aria-busy')
          codeView ||= createCodeLayout(dom,pre,editor,{get:()=>({width:current.attrs.codeWidth,scale:current.attrs.codeScale}),set:(width,scale)=>{const pos=getPos();if(typeof pos==='number')editor.view.dispatch(closeHistory(editor.state.tr).setNodeMarkup(pos,undefined,{...current.attrs,codeWidth:width,codeScale:scale}))}});codeView.configure(printing)
        }
      }
      function toggle(){editing=!editing;sync();const pos=getPos();if(typeof pos!=='number')return;if(editing)editor.chain().focus().setTextSelection(pos+1).run();else{editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc,pos)));editor.view.focus();render()}}
      edit.addEventListener('click',toggle);preview.addEventListener('click',()=>{if(!editing)toggle()});preview.addEventListener('keydown',event=>{if(event.key==='Enter'&&!editing){event.preventDefault();toggle()}})
      expand.addEventListener('click',()=>{const svg=diagramView?.getSvg()||preview.querySelector('svg');if(svg){closeViewer?.();closeViewer=openDiagramViewer(svg,()=>{closeViewer=undefined;expand.focus()})}})
      dom.addEventListener('yeran:render-mermaid',()=>{render();diagramView?.flush()})
      dom.addEventListener('yeran:print-code',()=>{printing=true;sync()});dom.addEventListener('yeran:restore-code',()=>{printing=false;sync()})
      dom.addEventListener('yeran:print-mermaid',()=>{printing=true;sync()})
      dom.addEventListener('yeran:restore-mermaid',()=>{printing=false;sync()})
      dom.addEventListener('yeran:reset-mermaid',()=>{editing=!current.textContent;diagramView?.reset();sync()})
      sync();requestAnimationFrame(render)
      return { dom, contentDOM: code, stopEvent: event => controls.contains(event.target as globalThis.Node)||preview.contains(event.target as globalThis.Node)||!!diagramView?.controls.contains(event.target as globalThis.Node)||!!diagramView?.handles.contains(event.target as globalThis.Node)||!!codeView?.handles.contains(event.target as globalThis.Node), ignoreMutation: mutation => mutation.type!=='selection'&&(controls.contains(mutation.target)||preview.contains(mutation.target)||!!diagramView?.controls.contains(mutation.target)||!!diagramView?.handles.contains(mutation.target)||!!codeView?.handles.contains(mutation.target)||mutation.type==='attributes'&&(mutation.target===dom||mutation.target===pre)||mutation.type==='childList'&&mutation.target===dom&&[...mutation.addedNodes,...mutation.removedNodes].every(el=>el instanceof HTMLElement&&el.matches('.mermaid-zoom-controls,.diagram-resize-handles,.code-resize-handles'))), update(next) { if (next.type !== current.type) return false;current=next;syncLanguage(next.attrs.language||'');sync();return true }, destroy(){token++;clearTimeout(timer);diagramView?.destroy();codeView?.destroy();closeViewer?.();unwatch()} }
    }
  },
})

export const ToggleSummary = Node.create({
  name: 'toggleSummary', content: 'inline*', defining: true, parseHTML: () => [{ tag: 'summary' }], renderHTML: () => ['summary',0],
  addKeyboardShortcuts(){return{
    Enter:()=>{
      const editor=this.editor,{$from,empty}=editor.state.selection
      if(!empty||$from.parent.type.name!==this.name)return false
      const depth=$from.depth-1,pos=$from.before(depth),toggle=$from.node(depth),start=pos+1+toggle.firstChild!.nodeSize+1,body=toggle.child(1),first=body.firstChild
      const tr=closeHistory(editor.state.tr)
      if(first?.type.name!=='paragraph'||first.content.size)tr.insert(start,editor.schema.nodes.paragraph!.create())
      tr.setSelection(TextSelection.create(tr.doc,start+1));const dom=editor.view.nodeDOM(pos) as HTMLDetailsElement;dom.open=true;editor.view.dispatch(tr);editor.view.focus();return true
    },
    Backspace:()=>{
      const editor=this.editor,{$from,empty}=editor.state.selection
      if(!empty||$from.parent.type.name!==this.name||$from.parentOffset!==0)return false
      const depth=$from.depth-1,pos=$from.before(depth),toggle=$from.node(depth),content=[]
      if($from.parent.content.size)content.push(editor.schema.nodes.paragraph!.create(null,$from.parent.content))
      toggle.child(1).forEach(child=>{if(!content.length||child.type.name!=='paragraph'||child.content.size)content.push(child)})
      const tr=closeHistory(editor.state.tr).replaceWith(pos,pos+toggle.nodeSize,Fragment.fromArray(content));tr.setSelection(TextSelection.near(tr.doc.resolve(pos+1)));editor.view.dispatch(tr);return true
    },
  }},
  addNodeView(){return({node,editor,getPos})=>{
    let current=node
    const dom=document.createElement('summary'),content=document.createElement('span'),button=document.createElement('button')
    button.type='button';button.className='toggle-arrow';button.contentEditable='false';button.textContent='▸';button.setAttribute('aria-expanded','true')
    const labels=()=>button.setAttribute('aria-label',t('展开或折叠'));labels();const unwatch=watch(locale,labels)
    button.addEventListener('pointerdown',event=>event.preventDefault())
    dom.addEventListener('click',event=>{
      event.preventDefault();if(!button.contains(event.target as globalThis.Node))return
      const details=dom.closest('details');if(!details)return
      details.open=!details.open;button.setAttribute('aria-expanded',String(details.open))
      const pos=getPos();if(!details.open&&typeof pos==='number'){
        const $pos=editor.state.doc.resolve(pos),end=$pos.end(),selection=editor.state.selection
        if(selection.from>=pos+current.nodeSize&&selection.from<end)editor.chain().setTextSelection(pos+1+current.content.size).focus().run()
      }
    })
    dom.append(button,content)
    return{dom,contentDOM:content,stopEvent:event=>button.contains(event.target as globalThis.Node),ignoreMutation:mutation=>mutation.type!=='selection'&&!content.contains(mutation.target),update(next){if(next.type!==current.type)return false;current=next;return true},destroy:unwatch}
  }},
})
export const ToggleContent = Node.create({ name: 'toggleContent', content: 'block+', defining: true, parseHTML: () => [{ tag: 'div[data-toggle-content]' }], renderHTML: () => ['div',{'data-toggle-content':'',class:'toggle-content'},0] })
export const ToggleBlock = Node.create({
  name: 'toggleBlock', group: 'block', content: 'toggleSummary toggleContent', defining: true, isolating:true,
  parseHTML: () => [{ tag: 'details' }], renderHTML: () => ['details',{class:'toggle-block',open:''},0],
  addNodeView() { return () => { const dom = document.createElement('details'); dom.className = 'toggle-block'; dom.open = true;dom.addEventListener('toggle',()=>dom.querySelector(':scope>summary>.toggle-arrow')?.setAttribute('aria-expanded',String(dom.open))); return { dom, contentDOM: dom, ignoreMutation: mutation => mutation.type === 'attributes' && mutation.target === dom } } },
  markdownTokenName: 'toggleBlock',
  markdownTokenizer: { name: 'toggleBlock', level: 'block', start: (src: string) => src.indexOf('<details'), tokenize(src: string, _tokens, helpers) {
    if (!src.startsWith('<details')) return
    const tags = /<\/?details\b[^>]*>/g; let depth = 0, end = -1
    for (const tag of src.matchAll(tags)) { depth += tag[0].startsWith('</') ? -1 : 1; if (depth === 0) { end = tag.index! + tag[0].length; break } }
    if (end < 0) return
    const raw = src.slice(0,end), summary = /<summary[^>]*>([\s\S]*?)<\/summary>/.exec(raw)
    if (!summary) return
    const body = raw.slice(raw.indexOf(summary[0]) + summary[0].length, raw.lastIndexOf('</details>')).trim()
    return { type: 'toggleBlock', raw, summaryTokens: helpers.inlineTokens(summary[1] || ''), bodyTokens: helpers.blockTokens(body) }
  } },
  parseMarkdown: (token, helpers) => ({ type: 'toggleBlock', content: [{ type: 'toggleSummary', content: helpers.parseInline(token.summaryTokens || []) }, { type: 'toggleContent', content: helpers.parseChildren(token.bodyTokens || []).length ? helpers.parseChildren(token.bodyTokens) : [{type:'paragraph'}] }] }),
  renderMarkdown: (node, helpers) => `<details>\n<summary>${helpers.renderChildren(node.content?.[0]?.content || []).replace(/\n/g,' ')}</summary>\n\n${helpers.renderChildren(node.content?.[1]?.content || [],'\n\n')}\n\n</details>`,
})
