import {chromium,expect} from '@playwright/test'
import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'

const out=process.env.YERAN_TEST_OUT||'.oil-ui/yeran-24'
await mkdir(out,{recursive:true})
const browser=await chromium.launch({channel:'msedge',headless:true})
const page=await browser.newPage({viewport:{width:1440,height:1000}}),results=[],errors=[]
page.setDefaultTimeout(12000)
page.on('pageerror',error=>errors.push(error.stack||error.message))
const table='| Name | Value |\n| --- | --- |\n| Apple | 10 |\n| Pear | 20 |'
const prose=Array.from({length:18},(_,i)=>`Paragraph ${i+1}. Reading text should stay clear while scrolling.`).join('\n\n')
const longTable='| Name | Value |\n| --- | --- |\n'+Array.from({length:90},(_,i)=>`| Row ${i+1} | Value ${i+1} |`).join('\n')
const test=async(name,run)=>{await run();results.push(name);console.log('PASS '+name)}
const frames=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))
const raw=()=>page.evaluate(()=>window.__yeran.getMarkdown())
async function reset(text,mode='continuous'){
 await page.keyboard.press('Escape');await page.mouse.move(5,5)
 await page.evaluate(async({text,mode})=>{window.__yeran.viewMode.value=mode;await window.__yeran.replaceDocument(text,null,null,false)},{text,mode})
 await frames();await page.locator('.canvas').evaluate(e=>e.scrollTop=0);await frames()
}
async function scrollTo(top){await page.locator('.canvas').evaluate((e,top)=>e.scrollTop=top,top);await frames()}
async function hoverCell(row=1,column=0){
 const cell=page.locator('.paged-table').first().locator('tr').nth(row).locator('th,td').nth(column)
 await cell.hover();await frames();return cell
}
const selector=()=>page.locator('.paged-table').first().locator('.table-block-handle')
async function offscreenSelectors(){
 const violations=await page.locator('.table-block-handle').evaluateAll(es=>{
  const canvas=document.querySelector('.canvas').getBoundingClientRect()
  return es.flatMap((e,i)=>{
   const rows=[...e.closest('.paged-table').querySelectorAll('.table-plus>tr')].map(r=>r.getBoundingClientRect()).filter(r=>r.height>0)
   const intersects=rows.some(r=>r.bottom>canvas.top+4&&r.top<canvas.bottom&&r.right>canvas.left&&r.left<canvas.right)
   const css=getComputedStyle(e),b=e.getBoundingClientRect()
   return !intersects&&(b.height||css.pointerEvents!=='none')?[{table:i,hidden:e.hidden,box:b.toJSON(),opacity:css.opacity,pointerEvents:css.pointerEvents}]:[]
  })
 })
 assert.deepEqual(violations,[],'Offscreen selectors must have no geometry or hit target')
}
try{
 await page.goto(process.env.YERAN_TEST_URL||'http://127.0.0.1:15524');await page.waitForFunction(()=>window.__yeran)
 await test('several offscreen tables never stack their selectors above the reading text',async()=>{
  await reset(Array.from({length:6},(_,i)=>`## Section ${i+1}\n\n${table}\n\n${prose}`).join('\n\n'))
  for(const top of [0,1200,2400,4200,6200]){await scrollTo(top);await offscreenSelectors()}
  await page.mouse.move(5,5)
  await expect.poll(()=>page.locator('.table-block-handle').evaluateAll(es=>es.every(e=>getComputedStyle(e).pointerEvents==='none'))).toBe(true)
  await page.screenshot({path:out+'/clean-reading.png'})
 })
 await test('hover reveals one selector, a slow approach keeps it clickable, and clicking selects the whole table',async()=>{
  await reset(table+'\n\n'+prose);await hoverCell()
  await expect(selector()).toHaveCSS('pointer-events','auto')
  const b=await selector().boundingBox();await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:12})
  await expect(selector()).toHaveCSS('opacity','0.8')
  await selector().click()
  assert.equal(await page.evaluate(()=>{const s=window.__yeran.editor.state.selection;return s.node?.type.name}),'table')
  await expect(page.locator('.paged-table.ProseMirror-selectednode')).toHaveCount(1)
  await expect(page.locator('.table-cell-hovered,.table-axis-preview')).toHaveCount(0)
  await expect(page.locator('.table-resize-frame')).not.toHaveCount(0)
  const before=await raw();await page.keyboard.press('Delete');await expect(page.locator('.paged-table')).toHaveCount(0)
  await page.keyboard.press('Control+z');await expect(page.locator('.paged-table')).toHaveCount(1);assert.equal(await raw(),before)
  await page.screenshot({path:out+'/whole-table-selected.png'})
 })
 await test('a selected table scrolling out of view loses its selector and cannot cover another paragraph',async()=>{
  await reset(table+'\n\n'+prose);await hoverCell();await selector().click();await scrollTo(650)
  await expect(selector()).toBeHidden();await expect(page.locator('.table-resize-handle:visible')).toHaveCount(0)
  await offscreenSelectors();await page.screenshot({path:out+'/selected-table-offscreen.png'})
 })
 await test('dragging the whole-table selector moves the entire table as one undoable block',async()=>{
  await reset('Before\n\n'+table+'\n\nAfter');await hoverCell()
  const before=await raw(),handle=await selector().boundingBox(),after=await page.locator('.paper-editor>p').filter({hasText:'After'}).boundingBox()
  await page.mouse.move(handle.x+handle.width/2,handle.y+handle.height/2);await page.mouse.down()
  await page.mouse.move(after.x+after.width/2,after.y+after.height-2,{steps:16})
  await expect(page.locator('.block-drag-ghost')).toBeVisible()
  await page.mouse.up();await frames()
  const order=await page.evaluate(()=>window.__yeran.editor.state.doc.content.content.filter(n=>n.type.name==='table'||n.textContent).map(n=>n.type.name==='table'?'table':n.textContent))
  assert.deepEqual(order,['Before','After','table'])
  await expect(page.locator('.paged-table tr')).toHaveCount(3);await expect(page.locator('.block-drag-ghost,.block-drag-source')).toHaveCount(0)
  await page.keyboard.press('Control+z');assert.equal(await raw(),before)
 })
 await test('undoing an immediate cell edit after a column duplication preserves the duplicated column',async()=>{
  await reset(table);await page.locator('.paged-table td').first().click()
  await page.getByRole('button',{name:'列操作',exact:true}).click();await page.getByRole('menuitem',{name:'复制当前列',exact:true}).click()
  await expect(page.locator('.paged-table tr').first().locator('th')).toHaveCount(3)
  const before=await raw();await page.locator('.paged-table td').first().click();await page.keyboard.press('Home');await page.keyboard.press('Shift+End')
  await page.waitForFunction(()=>getSelection()?.toString()==='Apple');await frames();await page.keyboard.press('Backspace')
  await expect(page.locator('.paged-table td').first()).toHaveText('');await page.keyboard.press('Control+z');assert.equal(await raw(),before)
  await expect(page.locator('.paged-table tr').first().locator('th')).toHaveCount(3)
 })
 await test('long tables keep a reachable whole-table selector in their visible section without jumping on click',async()=>{
  for(const mode of ['continuous','pages']){
   await reset(longTable+'\n\nEnd',mode);await scrollTo(1500)
   const cell=await page.locator('.paged-table td').evaluateAll(es=>{const c=document.querySelector('.canvas').getBoundingClientRect();return es.findIndex(e=>{const b=e.getBoundingClientRect();return b.top>c.top+90&&b.bottom<c.bottom-40})})
   assert.ok(cell>=0);await page.locator('.paged-table td').nth(cell).hover();await frames()
   const b=await selector().boundingBox(),c=await page.locator('.canvas').boundingBox()
   assert.ok(b&&b.y>=c.y&&b.y+b.height<=c.y+c.height)
   const before=await page.locator('.canvas').evaluate(e=>e.scrollTop);await selector().click();await frames()
   assert.equal(await page.evaluate(()=>window.__yeran.editor.state.selection.node?.type.name),'table')
   assert.ok(Math.abs(await page.locator('.canvas').evaluate(e=>e.scrollTop)-before)<4,'Selecting must not jump to the first page')
   await page.screenshot({path:out+`/long-table-${mode}.png`})
  }
 })
 await test('scroll clears stale row/column grips and cell hover, then pointer movement restores usable controls',async()=>{
  await reset(longTable);await hoverCell(2,1)
  await expect(page.locator('.table-row-handle')).toBeVisible();await expect(page.locator('.table-column-handle')).toBeVisible()
  await scrollTo(400)
  await expect(page.locator('.table-axis-handle:visible')).toHaveCount(0);await expect(page.locator('.table-cell-hovered')).toHaveCount(0)
  await hoverCell(13,1);await expect(page.locator('.table-row-handle')).toBeVisible();await expect(page.locator('.table-column-handle')).toBeVisible()
  const count=await page.locator('.paged-table tr').count();await page.locator('.table-add-column').click()
  await expect(page.locator('.paged-table tr').first().locator('th,td')).toHaveCount(3)
  assert.equal(await page.locator('.paged-table tr').count(),count)
 })
 await test('table popovers close on document scroll, resize and blur, but their own scroll remains usable',async()=>{
  await reset(table+'\n\n'+prose)
  const open=async()=>{await hoverCell();await page.locator('.paged-table td').first().click({button:'right'});await page.getByRole('menuitem',{name:'表格设置',exact:true}).click();await expect(page.getByRole('menu',{name:'表格操作',exact:true})).toBeVisible()}
  await open();await page.getByRole('menu',{name:'表格操作',exact:true}).evaluate(e=>e.dispatchEvent(new Event('scroll')))
  await expect(page.getByRole('menu',{name:'表格操作',exact:true})).toBeVisible()
  await scrollTo(200);await expect(page.getByRole('menu',{name:'表格操作',exact:true})).toHaveCount(0)
  await scrollTo(0);await open();await page.setViewportSize({width:1300,height:900});await expect(page.getByRole('menu',{name:'表格操作',exact:true})).toHaveCount(0)
  await open();await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await expect(page.getByRole('menu',{name:'表格操作',exact:true})).toHaveCount(0)
  await page.setViewportSize({width:1440,height:1000})
 })
 await test('block menus dismiss when their document scrolls and a later block can immediately reopen its controls',async()=>{
  await reset(prose)
  const p=page.locator('.paper-editor>p').first();await p.hover();await page.getByRole('button',{name:'块操作',exact:true}).click()
  await expect(page.getByRole('menu',{name:'块操作',exact:true})).toBeVisible()
  await page.getByRole('menu',{name:'块操作',exact:true}).evaluate(e=>e.dispatchEvent(new Event('scroll')))
  await expect(page.getByRole('menu',{name:'块操作',exact:true})).toBeVisible()
  await scrollTo(180);await expect(page.getByRole('menu',{name:'块操作',exact:true})).toHaveCount(0)
  await page.locator('.paper-editor>p').nth(6).hover();await page.getByRole('button',{name:'块操作',exact:true}).click()
  await expect(page.getByRole('menu',{name:'块操作',exact:true})).toBeVisible()
 })
 await test('collapsed tables and horizontally offscreen tables have no stray selector',async()=>{
  await reset('<details>\n<summary>Group</summary>\n\n'+table+'\n\n</details>\n\n'+prose)
  await expect(page.locator('.paged-table')).toHaveCount(1)
  const toggle=page.locator('details.toggle-block');if(await toggle.getAttribute('open')!==null)await toggle.locator('.toggle-arrow').click()
  await frames();await expect(selector()).toBeHidden()
  await toggle.locator('.toggle-arrow').click();await page.locator('.paged-table td').first().hover();await expect(selector()).not.toBeHidden()
  await reset(table);await page.locator('.paged-table').evaluate(e=>{e.style.transform='translateX(3000px)'})
  await page.locator('.canvas').evaluate(e=>e.dispatchEvent(new Event('scroll')));await frames();await offscreenSelectors()
  await page.locator('.paged-table').evaluate(e=>e.style.removeProperty('transform'))
 })
 await test('narrow windows, dark mode and enlarged zoom keep selectors beside visible table content',async()=>{
  await page.setViewportSize({width:960,height:900});await reset(longTable,'pages')
  await page.emulateMedia({colorScheme:'dark'})
  await expect(page.locator('html')).toHaveAttribute('data-theme','dark')
  for(let i=0;i<12;i++)await page.getByRole('button',{name:'放大',exact:true}).click()
  await expect(page.locator('.zoom-number')).toHaveText('150%')
  await scrollTo(1200);await offscreenSelectors()
  const index=await page.locator('.paged-table td').evaluateAll(es=>{const c=document.querySelector('.canvas').getBoundingClientRect();return es.findIndex(e=>{const b=e.getBoundingClientRect();return b.top>c.top+90&&b.bottom<c.bottom-40&&b.right>c.left&&b.left<c.right})})
  assert.ok(index>=0,'Enlarged table content must be visible')
  await page.locator('.paged-table td').nth(index).hover();await frames()
  await expect(selector()).toHaveCSS('pointer-events','auto')
  const b=await selector().boundingBox(),c=await page.locator('.canvas').boundingBox()
  assert.ok(b&&b.y>=c.y&&b.y+b.height<=c.y+c.height)
  await page.screenshot({path:out+'/narrow-scroll.png'})
  await page.setViewportSize({width:1440,height:1000})
 })
 assert.deepEqual(errors,[])
 await writeFile(out+'/verification.json',JSON.stringify({passed:results.length,results,errors},null,2))
}catch(error){await page.screenshot({path:out+'/failure.png'}).catch(()=>{});await writeFile(out+'/failure.json',JSON.stringify({error:String(error),passed:results,errors},null,2));throw error}
finally{await browser.close()}
