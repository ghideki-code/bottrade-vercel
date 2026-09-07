import { detectScalpSetup } from '../src/utils/setupEngine.js';
import type { Candle } from '../src/types.js';

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

export async function GET(req: Request) {
  try {
    const u = new URL(req.url, 'https://bottrade-vercel.local');
    const symbol = String(u.searchParams.get('symbol') || 'BTCUSDT').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const [m15, h1, h4] = await Promise.all([candles(symbol, '15m'), candles(symbol, '1h'), candles(symbol, '4h')]);
    const base = detectScalpSetup(m15, h1, h4);
    const setup = {
      ...base,
      direction: base.side,
      tradeLogic: base.side === 'WAIT'
        ? 'Sem vantagem direcional suficiente. Aguarde nova confirmação estrutural e confluência entre os timeframes.'
        : `${base.side === 'LONG' ? 'Compra' : 'Venda'} baseada em confluência multi-timeframe. ${base.confirmations.slice(0, 5).join('. ')}.`,
      entryLow: base.entry,
      entryHigh: base.entry,
    };
    return new Response(JSON.stringify({ setup, source: 'Binance USDⓈ-M Futures • Spot fallback • Triple Screen Setup Engine' }), {
      headers: { 'content-type': 'application/json', 'cache-control': 's-maxage=15, stale-while-revalidate=45' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Setup unavailable' }), {
      status: 502,
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    });
  }
}
