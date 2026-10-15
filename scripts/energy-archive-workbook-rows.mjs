import {guardEnergyArchive} from './lib/energy-archive-guard.mjs';
import fs from 'node:fs';import {writeRaw,readRaw} from './lib/util.mjs';
const tables=JSON.parse(fs.readFileSync('/tmp/atlas-energy-workbook-rows.json'));
guardEnergyArchive(process.cwd(),'data/raw/energy-report-2026-workbook-rows.json',{tables},['tables']);
writeRaw(process.cwd(),'data/raw/energy-report-2026-workbook-rows.json',{vintage:'2026-03-30',extractor:'openpyxl data_only, preserving named sheets and cells',sources:Object.fromEntries(['balance','annex-balance'].map(t=>{const r=readRaw(process.cwd(),`data/raw/energy-report-2026-${t}-xlsx.json`);return[t,{url:r.url,sha256:r.sha256}]})),tables});
