// Deterministic facts; no LLM calls, rates, cross-record sums or expected headline.
import fs from 'node:fs';import path from 'node:path';
import {pensionsModel} from '../src/dossiers/pensions.model.js';
import {qualityRegistryVersion} from '../src/explore/source-quality.js';
const model=pensionsModel(),facts={slug:'pensions',sourceQualityVersion:qualityRegistryVersion,headline:model.headline,coverage:model.coverage,series:Object.fromEntries(Object.entries(model.facts).map(([id,f])=>[id,{...f,ruler:{observationKind:f.observationKind,referenceBasis:f.referenceBasis},source:{bundle:f.bundle,key:f.key,fingerprint:f.sourceRecordFingerprint}}])),sourceOnly:model.heldLedger.records,pending:model.pending};
const output=path.join(process.cwd(),'pipeline/out/facts-pensions.json');fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(facts,null,1)+'\n');console.log('wrote pipeline/out/facts-pensions.json ('+Object.keys(facts.series).length+' governed source records)');
