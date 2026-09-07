import type { Candle } from '../types';
import { analyzeSMC } from './smcAnalysis';

export type SetupSide = 'LONG' | 'SHORT' | 'WAIT';
export interface ScalpSetup { side: SetupSide; score: number; entry: number; stop: number; tp1: number; tp2: number; tp3: number; riskReward: number; timeframe: string; confirmations: string[]; invalidations: string[]; }

const atr = (c: Candle[], n = 14) => {
  if (c.length < 2) return 0;
  const x = c.slice(-(n + 1));
  let sum = 0;
  for (let i = 1; i < x.length; i++) sum += Math.max(x[i].high - x[i].low, Math.abs(x[i].high - x[i-1].close), Math.abs(x[i].low - x[i-1].close));
  return sum / Math.max(1, x.length - 1);
};

export function detectScalpSetup(candles15m: Candle[], candles1h: Candle[], candles4h: Candle[]): ScalpSetup {
  const smc15 = analyzeSMC(candles15m);
  const smc1h = analyzeSMC(candles1h);
  const smc4h = analyzeSMC(candles4h);
  const last = candles15m.at(-1);
  if (!last) return { side:'WAIT', score:0, entry:0, stop:0, tp1:0, tp2:0, tp3:0, riskReward:0, timeframe:'15m', confirmations:[], invalidations:['Sem candles'] };
  let longScore = 0, shortScore = 0;
  const confirmations: string[] = [];
  const invalidations: string[] = [];
  const bullish = [smc15, smc1h, smc4h].filter(x => x.bias === 'BULLISH').length;
  const bearish = [smc15, smc1h, smc4h].filter(x => x.bias === 'BEARISH').length;
  longScore += bullish * 16; shortScore += bearish * 16;
  if (smc15.sweep === 'SSL') { longScore += 15; confirmations.push('SSL sweep no 15m'); }
  if (smc15.sweep === 'BSL') { shortScore += 15; confirmations.push('BSL sweep no 15m'); }
  if (smc15.fvg?.type === 'BULLISH' && !smc15.fvg.filled) { longScore += 10; confirmations.push('FVG bullish ativo'); }
  if (smc15.fvg?.type === 'BEARISH' && !smc15.fvg.filled) { shortScore += 10; confirmations.push('FVG bearish ativo'); }
  if (smc15.premiumDiscount === 'DISCOUNT') longScore += 8;
  if (smc15.premiumDiscount === 'PREMIUM') shortScore += 8;
  const side: SetupSide = longScore >= 60 && longScore > shortScore + 8 ? 'LONG' : shortScore >= 60 && shortScore > longScore + 8 ? 'SHORT' : 'WAIT';
  const score = Math.min(100, Math.round(Math.max(longScore, shortScore)));
  const a = atr(candles15m);
  const entry = last.close;
  const risk = Math.max(a * 1.25, entry * 0.0025);
  if (side === 'LONG') { const stop = entry-risk; return {side,score,entry,stop,tp1:entry+risk*1.5,tp2:entry+risk*2.5,tp3:entry+risk*4,riskReward:4,timeframe:'15m',confirmations,invalidations:['Perda do swing low / invalidação SMC']}; }
  if (side === 'SHORT') { const stop = entry+risk; return {side,score,entry,stop,tp1:entry-risk*1.5,tp2:entry-risk*2.5,tp3:entry-risk*4,riskReward:4,timeframe:'15m',confirmations,invalidations:['Rompimento do swing high / invalidação SMC']}; }
  invalidations.push('Confluência insuficiente entre timeframes');
  return {side,score,entry,stop:entry-risk,tp1:entry+risk*1.5,tp2:entry+risk*2.5,tp3:entry+risk*4,riskReward:0,timeframe:'15m',confirmations,invalidations};
}
