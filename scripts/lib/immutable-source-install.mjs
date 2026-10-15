import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
export const sourceSha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function checkedSourcePath(root,relative){
 if(!/^data\/(raw|coverage)\/[a-zA-Z0-9_./-]+$/.test(relative)||relative.split('/').includes('..'))throw Error('Invalid immutable source path');
 let file=fs.realpathSync(root);for(const part of relative.split('/')){file=path.join(file,part);if(fs.lstatSync(file).isSymbolicLink())throw Error('Immutable source symlink refused');}
 if(!fs.statSync(file).isFile())throw Error('Immutable source is not a file');
 return file;
}
export function sourceFileStamp(root,relative){
 const s=fs.statSync(checkedSourcePath(root,relative),{bigint:true});return [s.dev,s.ino,s.size,s.mtimeNs,s.ctimeNs].join(':');
}
export function readSourceFile(root,relative,expected){
 const bytes=fs.readFileSync(checkedSourcePath(root,relative));if(expected&&sourceSha(bytes)!==expected)throw Error('Immutable source hash differs: '+relative);return bytes;
}
export function installImmutableSource(root,relative,bytes,{sha256,size}={}){
 if(sourceSha(bytes)!==sha256||bytes.length!==size)throw Error('Incoming immutable source differs');
 if(!/^data\/raw\/[a-zA-Z0-9_./-]+$/.test(relative)||relative.split('/').includes('..'))throw Error('Invalid immutable install path');
 const base=fs.realpathSync(root),parts=relative.split('/');let dir=base;
 for(const part of parts.slice(0,-1)){dir=path.join(dir,part);if(!fs.existsSync(dir))fs.mkdirSync(dir);if(fs.lstatSync(dir).isSymbolicLink()||!fs.statSync(dir).isDirectory())throw Error('Immutable install parent refused');}
 const destination=path.join(dir,parts.at(-1));
 if(fs.existsSync(destination)){readSourceFile(base,relative,sha256);return {installed:false,sha256,size};}
 const temporary=destination+'.install-'+process.pid+'-'+crypto.randomBytes(6).toString('hex')+'.tmp';let fd;
 try{fd=fs.openSync(temporary,'wx');fs.writeFileSync(fd,bytes);fs.fsyncSync(fd);fs.closeSync(fd);fd=undefined;
  // Atomic no-clobber publication, even if another writer races after existsSync.
  fs.linkSync(temporary,destination);const d=fs.openSync(dir,'r');try{fs.fsyncSync(d);}finally{fs.closeSync(d);}
 }finally{if(fd!==undefined)fs.closeSync(fd);if(fs.existsSync(temporary))fs.unlinkSync(temporary);}
 readSourceFile(base,relative,sha256);return {installed:true,sha256,size};
}
