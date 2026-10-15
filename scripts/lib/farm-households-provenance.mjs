import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// Report 587 edition: official PIB release PRID 1753856, 10 September 2021.
// This edition date does not establish the revision date of its API representation.
export const REPORT_EDITION_DATE='2021-09-10';
export function farmArchiveHash(root,rel){
 const plain=path.join(root,rel),file=fs.existsSync(plain)?plain:plain+'.gz';
 return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}
export function farmApiProvenance(root,rel,raw){
 const archiveCapturedDate=raw.archiveCapturedDate??raw.vintage;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(archiveCapturedDate??''))throw Error('API archive capture date not recorded: '+rel);
 return {vintage:null,vintageStatus:'unknown',vintageNote:'The API does not publish a data revision date. The report edition date and archive capture date are separate provenance and do not establish the API revision date.',reportEditionDate:REPORT_EDITION_DATE,apiRevisionDate:null,archiveCapturedDate,archiveSha256:farmArchiveHash(root,rel)};
}
export function farmReportProvenance(root,rel,raw){
 if(raw.vintage!==REPORT_EDITION_DATE||!/September\s+2021/.test(raw.text.slice(0,5000)))throw Error('Report edition changed; review its publication provenance');
 return {vintage:REPORT_EDITION_DATE,vintageStatus:'known',vintageBasis:'report-edition',vintageNote:'The date identifies the published Report 587 edition, not an assertion about later undocumented file revisions.',reportEditionDate:REPORT_EDITION_DATE,sourceRevisionDate:null,archiveCapturedDate:null,archiveCaptureNote:'The capture timestamp was not recorded in this preserved report archive.',archiveSha256:farmArchiveHash(root,rel),sourceDocumentSha256:raw.sha256};
}
