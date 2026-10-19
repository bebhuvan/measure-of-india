#!/usr/bin/env python3
import json,sys
from pypdf import PdfReader
links=[]
for number,page in enumerate(PdfReader(sys.argv[1]).pages,1):
 for ref in page.get('/Annots',[]):
  obj=ref.get_object();action=obj.get('/A',{});action=action.get_object() if hasattr(action,'get_object') else action
  if action and action.get('/URI'):
   links.append({'pdfPage':number,'rect':list(obj.get('/Rect',[])),'url':str(action['/URI'])})
assert len(links)==62 and len({x['url'] for x in links})==62,'Unexpected attachment catalogue: review the new report before acquiring it'
print(json.dumps(links))
