import fs from 'node:fs';
import {packCatalogue} from './explore-pack.mjs';
const evidence=packCatalogue('dist',{dry:true});
fs.writeFileSync('docs/status/explorer-catalogue-audit.json',JSON.stringify(evidence,null,2)+'\n');
