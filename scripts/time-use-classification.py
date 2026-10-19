#!/usr/bin/env python3
"""Recover the complete activity dictionary from the original report, not its API."""
import base64,gzip,hashlib,json,os,re,subprocess,sys,tempfile
from pathlib import Path
root=Path(sys.argv[1] if len(sys.argv)>1 else '.')
report=json.load(gzip.open(root/'data/raw/time-use/report-2024.json.gz'))
binary=base64.b64decode(report['bodyBase64'])
assert hashlib.sha256(binary).hexdigest()==report['sha256']
with tempfile.TemporaryDirectory(prefix='atlas-tus-classification-') as temp:
 pdf=Path(temp)/'report.pdf';pdf.write_bytes(binary)
 text=subprocess.check_output([os.environ.get('ATLAS_PDFTOTEXT','pdftotext'),'-layout',str(pdf),'-']).decode()
section=text[text.index('TUS activity classification as per'):];section=section[:section.index('Appendix D:')]
labels={};key=None
for line in section.splitlines():
 if re.search(r'Appendix C:|Time Use in India|^\s*(Major|divisio|n|Division|Gro|up|Activity title)\s*$|^\s*Division\s+Gro\s+Activity title\s*$',line):continue
 match=re.match(r'^\s*(\d{1,3})\s{2,}(\S.*)$',line)
 if match:
  code=match[1];key='Major Division: '+code if len(code)==1 else code
  assert key not in labels,key
  labels[key]=match[2].strip()
 elif key and line.strip() and not line.strip().startswith(('International Classification','(ICATUS')):
  labels[key]+= (' ' if not labels[key].endswith('-') else '')+line.strip()
assert len(labels)==230, f'Unreviewed activity catalogue size {len(labels)}'
api=json.load(gzip.open(root/'data/raw/time-use/discovery-4.json.gz'))['metadata']['data']['icatus_activity']
normal=lambda s:re.sub('[^a-z0-9]','',s.lower())
differences=[]
for row in api:
 m=re.match(r'^\((\d{3}|Division:\s*\d{2}|Major Division:\s*\d)\)\s*(.*)$',row['icatus_activity_name']);assert m,row
 code=re.sub(r'^Division:\s*','',m[1]);assert code in labels,code
 if normal(m[2])!=normal(labels[code]):differences.append({'code':code,'apiLabel':m[2],'reportLabel':labels[code]})
print(json.dumps({'generator':'scripts/time-use-classification.py','sourceUrl':report['url'],'reportSha256':report['sha256'],'nativeTextSha256':hashlib.sha256(text.encode()).hexdigest(),'sourceSection':'Appendix C, ICATUS 2016 activity classification','labels':labels,'apiComparison':{'codes':len(api),'matches':len(api)-len(differences),'differences':differences}},ensure_ascii=False))
