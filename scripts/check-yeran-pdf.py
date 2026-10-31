from pathlib import Path
from pypdf import PdfReader
root = Path('.oil-ui/yeran-04')
for stem, token, count in [('mixed-paragraphs', 'Token', 30), ('mixed-table', 'RowToken', 65), ('mixed-manual', 'Token', 3)]:
    reader = PdfReader(root / f'{stem}.pdf')
    sizes = [(round(float(p.mediabox.width)), round(float(p.mediabox.height))) for p in reader.pages]
    assert sizes[:3] == [(595,842), (842,595), (595,842)], sizes
    text = '\n'.join(p.extract_text() for p in reader.pages)
    if stem == 'mixed-manual':
        for i, word in enumerate(['FirstToken','SecondToken','ThirdToken']):
            assert word in reader.pages[i].extract_text(), (i, word)
    else:
        for i in range(1, count + 1):
            assert text.count(f'{token}{i:03}') == 1, (stem, i)
    if stem == 'mixed-table':
        for p in reader.pages:
            assert p.extract_text().count('Name') == 1
    print('PASS', stem, len(reader.pages), 'pages; per-page sizes and all source tokens')
reader = PdfReader(root / 'repeated-headers.pdf')
text = '\n'.join(p.extract_text() for p in reader.pages)
for i in range(1,56):
    assert f'数据 {i}' in text
for p in reader.pages:
    assert p.extract_text().count('表头名称') == 1
reader = PdfReader(root / 'blocks.pdf')
fonts = [str(f.get_object().get('/BaseFont')) for p in reader.pages for f in p['/Resources']['/Font'].values()]
assert any('KaTeX' in font for font in fonts), fonts
print('PASS repeated table headers, all 55 rows, embedded KaTeX font resources')
