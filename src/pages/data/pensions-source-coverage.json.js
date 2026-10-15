// Full source inventory, including source-only holds and metadata workbooks.
import fs from 'node:fs';
import {loadPensionDownloadContract,pensionSourceCoverageResponse} from '../../dossiers/governed-downloads.js';
export function GET(){const c=loadPensionDownloadContract(),bundles=new Map(Object.keys(c.bundles).map(bundle=>[bundle,JSON.parse(fs.readFileSync('data/series/'+bundle+'.json','utf8'))]));return pensionSourceCoverageResponse(bundles);}
