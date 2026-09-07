import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, BrainCircuit, CandlestickChart, Gauge, RefreshCw, ShieldCheck, Target, TrendingUp } from 'lucide-react';
import { TradeSignal } from './types';
import { Header } from './components/Header';
import { MetricCards } from './components/MetricCards';
import { BacktestPanel } from './components/BacktestPanel';
import { AIAgentsPanel, Supervisor } from './components/AIAgentsPanel';
import { RiskEnginePanel } from './components/RiskEnginePanel';
import { PaperTradingPanel } from './components/PaperTradingPanel';
import { TradeDecisionCard } from './components/TradeDecisionCard';

type Technical = { symbol: string; confluence: string; timeframes: Record<string, { close: number; ema9: number; ema21: number; ema50: number; ema200: number; rsi: number; atr: number; structure: { trend: string; bos: string; swingHigh: number; swingLow: number }; divergence: string; volumeRatio: number }>; source: string };
type SMC = { symbol: string; timeframes: Record<string, { bias: string; structure: string; sweep: string; sweepLevel: number; premiumDiscount: string; score: number; equilibrium: number; fvg: { type: string; low: number; high: number; filled: boolean } | null; orderBlock: { type: string; low: number; high: number; mitigated: boolean } | null; reasons: string[] }>; source: string };
type Setup = { side: 'LONG' | 'SHORT' | 'WAIT'; score: number; entry: number; entryLow?: number; entryHigh?: number; stop: number; tp1: number; tp2: number; tp3: number; riskReward: number; timeframe: string; confirmations: string[]; invalidations: string[]; tradeLogic?: string };
type SetupRow = { symbol: string; setup?: Setup; error?: string };

type Tab = 'scanner' | 'analysis' | 'backtest';

const fmt = (value: number, digits = 2) => Number.isFinite(value) ? value.toLocaleString('en-US', { maximumFractionDigits: digits }) : '--';

