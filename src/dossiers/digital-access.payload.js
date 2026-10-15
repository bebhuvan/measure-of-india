// Versioned tuples remove repeated field names while retaining every chart/CSV field.
export function packDigitalPayload(model){
 return {version:1,facts:model.facts,plates:model.plates.map(p=>[p.id,p.unit,p.period,p.bundle,p.rows.map(r=>[r.name,r.value,r.series,...(r.quality?[1,r.quality.households,r.quality.rse]:[0])])])};
}
export function unpackDigitalPayload(payload){
 const fail=()=>{throw Error('Invalid Digital-access payload');},text=v=>typeof v==='string',number=v=>v===null||Number.isFinite(v);
 if(!payload||payload.version!==1||!payload.facts||typeof payload.facts!=='object'||Array.isArray(payload.facts)||!Array.isArray(payload.plates))fail();
 const ids=new Set();
 const plates=payload.plates.map(p=>{
  if(!Array.isArray(p)||p.length!==5||!p.slice(0,4).every(text)||ids.has(p[0])||!Array.isArray(p[4]))fail();
  const [id,unit,period,bundle,packedRows]=p;ids.add(id);
  const rows=packedRows.map(r=>{
   if(!Array.isArray(r)||!text(r[0])||!number(r[1])||!text(r[2])||!((r[3]===0&&r.length===4)||(r[3]===1&&r.length===6&&number(r[4])&&number(r[5]))))fail();
   const [name,value,series,hasQuality,households,rse]=r;
   return {name,value,series,...(hasQuality===1?{quality:{households,rse}}:{})};
  });
  return {id,unit,period,bundle,rows};
 });
 return {facts:payload.facts,plates};
}
