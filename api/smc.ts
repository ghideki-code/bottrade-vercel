import { analyzeSMC } from '../src/utils/smcAnalysis.js';
import type { Candle } from '../src/types.js';

const INTERVALS = ['15m', '1h', '4h'];

async function load(symbol: string, interval: string): Promise<Candle[]> {
  const url = `https://fapi.binance.com/fapi/v1/klines?symbol=${encodeURIComponent(symbol)}&interval=${interval}&limit=200`;
  const response = await fetch(url, {signal: AbortSignal.timeout(12000)});
  if (!response.ok) throw new Error(`Binance ${response.status}`);
  const rows = await response.json() as Array<[number,string,string,string,string,string]>;
  return rows.map(r => ({ timestamp: r[0], timeStr: new Date(r[0]).toISOString(), open: +r[1], high: +r[2], low: +r[3], close: +r[4], volume: +r[5] }));
}

export default async function handler(req: Request) {
  try {
    const url = new URL(req.url, 'https://bottrade-vercel.local');
    const symbol = String(url.searchParams.get('symbol') || 'BTCUSDT').toUpperCase().replace('/', '');
    const results = await Promise.all(INTERVALS.map(async interval => [interval, analyzeSMC(await load(symbol, interval))] as const));
    return new Response(JSON.stringify({ symbol, timeframes: Object.fromEntries(results), source: 'Binance USDⓈ-M Futures • SMC engine' }), {
      headers: { 'content-type': 'application/json', 'cache-control': 's-maxage=15, stale-while-revalidate=45' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'SMC data unavailable' }), { status: 502, headers: { 'content-type': 'application/json' } });
  }
}
