import { detectScalpSetup } from '../src/utils/setupEngine.js';
import type { Candle } from '../src/types.js';

type Row = [number,string,string,string,string,string];
async function load(symbol:string, interval:string):Promise<Candle[]> {
  const query=`symbol=${encodeURIComponent(symbol)}&interval=${interval}&limit=120`;
  let r:Response;
  try{r=await fetch(`https://fapi.binance.com/fapi/v1/klines?${query}`,{signal:AbortSignal.timeout(5000)});if(!r.ok)throw new Error(`Futures ${r.status}`)}
  catch{r=await fetch(`https://api.binance.com/api/v3/klines?${query}`,{signal:AbortSignal.timeout(5000)});if(!r.ok)throw new Error(`Spot ${r.status}`)}
  return (await r.json() as Row[]).map(x=>({timestamp:x[0],open:+x[1],high:+x[2],low:+x[3],close:+x[4],volume:+x[5]}));
}
export async function GET(req:Request){
  try{
    const u=new URL(req.url,'https://bottrade-vercel.local');
    const symbols=String(u.searchParams.get('symbols')||'BTCUSDT').split(',').map(x=>x.trim().toUpperCase().replace('/','')).filter(Boolean).slice(0,20);
    const results=await Promise.all(symbols.map(async symbol=>{
      try{
        const [m15,h1,h4]=await Promise.all([load(symbol,'15m'),load(symbol,'1h'),load(symbol,'4h')]);
        return {symbol,setup:detectScalpSetup(m15,h1,h4)};
      }catch(error){return {symbol,error:error instanceof Error?error.message:'unavailable'};}
    }));
    return new Response(JSON.stringify({results,limit:symbols.length,source:'Binance USDⓈ-M Futures • Spot fallback • Batch Setup Engine'}),{headers:{'content-type':'application/json','cache-control':'s-maxage=10, stale-while-revalidate=30'}});
  }catch(error){return new Response(JSON.stringify({error:error instanceof Error?error.message:'Batch setup unavailable'}),{status:502,headers:{'content-type':'application/json'}});}
}
