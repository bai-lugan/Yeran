import {chromium} from '@playwright/test'
import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
const out='.oil-ui/yeran-23';await mkdir(out,{recursive:true})
const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage(),results=[]
await page.route('**/save-guard-fixture.html',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Save guard fixture</title>'}))
await page.goto((process.env.YERAN_TEST_URL||'http://127.0.0.1:15520')+'/save-guard-fixture.html')
await page.evaluate(()=>{window.__valid=true;window.__calls=[];window.__hold='';window.__TAURI_INTERNALS__={invoke:async(cmd,args)=>{window.__calls.push({cmd,args});if(cmd===window.__hold){window.__stage=cmd;await new Promise(resolve=>window.__release=resolve)}if(cmd==='save_image_asset')return{relative:'assets/fixture.png'};if(cmd==='document_status')return{missing:true,modified:null};if(cmd.startsWith('write_'))return{path:args.path,modified:'new-stamp'};return null}}})
const test=async(name,fn)=>{await fn();results.push(name);console.log('PASS '+name)}
const start=async(format,hold)=>page.evaluate(({format,hold})=>{window.__valid=true;window.__calls=[];window.__hold=hold;window.__stage='';window.__result='pending';window.__job=(async()=>{const {saveDocument}=await import('/src/platform.ts');const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PzWvWQAAAABJRU5ErkJggg==',json={type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Committed text'}]},...(format==='markdown'?[{type:'image',attrs:{src:png}}]:[])]},resources={json,prefix:'',serialize:doc=>doc.content[0].content[0].text,images:{}};window.__result=await saveDocument('Committed text','C:/fixture/doc.'+(format==='markdown'?'md':format),null,false,undefined,{paths:[],handles:[]},{format,resources,automatic:true,canWrite:()=>window.__valid})})()},{format,hold})
try{
 await test('native Markdown rechecks the IME ticket after asynchronous image preparation, before the document IPC write',async()=>{
  await start('markdown','save_image_asset');await page.waitForFunction(()=>window.__stage==='save_image_asset');await page.evaluate(()=>{window.__valid=false;window.__release()});await page.evaluate(()=>window.__job);assert.equal(await page.evaluate(()=>window.__result),null);assert.equal(await page.evaluate(()=>window.__calls.filter(c=>c.cmd==='write_document').length),0)
 })
 for(const format of ['textpack','textbundle'])await test(`native ${format} cancels a superseded save after package preparation and before its atomic write`,async()=>{
  await start(format,'document_status');await page.waitForFunction(()=>window.__stage==='document_status');await page.evaluate(()=>{window.__valid=false;window.__release()});await page.evaluate(()=>window.__job);assert.equal(await page.evaluate(()=>window.__result),null);assert.equal(await page.evaluate(()=>window.__calls.filter(c=>c.cmd.startsWith('write_')).length),0)
 })
 await test('a fresh stable ticket still saves native Markdown, TextPack and TextBundle snapshots',async()=>{
  for(const format of ['markdown','textpack','textbundle']){await start(format,'');await page.evaluate(()=>window.__job);const state=await page.evaluate(()=>({result:window.__result,calls:window.__calls}));assert.equal(state.result.modified,'new-stamp');assert.equal(state.result.writtenContent,'Committed text');assert.equal(state.calls.filter(c=>c.cmd.startsWith('write_')).length,1);if(format==='textpack'){const contents=await page.evaluate(async()=>{const {unpackTextPack}=await import('/src/textbundle.ts');return unpackTextPack(new Uint8Array(window.__calls.find(c=>c.cmd==='write_binary_document').args.data)).content});assert.equal(contents,'Committed text')}}
 })
 await writeFile(out+'/save-guards.json',JSON.stringify({passed:results.length,results,note:'Native bridge writes are stubbed; real preparation, packaging, serialization and save guards execute.'},null,2))
}finally{await browser.close()}
