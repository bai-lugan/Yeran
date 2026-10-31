import {connectNative} from './native-test.mjs'
import { chromium } from '@playwright/test'
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'

const out = process.env.YERAN_NATIVE_TABLE_OUT || '.oil-ui/yeran-06'
await mkdir(out, { recursive: true })
const browser = await connectNative()
const editorPage=async()=>{for(const context of browser.contexts()){for(const candidate of context.pages()){if(candidate.url().startsWith('http://tauri.localhost'))return candidate}}throw new Error('the packaged app window was not found')}
const page = await editorPage()
const errors = [], results = []
page.setDefaultTimeout(15000)
page.on('pageerror', error => errors.push(error.message))
const frames = () => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))))

const sample = [
  '# 桌面列把手',
  '',
  '| 名称 | 数量 | 说明 |',
  '| --- | --- | --- |',
  '| 苹果 | 10 | 待确认 |',
  '| 梨 | 20 | 已确认 |',
  '',
  '后续正文。',
].join('\n')

// The packaged build does not expose window.__yeran, so drive it like a user would:
// clear the document, insert a table from the toolbar, then fill it cell by cell.
const CELLS = [['名称', '数量', '说明'], ['苹果', '10', '待确认'], ['梨', '20', '已确认']]
async function reset() {
  await page.locator('.paper-editor').click()
  await page.keyboard.press('Control+a')
  await page.keyboard.press('Delete')
  await frames()
  await page.getByRole('button', { name: '插入表格', exact: true }).click()
  await page.locator('.paper-editor table').waitFor()
  await frames()
    for (const [row, values] of CELLS.entries()) {
    for (const [column, value] of values.entries()) {
      await page.locator('.paper-editor tr').nth(row).locator('th, td').nth(column).click()
      await page.keyboard.type(value)
    }
  }
  await frames()
  await page.mouse.move(20,120)
}
const headers = () => page.locator('.paper-editor tr').first().locator('th').allInnerTexts()
async function grip() {
  return page.evaluate(() => {
    const el = document.querySelector('.table-column-handle')
    if (!el || el.hidden) return null
    const b = el.getBoundingClientRect()
    return { x: b.x, y: b.y, width: b.width, height: b.height, label: el.getAttribute('aria-label') }
  })
}
async function hoverColumn(index) {
  const box = await page.locator('.paper-editor tr').first().locator('th').nth(index).boundingBox()
  assert.ok(box)
  await page.mouse.move(box.x + box.width / 2, box.y)
  await frames()
  return box
}
async function test(name, run) { await run(); results.push(name); console.log('PASS', name) }

