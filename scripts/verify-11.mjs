import { chromium } from '@playwright/test'
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
const out='.oil-ui/yeran-11';await mkdir(out,{recursive:true})
const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000},colorScheme:'light'}),results=[],errors=[]
page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());page.setDefaultTimeout(12000)
const test=async(name,fn)=>{await fn();results.push(name);console.log('PASS '+name)}
const settle=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))
const raw=()=>page.evaluate(()=>window.__yeran.getMarkdown())
const reset=(text,name=null)=>page.evaluate(({text,name})=>window.__yeran.replaceDocument(text,name,null,false),{text,name})
const mode=async value=>{await page.evaluate(v=>window.__yeran.viewMode.value=v,value);await settle()}
const state=()=>page.evaluate(()=>{const e=window.__yeran.editor;return{from:e.state.selection.from,to:e.state.selection.to,parent:e.state.selection.$from.parent.textContent,table:e.isActive('table')}})
const table='| A | B | C |\n| --- | --- | --- |\n| abc | def | ghi |\n| jkl | mno | pqr |\n\nafter'
try{
 await page.goto(process.env.YERAN_TEST_URL||'http://127.0.0.1:15420');await page.waitForFunction(()=>window.__yeran)
 await test('Backspace at paragraph ends deletes one character without crossing a paragraph, in both layouts',async()=>{
  for(const m of ['pages','continuous'])for(const word of ['abcdef','中文测试','value)']){
   await reset('first\n\n'+word+'\n\nlast');await mode(m);await page.locator('.paper-editor p').nth(1).click();await page.keyboard.press('End');await settle();const before=await state()
   await page.keyboard.press('Backspace');await settle();assert.equal((await state()).from,before.from-1);assert.equal((await state()).parent,word.slice(0,-1));assert.equal(await raw(),'first\n\n'+word.slice(0,-1)+'\n\nlast');await page.keyboard.press('Control+z');assert.equal((await state()).parent,word)
  }
 })
 await test('Backspace in table cells and at document end preserves neighboring content and boundaries',async()=>{
  await reset(table);await mode('pages');for(const index of [0,2,5]){const cell=page.locator('.paper-editor td').nth(index),original=await cell.innerText();await cell.click();await page.keyboard.press('End');await settle();const before=await state();await page.keyboard.press('Backspace');await settle();assert.equal((await state()).from,before.from-1);assert.equal((await state()).parent,original.slice(0,-1));assert.equal(await page.locator('.paper-editor td').count(),6);await page.keyboard.press('Control+z')}
  await reset('last');await page.locator('.paper-editor p').click();await page.keyboard.press('End');await settle();await page.keyboard.press('Backspace');await settle();assert.equal(await raw(),'las')
 })
 await test('paired Backspace still removes a real empty pair and plain text remains literal',async()=>{
  await reset('()');await page.evaluate(()=>window.__yeran.editor.chain().focus().setTextSelection(2).run());await page.keyboard.press('Backspace');assert.equal(await raw(),'')
  await reset('first\r\nabcdef\nlast','text.txt');await page.locator('.plain-line').nth(1).click();await page.keyboard.press('End');await settle();await page.keyboard.press('Backspace');await settle();assert.equal(await raw(),'first\r\nabcde\nlast')
 })
 await test('row/column plus buttons remain hit-testable across the outer edge and focus the inserted cells',async()=>{
  for(const axis of ['column','row']){
   await reset(table);await mode('continuous');const cell=page.locator('.paper-editor td').nth(axis==='row'?5:1);await cell.hover();await settle();const plus=page.locator('.table-add-'+axis),before=await plus.boundingBox(),content=await raw()
   await page.mouse.move(before.x+before.width/2,before.y+before.height/2,{steps:16});await page.waitForTimeout(350);const after=await plus.boundingBox();assert.ok(Math.abs(after.x-before.x)<1&&Math.abs(after.y-before.y)<1)
   assert.equal(await plus.evaluate(el=>getComputedStyle(el).opacity),'1');assert.equal(await plus.evaluate(el=>{const b=el.getBoundingClientRect();return document.elementFromPoint(b.x+b.width/2,b.y+b.height/2)?.closest('button')===el}),true)
   await page.screenshot({path:out+'/plus-'+axis+'.png'});await page.mouse.down();await page.mouse.up();await settle();assert.equal((await state()).table,true);assert.equal((await state()).parent,'')
   assert.equal(await page.locator('.table-plus>tr').count(),axis==='row'?4:3);assert.equal(await page.locator('.table-plus>tr').first().locator('th').count(),axis==='column'?4:3)
   await page.keyboard.press('Control+z');assert.equal(await raw(),content);await page.keyboard.press('Control+y');assert.equal((await state()).table,true)
  }
 })
 await test('long-table column grips remain visible and selectable without jumping to the first page',async()=>{
  for(const mixed of [false,true]){
   await reset((mixed?'<!-- yeran:pages {"default":"portrait","pages":{"2":"landscape"}} -->\n\n':'')+'| A | B | C |\n| --- | --- | --- |\n'+Array.from({length:40},(_,i)=>`| a${i} | b${i} | c${i} |`).join('\n'));await mode('pages')
   await page.waitForFunction(()=>{const root=document.querySelector('.paper-editor'),row=document.querySelectorAll('.table-plus>tr')[25],signature=[root.offsetHeight,row.getBoundingClientRect().y,document.querySelectorAll('.repeat-header-widget').length].join('/');const old=window.__layoutSample;if(!old||old.signature!==signature){window.__layoutSample={signature,time:performance.now()};return false}return performance.now()-old.time>200})
   const target=page.locator('.table-plus>tr').nth(25).locator('td').nth(1);await target.scrollIntoViewIfNeeded();await target.hover();await settle();const grip=page.locator('.table-column-handle'),box=await grip.boundingBox();assert.ok(box.y>=90&&box.y+box.height<1000)
   const scroll=await page.locator('.canvas').evaluate(el=>el.scrollTop);await page.mouse.move(box.x+box.width/2,box.y+box.height/2,{steps:12});await page.mouse.down();await page.mouse.up();await settle();assert.equal(await page.locator('.selectedCell').count(),41);assert.ok(Math.abs(await page.locator('.canvas').evaluate(el=>el.scrollTop)-scroll)<2);assert.equal(await page.locator('.table-plus>tr').count(),41)
  }
 })
 await test('system is the default theme and follows live OS changes',async()=>{
  assert.equal(await page.evaluate(()=>localStorage.getItem('yeran.theme.v1')),'system');assert.equal(await page.locator('html').getAttribute('data-theme'),'light');await page.emulateMedia({colorScheme:'dark'});await page.waitForFunction(()=>document.documentElement.dataset.theme==='dark');await page.emulateMedia({colorScheme:'light'});await page.waitForFunction(()=>document.documentElement.dataset.theme==='light')
 })
 await test('explicit theme overrides the OS, persists on reload and leaves document/history untouched',async()=>{
  await reset('A paragraph\n\n```python\nprint("hello")\n```\n\n$$\nx^2\n$$\n\n'+table);await mode('pages');const before=await raw();await page.getByRole('button',{name:'页面设置',exact:true}).click();await page.getByLabel('外观主题',{exact:true}).selectOption('dark');await page.emulateMedia({colorScheme:'light'});assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');assert.equal(await raw(),before);assert.equal(await page.evaluate(()=>window.__yeran.tabs.value.find(t=>t.id===window.__yeran.activeId.value).dirty),false)
  await page.screenshot({path:out+'/theme-dark-settings.png'});await page.reload();await page.waitForFunction(()=>window.__yeran);assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');assert.equal(await raw(),before)
  await page.getByRole('button',{name:'页面设置',exact:true}).click();assert.equal(await page.getByLabel('外观主题',{exact:true}).inputValue(),'dark');await page.getByLabel('外观主题',{exact:true}).selectOption('light');await page.emulateMedia({colorScheme:'dark'});assert.equal(await page.locator('html').getAttribute('data-theme'),'light')
 })
 await test('dark pages, continuous paper and menus are dark while exported PDF stays light',async()=>{
  await page.getByLabel('外观主题',{exact:true}).selectOption('dark');await page.getByRole('button',{name:'关闭页面设置',exact:true}).click();const before=await raw();await mode('continuous');assert.equal(await page.locator('.paper-editor').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(36, 40, 48)');await page.screenshot({path:out+'/theme-dark-continuous.png'});const html=await page.evaluate(()=>window.__yeran.createPrintHtml()),print=await browser.newPage({colorScheme:'dark'});await print.setContent(html);assert.equal(await print.locator('.paper-editor').first().evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(255, 255, 255)');assert.equal(await print.locator('html').getAttribute('data-theme'),null);await print.pdf({path:out+'/dark-session-light-output.pdf',printBackground:true,preferCSSPageSize:true});await print.close();assert.equal(await raw(),before)
 })
 await test('theme choice translates in English and Traditional Chinese at a small viewport',async()=>{
  await page.setViewportSize({width:960,height:720});await page.getByLabel('界面语言').selectOption('en');await page.getByRole('button',{name:'Page settings',exact:true}).click();assert.equal(await page.getByLabel('Appearance').locator('option').allTextContents().then(a=>a.join('|')),'System (default)|Light|Dark');await page.screenshot({path:out+'/theme-dark-small-en.png'});await page.getByLabel('Interface language').selectOption('zh-TW');assert.equal(await page.getByLabel('外觀主題').inputValue(),'dark');await page.getByLabel('外觀主題').selectOption('system');await page.emulateMedia({colorScheme:'light'});await page.waitForFunction(()=>document.documentElement.dataset.theme==='light');assert.equal(await page.locator('body').evaluate(el=>el.scrollWidth>innerWidth),false);await page.screenshot({path:out+'/theme-light-small.png'})
 })
 assert.deepEqual(errors,[]);await writeFile(out+'/verification.json',JSON.stringify({passed:results.length,results,errors},null,2))
}catch(error){console.error('FAIL',error);await page.screenshot({path:out+'/failure.png',timeout:3000}).catch(()=>{});throw error}finally{await browser.close()}
