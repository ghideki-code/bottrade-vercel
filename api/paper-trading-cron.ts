const PAPER_URL='/api/paper-trading';

export async function GET(){
 try{
  const base=process.env.APP_URL||'';
  if(!base)return new Response(JSON.stringify({ok:false,error:'APP_URL não configurada'}),{status:500,headers:{'content-type':'application/json'}});
  const market=await fetch(`${base}/api/market`,{cache:'no-store'});
  if(!market.ok)throw new Error(`market API ${market.status}`);
  const signals=await market.json() as Array<{symbol:string;currentPrice:number}>;
  const prices=Object.fromEntries(signals.map(x=>[x.symbol,x.currentPrice]));
  const r=await fetch(`${base}${PAPER_URL}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'MARK',prices}),cache:'no-store'});
  const result=await r.json();
  return new Response(JSON.stringify({ok:r.ok,checked:signals.length,result}),{status:r.ok?200:502,headers:{'content-type':'application/json','cache-control':'no-store'}});
 }catch(e){return new Response(JSON.stringify({ok:false,error:e instanceof Error?e.message:'Falha no monitor Paper Trading'}),{status:500,headers:{'content-type':'application/json'}})}
}
