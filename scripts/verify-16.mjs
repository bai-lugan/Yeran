import {chromium} from '@playwright/test'
import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
const out='.oil-ui/yeran-16';await mkdir(out,{recursive:true})
const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}}),results=[],errors=[];page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message))
const sample='Before\n\n| H1 | H2 | H3 |\n| --- | --- | --- |\n| A1 | A2 | A3 |\n| B1 | B2 | B3 |\n| C1 | C2 | C3 |\n\nAfter'
const settle=async()=>{await page.waitForTimeout(140);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))))}
const reset=async(text=sample)=>{await page.evaluate(text=>window.__yeran.replaceDocument(text,null,null,false),text);await settle()}
const raw=()=>page.evaluate(()=>window.__yeran.getMarkdown())
const dims=()=>page.evaluate(()=>{let result=[0,0];window.__yeran.editor.state.doc.descendants(n=>{if(n.type.name==='table'){result=[n.childCount,n.firstChild.childCount];return false}});return result})
const test=async(name,fn)=>{await fn();results.push(name);console.log('PASS '+name)}
const select=async kind=>{await page.locator('td').filter({hasText:'B2'}).hover();await page.waitForTimeout(100);await page.locator(kind==='table'?'.table-block-handle':'.table-'+kind+'-handle').click();await settle()}
const label=kind=>kind==='table'?'删除表格':kind==='row'?'删除所选行':'删除所选列'
const context=async locator=>{await locator.click({button:'right'});await page.getByRole('menu',{name:'文件夹操作',exact:true}).waitFor()}
try{
 await page.goto(process.env.YERAN_TEST_URL||'http://127.0.0.1:15420');await page.waitForFunction(()=>window.__yeran)
 await test('clicking a table, row or column handle exposes the matching delete button and one undo restores the complete table',async()=>{
  for(const view of ['pages','continuous'])for(const kind of ['table','row','column']){await page.evaluate(v=>window.__yeran.viewMode.value=v,view);await reset();const before=await raw();await select(kind);await page.getByRole('toolbar',{name:'表格编辑'}).getByRole('button',{name:label(kind),exact:true}).click();assert.deepEqual(await dims(),kind==='table'?[0,0]:kind==='row'?[3,3]:[4,2]);assert.match(await raw(),/^Before/);assert.match(await raw(),/After$/);await page.keyboard.press('Control+z');await settle();assert.equal(await raw(),before)}
 })
 await test('Delete and Backspace remove precisely the explicitly selected table axis, preserve surrounding text and support redo',async()=>{
  for(const key of ['Delete','Backspace'])for(const kind of ['table','row','column']){await reset();const before=await raw();await select(kind);await page.keyboard.press(key);await settle();assert.deepEqual(await dims(),kind==='table'?[0,0]:kind==='row'?[3,3]:[4,2]);await page.keyboard.press('Control+z');await settle();assert.equal(await raw(),before);await page.keyboard.press('Control+y');await settle();assert.deepEqual(await dims(),kind==='table'?[0,0]:kind==='row'?[3,3]:[4,2])}
 })
 await test('right-clicking within selected cells retains row, column and whole-table selections for menu deletion',async()=>{
  for(const kind of ['table','row','column']){await reset();await select(kind);await page.locator('td').filter({hasText:'B2'}).click({button:'right'});await page.getByRole('menu',{name:'表格操作',exact:true}).waitFor();await page.getByRole('menuitem',{name:label(kind),exact:true}).click();assert.deepEqual(await dims(),kind==='table'?[0,0]:kind==='row'?[3,3]:[4,2])}
 })
 await test('ordinary cell editing has no structural delete button and deleting the last row or column leaves a usable document',async()=>{
  await reset();await page.locator('td').filter({hasText:'B2'}).click();assert.equal(await page.locator('.table-delete-selection').count(),0);await page.keyboard.press('End');await page.keyboard.press('Backspace');assert.deepEqual(await dims(),[4,3]);assert.match(await raw(),/\|\s*B1\s*\|\s*B\s*\|\s*B3\s*\|/)
  for(const kind of ['row','column']){await reset('Before\n\n| Only |\n| --- |\n\nAfter');await page.locator('th').hover();await page.locator('.table-'+kind+'-handle').click();await page.locator('.table-delete-selection').click();assert.deepEqual(await dims(),[0,0]);await page.keyboard.press('Control+z');await settle();assert.deepEqual(await dims(),[1,1]);assert.match(await raw(),/Before[\s\S]*Only[\s\S]*After/)}
 })
 await test('sidebar Save As targets an inactive unsaved editor, preserves the current editor and keeps cancellation reversible',async()=>{
  await reset('Alpha body');const alpha=await page.evaluate(()=>window.__yeran.activeId.value);await page.keyboard.press('Control+n');await reset('Beta draft');const beta=await page.evaluate(()=>window.__yeran.activeId.value);await page.locator(`[data-editor-id="${alpha}"]`).click();await page.evaluate(()=>{
 window.__saved=[];window.__cancelSave=false
 window.showSaveFilePicker=async()=>{
  if(window.__cancelSave)throw new DOMException('Cancelled','AbortError')
  const name='beta-copy.md'
  return{name,getFile:async()=>new File([''],name,{lastModified:1}),createWritable:async()=>({write:async content=>{window.__saved.push(await new Blob([content]).text())},close:async()=>{}})}
 }
});await context(page.locator(`[data-editor-id="${beta}"]`));await page.getByRole('menuitem',{name:'另存为…',exact:true}).click();await page.waitForFunction(id=>window.__saved.length===1&&window.__yeran.tabs.value.find(t=>t.id===id).path==='beta-copy.md',beta);assert.equal(await page.evaluate(()=>window.__saved[0]),'Beta draft');assert.equal(await page.evaluate(()=>window.__yeran.activeId.value),alpha);assert.equal(await raw(),'Alpha body');assert.equal(await page.evaluate(id=>window.__yeran.tabs.value.find(t=>t.id===id).path,beta),'beta-copy.md');await page.evaluate(()=>window.__cancelSave=true);await context(page.locator(`[data-editor-id="${alpha}"]`));await page.getByRole('menuitem',{name:'另存为…',exact:true}).click();await settle();assert.equal(await page.evaluate(()=>window.__saved.length),1);assert.equal(await raw(),'Alpha body')
 })
 await test('recent files offer Save As through both mouse and keyboard context menus',async()=>{
  await page.getByRole('button',{name:'最近文件',exact:true}).click();const row=page.locator('.recent-file>button').first();await context(row);assert.equal(await page.getByRole('menuitem',{name:'另存为…',exact:true}).count(),1);await page.keyboard.press('Escape');await row.focus();await page.keyboard.press('Shift+F10');await page.getByRole('menu',{name:'文件夹操作',exact:true}).waitFor();await page.getByRole('menuitem',{name:'另存为…',exact:true}).click();await settle();assert.equal(await page.evaluate(()=>window.__saved.length),1);await page.getByRole('button',{name:'文件树',exact:true}).click()
 })
 await test('delete controls translate and remain clickable in a small dark viewport',async()=>{
  await page.setViewportSize({width:960,height:720});await page.emulateMedia({colorScheme:'dark'});await reset();await select('column');await page.getByLabel('界面语言').selectOption('en');await page.getByRole('button',{name:'Delete selected columns',exact:true}).click();assert.deepEqual(await dims(),[4,2]);await page.keyboard.press('Control+z');await settle();await page.getByLabel('Interface language').selectOption('zh-TW');await select('row');assert.equal(await page.getByRole('button',{name:'刪除所選行',exact:true}).count(),1);await page.screenshot({path:out+'/small-dark-delete.png'});assert.deepEqual(errors,[])
 })
 await writeFile(out+'/verification.json',JSON.stringify({passed:results.length,results,errors},null,2))
}catch(error){console.error(error);await page.screenshot({path:out+'/failure.png'}).catch(()=>{});throw error}finally{await browser.close()}
