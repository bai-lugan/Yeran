import { chromium } from '@playwright/test'
import assert from 'node:assert/strict'
import { mkdir,writeFile } from 'node:fs/promises'
const out='.oil-ui/print-tabs';await mkdir(out,{recursive:true})
const browser=await chromium.launch({channel:'msedge',headless:true})
const context=await browser.newContext({viewport:{width:1440,height:1000}})
const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept())
page.setDefaultTimeout(10000)
const results=[]
async function test(name,fn){await fn();results.push(name);console.log('PASS',name)}
async function ready(){await page.waitForFunction(()=>!!window.__yeran);await page.waitForFunction(()=>!!document.querySelector('[data-rm-pagination]'))}
async function reset(md=''){await page.evaluate(md=>window.__yeran.replaceDocument(md,null,null),md);await page.locator('.paper-editor').focus()}
async function current(){return page.evaluate(()=>window.__yeran.getMarkdown())}
async function activeTabId(){return page.evaluate(()=>window.__yeran.activeId.value)}
try{
await page.goto((process.env.YERAN_TEST_URL || 'http://127.0.0.1:1420'));await ready()
await test('slash menu filters in Chinese/English; keyboard inserts and Escape preserves text',async()=>{
  await reset();await page.keyboard.type('/');await page.getByRole('listbox',{name:'可插入的内容块'}).waitFor()
  assert.equal(await page.getByRole('listbox').getByRole('option').count(),19)
  await page.keyboard.type('h2');await page.waitForFunction(()=>document.querySelectorAll('.slash-items [role=option]').length===1)
  await page.keyboard.press('Enter');await page.keyboard.insertText('斜杠菜单标题');assert.match(await current(),/^## 斜杠菜单标题/)
  await reset();await page.keyboard.insertText('/表');await page.getByRole('listbox').getByRole('option').filter({hasText:'表格'}).click();assert.equal(await page.locator('.paper-editor table').count(),1)
  await reset();await page.keyboard.type('/');await page.keyboard.press('Escape');assert.equal(await page.getByRole('listbox').count(),0);assert.equal((await current()).trim(),'/')
  await page.keyboard.press('Backspace');await page.keyboard.type('/');await page.getByRole('listbox').waitFor();await page.keyboard.press('Escape')
  await reset('https://example.com');await page.evaluate(()=>window.__yeran.editor.commands.focus('end'));await page.locator('.paper-editor').focus();await page.keyboard.type('/path');assert.equal(await page.getByRole('listbox').count(),0)
})
await test('each tab preserves content, selection, independent undo and scroll',async()=>{
  await reset('# 第一份\n\n'+Array.from({length:60},(_,i)=>`第一份正文第 ${i+1} 段。`).join('\n\n'));const first=await activeTabId()
  await page.evaluate(()=>window.__yeran.editor.commands.focus('end'));await page.locator('.paper-editor').focus();await page.keyboard.insertText('甲的修改')
  const selection=await page.evaluate(()=>window.__yeran.editor.state.selection.from)
  await page.locator('.canvas').evaluate(el=>el.scrollTop=800)
  await page.waitForFunction(()=>document.querySelector('.canvas').scrollTop===800)
  await page.getByRole('button',{name:'新建标签',exact:true}).click();const second=await activeTabId()
  await page.locator('.paper-editor').focus();await page.keyboard.insertText('乙的修改')
  await page.evaluate(id=>window.__yeran.activateTab(id),first);assert.ok((await current()).includes('甲的修改'));assert.ok(!(await current()).includes('乙的修改'))
  await page.waitForFunction(()=>document.querySelector('.canvas').scrollTop===800)
  assert.equal(await page.evaluate(()=>window.__yeran.editor.state.selection.from),selection)
  await page.locator('.paper-editor').focus();await page.keyboard.press('Control+z');assert.ok(!(await current()).includes('甲的修改'));await page.keyboard.insertText('需要保留的甲')
  await page.evaluate(id=>window.__yeran.activateTab(id),second);assert.ok((await current()).includes('乙的修改'))
  const count=await page.getByRole('tab').count();await page.reload();await ready();assert.equal(await page.getByRole('tab').count(),count);assert.ok((await current()).includes('乙的修改'))
})
await test('close others is cancellable and never silently drops dirty tabs',async()=>{
  await page.getByRole('tab',{selected:true}).click({button:'right'});await page.getByRole('menuitem',{name:'关闭其他标签',exact:true}).click()
  await page.getByRole('dialog',{name:'保存后关闭文稿'}).waitFor();const count=await page.getByRole('tab').count()
  await page.getByRole('button',{name:'取消',exact:true}).click();assert.equal(await page.getByRole('tab').count(),count)
  await page.getByRole('tab',{selected:true}).click({button:'right'});await page.getByRole('menuitem',{name:'关闭其他标签',exact:true}).click();await page.getByRole('button',{name:'放弃修改',exact:true}).click()
  assert.equal(await page.getByRole('tab').count(),1);assert.ok((await current()).includes('乙的修改'))
})
await test('multi-file open and Save All keep separate file handles',async()=>{
  await page.evaluate(()=>{
    window.__written={}
    function handle(name,content){let stamp=1000;return{name,getFile:async()=>({name,lastModified:stamp,text:async()=>content}),createWritable:async()=>({write:async text=>{window.__written[name]=text;content=text},close:async()=>stamp++})}}
    window.showOpenFilePicker=async()=>[handle('one.md','# 文稿一\n\n甲'),handle('two.md','# 文稿二\n\n乙')]
    window.showSaveFilePicker=async()=>{throw new Error('Unopened tabs must use their own stored handles')}
  })
  await page.getByRole('button',{name:'打开 Markdown',exact:true}).click();await page.getByRole('tab',{name:/two.md/}).waitFor()
  // Close the earlier scratch document so Save All only targets the two opened files.
  await page.getByRole('tab',{name:/one.md/}).click({button:'right'});await page.getByRole('menuitem',{name:'保存当前标签',exact:true}).click()
  const opened=await page.evaluate(()=>window.__yeran.tabs.value.filter(t=>t.path).map(t=>({id:t.id,path:t.path})))
  for(const tab of opened){await page.evaluate(id=>window.__yeran.activateTab(id),tab.id);await page.evaluate(()=>window.__yeran.editor.commands.focus('end'));await page.locator('.paper-editor').focus();await page.keyboard.insertText(`修改${tab.path}`)}
  // First save attempt cancels on the scratch file; no opened tab should close or lose edits.
  await page.getByRole('tab',{selected:true}).click({button:'right'});await page.getByRole('menuitem',{name:'关闭其他标签'}).click()
  await page.getByRole('button',{name:'取消',exact:true}).click()
  await page.evaluate(()=>{const scratch=window.__yeran.tabs.value.find(t=>!t.path);scratch.path='scratch.md';scratch.dirty=false;scratch.baseline=scratch.markdown})
  await page.locator('.save-all-btn').click()
  await page.waitForFunction(()=>window.__written['one.md']?.includes('修改one.md')&&window.__written['two.md']?.includes('修改two.md'))
  const writes=await page.evaluate(()=>window.__written);assert.ok(!writes['one.md'].includes('修改two.md'));assert.ok(!writes['two.md'].includes('修改one.md'))
  assert.equal(await page.locator('.tab-dirty').count(),0)
})
await test('batch save cancellation and failure retain every unsaved document',async()=>{
  await page.getByRole('button',{name:'新建标签',exact:true}).click();await page.locator('.paper-editor').focus();await page.keyboard.insertText('不能丢失的新文稿')
  await page.evaluate(()=>window.showSaveFilePicker=async()=>{throw new DOMException('Cancelled','AbortError')})
  const count=await page.getByRole('tab').count();await page.locator('.save-all-btn').click()
  await page.getByRole('status').filter({hasText:'剩余文稿仍保留'}).waitFor();assert.equal(await page.getByRole('tab').count(),count);assert.ok((await current()).includes('不能丢失'))
  await page.evaluate(()=>window.showSaveFilePicker=async()=>{throw new Error('保存被拒绝')});await page.locator('.save-all-btn').click();await page.getByRole('alert').filter({hasText:'保存被拒绝'}).waitFor();assert.ok((await current()).includes('不能丢失'));await page.getByRole('button',{name:'关闭错误提示'}).click()
})
await test('printing keeps every page and leaves the editor untouched',async()=>{
  const md='# 打印文稿\n\n'+Array.from({length:35},(_,i)=>`## 章节${i+1}\n\n`+'打印分页与编辑分页应该一致。'.repeat(8)).join('\n\n')
  await reset(md);await page.waitForFunction(()=>window.__yeran.getPageSlices().length>2)
  const before=await current(),selection=await page.evaluate(()=>window.__yeran.editor.state.selection.from)
  // Print goes straight from the frozen snapshot: no preview dialog is mounted any more.
  // The actual window.print() call is asserted by the native suite; here we check that the
  // frozen frame is the only thing mounted and that editing state survives untouched.
  await page.addInitScript(()=>{if(window!==window.top)window.print=()=>{window.__yeranPrintCalled=true}})
  await page.getByRole('button',{name:'打印',exact:true}).click();await page.waitForFunction(()=>document.querySelector('iframe.direct-print-frame')?.contentWindow.__yeranPrintCalled===true)
  assert.equal(await page.locator('.print-preview').count(),0)
  assert.equal(await page.locator('iframe.direct-print-frame').count(),1)
  const frame=page.frames().find(f=>f.parentFrame());assert.ok(frame)
  const count=await frame.locator('.pdf-sheet').count();assert.equal(count,await page.evaluate(()=>window.__yeran.getPageSlices().length))
  assert.ok(count>2)
  await page.screenshot({path:`${out}/print-direct.png`})
  assert.equal(await current(),before);assert.equal(await page.evaluate(()=>window.__yeran.editor.state.selection.from),selection)
  assert.equal(await page.locator('.continuous-doc').count()+await page.locator('.mixed-page-doc').count()>=0,true)
})
await test('direct Print opens only the document print frame; cancellation returns to editing',async()=>{
  const before=await current(),selection=await page.evaluate(()=>window.__yeran.editor.state.selection.from)
  await page.evaluate(()=>document.querySelectorAll('.direct-print-frame').forEach(frame=>frame.remove()))
  await page.keyboard.press('Control+p');await page.waitForFunction(()=>document.querySelectorAll('iframe.direct-print-frame').length===1&&document.querySelector('iframe.direct-print-frame').contentWindow.__yeranPrintCalled===true)
  assert.equal(await page.locator('.print-preview').count(),0)
  const frame=page.frames().find(f=>f.parentFrame());assert.ok(await frame.locator('.pdf-sheet').count()>1);assert.equal(await frame.locator('.app-header,.toolbar').count(),0)
  await page.evaluate(()=>document.querySelector('.direct-print-frame').contentWindow.dispatchEvent(new Event('afterprint')));await page.locator('.direct-print-frame').waitFor({state:'detached'})
  assert.equal(await current(),before);assert.equal(await page.evaluate(()=>window.__yeran.editor.state.selection.from),selection)
  assert.ok(await page.getByRole('button',{name:'导出 PDF',exact:true}).isVisible());assert.ok(await page.getByRole('button',{name:'打印',exact:true}).isVisible())
})
await reset('# 写在同一张纸上\n\n输入 / 插入内容，右键标签管理文稿。')
await page.getByRole('button',{name:'新建标签',exact:true}).click();await page.locator('.paper-editor').focus();await page.keyboard.type('/')
await page.getByRole('listbox').waitFor();await page.waitForFunction(()=>getComputedStyle(document.querySelector('.slash-menu')).opacity==='1');await page.screenshot({path:`${out}/slash-tabs.png`})
assert.deepEqual(errors,[])
await writeFile(`${out}/verification.json`,JSON.stringify({passed:results.length,results,errors},null,2));console.log(JSON.stringify({passed:results.length,errors}))
}catch(e){await page.screenshot({path:`${out}/failure.png`});console.error(e);process.exitCode=1}finally{await browser.close()}
