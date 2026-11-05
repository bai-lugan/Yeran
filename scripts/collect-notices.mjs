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
    const declaredLicense=info.license||record.license||(licenseText.includes('The MIT License')?'MIT (license file)':'see package source')
    if(info.name==='elkjs')licenseText+='\nSource availability (EPL-2.0): the accompanying epl-sources.zip contains the upstream elkjs 0.9.3 source, readable distribution and an Eclipse ELK source snapshot. Upstream source and build instructions: https://github.com/kieler/elkjs/tree/0.9.3 ; ELK algorithms: https://github.com/eclipse-elk/elk . See third-party/epl-sources.json for provenance. No upstream code was modified.\n'
    notices.push(`\n${'='.repeat(72)}\n${info.name} ${info.version}\nLicense: ${JSON.stringify(declaredLicense)}\n${licenseText || 'See the upstream package distribution for its complete license.'}`)
  } catch {}
}
notices.push('\nDesktop runtime: Tauri / Wry / Tao (MIT or Apache-2.0), Rust standard library (MIT or Apache-2.0), and Rust dependencies recorded in src-tauri/Cargo.lock. System Microsoft WebView2 and Edge are separately installed Microsoft products, not bundled here.\n')
await writeFile('release/THIRD_PARTY_NOTICES.txt', notices.join('\n'), 'utf8')
console.log('Created release/THIRD_PARTY_NOTICES.txt')
