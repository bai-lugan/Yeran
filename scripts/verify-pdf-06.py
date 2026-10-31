from pypdf import PdfReader
from pypdf.generic import ContentStream
from pathlib import Path
import sys
base=Path(sys.argv[1] if len(sys.argv)>1 else '.oil-ui/yeran-06-dev/native-tests')
r=PdfReader(base/'native.pdf')
def destinations(items):
 result=[]
 for item in items:
  if isinstance(item,list):result.extend(destinations(item))
  else:result.append((item.title,r.get_destination_page_number(item)))
 return result
assert destinations(r.outline)==[('Native PDF',0),('First',0),('Last',len(r.pages)-1)]
for i,page in enumerate(r.pages):
 text=page.extract_text()
 assert 'Yeran review' in text
 assert f'{i+1} / {len(r.pages)}' in text
colors=[tuple(float(x) for x in args) for args,op in ContentStream(r.pages[0].get_contents(),r).operations if op==b'rg']
for expected in [(192/255,52/255,43/255),(1,227/255,224/255)]:
 assert any(all(abs(a-b)<.001 for a,b in zip(color,expected)) for color in colors),expected
assert PdfReader(base/'no-outline.pdf').outline==[]
print(f'PASS native PDF: {len(r.pages)} pages, 3 correctly located bookmarks, header/footer on every page, foreground/background colors, disabled outline')
