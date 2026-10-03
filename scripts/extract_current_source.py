"""Extract the October workbook; preserve every source row and conflicting rate."""
import json, re, hashlib, shutil, ast, operator
from decimal import Decimal
from pathlib import Path
from collections import defaultdict

ROOT=Path(__file__).resolve().parents[1]
DATA=ROOT/'backend'/'data'
source=Path.home()/'Downloads'/'Qoute_1-10-2026.xlsx'
cells=json.loads((ROOT/'docs/new-source/cells.json').read_text(encoding='utf8'))
maps={s:{c['cell']:c for c in cs} for s,cs in cells.items()}
def v(s,c): return maps[s].get(c,{}).get('value')
def number(s,c,seen=None):
    seen=set(seen or [])
    if c in seen: raise ValueError('Circular formula')
    seen.add(c)
    x=v(s,c)
    if x is None: return None
    if isinstance(x,(int,float)): return str(Decimal(str(x)))
    if not str(x).startswith('='): return None
    expression=re.sub(r'\$?([A-Z]+)\$?(\d+)',lambda m:number(s,m[1]+m[2],seen) or '0',x[1:])
    def calc(n):
        if isinstance(n,ast.Constant) and isinstance(n.value,(int,float)): return Decimal(str(n.value))
        if isinstance(n,ast.UnaryOp) and isinstance(n.op,(ast.UAdd,ast.USub)): return calc(n.operand)*(1 if isinstance(n.op,ast.UAdd) else -1)
        if isinstance(n,ast.BinOp) and type(n.op) in [ast.Add,ast.Sub,ast.Mult,ast.Div]: return {ast.Add:operator.add,ast.Sub:operator.sub,ast.Mult:operator.mul,ast.Div:operator.truediv}[type(n.op)](calc(n.left),calc(n.right))
        raise ValueError('Unsupported formula '+x)
    return str(calc(ast.parse(expression,mode='eval').body))
def norm(x): return re.sub(r'\s+',' ',str(x)).strip().casefold()
def parts(spec):
    a=[x.strip() for x in spec.split(' + ')]
    return (a[0],a[1], ' + '.join(a[2:])) if len(a)>2 else (a[0],'-',' + '.join(a[1:]) or '-')

flat=[]
for row in range(2,240):
    item=v('MasterFlat','A'+str(row))
    if item:
        f={k:str(v('MasterFlat',c+str(row)) or '-') for k,c in [('item','A'),('carcass','B'),('shutter','C'),('finish','D')]}
        f.update(price=number('MasterFlat','E'+str(row)),display=v('MasterFlat','E'+str(row)),source_row=row)
        f['specification']=' + '.join(f[k] for k in ['carcass','shutter','finish'] if f[k]!='-')
        flat.append(f)

# Section boundaries were inspected in every area worksheet. These are import
# mappings, not frontend business data; Admin can change the resulting records.
ranges={
'Kitchen':[(8,29,'Base Unit'),(34,59,'Wall Unit'),(64,71,'Loft'),(76,101,'Janitor Unit'),(105,114,'Counter Top'),(119,127,'Accessories'),(133,140,'Appliances')],
'Bedrooms':[(8,100,'Swing/Hinged Wardrobe'),(106,123,'Loft'),(128,147,'Sliding Wardrobe'),(155,188,'Base & Wall units'),(194,213,'Wall Panel'),(218,221,'Dressing Unit'),(226,230,'Furnishing'),(233,234,'Aristro Wardrobes')],
'Toilet':[(4,25,'Vanities'),(30,55,'Wall Unit')],
'Other Wet Areas':[(5,26,'Base Unit'),(31,56,'Wall Unit'),(61,68,'Loft')],
'Living':[(6,99,'TV UNIT/WALL UNIT/TALL UNIT'),(105,122,'Loft'),(127,136,'Counter Top')],
'Foyer & Veranda':[(7,100,'Base unit/WALL UNIT/TALL UNIT'),(106,123,'Loft'),(128,137,'Counter Top')],
'Wall Panels ':[(6,25,'Wall Panel')],
}
records=[]
item=''
for row in range(2,241):
    item=str(v('Master List','A'+str(row)) or item).strip()
    spec=v('Master List','B'+str(row))
    if spec:
        records.append(dict(item=item,specification=str(spec).strip(),price=number('Master List','C'+str(row)),source_sheet='Master List',source_row=row,formula=v('Master List','C'+str(row)),hardware=number('Master List','D'+str(row)),pricing_area=number('Master List','E'+str(row)),area=None,measurement_mode='area'))
