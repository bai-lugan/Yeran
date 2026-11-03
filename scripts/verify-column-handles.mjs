import { chromium } from '@playwright/test'
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'

const out = '.oil-ui/table-columns'
await mkdir(out, { recursive: true })
const browser = await chromium.launch({ channel: 'msedge', headless: true })
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
const page = await context.newPage()
const errors = [], results = []
page.setDefaultTimeout(12000)
page.on('pageerror', error => errors.push(error.message))

const sample = [
  '# 列表格把手',
  '',
  '| 名称 | 数量 | 说明 |',
  '| --- | --- | --- |',
  '| 苹果 | 10 | 待确认 |',
  '| 梨 | 20 | 已确认 |',
  '',
  '表格后面的正文。',
].join('\n')

async function ready() {
  await page.waitForFunction(() => !!window.__yeran?.editor?.view?.dom.querySelector('[data-rm-pagination]'))
}
async function reset(markdown = sample) {
  await page.evaluate(markdown => window.__yeran.replaceDocument(markdown, null, null), markdown)
  await page.locator('.paper-editor table').waitFor()
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  await page.mouse.move(20,120)
  await page.waitForFunction(() => [...document.querySelectorAll('.table-axis-handle')].every(handle=>handle.hidden))
}
async function markdown() { return page.evaluate(() => window.__yeran.getMarkdown()) }
async function headers() { return page.locator('.paper-editor tr').first().locator('th').allInnerTexts() }
async function frames() { await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))) }
// Like Notion, the grip only appears when the pointer touches the table's top border band,
// so hover just inside the top edge of the column rather than the middle of the header.
async function hoverColumn(index) {
  const box = await page.locator('.paper-editor tr').first().locator('th').nth(index).boundingBox()
  assert.ok(box, `header ${index} has no box`)
  await page.mouse.move(box.x + box.width / 2, box.y + 4)
  await frames()
  return box
}
async function grip() {
  return page.evaluate(() => {
    const handle = document.querySelector('.table-column-handle')
    if (!handle || handle.hidden) return null
    const box = handle.getBoundingClientRect()
    return { x: box.x, y: box.y, width: box.width, height: box.height, label: handle.getAttribute('aria-label') }
  })
}
async function test(name, run) { await run(); results.push(name); console.log('PASS', name) }

