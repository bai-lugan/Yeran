let activeFrame: HTMLIFrameElement | undefined
let cleanupTimer: ReturnType<typeof setTimeout> | undefined
export function disposePrintFrame() { clearTimeout(cleanupTimer); activeFrame?.remove(); activeFrame = undefined }

// Print the same frozen document as PDF export without opening the app preview.
export async function printDocumentHtml(html: string) {
  disposePrintFrame()
  const focused = document.activeElement as HTMLElement | null
  const frame = document.createElement('iframe')
  frame.className = 'direct-print-frame'; frame.title = 'Print document'; frame.setAttribute('aria-hidden','true')
  frame.style.cssText = 'position:fixed;left:-20000px;top:0;width:1123px;height:1123px;border:0;pointer-events:none'
  activeFrame = frame
  try {
    await new Promise<void>((resolve,reject)=>{
      const timer = setTimeout(()=>reject(new Error('打印页面未能加载，请重试。')),15000)
      frame.onload = ()=>{clearTimeout(timer);resolve()}; frame.onerror=()=>{clearTimeout(timer);reject(new Error('打印页面未能加载，请重试。'))}
      frame.srcdoc = html; document.body.append(frame)
    })
    const target = frame.contentWindow!, doc = frame.contentDocument!
    await doc.fonts.ready
    await Promise.all([...doc.images].map(image=>image.decode().catch(()=>{})))
    await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())))
    target.addEventListener('afterprint',()=>{if(activeFrame===frame){disposePrintFrame();focused?.focus({preventScroll:true})}},{once:true})
    cleanupTimer=setTimeout(()=>{if(activeFrame===frame)disposePrintFrame()},300000)
    target.focus(); target.print()
  } catch(e) {disposePrintFrame();focused?.focus({preventScroll:true});throw e}
}
