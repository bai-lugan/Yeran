import { Extension, Node, mergeAttributes, InputRule, markInputRule } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import Subscript from '@tiptap/extension-subscript'
import Superscript from '@tiptap/extension-superscript'
import Link from '@tiptap/extension-link'
import { t } from './i18n'

function scriptMark(base: typeof Subscript, symbol: string, name: string) {
  return base.extend({
    priority: 110,
    markdownTokenName: name,
    markdownTokenizer: {
      name, level: 'inline', start: (src: string) => src.indexOf(symbol),
      tokenize(src: string, _tokens, lexer) {
        const regex = symbol === '~' ? /^~(?!~)((?:\\.|[^~\n])+?)~(?!~)/ : /^\^((?:\\.|[^\^\n])+?)\^/
        const match = regex.exec(src)
        if (!match || /(^\s|\s$)/.test(match[1]!)) return
        return { type: name, raw: match[0], tokens: lexer.inlineTokens(match[1]!.replace(/\\ /g, ' ')) }
      },
    },
    parseMarkdown: (token, h) => h.applyMark(name,h.parseInline(token.tokens || [])),
    renderMarkdown: (node,h) => `${symbol}${h.renderChildren(node).replace(/ /g,'\\ ')}${symbol}`,
    addInputRules(){return[markInputRule({find:symbol==='~'?/(?<!~)(~(?!~)([^~\n]+)~)$/:/(\^([^\^\n]+)\^)$/,type:this.type})]},
  })
}
export const YeranSubscript = scriptMark(Subscript,'~','subscript')
export const YeranSuperscript = scriptMark(Superscript,'^','superscript')
export const YeranLink = Link.extend({renderMarkdown(node,h){const href=String(node.attrs?.href||''),title=String(node.attrs?.title||'').replace(/"/g,'\\"'),target=/[\s()]/.test(href)?`<${href}>`:href;return`[${h.renderChildren(node)}](${target}${title?` "${title}"`:''})`}}).configure({openOnClick:false,autolink:true})

export const FootnoteReference = Node.create({
  name:'footnoteReference',group:'inline',inline:true,atom:true,
  addAttributes:()=>({label:{default:'1'}}),
  parseHTML:()=>[{tag:'sup[data-footnote-reference]',getAttrs:el=>({label:(el as HTMLElement).dataset.footnoteReference})}],
  renderHTML:({node})=>['sup',{'data-footnote-reference':node.attrs.label,class:'footnote-reference'},['a',{href:`#fn-${encodeURIComponent(node.attrs.label)}`},`[${node.attrs.label}]`]],
  markdownTokenName:'footnoteReference',
  markdownTokenizer:{name:'footnoteReference',level:'inline',start:(src:string)=>src.indexOf('[^'),tokenize(src:string){const m=/^\[\^([^\]\n]+)\]/.exec(src);return m?{type:'footnoteReference',raw:m[0],label:m[1]}:undefined}},
  parseMarkdown:token=>({type:'footnoteReference',attrs:{label:token.label}}),
  renderMarkdown:node=>`[^${node.attrs?.label}]`,
  addInputRules(){return[new InputRule({find:/\[\^([^\]\n]+)\]$/,handler:({state,range,match})=>{state.tr.replaceWith(range.from,range.to,this.type.create({label:match[1]}))}})]},
})
export const FootnoteDefinition = Node.create({
  name:'footnoteDefinition',group:'block',content:'block+',defining:true,
  addAttributes:()=>({label:{default:'1'}}),
  parseHTML:()=>[{tag:'aside[data-footnote-definition]',getAttrs:el=>({label:(el as HTMLElement).dataset.footnoteDefinition})}],
  renderHTML:({node,HTMLAttributes})=>['aside',mergeAttributes(HTMLAttributes,{'data-footnote-definition':node.attrs.label,id:`fn-${node.attrs.label}`,class:'footnote-definition'}),0],
  markdownTokenName:'footnoteDefinition',
  markdownTokenizer:{name:'footnoteDefinition',level:'block',start:(src:string)=>src.search(/^\[\^[^\]\n]+\]:/m),tokenize(src:string,_tokens,h){
    const first=/^\[\^([^\]\n]+)\]:[ \t]*([^\n]*)(?:\n|$)/.exec(src);if(!first)return
    let raw=first[0],body=first[2]!,rest=src.slice(raw.length)
    while(rest){const continuation=/^(?: {4}|\t)([^\n]*)(?:\n|$)/.exec(rest);if(continuation){raw+=continuation[0];body+='\n'+continuation[1];rest=rest.slice(continuation[0].length);continue}
      const blank=/^\n+(?=(?: {4}|\t))/.exec(rest);if(blank){raw+=blank[0];body+=blank[0];rest=rest.slice(blank[0].length);continue}break}
    return{type:'footnoteDefinition',raw,label:first[1],bodyTokens:h.blockTokens(body)}
  }},
  parseMarkdown:(token,h)=>({type:'footnoteDefinition',attrs:{label:token.label},content:h.parseChildren(token.bodyTokens).length?h.parseChildren(token.bodyTokens):[{type:'paragraph'}]}),
  renderMarkdown:(node,h)=>{const body=h.renderChildren(node).trim();return `[^${node.attrs?.label}]: ${body.split('\n').map((line,i)=>i?'    '+line:line).join('\n')}`},
})