try {
  await page.goto((process.env.YERAN_TEST_URL || 'http://127.0.0.1:1420'))
  await ready()

  await test('a single column grip follows the hovered column instead of one grip per column', async () => {
    await reset()
    assert.equal(await page.locator('.table-column-handle').count(), 1, 'only one shared grip should exist')
    assert.equal(await grip(), null, 'grip should stay hidden before the pointer enters')
    for (const index of [0, 1, 2]) {
      const cell = await hoverColumn(index)
      const box = await grip()
      assert.ok(box, `grip missing over column ${index}`)
      const centre = Math.abs(box.x + box.width / 2 - (cell.x + cell.width / 2))
      assert.ok(centre < 6, `grip not centred on column ${index}: ${centre}`)
      // The grip must sit on the table's top border, straddling it rather than floating above it.
      const gripMiddle = box.y + box.height / 2
      assert.ok(Math.abs(gripMiddle - cell.y) < 4, `grip is not on the top border: ${gripMiddle} vs ${cell.y}`)
      assert.equal(box.label, `选择第 ${index + 1} 列`)
    }
    // Leaving the table hides it again.
    await page.mouse.move(20, 900)
    await page.waitForFunction(() => document.querySelector('.table-column-handle')?.hidden)
    assert.equal(await grip(), null, 'grip should hide when the pointer leaves the table')
  })

  await test('clicking the grip selects the whole hovered column', async () => {
    await reset()
    await hoverColumn(1)
    const box = await grip()
    assert.ok(box)
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.up()
    await page.waitForFunction(() => document.querySelectorAll('.paper-editor .selectedCell').length >= 3)
    const states = await page.evaluate(() => [...document.querySelectorAll('.paper-editor tr')].map(row => [...row.children].map(cell => cell.classList.contains('selectedCell'))))
    assert.equal(states.length, 3)
    for (const row of states) assert.deepEqual(row, [false, true, false])
  })

  await test('dragging the grip with the mouse reorders columns and keeps every cell', async () => {
    await reset()
    await hoverColumn(0)
    const box = await grip()
    assert.ok(box)
    const target = await page.locator('.paper-editor tr').first().locator('th').nth(2).boundingBox()
    assert.ok(target)
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    // The drop line must appear while the pointer travels, proving a real drag is running.
    await page.mouse.move(target.x + target.width * 0.8, target.y + target.height / 2, { steps: 14 })
    await frames()
    const lineVisible = await page.evaluate(() => !document.querySelector('.table-column-drop-line').hidden)
    assert.ok(lineVisible, 'drag did not start: no drop indicator')
    await page.mouse.up()
    await page.waitForFunction(() => document.querySelector('.paper-editor tr').querySelectorAll('th')[0].innerText.trim() === '数量')
    const moved = await page.evaluate(() => [...document.querySelectorAll('.paper-editor tr')].map(row => [...row.children].map(cell => cell.innerText.trim())))
    assert.deepEqual(moved[0], ['数量', '说明', '名称'])
    assert.deepEqual(moved[1], ['10', '待确认', '苹果'])
    assert.deepEqual(moved[2], ['20', '已确认', '梨'])
    await page.screenshot({ path: `${out}/drag-reordered.png`, clip: { x: 0, y: 0, width: 900, height: 420 } })
  })

  await test('a click without movement selects instead of reordering', async () => {
    await reset()
    const before = await markdown()
    await hoverColumn(2)
    const box = await grip()
    assert.ok(box)
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2 + 2, box.y + box.height / 2)
    await page.mouse.up()
    await page.waitForFunction(() => document.querySelectorAll('.paper-editor .selectedCell').length >= 3)
    assert.equal(await markdown(), before, 'a tiny wobble must not reorder the table')
    const states = await page.evaluate(() => [...document.querySelectorAll('.paper-editor tr')].map(row => [...row.children].map(cell => cell.classList.contains('selectedCell'))))
    for (const row of states) assert.deepEqual(row, [false, false, true])
  })

  await test('Escape during a column drag cancels it and keeps the table intact', async () => {
    await reset()
    const before = await markdown()
    await hoverColumn(0)
    const box = await grip()
    assert.ok(box)
    const target = await page.locator('.paper-editor tr').first().locator('th').nth(2).boundingBox()
    assert.ok(target)
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(target.x + target.width * 0.8, target.y + target.height / 2, { steps: 10 })
    await page.keyboard.press('Escape')
    await page.mouse.up()
    await frames()
    assert.equal(await markdown(), before, 'cancelled drag changed the document')
    assert.deepEqual(await headers(), ['名称', '数量', '说明'])
    assert.equal(await page.evaluate(() => document.querySelector('.table-column-drop-line').hidden), true)
  })

  await test('Delete removes the selected column and undo restores it', async () => {
    await reset()
    const before = await markdown()
    await hoverColumn(2)
    const box = await grip()
    assert.ok(box)
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down(); await page.mouse.up()
    await page.waitForFunction(() => document.querySelectorAll('.paper-editor .selectedCell').length >= 3)
    await page.keyboard.press('Delete')
    await page.waitForFunction(() => document.querySelector('.paper-editor tr').querySelectorAll('th').length === 2)
    assert.deepEqual(await headers(), ['名称', '数量'])
    assert.ok(!(await markdown()).includes('待确认'), 'deleted column content survived in Markdown')
    await page.keyboard.press('Control+z')
    await page.waitForFunction(() => document.querySelector('.paper-editor tr').querySelectorAll('th').length === 3)
    assert.equal(await markdown(), before)
  })

  await test('Alt+Arrow reorders the selected column from the keyboard', async () => {
    await reset()
    await hoverColumn(0)
    const box = await grip()
    assert.ok(box)
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down(); await page.mouse.up()
    await page.waitForFunction(() => document.querySelectorAll('.paper-editor .selectedCell').length >= 3)
    await page.keyboard.press('Alt+ArrowRight')
    await page.waitForFunction(() => document.querySelector('.paper-editor tr').querySelectorAll('th')[0].innerText.trim() === '数量')
    assert.deepEqual(await headers(), ['数量', '名称', '说明'])
    await page.keyboard.press('Alt+ArrowLeft')
    await page.waitForFunction(() => document.querySelector('.paper-editor tr').querySelectorAll('th')[0].innerText.trim() === '名称')
    assert.deepEqual(await headers(), ['名称', '数量', '说明'])
  })

  await test('column order survives a Markdown roundtrip', async () => {
    await reset()
    await hoverColumn(1)
    const box = await grip()
    assert.ok(box)
    const target = await page.locator('.paper-editor tr').first().locator('th').nth(2).boundingBox()
    assert.ok(target)
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(target.x + target.width * 0.85, target.y + target.height / 2, { steps: 12 })
    await page.mouse.up()
    await page.waitForFunction(() => document.querySelector('.paper-editor tr').querySelectorAll('th')[0].innerText.trim() === '名称' && document.querySelector('.paper-editor tr').querySelectorAll('th')[1].innerText.trim() === '说明')
    const saved = await markdown()
    const headerLine = saved.split('\n').find(line => line.startsWith('|'))
    assert.deepEqual(headerLine.split('|').slice(1, -1).map(cell => cell.trim()), ['名称', '说明', '数量'], saved)
    assert.deepEqual(saved.split('\n').filter(line => line.startsWith('|'))[2].split('|').slice(1, -1).map(cell => cell.trim()), ['苹果', '待确认', '10'])
    await page.evaluate(md => window.__yeran.replaceDocument(md, null, null), saved)
    await page.locator('.paper-editor table').waitFor()
    assert.deepEqual(await headers(), ['名称', '说明', '数量'])
  })

  await test('merged cells block column moves instead of corrupting the layout', async () => {
    await reset()
    const guarded = await page.evaluate(async () => {
      const view = window.__yeran.editor.view, { state } = view, schema = state.schema
      const cell = (name, attrs, text) => schema.nodes[name].create(attrs, schema.nodes.paragraph.create(null, text ? schema.text(text) : null))
      // Markdown cannot express colspan, so build the merged table directly from the schema.
      const merged = schema.nodes.table.create(null, [
        schema.nodes.tableRow.create(null, [cell('tableHeader', {}, 'A'), cell('tableHeader', {}, 'B')]),
        schema.nodes.tableRow.create(null, [cell('tableCell', { colspan: 2, colwidth: null }, '跨列')]),
      ])
      let tablePos = -1
      state.doc.descendants((node, offset) => { if (tablePos < 0 && node.type.name === 'table') tablePos = offset })
      view.dispatch(state.tr.replaceWith(tablePos, tablePos + state.doc.nodeAt(tablePos).nodeSize, merged))
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      const before = window.__yeran.getMarkdown()
      let mergedCells = 0
      view.state.doc.descendants(node => { if (node.attrs?.colspan > 1) mergedCells++ })
      const header = document.querySelector('.paper-editor tr').querySelectorAll('th')[0].getBoundingClientRect()
      view.dom.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: header.left + header.width / 2, clientY: header.top + header.height / 2 }))
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      const handle = document.querySelector('.table-column-handle')
      const grip = handle.getBoundingClientRect()
      handle.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, button: 0, pointerId: 1, clientX: grip.left + 2, clientY: grip.top + 2 }))
      document.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 1, clientX: header.right + 40, clientY: header.top + 10 }))
      document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1 }))
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      const headerCells = [...document.querySelectorAll('.paper-editor tr')].map(row => [...row.children].map(item => item.innerText.trim()))
      return { mergedCells, unchanged: before === window.__yeran.getMarkdown(), headerCells }
    })
    assert.ok(guarded.mergedCells > 0, 'fixture did not contain a merged cell')
    assert.ok(guarded.unchanged, 'merged table was reordered despite colspan')
    assert.deepEqual(guarded.headerCells[0], ['A', 'B'], 'header order changed for a merged table')
  })

  await test('the top border itself is draggable, like Notion', async () => {
    await reset()
    // Press directly on the table's top border, without using the grip at all.
    const head = await page.locator('.paper-editor tr').first().locator('th').first().boundingBox()
    const third = await page.locator('.paper-editor tr').first().locator('th').nth(2).boundingBox()
    assert.ok(head && third)
    await page.mouse.move(head.x + 30, head.y)
    await frames()
    await page.mouse.down()
    await page.mouse.move(third.x + third.width * 0.85, third.y + 4, { steps: 14 })
    await frames()
    assert.equal(await page.evaluate(() => document.querySelector('.table-column-drop-line').hidden), false, 'border drag did not start')
    await page.mouse.up()
    await page.waitForFunction(() => document.querySelector('.paper-editor tr').querySelectorAll('th')[0].innerText.trim() === '数量')
    assert.deepEqual(await headers(), ['数量', '说明', '名称'])
    await page.keyboard.press('Control+z')
    await page.waitForFunction(() => document.querySelector('.paper-editor tr').querySelectorAll('th')[0].innerText.trim() === '名称')
  })

  await test('a single row grip follows the hovered row and drags it with a visible ghost', async () => {
    await reset()
    assert.equal(await page.locator('.table-row-handle').count(), 1, 'only one shared row grip should exist')
    const rowGrip = () => page.evaluate(() => {
      const handle = document.querySelector('.table-row-handle')
      if (!handle || handle.hidden) return null
      const box = handle.getBoundingClientRect()
      return { x: box.x, y: box.y, width: box.width, height: box.height, label: handle.getAttribute('aria-label') }
    })
    const hoverRow = async index => {
      const box = await page.locator('.paper-editor tr').nth(index).boundingBox()
      assert.ok(box)
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
      await frames()
      return box
    }
    assert.equal(await rowGrip(), null, 'row grip should stay hidden before the pointer enters the table')
    const head = await hoverRow(0)
    assert.ok(await rowGrip(), 'row grip missing over the header row')
    assert.equal((await rowGrip()).label, '选择表头行')
    const second = await hoverRow(1)
    const revealed = await rowGrip()
    assert.ok(revealed, 'row grip missing over the first data row')
    assert.equal(revealed.label, '选择第 2 行')
    assert.ok(Math.abs(revealed.y + revealed.height / 2 - (second.y + second.height / 2)) < 6, 'row grip is not centred on its row')
    assert.ok(Math.abs(revealed.x + revealed.width / 2 - head.x) < 2, 'row grip should straddle the table border')
    // Dragging the grip reorders rows and shows a ghost while moving.
    const last = await page.locator('.paper-editor tr').last().boundingBox()
    await page.mouse.move(revealed.x + revealed.width / 2, revealed.y + revealed.height / 2)
    await page.mouse.down()
    await page.mouse.move(last.x + 120, last.y + last.height - 2, { steps: 14 })
    await frames()
    assert.equal(await page.locator('.table-drag-ghost').count(), 1, 'dragging a row must show a ghost')
    await page.mouse.up()
    await page.waitForFunction(() => [...document.querySelectorAll('.paper-editor tr')].at(-1).children[0].innerText.trim() === '苹果')
    await page.keyboard.press('Control+z')
    await page.waitForFunction(() => [...document.querySelectorAll('.paper-editor tr')].at(-1).children[0].innerText.trim() === '梨')
    // Leaving the table hides it again.
    await page.mouse.move(20, 900)
    await page.waitForFunction(() => document.querySelector('.table-row-handle')?.hidden)
    assert.equal(await rowGrip(), null, 'row grip should hide when the pointer leaves the table')
  })

  await test('no page errors and other table behaviour is unaffected', async () => {
    await reset()
    await page.locator('.paper-editor td').first().click()
    await page.keyboard.type('X')
    assert.ok((await markdown()).includes('X'))
    await page.getByRole('button', { name: '向右插入列', exact: true }).click()
    assert.equal(await page.locator('.paper-editor tr').first().locator('th').count(), 4)
    assert.equal(await page.locator('.table-column-handle').count(), 1, 'adding a column must not add another grip')
    await hoverColumn(3)
    assert.equal((await grip()).label, '选择第 4 列')
    assert.deepEqual(errors, [])
    await page.screenshot({ path: `${out}/grip-single.png`, clip: { x: 0, y: 0, width: 900, height: 420 } })
  })

  await writeFile(`${out}/verification.json`, JSON.stringify({ passed: results.length, results, errors }, null, 2))
  console.log(JSON.stringify({ passed: results.length, errors }))
} catch (error) {
  await page.screenshot({ path: `${out}/failure.png`, fullPage: false }).catch(() => {})
  await writeFile(`${out}/verification.json`, JSON.stringify({ passed: results.length, results, errors, failure: String(error) }, null, 2))
  console.error('FAIL', error)
  process.exitCode = 1
} finally {
  await browser.close()
}
