import {chromium,expect} from '@playwright/test'
import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
const out=process.env.YERAN_TEST_OUT||'.oil-ui/yeran-24/equals'
await mkdir(out,{recursive:true})
const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}}),results=[],errors=[]
page.on('pageerror',e=>errors.push(e.stack||e.message))
const raw=()=>page.evaluate(()=>window.__yeran.getMarkdown())
const text=()=>page.evaluate(()=>window.__yeran.editor.state.doc.textContent)
const reset=(content='',path=null)=>page.evaluate(async({content,path})=>{window.__yeran.viewMode.value='continuous';await window.__yeran.replaceDocument(content,path,null,false)},{content,path})
const test=async(name,run)=>{await run();results.push(name);console.log('PASS '+name)}
try{
 await page.goto(process.env.YERAN_TEST_URL||'http://127.0.0.1:15524');await page.waitForFunction(()=>window.__yeran)
 await test('one equals keystroke inserts exactly one character at a blank line or inside prose',async()=>{
  for(const prefix of ['', 'x', 'Total ', '总计']){await reset();await page.keyboard.type(prefix+'=');assert.equal(await text(),prefix+'=')}
  await page.keyboard.press('Backspace');assert.equal(await text(),'总计')
 })
 await test('assignment, comparison and URL query operators preserve their exact character counts',async()=>{
  for(const input of ['x = 1','a==b','a===b','a != b','a <= b','https://example.com/?a=1&b=2']){await reset();await page.keyboard.type(input);assert.equal(await text(),input)}
 })
 await test('typing equals over a selection replaces it once instead of surrounding it with markers',async()=>{
  await reset('Replace this');await page.evaluate(()=>window.__yeran.editor.commands.setTextSelection({from:1,to:8}));await page.keyboard.type('=');assert.equal(await text(),'= this')
  await page.keyboard.press('Control+z');assert.equal(await text(),'Replace this')
 })
 await test('two opening equals signs stay literal until complete highlight markup is typed',async()=>{
  await reset();await page.keyboard.type('==');assert.equal(await text(),'==');await expect(page.locator('.paper-editor mark')).toHaveCount(0)
  await page.keyboard.type('Important==');await expect(page.locator('.paper-editor mark')).toHaveText('Important');assert.equal(await raw(),'==Important==')
  await page.keyboard.type(' next');await expect(page.locator('.paper-editor mark')).toHaveText('Important');assert.equal(await text(),'Important next')
 })
 await test('highlight Markdown still reopens and pastes as formatted text',async()=>{
  await reset('==Important==');await expect(page.locator('.paper-editor mark')).toHaveText('Important');assert.equal(await raw(),'==Important==')
  await reset();await page.evaluate(()=>{const data=new DataTransfer();data.setData('text/plain','==Pasted highlight==');window.__yeran.editor.view.dom.dispatchEvent(new ClipboardEvent('paste',{clipboardData:data,bubbles:true,cancelable:true}))})
  await expect(page.locator('.paper-editor mark')).toHaveText('Pasted highlight')
 })
 await test('inline code and code blocks keep literal equals signs and highlight delimiters',async()=>{
  await reset();await page.keyboard.type('`x = 1`');await expect(page.locator('.paper-editor p code')).toHaveText('x = 1')
  await reset('```python\nplaceholder\n```');await page.locator('.code-block code').click();await page.keyboard.press('Control+a');await page.keyboard.type('x = 1\na == b\n==literal==');await expect(page.locator('.code-block code')).toHaveText('x = 1\na == b\n==literal==')
  await expect(page.locator('.paper-editor mark')).toHaveCount(0)
 })
 await test('table cells and plain-text documents insert single equals signs without altering their text',async()=>{
  await reset('| A | B |\n| --- | --- |\n| | |');await page.locator('.paged-table td').first().click();await page.keyboard.type('x = 1');await expect(page.locator('.paged-table td').first()).toHaveText('x = 1')
  await reset('','literal.txt');await page.keyboard.type('x = 1 ==literal==');assert.equal(await raw(),'x = 1 ==literal==');await expect(page.locator('.paper-editor mark')).toHaveCount(0)
 })
 await test('bracket pairing remains enabled while disabled auto-pair also keeps equals literal',async()=>{
  await reset();await page.keyboard.type('(');assert.equal(await text(),'()');await page.keyboard.press('Backspace');assert.equal(await text(),'')
  await page.getByRole('button',{name:'写作模式',exact:true}).click();await page.getByRole('menuitemcheckbox',{name:/自动配对/}).click();await page.keyboard.press('Escape')
  await reset();await page.keyboard.type('=(');assert.equal(await text(),'=(')
 })
 assert.deepEqual(errors,[]);await writeFile(out+'/verification.json',JSON.stringify({passed:results.length,results,errors},null,2))
}catch(error){await page.screenshot({path:out+'/failure.png'}).catch(()=>{});await writeFile(out+'/failure.json',JSON.stringify({error:String(error),results,errors},null,2));throw error}
finally{await browser.close()}
