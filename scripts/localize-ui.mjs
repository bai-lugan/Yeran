import { parse as parseSfc } from '@vue/compiler-sfc'
import { parse } from '@vue/compiler-dom'
import { readFile,writeFile,readdir } from 'node:fs/promises'
const files=['src/App.vue',...(await readdir('src/components')).filter(file=>file.endsWith('.vue')).map(file=>'src/components/'+file)]
for(const file of files){
  let source=await readFile(file,'utf8');const template=parseSfc(source).descriptor.template;if(!template)continue
  const ast=parse(template.content), edits=[]
  const literal=text=>"'"+text.replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/\r?\n/g,'\\n')+"'"
  function visit(node){
    if(node.type===2&&/\p{Script=Han}/u.test(node.content))edits.push({start:node.loc.start.offset,end:node.loc.end.offset,text:'{{ t('+literal(node.content)+') }}'})
    if(node.type===5&&!node.content.content.startsWith('t(')&&(/\p{Script=Han}/u.test(node.content.content)||/^(toast|recoveryStatus|error|result|item\.label|item\.description)$/.test(node.content.content.trim())))edits.push({start:node.loc.start.offset,end:node.loc.end.offset,text:'{{ t('+node.content.content+') }}'})
    for(const prop of node.props||[]){
      if(prop.type===6&&['aria-label','title','placeholder'].includes(prop.name)&&prop.value&&/\p{Script=Han}/u.test(prop.value.content))edits.push({start:prop.loc.start.offset,end:prop.loc.end.offset,text:':'+prop.name+'="t('+literal(prop.value.content).replace(/"/g,'&quot;')+')"'})
      if(prop.type===7&&prop.name==='bind'&&['aria-label','title','placeholder'].includes(prop.arg?.content)&&prop.exp&&/\p{Script=Han}/u.test(prop.exp.content)&&!prop.exp.content.startsWith('t('))edits.push({start:prop.exp.loc.start.offset,end:prop.exp.loc.end.offset,text:'t('+prop.exp.content+')'})
    }
    for(const child of node.children||[])visit(child)
  }
  visit(ast);let text=template.content
  for(const edit of edits.sort((a,b)=>b.start-a.start))text=text.slice(0,edit.start)+edit.text+text.slice(edit.end)
  source=source.slice(0,template.loc.start.offset)+text+source.slice(template.loc.end.offset)
  if(!source.includes("from './i18n'")&&!source.includes("from '../i18n'"))source=source.replace('<script setup lang="ts">',`<script setup lang="ts">\nimport { t${file.endsWith('App.vue')?', locale':''} } from '${file.endsWith('App.vue')?'./i18n':'../i18n'}'`)
  await writeFile(file,source)
}
console.log('Localized Vue interface text; document content bindings were preserved.')
