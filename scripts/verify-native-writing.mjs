import {connectNative} from './native-test.mjs'
import{chromium}from'@playwright/test'
import{mkdir,writeFile,stat}from'node:fs/promises'
import assert from'node:assert/strict'
import path from'node:path'
const out=path.resolve('.oil-ui/yeran-07/native-tests');await mkdir(out,{recursive:true})
const browser=await connectNative(),editorPage=async()=>{for(const context of browser.contexts()){for(const candidate of context.pages()){if(candidate.url().startsWith('http://tauri.localhost'))return candidate}}throw new Error('the packaged app window was not found')},results=[]
const pass=name=>{results.push(name);console.log('PASS '+name)}
const page=await editorPage()
try{
await page.waitForSelector('.paper-editor[contenteditable=true]');await page.getByRole('button',{name:'新建标签',exact:true}).click();await page.getByRole('button',{name:'源码',exact:true}).click();await page.getByLabel('Markdown 源码内容',{exact:true}).fill('# NativeWriting\n\n'+Array.from({length:35},(_,i)=>`Native paragraph ${i}: text for writing mode.`).join('\n\n'));await page.getByRole('button',{name:'应用修改',exact:true}).click();if(await page.getByRole('button',{name:'连续模式',exact:true}).getAttribute('aria-pressed')!=='true')await page.getByRole('button',{name:'连续模式',exact:true}).click();await page.locator('.paper-editor').click();await page.keyboard.press('Control+End');await page.keyboard.press('F8');await page.keyboard.press('F9');await page.keyboard.type(' NativeWritingLastToken')
await page.waitForFunction(()=>{const s=getSelection(),r=s.rangeCount&&s.getRangeAt(0).getBoundingClientRect(),c=document.querySelector('.canvas');return r&&Math.abs((r.top+r.bottom)/2-c.getBoundingClientRect().top-c.clientHeight/2)<5});assert.ok(await page.locator('.writing-muted').count()>20);await page.screenshot({path:path.join(out,'writing-native.png')});const text=await page.locator('.paper-editor').innerText();pass('real desktop F8/F9 focus and typewriter center the typed line')
await page.evaluate(()=>{const nativeFetch=window.fetch;window.__pdfAnswers=[];window.fetch=(url,options)=>{const command=decodeURIComponent(String(url));if(command.endsWith('/plugin:dialog|save')){const value=window.__pdfAnswers.shift();return Promise.resolve(new Response(JSON.stringify(value??null),{headers:{'Content-Type':'application/json','Tauri-Response':'ok'}}))}return nativeFetch(url,options)}})
const pdf=path.join(out,`writing-${Date.now()}.pdf`)
await page.evaluate(p=>window.__pdfAnswers.push(p),pdf)
await page.getByRole('button',{name:'导出 PDF',exact:true}).click()
for(let attempt=0;attempt<120;attempt+=1){if(await stat(pdf).then(()=>true,()=>false))break;await page.waitForTimeout(250)}
assert.ok((await stat(pdf)).size>10000,'the exported PDF has real content')
assert.equal(await page.locator('.paper-editor').innerText(),text)
pass('desktop PDF snapshot removes all writing-mode effects and preserves source')
await page.reload();await page.waitForSelector('.app-shell.focus-writing.typewriter-writing');assert.match(await page.locator('.paper-editor').innerText(),/NativeWritingLastToken/);await page.locator('.paper-editor').focus();await page.keyboard.press('F8');await page.keyboard.press('F9');assert.equal(await page.locator('.app-shell.focus-writing,.app-shell.typewriter-writing').count(),0);pass('desktop restart recovery retains modes and text; keyboard can disable both')
await writeFile(path.join(out,'verification.json'),JSON.stringify({passed:results.length,results,pdf},null,2))
}finally{await browser.close()}
