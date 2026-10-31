import collections
import json
import re
from pathlib import Path
from pypdf import PdfReader

root = Path('.oil-ui/table-edit')
reader = PdfReader(root / 'landscape.pdf')
html_pages = (root / 'landscape.html').read_text(encoding='utf-8').count('<section class="pdf-sheet">')
assert len(reader.pages) == html_pages, f'Preview {html_pages} pages, PDF {len(reader.pages)} pages'
assert all(abs(float(page.mediabox.width) - 841.89) < 1 and abs(float(page.mediabox.height) - 595.276) < 1 for page in reader.pages)
expected = re.sub(r'\s+', '', json.loads((root / 'expected-text.json').read_text(encoding='utf-8')))
actual = ''.join(re.sub(r'\s+', '', page.extract_text()) for page in reader.pages)
missing = collections.Counter(expected) - collections.Counter(actual)
assert not missing, f'Missing {sum(missing.values())} characters: {missing}'
assert '跨页编辑保留' in actual
print(f'PASS landscape PDF: {len(reader.pages)} A4 landscape pages, matching preview, {len(expected)} source characters retained')
print('Page text lengths:', [len(page.extract_text()) for page in reader.pages])

native = root / 'native-tests' / '横向导出.pdf'
if native.exists():
    reader = PdfReader(native)
    assert len(reader.pages) == html_pages
    assert all(abs(float(page.mediabox.width) - 841.89) < 1 and abs(float(page.mediabox.height) - 595.276) < 1 for page in reader.pages)
    text = ''.join(re.sub(r'\s+', '', page.extract_text()) for page in reader.pages)
    assert not collections.Counter(expected) - collections.Counter(text)
    print(f'PASS native landscape export: {len(reader.pages)} A4 landscape pages; source text retained')

native_ui = root / 'native-tests' / '桌面横向文稿.pdf'
if native_ui.exists():
    reader = PdfReader(native_ui)
    assert all(abs(float(page.mediabox.width) - 841.89) < 1 and abs(float(page.mediabox.height) - 595.276) < 1 for page in reader.pages)
    assert any(page.extract_text().strip() for page in reader.pages)
    print(f'PASS native UI snapshot export: {len(reader.pages)} A4 landscape pages; extractable text')
