// A capture date cannot stand in for an unpublished source revision date.
export const UNKNOWN_VINTAGE_TEXT = 'Source revision date not published';
export function isIsoDate(value) {
 return typeof value==='string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10)===value;
}
export function vintageError(meta={},today=new Date().toISOString().slice(0,10)) {
 if(meta.vintage===null){
  if(meta.vintageStatus!=='unknown'||typeof meta.vintageNote!=='string'||meta.vintageNote.trim().length<20)
   return 'null vintage requires vintageStatus unknown and a substantive vintageNote';
 }else{
  if(!isIsoDate(meta.vintage))return 'vintage must be an ISO date or explicitly declared unknown';
  if(meta.vintageStatus==='unknown')return 'unknown vintage status cannot carry a dated vintage';
  if(meta.vintage>today)return 'data vintage is in the future';
  // AGENTS.md rule 5: the day the Atlas captured a body is never the day the source revised it
  if(meta.archiveCapturedDate&&meta.vintage===meta.archiveCapturedDate)return 'vintage equals the archive capture date (a fetch date, not a data vintage)';
 }
 for(const key of ['archiveCapturedDate','reportEditionDate','apiRevisionDate']){
  if(meta[key]!=null&&(!isIsoDate(meta[key])||meta[key]>today))return `${key} must be a real, nonfuture ISO date`;
 }
 return null;
}
export function vintageText(meta={}) {
 const error=vintageError(meta);if(error)throw new Error(error);
 return meta.vintage===null?UNKNOWN_VINTAGE_TEXT:meta.vintage;
}
export function vintageSummary(items) {
 const unknown=items.filter(m=>m.vintage===null).length;
 for(const m of items)vintageText(m);
 if(unknown)return unknown===items.length?UNKNOWN_VINTAGE_TEXT:'Mixed dated and unknown revisions';
 return items.map(m=>m.vintage).sort().at(-1)??'';
}
