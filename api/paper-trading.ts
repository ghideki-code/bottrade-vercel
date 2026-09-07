type Position={id:string;symbol:string;side:'LONG'|'SHORT';entry:number;quantity:number;notional:number;stop:number;tp1:number;tp2:number;tp3:number;openedAt:number;status:'OPEN'|'CLOSED';exit?:number;closedAt?:number;realizedPnl?:number;closeReason?:string};

type Store={equity:number;startingEquity:number;positions:Position[];trades:Position[];updatedAt:number};
const g=globalThis as typeof globalThis & {_paperStore?:Store};
const store=()=>g._paperStore ||= {equity:1000,startingEquity:1000,positions:[],trades:[],updatedAt:Date.now()};
function n(v:unknown,d=0){const x=Number(v);return Number.isFinite(x)?x:d}
function json(x:unknown,status=200){return new Response(JSON.stringify(x),{status,headers:{'content-type':'application/json','cache-control':'no-store'}})}

export async function GET(){const s=store();return json({mode:'PAPER_TRADING',enabled:true,equity:s.equity,startingEquity:s.startingEquity,pnl:s.equity-s.startingEquity,openPositions:s.positions.filter(p=>p.status==='OPEN'),closedTrades:s.trades,updatedAt:s.updatedAt})}

export async function POST(req:Request){
 const b=await req.json().catch(()=>({})) as any;const s=store();const action=String(b.action||'').toUpperCase();
 if(action==='RESET'){s.equity=n(b.equity,1000);s.startingEquity=s.equity;s.positions=[];s.trades=[];s.updatedAt=Date.now();return json({ok:true,mode:'PAPER_TRADING',equity:s.equity})}
 if(action==='OPEN'){
  const side=b.side==='SHORT'?'SHORT':'LONG',entry=n(b.entry),qty=n(b.quantity),stop=n(b.stop),tp1=n(b.tp1),tp2=n(b.tp2),tp3=n(b.tp3);if(!b.symbol||entry<=0||qty<=0||stop<=0)return json({error:'symbol, entry, quantity e stop são obrigatórios'},400);
  const p:Position={id:`P-${Date.now()}`,symbol:String(b.symbol),side,entry,quantity:qty,notional:entry*qty,stop,tp1,tp2,tp3,openedAt:Date.now(),status:'OPEN'};s.positions.push(p);s.updatedAt=Date.now();return json({ok:true,position:p,mode:'PAPER_TRADING'});
 }
 if(action==='CLOSE'){
  const id=String(b.id||'');const p=s.positions.find(x=>x.id===id&&x.status==='OPEN');if(!p)return json({error:'posição aberta não encontrada'},404);const exit=n(b.exit);if(exit<=0)return json({error:'exit inválido'},400);const pnl=(p.side==='LONG'?exit-p.entry:p.entry-exit)*p.quantity;p.status='CLOSED';p.exit=exit;p.closedAt=Date.now();p.realizedPnl=pnl;p.closeReason=String(b.reason||'MANUAL');s.equity+=pnl;s.trades.push({...p});s.positions=s.positions.filter(x=>x.id!==id);s.updatedAt=Date.now();return json({ok:true,trade:p,equity:s.equity,pnl:s.equity-s.startingEquity,mode:'PAPER_TRADING'});
 }
 if(action==='MARK'){
  const prices=b.prices||{};const closed=[] as Position[];for(const p of [...s.positions]){if(p.status!=='OPEN')continue;const price=n(prices[p.symbol]);if(price<=0)continue;let reason='';if(p.side==='LONG'){if(price<=p.stop){reason='STOP';}else if(p.tp3>0&&price>=p.tp3){reason='TP3';}}else{if(price>=p.stop){reason='STOP';}else if(p.tp3>0&&price<=p.tp3){reason='TP3';}}if(reason){const pnl=(p.side==='LONG'?price-p.entry:p.entry-price)*p.quantity;p.status='CLOSED';p.exit=price;p.closedAt=Date.now();p.realizedPnl=pnl;p.closeReason=reason;s.equity+=pnl;s.trades.push({...p});s.positions=s.positions.filter(x=>x.id!==p.id);closed.push(p)}}s.updatedAt=Date.now();return json({ok:true,closed,equity:s.equity,pnl:s.equity-s.startingEquity,openPositions:s.positions,mode:'PAPER_TRADING'});
 }
 return json({error:'action deve ser OPEN, CLOSE, MARK ou RESET'},400)
}
