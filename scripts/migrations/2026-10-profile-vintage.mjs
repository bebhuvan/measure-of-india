// Metadata-only, idempotent correction. Never rebake numeric series or edit archival raw.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {readRaw,rawPath,writeSeries} from '../lib/util.mjs';
import {profileVintage} from '../lib/profiles-vintage.mjs';
const root=process.cwd(),out='docs/status/launch-performance/profile-vintage-migration.json';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const sourceShape=B=>sha(JSON.stringify({dates:B.dates,series:B.series}));
const report={method:'Only generic profiles-mospi metadata. Existing archival bytes, all date arrays and complete series objects are checked before/after; no semantic rebake.',rows:[],changed:0};
for(const file of fs.readdirSync('data/series').filter(x=>x.endsWith('.json')).sort()) {
 const rel='data/series/'+file,B=JSON.parse(fs.readFileSync(rel));if(B.meta?.dossier!=='profiles-mospi')continue;
 const rawRel=B.meta.note?.match(/Baked from (data\/raw\/profiles-mospi\/[^\s]+\.json)/)?.[1];
 if(!rawRel)throw Error(`No proven archival provenance for ${file}`);
 const rawFile=rawPath(root,rawRel),rawBefore=sha(fs.readFileSync(rawFile)),before=sourceShape(B),old=JSON.stringify(B.meta);
 Object.assign(B.meta,profileVintage(readRaw(root,rawRel)));
 if(JSON.stringify(B.meta)!==old){writeSeries(root,rel,B);report.changed++;}
 const after=JSON.parse(fs.readFileSync(rel));
 if(sourceShape(after)!==before||sha(fs.readFileSync(rawFile))!==rawBefore)throw Error('Source/series drift: '+file);
 report.rows.push({bundle:file.slice(0,-5),series:Object.keys(B.series).length,sourceShapeSha256:before,rawFile:path.relative(root,rawFile),rawSha256:rawBefore,vintage:after.meta.vintage,archiveCapturedDate:after.meta.archiveCapturedDate??null});
}
if(report.rows.length!==331)throw Error(`Expected audited mapper scope331bundles; found${report.rows.length}`);
fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({bundles:report.rows.length,changed:report.changed,series:report.rows.reduce((n,r)=>n+r.series,0)}));
