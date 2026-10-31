import { chromium } from '@playwright/test'
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
const out='.oil-ui/yeran-04';await mkdir(out,{recursive:true})
const browser=await chromium.launch({channel:'msedge',headless:true})
const context=await browser.newContext({viewport:{width:1440,height:1000}}), page=await context.newPage(), errors=[], results=[]
page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept())
async function ready(){await page.waitForFunction(()=>!!window.__yeran)}
async function reset(markdown){await page.evaluate(md=>window.__yeran.replaceDocument(md,null,null),markdown);await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))}
async function md(){return page.evaluate(()=>window.__yeran.getMarkdown())}
async function test(name,run){await run();results.push(name);console.log('PASS',name)}
const table='# 表格操作\n\n| 项目 | 数量 |\n| --- | --- |\n| 苹果 | 10 |\n| 梨 | 20 |\n| 桃 | 30 |\n\n表格外的正文。'
try{
await page.goto((process.env.YERAN_TEST_URL || 'http://127.0.0.1:1420'));await ready()
await test('all six Markdown heading levels survive opening and saving',async()=>{
  await reset('# One\n\n## Two\n\n### Three\n\n#### Four\n\n##### Five\n\n###### Six');assert.equal(await page.locator('.paper-editor h1,.paper-editor h2,.paper-editor h3,.paper-editor h4,.paper-editor h5,.paper-editor h6').count(),6);const saved=await md();assert.match(saved,/###### Six/);await reset(saved);assert.equal(await page.locator('.paper-editor h6').textContent(),'Six')
})
// One shared grip: move the pointer onto the table's left border for that row to reveal it.
async function rowGrip(index){
  const row=await page.locator('.paper-editor tr').nth(index).boundingBox()
  await page.mouse.move(row.x+4,row.y+row.height/2)
  await page.waitForFunction(()=>{const grip=document.querySelector('.table-row-handle');return grip&&!grip.hidden})
  return page.locator('.table-row-handle')
}
await test('selected tables and row handles support Delete/Backspace and undo',async()=>{
  for(const key of ['Delete','Backspace']){
    await reset(table);const original=await md();await page.locator('.paged-table').hover();await page.getByRole('button',{name:'选择整个表格',exact:true}).click();await page.keyboard.press(key);assert.equal(await page.locator('table').count(),0);assert.ok((await md()).includes('表格外的正文'));await page.keyboard.press('Control+z');assert.equal(await md(),original)
    await reset(table);await (await rowGrip(1)).click();await page.keyboard.press(key);assert.equal(await page.locator('.paper-editor tr').count(),3);assert.ok(!(await md()).includes('苹果'));await page.keyboard.press('Control+z');assert.equal(await md(),original)
  }
})
await test('single row grip selects and drags whole rows with undo',async()=>{
  await reset(table);const before=await md()
  // One shared grip for the whole table, revealed near the left border.
  assert.equal(await page.locator('.table-row-handle').count(),1)
  const header=await page.locator('.paper-editor tr').nth(0).boundingBox()
  await page.mouse.move(header.x+4,header.y+header.height/2)
  await page.waitForFunction(()=>{const g=document.querySelector('.table-row-handle');return g&&!g.hidden})
  assert.equal(await page.locator('.table-row-handle').getAttribute('aria-label'),'选择表头行')
  // Hovering a data row retargets the same single grip.
  const grip=await rowGrip(1)
  assert.equal(await grip.getAttribute('aria-label'),'选择第 2 行')
  await grip.click()
  assert.equal(await page.locator('.paper-editor .selectedCell').count(),2)
  const last=await page.locator('.paper-editor tr').last().boundingBox()
  const source=await grip.boundingBox()
  await page.mouse.move(source.x+source.width/2,source.y+source.height/2)
  await page.mouse.down()
  await page.mouse.move(last.x+120,last.y+last.height-2,{steps:14})
  const ghostVisible=await page.locator('.table-drag-ghost').count()
  await page.mouse.up()
  const moved=await md();assert.equal(ghostVisible,1,'Dragging a row must show a visible ghost');assert.ok(moved.indexOf('桃')<moved.indexOf('苹果'),'Dragged row must move below the last data row');assert.match(moved,/\| 项目/)
  await page.keyboard.press('Control+z');assert.equal(await md(),before)
  await (await rowGrip(2)).click();await page.keyboard.press('Alt+ArrowUp');assert.ok((await md()).indexOf('梨')<(await md()).indexOf('苹果'))
})
await test('find spans marks; replace-all is literal, scoped and undoable',async()=>{
  await reset('# 查找测试\n\nHello **World**，hello world。\n\nHELLO WORLD 和中文测试。')
  const before=await md();await page.keyboard.press('Control+h');await page.getByLabel('查找内容',{exact:true}).fill('hello world');await page.getByText('1 / 3',{exact:true}).waitFor();assert.equal(await page.locator('.find-match').count(),4)
  await page.getByLabel('替换为',{exact:true}).fill('$1 替换');await page.getByRole('button',{name:'全部替换',exact:true}).click();assert.equal(((await md()).match(/\$1 替换/g)||[]).length,3);await page.getByRole('button',{name:'关闭查找',exact:true}).click();await page.keyboard.press('Control+z');assert.equal(await md(),before)
})
await test('manual page breaks survive Markdown and move following text to the next sheet',async()=>{
  await reset('# 第一张纸\n\n前面的内容。\n\n后面的内容。')
  await page.evaluate(()=>{const ed=window.__yeran.editor;ed.state.doc.descendants((node,pos)=>{if(node.isText&&node.text.includes('后面的内容'))ed.commands.setTextSelection(pos)})})
  await page.getByRole('button',{name:'插入分页符',exact:true}).click();assert.ok((await md()).includes('<!-- pagebreak -->'))
  await page.locator('.paper-editor').focus();await page.keyboard.insertText('分页后继续输入');assert.ok((await md()).includes('<!-- pagebreak -->'));assert.ok((await md()).includes('分页后继续输入'))
  const saved=await md();await reset(saved);await page.locator('.manual-page-break').waitFor()
  await page.waitForFunction(()=>{const root=document.querySelector('.paper-editor'), p=[...root.querySelectorAll('p')].find(p=>p.textContent.includes('后面的内容')),scale=root.getBoundingClientRect().width/root.offsetWidth;const range=document.createRange();range.selectNodeContents(p);return(range.getBoundingClientRect().top-root.getBoundingClientRect().top)/scale>1123})
  await page.screenshot({path:out+'/manual-break.png'})
})
await test('repeated headers are rendered on later pages without changing Markdown',async()=>{
  const source='# 长表\n\n| 编号 | 表头名称 |\n| --- | --- |\n'+Array.from({length:55},(_,i)=>`| ${i+1} | 数据 ${i+1} |`).join('\n')
  await reset(source);await page.waitForFunction(()=>document.querySelectorAll('.repeat-header-widget').length>=2)
  const original=await md()
  const html=await page.evaluate(()=>window.__yeran.createPrintHtml());const print=await context.newPage();await print.setContent(html);await print.evaluate(()=>document.fonts.ready);await print.screenshot({path:out+'/repeat-headers.png'});assert.equal(await md(),original);await print.pdf({path:out+'/repeated-headers.pdf',printBackground:true,preferCSSPageSize:true});await print.close();await writeFile(out+'/repeated-headers.html',html)
})
await test('code, equations, quotes, toggles and text formatting roundtrip and export',async()=>{
  const source='# 基础块\n\n> 引用里的文字。\n\n```python\nprint("hello")\n```\n\n$$\n\\frac{1}{2} + \\sum_{i=1}^{n} i\n$$\n\n<details>\n<summary>可以折叠的内容</summary>\n\n折叠中的正文。\n\n</details>\n\n- [ ] 待办事项\n\n普通段落。'
  await reset(source);assert.equal(await page.locator('blockquote').count(),1);assert.equal(await page.locator('.code-block').count(),1);await page.locator('.katex').waitFor();assert.equal(await page.locator('details').count(),1)
  await page.getByLabel('代码语言',{exact:true}).selectOption('javascript');assert.ok((await md()).includes('```javascript'))
  await page.locator('summary .toggle-arrow').click();assert.equal(await page.locator('details').evaluate(el=>el.open),false)
  const saved=await md();assert.ok(saved.includes('$$'));assert.ok(saved.includes('<details>'));await reset(saved);await page.locator('.katex').waitFor();assert.ok((await page.locator('[data-toggle-content]').textContent()).includes('折叠中的正文'))
  if(await page.locator('details').evaluate(el=>el.open))await page.locator('summary .toggle-arrow').click();const html=await page.evaluate(()=>window.__yeran.createPrintHtml());assert.equal(await page.locator('details').evaluate(el=>el.open),false);assert.ok(html.includes('data:font')||html.includes('data:application'))
  const print=await context.newPage();await print.setContent(html);await print.evaluate(()=>document.fonts.ready);await print.pdf({path:out+'/blocks.pdf',preferCSSPageSize:true,printBackground:true});await print.screenshot({path:out+'/blocks-export.png'});await print.close();await writeFile(out+'/blocks.html',html)
})
await test('underline, highlight, links and paragraph alignment survive Markdown saving',async()=>{
  await reset('格式测试文本');await page.evaluate(()=>window.__yeran.editor.commands.setTextSelection({from:1,to:7}))
  await page.getByRole('button',{name:'更多文字格式',exact:true}).click();await page.getByRole('button',{name:'下划线',exact:true}).click();await page.getByRole('button',{name:'文字高亮',exact:true}).click();await page.getByRole('button',{name:'段落居中',exact:true}).click();await page.getByRole('button',{name:'编辑链接',exact:true}).click();await page.getByLabel('链接地址',{exact:true}).fill('https://example.com');await page.getByRole('button',{name:'应用',exact:true}).click()
  const saved=await md();await reset(saved);assert.equal(await page.locator('.paper-editor u').count(),1);assert.equal(await page.locator('.paper-editor mark').count(),1);assert.equal(await page.locator('.paper-editor a').getAttribute('href'),'https://example.com');assert.equal(await page.locator('.paper-editor > p').first().evaluate(el=>getComputedStyle(el).textAlign),'center')
})
await test('file versions persist, open in a new tab and preserve the current file',async()=>{
  await page.evaluate(()=>{window.__disk={text:'# 文件版本\n\n最初版本',stamp:100};const handle={name:'versions.md',getFile:async()=>({name:'versions.md',lastModified:window.__disk.stamp,text:async()=>window.__disk.text}),createWritable:async()=>({write:async text=>window.__disk.text=text,close:async()=>window.__disk.stamp++})};window.showOpenFilePicker=async()=>[handle]})
  await page.getByRole('button',{name:'打开 Markdown',exact:true}).click();await page.getByRole('tab',{name:/versions.md/}).waitFor()
  for(const text of ['版本一','版本二']){await page.evaluate(()=>window.__yeran.editor.commands.focus('end'));await page.locator('.paper-editor').focus();await page.keyboard.insertText(text);await page.keyboard.press('Control+s');await page.waitForFunction(()=>!window.__yeran.tabs.value.find(tab=>tab.id===window.__yeran.activeId.value).dirty)}
  const file=await md();await page.getByRole('button',{name:'文件历史',exact:true}).click();await page.getByRole('dialog',{name:'文件历史'}).waitFor();await page.waitForFunction(()=>document.querySelectorAll('.history-body nav button').length>=3);await page.locator('.history-body nav button').nth(1).click();await page.waitForFunction(()=>document.querySelector('.history-preview textarea')?.value.includes('版本一')&&!document.querySelector('.history-preview textarea')?.value.includes('版本二'))
  await page.screenshot({path:out+'/history.png'});await page.getByRole('button',{name:'在新标签打开此版本',exact:true}).click();assert.ok((await md()).includes('版本一'));assert.ok(!(await md()).includes('版本二'));assert.ok(await page.evaluate(content=>window.__yeran.tabs.value.some(tab=>tab.path==='versions.md'&&tab.markdown===content),file))
})
await test('external reload preserves unsaved edits and cancellation leaves content intact',async()=>{
  await page.getByRole('tab',{name:/^versions.md/}).click();await page.evaluate(()=>window.__yeran.editor.commands.focus('end'));await page.locator('.paper-editor').focus();await page.keyboard.insertText('本地未保存')
  await page.evaluate(()=>{window.__disk.text='# 磁盘外部版本\n\n外部更新';window.__disk.stamp++;return window.__yeran.checkExternal()})
  await page.getByRole('button',{name:'从磁盘重新加载',exact:true}).click();await page.getByRole('dialog',{name:'重新加载磁盘版本'}).waitFor();await page.getByRole('button',{name:'取消',exact:true}).click();assert.ok((await md()).includes('本地未保存'))
  await page.getByRole('button',{name:'从磁盘重新加载',exact:true}).click();await page.getByRole('button',{name:'保留草稿并重新加载',exact:true}).click();await page.waitForFunction(()=>window.__yeran.getMarkdown().includes('外部更新'));assert.ok(await page.evaluate(()=>window.__yeran.tabs.value.some(tab=>!tab.path&&tab.markdown.includes('本地未保存'))))
})
await test('history checkpoint failure refuses file overwrite and keeps the dirty draft',async()=>{
  await page.evaluate(()=>{window.__failedDisk={text:'# Protected original',stamp:200,writes:0};window.showOpenFilePicker=async()=>[{name:'history-failure.md',getFile:async()=>({name:'history-failure.md',lastModified:window.__failedDisk.stamp,text:async()=>window.__failedDisk.text}),createWritable:async()=>{window.__failedDisk.writes++;return{write:async text=>window.__failedDisk.text=text,close:async()=>window.__failedDisk.stamp++}}}]})
  await page.getByRole('button',{name:'打开 Markdown',exact:true}).click();await page.getByRole('tab',{name:/history-failure.md/}).waitFor();await page.evaluate(()=>window.__yeran.editor.commands.focus('end'));await page.keyboard.insertText('Unsaved edit');const original=await md()
  await page.evaluate(()=>{window.__originalPut=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(){throw new Error('History storage unavailable')}})
  try{await page.keyboard.press('Control+s');await page.getByRole('alert').filter({hasText:'History storage unavailable'}).waitFor();assert.equal(await md(),original);assert.deepEqual(await page.evaluate(()=>[window.__failedDisk.text,window.__failedDisk.writes]),['# Protected original',0]);assert.ok(await page.evaluate(()=>window.__yeran.tabs.value.find(tab=>tab.id===window.__yeran.activeId.value).dirty))}finally{await page.evaluate(()=>IDBObjectStore.prototype.put=window.__originalPut)}
  await page.getByRole('button',{name:'关闭错误提示',exact:true}).click()
})
await test('Simplified/Traditional/English switch only interface text and persist',async()=>{
  const content=await md();await page.getByLabel('界面语言',{exact:true}).selectOption('en');await page.getByRole('button',{name:'Print',exact:true}).waitFor();assert.equal(await md(),content);await page.getByRole('button',{name:'Page settings',exact:true}).click();await page.getByLabel('Orientation',{exact:true}).waitFor();await page.getByRole('button',{name:'Close page settings',exact:true}).click();await page.screenshot({path:out+'/english.png'})
  await page.getByLabel('Interface language',{exact:true}).selectOption('zh-TW');await page.getByRole('button',{name:'列印',exact:true}).waitFor();await page.reload();await ready();assert.equal(await page.locator('.language-select').inputValue(),'zh-TW');assert.equal(await md(),content)
  await page.locator('.language-select').selectOption('zh-CN');await page.setViewportSize({width:960,height:800});await page.screenshot({path:out+'/compact-960.png'});assert.ok((await page.locator('.toolbar').boundingBox()).height<50)
})
assert.deepEqual(errors,[]);await writeFile(out+'/verification.json',JSON.stringify({passed:results.length,results,errors},null,2));console.log(JSON.stringify({passed:results.length,errors}))
}catch(error){await page.screenshot({path:out+'/failure.png'});console.error(error);process.exitCode=1}finally{await browser.close()}
