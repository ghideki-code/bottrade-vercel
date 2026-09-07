export type SignalDecision = 'COMPRA' | 'VENDA' | 'AGUARDAR';

export type TradingExecutionStyle = 'SCALP' | 'DAY_TRADE' | 'SWING_TRADE' | 'POSITION';

export type WyckoffPhase = 
  | 'Acumulação (Spring/Test)' 
  | 'Reexpansão (Markup)' 
  | 'Distribuição (UTAD)' 
  | 'Markdown (Queda Livre)'
  | 'Consolidação Neutra';

export interface Candle {
  timestamp: number;
  timeStr: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TripleScreenData {
  htf: { timeframe: '1D (Diário)'; trend: 'ALTA (BULLISH)' | 'BAIXA (BEARISH)' | 'LATERAL'; ema50: number; ema200: number; description: string; candles: Candle[]; };
  mtf: { timeframe: '1H (1 Hora)'; pattern: string; ema50: number; dynamicSupportResistance: 'Suporte na EMA 50' | 'Resistência na EMA 50' | 'Rompida'; candles: Candle[]; };
  ltf: { timeframe: '15m (15 Minutos)'; ema9: number; ema21: number; emaCross: 'Cruzamento de Alta (9 > 21)' | 'Cruzamento de Baixa (9 < 21)' | 'Alinhamento Neutro'; rsi: number; rsiStatus: 'Sobrecomprado (>70)' | 'Sobrevendido (<30)' | 'Momentum Neutro/Saudável'; atr: number; candles: Candle[]; };
}

export interface PillarClassicTA { score:number; status:'Favorável'|'Neutro'|'Desfavorável'; emaAlignment:'Alta (9>21>50>200)'|'Baixa (9<21<50<200)'|'Misto / Sem Tendência'; rsiValue:number; rsiInterpretation:string; patternDetected:string; details:string; }
export interface PillarSMC { score:number; status:'Favorável'|'Neutro'|'Desfavorável'; liquiditySweep:{detected:boolean;type:'Buy Side Liquidity (BSL) Capturada'|'Sell Side Liquidity (SSL) Capturada'|'Nenhum Sweep Recente';priceLevel:number}; imbalanceFVG:{present:boolean;zone:string}; orderBlock:{type:'Bullish OB'|'Bearish OB'|'Neutro';zone:string}; details:string; }
export interface PillarWyckoff { score:number; status:'Favorável'|'Neutro'|'Desfavorável'; currentPhase:WyckoffPhase; effortVsResult:'Volume Alto com Absorção (Institucional Atuando)'|'Volume Baixo com Deslocamento (Falta de Oposição)'|'Volume Clímax / Exaustão'|'Equilibrado'; volumeRatio:number; details:string; }
export interface PillarSentiment { score:number; status:'Favorável'|'Neutro'|'Desfavorável'; openInterest:number; oi24hChange:number; oiInterpretation:'Dinheiro Novo Entrando (Confirma Tendência)'|'Fechamento de Posições (Exaustão)'|'Divergência de OI'; fundingRate:number; fundingSentiment:'Euforia Excessiva (Perigo de Queda)'|'Pânico / Negativo (Oportunidade de Compra)'|'Taxa Neutra e Saudável'; longShortRatio:number; details:string; }
export interface FourPillars { classicTA:PillarClassicTA; smc:PillarSMC; wyckoff:PillarWyckoff; sentiment:PillarSentiment; confluenceAverage:number; }

export interface TradeSignal { id:string; symbol:string; name:string; marketCapRank?:number; marketCap?:number; currentPrice:number; change24h:number; change7d?:number; sparkline7d?:number[]; volume24h:number; timestamp:number; timeStr:string; decision:SignalDecision; confidence:number; riskReward:number; entryPrice:number; stopLoss:number; takeProfit1:number; takeProfit2:number; takeProfit3:number; breakevenTrigger:number; atrValue:number; tripleScreen:TripleScreenData; fourPillars:FourPillars; aiThesis:{summary:string;institutionalContext:string;primaryCatalyst:string;riskWarning:string;verdict:'EXECUTAR'|'AGUARDAR'|'DESCARTADO';source:'Gemini 3.8 Flash'|'Groq/Qwen 2.5 Engine'|'Agente Quantitativo Local';}; passedFilter:boolean; timeframe?:string; style?:TradingExecutionStyle; squeezeBreakout?:SqueezeBreakoutAnalysis; }
export type SqueezeState='SQUEEZE_ATIVO'|'IGNICAO_DISPARADA'|'EXPANSAO_ALTA'|'NORMAL';
export interface SqueezeBreakoutAnalysis { isSqueezeOn:boolean; isSqueezeFired:boolean; squeezeBarsCount:number; state:SqueezeState; stateLabel:string; explosionScore:number; urgency:'CRITICA'|'ALTA'|'MODERADA'|'BAIXA'; bollingerBandWidth:number; keltnerWidth:number; compressionPercent:number; momentumDirection:'ALTA'|'BAIXA'|'NEUTRO'; shortSqueezeRisk:'EXTREMO'|'ALTO'|'MODERADO'|'BAIXO'; estimatedTarget8Pct:number; estimatedTarget15Pct:number; recommendedStopLoss:number; catalysts:string[]; }
export interface DailyBacktestTrade { id:string; date:string; symbol:string; direction:'LONG'|'SHORT'; entryPrice:number; exitPrice:number; stopLoss:number; takeProfit:number; rrRatio:number; confidence:number; pnlPercent:number; status:'TP ATINGIDO'|'SL ATINGIDO'|'BREAKEVEN'|'ABERTO'; holdingBars:number; topPillar:'Clássica'|'SMC'|'Wyckoff'|'Sentimento'; }
export interface DailyBacktestMetrics { totalTrades:number; winningTrades:number; losingTrades:number; winRate:number; profitFactor:number; netProfitPercent:number; maxDrawdownPercent:number; sharpeRatio:number; averageRR:number; initialCapital:number; finalCapital:number; pillarWinRates:{classicTA:number;smc:number;wyckoff:number;sentiment:number}; equityCurve:{date:string;equity:number;tradePnl:number;drawdown:number;}[]; trades:DailyBacktestTrade[]; periodDays?:number; startDate?:string; endDate?:string; }
export interface SystemNotification { id:string; timestamp:number; timeStr:string; type:'CRITICAL_SIGNAL'|'FUNDING_ALERT'|'VOLATILITY_SPIKE'|'LIQUIDITY_SWEEP'|'SYSTEM_STATUS'|'SQUEEZE_BREAKOUT'|'EXPLOSION_ALERT'; severity:'high'|'medium'|'info'; symbol?:string; title:string; message:string; read:boolean; actionable?:boolean; }
export interface RiskPositionResult { accountCapital:number; riskPercent:number; riskAmountUsd:number; entryPrice:number; stopLoss:number; priceDistancePercent:number; positionSizeUsd:number; positionUnits:number; potentialProfitTP1:number; potentialProfitTP2:number; }
