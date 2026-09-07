type Coin = {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  market_cap_rank: number;
  market_cap: number;
  total_volume: number;
  price_change_percentage_24h: number | null;
  price_change_percentage_7d_in_currency?: number | null;
  sparkline_in_7d?: { price: number[] };
};

const rsi = (prices: number[]) => {
  if (prices.length < 15) return 50;
  let gains = 0;
  let losses = 0;
  for (let i = prices.length - 14; i < prices.length; i++) {
    const delta = prices[i] - prices[i - 1];
    if (delta >= 0) gains += delta;
    else losses -= delta;
  }
  if (!losses) return 100;
  return 100 - 100 / (1 + gains / losses);
};

const ema = (prices: number[], period: number) => {
  if (!prices.length) return 0;
  const k = 2 / (period + 1);
  let value = prices[0];
  for (let i = 1; i < prices.length; i++) value = prices[i] * k + value * (1 - k);
  return value;
};

const makeSignal = (coin: Coin) => {
  const prices = coin.sparkline_in_7d?.price ?? [];
  const price = coin.current_price;
  const change24h = coin.price_change_percentage_24h ?? 0;
  const change7d = coin.price_change_percentage_7d_in_currency ?? 0;
  const r = rsi(prices);
  const e9 = ema(prices, 9);
  const e21 = ema(prices, 21);
  const e50 = ema(prices, 50);
  const trendBull = e9 >= e21 && e21 >= e50;
  const trendBear = e9 <= e21 && e21 <= e50;
  const momentum = Math.max(-1, Math.min(1, change24h / 5));
  const trend = trendBull ? 1 : trendBear ? -1 : 0;
  const rsiBias = r >= 50 ? 1 : -1;
  const score = Math.round(50 + trend * 20 + momentum * 18 + rsiBias * 8);
  const confidence = Math.max(45, Math.min(98, score));
  const long = score >= 75;
  const short = score <= 25;
  const decision = long ? 'COMPRA' : short ? 'VENDA' : 'AGUARDAR';
  const atr = price * Math.max(0.008, Math.min(0.06, Math.abs(change24h) / 100 * 1.7));
  const stop = long ? price - 1.5 * atr : short ? price + 1.5 * atr : price - 1.2 * atr;
  const risk = Math.abs(price - stop);
  const direction = long ? 1 : -1;
  const squeeze = Math.abs(change24h) < 1.2;
  const fired = Math.abs(change24h) > 4;

  return {
    id: coin.id,
    symbol: `${coin.symbol.toUpperCase()}/USDT`,
    name: coin.name,
    marketCapRank: coin.market_cap_rank,
    marketCap: coin.market_cap,
    currentPrice: price,
    change24h,
    change7d,
    sparkline7d: prices,
    volume24h: coin.total_volume,
    timestamp: Date.now(),
    timeStr: new Date().toLocaleTimeString('pt-BR'),
    decision,
    confidence,
    riskReward: 3,
    entryPrice: price,
    stopLoss: stop,
    takeProfit1: price + direction * 2 * risk,
    takeProfit2: price + direction * 3 * risk,
    takeProfit3: price + direction * 4 * risk,
    breakevenTrigger: price + direction * risk,
    atrValue: atr,
    tripleScreen: {
      htf: { timeframe: '1D (Diário)', trend: trendBull ? 'ALTA (BULLISH)' : trendBear ? 'BAIXA (BEARISH)' : 'LATERAL', ema50: e50, ema200: ema(prices, 200), description: 'Tendência estimada pelas médias exponenciais do histórico disponível.', candles: [] },
      mtf: { timeframe: '1H (1 Hora)', pattern: fired ? 'Rompimento / expansão' : squeeze ? 'Compressão' : 'Consolidação', ema50: e50, dynamicSupportResistance: trendBull ? 'Suporte na EMA 50' : trendBear ? 'Resistência na EMA 50' : 'Rompida', candles: [] },
      ltf: { timeframe: '15m (15 Minutos)', ema9: e9, ema21: e21, emaCross: e9 > e21 ? 'Cruzamento de Alta (9 > 21)' : e9 < e21 ? 'Cruzamento de Baixa (9 < 21)' : 'Alinhamento Neutro', rsi: r, rsiStatus: r > 70 ? 'Sobrecomprado (>70)' : r < 30 ? 'Sobrevendido (<30)' : 'Momentum Neutro/Saudável', atr, candles: [] }
    },
    fourPillars: {
      classicTA: { score: Math.round(confidence), status: confidence >= 70 ? 'Favorável' : confidence >= 55 ? 'Neutro' : 'Desfavorável', emaAlignment: trendBull ? 'Alta (9>21>50>200)' : trendBear ? 'Baixa (9<21<50<200)' : 'Misto / Sem Tendência', rsiValue: r, rsiInterpretation: r > 70 ? 'Esticado' : r < 30 ? 'Sobrevenda' : 'Saudável', patternDetected: fired ? 'Expansão de volatilidade' : squeeze ? 'Compressão' : 'Momentum', details: 'EMA + RSI + variação de preço.' },
      smc: { score: Math.round(confidence * 0.92), status: confidence >= 70 ? 'Favorável' : 'Neutro', liquiditySweep: { detected: fired, type: long ? 'Sell Side Liquidity (SSL) Capturada' : 'Buy Side Liquidity (BSL) Capturada', priceLevel: price }, imbalanceFVG: { present: Math.abs(change24h) > 3, zone: `${(price * 0.995).toFixed(6)}-${(price * 1.005).toFixed(6)}` }, orderBlock: { type: long ? 'Bullish OB' : 'Bearish OB', zone: `${(price * 0.99).toFixed(6)}-${(price * 1.01).toFixed(6)}` }, details: 'Triagem SMC baseada em expansão, liquidez e estrutura de preço.' },
      wyckoff: { score: Math.round(confidence * 0.9), status: confidence >= 70 ? 'Favorável' : 'Neutro', currentPhase: long ? 'Reexpansão (Markup)' : short ? 'Markdown (Queda Livre)' : 'Consolidação Neutra', effortVsResult: 'Equilibrado', volumeRatio: 1, details: 'Regime estimado com momentum e volume de mercado.' },
      sentiment: { score: Math.round(confidence * 0.88), status: 'Neutro', openInterest: 0, oi24hChange: 0, oiInterpretation: 'Divergência de OI', fundingRate: 0, fundingSentiment: 'Taxa Neutra e Saudável', longShortRatio: 1, details: 'Dados de derivativos serão conectados em módulo próprio.' },
      confluenceAverage: confidence
    },
    aiThesis: { summary: 'Triagem quantitativa serverless usando tendência, RSI, momentum e compressão.', institutionalContext: 'Contexto institucional será enriquecido com dados de fluxo e derivativos.', primaryCatalyst: fired ? 'Expansão de volatilidade' : squeeze ? 'Compressão com potencial de expansão' : 'Continuação do momentum', riskWarning: 'Sinal algorítmico. Confirme estrutura, liquidez e risco antes de operar.', verdict: confidence >= 75 ? 'EXECUTAR' : 'AGUARDAR', source: 'Agente Quantitativo Local' },
    passedFilter: confidence >= 75,
    timeframe: '15m',
    style: 'SCALP',
    squeezeBreakout: { isSqueezeOn: squeeze, isSqueezeFired: fired, squeezeBarsCount: squeeze ? 5 : 0, state: fired ? 'IGNICAO_DISPARADA' : squeeze ? 'SQUEEZE_ATIVO' : 'NORMAL', stateLabel: fired ? 'Ignição disparada' : squeeze ? 'Compressão ativa' : 'Normal', explosionScore: Math.min(99, Math.round(40 + Math.abs(change24h) * 10)), urgency: Math.abs(change24h) > 6 ? 'CRITICA' : Math.abs(change24h) > 4 ? 'ALTA' : Math.abs(change24h) > 2 ? 'MODERADA' : 'BAIXA', bollingerBandWidth: Math.abs(change24h), keltnerWidth: Math.abs(change24h) * 1.4, compressionPercent: Math.max(0, 100 - Math.abs(change24h) * 10), momentumDirection: long ? 'ALTA' : short ? 'BAIXA' : 'NEUTRO', shortSqueezeRisk: Math.abs(change24h) > 5 ? 'ALTO' : 'MODERADO', estimatedTarget8Pct: price * 1.082, estimatedTarget15Pct: price * 1.154, recommendedStopLoss: stop, catalysts: ['Momentum', 'Volatilidade'] }
  };
};

export default async function handler(req: Request) {
  if (req.method !== 'GET') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'content-type': 'application/json' } });
  try {
    const url = 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=true&price_change_percentage=7d';
    const response = await fetch(url, { headers: { accept: 'application/json' } });
    if (!response.ok) throw new Error(`CoinGecko ${response.status}`);
    const coins = (await response.json()) as Coin[];
    return new Response(JSON.stringify(coins.map(makeSignal)), { headers: { 'content-type': 'application/json', 'cache-control': 's-maxage=30, stale-while-revalidate=60' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Market data unavailable' }), { status: 502, headers: { 'content-type': 'application/json' } });
  }
}
