import crypto from 'node:crypto';
function instrumentMetadata(input){return Object.fromEntries(Object.entries(input||{}).filter(([key])=>!['semanticReview','vintage','vintageStatus','vintageNote','archiveCapturedDate','reportEditionDate','apiRevisionDate','vintageBasis'].includes(key)));}
export function sourceBundleFingerprint(B){return crypto.createHash('sha256').update(JSON.stringify({meta:instrumentMetadata(B.meta),dates:B.dates,series:B.series})).digest('hex');}
export function sourceRecordFingerprint(B,series){const {key,...record}=series;return crypto.createHash('sha256').update(JSON.stringify({meta:instrumentMetadata(B.meta),dates:B.dates,series:record})).digest('hex');}
