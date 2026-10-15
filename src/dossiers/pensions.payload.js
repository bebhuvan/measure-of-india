// Browser-safe, lossless shared contexts for independently governed singleton plates.
export function governedPensionPayload(plates){
 const contexts=[],policies=[],contextKeys=new Map(),policyKeys=new Map();
 const intern=(value,list,index)=>{const encoded=JSON.stringify(value);if(!index.has(encoded)){index.set(encoded,list.length);list.push(value);}return index.get(encoded);};
 const packed=plates.map(p=>{
  if(p.lines?.length!==1||p.rows?.length!==1||p.lines[0].key!==p.rows[0].key||p.sourceQuality?.canInterpret!==true||p.sourceQuality.canCompare!==false)throw Error('Pension payload requires one reviewed standalone record');
  const key=p.lines[0].key,context={bundle:p.bundle,sourceId:p.sourceId,meta:p.meta,periods:p.periods,dates:p.dates,sourceUrl:p.sourceUrl,sourceNote:p.sourceNote};
  const {binding,...q}=p.sourceQuality,policy={...q,binding:{rawFile:binding.rawFile,rawSha256:binding.rawSha256}},fingerprint=binding.records?.[key];
  if(!/^[a-f0-9]{64}$/.test(fingerprint||''))throw Error('Pension payload source fingerprint is missing');
  const values=p.lines[0].points.map(point=>point.value),last=p.dates.indexOf(p.rows[0].date);
  if(values.length!==p.dates.length||last<0||values[last]!==p.rows[0].value||p.lines[0].points.some((point,i)=>point.date!==p.dates[i]))throw Error('Pension payload source axis or endpoint differs');
  return [p.id,intern(context,contexts,contextKeys),intern(policy,policies,policyKeys),p.title,p.unit,p.kind,p.historyBasis,key,last,values,fingerprint,p.sourceCategoryRole];
 });
 return {schemaVersion:2,contexts,policies,plates:packed};
}
export function unpackGovernedPensionPayload(payload){
 if(payload.schemaVersion!==2||!Array.isArray(payload.plates)||!Array.isArray(payload.contexts)||!Array.isArray(payload.policies))throw Error('Unsupported governed pension payload');
 return payload.plates.map(([id,ci,qi,title,unit,kind,historyBasis,key,last,values,fingerprint,sourceCategoryRole])=>{
  const c=payload.contexts[ci],q=payload.policies[qi];
  if(!c||!q||q.canInterpret!==true||q.canCompare!==false||values.length!==c.dates.length||c.periods.length!==c.dates.length||last<0||last>=values.length||!Number.isFinite(values[last])||!/^[a-f0-9]{64}$/.test(fingerprint||''))throw Error('Governed pension payload source context is invalid');
  return {id,bundle:c.bundle,sourceId:c.sourceId,title,unit,kind,historyBasis,meta:c.meta,...(c.meta.observationKind==='expected-schedule'?{observationKind:'expected-schedule'}:{}),sourceQuality:{...q,binding:{...q.binding,records:{[key]:fingerprint}}},definition:q.definition,referenceBasis:q.referencePeriod,sourceNote:c.sourceNote,sourceCategoryRole,sourceUrl:c.sourceUrl,period:c.periods[last],periods:c.periods,dates:c.dates,rows:[{name:title,key,date:c.dates[last],value:values[last],unit}],lines:[{name:title,key,points:c.dates.map((date,i)=>({date,value:values[i]}))}]};
 });
}
export const governedPensionPayloadText=payload=>JSON.stringify(payload).replaceAll('<','\\u003c');
