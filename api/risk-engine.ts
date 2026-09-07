type RiskInput={
 symbol?:string;
 side?:'LONG'|'SHORT'|'WAIT'|'NEUTRO';
 equity?:number;
 entry?:number;
 stop?:number;
 tp1?:number;
 tp2?:number;
 tp3?:number;
 score?:number;
 quality?:string;
 riskPercent?:number;
 maxPositionPercent?:number;
};

function num(v:unknown,fallback=0){const n=Number(v);return Number.isFinite(n)?n:fallback}
function round(v:number,d=4){const p=10**d;return Math.round(v*p)/p}

export async function POST(req:Request){
 try{
  const b=await req.json().catch(()=>({})) as RiskInput;
  const equity=num(b.equity,1000);
  const entry=num(b.entry);
  const stop=num(b.stop);
  const side=b.side||'WAIT';
  const score=num(b.score);
  const riskPercent=Math.min(2,Math.max(0.1,num(b.riskPercent,0.5)));
  const maxPositionPercent=Math.min(100,Math.max(1,num(b.maxPositionPercent,25)));
  if(equity<=0||entry<=0||stop<=0) return new Response(JSON.stringify({error:'equity, entry e stop devem ser positivos'}),{status:400,headers:{'content-type':'application/json'}});
  if(side==='WAIT'||side==='NEUTRO') return new Response(JSON.stringify({allowed:false,status:'AGUARDAR_GATILHO',reason:'Sem direção operacional confirmada',riskPercent}),{headers:{'content-type':'application/json','cache-control':'no-store'}});
  const distance=Math.abs(entry-stop);
  const stopPercent=distance/entry;
  const riskBudget=equity*(riskPercent/100);
  const quantity=riskBudget/distance;
  const rawNotional=quantity*entry;
  const maxNotional=equity*(maxPositionPercent/100);
  const notional=Math.min(rawNotional,maxNotional);
  const finalQuantity=notional/entry;
  const lossAtStop=finalQuantity*distance;
  const targets=[num(b.tp1),num(b.tp2),num(b.tp3)].filter(x=>x>0);
  const rr=targets.map(t=>Math.abs(t-entry)/distance);
  const avgRR=rr.length?rr.reduce((a,x)=>a+x,0)/rr.length:0;
  const quality=String(b.quality||'C').toUpperCase();
  const allowed=score>=60&&['A+','A'].includes(quality)&&avgRR>=1.5&&stopPercent<=0.03;
  return new Response(JSON.stringify({
   symbol:b.symbol||'BTCUSDT',side,allowed,status:allowed?'RISCO_APROVADO':'RISCO_REPROVADO',
   account:{equity,riskPercent,riskBudget:maxRound(riskBudget),maxPositionPercent,maxNotional:round(maxNotional,2)},
   trade:{entry:round(entry),stop:round(stop),stopDistance:round(distance),stopPercent:round(stopPercent*100,3),quantity:round(finalQuantity,8),notional:round(notional,2),lossAtStop:round(lossAtStop,2)},
   targets:targets.map((t,i)=>({name:`TP${i+1}`,price:round(t),rr:round(rr[i],2)})),
   averageRR:round(avgRR,2),
   rules:{scoreMinimum:60,qualityRequired:['A+','A'],minimumRR:1.5,maxStopPercent:3},
   note:'Cálculo de risco. Nenhuma ordem é enviada por este endpoint.'
  }),{headers:{'content-type':'application/json','cache-control':'no-store'}});
 }catch(e){return new Response(JSON.stringify({error:e instanceof Error?e.message:'Falha no Risk Engine'}),{status:500,headers:{'content-type':'application/json'}})}
}
function maxRound(v:number){return round(v,2)}
