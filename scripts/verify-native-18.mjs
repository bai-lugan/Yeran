import {connectNative,nativePage} from './native-test.mjs'
import assert from 'node:assert/strict'
import {mkdir,readFile,writeFile} from 'node:fs/promises'
import path from 'node:path'
const out=path.resolve('.oil-ui/yeran-18/native',String(Date.now()));await mkdir(out,{recursive:true})
const browser=await connectNative(),page=await nativePage(browser),results=[],errors=[];page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(e.stack))
const invoke=(cmd,args)=>page.evaluate(({cmd,args})=>window.__TAURI_INTERNALS__.invoke(cmd,args),{cmd,args});assert.match(await invoke('plugin:app|identifier'),/\.qa$/,'Use the isolated QA app');assert.equal(await invoke('plugin:app|version'),'1.0.8')
const file=path.join(out,'marquee.md'),original='Alpha words\n\nBravo words\n\n## Charlie\n\nDelta';await writeFile(file,original)
const test=async(name,fn)=>{await fn();results.push(name);console.log('PASS '+name)},settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))))
const clean=async()=>{await settle();assert.equal(await page.locator('.block-marquee').count(),0);assert.equal(await page.locator('body').evaluate(e=>e.classList.contains('block-marquee-active')),false)}
const selected=async()=>{await page.getByRole('toolbar',{name:'选中块操作',exact:true}).waitFor();assert.equal(await page.locator('#app .yeran-block-selected').count(),3)}
const save=async()=>{await page.keyboard.press('Control+s');await page.waitForFunction(()=>!document.querySelector('button[aria-label="保存 Markdown"]').disabled&&!document.querySelector('.document-tab.active .tab-dirty'));return readFile(file,'utf8')}
async function mouse(){const root=await page.locator('#app .paper-editor').boundingBox(),a=await page.locator('#app .paper-editor>p').first().boundingBox(),z=await page.locator('#app .paper-editor>h2').boundingBox();await page.mouse.move(root.x+root.width-8,z.y+z.height+3);await page.mouse.down();await page.mouse.move(a.x+3,a.y-3,{steps:1});await page.mouse.up();await clean()}
async function burst(end='up'){
 await page.evaluate(end=>{const root=document.querySelector('#app .paper-editor'),a=root.querySelector('p').getBoundingClientRect(),z=root.querySelector('h2').getBoundingClientRect(),r=root.getBoundingClientRect(),x=r.right-8,y=z.bottom+3;const send=(target,type,buttons)=>target.dispatchEvent(new PointerEvent(type,{pointerId:9,pointerType:'mouse',isPrimary:true,button:type==='pointermove'?-1:0,buttons,clientX:type==='pointerdown'?x:a.left+3,clientY:type==='pointerdown'?y:a.top-3,bubbles:true,cancelable:true}));send(document.elementFromPoint(x,y),'pointerdown',1);send(document,'pointermove',1);if(end==='up')send(document,'pointerup',0);if(end==='buttons')send(document,'pointermove',0);if(end==='mouse')document.dispatchEvent(new MouseEvent('mouseup',{button:0,buttons:0,bubbles:true}));if(end==='escape')document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));if(end==='blur')window.dispatchEvent(new Event('blur'));if(end==='cancel')send(document,'pointercancel',0)},end)
}
try{
 await page.evaluate(file=>{const fetch=window.fetch;window.fetch=(url,options)=>decodeURIComponent(String(url)).split('/').at(-1)==='plugin:dialog|open'?Promise.resolve(new Response(JSON.stringify([file]),{headers:{'Content-Type':'application/json','Tauri-Response':'ok'}})):fetch(url,options)},file)
 await page.keyboard.press('Control+o');await page.waitForFunction(file=>document.querySelector('.document-tab.active')?.getAttribute('title')===file,file);const mode=page.locator('.view-mode-btn');if(await mode.getAttribute('aria-pressed')!=='true')await mode.click();await settle()
 await test('native fast mouse releases and queued same-frame paints leave no marquee while preserving selected blocks',async()=>{
  for(let i=0;i<5;i++){await mouse();await selected();await page.keyboard.press('Escape');assert.equal(await page.locator('.block-selection-tools').count(),0)}for(let i=0;i<8;i++){await burst();await clean();await selected()}assert.equal(await save(),original);await page.screenshot({path:path.join(out,'native-released-selection.png')})
 })
 await test('native capture-phase release and missing-release fallbacks clean the overlay without losing the group',async()=>{
  await page.evaluate(()=>{window.__stop=e=>e.stopImmediatePropagation();document.addEventListener('pointerup',window.__stop)});await mouse();await selected();await page.evaluate(()=>document.removeEventListener('pointerup',window.__stop));for(const end of ['buttons','mouse']){await burst(end);await clean();await selected()}assert.equal(await save(),original)
 })
 await test('native cancellation before painting, lost capture and blur leave no stale frame or selection-blocking class',async()=>{
  await page.keyboard.press('Escape');for(const end of ['escape','cancel','blur']){await burst(end);await clean();assert.equal(await page.locator('.block-selection-tools').count(),0)}await burst('pending');await settle();assert.equal(await page.locator('.block-marquee').count(),1);await page.evaluate(()=>document.querySelector('.canvas').dispatchEvent(new PointerEvent('lostpointercapture',{pointerId:9,bubbles:true})));await clean();assert.equal(await page.locator('.block-selection-tools').count(),0);assert.equal(await save(),original)
 })
 await test('native blank click and Escape deselect completed blocks and subsequent typing/save/undo affects only the caret',async()=>{
  await mouse();await selected();const c=await page.locator('.canvas').boundingBox();await page.mouse.click(c.x+8,c.y+70);await clean();assert.equal(await page.locator('.block-selection-tools,#app .yeran-block-selected').count(),0);await mouse();await page.keyboard.press('Escape');await clean();assert.equal(await page.locator('.block-selection-tools,#app .yeran-block-selected').count(),0);await page.locator('#app .paper-editor>p').last().click();await settle();await page.keyboard.press('End');await page.keyboard.insertText(' native');assert.equal(await save(),original+' native');await page.keyboard.press('Control+z');await settle();assert.equal(await save(),original);await page.screenshot({path:path.join(out,'native-cleaned.png')})
 })
 assert.deepEqual(errors,[]);await writeFile(path.join(out,'verification.json'),JSON.stringify({passed:results.length,results,errors},null,2))
}catch(error){console.error(error);console.error(errors);await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});throw error}finally{await browser.close()}