try {
  await page.waitForSelector('.paper-editor[contenteditable=true]')
  const mode = page.getByRole('button', { name: '连续模式', exact: true })
  if (await mode.getAttribute('aria-pressed') === 'true') await mode.click()
  await page.waitForFunction(() => !!document.querySelector('.paper-editor .rm-page-header'), null, { timeout: 20000 })
  console.log('url', page.url())

  await test('body cells reveal vertical row and horizontal column grips with shared styling', async () => {
    await reset()
    const cell=await page.locator('.paper-editor tr').nth(1).locator('td').nth(1).boundingBox()
    await page.mouse.move(cell.x+cell.width/2,cell.y+cell.height*.85);await frames()
    assert.equal(await page.locator('.table-row-handle').getAttribute('aria-label'),'选择第 2 行')
    assert.equal(await page.locator('.table-column-handle').getAttribute('aria-label'),'选择第 2 列')
    assert.equal(await page.locator('.table-cell-menu-handle').count(),0);const appearance=await page.locator('.table-axis-handle').evaluateAll(es=>es.map(e=>{const s=getComputedStyle(e);return[e.innerHTML,s.width,s.height,s.border,s.backgroundColor,s.color,s.boxShadow]}));assert.equal(appearance[0][1],appearance[1][2]);assert.equal(appearance[0][2],appearance[1][1]);assert.deepEqual(appearance[0].slice(3),appearance[1].slice(3));assert.equal(await page.locator('.table-column-handle svg').evaluate(e=>getComputedStyle(e).transform),'matrix(0, 1, -1, 0, 0, 0)')
    await page.screenshot({path:`${out}/cell-hover.png`})
  })

  await test('packaged app reveals one matching column grip from cells and keeps it on the top border', async () => {
    await reset()
    assert.equal(await page.locator('.table-column-handle').count(), 1)
    assert.equal(await grip(), null, 'grip visible before hover')
    const cell = await page.locator('.paper-editor td').first().boundingBox()
    await page.mouse.move(cell.x + cell.width / 2, cell.y + cell.height / 2)
    await frames()
    assert.equal((await grip()).label, '选择第 1 列', 'body-cell hover should reveal its column grip')
    const head = await hoverColumn(1)
    const box = await grip()
    assert.ok(box, 'grip missing on the border')
    assert.ok(Math.abs(box.y + box.height / 2 - head.y) < 4, 'grip is not on the border')
    assert.equal(box.label, '选择第 2 列')
    await page.screenshot({ path: `${out}/column-grip.png`, clip: { x: 0, y: 140, width: 1000, height: 300 } })
  })

  await test('clicking the border grip selects the whole column', async () => {
    await reset()
    await hoverColumn(1)
    const box = await grip()
    assert.ok(box)
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down(); await page.mouse.up()
    await page.waitForFunction(() => document.querySelectorAll('.paper-editor .selectedCell').length >= 3)
    const states = await page.evaluate(() => [...document.querySelectorAll('.paper-editor tr')].map(row => [...row.children].map(c => c.classList.contains('selectedCell'))))
    for (const row of states) assert.deepEqual(row, [false, true, false])
  })

  await test('dragging the raw top border reorders columns', async () => {
    await reset()
    const head = await page.locator('.paper-editor tr').first().locator('th').first().boundingBox()
    const third = await page.locator('.paper-editor tr').first().locator('th').nth(2).boundingBox()
    assert.ok(head && third)
    await page.mouse.move(head.x + 30, head.y)
    await frames()
    await page.mouse.down()
    await page.mouse.move(third.x + third.width * 0.85, third.y + 4, { steps: 14 })
    await frames()
    assert.equal(await page.evaluate(() => document.querySelector('.table-column-drop-line').hidden), false, 'border drag did not start')
    assert.equal(await page.locator('.table-drag-ghost tr').count(),3)
    assert.equal(await page.locator('.table-drag-source').evaluateAll(es=>es.every(e=>!e.checkVisibility({checkVisibilityCSS:true}))),true)
    assert.equal(await page.locator('.table-column-drop-line>i').count(),3)
    await page.screenshot({path:`${out}/column-drag-mid.png`})
    await page.mouse.up()
    await page.waitForFunction(() => document.querySelector('.paper-editor tr').querySelectorAll('th')[0].innerText.trim() === '数量')
    assert.deepEqual(await headers(), ['数量', '说明', '名称'])
    await page.keyboard.press('Control+z')
    await page.waitForFunction(() => document.querySelector('.paper-editor tr').querySelectorAll('th')[0].innerText.trim() === '名称')
    assert.deepEqual(await headers(), ['名称', '数量', '说明'])
  })

  await test('dragging the grip itself reorders columns', async () => {
    await reset()
    await hoverColumn(0)
    const box = await grip()
    assert.ok(box)
    const third = await page.locator('.paper-editor tr').first().locator('th').nth(2).boundingBox()
    assert.ok(third)
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(third.x + third.width * 0.85, third.y + 4, { steps: 14 })
    await page.mouse.up()
    await page.waitForFunction(() => document.querySelector('.paper-editor tr').querySelectorAll('th')[0].innerText.trim() === '数量')
    assert.deepEqual(await headers(), ['数量', '说明', '名称'])
    await page.keyboard.press('Control+z')
    await page.waitForFunction(() => document.querySelector('.paper-editor tr').querySelectorAll('th')[0].innerText.trim() === '名称')
  })

  await test('single row grip drags whole rows in the packaged app', async () => {
    await reset()
    // A toolbar table has a header plus two body rows, so drag the first body row past the last one.
    assert.equal(await page.locator('.table-row-handle').count(), 1)
    const row = await page.locator('.paper-editor tr').nth(1).boundingBox()
    assert.ok(row)
    // Enter a body cell, including its lower half, to reveal the matching row grip.
    await page.mouse.move(row.x + row.width / 2, row.y + row.height * .85)
    await page.waitForFunction(() => {
      const grip = document.querySelector('.table-row-handle')
      return grip && !grip.hidden
    })
    const src = await page.locator('.table-row-handle').boundingBox()
    const target = await page.locator('.paper-editor tr').nth(2).boundingBox()
    assert.ok(src && target)
    await page.mouse.move(src.x + src.width / 2, src.y + src.height / 2)
    await page.mouse.down()
    await page.mouse.move(target.x + 80, target.y + target.height - 2, { steps: 12 })
    assert.equal(await page.locator('.table-drag-ghost').count(), 1)
    assert.equal(await page.locator('.table-drag-ghost td,.table-drag-ghost th').count(),3)
    assert.equal(await page.locator('.table-drag-source').evaluateAll(es=>es.every(e=>!e.checkVisibility({checkVisibilityCSS:true}))),true)
    await frames()
    await page.screenshot({path:`${out}/row-drag-mid.png`})
    await page.mouse.up()
    await page.waitForFunction(() => document.querySelectorAll('.paper-editor tr')[1].children[0].innerText.trim() === '梨')
    await page.keyboard.press('Control+z')
    await page.waitForFunction(() => document.querySelectorAll('.paper-editor tr')[1].children[0].innerText.trim() === '苹果')
    assert.deepEqual(errors, [])
  })

  await writeFile(`${out}/column-verification.json`, JSON.stringify({ passed: results.length, results, errors }, null, 2))
  console.log(JSON.stringify({ passed: results.length, errors }))
} catch (error) {
  await page.screenshot({ path: `${out}/column-failure.png` }).catch(() => {})
  await writeFile(`${out}/column-verification.json`, JSON.stringify({ passed: results.length, results, errors, failure: String(error) }, null, 2))
  console.error('FAIL', error)
  process.exitCode = 1
} finally {
  await browser.close()
}
