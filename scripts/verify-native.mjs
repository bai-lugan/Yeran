import {connectNative} from './native-test.mjs'
import { chromium } from '@playwright/test'
import { readFile, writeFile, stat, mkdir, unlink } from 'node:fs/promises'
import assert from 'node:assert/strict'
import path from 'node:path'
const out=path.resolve('.oil-ui/yeran-04/native-tests');await mkdir(out,{recursive:true})
let browser;for(let i=0;i<30;i++){try{browser=await connectNative();break}catch(e){if(i===29)throw e;await new Promise(resolve=>setTimeout(resolve,250))}}
try{
const editorPage=async()=>{for(const context of browser.contexts()){for(const candidate of context.pages()){if(candidate.url().startsWith('http://tauri.localhost'))return candidate}}throw new Error('the packaged app window was not found')},page=await editorPage();await page.waitForSelector('.paper-editor[contenteditable=true]');const invoke=(command,args)=>page.evaluate(({command,args})=>window.__TAURI_INTERNALS__.invoke(command,args),{command,args})
const target=path.join(out,`原生文件-${Date.now()}.md`),original='# 原生版本\n\n原始内容。',updated=original+'\n\n保存后的版本。'
await invoke('write_document',{path:target,content:original,expectedModified:null});const opened=await invoke('read_document',{path:target});assert.equal(opened.content,original)
await invoke('write_document',{path:target,content:updated,expectedModified:opened.modified});assert.equal(await readFile(target,'utf8'),updated)
await assert.rejects(invoke('write_document',{path:target,content:'Should not overwrite',expectedModified:opened.modified}));assert.equal(await readFile(target,'utf8'),updated)
const versions=await invoke('list_history',{key:target});assert.equal(versions.length,2);assert.equal(await invoke('read_history',{key:target,id:versions[1].id}),original)
await invoke('record_history',{key:target,content:updated,reason:'Dedup test'});assert.equal((await invoke('list_history',{key:target})).length,2)
await assert.rejects(invoke('read_history',{key:target,id:'../README'}))
const stamp=(await invoke('document_status',{path:target})).modified;await writeFile(target,updated+'\nExternal');assert.notEqual((await invoke('document_status',{path:target})).modified,stamp);await unlink(target);assert.equal((await invoke('document_status',{path:target})).missing,true)
console.log('PASS native atomic writes, stale-save rejection, history read/dedup and external status')
for(const name of ['mixed-table','mixed-manual','blocks']){const html=await readFile(`.oil-ui/yeran-04/${name}.html`,'utf8'),pdf=path.join(out,`${name}.pdf`);await invoke('export_pdf',{html,path:pdf});assert.ok((await stat(pdf)).size>1000)}
console.log('PASS real Edge export of mixed pages, manual breaks and embedded equations')
const originalText=await page.locator('.paper-editor').innerText(), tabCount=await page.getByRole('tab').count()
await page.keyboard.press('Control+n');await page.getByRole('button',{name:'源码',exact:true}).click()
const source='<!-- yeran:pages {"default":"portrait","pages":{"2":"landscape"}} -->\n\n# Native math\n\n$$\n\\frac{1}{2}+\\sum_{i=1}^{n}i\n$$\n\n<!-- pagebreak -->\n\nSecondNativeToken\n\n<!-- pagebreak -->\n\nThirdNativeToken'
await page.getByLabel('Markdown 源码内容',{exact:true}).fill(source);await page.getByRole('button',{name:'应用修改',exact:true}).click();await page.locator('.katex').waitFor();await page.getByRole('button',{name:'打印',exact:true}).click();await page.waitForFunction(()=>!!document.querySelector('iframe.direct-print-frame'))
const html=await page.evaluate(()=>document.querySelector('iframe.direct-print-frame')?.getAttribute('srcdoc')||null);assert.ok(html);const printPage=await browser.newPage();await printPage.setContent(html);await printPage.evaluate(()=>document.fonts.ready);assert.equal(await printPage.locator('.pdf-sheet').count(),3);assert.deepEqual(await printPage.locator('.pdf-sheet').evaluateAll(es=>es.map(e=>[e.offsetWidth,e.offsetHeight])),[[794,1123],[1123,794],[794,1123]]);await printPage.close();await invoke('export_pdf',{html,path:path.join(out,'native-live-math-mixed.pdf')});await page.screenshot({path:path.join(out,'native-print.png')});await page.keyboard.press('Control+w');await page.getByRole('button',{name:'放弃修改',exact:true}).click();assert.equal(await page.getByRole('tab').count(),tabCount);assert.equal(await page.locator('.paper-editor').innerText(),originalText)
await page.addInitScript(()=>{if(window!==window.top)window.print=()=>window.parent.postMessage('native-direct-print-test','*')})
await page.evaluate(()=>{window.__nativeDirect=0;if(window.__nativeListener)window.removeEventListener('message',window.__nativeListener);window.__nativeListener=event=>{if(event.data==='native-direct-print-test')window.__nativeDirect++};window.addEventListener('message',window.__nativeListener)})
await page.getByRole('button',{name:'打印',exact:true}).click();await page.waitForFunction(()=>window.__nativeDirect===1);assert.equal(await page.locator('.print-preview').count(),0);assert.ok(await page.locator('.direct-print-frame').count());await page.evaluate(()=>document.querySelector('.direct-print-frame').contentWindow.dispatchEvent(new Event('afterprint')));assert.equal(await page.locator('.paper-editor').innerText(),originalText)
console.log('PASS actual release math rendering, mixed preview, native live export and original document preservation')
await writeFile(path.join(out,'verification.json'),JSON.stringify({atomicWrite:true,staleSave:true,history:true,externalStatus:true,edgeMixedExport:true,nativeMathAndMixedPreview:true,originalPreserved:true,directPrintFrame:true,physicalPrintVerified:false},null,2))
}finally{await browser.close()}
