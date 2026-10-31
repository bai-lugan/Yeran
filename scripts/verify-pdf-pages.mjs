import{chromium}from'@playwright/test'
import{readFile,writeFile,mkdir}from'node:fs/promises'
import path from'node:path'
import assert from'node:assert/strict'
import{execFileSync}from'node:child_process'
// Regression guard for the mixed-page export: every generated sheet must paint its own
// page number on top of tall block backgrounds (a 180-line code block used to cover the
// landscape footer). Renders the exported HTML at 1:1 under print media and checks the
// footer box + computed stacking, then decodes text out of the produced PDF.
const out=path.resolve('.oil-ui/yeran-05/native-tests')
const htmlPath=path.join(out,'continuous.html')
const pdfPath=path.join(out,'continuous.pdf')
const browser=await chromium.launch({channel:'msedge',headless:true})
try{
  const page=await (await browser.newContext({viewport:{width:1300,height:1300},deviceScaleFactor:1})).newPage()
  await page.goto('file:///'+htmlPath.replace(/\\/g,'/'))
  await page.emulateMedia({media:'print'})
  await page.evaluate(()=>document.fonts.ready)
  const sheets=await page.locator('.pdf-sheet').elementHandles()
  assert.ok(sheets.length>=2,'expected multiple A4 sheets')
  const report=[]
  for(const [i,sheet] of sheets.entries()){
    const info=await sheet.evaluate(el=>{
      const sb=el.getBoundingClientRect(),clip=el.querySelector('.pdf-clip').getBoundingClientRect()
      const custom=el.hasAttribute('data-print-furniture');const footer=[...el.querySelectorAll(custom?'.print-page-footer':'.mixed-footer')].map(f=>{
        const r=f.getBoundingClientRect(),s=getComputedStyle(f)
        return{top:Math.round(r.top-sb.top),bottom:Math.round(r.bottom-sb.top),text:(custom?f.querySelector('span:last-child'):f).innerText.trim(),z:s.zIndex,position:s.position,bg:s.backgroundColor}
      }).filter(f=>f.bottom>0&&f.top<sb.height)
      return{size:[Math.round(sb.width),Math.round(sb.height)],clip:[Math.round(clip.width),Math.round(clip.height)],footer,custom}
    })
    assert.equal(info.clip[0],info.size[0],`sheet ${i+1} clip width matches page`)
    assert.equal(info.clip[1],info.size[1],`sheet ${i+1} clip height matches page`)
    assert.equal(info.footer.length,1,`sheet ${i+1} paints exactly one page-number footer`)
    const f=info.footer[0]
    assert.match(f.text,new RegExp(`^${i+1}(?:\\s*/\\s*${sheets.length})?$`),`sheet ${i+1} shows its own page number`)
    assert.equal(f.z,info.custom?'5':'2',`sheet ${i+1} footer stacks above block backgrounds`)
    assert.ok(info.custom?f.bottom<=info.size[1]-10&&f.bottom>=info.size[1]-70:f.bottom>=info.size[1]-2,`sheet ${i+1} footer stays inside its bottom margin`)
    report.push({page:i+1,size:info.size,footer:f})
    await sheet.screenshot({path:path.join(out,`page-${i+1}.png`)})
  }
  // The PDF must be the same artifact: decode its text and confirm nothing was clipped away.
  const decoded=JSON.parse(execFileSync(process.env.YERAN_TEST_PYTHON||'python',['-c','from pypdf import PdfReader; import json,sys; r=PdfReader(sys.argv[1]); print(json.dumps({"pages":len(r.pages),"text":"\\n".join(p.extract_text() for p in r.pages)}))',pdfPath],{encoding:'utf8'}))
  const text=decoded.text
  for(const token of ['ContinuousNativeStart','LandscapeNativeToken','NativeFootnoteToken','NativeCalloutToken','NativeFinalToken'])
    assert.ok(text.includes(token),`PDF keeps ${token}`)
  const lines=[...text.matchAll(/CodeLine(\d{3})/g)].map(m=>Number(m[1]))
  assert.equal(Math.min(...lines),0,'first code line exported')
  assert.equal(Math.max(...lines),179,'last code line exported');assert.equal(new Set(lines).size,180,'every code line exported')
  const pdfPages=decoded.pages
  assert.equal(pdfPages,sheets.length,'PDF page count matches preview sheets')
  await writeFile(path.join(out,'page-report.json'),JSON.stringify({sheets:report,pdfPages,codeLines:{min:Math.min(...lines),max:Math.max(...lines)},tokens:true},null,1))
  console.log(`PASS exported sheets keep page numbers above tall blocks (${sheets.length} pages, code lines 0-179 intact in PDF)`)
}finally{await browser.close()}
