import React,{useEffect,useState}from'react';
import{Activity,BrainCircuit,RefreshCw,ShieldCheck,Target,TrendingDown,TrendingUp}from'lucide-react';

type Agent={agent:string;decision:'LONG'|'SHORT'|'NEUTRO';confidence:number;thesis:string;keyLevels:string[];invalidation:string;riskFlags:string[];model?:string;error?:string};
type Props={symbol:string;market:unknown};

const labels:Record<string,string>={TECHNICAL:'Técnico',SMC:'SMC',WYCKOFF_GANN:'Wyckoff + Gann',DIVERGENCE:'Divergências'};

export function AIAgentsPanel({symbol,market}:Props){
 const[data,setData]=useState<{agents:Agent[];supervisor:{decision:string;confidence:number;agreement:number;agentsUsed:number;status:string;executionAllowed:boolean;note:string};mode:string}|null>(null);
 const[loading,setLoading]=useState(false);const[error,setError]=useState('');
 const run=async()=>{setLoading(true);setError('');try{const r=await fetch('/api/ai-agents',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({symbol,market})});const json=await r.json();if(!r.ok)throw new Error(json?.error||`API ${r.status}`);setData(json)}catch(e){setError(e instanceof Error?e.message:'Falha na análise multi-agente')}finally{setLoading(false)}};
 useEffect(()=>{if(symbol&&market)run()},[symbol,JSON.stringify(market)]);
 return <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
  <div className="flex items-center justify-between gap-3"><div><h3 className="font-bold flex gap-2 items-center"><BrainCircuit size={17}/>Comitê IA Multi-Agente</h3><p className="text-[11px] text-slate-500 mt-1">4 especialistas independentes + Supervisor. Análise somente, sem execução.</p></div><button onClick={run} disabled={loading} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50" title="Atualizar análise">{loading?<RefreshCw size={15} className="animate-spin"/>:<RefreshCw size={15}/>}</button></div>
  {error&&<div className="text-xs text-rose-400 bg-rose-950/30 border border-rose-900 rounded-lg p-3">{error}</div>}
  {loading&&!data&&<div className="text-sm text-slate-400 py-5 text-center">Executando os 4 agentes em paralelo...</div>}
  {data&&<>
   <div className="grid md:grid-cols-3 gap-3">
    <div className="rounded-lg bg-slate-950 border border-slate-800 p-4"><div className="text-[10px] text-slate-500">SUPERVISOR</div><div className={`text-2xl font-bold mt-1 ${data.supervisor.decision==='LONG'?'text-emerald-400':data.supervisor.decision==='SHORT'?'text-rose-400':'text-amber-400'}`}>{data.supervisor.decision}</div><div className="text-xs text-slate-400">{data.supervisor.confidence}% confiança</div></div>
    <div className="rounded-lg bg-slate-950 border border-slate-800 p-4"><div className="text-[10px] text-slate-500">CONSENSO</div><div className="text-2xl font-bold mt-1">{data.supervisor.agreement}%</div><div className="text-xs text-slate-400">{data.supervisor.agentsUsed}/4 agentes válidos</div></div>
    <div className="rounded-lg bg-slate-950 border border-slate-800 p-4"><div className="text-[10px] text-slate-500">STATUS</div><div className="text-sm font-bold mt-2 text-amber-400">{data.supervisor.status.replaceAll('_',' ')}</div><div className="text-[10px] text-slate-500 mt-1">Execução: bloqueada</div></div>
   </div>
   <div className="grid md:grid-cols-2 gap-3">{data.agents.map(a=><div key={a.agent} className="rounded-lg bg-slate-950 border border-slate-800 p-4">
    <div className="flex justify-between items-start gap-2"><div className="flex items-center gap-2">{a.decision==='LONG'?<TrendingUp size={15} className="text-emerald-400"/>:a.decision==='SHORT'?<TrendingDown size={15} className="text-rose-400"/>:<Activity size={15} className="text-amber-400"/>}<b>{labels[a.agent]||a.agent}</b></div><span className={`text-xs font-bold ${a.decision==='LONG'?'text-emerald-400':a.decision==='SHORT'?'text-rose-400':'text-slate-400'}`}>{a.decision} {a.confidence}%</span></div>
    <p className="text-xs text-slate-300 mt-3 leading-5">{a.thesis}</p>
    {a.keyLevels?.length>0&&<div className="text-[10px] text-slate-400 mt-3"><Target size={12} className="inline mr-1"/>Níveis: {a.keyLevels.join(' • ')}</div>}
    <div className="text-[10px] text-slate-500 mt-2"><ShieldCheck size={12} className="inline mr-1"/>Invalidação: {a.invalidation||'não definida'}</div>
    {a.riskFlags?.length>0&&<div className="text-[10px] text-rose-400 mt-2">Riscos: {a.riskFlags.join(' • ')}</div>}
   </div>)}</div>
   <div className="text-[10px] text-slate-500">{data.supervisor.note}</div>
  </>}
 </div>
}
