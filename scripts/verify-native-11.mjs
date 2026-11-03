import {connectNative,nativePage} from './native-test.mjs'
import assert from 'node:assert/strict'
import {mkdir,readFile,writeFile} from 'node:fs/promises'
import path from 'node:path'
const out=path.resolve('.oil-ui/yeran-11/native',String(Date.now()));await mkdir(out,{recursive:true})
const browser=await connectNative(),page=await nativePage(browser),results=[],errors=[];page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message))
const invoke=(cmd,args)=>page.evaluate(({cmd,args})=>window.__TAURI_INTERNALS__.invoke(cmd,args),{cmd,args})
assert.match(await invoke('plugin:app|identifier'),/\.qa$/,'Use the isolated QA app')
const test=async(name,fn)=>{await fn();results.push(name);console.log('PASS '+name)}
const filename=path.join(out,'native.md'),original='First paragraph\n\nabcdef\n\n| A | B | C |\n| --- | --- | --- |\n| abc | def | ghi |\n| jkl | mno | pqr |\n\nAfter table';await writeFile(filename,original)
try{
 await page.evaluate(file=>{const original=window.fetch;window.fetch=(url,options)=>{const cmd=decodeURIComponent(String(url)).split('/').at(-1);if(cmd==='plugin:dialog|open')return Promise.resolve(new Response(JSON.stringify([file]),{headers:{'Content-Type':'application/json','Tauri-Response':'ok'}}));return original(url,options)}},filename)
 await page.keyboard.press('Control+o');await page.waitForFunction(file=>document.querySelector('.document-tab.active')?.getAttribute('title')===file,filename)
 await test('packaged Backspace preserves the paragraph and saves the correct bytes',async()=>{
  await page.locator('.paper-editor>p').nth(1).click();await page.keyboard.press('End');await page.waitForFunction(()=>getSelection()?.anchorOffset===6);await page.keyboard.press('Backspace');await page.waitForFunction(()=>document.querySelectorAll('.paper-editor>p')[1]?.textContent==='abcde');await page.keyboard.press('Control+s');await page.waitForFunction(()=>!document.querySelector('.document-tab.active .tab-dirty'));assert.match(await readFile(filename,'utf8'),/First paragraph\n\nabcde\n{2,}\|/)
 })
 await test('packaged cell deletion keeps neighboring cells and the table structure',async()=>{
  await page.locator('.paper-editor td').first().click();await page.keyboard.press('End');await page.waitForFunction(()=>getSelection()?.anchorOffset===3);await page.keyboard.press('Backspace');await page.waitForFunction(()=>document.querySelector('.paper-editor td')?.textContent==='ab');assert.equal(await page.locator('.paper-editor td').count(),6);assert.equal(await page.locator('.paper-editor td').nth(1).innerText(),'def')
 })
 await test('packaged plus column is clickable after a slow pointer approach and typing stays in its new cell',async()=>{
  await page.locator('.paper-editor td').nth(1).hover();const plus=page.locator('.table-add-column'),box=await plus.boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2,{steps:18});await page.waitForTimeout(350);assert.equal(await plus.evaluate(el=>getComputedStyle(el).opacity),'1');await page.mouse.down();await page.mouse.up();await page.waitForFunction(()=>document.querySelector('.table-plus>tr')?.querySelectorAll('th').length===4);await page.keyboard.type('NEWCOLUMN');assert.equal(await page.locator('.paper-editor td').nth(3).innerText(),'NEWCOLUMN');await page.keyboard.press('Control+s');await page.waitForFunction(()=>!document.querySelector('.document-tab.active .tab-dirty'));assert.match(await readFile(filename,'utf8'),/NEWCOLUMN/)
 })
 await test('packaged dark mode updates native chrome, persists and does not dirty the file',async()=>{
  await page.getByRole('button',{name:'页面设置',exact:true}).click();assert.equal(await page.getByLabel('外观主题').inputValue(),'system');await page.getByLabel('外观主题').selectOption('dark');await page.waitForFunction(()=>document.documentElement.dataset.theme==='dark');assert.equal(await invoke('plugin:window|theme',{label:'main'}),'dark');assert.equal(await page.locator('.tab-dirty').count(),0);await page.screenshot({path:path.join(out,'native-dark.png')});await page.reload();await page.waitForFunction(()=>document.documentElement.dataset.theme==='dark'&&document.querySelector('.paper-editor'));assert.equal(await invoke('plugin:window|theme',{label:'main'}),'dark')
 })
 await test('packaged light and system settings retain the saved document and restore system following',async()=>{
  await page.getByRole('button',{name:'页面设置',exact:true}).click();await page.getByLabel('外观主题').selectOption('light');await page.waitForFunction(()=>document.documentElement.dataset.theme==='light');assert.equal(await invoke('plugin:window|theme',{label:'main'}),'light');await page.getByLabel('外观主题').selectOption('system');await page.waitForFunction(()=>document.documentElement.dataset.theme===(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'));assert.equal(await page.evaluate(()=>localStorage.getItem('yeran.theme.v1')),'system');assert.equal(await page.locator('.tab-dirty').count(),0);assert.match(await readFile(filename,'utf8'),/NEWCOLUMN/)
 })
 assert.deepEqual(errors,[]);await writeFile(path.join(out,'verification.json'),JSON.stringify({passed:results.length,results,errors},null,2))
}catch(error){console.error(error);await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});throw error}finally{await browser.close()}
