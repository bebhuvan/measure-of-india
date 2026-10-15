import {readRaw,writeRaw} from './lib/util.mjs';
import {energyReportCells} from './lib/energy-report-cells.mjs';
const raw=readRaw(process.cwd(),'data/raw/energy-report-2025.json'),tables=energyReportCells(raw);
writeRaw(process.cwd(),'data/raw/energy-report-balance-cells.json',{vintage:raw.vintage,url:raw.url,sourceHash:raw.sha256,extractor:'pdftotext -layout; named balance-page headers and exact column counts',tables});console.log('report tables',tables.length,'cells',tables.reduce((n,t)=>n+t.rows.length*t.fuels.length,0));