function headingList(doc: import('@tiptap/pm/model').Node) {
  const seen=new Map<string,number>(),headings:{text:string;level:number;pos:number;id:string}[]=[]
  doc.descendants((node,pos)=>{if(node.type.name!=='heading')return
    const base=node.textContent.toLowerCase().trim().replace(/[^\p{L}\p{N}\s_-]/gu,'').replace(/\s+/g,'-')||'section'
    const count=seen.get(base)||0;seen.set(base,count+1)
    headings.push({text:node.textContent,level:node.attrs.level,pos,id:count?`${base}-${count}`:base})
  });return headings
}
export const TableOfContents = Node.create({
  name:'tableOfContents',group:'block',atom:true,
  parseHTML:()=>[{tag:'nav[data-table-of-contents]'}],
  renderHTML:()=>['nav',{'data-table-of-contents':'',class:'document-toc'}],
  markdownTokenName:'tableOfContents',
  markdownTokenizer:{name:'tableOfContents',level:'block',start:(src:string)=>src.search(/^\[toc\][ \t]*(?:\n|$)/im),tokenize(src:string){const m=/^\[toc\][ \t]*(?:\n|$)/i.exec(src);return m?{type:'tableOfContents',raw:m[0]}:undefined}},
  parseMarkdown:()=>({type:'tableOfContents'}),renderMarkdown:()=> '[TOC]',
  addNodeView(){return({editor})=>{
    const dom=document.createElement('nav');dom.className='document-toc';dom.dataset.tableOfContents='';dom.contentEditable='false'
    let previous='';const update=()=>{const headings=headingList(editor.state.doc),signature=JSON.stringify(headings);if(signature===previous)return;previous=signature;dom.replaceChildren()
      if(!headings.length){const span=document.createElement('span');span.textContent=t('添加标题后显示目录');dom.append(span)}
      for(const heading of headings){const a=document.createElement('a');a.href='#'+encodeURIComponent(heading.id);a.textContent=heading.text||t('未命名标题');a.style.paddingLeft=`${(heading.level-1)*14}px`;a.addEventListener('click',event=>{event.preventDefault();editor.chain().focus().setTextSelection(heading.pos+1).scrollIntoView().run()});dom.append(a)}
    };update();editor.on('update',update);return{dom,ignoreMutation:()=>true,stopEvent:()=>true,destroy(){editor.off('update',update)}}
  }},
})

