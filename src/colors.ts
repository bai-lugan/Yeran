import { Mark, type Editor } from '@tiptap/core'
import Highlight from '@tiptap/extension-highlight'

export const TEXT_COLORS = [
  ['默认',''],['灰色','#787774'],['棕色','#9f6b53'],['橙色','#c56819'],['黄色','#9a7618'],
  ['绿色','#337a51'],['蓝色','#286d9c'],['紫色','#8050a2'],['粉色','#ad3978'],['红色','#c0342b'],
] as const
export const BACKGROUND_COLORS = [
  ['默认',''],['灰色','#f1f1ef'],['棕色','#f4eeee'],['橙色','#fbecdd'],['黄色','#fbf3db'],
  ['绿色','#edf3ec'],['蓝色','#e7f3f8'],['紫色','#f4f0f7'],['粉色','#f9eef3'],['红色','#ffe3e0'],
] as const
export const RED = '#c0342b', RED_BACKGROUND = '#ffe3e0'
export function colorValue(value:unknown):string|null {
  if(typeof value!=='string')return null
  if(/^#[\da-f]{6}$/i.test(value))return value.toLowerCase()
  if(/^#[\da-f]{3}$/i.test(value))return '#'+[...value.slice(1)].map(c=>c+c).join('').toLowerCase()
  const rgb=/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/.exec(value)
  return rgb&&rgb.slice(1).every(n=>+n<=255)?'#'+rgb.slice(1).map(n=>(+n).toString(16).padStart(2,'0')).join(''):null
}
export const TextColor=Mark.create({
  name:'textColor',
  addAttributes:()=>({color:{default:null,parseHTML:el=>colorValue(el.getAttribute('data-yeran-color')||el.style.color)}}),
  parseHTML:()=>[{tag:'span[data-yeran-color]'}, {style:'color',getAttrs:value=>colorValue(value)?{color:colorValue(value)}:false}],
  renderHTML:({mark})=>['span',{'data-yeran-color':colorValue(mark.attrs.color),style:`color:${colorValue(mark.attrs.color)||'inherit'}`},0],
  markdownTokenName:'textColor',
  markdownTokenizer:{name:'textColor',level:'inline',start:(src:string)=>src.indexOf('<span data-yeran-color='),tokenize(src:string,_t,h){const m=/^<span data-yeran-color="(#[\da-f]{6})"[^>]*>([\s\S]*?)<\/span>/i.exec(src);return m?{type:'textColor',raw:m[0],color:m[1],tokens:h.inlineTokens(m[2]!)}:undefined}},
  parseMarkdown:(token,h)=>h.applyMark('textColor',h.parseInline(token.tokens||[]),{color:colorValue(token.color)}),
  renderMarkdown:(node,h)=>`<span data-yeran-color="${colorValue(node.attrs?.color)||'#292f39'}" style="color:${colorValue(node.attrs?.color)||'#292f39'}">${h.renderChildren(node)}</span>`,
})
export const ColorHighlight=Highlight.extend({
  parseMarkdown:(token,h)=>h.applyMark('highlight',h.parseInline(token.tokens||[]),token.color?{color:colorValue(token.color)}:undefined),
  renderMarkdown:(node,h)=>colorValue(node.attrs?.color)?`<mark data-color="${colorValue(node.attrs?.color)}" style="background-color:${colorValue(node.attrs?.color)}">${h.renderChildren(node)}</mark>`:`==${h.renderChildren(node)}==`,
  markdownTokenizer:{name:'highlight',level:'inline',start(src:string){const positions=[src.indexOf('=='),src.indexOf('<mark')].filter(n=>n>=0);return positions.length?Math.min(...positions):-1},tokenize(src:string,_t,h){const html=/^<mark\s+data-color="(#[\da-f]{6})"[^>]*>([\s\S]*?)<\/mark>/i.exec(src);if(html)return{type:'highlight',raw:html[0],color:html[1],tokens:h.inlineTokens(html[2]!)};const m=/^==(?!\s)([^=]*[^=\s])==/.exec(src);return m?{type:'highlight',raw:m[0],tokens:h.inlineTokens(m[1]!)}:undefined}},
}).configure({multicolor:true})
export function toggleRed(editor:Editor){
  const red=editor.isActive('textColor',{color:RED})&&editor.isActive('highlight',{color:RED_BACKGROUND}),chain=editor.chain().focus()
  if(red)chain.unsetMark('textColor').unsetHighlight().run()
  else chain.setMark('textColor',{color:RED}).setHighlight({color:RED_BACKGROUND}).run()
}
