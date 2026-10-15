const suffix={mtoe:' Mtoe',ktoe:' thousand toe',pj:' PJ',gwh:' GWh',twh:' TWh',mw:' MW',kt_co2e:' kt CO₂e',mt_co2e:' Mt CO₂e',g_co2e_per_kwh:' g CO₂e/kWh',mwh_per_person:' MWh/person',pct:'%',thousand_tonnes:' thousand tonnes',mmscm:' million m³'};
export const energyFormat=(v,unit)=>v==null?'—':(v<0?'−':'')+Math.abs(v).toLocaleString('en-IN',{maximumFractionDigits:2})+(suffix[unit]??' '+unit);
export const energyUnitLabel=unit=>(suffix[unit]??unit).trim();
