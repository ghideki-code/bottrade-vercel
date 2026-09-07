import type { Candle } from '../types';

export type SMCBias = 'BULLISH' | 'BEARISH' | 'NEUTRAL';
export type SweepType = 'BSL' | 'SSL' | 'NONE';

export interface FVGZone { type: 'BULLISH' | 'BEARISH'; low: number; high: number; index: number; filled: boolean; }
export interface OrderBlock { type: 'BULLISH' | 'BEARISH'; low: number; high: number; index: number; mitigated: boolean; }
export interface SMCAnalysis {
  bias: SMCBias;
  structure: 'BOS_UP' | 'BOS_DOWN' | 'CHOCH_UP' | 'CHOCH_DOWN' | 'RANGE';
  sweep: SweepType;
  sweepLevel: number;
  fvg: FVGZone | null;
  orderBlock: OrderBlock | null;
  premiumDiscount: 'PREMIUM' | 'DISCOUNT' | 'EQUILIBRIUM';
  equilibrium: number;
  score: number;
  reasons: string[];
}

function swingHigh(c: Candle[], i: number, w = 2) { return i >= w && i < c.length - w && c[i].high === Math.max(...c.slice(i - w, i + w + 1).map(x => x.high)); }
function swingLow(c: Candle[], i: number, w = 2) { return i >= w && i < c.length - w && c[i].low === Math.min(...c.slice(i - w, i + w + 1).map(x => x.low)); }

export function analyzeSMC(candles: Candle[]): SMCAnalysis {
  const neutral: SMCAnalysis = { bias:'NEUTRAL', structure:'RANGE', sweep:'NONE', sweepLevel:0, fvg:null, orderBlock:null, premiumDiscount:'EQUILIBRIUM', equilibrium:0, score:50, reasons:['Dados insuficientes para estrutura SMC'] };
  if (candles.length < 30) return neutral;
  const recent = candles.slice(-80);
  const highs = recent.map((x,i)=>swingHigh(recent,i)?{i,p:x.high}:null).filter(Boolean) as {i:number;p:number}[];
  const lows = recent.map((x,i)=>swingLow(recent,i)?{i,p:x.low}:null).filter(Boolean) as {i:number;p:number}[];
  const last = recent[recent.length-1];
  const prevHigh = highs.at(-2)?.p ?? Math.max(...recent.slice(0,-5).map(x=>x.high));
  const prevLow = lows.at(-2)?.p ?? Math.min(...recent.slice(0,-5).map(x=>x.low));
  const lastHigh = highs.at(-1)?.p ?? prevHigh;
  const lastLow = lows.at(-1)?.p ?? prevLow;
  const rangeHigh = Math.max(...recent.map(x=>x.high));
  const rangeLow = Math.min(...recent.map(x=>x.low));
  const eq = (rangeHigh + rangeLow) / 2;
  let score = 50;
  const reasons: string[] = [];
  let bias: SMCBias = 'NEUTRAL';
  let structure: SMCAnalysis['structure'] = 'RANGE';
  if (last.close > prevHigh) { bias='BULLISH'; structure='BOS_UP'; score+=18; reasons.push('Rompimento de estrutura para cima (BOS)'); }
  else if (last.close < prevLow) { bias='BEARISH'; structure='BOS_DOWN'; score-=18; reasons.push('Rompimento de estrutura para baixo (BOS)'); }
  const look = recent.slice(-8,-1);
  let sweep: SweepType='NONE', sweepLevel=0;
  if (last.low < Math.min(...look.map(x=>x.low)) && last.close > Math.min(...look.map(x=>x.low))) { sweep='SSL'; sweepLevel=last.low; score+=12; reasons.push('Sweep de Sell Side Liquidity'); }
  if (last.high > Math.max(...look.map(x=>x.high)) && last.close < Math.max(...look.map(x=>x.high))) { sweep='BSL'; sweepLevel=last.high; score-=12; reasons.push('Sweep de Buy Side Liquidity'); }
  let fvg: FVGZone|null=null;
  for(let i=recent.length-1;i>=2;i--){
    const a=recent[i-2], b=recent[i-1], d=recent[i];
    if(a.high < d.low){ fvg={type:'BULLISH',low:a.high,high:d.low,index:i,filled:recent.slice(i+1).some(x=>x.low<=a.high)}; break; }
    if(a.low > d.high){ fvg={type:'BEARISH',low:d.high,high:a.low,index:i,filled:recent.slice(i+1).some(x=>x.high>=a.low)}; break; }
  }
  if(fvg && !fvg.filled){ score += fvg.type==='BULLISH' ? 8 : -8; reasons.push(`FVG ${fvg.type === 'BULLISH' ? 'bullish' : 'bearish'} não mitigado`); }
  let orderBlock: OrderBlock|null=null;
  for(let i=recent.length-2;i>=5;i--){
    const x=recent[i], after=recent[i+1];
    if(after.close>x.high && x.close<x.open){ orderBlock={type:'BULLISH',low:x.low,high:x.open,index:i,mitigated:recent.slice(i+1).some(z=>z.low<=x.low)}; break; }
    if(after.close<x.low && x.close>x.open){ orderBlock={type:'BEARISH',low:x.open,high:x.high,index:i,mitigated:recent.slice(i+1).some(z=>z.high>=x.high)}; break; }
  }
  if(orderBlock && !orderBlock.mitigated){ score += orderBlock.type==='BULLISH'?7:-7; reasons.push(`Order Block ${orderBlock.type === 'BULLISH' ? 'bullish' : 'bearish'} ativo`); }
  const premiumDiscount = last.close > eq*1.003 ? 'PREMIUM' : last.close < eq*0.997 ? 'DISCOUNT' : 'EQUILIBRIUM';
  if(bias==='BULLISH' && premiumDiscount==='DISCOUNT') {score+=5; reasons.push('Preço em discount alinhado ao viés comprador');}
  if(bias==='BEARISH' && premiumDiscount==='PREMIUM') {score-=5; reasons.push('Preço em premium alinhado ao viés vendedor');}
  if(reasons.length===0) reasons.push('Estrutura sem confirmação direcional');
  return {bias,structure,sweep,sweepLevel,fvg,orderBlock,premiumDiscount,equilibrium:eq,score:Math.max(0,Math.min(100,Math.round(score))),reasons};
}
