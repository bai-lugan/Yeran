import { readFile, writeFile, readdir } from 'node:fs/promises'
const lock = JSON.parse(await readFile('package-lock.json', 'utf8'))
const notices = [`Yeran ${lock.version} — JavaScript dependency notices`, 'Generated from package-lock.json. Runtime source and license information follows.\n']
for (const [directory, record] of Object.entries(lock.packages)) {
  if (!directory || record.dev) continue
  try {
    const info = JSON.parse(await readFile(`${directory}/package.json`, 'utf8'))
    let licenseText = ''
    const files = await readdir(directory,{withFileTypes:true})
    for (const file of files.filter(file=>file.isFile() && /^(licen[cs]e|notice|copying|copyright|thirdpartynotice)/i.test(file.name))) {
      licenseText += `\n${file.name}\n${await readFile(`${directory}/${file.name}`, 'utf8')}\n`
    }
    notices.push(`\n${'='.repeat(72)}\n${info.name} ${info.version}\nLicense: ${JSON.stringify(info.license || record.license || 'see package source')}\n${licenseText || 'See the upstream package distribution for its complete license.'}`)
  } catch {}
}
notices.push('\nDesktop runtime: Tauri / Wry / Tao (MIT or Apache-2.0), Rust standard library (MIT or Apache-2.0), and Rust dependencies recorded in src-tauri/Cargo.lock. System Microsoft WebView2 and Edge are separately installed Microsoft products, not bundled here.\n')
await writeFile('release/THIRD_PARTY_NOTICES.txt', notices.join('\n'), 'utf8')
console.log('Created release/THIRD_PARTY_NOTICES.txt')
