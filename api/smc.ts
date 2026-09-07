import { analyzeSMC } from '../src/utils/smcAnalysis.js';
import type { Candle } from '../src/types.js';
const INTERVALS=['15m','1h','4h'];
async function load(symbol:string,interval:string):Promise<Candle[]>{
  const query=`symbol=${encodeURIComponent(symbol)}&interval=${interval}&limit=200`;
  let r:Response;
  try{r=await fetch(`https://fapi.binance.com/fapi/v1/klines?${query}`,{signal:AbortSignal.timeout(5000)});if(!r.ok)throw new Error(`Futures ${r.status}`)}
  catch{r=await fetch(`https://api.binance.com/api/v3/klines?${query}`,{signal:AbortSignal.timeout(5000)});if(!r.ok)throw new Error(`Spot ${r.status}`)}
  return(await r.json() as Array<[number,string,string,string,string,string]>).map(x=>({timestamp:x[0],timeStr:new Date(x[0]).toISOString(),open:+x[1],high:+x[2],low:+x[3],close:+x[4],volume:+x[5]}))
}
export async function GET(req:Request){try{const u=new URL(req.url,'https://bottrade-vercel.local'),symbol=String(u.searchParams.get('symbol')||'BTCUSDT').toUpperCase().replace('/',''),results=await Promise.all(INTERVALS.map(async interval=>[interval,analyzeSMC(await load(symbol,interval))] as const));return new Response(JSON.stringify({symbol,timeframes:Object.fromEntries(results),source:'Binance USDⓈ-M Futures • Spot fallback • SMC engine'}),{headers:{'content-type':'application/json','cache-control':'s-maxage=15, stale-while-revalidate=45'}})}catch(error){return new Response(JSON.stringify({error:error instanceof Error?error.message:'SMC data unavailable'}),{status:502,headers:{'content-type':'application/json'}})}}
