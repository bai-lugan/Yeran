import {chromium} from '@playwright/test'
import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
const out='.oil-ui/yeran-12';await mkdir(out,{recursive:true})
const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000},colorScheme:'light'}),results=[],errors=[],runtimeRequests=[]
page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());page.on('request',r=>{if(r.resourceType()==='script'&&new URL(r.url()).pathname.endsWith('/mermaid.js'))runtimeRequests.push(r.url())})
const test=async(name,fn)=>{await fn();results.push(name);console.log('PASS '+name)}
const settle=async()=>{await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await page.waitForTimeout(70)}
const reset=text=>page.evaluate(text=>window.__yeran.replaceDocument(text,null,null,false),text)
const raw=()=>page.evaluate(()=>window.__yeran.getMarkdown())
const mode=async value=>{await page.evaluate(v=>window.__yeran.viewMode.value=v,value);await settle()}
const diagram=source=>'```mermaid\n'+source+'\n```'
const flow='flowchart LR\n  A[开始] --> B{检查}\n  B -->|通过| C[完成]\n  B -->|修改| A'
const fixture='<table><tr><th><p>时间戳</p></th><th><p>说明</p></th></tr><tr><td><p><strong>可以多条，本例 3 条</strong>：<br><code>2025-01-11 02:03:19</code> ← First<br><code>2025-01-11 02:03:18</code><br><code>2025-01-11 02:03:18</code></p></td><td><p>other</p></td></tr></table><p>after</p>'
const setFixture=async()=>{await reset('');await page.evaluate(html=>window.__yeran.editor.chain().setContent(html).command(({tr})=>{tr.setMeta('addToHistory',false);return true}).run(),fixture)}
const sourceEdit=async text=>{await page.evaluate(()=>{const e=window.__yeran.editor;let pos;e.state.doc.descendants((n,p)=>{if(pos===undefined&&n.type.name==='codeBlock')pos={from:p+1,to:p+n.nodeSize-1}});e.chain().focus().setTextSelection(pos).run()});await page.keyboard.insertText(text);await settle()}
const ready=async(count=1)=>{await page.waitForTimeout(230);await page.waitForFunction(n=>document.querySelectorAll('.mermaid-preview svg').length===n&&!document.querySelector('.mermaid-preview[aria-busy]'),count);await settle()}
try{
 await page.goto(process.env.YERAN_TEST_URL||'http://127.0.0.1:15420');await page.waitForFunction(()=>window.__yeran)
 await test('ordinary Markdown does not load the Mermaid runtime',async()=>{await reset('# 普通文稿\n\n正文');await settle();assert.deepEqual(runtimeRequests,[])})
 await test('page furniture has no block handle; real heading and code block menus still work',async()=>{
  await reset('# 标题\n\n```python\nprint(1)\n```\n\n正文');await mode('pages')
  for(const selector of ['.paper-editor','.paper-editor>[data-rm-pagination]','.rm-first-page-header']){const el=page.locator(selector).first();if(await el.count()){await el.dispatchEvent('mousemove',{bubbles:true});await settle();assert.equal(await page.locator('.block-grip').count(),0)}}
  await page.locator('.paper-editor h1').hover();await page.locator('.block-grip').click();await page.getByRole('menuitem',{name:'创建副本',exact:true}).click();assert.equal(await page.locator('.paper-editor h1').count(),2);await page.keyboard.press('Control+z');assert.equal(await page.locator('.paper-editor h1').count(),1)
  await page.locator('.code-block pre').hover();await page.locator('.block-grip').click();await page.getByRole('menuitem',{name:'创建副本',exact:true}).click();assert.equal(await page.locator('.code-block').count(),2);await page.keyboard.press('Control+z');assert.equal(await page.locator('.code-block').count(),1)
  await page.locator('.paper-editor>[data-rm-pagination]').dispatchEvent('mousemove',{bubbles:true});await settle();assert.equal(await page.locator('.block-grip').count(),0)
 })
 await test('table line-start carets have visible geometry and type into the correct code line in both layouts',async()=>{
  for(const m of ['pages','continuous']){
   await setFixture();await mode(m);await settle();const before=await raw()
   for(let i=0;i<3;i++){
    const code=page.locator('.paper-editor td code').nth(i);await code.click();await page.keyboard.press('Home');await settle()
    const state=await page.evaluate(index=>{const e=window.__yeran.editor,starts=[];e.state.doc.descendants((n,pos)=>{if(n.isText&&n.marks.some(m=>m.type.name==='code'))starts.push(pos)});const s=getSelection(),r=s.getRangeAt(0),rect=[...r.getClientRects()].find(r=>r.height>0),coords=e.view.coordsAtPos(e.state.selection.from);return{pos:e.state.selection.from,expected:starts[index],rect:rect?.toJSON(),coords,insideCodeWidget:!!document.querySelector('td code .ProseMirror-widget')}},i)
    assert.equal(state.pos,state.expected);assert.ok(state.coords.bottom-state.coords.top>=10);assert.ok(state.rect&&state.rect.height>=10);assert.ok(Math.abs(state.coords.top-state.rect.top)<3);assert.equal(state.insideCodeWidget,false)
    await page.screenshot({path:`${out}/caret-${m}-${i}.png`,caret:'initial'})
    await page.keyboard.insertText('X');await settle();assert.match(await page.evaluate(pos=>window.__yeran.editor.state.doc.textBetween(pos,pos+20),state.expected),/^X2025/);assert.equal(await page.locator('.paper-editor td code').count(),3);await page.keyboard.press('Control+z');await settle();assert.equal(await raw(),before)
   }
   const ys=await page.locator('td code').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().top));assert.ok(ys[1]-ys[0]<30&&ys[2]-ys[1]<30,'No spurious blank lines')
  }
 })
 await test('hard-break spacers stay outside marks in mixed pages and survive undo and repeated-header layouts',async()=>{
  await reset('<!-- yeran:pages {"default":"portrait","pages":{"2":"landscape"}} -->\n\n# Mixed\n\n'+Array.from({length:20},(_,i)=>`line ${i}\\\n\`2025-01-11 02:03:18\`\\\nlast`).join('\n\n'));await mode('pages');await settle();assert.equal(await page.locator('.paper-editor code .ProseMirror-widget').count(),0)
  const code=page.locator('.paper-editor code').nth(10);await code.scrollIntoViewIfNeeded();await code.click();await page.keyboard.press('Home');await settle();const height=await page.evaluate(()=>{const e=window.__yeran.editor,r=e.view.coordsAtPos(e.state.selection.from);return r.bottom-r.top});assert.ok(height>=10);await page.keyboard.insertText('M');await page.keyboard.press('Control+z');await settle();assert.match(await raw(),/yeran:pages/)
 })
 await test('Mermaid renders flow and sequence diagrams and preserves fenced Markdown source',async()=>{
  const text='# Mermaid\n\n'+diagram(flow)+'\n\n'+diagram('sequenceDiagram\n  用户->>页然: 打开文稿\n  页然-->>用户: 显示图表');await reset(text);await mode('pages');await ready(2)
  assert.equal(runtimeRequests.length,1);assert.ok(await page.locator('.mermaid-preview foreignObject').count()>0);assert.match(await page.locator('.mermaid-preview').first().innerText(),/开始/);assert.ok((await raw()).includes(diagram(flow)));assert.equal((await raw()).includes('<svg'),false);assert.equal(await page.locator('.mermaid-block>pre:visible').count(),0);await page.screenshot({path:out+'/mermaid-light.png'})
 })
 await test('slash menu inserts an editable Mermaid block and code language switch keeps the source',async()=>{
  await reset('');await page.locator('.paper-editor').click();await page.keyboard.type('/mermaid');await page.getByRole('option',{name:/Mermaid 图表/}).click();await ready();assert.equal(await page.locator('.mermaid-block').count(),1);await page.getByRole('button',{name:'编辑图表',exact:true}).click();assert.equal(await page.locator('.mermaid-block pre:visible').count(),1)
  await sourceEdit(flow);await ready();await page.getByRole('button',{name:'查看图表',exact:true}).click();assert.equal(await page.locator('.mermaid-block pre:visible').count(),0)
  await page.getByLabel('代码语言').selectOption('python');assert.equal(await page.locator('.mermaid-preview:visible').count(),0);assert.equal(await page.locator('.code-block pre').innerText(),flow);await page.getByLabel('代码语言').selectOption('mermaid');await ready();assert.equal(await page.locator('.mermaid-block pre:visible').count(),0)
 })
 await test('typing a Mermaid fence opens its source instead of leaving an invisible text cursor',async()=>{
  await reset('');await page.locator('.paper-editor').click();await page.keyboard.type('```mermaid');await page.keyboard.press('Enter');await settle();assert.equal(await page.locator('.mermaid-block pre:visible').count(),1);await page.keyboard.insertText(flow);await ready();assert.ok((await raw()).includes(diagram(flow)))
 })
 await test('diagram edits support undo/redo and invalid syntax recovers without stale render results',async()=>{
  await reset(diagram(flow));await ready();await page.getByRole('button',{name:'编辑图表',exact:true}).click();await sourceEdit('flowchart LR\n  X[Changed] --> Y[Done]');await ready();assert.match(await page.locator('.mermaid-preview svg').textContent(),/Changed/)
  await page.keyboard.press('Control+z');await ready();assert.ok((await raw()).includes(diagram(flow)));await page.keyboard.press('Control+y');await ready();assert.match(await raw(),/Changed/)
  await sourceEdit('flowchart LR\n A[broken');await page.locator('.mermaid-error').waitFor();assert.match(await raw(),/broken/);await sourceEdit('flowchart LR\n Final[最新内容] --> Ready[已完成]');await ready();assert.equal(await page.locator('.mermaid-error').count(),0);assert.match(await page.locator('.mermaid-preview svg').textContent(),/最新内容/)
 })
 await test('diagram syntax cannot activate links or HTML and needs no network requests',async()=>{
  const remote=[];page.on('request',r=>{if(r.url().includes('yeran-security.invalid'))remote.push(r.url())});await reset(diagram('%%{init: {"securityLevel":"loose","htmlLabels":true}}%%\nflowchart LR\n A["<img src=\'https://yeran-security.invalid/x\' onerror=\'alert(1)\'>"] --> B[Safe]\n click B "javascript:alert(1)"'));await ready();assert.equal(await page.locator('.mermaid-preview a,.mermaid-preview image,.mermaid-preview img,.mermaid-preview [onerror],.mermaid-preview script').count(),0);assert.deepEqual(remote,[])
 })
 await test('state, class, ER, Gantt and pie diagrams render with the full runtime',async()=>{
  const examples=['stateDiagram-v2\n [*] --> Draft\n Draft --> Done','classDiagram\n class Document {\n +save()\n }','erDiagram\n USER ||--o{ DOCUMENT : writes','gantt\n title Plan\n dateFormat YYYY-MM-DD\n section Write\n Draft :2026-11-01, 2d','pie title Tasks\n "Done" : 3\n "Draft" : 2'];await reset(examples.map(diagram).join('\n\n'));await ready(5);assert.equal(await page.locator('.mermaid-error').count(),0)
 })
 await test('preview/print waits for charts, omits source, restores the open editor and stays light in dark mode',async()=>{
  await reset('# 图表与打印\n\n'+diagram(flow)+'\n\n打印后内容');await ready();await page.getByRole('button',{name:'编辑图表',exact:true}).click();await sourceEdit('flowchart LR\n A[最后修改] --> B[可打印]');const before=await raw(),html=await page.evaluate(()=>window.__yeran.createPrintHtml());assert.equal(await page.locator('.mermaid-block pre:visible').count(),1);assert.equal(await raw(),before)
  const print=await browser.newPage({viewport:{width:900,height:1200},colorScheme:'dark'});await print.setContent(html);assert.equal(await print.locator('.mermaid-preview svg').count(),1);assert.match(await print.locator('.mermaid-preview svg').textContent(),/最后修改/);assert.equal(await print.locator('.code-controls,.mermaid-block>pre').count(),0);assert.equal(await print.locator('.pdf-sheet').count(),1);await print.pdf({path:out+'/mermaid-output.pdf',printBackground:true,preferCSSPageSize:true});await print.screenshot({path:out+'/mermaid-print.png'});await print.close()
  await page.getByRole('button',{name:'查看图表',exact:true}).click();await page.emulateMedia({colorScheme:'dark'});await settle();await page.screenshot({path:out+'/mermaid-dark.png'});const again=await page.evaluate(()=>window.__yeran.createPrintHtml());assert.ok(again.includes('最后修改'));assert.equal(await raw(),before);await page.emulateMedia({colorScheme:'light'})
 })
 await test('diagram controls translate and deleting a diagram during rendering leaves the editor usable',async()=>{
  await page.getByLabel('界面语言').selectOption('en');assert.equal(await page.getByRole('button',{name:'Edit diagram',exact:true}).count(),1);await page.getByLabel('Interface language').selectOption('zh-TW');assert.equal(await page.getByRole('button',{name:'編輯圖表',exact:true}).count(),1);await page.getByLabel('介面語言').selectOption('zh-CN')
  await reset(diagram(flow));await reset('完成');await settle();assert.equal(await page.locator('.mermaid-block').count(),0);assert.equal((await raw()).trim(),'完成');assert.deepEqual(errors,[])
 })
 await writeFile(out+'/verification.json',JSON.stringify({passed:results.length,results,errors,runtimeRequests},null,2))
}catch(error){console.error('FAIL',error);await page.screenshot({path:out+'/failure.png',caret:'initial'}).catch(()=>{});throw error}finally{await browser.close()}
