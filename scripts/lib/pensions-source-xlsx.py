# Independent standard-library source ZIP/XML reader. No filesystem writes or source mutation.
import io,sys,json,zipfile,xml.etree.ElementTree as E
N={'s':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
with zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read())) as z:
 ss=[''.join(t.text or '' for t in e.findall('.//s:t',N)) for e in E.fromstring(z.read('xl/sharedStrings.xml'))] if 'xl/sharedStrings.xml' in z.namelist() else []
 rels={e.attrib['Id']:e.attrib['Target'] for e in E.fromstring(z.read('xl/_rels/workbook.xml.rels'))};sheets={}
 for sh in E.fromstring(z.read('xl/workbook.xml')).findall('s:sheets/s:sheet',N):
  target=rels[sh.attrib['{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id']];target=target.lstrip('/') if target.startswith('/') else 'xl/'+target;cells={}
  for c in E.fromstring(z.read(target)).findall('.//s:sheetData/s:row/s:c',N):
   v=c.find('s:v',N);t=c.attrib.get('t')
   if t=='inlineStr':value=''.join(e.text or '' for e in c.findall('.//s:t',N))
   elif v is None or v.text is None:value=None
   elif t=='s':value=ss[int(v.text)]
   elif t in ('str','e'):value=v.text
   else:value=float(v.text)
   cells[c.attrib['r']]=value
  sheets[sh.attrib['name']]=cells
 print(json.dumps(sheets))
