import { chromium } from '@playwright/test'
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { performance } from 'node:perf_hooks'
const out = '.oil-ui/first-version/shots'
await mkdir(out, { recursive: true })
const browser = await chromium.launch({ channel: 'msedge', headless: true })
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true })
const page = await context.newPage()
const errors = []
page.on('pageerror', e => errors.push(e.message))
page.on('dialog', dialog => dialog.accept())
const results = []
async function test(name, fn) { const start = performance.now(); await fn(); results.push({ name, ms: Math.round(performance.now() - start), passed: true }); console.log('PASS', name) }
async function settle() {
  await page.waitForFunction(() => !!window.__yeran?.editor?.view?.dom.querySelector('[data-rm-pagination]'))
  // Observe consecutive matching page geometry, not a fixed render delay.
  await page.evaluate(() => new Promise(resolve => {
    let previous = '', stable = 0, count = 0
    function check() {
      const root = window.__yeran.editor.view.dom
      const state = `${root.offsetHeight}/${root.querySelector('[data-rm-pagination]')?.children.length}/${root.lastElementChild?.getBoundingClientRect().bottom}`
      stable = previous === state ? stable + 1 : 0; previous = state
      if (stable >= 8 || count++ > 150) resolve(null); else requestAnimationFrame(check)
    } requestAnimationFrame(check)
  }))
}
try {
await page.goto((process.env.YERAN_TEST_URL || 'http://127.0.0.1:1420'))
await settle()
const starter = await page.evaluate(() => window.__yeran.getMarkdown())
await test('initial document: editable, real A4 pages and outline', async () => {
  assert.equal(await page.locator('.paper-editor[contenteditable=true]').count(), 1)
  const metrics = await page.evaluate(() => ({ count: document.querySelector('[data-rm-pagination]').children.length, slices: window.__yeran.getPageSlices(), width: document.querySelector('.paper-editor').offsetWidth }))
  assert.equal(metrics.width, 794)
  assert.ok(metrics.count >= 2)
  assert.equal(metrics.count, metrics.slices.length)
  await page.screenshot({ path: `${out}/editor-desktop.png` })
  await page.getByRole('button', {name:'大纲',exact:true}).click()
  await page.getByRole('button', { name: '为下一页留一点空间', exact: false }).click()
  await page.waitForFunction(() => document.querySelector('.canvas').scrollTop > 0)
  await page.locator('.canvas').evaluate(el => { const gap = el.querySelector('.rm-pagination-gap'); el.scrollTop += gap.getBoundingClientRect().top - el.getBoundingClientRect().top - el.clientHeight / 2 })
  await page.screenshot({ path: `${out}/page-boundary.png` })
})
await test('Markdown roundtrip: headings, lists, links, code and table', async () => {
  const md = '# 中文标题\n\n**加粗内容**、*斜体内容*、[链接](https://example.com)。\n\n- 第一项\n- 第二项\n\n| 名称 | 数值 |\n| --- | --- |\n| 数据 | 42 |\n\n```js\nconst x = 42\n```'
  await page.evaluate(md => window.__yeran.replaceDocument(md, null, null), md)
  await settle()
  const roundtrip = await page.evaluate(() => window.__yeran.getMarkdown())
  for (const str of ['# 中文标题','**加粗内容**','https://example.com','第一项','数据','42','```js']) assert.ok(roundtrip.includes(str), `Missing ${str} in ${roundtrip}`)
  await page.getByRole('button', { name: '加粗', exact: true }).click()
  assert.equal(await page.locator('.paper-editor').count(), 1)
  const metadata = '---\ntitle: 中文元数据\ntags: [writing, paper]\n---\n'
  await page.evaluate(md => window.__yeran.replaceDocument(md, null, null), metadata + '# 有元数据的文稿\n\n正文')
  assert.ok((await page.evaluate(() => window.__yeran.getMarkdown())).startsWith(metadata))
})
let longMarkdown = '# 分页验收\n\n' + Array.from({ length: 38 }, (_, i) => `## 第 ${i + 1} 节\n\n段落标记${i}：` + '中文内容与 English text 需要在真实纸张内流动，修改第一页，后面的内容也应该继续保持完整。'.repeat(3)).join('\n\n')
await test('multi-page input, selection, undo, zoom and source editor', async () => {
  await page.evaluate(md => window.__yeran.replaceDocument(md, null, null), longMarkdown)
  await settle()
  assert.ok(await page.evaluate(() => window.__yeran.getPageSlices().length) >= 5)
  await page.evaluate(() => window.__yeran.editor.commands.focus('end')); await page.locator('.paper-editor').focus()
  await page.keyboard.insertText('跨页编辑终点测试')
  assert.ok((await page.evaluate(() => window.__yeran.getMarkdown())).includes('跨页编辑终点测试'))
  await page.keyboard.press('Control+z')
  assert.ok(!(await page.evaluate(() => window.__yeran.getMarkdown())).includes('跨页编辑终点测试'))
  await page.keyboard.press('Control+Shift+z')
  assert.ok((await page.evaluate(() => window.__yeran.getMarkdown())).includes('跨页编辑终点测试'))
  const before = await page.evaluate(() => window.__yeran.getPageSlices().length)
  await page.getByRole('button', { name: '缩小', exact: true }).click(); await settle()
  assert.equal(await page.evaluate(() => window.__yeran.getPageSlices().length), before)
  await page.getByRole('button', { name: '适合窗口', exact: true }).last().click()
  await page.getByRole('button', { name: '源码', exact: false }).click()
  await page.getByRole('textbox', { name: 'Markdown 源码内容' }).fill('# 源码应用测试\n\n修改后的正文')
  await page.getByRole('button', { name: '应用修改' }).click()
  assert.ok((await page.evaluate(() => window.__yeran.getMarkdown())).includes('修改后的正文'))
})
await test('Chinese composition does not replace the editable DOM', async () => {
  await page.evaluate(() => window.__yeran.editor.commands.focus('end')); await page.locator('.paper-editor').focus()
  const result = await page.evaluate(() => {
    const editor = window.__yeran.editor; const dom = editor.view.dom
    dom.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, data: '' }))
    editor.commands.insertContent('中文输入验收')
    dom.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '中文输入验收' }))
    return { same: dom === editor.view.dom, text: editor.getText() }
  })
  assert.ok(result.same); assert.ok(result.text.includes('中文输入验收'))
})
await test('draft recovery and settings persist after reload', async () => {
  await page.getByRole('button', { name: '页面设置', exact: true }).click()
  await page.getByLabel('页边距', { exact: true }).selectOption('25')
  await page.getByLabel('字号', { exact: true }).selectOption('18')
  await page.waitForFunction(() => { const session = JSON.parse(localStorage.getItem('yeran.session.v3') || '{}'); return session.tabs?.find(tab => tab.id === session.activeId)?.markdown.includes('中文输入验收') })
  const before = await page.evaluate(() => window.__yeran.getMarkdown())
  await page.reload(); await settle()
  assert.equal(await page.evaluate(() => window.__yeran.getMarkdown()), before)
  assert.equal(await page.evaluate(() => window.__yeran.layout.value.margin), 25)
  await page.getByRole('button', { name: '页面设置', exact: true }).click()
  await page.getByRole('button', { name: '恢复默认排版' }).click()
  await page.getByRole('button', { name: '关闭页面设置' }).click()
})
await test('failed recovery storage is reported and content remains editable', async () => {
  await page.evaluate(() => { window.__restoreStorage = Storage.prototype.setItem; Storage.prototype.setItem = () => { throw new DOMException('Quota exceeded','QuotaExceededError') }; window.__yeran.editor.commands.insertContent('恢复失败保留文字') })
  await page.getByRole('alert').filter({ hasText: '恢复草稿保存失败' }).waitFor()
  assert.ok((await page.evaluate(() => window.__yeran.getMarkdown())).includes('恢复失败保留文字'))
  await page.evaluate(() => { Storage.prototype.setItem = window.__restoreStorage; window.__yeran.editor.commands.insertContent('继续编辑正常') })
  await page.getByRole('button', { name: '关闭错误提示' }).click()
})
await test('file open/save through UI and save failure keeps changes', async () => {
  await page.evaluate(() => {
    let saved = ''; let modified = 1000
    const handle = { name: 'acceptance.md', getFile: async () => ({ name: 'acceptance.md', lastModified: modified, text: async () => '# 文件验收\n\n从文件打开' }), createWritable: async () => ({ write: async text => { saved = text; window.__savedMarkdown = text }, close: async () => { modified++ } }) }
    window.showOpenFilePicker = async () => [handle]
    window.showSaveFilePicker = async () => handle
  })
  await page.getByRole('button', { name: '打开 Markdown', exact: true }).click(); await settle()
  assert.ok((await page.evaluate(() => window.__yeran.getMarkdown())).includes('从文件打开'))
  await page.evaluate(() => window.__yeran.editor.commands.focus('end')); await page.locator('.paper-editor').focus()
  await page.keyboard.insertText('写回文件内容')
  await page.keyboard.press('Control+s')
  await page.waitForFunction(() => window.__savedMarkdown?.includes('写回文件内容'))
  await page.evaluate(() => { window.showSaveFilePicker = async () => { throw new DOMException('Permission denied','NotAllowedError') } })
  await page.keyboard.insertText('保存失败也保留')
  await page.getByRole('tab', { selected: true }).click({ button: 'right' })
  await page.getByRole('menuitem', { name: '另存为…', exact: true }).click()
  await page.getByRole('alert').filter({ hasText: 'Permission denied' }).waitFor()
  assert.ok((await page.evaluate(() => window.__yeran.getMarkdown())).includes('保存失败也保留'))
  await page.getByRole('button', { name: '关闭错误提示' }).click()
})
await test('long paragraph and long table paginate without losing text', async () => {
  const md = '# 长段落验收\n\n' + '长段连续输入不会丢字。'.repeat(500) + '\n\n## 跨页表格\n\n| 序号 | 内容 |\n| --- | --- |\n' + Array.from({length:65},(_,i)=>`| ${i+1} | 表格条目${i+1} |`).join('\n') + '\n\n表格结束标记'
  await page.evaluate(md => window.__yeran.replaceDocument(md, null, null), md)
  await settle()
  const data = await page.evaluate(() => ({ md: window.__yeran.getMarkdown(), slices: window.__yeran.getPageSlices() }))
  assert.equal(data.md.split('长段连续输入不会丢字。').length - 1, 500)
  assert.ok(data.md.includes('表格条目65')); assert.ok(data.md.includes('表格结束标记')); assert.ok(data.slices.length >= 5)
  const longHtml = await page.evaluate(() => window.__yeran.createPrintHtml())
  await writeFile(`${out}/long-export.html`, longHtml)
  await writeFile(`${out}/long-expected-text.json`, JSON.stringify(await page.evaluate(() => window.__yeran.editor.getText())))
  const longPrint = await context.newPage(); await longPrint.setContent(longHtml,{waitUntil:'load'})
  await longPrint.pdf({path:`${out}/long-acceptance.pdf`,preferCSSPageSize:true,printBackground:true}); await longPrint.close()
  await page.evaluate(() => window.__yeran.editor.commands.focus('end'))
  await page.screenshot({ path: `${out}/long-table.png` })
})
await test('export uses the editor page layout and vector PDF', async () => {
  await page.evaluate(md => window.__yeran.replaceDocument(md, null, null), starter)
  await settle()
  const html = await page.evaluate(() => window.__yeran.createPrintHtml())
  await writeFile(`${out}/export.html`, html)
  const print = await context.newPage()
  await print.setContent(html, { waitUntil: 'load' })
  await print.evaluate(() => document.fonts.ready)
  const count = await print.locator('.pdf-sheet').count()
  await writeFile(`${out}/expected-text.json`, JSON.stringify(await page.evaluate(() => window.__yeran.editor.getText())))
  const originalRows = await page.locator('.paper-editor tr').evaluateAll(rows => rows.map(row => row.getBoundingClientRect().width / (row.closest('.paper-editor').getBoundingClientRect().width / row.closest('.paper-editor').offsetWidth)))
  const printedRows = await print.locator('.pdf-sheet').first().locator('tr').evaluateAll(rows => rows.map(row => row.getBoundingClientRect().width))
  originalRows.forEach((width, i) => assert.ok(Math.abs(width - printedRows[i]) < 1, `PDF table column geometry drift: ${width} vs ${printedRows[i]}`))
  await print.pdf({ path: `${out}/acceptance.pdf`, preferCSSPageSize: true, printBackground: true })
  assert.equal(count, await page.evaluate(() => window.__yeran.getPageSlices().length))
  await print.screenshot({ path: `${out}/pdf-layout.png`, fullPage: true })
  await print.close()
})
await test('small desktop viewport has usable controls', async () => {
  await page.setViewportSize({ width: 960, height: 720 }); await settle()
  assert.ok(await page.getByRole('button', { name: '导出 PDF', exact: false }).isVisible())
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
  assert.equal(overflow, false)
  await page.screenshot({ path: `${out}/editor-960.png` })

})
await page.setViewportSize({width:1440,height:1000})
await page.evaluate(md => window.__yeran.replaceDocument(md, null, null), starter)
await settle()
await page.screenshot({path:`${out}/editor-final.png`})
await page.getByRole('button',{name:'页面设置',exact:true}).click()
await page.getByRole('region',{name:'页面设置'}).waitFor({state:'visible'})
await page.waitForFunction(() => getComputedStyle(document.querySelector('.settings-panel')).opacity === '1')
await page.screenshot({path:`${out}/settings.png`,animations:'disabled'})
assert.deepEqual(errors, [], 'Browser runtime errors')
await writeFile(`${out}/verification.json`, JSON.stringify({ results, errors }, null, 2))
console.log(JSON.stringify({ passed:results.length, errors },null,2))
} catch(e) { await page.screenshot({path:`${out}/failure.png`}); console.error(e); process.exitCode=1 }
finally { await browser.close() }
