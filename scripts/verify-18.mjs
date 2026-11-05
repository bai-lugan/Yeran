import {chromium} from '@playwright/test'
import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
const out='.oil-ui/yeran-18';await mkdir(out,{recursive:true})
const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}}),results=[],errors=[]
page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.stack))
const sample='Alpha words\n\nBravo words\n\n## Charlie\n\nDelta',test=async(name,fn)=>{await fn();results.push(name);console.log('PASS '+name)}
const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))))
const reset=async(text=sample)=>{await page.evaluate(text=>{window.__yeran.viewMode.value='continuous';return window.__yeran.replaceDocument(text,null,null,false)},text);await page.waitForTimeout(180);await settle()}
const selection=()=>page.evaluate(()=>window.__yeran.editor.state.selection.toJSON()),raw=()=>page.evaluate(()=>window.__yeran.getMarkdown())
const clean=async()=>{await settle();assert.equal(await page.locator('.block-marquee').count(),0);assert.equal(await page.locator('body').evaluate(e=>e.classList.contains('block-marquee-active')),false)}
async function burst(end='up'){
 await page.evaluate(end=>{
  const root=document.querySelector('#app .paper-editor'),nodes=root.querySelectorAll(':scope>p,:scope>h2'),a=nodes[0].getBoundingClientRect(),z=nodes[2].getBoundingClientRect(),r=root.getBoundingClientRect(),x=r.right-8,y=z.bottom+3
  const send=(target,type,buttons,px,py)=>target.dispatchEvent(new PointerEvent(type,{pointerId:7,pointerType:'mouse',isPrimary:true,button:type==='pointermove'?-1:0,buttons,clientX:px,clientY:py,bubbles:true,cancelable:true}))
  send(document.elementFromPoint(x,y),'pointerdown',1,x,y)
  send(document,'pointermove',1,a.left+3,a.top-3)
  if(end==='up')send(document,'pointerup',0,a.left+3,a.top-3)
  if(end==='buttons')send(document,'pointermove',0,a.left+3,a.top-3)
  if(end==='cancel')send(document,'pointercancel',0,a.left+3,a.top-3)
  if(end==='mouse')document.dispatchEvent(new MouseEvent('mouseup',{button:0,buttons:0,bubbles:true}))
  if(end==='escape')document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}))
 },end)
}
async function start(){
 const root=await page.locator('#app .paper-editor').boundingBox(),first=await page.locator('#app .paper-editor>p').first().boundingBox(),last=await page.locator('#app .paper-editor>h2').boundingBox()
 await page.mouse.move(root.x+root.width-8,last.y+last.height+3);await page.mouse.down();await page.mouse.move(first.x+3,first.y-3,{steps:10});await settle();assert.equal(await page.locator('.block-marquee').count(),1)
}
try{
 await page.goto(process.env.YERAN_TEST_URL||'http://127.0.0.1:15420');await page.waitForFunction(()=>window.__yeran)
 await test('same-frame move and release never redraw a stale rectangle, including repeated rapid selections',async()=>{
  await reset();const before=await raw();for(let i=0;i<12;i++){await burst();await clean();assert.equal((await selection()).blocks.length,3)}assert.equal(await raw(),before)
 })
 await test('real mouse release clears the frame while retaining the selected group and normal text editing',async()=>{
  await reset();await start();await page.mouse.up();await clean();assert.equal((await selection()).blocks.length,3);await page.getByRole('button',{name:'创建选中块副本',exact:true}).click();assert.equal(await page.locator('#app .paper-editor>h2').count(),2);await page.keyboard.press('Control+z');await page.waitForTimeout(100);await page.keyboard.press('Escape');await page.locator('#app .paper-editor>p').last().click();await page.waitForFunction(()=>window.__yeran.editor.state.selection.$from.parent.textContent==='Delta');await page.keyboard.press('End');await page.keyboard.insertText(' typed');assert.match(await raw(),/Delta typed$/);await clean()
 })
 await test('capture-phase release survives a descendant stopping propagation and release outside the canvas',async()=>{
  await reset();await page.evaluate(()=>{window.__stopUp=e=>e.stopImmediatePropagation();document.addEventListener('pointerup',window.__stopUp)});await start();await page.mouse.move(10,25,{steps:5});await page.mouse.up();await clean();await page.evaluate(()=>document.removeEventListener('pointerup',window.__stopUp));assert.equal((await selection()).type,'yeranBlocks')
 })
 await test('missing pointerup is recovered from buttons=0 and the mouseup fallback without clearing selected blocks',async()=>{
  for(const end of ['buttons','mouse']){await reset();await burst(end);await clean();assert.equal((await selection()).blocks.length,3)}
 })
 await test('Escape and pointer cancellation clear queued paints and restore the initial selection',async()=>{
  for(const end of ['escape','cancel']){await reset();const before=await selection();await burst(end);await clean();assert.deepEqual(await selection(),before)}
 })
 await test('lost pointer capture and window blur cancel a live marquee and its auto-scroll loop',async()=>{
  await reset();const initial=await selection();await start();await page.evaluate(()=>{const c=document.querySelector('.canvas');c.dispatchEvent(new PointerEvent('lostpointercapture',{pointerId:1,bubbles:true}))});await page.mouse.up();await clean();assert.deepEqual(await selection(),initial)
  await reset(Array.from({length:80},(_,i)=>'Paragraph '+i).join('\n\n'));const root=await page.locator('#app .paper-editor').boundingBox(),canvas=await page.locator('.canvas').boundingBox();await page.mouse.move(root.x+root.width-8,canvas.y+70);await page.mouse.down();await page.mouse.move(root.x+5,canvas.y+canvas.height-3,{steps:12});await page.waitForTimeout(100);await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await page.mouse.up();await clean();const top=await page.locator('.canvas').evaluate(e=>e.scrollTop);await page.waitForTimeout(100);assert.equal(await page.locator('.canvas').evaluate(e=>e.scrollTop),top)
 })
 await test('clicking blank space or Escape deselects a completed group; unrelated toolbar clicks retain it',async()=>{
  await reset();await burst();await clean();await page.getByRole('button',{name:'页面设置',exact:true}).click();assert.equal((await selection()).blocks.length,3);await page.getByRole('button',{name:'关闭页面设置',exact:true}).click();assert.equal((await selection()).blocks.length,3);await page.keyboard.press('Escape');assert.notEqual((await selection()).type,'yeranBlocks');assert.equal(await page.locator('.yeran-block-selected,.block-selection-tools').count(),0)
  await burst();await clean();const canvas=await page.locator('.canvas').boundingBox();await page.mouse.click(canvas.x+8,canvas.y+70);await clean();assert.notEqual((await selection()).type,'yeranBlocks')
 })
 await test('a single selected block also clears with Escape or a blank click without changing its text',async()=>{
  for(const cancel of ['escape','blank']){await reset();const r=await page.locator('#app .paper-editor').boundingBox(),a=await page.locator('#app .paper-editor>p').first().boundingBox();await page.mouse.move(r.x+r.width-8,a.y+a.height+2);await page.mouse.down();await page.mouse.move(a.x+3,a.y-3,{steps:8});await page.mouse.up();await clean();assert.equal((await selection()).type,'node');if(cancel==='escape')await page.keyboard.press('Escape');else{const c=await page.locator('.canvas').boundingBox();await page.mouse.click(c.x+8,c.y+70)}await clean();assert.equal((await selection()).type,'text');assert.equal(await page.locator('#app .ProseMirror-selectednode').count(),0);assert.equal(await raw(),sample)}
 })
 await test('document replacement and a new pointerdown cancel the old session without repainting or restoring old content',async()=>{
  await reset();await burst('pending');await settle();assert.equal(await page.locator('.block-marquee').count(),1);await page.evaluate(()=>window.__yeran.replaceDocument('New document',null,null,false));await clean();assert.equal(await raw(),'New document')
  await reset();await burst('pending');await settle();await page.locator('#app .paper-editor>p').last().click();await clean();assert.notEqual((await selection()).type,'yeranBlocks');await page.keyboard.press('End');await page.keyboard.insertText(' safe');assert.match(await raw(),/Delta safe$/)
 })
 await test('hidden-window cleanup, dark mode and small-view real mouse selection leave no overlay or blocked selection',async()=>{
  await reset();await burst('pending');await settle();await page.evaluate(()=>{const old=Object.getOwnPropertyDescriptor(document,'visibilityState');Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});document.dispatchEvent(new Event('visibilitychange'));if(old)Object.defineProperty(document,'visibilityState',old);else delete document.visibilityState});await clean()
  await page.setViewportSize({width:960,height:720});await page.emulateMedia({colorScheme:'dark'});await reset();await start();await page.mouse.up();await clean();assert.equal((await selection()).blocks.length,3);await page.keyboard.press('Escape');await page.locator('#app .paper-editor>p').first().dblclick({position:{x:20,y:10}});assert.match(await page.evaluate(()=>getSelection().toString()),/Alpha/);await page.screenshot({path:out+'/cleanup-dark.png'})
 })
 assert.deepEqual(errors,[]);await writeFile(out+'/verification.json',JSON.stringify({passed:results.length,results,errors},null,2))
}catch(error){console.error(error);console.error(errors);await page.screenshot({path:out+'/failure.png'}).catch(()=>{});throw error}finally{await browser.close()}
