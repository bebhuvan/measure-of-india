import * as fmt from '../charts/format.js';
export function investorFormat(value,unit){
 if(value==null)return '—';
 if(unit==='inr_crore'){
  const sign=value<0?'−\u2060':'';const abs=Math.abs(value);
  if(abs>=1e5)return sign+fmt.lc1(abs/1e5);
  if(abs>0&&abs<.005)return sign+'<₹0.01 crore';
  const [whole,fraction]=fmt.num2(abs).split('.');return sign+'₹'+fmt.inr(Number(whole))+'.'+fraction+' crore';
 }
 if(['pct','percent'].includes(unit))return fmt.pct2Minus(value);
 if(unit==='count')return fmt.inr(value);
 const [whole,fraction]=fmt.num2(Math.abs(value)).split('.');return (value<0?'−\u2060':'')+fmt.inr(Number(whole))+'.'+fraction+' '+unit;
}
