import { chromium } from '@playwright/test'
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
const out='.oil-ui/table-edit';await mkdir(out,{recursive:true})
const browser=await chromium.launch({channel:'msedge',headless:true})
const context=await browser.newContext({viewport:{width:1440,height:1000}})
const page=await context.newPage(), errors=[], results=[]
page.setDefaultTimeout(12000);page.on('pageerror',error=>errors.push(error.message));page.on('dialog',dialog=>dialog.accept())
const sample='# 表格编辑\n\n| 名称 | 数量 | 说明 |\n| --- | --- | --- |\n| 苹果 | 10 | 待确认 |\n| 梨 | 20 | 已确认 |\n\n表格后面的正文。'
async function ready(){await page.waitForFunction(()=>!!window.__yeran?.editor?.view?.dom.querySelector('[data-rm-pagination]'))}
async function reset(markdown=sample){await page.evaluate(markdown=>window.__yeran.replaceDocument(markdown,null,null),markdown);await page.locator('.paper-editor table').waitFor();await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))}
async function markdown(){return page.evaluate(()=>window.__yeran.getMarkdown())}
async function paste(text,html=''){await page.locator('.paper-editor').evaluate((el,{text,html})=>{const clipboardData=new DataTransfer();clipboardData.setData('text/plain',text);if(html)clipboardData.setData('text/html',html);el.dispatchEvent(new ClipboardEvent('paste',{bubbles:true,cancelable:true,clipboardData}))},{text,html})}
async function test(name,run){await run();results.push(name);console.log('PASS',name)}
try{
await page.goto((process.env.YERAN_TEST_URL || 'http://127.0.0.1:1420'));await ready()
await test('typing and DOM composition changes survive tab switching and recovery',async()=>{
  await reset();await page.locator('td').first().click();await page.keyboard.type('new text');await page.keyboard.insertText('中文输入')
  assert.ok((await markdown()).includes('new text中文输入'))
  // A native composing input may mutate a text node rather than use a Tiptap command.
  await page.locator('td p').first().evaluate(el=>{el.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));el.firstChild.textContent+='组合输入';el.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertCompositionText',data:'组合输入',isComposing:true}));el.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:'组合输入'}))})
  await page.waitForFunction(()=>window.__yeran.getMarkdown().includes('组合输入'))
  const original=await markdown(), id=await page.evaluate(()=>window.__yeran.activeId.value)
  await page.getByRole('button',{name:'新建标签',exact:true}).click();await page.evaluate(id=>window.__yeran.activateTab(id),id);assert.equal(await markdown(),original)
  await page.reload();await ready();assert.equal(await markdown(),original)
})
await test('row/column controls, right-click target, deletion undo and Markdown column alignment',async()=>{
  await reset();await page.locator('td').first().click()
  await page.getByRole('button',{name:'向下插入行',exact:true}).click();assert.equal(await page.locator('.paper-editor tr').count(),4)
  await page.getByRole('button',{name:'向右插入列',exact:true}).click();assert.equal(await page.locator('.paper-editor tr').first().locator('th').count(),4)
  await page.locator('tr').nth(2).locator('td').nth(2).click({button:'right'});await page.getByRole('menuitem',{name:'删除当前行',exact:true}).click();assert.equal(await page.locator('.paper-editor tr').count(),3)
  await page.keyboard.press('Control+z');assert.equal(await page.locator('.paper-editor tr').count(),4)
  await page.locator('tr').nth(2).locator('td').nth(2).click();await page.getByRole('button',{name:'整列居中',exact:true}).click()
  const aligned=await page.locator('.paper-editor tr').evaluateAll(rows=>rows.map(row=>getComputedStyle(row.children[2]).textAlign));assert.ok(aligned.every(value=>value==='center'))
  const md=await markdown();assert.ok(md.split('\n').some(line=>/:\s*-+\s*:/.test(line)))
  await page.evaluate(md=>window.__yeran.replaceDocument(md,null,null),md);assert.ok((await page.locator('th').nth(2).evaluate(el=>getComputedStyle(el).textAlign))==='center')
})
await test('Shift-click selects cells, clearing keeps other cells and undo restores values',async()=>{
  await reset();const before=await markdown()
  await page.locator('td').first().click();await page.locator('td').nth(4).click({modifiers:['Shift']})
  assert.equal(await page.locator('.selectedCell').count(),4)
  await page.keyboard.press('Backspace');const cleared=await markdown();assert.ok(!cleared.includes('苹果'));assert.ok(!cleared.includes('梨'));assert.ok(cleared.includes('已确认'))
  await page.keyboard.press('Control+z');assert.equal(await markdown(),before)
})
await test('Tab/Shift+Tab navigate, final Tab creates a row, Ctrl+Enter exits the table',async()=>{
  await reset();await page.locator('th').first().click();await page.waitForFunction(()=>window.__yeran.editor.state.selection.$from.parent.textContent==='名称');await page.keyboard.press('Tab');await page.keyboard.insertText('第二列');assert.ok((await page.locator('th').nth(1).innerText()).includes('第二列'))
  await page.keyboard.press('Shift+Tab');await page.keyboard.insertText('第一列');assert.ok((await page.locator('th').first().innerText()).includes('第一列'))
  await page.locator('td').last().click();await page.waitForFunction(()=>window.__yeran.editor.state.selection.$from.parent.textContent==='已确认');await page.keyboard.press('Tab');assert.equal(await page.locator('.paper-editor tr').count(),4)
  await page.keyboard.press('Control+Enter');await page.keyboard.insertText('离开表格写正文');assert.ok((await page.locator('.paper-editor > p').last().innerText()).includes('离开表格'))
})
await test('Excel TSV and HTML paste create tables and fill/expand existing cells',async()=>{
  await page.evaluate(()=>window.__yeran.replaceDocument('',null,null));await page.locator('.paper-editor').click();await paste('项目\t数量\r\n苹果\t10\r\n梨\t20\r\n')
  assert.equal(await page.locator('.paper-editor tr').count(),3);assert.equal(await page.locator('th').count(),2);assert.ok((await markdown()).includes('苹果'))
  await page.locator('td').first().click();await page.waitForFunction(()=>window.__yeran.editor.state.selection.$from.parent.textContent==='苹果');await paste('甲\t乙\t丙\n丁\t戊\t己')
  assert.equal(await page.locator('.paper-editor tr').first().locator('th,td').count(),3);for(const text of ['甲','乙','丙','丁','戊','己'])assert.ok((await markdown()).includes(text))
  await page.evaluate(()=>window.__yeran.replaceDocument('',null,null));await page.locator('.paper-editor').click();await paste('名称\t金额\n中文\t120','<table><tr><th>名称</th><th>金额</th></tr><tr><td>中文</td><td>120</td></tr></table>')
  assert.equal(await page.locator('.paper-editor table').count(),1);assert.ok((await markdown()).includes('120'))
  await page.evaluate(()=>window.__yeran.replaceDocument('',null,null));await page.locator('.paper-editor').click();await paste('项目\t备注\n"多行\n说明"\tA|B')
  const multiline=await markdown();await page.evaluate(md=>window.__yeran.replaceDocument(md,null,null),multiline)
  const text=await page.locator('td').first().innerText();assert.ok(text.includes('多行')&&text.includes('说明'));assert.ok(await page.locator('td').first().locator('br').count()>0);assert.ok((await markdown()).includes('A'))
})
await test('column drag changes layout, preserves typing, recovers widths and exports cleanly',async()=>{
  await reset();await page.locator('td').first().click()
  const before=await page.locator('th').first().boundingBox();const handle=await page.locator('.table-column-resizer').first().boundingBox()
  await page.mouse.move(handle.x+handle.width/2,before.y+before.height/2);await page.mouse.down();await page.mouse.move(handle.x+handle.width/2+70,before.y+before.height/2,{steps:8});await page.mouse.up()
  assert.ok((await page.locator('th').first().boundingBox()).width>before.width+50)
  await page.locator('td').first().click();await page.keyboard.insertText('调整列宽后还能输入')
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('yeran.session.v3')).tabs.find(tab=>tab.id===window.__yeran.activeId.value).tableWidths?.[0])
  const width=(await page.locator('th').first().boundingBox()).width;await page.reload();await ready();assert.ok(Math.abs((await page.locator('th').first().boundingBox()).width-width)<1);assert.ok((await markdown()).includes('调整列宽后还能输入'))
  const html=await page.evaluate(()=>window.__yeran.createPrintHtml());assert.ok(!html.includes('class="table-resizers"'));assert.ok(!html.includes('class="selectedCell"'))
  await page.locator('td').first().click();await page.getByRole('button',{name:'更多表格操作'}).click();await page.waitForFunction(()=>getComputedStyle(document.querySelector('.table-context-menu')).opacity==='1');await page.screenshot({path:out+'/table-controls.png'});await page.keyboard.press('Escape')
})
await test('cross-page rows stay editable and landscape preview/export uses real A4 dimensions',async()=>{
  const md='# 横向数据表\n\n| 序号 | 名称 | 说明 |\n| --- | --- | --- |\n'+Array.from({length:65},(_,i)=>`| ${i+1} | 数据第${i+1}行 | 长表跨页后的内容仍然可编辑。 |`).join('\n')+'\n\n文稿结束。'
  await reset(md);await page.locator('td').nth(145).click();await page.keyboard.insertText('跨页编辑保留')
  await page.getByRole('button',{name:'页面设置',exact:true}).click();await page.getByLabel('纸张方向',{exact:true}).selectOption('landscape');await page.getByRole('button',{name:'关闭页面设置'}).click()
  await page.waitForFunction(()=>document.querySelector('.paper-editor').offsetWidth===1123&&getComputedStyle(document.querySelector('.paper-editor')).getPropertyValue('--rm-page-height').trim()==='794px')
  await page.waitForFunction(()=>window.__yeran.getPageSlices().length>=3)
  const expected=await page.locator('.paper-editor').innerText(), original=await markdown()
  const printPage=await context.newPage();const html=await page.evaluate(()=>window.__yeran.createPrintHtml());await printPage.setContent(html);await printPage.evaluate(()=>document.fonts.ready)
  assert.equal(await printPage.locator('.pdf-sheet').first().evaluate(el=>el.offsetWidth),1123);assert.equal(await printPage.locator('.pdf-sheet').first().evaluate(el=>el.offsetHeight),794)
  const previewPages=await printPage.locator('.pdf-sheet').count()
  await printPage.screenshot({path:out+'/landscape-preview.png'});await printPage.close();assert.equal(await markdown(),original)
  assert.match(html,/@page\{size:A4 landscape/)
  assert.equal((html.match(/<section class="pdf-sheet"[^>]*>/g)||[]).length,previewPages,'Preview and export page count must match')
  const print=await context.newPage();await print.setContent(html);await print.evaluate(()=>document.fonts.ready);await print.pdf({path:out+'/landscape.pdf',printBackground:true,preferCSSPageSize:true});await print.close();await writeFile(out+'/landscape.html',html);await writeFile(out+'/expected-text.json',JSON.stringify(expected))
  await page.reload();await ready();assert.equal(await page.getByLabel('纸张方向',{exact:true}).count(),0)
  const tab=await page.evaluate(()=>window.__yeran.activeId.value);await page.getByRole('button',{name:'新建标签',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.paper-editor').offsetWidth===1123&&getComputedStyle(document.querySelector('.paper-editor')).getPropertyValue('--rm-page-height').trim()==='794px');await page.evaluate(id=>window.__yeran.activateTab(id),tab)
  await page.getByRole('button',{name:'页面设置',exact:true}).click();assert.equal(await page.getByLabel('纸张方向',{exact:true}).inputValue(),'landscape');await page.getByLabel('纸张方向',{exact:true}).selectOption('portrait');await page.getByRole('button',{name:'关闭页面设置'}).click();await page.waitForFunction(()=>document.querySelector('.paper-editor').offsetWidth===794)
})
assert.deepEqual(errors,[]);await writeFile(out+'/verification.json',JSON.stringify({passed:results.length,results,errors},null,2));console.log(JSON.stringify({passed:results.length,errors}))
}catch(error){await page.screenshot({path:out+'/failure.png'});console.error(error);process.exitCode=1}finally{await browser.close()}