for sheet, rs in ranges.items():
    for lo,hi,item in rs:
        for row in range(lo,hi+1):
            spec=v(sheet,'A'+str(row))
            if not spec: continue
            records.append(dict(item=item,specification=str(spec).strip(),price=number(sheet,'B'+str(row)),source_sheet=sheet,source_row=row,formula=v(sheet,'B'+str(row)),hardware=number(sheet,'C'+str(row)) if item=='Sliding Wardrobe' else None,pricing_area=number(sheet,'D'+str(row)) if item=='Sliding Wardrobe' else None,carcass_price=number(sheet,'E'+str(row)) if item=='Sliding Wardrobe' else None,area=sheet.strip(),measurement_mode='unit' if item in ['Accessories','Appliances'] else 'area'))
products=[]
groups={}
warnings=[]
for r in records:
    key=norm(r['item'])+'|'+norm(r['specification'])
    if key not in groups:
        carcass,shutter,finish=parts(r['specification'])
        p=dict(key=key,item=r['item'],specification=r['specification'],carcass=carcass,shutter=shutter,finish=finish,price=r['price'],measurement_mode=r['measurement_mode'],unit='Nos' if r['measurement_mode']=='unit' else 'Sq Ft',sources=[],areas=[],conflict=None)
        # Match exact specification to the hidden table. Renamed/expanded finish
        # names are not assumed equivalent. Retain unmatched hidden rows below.
        matches=[f for f in flat if norm(f['item'])==norm(r['item']) and norm(f['specification'])==norm(r['specification'])]
        for f in matches:
            p['sources'].append(dict(source_sheet='MasterFlat',source_row=f['source_row'],price=f['price'],raw=f))
        groups[key]=p
        products.append(p)
    p=groups[key]
    p['sources'].append(r)
    if r['area'] and r['area'] not in p['areas']: p['areas'].append(r['area'])
    prices=list(dict.fromkeys(s['price'] for s in p['sources'] if s.get('price') is not None))
    if len(prices)>1:
        p['conflict']={'prices':prices,'sources':p['sources']}
        p['price']=None

# Source instructions explicitly permit dry-area material reuse. Keep a named
# generic group selectable in those areas rather than fabricate price rows.
for p in products:
    if p['item']=='Wall Panel':
        p['areas']=list(dict.fromkeys(p['areas']+['Living','Foyer & Veranda','Bedrooms']))
    if not p['areas']:
        if p['item'] in ['Wodrobe','Bedside Table','Dressing','HEAD BOARD CUSHION','Aristro Wodrobe','Loft']: p['areas']=['Bedrooms']
        elif p['item']=='Shower Partition': p['areas']=['Toilet']
        elif p['item'] in ['Base Unit','Wall Unit']: p['areas']=['Kitchen','Other Wet Areas']

duplicates=[]
for p in products:
    by=defaultdict(list)
    for r in p['sources']: by[r['source_sheet']].append(r['source_row'])
    duplicates.extend({'combination':p['key'],'sheet':s,'rows':rows} for s,rows in by.items() if len(rows)>1)
warnings += ['Accessories & Applicances contains an instruction to add Hafele prices with 45% discount, but no price list. No prices invented.', 'Doors contains names only and explicitly requests empty prices. Imported as unpriced custom selections.', 'Area sheets include additional and changed specifications. Exact text is preserved; hidden records with different specification text are not automatically merged.', 'Bedroom sliding wardrobe rates use Carcass price + Hardware / Sqft, including the explicit 30 Sqft denominator in B128. Master List uses Hardware / AREA. Distinct configurations are preserved.']
data={'source_file':source.name,'sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'products':products,'raw_rows':records,'hidden_lookup':flat,'instructions':v('How to use this sheet','A1'),'areas':list(ranges)+['Doors','Accessories & Applicances'],'report':{'product_count':len(products),'source_price_records':len(records)+len(flat),'areas_imported':9,'specifications_imported':len(products),'conflicts':sum(bool(p['conflict']) for p in products),'duplicates':duplicates,'warnings':warnings}}
(DATA/'current-source.json').write_text(json.dumps(data,indent=2,ensure_ascii=False),encoding='utf8')
shutil.copy2(source,DATA/source.name)
shutil.copy2(Path.home()/'Downloads'/'Mr.Sumit_RevisedQuotation_070920261740.pdf',DATA/'reference-quotation.pdf')
print(json.dumps(data['report'],indent=2))
