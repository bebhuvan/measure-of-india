import {pct1,pct2,inr} from '../charts/format.js';
export function digitalFormat(value,unit='pct'){if(value===null||!Number.isFinite(value))return '—';return unit==='pct'?pct1(value):unit==='pct_rse'?pct2(value):inr(value);}
