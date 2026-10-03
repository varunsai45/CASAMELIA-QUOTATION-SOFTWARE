from pathlib import Path
import json
import pymupdf

root = Path(__file__).resolve().parents[1]
source = Path.home() / 'Downloads' / 'Mr.Sumit_RevisedQuotation_070920261740.pdf'
out = root / 'docs' / 'reference-pdf'
out.mkdir(parents=True, exist_ok=True)
doc = pymupdf.open(source)
records = []
for n, page in enumerate(doc, 1):
    text = page.get_text(sort=True)
    (out / f'page-{n}.txt').write_text(text, encoding='utf8')
    page.get_pixmap(matrix=pymupdf.Matrix(1.3, 1.3)).save(out / f'page-{n}.png')
    records.append({'page':n, 'size':list(page.rect), 'text':text, 'blocks':page.get_text('dict'), 'drawings':page.get_drawings()})
    print('Page', n, 'size',page.rect, 'characters',len(text))
(out/'audit.json').write_text(json.dumps(records,default=str,ensure_ascii=False,indent=2),encoding='utf8')
