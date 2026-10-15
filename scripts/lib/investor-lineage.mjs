import zlib from 'node:zlib';
import {readSourceFile} from './immutable-source-install.mjs';
const CONTRACT='data/coverage/investor-lineage-contract.json';
const PIN='acbe779a335c389632fe167a65a6f6d80f8d153e58f73e9de4c6861eab101fbd';
export function investorLineageContract(root=process.cwd()){
 const c=JSON.parse(readSourceFile(root,CONTRACT,PIN));if(c.files.length!==42||c.positions!==310368||new Set(c.files.map(f=>f.bundle)).size!==42)throw Error('Investor lineage scope differs');return c;
}
export function investorLineageBytes(bundle,root=process.cwd()){
 const f=investorLineageContract(root).files.find(f=>f.bundle===bundle);if(!f)throw Error('Unknown Investor lineage bundle');
 const bytes=readSourceFile(root,f.file,f.sha256);if(bytes.length!==f.bytes)throw Error('Investor lineage size differs');
 const text=zlib.gunzipSync(bytes,{maxOutputLength:50000000}).toString();const body=JSON.parse(text);if(body.bundle!==bundle||Object.keys(body.sourceCells).length!==f.positions||text.includes('/home/'))throw Error('Investor lineage source identity/privacy differs');return bytes;
}