export default function App() {
  const [signals, setSignals] = useState<TradeSignal[]>([]);
  const [selected, setSelected] = useState('BTC/USDT');
  const [loading, setLoading] = useState(false);
  const [last, setLast] = useState('');
  const [tab, setTab] = useState<Tab>('scanner');
  const [simpleMode, setSimpleMode] = useState(true);
  const [autoScan, setAutoScan] = useState(true);
  const [interval, setIntervalSec] = useState(60);
  const [technical, setTechnical] = useState<Technical | null>(null);
  const [smc, setSmc] = useState<SMC | null>(null);
  const [setup, setSetup] = useState<Setup | null>(null);
  const [setupRows, setSetupRows] = useState<SetupRow[]>([]);
  const [setupLoading, setSetupLoading] = useState(false);
  const [supervisor, setSupervisor] = useState<Supervisor | null>(null);

  const scan = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/market', { cache: 'no-store' });
      if (!response.ok) throw new Error(`Market API ${response.status}`);
      const data = await response.json() as TradeSignal[];
      setSignals(Array.isArray(data) ? data : []);
      setLast(new Date().toLocaleString('pt-BR'));
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAnalysis = useCallback(async (symbol: string) => {
    const clean = symbol.toUpperCase().replace(/[^A-Z0-9]/g, '');
    setTechnical(null);
    setSmc(null);
    setSetup(null);
    setSupervisor(null);
    try {
      const [technicalResponse, smcResponse, setupResponse] = await Promise.all([
        fetch(`/api/technical?symbol=${encodeURIComponent(clean)}`),
        fetch(`/api/smc?symbol=${encodeURIComponent(clean)}`),
        fetch(`/api/setup?symbol=${encodeURIComponent(clean)}`),
      ]);
      if (technicalResponse.ok) setTechnical(await technicalResponse.json() as Technical);
      if (smcResponse.ok) setSmc(await smcResponse.json() as SMC);
      if (setupResponse.ok) {
        const data = await setupResponse.json() as { setup?: Setup };
        setSetup(data.setup || null);
      }
    } catch (error) {
      console.error(error);
    }
  }, []);

  const rankSetups = useCallback(async (list: TradeSignal[]) => {
    const candidates = list.filter(x => x.passedFilter).sort((a, b) => b.confidence - a.confidence).slice(0, 20);
    if (!candidates.length) {
      setSetupRows([]);
      return;
    }
    setSetupLoading(true);
    try {
      const symbols = candidates.map(x => x.symbol.replace('/', '')).join(',');
      const response = await fetch(`/api/setup-batch?symbols=${encodeURIComponent(symbols)}`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Setup API ${response.status}`);
      const data = await response.json() as { results?: SetupRow[] };
      setSetupRows((data.results || []).filter(x => x.setup).sort((a, b) => (b.setup?.score ?? 0) - (a.setup?.score ?? 0)));
    } catch (error) {
      console.error(error);
    } finally {
      setSetupLoading(false);
    }
  }, []);

  useEffect(() => { scan(); }, [scan]);
  useEffect(() => {
    if (!autoScan) return;
    const timer = window.setInterval(scan, interval * 1000);
    return () => window.clearInterval(timer);
  }, [autoScan, interval, scan]);
  useEffect(() => { loadAnalysis(selected); }, [selected, loadAnalysis]);
  useEffect(() => { if (signals.length) rankSetups(signals); }, [signals, rankSetups]);

  const current = signals.find(s => s.symbol === selected) || signals[0];
  const qualified = useMemo(() => signals.filter(s => s.passedFilter), [signals]);
  const pillars = current ? [
    { name: 'Técnico', score: current.fourPillars.classicTA.score, Icon: TrendingUp },
    { name: 'SMC', score: current.fourPillars.smc.score, Icon: Activity },
    { name: 'Wyckoff', score: current.fourPillars.wyckoff.score, Icon: Gauge },
    { name: 'Sentimento', score: current.fourPillars.sentiment.score, Icon: BrainCircuit },
  ] : [];
  const aiMarket = current ? { current, signal: current, technical, smc, setup } : null;
  const gateDirection = supervisor?.decision === 'LONG' || supervisor?.decision === 'SHORT' ? supervisor.decision : null;
  const gateAllowed = !!supervisor && !!setup && gateDirection === setup.side && setup.side !== 'WAIT' && supervisor.agentsUsed >= 3 && ['A+', 'A'].includes(supervisor.quality) && supervisor.score >= 50 && supervisor.agreement >= 60 && setup.riskReward >= 1.5;
  const paperQuantity = setup && setup.entry > 0 && setup.stop > 0 ? ((1000 * 0.005) / Math.abs(setup.entry - setup.stop)) : 0;
  const gatedQuantity = gateAllowed ? paperQuantity : 0;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Header autoScan={autoScan} onToggleAutoScan={() => setAutoScan(v => !v)} scanInterval={interval} onChangeInterval={setIntervalSec} isScanning={loading} onManualScan={scan} unreadNotifications={0} onOpenNotifications={() => {}} onOpenExport={() => {}} soundEnabled={false} onToggleSound={() => {}} lastUpdated={last} dataSource="Binance Futures • análise multi-timeframe" />
      <main className="mx-auto max-w-[1500px] space-y-4 p-3 sm:p-5 lg:p-6">
        <MetricCards signals={signals} backtest={null} onFilterQualified={() => setTab('scanner')} />

        <div className="sticky top-0 z-20 rounded-xl border border-slate-800 bg-slate-950/95 p-2 backdrop-blur">
          <div className="flex flex-wrap items-center gap-2">
            {([['scanner', 'Scanner'], ['analysis', 'Sinais & Análise'], ['backtest', 'Backtest']] as [Tab, string][]).map(([key, label]) => (
              <button key={key} onClick={() => setTab(key)} className={`rounded-lg px-3 py-2 text-xs font-bold ${tab === key ? 'bg-amber-400 text-slate-950' : 'text-slate-400 hover:bg-slate-800'}`}>{label}</button>
            ))}
            <button onClick={() => setSimpleMode(v => !v)} className="ml-auto rounded-lg border border-slate-700 px-3 py-2 text-xs font-bold text-slate-300">{simpleMode ? 'Modo profissional' : 'Modo simples'}</button>
            <span className="text-[11px] text-slate-500">{qualified.length} qualificados</span>
          </div>
        </div>

        {tab === 'scanner' && (
          <div className="space-y-4">
            <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
              <div className="flex items-center justify-between p-4"><div><h2 className="flex items-center gap-2 font-bold"><CandlestickChart size={17}/>Scanner Top 100</h2><p className="mt-1 text-[11px] text-slate-500">Clique em um ativo para abrir o cockpit completo.</p></div><button onClick={scan} disabled={loading} className="rounded-lg bg-slate-800 p-2 disabled:opacity-50"><RefreshCw size={15} className={loading ? 'animate-spin' : ''}/></button></div>
              <div className="overflow-x-auto"><table className="w-full text-xs"><thead className="bg-slate-950 text-slate-500"><tr><th className="p-3">#</th><th className="p-3 text-left">Ativo</th><th className="p-3">Preço</th><th className="p-3">24h</th><th className="p-3">Conf.</th><th className="p-3">Decisão</th><th className="p-3">Squeeze</th></tr></thead><tbody>{signals.map(signal => <tr key={signal.id} onClick={() => { setSelected(signal.symbol); setTab('analysis'); }} className="cursor-pointer border-t border-slate-800 hover:bg-slate-800"><td className="p-3 text-center">{signal.marketCapRank}</td><td className="p-3 font-semibold">{signal.symbol}</td><td className="p-3 text-center font-mono">${fmt(signal.currentPrice, signal.currentPrice < 1 ? 6 : 2)}</td><td className={`p-3 text-center ${signal.change24h >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{signal.change24h.toFixed(2)}%</td><td className="p-3 text-center text-amber-400">{signal.confidence}%</td><td className="p-3 text-center font-bold">{signal.decision}</td><td className="p-3 text-center text-slate-400">{signal.squeezeBreakout?.stateLabel || '--'}</td></tr>)}</tbody></table></div>
            </section>

            <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
              <div className="flex items-center justify-between p-4"><div><h2 className="flex items-center gap-2 font-bold"><Target size={17}/>Ranking de setups</h2><p className="mt-1 text-[11px] text-slate-500">Somente candidatos do scanner. Os valores vêm do Setup Engine.</p></div><span className="text-xs text-slate-500">{setupLoading ? 'calculando...' : `${setupRows.length} setups`}</span></div>
              <div className="overflow-x-auto"><table className="w-full text-xs"><thead className="bg-slate-950 text-slate-500"><tr><th className="p-3">#</th><th className="p-3 text-left">Ativo</th><th className="p-3">Tipo</th><th className="p-3">Score</th><th className="p-3">Entrada</th><th className="p-3">SL</th><th className="p-3">TP1</th><th className="p-3">TP2</th><th className="p-3">TP3</th><th className="p-3">R/R</th></tr></thead><tbody>{setupRows.map((row, i) => { const s = row.setup!; return <tr key={row.symbol} onClick={() => { setSelected(row.symbol); setTab('analysis'); }} className="cursor-pointer border-t border-slate-800 hover:bg-slate-800"><td className="p-3 text-center">{i + 1}</td><td className="p-3 font-semibold">{row.symbol}</td><td className={`p-3 text-center font-black ${s.side === 'LONG' ? 'text-emerald-400' : s.side === 'SHORT' ? 'text-rose-400' : 'text-slate-500'}`}>{s.side}</td><td className="p-3 text-center text-amber-400">{s.score}</td><td className="p-3 text-center font-mono">{fmt(s.entry, 4)}</td><td className="p-3 text-center font-mono">{fmt(s.stop, 4)}</td><td className="p-3 text-center font-mono">{fmt(s.tp1, 4)}</td><td className="p-3 text-center font-mono">{fmt(s.tp2, 4)}</td><td className="p-3 text-center font-mono">{fmt(s.tp3, 4)}</td><td className="p-3 text-center">{s.riskReward ? `1:${s.riskReward.toFixed(2)}` : '--'}</td></tr>; })}</tbody></table></div>
            </section>
          </div>
        )}

        {tab === 'analysis' && current && (
          <section className="space-y-4">
            <TradeDecisionCard symbol={current.symbol} setup={setup} supervisor={supervisor} currentPrice={current.currentPrice} />
            {aiMarket && <AIAgentsPanel symbol={current.symbol} market={aiMarket} onResult={setSupervisor} />}

            {setup && <div className="grid gap-4 lg:grid-cols-2">
              <RiskEnginePanel symbol={current.symbol} side={setup.side} entry={setup.entry} stop={setup.stop} tp1={setup.tp1} tp2={setup.tp2} tp3={setup.tp3} score={supervisor?.score ?? 0} quality={supervisor?.quality ?? 'DADOS_INSUFICIENTES'} />
              <PaperTradingPanel symbol={current.symbol} side={setup.side} entry={setup.entry} stop={setup.stop} tp1={setup.tp1} tp2={setup.tp2} tp3={setup.tp3} quantity={gatedQuantity} allowed={gateAllowed} />
            </div>}

            {!simpleMode && <>
              <section className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><div className="flex items-center justify-between"><h3 className="font-bold">Triple Screen • Motor Técnico</h3><span className="text-xs text-emerald-400">{technical?.confluence || 'aguardando'}</span></div><div className="mt-4 grid grid-cols-2 gap-2 xl:grid-cols-4">{technical ? Object.entries(technical.timeframes).map(([tf, x]) => <div key={tf} className="rounded-xl bg-slate-950 p-3"><div className="text-xs text-slate-500">{tf}</div><div className="mt-1 font-bold">RSI {x.rsi.toFixed(1)}</div><div className="mt-1 text-[10px] text-slate-400">{x.structure.trend} • {x.structure.bos}</div><div className="mt-1 text-[10px] text-slate-400">Div: {x.divergence}</div><div className="mt-1 text-[10px] text-slate-500">Vol: {x.volumeRatio.toFixed(2)}x</div></div>) : <div className="col-span-full text-sm text-slate-500">Carregando dados técnicos...</div>}</div></div>
                <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><div className="flex items-center justify-between"><h3 className="flex items-center gap-2 font-bold"><Activity size={16}/> SMC</h3><span className="text-xs text-amber-400">15m • 1h • 4h</span></div><div className="mt-4 grid gap-2 md:grid-cols-3">{smc ? Object.entries(smc.timeframes).map(([tf, x]) => <div key={tf} className="rounded-xl bg-slate-950 p-3"><div className="flex justify-between"><span className="text-xs text-slate-500">{tf}</span><b className={x.bias === 'BULLISH' ? 'text-emerald-400' : x.bias === 'BEARISH' ? 'text-rose-400' : 'text-slate-300'}>{x.bias}</b></div><div className="mt-2 text-xs">Estrutura: <b>{x.structure}</b></div><div className="mt-1 text-xs">Liquidez: <b>{x.sweep}</b></div><div className="mt-1 text-xs">Zona: <b>{x.premiumDiscount}</b></div><div className="mt-1 text-xs">FVG: <b>{x.fvg ? `${x.fvg.type} ${x.fvg.filled ? 'mitigado' : 'ativo'}` : 'nenhum'}</b></div><div className="mt-1 text-xs">OB: <b>{x.orderBlock ? `${x.orderBlock.type} ${x.orderBlock.mitigated ? 'mitigado' : 'ativo'}` : 'nenhum'}</b></div></div>) : <div className="text-sm text-slate-500">Carregando SMC...</div>}</div></div>
              </section>

              <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5"><h3 className="font-bold">4 Pilares objetivos</h3><div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">{pillars.map(({ name, score, Icon }) => <div key={name} className="rounded-xl bg-slate-950 p-4"><Icon size={16}/><div className="mt-2 text-xs text-slate-500">{name}</div><b className="text-2xl">{score}%</b></div>)}</div></section>
            </>}
          </section>
        )}

        {tab === 'backtest' && <BacktestPanel symbol={selected} />}
        {!current && <section className="rounded-2xl border border-slate-800 bg-slate-900 p-10 text-center text-sm text-slate-500">Aguardando dados de mercado...</section>}

        <footer className="flex flex-col gap-2 rounded-xl border border-slate-800 bg-slate-900 p-4 text-[11px] text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-center gap-2"><ShieldCheck size={14}/> Analysis + Risk + Paper Trading separados. Execução real bloqueada.</span>
          <span>Atualização: {last || '--'}</span>
        </footer>
      </main>
    </div>
  );
}
