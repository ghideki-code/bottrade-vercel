import { analyzeConfluence } from '../src/utils/confluenceEngine';
import type { Candle } from '../src/types';

const toCandle = (x: [number,string,string,string,string,string]): Candle => ({
  time: x[0], open: +x[1], high: +x[2], low: +x[3], close: +x[4], volume: +x[5]
});

export default async function handler(req: Request) {
  try {
    const url = new URL(req.url);
    const symbol = String(url.searchParams.get('symbol') || 'BTCUSDT').toUpperCase().replace('/', '');
    const interval = String(url.searchParams.get('interval') || '15m');
    const response = await fetch(`https://fapi.binance.com/fapi/v1/klines?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(interval)}&limit=250`);
    if (!response.ok) throw new Error(`Binance ${response.status}`);
    const raw = await response.json() as [number,string,string,string,string,string][];
    const analysis = analyzeConfluence(raw.map(toCandle));
    return new Response(JSON.stringify({ symbol, interval, ...analysis, source: 'Binance USDⓈ-M Futures' }), {
      headers: { 'content-type': 'application/json', 'cache-control': 's-maxage=15, stale-while-revalidate=45' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Confluence unavailable' }), {
      status: 502, headers: { 'content-type': 'application/json' }
    });
  }
}
