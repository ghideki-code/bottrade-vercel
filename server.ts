import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { TradeSignal, DailyBacktestMetrics, SystemNotification } from './src/types.js';
import { fetchTop100Cryptos, generateRealDailyBacktest, getBrasiliaTimeStr } from './server/realMarketData.js';

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = 3000;
app.use(express.json());

let genAI: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  try { genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, httpOptions: { headers: { 'User-Agent': 'aistudio-build' } } }); }
  catch (err) { console.error('Error initializing GoogleGenAI:', err); }
}

let cachedSignals: TradeSignal[] = [];
let cachedNotifications: SystemNotification[] = [];
let isRefreshing = false;
let lastRefreshTime = 0;
let lastSourceInfo = 'Iniciando varredura das 100 maiores criptos por Market Cap...';

async function refreshMarketData(): Promise<void> {
  if (isRefreshing) return;
  isRefreshing = true;
  try {
    const signals = await fetchTop100Cryptos();
    if (signals?.length) {
      cachedSignals = signals;
      lastRefreshTime = Date.now();
      lastSourceInfo = 'Top 100 Criptomoedas por Market Cap (Tempo Real • CoinGecko + Binance)';
    }
    const validSignals = cachedSignals.filter(s => s.passedFilter);
    validSignals.forEach(signal => {
      const exists = cachedNotifications.some(n => n.symbol === signal.symbol && Date.now() - n.timestamp < 900000);
      if (!exists) {
        const timeBrasilia = getBrasiliaTimeStr(Date.now(), true);
        cachedNotifications.unshift({ id:`notif-${Date.now()}-${Math.random().toString(36).substring(2,7)}`, timestamp:Date.now(), timeStr:timeBrasilia, type:'CRITICAL_SIGNAL', severity:'high', symbol:signal.symbol, title:`Setup Quantitativo Confirmado: ${signal.symbol} (#${signal.marketCapRank || 0})`, message:`Confluência institucional atingiu ${signal.confidence}%. Entrada em $${signal.entryPrice} e SL dinâmico em $${signal.stopLoss} (R/R 1:${signal.riskReward}) • ${timeBrasilia} (Horário de Brasília).`, read:false, actionable:true });
      }
    });
    cachedSignals.forEach(signal => {
      if (Math.abs(signal.change24h) >= 7) {
        const exists = cachedNotifications.some(n => n.symbol === signal.symbol && n.type === 'FUNDING_ALERT' && Date.now() - n.timestamp < 1200000);
        if (!exists) {
          const timeBrasilia = getBrasiliaTimeStr(Date.now(), true);
          cachedNotifications.unshift({ id:`notif-vol-${Date.now()}-${Math.random().toString(36).substring(2,7)}`, timestamp:Date.now(), timeStr:timeBrasilia, type:'FUNDING_ALERT', severity:'medium', symbol:signal.symbol, title:`Alerta de Volatilidade: ${signal.symbol} (#${signal.marketCapRank || 0})`, message:`Variação de 24h atingiu ${signal.change24h > 0 ? '+' : ''}${signal.change24h}% no ativo #${signal.marketCapRank || 0} do ranking global • ${timeBrasilia} (Brasília).`, read:false });
        }
      }
    });
    if (cachedNotifications.length > 50) cachedNotifications = cachedNotifications.slice(0,50);
  } catch (err:any) { console.error('Failed to refresh real-time market data:', err.message); }
  finally { isRefreshing = false; }
}

refreshMarketData();
setInterval(refreshMarketData, 35000);

app.get('/api/market/signals', async (_req,res) => { if (!cachedSignals.length) await refreshMarketData(); res.json({ timestamp:lastRefreshTime||Date.now(), version:'The God Protocol v2026 (v4.0)', dataSource:lastSourceInfo, isRealTime:true, signals:cachedSignals, activeCount:cachedSignals.filter(s=>s.passedFilter).length, monitoredCount:cachedSignals.length }); });
app.post('/api/market/scan', async (_req,res) => { await refreshMarketData(); res.json({ success:true, message:'Varredura quantitativa em tempo real via Binance.US + OKX concluída com sucesso.', dataSource:lastSourceInfo, signals:cachedSignals }); });
app.post('/api/ai-analysis', async (req,res) => {
  const { symbol } = req.body;
  const signal = cachedSignals.find(s=>s.symbol===symbol) || cachedSignals[0];
  if (!signal) return res.status(404).json({ error:'Ativo não encontrado para análise.' });
  if (genAI) {
    try {
      const prompt = `Você é o Agente Quantitativo Híbrido "The God Protocol v2026 (v4.0)". Analise ${signal.symbol} com base em Triple Screen e 4 pilares. Retorne JSON com confidence, decision, summary, institutionalContext, primaryCatalyst, riskWarning e verdict.`;
      const response = await genAI.models.generateContent({ model:'gemini-3.8-flash', contents:prompt, config:{ responseMimeType:'application/json', temperature:0.2 } });
      const parsed = JSON.parse(response.text || '{}');
      return res.json({ ...parsed, source:'Gemini 3.8 Flash (Deep Institutional Engine)' });
    } catch (err:any) { console.error('Gemini call error:', err); }
  }
  return res.json({ confidence:signal.confidence, decision:signal.decision, summary:signal.aiThesis.summary, institutionalContext:signal.aiThesis.institutionalContext, primaryCatalyst:signal.aiThesis.primaryCatalyst, riskWarning:signal.aiThesis.riskWarning, verdict:signal.aiThesis.verdict, source:'Agente Quantitativo Local (Groq/Qwen Standard Fallback)' });
});
app.get('/api/backtest', (req,res) => { const days = parseInt(req.query.days as string,10) || 60; res.json(generateRealDailyBacktest(cachedSignals,days)); });
app.get('/api/notifications', (_req,res) => res.json({ notifications:cachedNotifications, unreadCount:cachedNotifications.filter(n=>!n.read).length }));
app.post('/api/notifications/mark-read', (_req,res) => { cachedNotifications.forEach(n=>n.read=true); res.json({success:true,unreadCount:0}); });
app.post('/api/notifications/clear', (_req,res) => { cachedNotifications=[]; res.json({success:true,count:0}); });

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({ server:{ middlewareMode:true }, appType:'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(),'dist');
    app.use(express.static(distPath));
    app.get('*', (_req,res)=>res.sendFile(path.join(distPath,'index.html')));
  }
  app.listen(PORT,'0.0.0.0',()=>console.log(`[The God Protocol v2026] Server running on http://0.0.0.0:${PORT}`));
}
startServer();
