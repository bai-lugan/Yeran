import {mkdir,writeFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
const version='4.1.0',base=`https://raw.githubusercontent.com/github/gemoji/v${version}/`
async function download(path){const response=await fetch(base+path);if(!response.ok)throw Error(`${path}: HTTP ${response.status}`);return Buffer.from(await response.arrayBuffer())}
const source=await download('db/emoji.json'),license=await download('LICENSE'),entries=JSON.parse(source.toString()).filter(item=>item.emoji&&item.aliases?.length)
const compact=JSON.stringify(entries.map(({emoji,aliases,description,tags})=>[emoji,aliases,description,tags||[]]))+'\n',hash=data=>createHash('sha256').update(data).digest('hex')
await mkdir('third-party',{recursive:true});await writeFile('src/emoji-data.json',compact);await writeFile('third-party/gemoji-LICENSE.txt',license)
const metadata={name:'gemoji',version,license:'MIT',source:base+'db/emoji.json',sourceSha256:hash(source),licenseSource:base+'LICENSE',generated:'src/emoji-data.json',generatedSha256:hash(compact),entries:entries.length,fields:['emoji','aliases','description','tags'],imagesOrFontsIncluded:false}
await writeFile('third-party/gemoji.json',JSON.stringify(metadata,null,2)+'\n');console.log(JSON.stringify(metadata,null,2))
