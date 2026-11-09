import {chromium} from '@playwright/test'
import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
const out='.oil-ui/yeran-23';await mkdir(out,{recursive:true})
const browser=await chromium.launch({channel:'msedge',headless:true}),results=[],errors=[]
let page,cdp
const settle=()=>page.waitForTimeout(150)
const test=async(name,fn)=>{if(process.env.YERAN_TEST_ONLY&&!name.includes(process.env.YERAN_TEST_ONLY))return;await setup();try{await fn();results.push(name);console.log('PASS '+name)}catch(error){await page.screenshot({path:out+'/failure.png'});await writeFile(out+'/failure.json',JSON.stringify(await page.evaluate(()=>({doc:window.__yeran.editor.getJSON(),file:window.__file,events:window.__imeEvents})),null,2));throw error}finally{await page.close()}}
async function setup(name='writing.md',source='# Seed\n\nBefore '){
 page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.stack));cdp=await page.context().newCDPSession(page)
 await page.addInitScript(()=>{localStorage.setItem('yeran.auto-save.v1','true');window.__file={name:'writing.md',body:'# Seed\n\nBefore ',stamp:1000,writes:[],aborts:0,attempts:0,hold:'',stage:''};const f=window.__file
  const pause=async stage=>{if(f.hold===stage){f.stage=stage;await new Promise(resolve=>f.release=()=>{f.hold='';f.stage='';resolve()})}}
  f.handle={kind:'file',get name(){return f.name},queryPermission:async()=>{await pause('permission');return 'granted'},getFile:async()=>{await pause('get');return new File([f.body],f.name,{lastModified:f.stamp})},createWritable:async()=>{f.attempts++;await pause('create');let body;return{write:async data=>{body=typeof data==='string'?data:await new Blob([data]).text();await pause('write')},close:async()=>{await pause('close');f.body=body;f.stamp++;f.writes.push(body)},abort:async()=>{f.aborts++}}}}
  window.showOpenFilePicker=async()=>[f.handle];window.showSaveFilePicker=async()=>{throw Error('Autosave opened a picker')}
 })
 await page.goto(process.env.YERAN_TEST_URL||'http://127.0.0.1:15520');await page.waitForFunction(()=>window.__yeran)
 await page.evaluate(({name,source})=>{window.__file.name=name;window.__file.body=source},{name,source});await page.getByRole('button',{name:'打开 Markdown',exact:true}).click();await page.waitForFunction(name=>document.querySelector('.document-tab.active')?.title===name,name)
 await page.locator('.paper-editor').focus();await page.keyboard.press('Control+End');await settle()
 await page.evaluate(()=>{window.__originalEditor=window.__yeran.editor.view.dom;window.__imeEvents=[];for(const name of ['compositionstart','compositionupdate','compositionend','blur'])window.__originalEditor.addEventListener(name,e=>window.__imeEvents.push({type:e.type,data:e.data}));window.__draftBefore=localStorage.getItem('yeran.session.v3')})
}
async function ime(text){await cdp.send('Input.imeSetComposition',{text,selectionStart:text.length,selectionEnd:text.length});await settle()}
async function commit(text='中文'){await cdp.send('Input.insertText',{text});await settle()}
async function viewGap(on=true){await page.evaluate(on=>{const view=window.__yeran.editor.view;if(on)Object.defineProperty(view,'composing',{configurable:true,get:()=>false});else delete view.composing},on)}
const file=()=>page.evaluate(()=>({body:window.__file.body,writes:window.__file.writes,aborts:window.__file.aborts,attempts:window.__file.attempts})),raw=()=>page.evaluate(()=>window.__yeran.getMarkdown())
const saved=()=>page.waitForFunction(()=>window.__file.body.includes('中文')&&!document.querySelector('.document-tab.active .tab-dirty'))
async function noPinyin(){const f=await file();assert.ok(f.writes.every(text=>!text.includes('zhongwen')));assert.ok(!(await page.evaluate(()=>localStorage.getItem('yeran.session.v3'))).includes('zhongwen'));assert.equal(await page.evaluate(()=>window.__originalEditor===window.__yeran.editor.view.dom),true)}
try{
 await test('real browser IME pauses file autosave, recovery and history until Chinese candidates are committed',async()=>{
  await ime('zhongwen');assert.match(await raw(),/zhongwen/);await page.waitForTimeout(3300);await page.evaluate(async()=>{window.__yeran.flushDraft();await window.__yeran.checkpoint('IME forced check',true);document.dispatchEvent(new Event('visibilitychange'))});assert.equal((await file()).writes.length,0);assert.equal(await page.evaluate(()=>localStorage.getItem('yeran.session.v3')),await page.evaluate(()=>window.__draftBefore));await page.screenshot({path:out+'/ime-pending.png'});await commit();await saved();await noPinyin();await page.waitForFunction(()=>localStorage.getItem('yeran.session.v3')?.includes('中文'));const versions=await page.evaluate(async()=>{const {listHistory,readHistory}=await import('/src/history.ts');return Promise.all((await listHistory(['writing.md'])).map(readHistory))});assert.ok(versions.every(text=>!text.includes('zhongwen')));assert.ok(versions.some(text=>text.includes('中文')))
 })
 await test('independent composition tracking survives view.composing becoming false while the candidate window remains open',async()=>{
  await ime('zhongwen');await viewGap();await page.evaluate(()=>document.querySelector('.paper-editor').dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertCompositionText',data:'zhongwen',isComposing:false})));await page.waitForTimeout(3300);assert.equal((await file()).writes.length,0);await noPinyin();await viewGap(false);await commit();await saved();await noPinyin()
 })
 await test('composition starting during asynchronous permission checks cancels that autosave round without blocking future saves',async()=>{
  await page.keyboard.type('ready ');await page.evaluate(()=>window.__file.hold='permission');await page.waitForFunction(()=>window.__file.stage==='permission');await ime('zhongwen');await viewGap();await page.evaluate(()=>window.__file.release());await page.waitForTimeout(2200);assert.equal((await file()).attempts,0);await viewGap(false);await commit();await saved();await noPinyin();assert.equal(await page.getByRole('alert').count(),0)
 })
 await test('composition starting while a writable stream is opening aborts it instead of committing stale input',async()=>{
  await page.keyboard.type('ready ');await page.evaluate(()=>window.__file.hold='create');await page.waitForFunction(()=>window.__file.stage==='create');await ime('zhongwen');await page.evaluate(()=>window.__file.release());await page.waitForFunction(()=>window.__file.aborts===1);assert.equal((await file()).writes.length,0);await commit();await saved();await noPinyin()
 })
 await test('composition starting during stream.write aborts the temporary write and keeps the original file intact',async()=>{
  const initial=(await file()).body;await page.keyboard.type('ready ');await page.evaluate(()=>window.__file.hold='write');await page.waitForFunction(()=>window.__file.stage==='write');await ime('zhongwen');await page.evaluate(()=>window.__file.release());await page.waitForFunction(()=>window.__file.aborts===1);assert.equal((await file()).body,initial);await commit();await saved();await noPinyin()
 })
 await test('an already committed stable snapshot never clears newer IME edits or moves the composition caret',async()=>{
  await page.keyboard.type('ready ');await page.evaluate(()=>window.__file.hold='close');await page.waitForFunction(()=>window.__file.stage==='close');await ime('zhongwen');const ends=await page.evaluate(()=>window.__imeEvents.filter(e=>e.type==='compositionend').length);await page.evaluate(()=>window.__file.release());await page.waitForFunction(()=>window.__file.writes.length===1);await settle();assert.ok(!((await file()).body).includes('zhongwen'));assert.match(await raw(),/zhongwen/);assert.equal(await page.evaluate(()=>window.__imeEvents.filter(e=>e.type==='compositionend').length),ends);assert.equal(await page.locator('.document-tab.active .tab-dirty').count(),1);await commit();await saved();await noPinyin()
 })
 await test('the compositionend-to-final-input gap cannot write the intermediate Latin text',async()=>{
  await ime('zhongwen');await page.evaluate(()=>document.querySelector('.paper-editor').dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:'中文'})));await viewGap();await page.waitForTimeout(40);await page.evaluate(()=>window.__yeran.flushDraft());assert.equal((await file()).writes.length,0);await noPinyin();await viewGap(false);await commit();await saved();await noPinyin()
 })
 await test('keyCode 229 and isComposing input protect IME paths that omit compositionstart',async()=>{
  await page.evaluate(()=>{const e=window.__yeran.editor,dom=e.view.dom;dom.dispatchEvent(new KeyboardEvent('keydown',{key:'Process',keyCode:229,bubbles:true}));e.commands.insertContent('zhongwen');dom.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertCompositionText',data:'zhongwen',isComposing:true}))});await page.waitForTimeout(3300);assert.equal((await file()).writes.length,0);await noPinyin();await page.evaluate(()=>{const e=window.__yeran.editor;let at;e.state.doc.descendants((n,p)=>{if(n.isText&&n.text.includes('zhongwen'))at=p+n.text.indexOf('zhongwen')});e.commands.insertContentAt({from:at,to:at+8},'中文');e.view.dom.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:'中文'}))});await saved();await noPinyin()
 })
 await test('cancelled composition and blur recover autosave without leaving the editor stuck',async()=>{
  await page.keyboard.type('stable ');await ime('zhongwen');await cdp.send('Input.imeSetComposition',{text:'',selectionStart:0,selectionEnd:0});await page.waitForTimeout(200);await page.getByLabel('界面语言').focus();await page.waitForFunction(()=>window.__file.body.includes('stable '));assert.ok(!((await file()).body).includes('zhongwen'));await page.locator('.paper-editor').focus();await page.keyboard.press('Control+End');await page.keyboard.insertText('中文');await saved();await noPinyin()
 })
 await test('plain-text files keep their CRLF and confirmed Chinese while automatic saving waits for IME',async()=>{
  await page.evaluate(()=>{const f=window.__file;f.name='writing.txt';f.body='one\r\ntwo ';f.stamp++;f.handle={...f.handle,name:f.name}});await page.getByRole('button',{name:'打开 Markdown',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.paper-editor').classList.contains('plain-editor'));await page.locator('.paper-editor').focus();await page.keyboard.press('Control+End');await ime('zhongwen');await page.waitForTimeout(3300);assert.equal((await file()).writes.length,0);await commit();await saved();assert.equal((await file()).body,'one\r\ntwo 中文');await noPinyin()
 })
 assert.deepEqual(errors,[]);await writeFile(out+'/verification.json',JSON.stringify({passed:results.length,results,errors},null,2))
}catch(error){console.error(error);if(page&&!page.isClosed()){await page.screenshot({path:out+'/failure.png'}).catch(()=>{});await writeFile(out+'/failure.json',JSON.stringify(await page.evaluate(()=>({doc:window.__yeran.editor.getJSON(),file:window.__file,events:window.__imeEvents})),null,2)).catch(()=>{})}throw error}finally{await browser.close()}
