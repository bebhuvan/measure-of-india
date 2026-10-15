// Producer dates and archive capture times describe different events.
import fs from 'node:fs';import path from 'node:path';import {readRaw} from './util.mjs';
export const ENERGY_FOREWORD_URL='https://www.mospi.gov.in/sites/default/files/publication_reports/Energy_Statistics_2025/Foreword_27032025.pdf';
export function energyVintageProvenance(root,group){
 const unknown={vintage:null,vintageStatus:'unknown',apiRevisionDate:null,sourceRevisionDate:null};
 if(group.slug.startsWith('energy-ember-')){
  const raw=readRaw(root,group.meta.rawFile),evidence=JSON.parse(fs.readFileSync(path.join(root,'data/coverage/energy.capture-evidence.json'))).captures[group.meta.rawFile];
  if(!evidence||evidence.sourceHash!==raw.sourceHash)throw Error('Energy archive capture evidence does not match original source hash');
  return {...unknown,vintageNote:'The original Ember record does not publish a data release or revision date. Archive capture and response timestamps are separate provenance and cannot establish that date.',archiveCapturedDate:evidence.archiveCapturedDate,archiveCapturedAt:evidence.archiveCapturedAt,archiveCaptureNote:evidence.basis,archiveSourceSha256:raw.sourceHash,...(evidence.legacySnapshotLabel?{legacySnapshotLabel:evidence.legacySnapshotLabel}:{}),...(raw.body?.stats?.timestamp?{apiResponseAt:raw.body.stats.timestamp}: {})};
 }
 if(group.slug.startsWith('energy-mospi-'))return {...unknown,vintageNote:'These archived API rows and envelopes contain no publisher revision timestamp. Compatibility with a report edition does not establish the API revision date.',archiveCapturedDate:null,archiveCapturedAt:null,archiveCaptureNote:'Capture time was not recorded in the archived API envelope.',reportEditionYear:2025,documentForewordDate:'2025-03-25',documentForewordURL:ENERGY_FOREWORD_URL};
 if(group.slug.startsWith('energy-report-transformation-'))return {...unknown,vintageNote:'The report foreword is dated 2025-03-25, but that signature date does not establish publication or a revision date for these report bytes.',archiveCapturedDate:null,archiveCapturedAt:null,archiveCaptureNote:'Capture time was not recorded in the preserved report envelope.',reportEditionYear:2025,documentForewordDate:'2025-03-25',documentForewordURL:ENERGY_FOREWORD_URL};
 if(group.slug.startsWith('energy-report-2026-')){
  const list=readRaw(root,'data/raw/energy-report-2026-list.json').body.data,wb=readRaw(root,group.meta.rawFile),rows=list.filter(r=>/Chapter 7|Annexure IV/.test(r.chapter_title));
  if(rows.length!==2||rows.some(r=>r.published_date!=='2026-03-30'))throw Error('Energy report publication-date evidence changed; review required');
  const dated=rows.find(r=>new URL(r.file_two.path,'https://www.mospi.gov.in/').href===group.meta.sourceUrl);
  if(!dated||!Object.values(wb.sources).some(r=>r.url===group.meta.sourceUrl))throw Error('Energy report date is not linked to its actual source workbook');
  return {vintage:dated.published_date,vintageStatus:'known',vintageBasis:'publisher-publication-edition',vintageNote:'This is the publisher listing date of the report edition; it does not assert the date of any later undocumented file revision.',reportEditionDate:dated.published_date,reportEditionYear:2026,sourceDateURL:'https://www.mospi.gov.in/publications-reports/innerpage/2817',sourceDateEvidence:{rawFile:'data/raw/energy-report-2026-list.json',chapterId:dated.chapter_id,field:'published_date',sourceFileURL:group.meta.sourceUrl},sourceRevisionDate:null,archiveCapturedDate:null,archiveCapturedAt:null,archiveCaptureNote:'Capture time was not recorded in the preserved workbook envelope.'};
 }
 throw Error('Unclassified energy vintage provenance '+group.slug);
}
export function energyVintageMismatches(meta,expected){return Object.keys(expected).filter(k=>JSON.stringify(meta[k])!==JSON.stringify(expected[k]));}
