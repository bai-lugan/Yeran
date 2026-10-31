import {chromium} from '@playwright/test'
export async function connectNative(){
  let browser
  for(let i=0;i<40;i++){try{browser=await chromium.connectOverCDP(process.env.YERAN_CDP_URL||'http://127.0.0.1:9224');break}catch(e){if(i===39)throw e;await new Promise(r=>setTimeout(r,250))}}
  // Native print is a modal Windows window. Stub only that final OS call; the
  // app still builds and loads its actual print snapshot. Never click it in CI.
  const page=await nativePage(browser)
  await page.addInitScript(()=>{if(window!==window.top)window.print=()=>{window.__yeranPrintCalled=true}})
  return browser
}
export async function nativePage(browser){
  for(let i=0;i<80;i++){for(const context of browser.contexts())for(const page of context.pages())if(page.url().startsWith('http://tauri.localhost'))return page;await new Promise(r=>setTimeout(r,250))}
  throw new Error('Packaged Yeran window not found; refusing to use the system print tab.')
}
