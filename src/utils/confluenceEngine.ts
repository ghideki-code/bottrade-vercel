import type { Candle } from '../types';
import { analyzeSMC } from './smcAnalysis';

export type WyckoffPhase = 'ACCUMULATION' | 'MARKUP' | 'DISTRIBUTION' | 'MARKDOWN' | 'RANGE';

export interface ConfluenceAnalysis {
  score: number;
  bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  wyckoff: { phase: WyckoffPhase; score: number; event: string; effortResult: string };
  smc: ReturnType<typeof analyzeSMC>;
  divergence: 'BULLISH' | 'BEARISH' | 'NONE';
  volumeRatio: number;
  reasons: string[];
}

const rsi = (p: number[], n = 14) => {
  if (p.length < n + 1) return 50;
  let g = 0, l = 0;
  for (let i = p.length - n; i < p.length; i++) {
    const d = p[i] - p[i - 1];
    if (d > 0) g += d; else l -= d;
  }
  return l === 0 ? 100 : 100 - 100 / (1 + (g / n) / (l / n));
};

export function analyzeConfluence(candles: Candle[]): ConfluenceAnalysis {
  const neutral: ConfluenceAnalysis = {
    score: 50, bias: 'NEUTRAL',
    wyckoff: { phase: 'RANGE', score: 50, event: 'Dados insuficientes', effortResult: 'NEUTRO' },
    smc: analyzeSMC(candles), divergence: 'NONE', volumeRatio: 1,
    reasons: ['Aguardando histórico suficiente']
  };
  if (candles.length < 40) return neutral;

  const c = candles.slice(-120);
  const closes = c.map(x => x.close);
  const volumes = c.map(x => x.volume);
  const high = Math.max(...c.map(x => x.high));
  const low = Math.min(...c.map(x => x.low));
  const range = high - low || 1;
  const last = c.at(-1)!;
  const avgVol = volumes.slice(-21, -1).reduce((a, b) => a + b, 0) / 20;
  const volumeRatio = avgVol ? last.volume / avgVol : 1;
  const pricePos = (last.close - low) / range;
  const r = rsi(closes);
  const oldR = rsi(closes.slice(0, -6));
  const oldPrice = closes.at(-6)!;
  let divergence: ConfluenceAnalysis['divergence'] = 'NONE';
  if (last.close < oldPrice && r > oldR + 3) divergence = 'BULLISH';
  if (last.close > oldPrice && r < oldR - 3) divergence = 'BEARISH';

  let phase: WyckoffPhase = 'RANGE';
  let event = 'Equilíbrio de oferta e demanda';
  if (pricePos > 0.68 && volumeRatio > 1.2) { phase = 'MARKUP'; event = 'Expansão com demanda'; }
  else if (pricePos > 0.72 && volumeRatio > 1.4) { phase = 'DISTRIBUTION'; event = 'Possível upthrust / oferta'; }
  else if (pricePos < 0.32 && volumeRatio > 1.2) { phase = 'MARKDOWN'; event = 'Expansão com oferta'; }
  else if (pricePos < 0.28 && volumeRatio > 1.4) { phase = 'ACCUMULATION'; event = 'Possível spring / absorção'; }

  const smc = analyzeSMC(candles);
  let score = 50;
  const reasons: string[] = [];
  score += smc.score - 50;
  if (phase === 'MARKUP' || phase === 'ACCUMULATION') { score += 10; reasons.push(`Wyckoff ${phase.toLowerCase()}`); }
  if (phase === 'MARKDOWN' || phase === 'DISTRIBUTION') { score -= 10; reasons.push(`Wyckoff ${phase.toLowerCase()}`); }
  if (divergence === 'BULLISH') { score += 8; reasons.push('Divergência bullish de momentum'); }
  if (divergence === 'BEARISH') { score -= 8; reasons.push('Divergência bearish de momentum'); }
  if (volumeRatio > 1.5) reasons.push(`Volume elevado (${volumeRatio.toFixed(2)}x)`);
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  return {
    score: clamped,
    bias: clamped >= 62 ? 'BULLISH' : clamped <= 38 ? 'BEARISH' : 'NEUTRAL',
    wyckoff: { phase, score: Math.max(0, Math.min(100, Math.round(50 + (phase === 'MARKUP' || phase === 'ACCUMULATION' ? 20 : phase === 'MARKDOWN' || phase === 'DISTRIBUTION' ? -20 : 0)))), event, effortResult: volumeRatio > 1.3 ? 'Esforço elevado' : 'Esforço normal' },
    smc, divergence, volumeRatio, reasons: reasons.length ? reasons : ['Confluência sem confirmação forte']
  };
}
