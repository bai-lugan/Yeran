import {chromium} from '@playwright/test'
import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
const out='.oil-ui/yeran-21';await mkdir(out,{recursive:true})
const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}}),results=[],errors=[]
page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.stack))
const test=async(name,fn)=>{if(process.env.YERAN_TEST_ONLY&&!name.includes(process.env.YERAN_TEST_ONLY))return;await fn();results.push(name);console.log('PASS '+name)}
const settle=()=>page.waitForTimeout(80)
const reset=async(text='',auto=true,path=null)=>{await page.evaluate(async({text,auto,path})=>{await window.__yeran.replaceDocument(text,path,null,false);window.__yeran.viewMode.value='continuous';const e=window.__yeran.editor;e.storage.autoPair.enabled=auto;e.commands.focus('start')},{text,auto,path});await settle()}
const doc=()=>page.evaluate(()=>window.__yeran.editor.getJSON()),raw=()=>page.evaluate(()=>window.__yeran.getMarkdown())
const code=async()=>{const d=await doc();return d.content.find(n=>n.type==='codeBlock')}
const text=n=>n.content?.map(c=>c.text||'').join('')||''
async function endCode(){await page.evaluate(()=>{const e=window.__yeran.editor;let end;e.state.doc.descendants((n,p)=>{if(end===undefined&&n.type.name==='codeBlock')end=p+n.nodeSize-1});e.chain().focus().setTextSelection(end).run()})}
async function paste(text,html='',extra={}){await page.evaluate(({text,html,extra})=>{const e=window.__yeran.editor,d=new DataTransfer();d.setData('text/plain',text);if(html)d.setData('text/html',html);for(const [k,v]of Object.entries(extra))d.setData(k,v);e.view.dom.dispatchEvent(new ClipboardEvent('paste',{bubbles:true,cancelable:true,clipboardData:d}))},{text,html,extra});await settle()}
try{
 await page.goto(process.env.YERAN_TEST_URL||'http://127.0.0.1:15520');await page.waitForFunction(()=>window.__yeran)
 await test('typed backtick and tilde fences open with language aliases, with auto-pair both enabled and disabled',async()=>{
  for(const auto of [true,false])for(const [fence,language]of [['```',''],['```','python'],['```','c++'],['```','c#'],['```','objective-c'],['````','markdown'],['~~~','powershell'],['   ~~~','bash'],['  ```','python']]){await reset('',auto);await page.keyboard.type(fence+language);await page.keyboard.press('Enter');const n=await code();assert.ok(n,`${auto}/${fence}/${language}`);assert.equal(n.attrs.language,language||null);assert.equal(n.attrs.fenceMarker,fence.trimStart());assert.equal(text(n),'');assert.equal(await page.evaluate(()=>window.__yeran.editor.state.selection.$from.parent.type.name),'codeBlock')}
 })
 await test('closing fences exit on Enter, remove only the closing line and support undo and redo',async()=>{
  for(const marker of ['```','~~~','````']){await reset(marker+'python\nprint(1)\n'+marker);await endCode();await page.keyboard.press('Enter');await page.keyboard.type(marker);const before=await doc();await page.keyboard.press('Enter');assert.equal(text(await code()),'print(1)');assert.equal(await page.evaluate(()=>window.__yeran.editor.state.selection.$from.parent.type.name),'paragraph');await page.keyboard.type('After');assert.ok((await raw()).endsWith('After'));await page.keyboard.press('Control+z');await page.keyboard.press('Control+z');assert.deepEqual(await doc(),before);await page.keyboard.press('Control+Shift+z');assert.equal(text(await code()),'print(1)')}
 })
 await test('typed fences inside lists, quotes and toggle bodies keep the caret in the actual nested code block',async()=>{
  for(const initial of ['- Item','> Quote','<details><summary>Toggle</summary><div data-toggle-content><p>Body</p></div></details>']){
   await reset(initial);await page.evaluate(()=>{const e=window.__yeran.editor;let end;e.state.doc.descendants((n,p)=>{if(n.type.name==='paragraph')end=p+n.nodeSize-1});e.commands.setTextSelection(end)});await page.keyboard.press('Enter');await page.keyboard.type('```python');await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>window.__yeran.editor.state.selection.$from.parent.type.name),'codeBlock');await page.keyboard.type('nested()');assert.equal(await page.locator('.code-block code').innerText(),'nested()');await page.keyboard.press('Enter');await page.keyboard.type('```');await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>window.__yeran.editor.state.selection.$from.parent.type.name),'paragraph');assert.equal(await page.locator('.code-block code').innerText(),'nested()')
  }
 })
 await test('shorter or mismatched fences, mid-code lines and Shift+Enter remain literal code',async()=>{
  await reset('````markdown\nexample\n````');await endCode();await page.keyboard.press('Enter');await page.keyboard.type('```');await page.keyboard.press('Enter');assert.equal(text(await code()),'example\n```\n');await page.keyboard.type('````');await page.keyboard.press('Shift+Enter');assert.equal(text(await code()),'example\n```\n````\n');await page.keyboard.type('````');await page.keyboard.press('Enter');assert.equal(text(await code()),'example\n```\n````');
  await reset('~~~python\nprint(1)\n~~~');await endCode();await page.keyboard.press('Enter');await page.keyboard.type('```');await page.keyboard.press('Enter');assert.equal(text(await code()),'print(1)\n```\n');
  await reset('```python\n```\nprint(2)\n```');await page.evaluate(()=>window.__yeran.editor.commands.setTextSelection(4));await page.keyboard.press('Enter');assert.equal((await doc()).content.filter(n=>n.type==='codeBlock').length,1)
 })
 await test('plain fenced code pasted into prose becomes code without losing tabs, script tags, backslashes or CRLF lines',async()=>{
  const body='\tprint("<script>alert(1)</script>")\npath = r"C:\\work\\file"\n# 中文 **literal**'
  await reset();await paste('```python\r\n'+body.replaceAll('\n','\r\n')+'\r\n```');const n=await code();assert.equal(n.attrs.language,'python');assert.equal(text(n),body);assert.equal(await page.locator('.paper-editor script').count(),0);const saved=await raw();await reset(saved);assert.equal(text(await code()),body)
 })
 await test('one fenced snippet pasted into an empty or fully selected code block unwraps and adopts its language',async()=>{
  for(const existing of ['', 'old code']){await reset('```\n'+existing+'\n```');await page.evaluate(()=>{const e=window.__yeran.editor;e.commands.setTextSelection({from:1,to:1+e.state.doc.firstChild.content.size})});await paste('\n```powershell\nGet-Date\n  Write-Host "ok"\n```\n');const n=await code();assert.equal(text(n),'Get-Date\n  Write-Host "ok"');assert.equal(n.attrs.language,'powershell');assert.equal((await doc()).content.filter(n=>n.type==='codeBlock').length,1);await page.keyboard.press('Control+z');assert.equal(text(await code()),existing)}
 })
 await test('a partial fenced paste keeps the current language, while incomplete or mixed snippets remain literal inside code',async()=>{
  await reset('```python\nleft-right\n```');await page.evaluate(()=>window.__yeran.editor.commands.setTextSelection(6));await paste('```sh\necho ok\n```');assert.equal(text(await code()),'left-echo okright');assert.equal((await code()).attrs.language,'python');
  for(const source of ['```python\nno close','```python\na\n```\n\nOutside\n\n```sh\nb\n```','not a fence\n```']){await reset('```\n\n```');await paste(source);assert.equal(text(await code()),source)}
 })
 await test('longer outer fences preserve nested Markdown fences and matching tilde fences unwrap safely',async()=>{
  const body='```python\nprint(1)\n```';await reset('```\n\n```');await paste('````markdown\n'+body+'\n````');assert.equal(text(await code()),body);assert.equal((await code()).attrs.fenceMarker,'````');const saved=await raw();await reset(saved);assert.equal(text(await code()),body);
  await reset();await paste('~~~bat\necho hello\n~~~');assert.equal(text(await code()),'echo hello');assert.equal((await code()).attrs.language,'bat')
 })
 await test('mixed Markdown paste parses headings, separate code blocks, lists, tables, inline formatting and Mermaid',async()=>{
  await reset();await paste('# Heading\n\n```python\nprint(1)\n```\n\nText **bold** and `inline`\n\n~~~sh\necho hi\n~~~\n\n- item');assert.equal(await page.locator('.paper-editor h1').count(),1);assert.equal((await doc()).content.filter(n=>n.type==='codeBlock').length,2);assert.equal(await page.locator('.paper-editor strong').count(),1);assert.equal(await page.locator('.paper-editor ul').count(),1);
  await reset();await paste('| A | B |\n|---|---|\n| One | Two |');assert.equal(await page.locator('.paper-editor td').count(),2);
  await reset();await paste('```mermaid\nflowchart LR\n A[Start] --> B[End]\n```');await page.waitForSelector('.mermaid-preview svg');assert.equal(text(await code()),'flowchart LR\n A[Start] --> B[End]');await page.screenshot({path:out+'/mermaid-paste.png'})
 })
 await test('HTML-wrapped fenced snippets work, while internal rich block copies retain size and alignment',async()=>{
  await reset();await paste('```python\nprint(1)\n```','<pre><code>```python\nprint(1)\n```</code></pre>');assert.equal(text(await code()),'print(1)');
  await reset('<pre data-code-width="320" data-code-scale="0.9" data-block-align="right"><code class="language-python">print(2)</code></pre>');const data=await page.evaluate(async()=>{const {serializeBlockNodes}=await import('/src/block-clipboard.ts');const e=window.__yeran.editor,n=e.state.doc.firstChild,d=serializeBlockNodes(e,[n]);e.commands.focus('end');return d});await paste(data.text,data.html);const ns=(await doc()).content.filter(n=>n.type==='codeBlock');assert.equal(ns.length,2);assert.equal(ns[1].attrs.codeWidth,320);assert.equal(ns[1].attrs.blockAlign,'right');assert.equal(text(ns[1]),'print(2)')
 })
 await test('explicit plain-text paste and TXT documents keep Markdown fences literal',async()=>{
  const source='```python\nprint(1)\n```';await reset();await paste(source,'',{'application/x-yeran-plain-text':'true'});assert.equal(await page.locator('.code-block').count(),0);assert.ok((await doc()).content.some(n=>text(n)==='```python'));
  await reset();await page.evaluate(()=>window.__yeran.editor.view.dom.dispatchEvent(new KeyboardEvent('keydown',{key:'v',ctrlKey:true,shiftKey:true,bubbles:true,cancelable:true})));await paste(source);assert.equal(await page.locator('.code-block').count(),0);
  await reset('',true,'literal.txt');await paste(source);assert.equal(await raw(),source);assert.equal(await page.locator('.code-block').count(),0);await page.keyboard.press('Control+End');await page.keyboard.press('Enter');await page.keyboard.type('```');await page.keyboard.press('Enter');assert.equal(await page.locator('.code-block').count(),0)
 })
 await test('code copy exports only code content and a normal paste keeps the exact snippet',async()=>{
  await page.evaluate(()=>{window.__codeCopied='';navigator.clipboard.writeText=async text=>{window.__codeCopied=text}});await reset('```python\nprint(1)\nprint(2)\n```');await page.getByRole('button',{name:'复制代码',exact:true}).click();const copied=await page.evaluate(()=>window.__codeCopied);assert.equal(copied,'print(1)\nprint(2)');await reset('```python\n\n```');await paste(copied);assert.equal(text(await code()),copied)
 })
 await test('basic Markdown input rules still work for headings, lists, tasks, quotes, dividers and inline formatting',async()=>{
  for(const auto of [true,false])for(const [source,selector]of [['# ','h1'],['###### ','h6'],['- ','ul'],['+ ','ul'],['1. ','ol'],['[] ','ul[data-type="taskList"]'],['> ','blockquote'],['--- ','hr'],['**bold**','strong'],['*italic*','em'],['~~strike~~','s'],['`inline`','code']]){await reset('',auto);await page.keyboard.type(source);assert.ok(await page.locator('.paper-editor '+selector).count(),`${auto}/${source}/${JSON.stringify(await doc())}`)}
 })
 assert.deepEqual(errors,[]);await writeFile(out+'/verification.json',JSON.stringify({passed:results.length,results,errors},null,2))
}catch(error){console.error(error);await page.screenshot({path:out+'/failure.png'}).catch(()=>{});await writeFile(out+'/failure-state.json',JSON.stringify(await doc(),null,2));throw error}finally{await browser.close()}
