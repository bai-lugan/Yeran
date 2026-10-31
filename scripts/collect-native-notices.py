import json, re, urllib.request, zipfile, subprocess, sys
def fetch(url):
    return subprocess.check_output(['node','--use-system-ca','--input-type=module','-e','const r=await fetch(process.argv[1],{headers:{"User-Agent":"Yeran-license-audit"}});if(!r.ok)throw Error(r.status+" "+process.argv[1]);process.stdout.write(await r.text());',url])
from pathlib import Path
version = json.loads(Path('package.json').read_text(encoding='utf-8'))['version'].removesuffix('.0')
evidence_version = version.replace('.', '')
metadata_path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(f'.oil-ui/yeran-{evidence_version}-dev/cargo-metadata.json')
meta = json.loads(metadata_path.read_text(encoding='utf-8-sig'))
packages = sorted([p for p in meta['packages'] if p['source']], key=lambda p:(p['name'],p['version']))
cache = {}; notices = [f'Yeran {version} — Rust dependency notices\nIncludes build-time and target dependencies. Each component retains its upstream license.\n']
licenses_dir=Path('third-party/licenses');licenses_dir.mkdir(parents=True,exist_ok=True)
source_zip=zipfile.ZipFile(f'release/Yeran-{version}-third-party-sources.zip','w',zipfile.ZIP_DEFLATED,strict_timestamps=False)
source_zip.writestr('README.txt',f'Exact unmodified sources of MPL-2.0 Rust crates used by Yeran {version}. Sources retain MPL-2.0, independently of Yeran\'s MIT license. See Cargo.lock for registry checksums.\n')
manifest=[]; missing=[]
for p in packages:
    directory=Path(p['manifest_path']).parent
    files=[x for x in directory.iterdir() if re.match(r'(?i)^(licen[cs]e|notice|copying|copyright)',x.name) and x.is_file()]
    texts=[(f.name,f.read_text(encoding='utf-8',errors='replace')) for f in files]
    source=f"https://crates.io/api/v1/crates/{p['name']}/{p['version']}/download"
    if not texts:
        texts=[(cached.name,cached.read_text(encoding='utf-8')) for cached in sorted(licenses_dir.glob(f"{p['name']}-{p['version']}-*.txt"))]
    if not texts:
        vcs=json.loads((directory/'.cargo_vcs_info.json').read_text()) if (directory/'.cargo_vcs_info.json').exists() else {}
        repo=(p['repository'] or '').rstrip('/').removesuffix('.git').removeprefix('https://github.com/')
        commit=vcs.get('git',{}).get('sha1')
        if commit and '/' in repo:
            key=repo+'@'+commit
            try:
                if key not in cache:
                    req=urllib.request.Request(f'https://api.github.com/repos/{repo}/git/trees/{commit}?recursive=1',headers={'User-Agent':'Yeran-license-audit'})
                    data=json.loads(fetch(req.full_url))
                    choices=[x['path'] for x in data['tree'] if x['type']=='blob' and '/' not in x['path'] and re.match(r'(?i)^(licen[cs]e|notice|copying|copyright)',x['path'])]
                    cache[key]=[]
                    for entry in choices:
                        url=f'https://raw.githubusercontent.com/{repo}/{commit}/{entry}'
                        content=fetch(url).decode('utf-8',errors='replace')
                        cache[key].append((f'{url}',content))
                texts=cache[key]
            except Exception as e: print('FETCH ISSUE',p['name'],str(e))
        if not texts and p['license']=='MPL-2.0':
            body=fetch('https://www.mozilla.org/media/MPL/2.0/index.815ca599c9df.txt').decode()
            texts=[('Mozilla MPL-2.0',body)]
        if not texts: missing.append(p['name']+'@'+p['version'])
        for i,(name,text) in enumerate(texts):
            (licenses_dir/f"{p['name']}-{p['version']}-{i}.txt").write_text(f'Source: {name}\n\n{text}',encoding='utf-8')
    notices.append(f"\n{'='*72}\n{p['name']} {p['version']}\nLicense: {p['license']}\nRepository: {p['repository']}\nExact source: {source}\n"+'\n'.join(f'\n{name}\n{text}' for name,text in texts))
    if p['license']=='MPL-2.0':
        for f in directory.rglob('*'):
            if f.is_file(): source_zip.write(f,f"{p['name']}-{p['version']}/{f.relative_to(directory).as_posix()}")
        manifest.append({'name':p['name'],'version':p['version'],'license':p['license'],'source':source})
mpl_package = next(p for p in packages if p['name']=='cssparser')
source_zip.writestr('LICENSE-MPL-2.0.txt',(Path(mpl_package['manifest_path']).parent/'LICENSE').read_bytes())
source_zip.close()
Path('release/RUST_THIRD_PARTY_NOTICES.txt').write_text('\n'.join(notices),encoding='utf-8')
Path('third-party/mpl-sources.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
from shutil import copyfile
copyfile('release/RUST_THIRD_PARTY_NOTICES.txt','third-party/RUST_THIRD_PARTY_NOTICES.txt')
copyfile(f'release/Yeran-{version}-third-party-sources.zip','third-party/mpl-sources.zip')
print('Rust packages:',len(packages),'MPL source crates:',len(manifest),'Missing license text:',missing)
if missing: raise SystemExit(1)
