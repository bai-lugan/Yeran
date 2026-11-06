import {chromium} from '@playwright/test'
import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
const out='.oil-ui/yeran-22';await mkdir(out,{recursive:true})
const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}}),results=[],errors=[],emojiRequests=[]
page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.stack));page.on('request',r=>{if(r.url().includes('/src/emoji-data.json'))emojiRequests.push(r.url())})
const test=async(name,fn)=>{if(process.env.YERAN_TEST_ONLY&&!name.includes(process.env.YERAN_TEST_ONLY))return;await fn();results.push(name);console.log('PASS '+name)}
const settle=()=>page.waitForTimeout(100),doc=()=>page.evaluate(()=>window.__yeran.editor.getJSON()),raw=()=>page.evaluate(()=>window.__yeran.getMarkdown()),body=()=>page.locator('.paper-editor').innerText()
const reset=async(text='',path=null)=>{await page.keyboard.press('Escape');await page.evaluate(async({text,path})=>{await window.__yeran.replaceDocument(text,path,null,false);window.__yeran.viewMode.value='continuous';window.__yeran.editor.commands.focus('start')},{text,path});await settle()}
const menu=()=>page.locator('.emoji-menu'),options=()=>menu().getByRole('option')
const suggestion=async(query)=>{await page.keyboard.type(query);await options().first().waitFor()}
try{
 await page.goto(process.env.YERAN_TEST_URL||'http://127.0.0.1:15520');await page.waitForFunction(()=>window.__yeran)
 await test('a typed header creates two rows and places the caret in the first body cell with independent undo',async()=>{
  await reset();await page.keyboard.type('| Name | Age |');await page.keyboard.press('Enter');assert.deepEqual(await page.locator('th').allTextContents(),['Name','Age']);assert.equal(await page.locator('td').count(),2);await page.keyboard.type('Alice');assert.equal(await page.locator('td').first().textContent(),'Alice');await page.keyboard.press('Control+z');assert.equal(await page.locator('td').first().textContent(),'');await page.keyboard.press('Control+z');assert.equal(await page.locator('.paged-table').count(),0);assert.equal((await body()).trim(),'| Name | Age |');await page.keyboard.press('Control+Shift+z');assert.equal(await page.locator('th').count(),2);assert.equal(emojiRequests.length,0)
 })
 await test('header cells preserve bold, inline-code pipes and escaped pipes across Markdown reopening',async()=>{
  await reset();await page.keyboard.type('| **Name** | `a|b` | A\\|B |');await page.keyboard.press('Enter');assert.deepEqual(await page.locator('th').allTextContents(),['Name','a|b','A|B']);assert.equal(await page.locator('th strong').count(),1);assert.equal(await page.locator('th code').textContent(),'a|b');const saved=await raw();await reset(saved);assert.deepEqual(await page.locator('th').allTextContents(),['Name','a|b','A|B']);assert.equal(await page.locator('th strong').count(),1)
 })
 await test('header conversion works inside lists, quotes and toggles without losing the nested caret',async()=>{
  for(const initial of ['- Item','> Quote','<details><summary>Toggle</summary><div data-toggle-content><p>Body</p></div></details>']){await reset(initial);await page.evaluate(()=>{const e=window.__yeran.editor;let end;e.state.doc.descendants((n,p)=>{if(n.type.name==='paragraph')end=p+n.nodeSize-1});e.commands.setTextSelection(end)});await page.keyboard.press('Enter');await page.keyboard.type('| A | B |');await page.keyboard.press('Enter');assert.equal(await page.locator('th').count(),2);await page.keyboard.type('Nested');assert.equal(await page.locator('td').first().textContent(),'Nested')}
 })
 await test('Shift+Enter, mid-line Enter, code, TXT and existing table cells keep pipe text literal',async()=>{
  await reset();await page.keyboard.type('| A | B |');await page.keyboard.press('Shift+Enter');assert.equal(await page.locator('.paged-table').count(),0);
  await reset('| A | B |');await page.evaluate(()=>window.__yeran.editor.commands.setTextSelection(4));await page.keyboard.press('Enter');assert.equal(await page.locator('.paged-table').count(),0);
  for(const [source,path]of [['```txt\n\n```',null],['','literal.txt']]){await reset(source,path);await page.keyboard.type('| A | B |');await page.keyboard.press('Enter');assert.equal(await page.locator('.paged-table').count(),0)}
  await reset('| A | B |\n|---|---|\n| One | Two |');await page.locator('td').first().click();await page.keyboard.press('Control+a');await page.keyboard.press('ArrowRight');await page.keyboard.type('| C | D |');await page.keyboard.press('Enter');assert.equal(await page.locator('.paged-table').count(),1)
 })
 await test('emoji names load only on demand and Enter or Tab inserts an emoji at the correct caret',async()=>{
  await reset();assert.equal(emojiRequests.length,0);await suggestion(':smi');assert.equal(emojiRequests.length,1);assert.match(await options().first().textContent(),/:smile:/);await page.keyboard.press('Enter');assert.equal((await body()).trim(),'😄');await page.keyboard.type('!');assert.equal((await body()).trim(),'😄!');await reset();await suggestion(':rocket');await page.keyboard.press('Tab');assert.equal((await body()).trim(),'🚀');assert.equal(emojiRequests.length,1)
 })
 await test('completed aliases, variants, flags and Chinese searches insert Unicode and survive save/reopen',async()=>{
  for(const [source,expected]of [[':smile:','😄'],[':+1:','👍'],[':heart:','❤️'],[':cn:','🇨🇳']]){await reset();await page.keyboard.type(source);await page.waitForFunction(expected=>document.querySelector('.paper-editor').textContent.trim()===expected,expected);const saved=await raw();await reset(saved);assert.equal((await body()).trim(),expected)}
  await reset();await page.keyboard.insertText(':火箭');await options().first().waitFor();await page.keyboard.press('Enter');assert.equal((await body()).trim(),'🚀');await reset();await page.keyboard.insertText(':讚');await options().first().waitFor();await page.keyboard.press('Enter');assert.equal((await body()).trim(),'👍')
 })
 await test('Escape, unknown names and undo preserve literal aliases without automatic reinsertion',async()=>{
  await reset();await suggestion(':smile');await page.keyboard.press('Escape');await settle();assert.equal(await menu().count(),0);assert.equal((await body()).trim(),':smile');await page.keyboard.press('Enter');assert.equal(await menu().count(),0);assert.equal((await body()).trim(),':smile');
  await reset();await page.keyboard.type(':not_a_real_emoji_name');await settle();assert.equal(await options().count(),0);await page.keyboard.press('Enter');assert.ok((await body()).includes(':not_a_real_emoji_name'));
  await reset();await page.keyboard.type(':smile:');await page.waitForFunction(()=>document.querySelector('.paper-editor').textContent.trim()==='😄');await page.keyboard.press('Control+z');await settle();assert.equal((await body()).trim(),':smile:');await settle();assert.equal((await body()).trim(),':smile:')
 })
 await test('arrow navigation chooses the highlighted candidate and existing complete aliases stay literal until selected',async()=>{
  await reset();await suggestion(':sm');await page.keyboard.press('ArrowDown');const glyph=await menu().locator('[aria-selected="true"] .emoji-glyph').textContent();await page.keyboard.press('Tab');assert.equal((await body()).trim(),glyph);await reset(':smile:');await page.keyboard.press('Control+End');await settle();assert.equal((await body()).trim(),':smile:');await page.keyboard.press('Escape')
  await reset();await suggestion(':smile');await page.keyboard.press('ArrowLeft');await settle();assert.equal(await menu().count(),0);assert.equal((await body()).trim(),':smile');await page.keyboard.press('Control+End');await page.keyboard.press('Shift+ArrowUp');await settle();assert.equal(await menu().count(),0)
 })
 await test('emoji never completes in code, inline code, text files, URLs, times or escaped aliases',async()=>{
  for(const [source,path]of [['```python\n\n```',null],['','literal.txt']]){await reset(source,path);if(source){await page.locator('.code-block pre').click()}await page.keyboard.type(':smile:');await settle();assert.ok((await body()).includes(':smile:'));assert.equal(await menu().count(),0)}
  await reset('`literal`');await page.evaluate(()=>window.__yeran.editor.commands.setTextSelection(4));await page.keyboard.type(':smile:');await settle();assert.equal(await menu().count(),0);assert.ok((await page.locator('.paper-editor code').textContent()).includes(':smile:'));
  for(const literal of ['https://example.com/path','10:30','C:\\work','\\:smile:']){await reset();await page.keyboard.type(literal);await settle();assert.equal(await menu().count(),0);assert.equal((await body()).trim(),literal)}
 })
 await test('replacing a fully selected document preserves an intentionally empty code block or heading',async()=>{
  for(const [source,selector]of [['```python\n\n```','.code-block'],['<h1></h1>','.paper-editor h1']]){await reset('Prior document');await page.keyboard.press('Home');await page.keyboard.press('Shift+End');assert.equal(await page.evaluate(()=>getSelection().toString()),'Prior document');await page.evaluate(source=>window.__yeran.replaceDocument(source,null,null,false),source);await settle();assert.equal(await page.locator(selector).count(),1)}
 })
 await test('mouse selection keeps text marks and emoji works in a table cell',async()=>{
  await reset();await page.evaluate(()=>window.__yeran.editor.commands.setBold());await suggestion(':rocket');await options().first().click();assert.equal(await page.locator('.paper-editor strong').textContent(),'🚀');assert.equal(await menu().count(),0);
  await reset();await page.keyboard.type('| A | B |');await page.keyboard.press('Enter');await suggestion(':heart');await page.keyboard.press('Tab');assert.equal(await page.locator('td').first().textContent(),'❤️');assert.equal(await page.locator('td').count(),2)
 })
 await test('emoji menu fits a small dark viewport and supports English and Traditional Chinese labels',async()=>{
  await page.setViewportSize({width:960,height:720});await page.emulateMedia({colorScheme:'dark'});await reset();await page.getByLabel('界面语言').selectOption('en');await page.locator('.paper-editor').click();await suggestion(':sm');assert.equal(await page.getByRole('listbox',{name:'Emoji suggestions',exact:true}).count(),1);let r=await menu().boundingBox();assert.ok(r.x>=0&&r.y>=85&&r.x+r.width<=960&&r.y+r.height<=720,JSON.stringify(r));await page.waitForFunction(()=>getComputedStyle(document.querySelector('.emoji-menu')).opacity==='1');await page.screenshot({path:out+'/emoji-dark-en.png'});await page.keyboard.press('Escape');await page.getByLabel('Interface language').selectOption('zh-TW');await reset();await suggestion(':rock');assert.equal(await page.getByRole('listbox',{name:'表情候選',exact:true}).count(),1);await page.waitForFunction(()=>getComputedStyle(document.querySelector('.emoji-menu')).opacity==='1');await page.screenshot({path:out+'/emoji-traditional.png'});await page.keyboard.press('Escape');await page.getByLabel('介面語言').selectOption('zh-CN');await page.setViewportSize({width:1440,height:1000});await page.emulateMedia({colorScheme:'light'})
 })
 await test('a composition in progress cannot choose an emoji and slash insertion still works independently',async()=>{
  await reset();await suggestion(':smi');await page.evaluate(()=>document.querySelector('.paper-editor').dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true,data:''})));await page.keyboard.press('Enter');assert.ok((await body()).includes(':smi'));assert.ok(!(await body()).includes('😄'));await page.evaluate(()=>document.querySelector('.paper-editor').dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:''})));await reset();await page.keyboard.type('/table');await page.keyboard.press('Enter');assert.equal(await page.locator('th').count(),3);assert.equal(await menu().count(),0)
 })
 await test('a delayed emoji data load cannot edit a replacement document',async()=>{
  const other=await browser.newPage();other.on('pageerror',e=>errors.push(e.stack));let release;const gate=new Promise(resolve=>release=resolve)
  try{await other.route('**/src/emoji-data.json**',async route=>{await gate;await route.continue()});await other.goto(process.env.YERAN_TEST_URL||'http://127.0.0.1:15520');await other.waitForFunction(()=>window.__yeran);await other.evaluate(async()=>{await window.__yeran.replaceDocument('',null,null,false);window.__yeran.editor.commands.focus('start')});const requested=other.waitForRequest(r=>r.url().includes('/src/emoji-data.json'));await other.keyboard.type(':smile:');await requested;await other.evaluate(()=>window.__yeran.replaceDocument('Replacement document',null,null,false));const loaded=other.waitForResponse(r=>r.url().includes('/src/emoji-data.json'));release();await(await loaded).finished();await other.waitForTimeout(200);assert.equal((await other.locator('.paper-editor').innerText()).trim(),'Replacement document');assert.equal(await other.locator('.emoji-menu').count(),0)}finally{release();await other.close()}
 })
 assert.deepEqual(errors,[]);await writeFile(out+'/verification.json',JSON.stringify({passed:results.length,results,errors,emojiRequests},null,2))
}catch(error){console.error(error);await page.screenshot({path:out+'/failure.png'}).catch(()=>{});await writeFile(out+'/failure-state.json',JSON.stringify(await doc(),null,2));throw error}finally{await browser.close()}
