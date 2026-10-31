import {chromium} from '@playwright/test'
import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
const out='.oil-ui/yeran-07';await mkdir(out,{recursive:true})
const browser=await chromium.launch({channel:'msedge',headless:true}),context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),results=[],errors=[]
page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept())
const test=async(name,run)=>{await run();results.push(name);console.log('PASS '+name)}
const reset=md=>page.evaluate(md=>window.__yeran.replaceDocument(md,null,null),md)
const markdown=()=>page.evaluate(()=>window.__yeran.getMarkdown())
const preferences=()=>page.evaluate(()=>({...window.__yeran.editor.storage.writingModes}))
const offset=()=>page.evaluate(()=>{const v=window.__yeran.editor.view,r=v.coordsAtPos(v.state.selection.head),c=document.querySelector('.canvas');return(r.top+r.bottom)/2-c.getBoundingClientRect().top-c.clientHeight/2})
const centered=()=>page.waitForFunction(()=>{const v=window.__yeran.editor.view,r=v.coordsAtPos(v.state.selection.head),c=document.querySelector('.canvas');return Math.abs((r.top+r.bottom)/2-c.getBoundingClientRect().top-c.clientHeight/2)<5})
try{
await page.goto(process.env.YERAN_TEST_URL||'http://127.0.0.1:1420');await page.waitForFunction(()=>window.__yeran)
await test('focus menu and F8 change only the view; selection and undo remain intact',async()=>{
 await reset('# FocusTitle\n\nActive paragraph\n\nOther paragraph\n\nLast paragraph');const before=await markdown();await page.evaluate(()=>window.__yeran.editor.commands.setTextSelection(15));const selection=await page.evaluate(()=>window.__yeran.editor.state.selection.toJSON());await page.getByRole('button',{name:'写作模式',exact:true}).click();await page.getByRole('menuitemcheckbox',{name:/专注模式/}).click();assert.equal((await preferences()).focus,true);assert.equal(await page.locator('.paper-editor>.writing-muted').count(),3);assert.deepEqual(await page.evaluate(()=>window.__yeran.editor.state.selection.toJSON()),selection);assert.equal(await markdown(),before);await page.keyboard.press('Escape');await page.keyboard.type('UndoToken');await page.keyboard.press('Control+z');assert.equal(await markdown(),before);await page.keyboard.press('F8');assert.equal((await preferences()).focus,false);assert.equal(await page.locator('.writing-muted').count(),0)
})
await test('focus follows paragraphs while keeping entire tables and nested blocks readable',async()=>{
 await reset('# Title\n\nOutside\n\n| A | B |\n| --- | --- |\n| One | Two |\n\n> [!TIP]\n> Nested content');await page.keyboard.press('F8');await page.locator('.paper-editor td').first().click();assert.equal(await page.locator('.paper-editor .paged-table').evaluate(e=>e.closest('.writing-muted')!==null),false);await page.locator('.callout p').click();assert.equal(await page.locator('.callout').evaluate(e=>e.classList.contains('writing-muted')),false);await page.keyboard.press('F8')
})
await test('typewriter centers the first and last line in continuous mode',async()=>{
 await reset(Array.from({length:50},(_,i)=>`Paragraph ${i}: continuous writing.`).join('\n\n'));await page.getByRole('button',{name:'连续模式',exact:true}).click();await page.locator('.paper-editor').focus();await page.keyboard.press('Control+Home');await page.keyboard.press('F9');await centered();await page.keyboard.press('Control+End');await page.keyboard.type('LastTypedToken');await centered();assert.match(await markdown(),/LastTypedToken/);await page.screenshot({path:out+'/typewriter-continuous.png'})
})
await test('typewriter allows manual scrolling and does not fight selected text or IME composition',async()=>{
 await page.locator('.canvas').evaluate(e=>e.scrollTop-=200);const scroll=await page.locator('.canvas').evaluate(e=>e.scrollTop);await page.waitForTimeout(150);assert.equal(await page.locator('.canvas').evaluate(e=>e.scrollTop),scroll);await page.evaluate(()=>window.__yeran.editor.commands.setTextSelection({from:1,to:30}));await page.waitForTimeout(100);assert.equal(await page.locator('.canvas').evaluate(e=>e.scrollTop),scroll);await page.evaluate(()=>{const e=window.__yeran.editor; e.view.dom.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true,data:''}));e.commands.setTextSelection(e.state.doc.content.size-1)});await page.waitForTimeout(100);assert.equal(await page.locator('.canvas').evaluate(e=>e.scrollTop),scroll);await page.locator('.paper-editor').dispatchEvent('compositionend',{data:'中文'});await centered()
})
await test('both modes work on mixed A4 pages and resizing without changing Markdown',async()=>{
 await page.keyboard.press('F9');await reset('<!-- yeran:pages {"default":"portrait","pages":{"2":"landscape"}} -->\n\n# Mixed\n\n'+Array.from({length:80},(_,i)=>`MixedLine${i} `+'Writing text. '.repeat(10)).join('\n\n'));await page.getByRole('button',{name:'连续模式',exact:true}).click();await page.keyboard.press('F8');await page.keyboard.press('F9');await page.keyboard.press('Control+End');await centered();const before=await markdown();await page.setViewportSize({width:960,height:720});await centered();assert.equal(await markdown(),before);assert.ok(await page.locator('.mixed-pagination').count());await page.screenshot({path:out+'/writing-960.png'})
})
await test('printed pages are fully readable and never include focus dimming or typewriter spacing',async()=>{
 const before=await markdown();const html=await page.evaluate(()=>window.__yeran.createPrintHtml());await writeFile(out+'/writing-print.html',html);const print=await page.context().newPage();await print.setContent(html);await print.evaluate(()=>document.fonts.ready);assert.equal(await print.locator('.writing-muted,.typewriter-writing,.focus-writing').count(),0);assert.deepEqual(await print.locator('.pdf-sheet').evaluateAll(es=>es.slice(0,2).map(e=>[e.offsetWidth,e.offsetHeight])),[[794,1123],[1123,794]]);await print.close();assert.deepEqual(await preferences(),{focus:true,typewriter:true});assert.equal(await markdown(),before)
})
await test('writing preferences survive reload and translate into English and Traditional Chinese',async()=>{
 await page.reload();await page.waitForFunction(()=>window.__yeran);assert.deepEqual(await preferences(),{focus:true,typewriter:true});await page.getByLabel('界面语言').selectOption('en');await page.getByRole('button',{name:'Writing modes',exact:true}).click();await page.getByRole('menuitemcheckbox',{name:/Focus mode/}).waitFor();await page.getByLabel('Interface language').selectOption('zh-TW');await page.getByRole('menuitemcheckbox',{name:/專注模式/}).waitFor();await page.keyboard.press('Escape');assert.equal(await page.locator('body').evaluate(e=>e.scrollWidth>innerWidth),false)
})
assert.deepEqual(errors,[]);await writeFile(out+'/verification.json',JSON.stringify({passed:results.length,results,errors},null,2))
}catch(error){console.log('Writing diagnostics',await page.evaluate(()=>{const e=window.__yeran.editor,v=e.view,r=v.coordsAtPos(v.state.selection.head),c=document.querySelector('.canvas');return{caret:r,canvas:c.getBoundingClientRect().toJSON(),scroll:c.scrollTop,max:c.scrollHeight-c.clientHeight,focus:v.hasFocus(),modes:e.storage.writingModes}}));await page.screenshot({path:out+'/failure.png'});throw error}finally{await browser.close()}
