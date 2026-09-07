import { analyzeSMC } from '../src/utils/smcAnalysis.js';
import type { Candle } from '../src/types.js';

type Setup = {
  symbol: string;
  interval: string;
  side: 'LONG' | 'SHORT' | 'WAIT';
  direction: 'LONG' | 'SHORT' | 'WAIT';
  score: number;
  entry: number;
  entryLow: number;
  entryHigh: number;
  stop: number;
  tp1: number;
  tp2: number;
  tp3: number;
  riskReward: number;
  confirmations: string[];
  invalidations: string[];
  tradeLogic: string;
};

async function candles(symbol: string, interval: string): Promise<Candle[]> {
  const query = `symbol=${encodeURIComponent(symbol)}&interval=${interval}&limit=200`;
  let response: Response;
  let futuresError = '';
  try {
    response = await fetch(`https://fapi.binance.com/fapi/v1/klines?${query}`, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) {
      futuresError = `Futures ${response.status}`;
      throw new Error(futuresError);
    }
  } catch (error) {
    futuresError = error instanceof Error ? error.message : futuresError || 'Futures request failed';
    response = await fetch(`https://api.binance.com/api/v3/klines?${query}`, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error(`${futuresError}; Spot ${response.status}`);
  }
  const data = await response.json() as unknown;
  if (!Array.isArray(data) || data.length < 40) throw new Error(`${futuresError || 'Market data'}; candles insuficientes`);
  return (data as Array<[number, string, string, string, string, string]>).map(x => ({
    timestamp: x[0], timeStr: new Date(x[0]).toISOString(), open: +x[1], high: +x[2], low: +x[3], close: +x[4], volume: +x[5],
  }));
}

function finitePositive(value: number) {
  return Number.isFinite(value) && value > 0;
}

function detect(symbol: string, c: Candle[], h: Candle[]): Setup {
  const s = analyzeSMC(c);
  const sh = analyzeSMC(h);
  const last = c.at(-1)!;
  const recent = c.slice(-15);
  const atr = recent.reduce((sum, x) => sum + Math.max(x.high - x.low, 0), 0) / recent.length;
  const confirmations: string[] = [];
  const invalidations: string[] = [];
  let long = 0;
  let short = 0;

  if (s.bias === 'BULLISH') { long += 22; confirmations.push('SMC bullish no timeframe de execução'); }
  if (s.bias === 'BEARISH') { short += 22; confirmations.push('SMC bearish no timeframe de execução'); }
  if (sh.bias === 'BULLISH') { long += 20; confirmations.push('Estrutura de 4H bullish'); }
  if (sh.bias === 'BEARISH') { short += 20; confirmations.push('Estrutura de 4H bearish'); }
  if (s.sweep === 'SSL') { long += 14; confirmations.push('Liquidez SSL capturada'); }
  if (s.sweep === 'BSL') { short += 14; confirmations.push('Liquidez BSL capturada'); }
  if (s.fvg && !s.fvg.filled) {
    if (s.fvg.type === 'BULLISH') { long += 10; confirmations.push('FVG bullish ativo'); }
    else { short += 10; confirmations.push('FVG bearish ativo'); }
  }
  if (s.premiumDiscount === 'DISCOUNT') { long += 8; confirmations.push('Preço em discount'); }
  if (s.premiumDiscount === 'PREMIUM') { short += 8; confirmations.push('Preço em premium'); }

  const direction: Setup['side'] = long >= short + 12 ? 'LONG' : short >= long + 12 ? 'SHORT' : 'WAIT';
  const score = Math.min(100, Math.max(long, short));
  const rawLow = direction === 'LONG' ? Math.min(last.close, last.low) : direction === 'SHORT' ? Math.min(last.close, last.high) : last.close;
  const rawHigh = direction === 'LONG' ? Math.max(last.close, last.high) : direction === 'SHORT' ? Math.max(last.close, last.high) : last.close;
  const entryLow = Math.min(rawLow, rawHigh);
  const entryHigh = Math.max(rawLow, rawHigh);
  const entry = direction === 'WAIT' ? last.close : (entryLow + entryHigh) / 2;
  const safeAtr = finitePositive(atr) ? atr : Math.max(last.close * 0.005, 0.00000001);
  const stop = direction === 'LONG' ? entryLow - 1.2 * safeAtr : direction === 'SHORT' ? entryHigh + 1.2 * safeAtr : last.close;
  const risk = direction === 'LONG' ? entry - stop : direction === 'SHORT' ? stop - entry : 0;
  const tp1 = direction === 'LONG' ? entry + risk : direction === 'SHORT' ? entry - risk : last.close;
  const tp2 = direction === 'LONG' ? entry + 2 * risk : direction === 'SHORT' ? entry - 2 * risk : last.close;
  const tp3 = direction === 'LONG' ? entry + 3 * risk : direction === 'SHORT' ? entry - 3 * risk : last.close;
  const riskReward = risk > 0 ? Number((((Math.abs(tp1 - entry) + Math.abs(tp2 - entry) + Math.abs(tp3 - entry) / 1) / risk) / 3).toFixed(2)) : 0;

  if (direction === 'LONG') invalidations.push(`Perda de ${stop.toPrecision(7)} invalida a tese de compra.`);
  if (direction === 'SHORT') invalidations.push(`Rompimento de ${stop.toPrecision(7)} invalida a tese de venda.`);
  if (direction === 'WAIT') invalidations.push('A estrutura atual não apresenta vantagem direcional suficiente.');

  const tradeLogic = direction === 'WAIT'
    ? 'O sistema não encontrou confluência direcional suficiente. A decisão segura é aguardar uma confirmação estrutural.'
    : `${direction === 'LONG' ? 'Compra' : 'Venda'} baseada em confluência de estrutura, liquidez e zonas SMC. ${confirmations.slice(0, 4).join('. ')}.`;

  return {
    symbol,
    interval: '15m',
    side: direction,
    direction,
    score,
    entry,
    entryLow,
    entryHigh,
    stop,
    tp1,
    tp2,
    tp3,
    riskReward,
    confirmations,
    invalidations,
    tradeLogic,
  };
}

export async function GET(req: Request) {
  try {
    const u = new URL(req.url, 'https://bottrade-vercel.local');
    const symbol = String(u.searchParams.get('symbol') || 'BTCUSDT').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const [cr, hr] = await Promise.all([
      candles(symbol, '15m').then(x => ({ ok: true as const, x })).catch(error => ({ ok: false as const, error })),
      candles(symbol, '4h').then(x => ({ ok: true as const, x })).catch(error => ({ ok: false as const, error })),
    ]);
    if (!cr.ok || !hr.ok) {
      throw new Error(`Setup data unavailable: 15m=${cr.ok ? 'OK' : cr.error instanceof Error ? cr.error.message : 'ERROR'}; 4h=${hr.ok ? 'OK' : hr.error instanceof Error ? hr.error.message : 'ERROR'}`);
    }
    const setup = detect(symbol, cr.x, hr.x);
    return new Response(JSON.stringify({ setup, source: 'Binance USDⓈ-M Futures • Spot fallback • Setup Engine' }), {
      headers: { 'content-type': 'application/json', 'cache-control': 's-maxage=15, stale-while-revalidate=45' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Setup unavailable' }), {
      status: 502,
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    });
  }
}
