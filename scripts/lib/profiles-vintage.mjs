import {isIsoDate} from './vintage.mjs';
export const PROFILE_VINTAGE_NOTE='The MoSPI eSankhyiki response does not publish a data revision timestamp. Its archive capture date is recorded separately and must not be treated as the source revision date.';
export function profileVintage(raw={}) {
  // Legacy raw.vintage was assigned by this adapter on capture; it is provenance only.
  const capture=raw.archiveCapturedDate??(typeof raw.archiveCapturedAt==='string'?raw.archiveCapturedAt.slice(0,10):null)??raw.vintage;
  return {vintage:null,vintageStatus:'unknown',vintageNote:PROFILE_VINTAGE_NOTE,...(isIsoDate(capture)?{archiveCapturedDate:capture}:{})};
}
export function profileCapture(date=new Date().toISOString().slice(0,10)) {
  if(!isIsoDate(date))throw Error('Invalid archive capture date');
  return {vintage:null,archiveCapturedDate:date};
}
