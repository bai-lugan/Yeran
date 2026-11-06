import {connectNative,nativePage} from './native-test.mjs'
import assert from 'node:assert/strict'
import {mkdir,readFile,writeFile} from 'node:fs/promises'
import path from 'node:path'
const out=path.resolve('.oil-ui/yeran-21/native',String(Date.now()));await mkdir(out,{recursive:true})
const browser=await connectNative(),page=await nativePage(browser),results=[],errors=[];page.setDefaultTimeout(18000);page.on('pageerror',e=>errors.push(e.stack))
const invoke=cmd=>page.evaluate(cmd=>window.__TAURI_INTERNALS__.invoke(cmd),cmd)
assert.equal(await invoke('plugin:app|identifier'),'com.yeran.editor.qa21');assert.equal(await invoke('plugin:app|version'),'2.0.1')
const test=async(name,fn)=>{await fn();results.push(name);console.log('PASS '+name)},settle=()=>page.waitForTimeout(180)
let current
const open=async(name,text='')=>{current=path.join(out,name);await writeFile(current,text);await page.evaluate(file=>window.__open.push([file]),current);await page.keyboard.press('Control+o');await page.waitForFunction(file=>document.querySelector('.document-tab.active')?.title===file,current);await settle()}
const save=async()=>{await page.keyboard.press('Control+s');await page.waitForFunction(()=>!document.querySelector('.document-tab.active .tab-dirty'));await settle();return readFile(current,'utf8')}
const paste=async(text,html='')=>{await page.evaluate(({text,html})=>{const d=new DataTransfer();d.setData('text/plain',text);if(html)d.setData('text/html',html);document.querySelector('.paper-editor').dispatchEvent(new ClipboardEvent('paste',{bubbles:true,cancelable:true,clipboardData:d}))},{text,html});await settle()}
const endCode=async()=>{await page.locator('.code-block pre').first().click();await page.keyboard.press('Control+a');await page.keyboard.press('ArrowRight');await settle()}
try{
 await page.evaluate(()=>{window.__open=[];const fetch=window.fetch;window.fetch=(url,options)=>decodeURIComponent(String(url)).split('/').at(-1)==='plugin:dialog|open'?Promise.resolve(new Response(JSON.stringify(window.__open.shift()??null),{headers:{'Content-Type':'application/json','Tauri-Response':'ok'}})):fetch(url,options);window.__copiedCode='';navigator.clipboard.writeText=async text=>window.__copiedCode=text;window.__plain='';navigator.clipboard.readText=async()=>window.__plain})
 await test('packaged editor opens a typed language fence, closes it into prose and saves only code content',async()=>{
  await open('typed.md');await page.locator('.paper-editor>p').first().click();await page.keyboard.type('```python');await page.keyboard.press('Enter');await page.keyboard.type('print(1)');await page.keyboard.press('Enter');await page.keyboard.type('```');await page.keyboard.press('Enter');await page.keyboard.type('After');assert.equal(await page.locator('.code-block code').textContent(),'print(1)');assert.match(await save(),/^```python\nprint\(1\)\n```\n\nAfter/)
 })
 await test('packaged code paste unwraps a complete outer fence and Copy code excludes the wrapper',async()=>{
  await open('inside.md','```\n\n```');await endCode();await paste('```powershell\r\nGet-Date\r\n  Write-Host "ok"\r\n```');assert.equal(await page.locator('.code-block code').textContent(),'Get-Date\n  Write-Host "ok"');assert.equal(await page.getByLabel('代码语言',{exact:true}).inputValue(),'powershell');await page.getByRole('button',{name:'复制代码',exact:true}).click();assert.equal(await page.evaluate(()=>window.__copiedCode),'Get-Date\n  Write-Host "ok"');assert.match(await save(),/^```powershell\nGet-Date\n  Write-Host "ok"\n```/)
 })
 await test('packaged partial paste preserves the current language and nested Markdown fences survive save/reopen',async()=>{
  await open('partial.md','```python\nleft-right\n```');await endCode();await page.keyboard.press('Home');for(let i=0;i<5;i++)await page.keyboard.press('ArrowRight');await paste('```bash\necho ok\n```');assert.equal(await page.locator('.code-block code').textContent(),'left-echo okright');assert.equal(await page.getByLabel('代码语言',{exact:true}).inputValue(),'python');await save();
  await open('nested.md','```\n\n```');await endCode();await paste('````markdown\n```python\nprint(2)\n```\n````');const saved=await save();assert.equal(saved.trim(),'````markdown\n```python\nprint(2)\n```\n````');await open('nested-reopened.md',saved);assert.equal(await page.locator('.code-block code').textContent(),'```python\nprint(2)\n```')
 })
 await test('packaged prose paste renders Mermaid with every label and saves valid Mermaid source',async()=>{
  await open('mermaid.md');await page.locator('.paper-editor>p').first().click();await paste('```mermaid\nflowchart LR\n A[Start] --> B[Done]\n```');await page.waitForSelector('.mermaid-preview svg');assert.equal(await page.locator('.nodeLabel').count(),2);assert.match(await save(),/^```mermaid\nflowchart LR\n A\[Start\] --> B\[Done\]\n```/);await page.screenshot({path:path.join(out,'mermaid-paste.png')})
 })
 await test('packaged plain-text menu and TXT editing keep fences literal without creating code blocks',async()=>{
  const source='```python\nprint(3)\n```';await open('literal.md');await page.locator('.paper-editor>p').first().click();await page.evaluate(text=>window.__plain=text,source);await page.locator('.paper-editor>p').first().click({button:'right'});await page.locator('.editor-context-menu').getByRole('menuitem',{name:'粘贴为纯文本',exact:true}).click();await settle();assert.equal(await page.locator('.code-block').count(),0);assert.ok((await page.locator('.paper-editor').innerText()).includes('```python'));
  await open('literal.txt');await page.locator('.paper-editor').click();await paste(source);assert.equal(await page.locator('.code-block').count(),0);assert.equal(await save(),source)
 })
 assert.deepEqual(errors,[]);await writeFile(path.join(out,'verification.json'),JSON.stringify({passed:results.length,results,errors},null,2));console.log('Native logs: '+out)
}catch(error){await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});throw error}finally{await browser.close()}
