import type { Candle } from '../types';
import { analyzeSMC } from './smcAnalysis';

export type WyckoffPhase = 'ACCUMULATION'|'MARKUP'|'DISTRIBUTION'|'MARKDOWN'|'RANGE';
export interface ConfluenceAnalysis {
  score:number; bias:'BULLISH'|'BEARISH'|'NEUTRAL';
  components:{smc:number;structure:number;wyckoff:number;divergence:number;volume:number;squeeze:number};
  wyckoff:{phase:WyckoffPhase;score:number;event:string;effortResult:string};
  smc:ReturnType<typeof analyzeSMC>;
  divergence:'BULLISH'|'BEARISH'|'NONE'; volumeRatio:number;
  structure:'BULLISH'|'BEARISH'|'MIXED'; squeeze:{active:boolean;compression:number;momentum:'BULLISH'|'BEARISH'|'NEUTRAL'};
  reasons:string[];
}
const rsi=(p:number[],n=14)=>{if(p.length<n+1)return 50;let g=0,l=0;for(let i=p.length-n;i<p.length;i++){const d=p[i]-p[i-1];if(d>0)g+=d;else l-=d;}return l===0?100:100-100/(1+(g/n)/(l/n));};
const ema=(p:number[],n:number)=>{if(!p.length)return 0;const k=2/(n+1);let v=p[0];for(let i=1;i<p.length;i++)v=p[i]*k+v*(1-k);return v;};

export function analyzeConfluence(candles:Candle[]):ConfluenceAnalysis{
  const smc=analyzeSMC(candles);
  const neutral:ConfluenceAnalysis={score:50,bias:'NEUTRAL',components:{smc:50,structure:50,wyckoff:50,divergence:50,volume:50,squeeze:50},wyckoff:{phase:'RANGE',score:50,event:'Dados insuficientes',effortResult:'NEUTRO'},smc,divergence:'NONE',volumeRatio:1,structure:'MIXED',squeeze:{active:false,compression:0,momentum:'NEUTRAL'},reasons:['Aguardando histórico suficiente']};
  if(candles.length<50)return neutral;
  const c=candles.slice(-120), closes=c.map(x=>x.close), volumes=c.map(x=>x.volume), last=c.at(-1)!;
  const e9=ema(closes,9),e21=ema(closes,21),e50=ema(closes,50), structure:e='x';
  void e;
  const structure:ConfluenceAnalysis['structure']=e9>e21&&e21>e50?'BULLISH':e9<e21&&e21<e50?'BEARISH':'MIXED';
  const avgVol=volumes.slice(-21,-1).reduce((a,b)=>a+b,0)/20, volumeRatio=avgVol?last.volume/avgVol:1;
  const r=rsi(closes), oldR=rsi(closes.slice(0,-6)), oldPrice=closes.at(-6)!;
  let divergence:ConfluenceAnalysis['divergence']='NONE';
  if(last.close<oldPrice&&r>oldR+3)divergence='BULLISH';
  else if(last.close>oldPrice&&r<oldR-3)divergence='BEARISH';
  const hi=Math.max(...c.map(x=>x.high)),lo=Math.min(...c.map(x=>x.low)),range=Math.max(hi-lo,last.close*1e-9),pos=(last.close-lo)/range;
  let phase:WyckoffPhase='RANGE',event='Equilíbrio de oferta e demanda';
  if(pos<.28&&volumeRatio>1.4){phase='ACCUMULATION';event='Possível spring / absorção';}
  else if(pos>.72&&volumeRatio>1.4){phase='DISTRIBUTION';event='Possível upthrust / oferta';}
  else if(pos>.68&&volumeRatio>1.2){phase='MARKUP';event='Expansão com demanda';}
  else if(pos<.32&&volumeRatio>1.2){phase='MARKDOWN';event='Expansão com oferta';}
  const avgRange=c.slice(-20,-1).reduce((a,x)=>a+(x.high-x.low),0)/19;
  const recentRange=c.slice(-5).reduce((a,x)=>a+(x.high-x.low),0)/5;
  const compression=avgRange?Math.max(0,Math.min(100,(1-recentRange/avgRange)*100)):0;
  const squeezeActive=compression>=25;
  const squeezeMomentum:last.close>e21?'BULLISH':last.close<e21?'BEARISH':'NEUTRAL';
  const components={
    smc:smc.score,
    structure:structure==='BULLISH'?100:structure==='BEARISH'?0:50,
    wyckoff:phase==='ACCUMULATION'||phase==='MARKUP'?100:phase==='DISTRIBUTION'||phase==='MARKDOWN'?0:50,
    divergence:divergence==='BULLISH'?100:divergence==='BEARISH'?0:50,
    volume:Math.max(0,Math.min(100,50+(volumeRatio-1)*50)),
    squeeze:squeezeActive?(squeezeMomentum==='BULLISH'?80:squeezeMomentum==='BEARISH'?20:50):50
  };
  const score=Math.round(components.smc*.35+components.structure*.20+components.wyckoff*.15+components.divergence*.10+components.volume*.10+components.squeeze*.10);
  const bias=score>=62?'BULLISH':score<=38?'BEARISH':'NEUTRAL';
  const reasons:string[]=[];
  if(smc.reasons.length)reasons.push(...smc.reasons.slice(0,2));
  if(structure!=='MIXED')reasons.push(`Estrutura ${structure.toLowerCase()} (EMA 9/21/50)`);
  if(phase!=='RANGE')reasons.push(`Wyckoff ${phase.toLowerCase()}`);
  if(divergence!=='NONE')reasons.push(`Divergência ${divergence.toLowerCase()}`);
  if(volumeRatio>1.5)reasons.push(`Volume elevado (${volumeRatio.toFixed(2)}x)`);
  if(squeezeActive)reasons.push(`Compressão ${compression.toFixed(0)}%`);
  return {score,bias,components,wyckoff:{phase,score:components.wyckoff,event,effortResult:volumeRatio>1.3?'Esforço elevado':'Esforço normal'},smc,divergence,volumeRatio,structure,squeeze:{active:squeezeActive,compression,momentum:squeezeMomentum},reasons:reasons.length?reasons:['Confluência sem confirmação forte']};
}