export const Callout = Node.create({
  name:'callout',group:'block',content:'block+',defining:true,
  addAttributes:()=>({kind:{default:'NOTE'}}),
  parseHTML:()=>[{tag:'aside[data-callout]',getAttrs:el=>({kind:(el as HTMLElement).dataset.callout})}],
  renderHTML:({node,HTMLAttributes})=>['aside',mergeAttributes(HTMLAttributes,{'data-callout':node.attrs.kind,class:'callout'}),0],
  markdownTokenName:'callout',
  markdownTokenizer:{name:'callout',level:'block',start:(src:string)=>src.search(/^>\s*\[!(?:NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/im),tokenize(src:string,_tokens,h){
    const m=/^>[ \t]*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\][ \t]*(?:\n|$)/i.exec(src);if(!m)return
    let raw=m[0],body='',rest=src.slice(raw.length)
    while(rest){const line=/^>[ \t]?([^\n]*)(?:\n|$)/.exec(rest);if(!line)break;raw+=line[0];body+=line[1]+'\n';rest=rest.slice(line[0].length)}
    return{type:'callout',raw,kind:m[1]!.toUpperCase(),bodyTokens:h.blockTokens(body)}
  }},
  parseMarkdown:(token,h)=>({type:'callout',attrs:{kind:token.kind},content:h.parseChildren(token.bodyTokens).length?h.parseChildren(token.bodyTokens):[{type:'paragraph'}]}),
  renderMarkdown:(node,h)=>`> [!${node.attrs?.kind}]\n${h.renderChildren(node).trim().split('\n').map(line=>'> '+line).join('\n')}`,
})

declare module '@tiptap/core' {interface Storage { documentLinks:{open:(href:string)=>void} }}
export const DocumentLinks = Extension.create({
  name:'documentLinks',addStorage:()=>({open:(_href:string)=>{}}),
  addProseMirrorPlugins(){const storage=this.storage;return[new Plugin({
    key:new PluginKey('yeranHeadingLinks'),
    props:{decorations(state){const decorations=headingList(state.doc).map(h=>Decoration.node(h.pos,h.pos+state.doc.nodeAt(h.pos)!.nodeSize,{id:h.id})),notes=new Map<string,string>();state.doc.descendants(node=>{if(node.type.name==='footnoteDefinition')notes.set(node.attrs.label,node.textContent)});state.doc.descendants((node,pos)=>{if(node.type.name==='footnoteReference')decorations.push(Decoration.node(pos,pos+node.nodeSize,{title:notes.get(node.attrs.label)||t('脚注尚无对应说明')}))});return DecorationSet.create(state.doc,decorations)},
      handleClick(view,_pos,event){const a=(event.target as Element).closest('a[href]');if(!a)return false;const href=a.getAttribute('href')||''
        if(href.startsWith('#')){let id:string;try{id=decodeURIComponent(href.slice(1))}catch{return false}const target=view.dom.querySelector<HTMLElement>('#'+CSS.escape(id));if(target){event.preventDefault();target.scrollIntoView({block:'center'});return true}return false}
        if(event.ctrlKey||event.metaKey){event.preventDefault();storage.open(href);return true}return false},
    },
  })]},
})

export function insertFootnote(editor: import('@tiptap/core').Editor) {
  const labels=new Set<string>();editor.state.doc.descendants(node=>{if(node.type.name==='footnoteDefinition'||node.type.name==='footnoteReference')labels.add(node.attrs.label)})
  let number=1;while(labels.has(String(number)))number++
  editor.chain().focus().insertContent({type:'footnoteReference',attrs:{label:String(number)}}).run()
  const pos=editor.state.doc.content.size
  editor.commands.insertContentAt(pos,[{type:'footnoteDefinition',attrs:{label:String(number)},content:[{type:'paragraph'}]}])
  editor.commands.setTextSelection(Math.min(pos+2,editor.state.doc.content.size-1));editor.commands.focus()
}
