import { Extension, Node, mergeAttributes, InputRule } from '@tiptap/core'
import { CodeBlock } from '@tiptap/extension-code-block'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { t, locale } from './i18n'
import { watch } from 'vue'
import { CODE_LANGUAGES } from './code-highlighting'

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
  addKeyboardShortcuts() { return { ...this.parent?.(), Tab: () => this.editor.isActive('codeBlock') && this.editor.commands.insertContent('  ') } },
  addNodeView() {
    return ({ node, editor, getPos }) => {
      let current = node
      const dom = document.createElement('div'); dom.className = 'code-block'
      const controls = document.createElement('div'); controls.className = 'block-controls code-controls'; controls.contentEditable = 'false'
      const language = document.createElement('select')
      for (const [value,label] of CODE_LANGUAGES) { const option = document.createElement('option'); option.value = value; option.textContent = t(label); language.append(option) }
      const copy = document.createElement('button'); copy.type = 'button'
      function labels() { language.setAttribute('aria-label', t('代码语言')); language.options[0]!.textContent=t('纯文本'); copy.textContent = t('复制代码'); copy.setAttribute('aria-label', t('复制代码')) }
      labels(); const unwatch = watch(locale, labels)
      function syncLanguage(value:string){if(value&&![...language.options].some(option=>option.value===value)){const extra=document.createElement('option');extra.value=value;extra.textContent=value;language.append(extra)}language.value=value}
      syncLanguage(node.attrs.language || ''); language.addEventListener('change', () => { const pos = getPos(); if (typeof pos === 'number') editor.view.dispatch(editor.state.tr.setNodeMarkup(pos, undefined, { ...current.attrs, language: language.value })) })
      copy.addEventListener('click', async () => { try { await navigator.clipboard.writeText(current.textContent); copy.textContent = t('已复制') } catch { copy.textContent = t('复制失败，请手动选择') } })
      const pre = document.createElement('pre'), code = document.createElement('code'); pre.append(code); controls.append(language, copy); dom.append(controls, pre)
      return { dom, contentDOM: code, stopEvent: event => controls.contains(event.target as globalThis.Node), ignoreMutation: mutation => mutation.type !== 'selection' && !code.contains(mutation.target), update(next) { if (next.type !== current.type) return false; current = next; syncLanguage(next.attrs.language || ''); return true }, destroy: unwatch }
    }
  },
})

export const ToggleSummary = Node.create({
  name: 'toggleSummary', content: 'inline*', defining: true, parseHTML: () => [{ tag: 'summary' }], renderHTML: () => ['summary',0],
  addNodeView() { return () => { const dom = document.createElement('summary'), content = document.createElement('span'), button = document.createElement('button'); button.type = 'button'; button.className = 'toggle-arrow'; button.contentEditable = 'false'; button.textContent = '▸'; button.setAttribute('aria-label', t('展开或折叠')); dom.append(button,content); dom.addEventListener('click', event => { event.preventDefault(); if (button.contains(event.target as globalThis.Node)) { const details = dom.closest('details'); if (details) { details.open = !details.open; button.setAttribute('aria-expanded',String(details.open)) } } }); return { dom, contentDOM: content, stopEvent: event => button.contains(event.target as globalThis.Node) } } },
})
export const ToggleContent = Node.create({ name: 'toggleContent', content: 'block+', defining: true, parseHTML: () => [{ tag: 'div[data-toggle-content]' }], renderHTML: () => ['div',{'data-toggle-content':'',class:'toggle-content'},0] })
export const ToggleBlock = Node.create({
  name: 'toggleBlock', group: 'block', content: 'toggleSummary toggleContent', defining: true,
  parseHTML: () => [{ tag: 'details' }], renderHTML: () => ['details',{class:'toggle-block',open:''},0],
  addNodeView() { return () => { const dom = document.createElement('details'); dom.className = 'toggle-block'; dom.open = true; return { dom, contentDOM: dom, ignoreMutation: mutation => mutation.type === 'attributes' && mutation.target === dom } } },
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
  renderMarkdown: (node, helpers) => `<details>\n<summary>${helpers.renderChildren(node.content?.[0]?.content || []).replace(/\n/g,' ')}</summary>\n\n${helpers.renderChildren(node.content?.[1]?.content || [])}\n\n</details>`,
})
