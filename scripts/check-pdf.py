import collections
import json
import re
from pathlib import Path
from pypdf import PdfReader

root = Path('.oil-ui/first-version/shots')
for pdf_name, text_name in [('acceptance.pdf', 'expected-text.json'), ('long-acceptance.pdf', 'long-expected-text.json')]:
    reader = PdfReader(root / pdf_name)
    expected = re.sub(r'\s+', '', json.loads((root / text_name).read_text(encoding='utf-8')))
    text = ''.join(re.sub(r'\s+', '', page.extract_text()) for page in reader.pages)
    missing = collections.Counter(expected) - collections.Counter(text)
    assert not missing, f'{pdf_name}: missing {sum(missing.values())} characters: {missing}'
    assert all(abs(float(p.mediabox.width) - 595.276) < 1 and abs(float(p.mediabox.height) - 841.89) < 1 for p in reader.pages)
    print(f'PASS {pdf_name}: {len(reader.pages)} A4 pages; {len(expected)} source characters retained; extractable text')
