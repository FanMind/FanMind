import {createHash} from 'node:crypto';
import {resolveFanMindAiQualityProfile} from '../config/openAiPriceCatalog.mjs';
export function supportCapacityConfiguration({xml,qualityMode='balanced',now=Date.now()}){
 if(typeof xml!=='string'||xml.length>16384||!resolveFanMindAiQualityProfile(qualityMode)||!Number.isSafeInteger(now))throw Error('capacity_configuration_invalid');
 const dates=[...xml.matchAll(/<Cube time=['"](\d{4}-\d{2}-\d{2})['"]/gu)];const rates=[...xml.matchAll(/<Cube currency=['"]USD['"] rate=['"]([0-9]+\.[0-9]{1,9})['"]/gu)];
 if(dates.length!==1||rates.length!==1)throw Error('capacity_fx_invalid');
 const validFrom=dates[0][1]+'T14:00:00.000Z';const from=Date.parse(validFrom);const until=from+72*3600000;
 if(!Number.isFinite(from)||from>now||until<=now)throw Error('capacity_fx_expired');
 const [whole,fraction]=rates[0][1].split('.');const scale=10n**BigInt(fraction.length);const usdPerEur=BigInt(whole)*scale+BigInt(fraction);
 if(usdPerEur<=0n)throw Error('capacity_fx_invalid');
 // Nearest integer nano-EUR/USD; no floating-point accounting or default exchange rate.
 const eurPerUsdNanos=Number((1000000000n*scale+usdPerEur/2n)/usdPerEur);
 if(!Number.isSafeInteger(eurPerUsdNanos)||eurPerUsdNanos<1)throw Error('capacity_fx_invalid');
 const snapshot={eurPerUsdNanos,version:'ecb-usd-eur-'+dates[0][1]+'-'+createHash('sha256').update(xml).digest('hex').slice(0,12),validFrom,validUntil:new Date(until).toISOString(),source:'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml',usdPerEur:rates[0][1],observedAt:new Date(now).toISOString()};
 return {FANMIND_SUPPORT_AI_QUALITY_MODE:qualityMode,FANMIND_AI_CAPACITY_FX_SNAPSHOT:JSON.stringify(snapshot)};
}
