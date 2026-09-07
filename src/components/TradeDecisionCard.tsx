import React from 'react';
import { AlertTriangle, CheckCircle2, ShieldAlert, Target, TrendingDown, TrendingUp } from 'lucide-react';

type Setup = {
  side: 'LONG' | 'SHORT' | 'WAIT';
  score: number;
  entry: number;
  entryLow?: number;
  entryHigh?: number;
  stop: number;
  tp1: number;
  tp2: number;
  tp3: number;
  riskReward: number;
  confirmations: string[];
  invalidations: string[];
  tradeLogic?: string;
};

type Supervisor = {
  score: number;
  decision: string;
  confidence: number;
  agreement: number;
  agentsUsed: number;
  quality: string;
  trigger: string;
  executionAllowed: boolean;
};

type Props = {
  symbol: string;
  setup: Setup | null;
  supervisor: Supervisor | null;
  currentPrice?: number;
};

const money = (value: number) => value > 1000 ? value.toLocaleString('en-US', { maximumFractionDigits: 2 }) : value.toLocaleString('en-US', { maximumFractionDigits: 6 });

export function TradeDecisionCard({ symbol, setup, supervisor, currentPrice }: Props) {
  const direction = supervisor?.decision === 'LONG' || supervisor?.decision === 'SHORT' ? supervisor.decision : setup?.side;
  const approved = !!setup && !!supervisor && direction === setup.side && setup.side !== 'WAIT' && supervisor.agentsUsed >= 3 && ['A+', 'A'].includes(supervisor.quality) && supervisor.score >= 50 && supervisor.agreement >= 60 && setup.riskReward >= 1.5;
  const blockedReasons: string[] = [];
  if (!setup || setup.side === 'WAIT') blockedReasons.push('O Setup Engine não encontrou uma direção com vantagem suficiente.');
  if (!supervisor) blockedReasons.push('A análise do comitê IA ainda não foi validada.');
  if (supervisor && supervisor.agentsUsed < 3) blockedReasons.push('Menos de 3 agentes válidos.');
  if (supervisor && supervisor.quality !== 'A' && supervisor.quality !== 'A+') blockedReasons.push(`Qualidade ${supervisor.quality}, abaixo do mínimo A.`);
  if (supervisor && supervisor.score < 50) blockedReasons.push(`Score Mestre ${supervisor.score}/100, abaixo de 50.`);
  if (supervisor && supervisor.agreement < 60) blockedReasons.push(`Consenso ${supervisor.agreement}%, abaixo de 60%.`);
  if (setup && setup.riskReward < 1.5) blockedReasons.push(`R/R ${setup.riskReward.toFixed(2)}, abaixo de 1.5.`);
  if (supervisor && setup && direction !== setup.side) blockedReasons.push('A direção da IA não coincide com o Setup Engine.');

  const tone = direction === 'LONG' ? 'text-emerald-400' : direction === 'SHORT' ? 'text-rose-400' : 'text-slate-300';
  const border = approved ? 'border-emerald-500/50' : 'border-amber-500/40';

  return (
    <section className={`rounded-2xl border ${border} bg-slate-900 p-4 sm:p-6 shadow-xl`}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Decisão do sistema</div>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h2 className="text-2xl sm:text-3xl font-black">{symbol}</h2>
            <span className={`inline-flex items-center gap-1.5 rounded-full bg-slate-950 px-3 py-1 text-sm font-black ${tone}`}>
              {direction === 'LONG' ? <TrendingUp size={16}/> : direction === 'SHORT' ? <TrendingDown size={16}/> : <Target size={16}/>} {direction || 'NEUTRO'}
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-400">Sistema analítico. Nenhuma ordem real é enviada.</p>
        </div>
        <div className={`rounded-xl px-4 py-3 text-center ${approved ? 'bg-emerald-500/10 text-emerald-300' : 'bg-rose-500/10 text-rose-300'}`}>
          <div className="text-[10px] uppercase tracking-wider">Status</div>
          <div className="mt-1 text-lg font-black">{approved ? 'TRADE APROVADO' : 'TRADE BLOQUEADO'}</div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {[
          ['Entrada', setup?.entry], ['Stop Loss', setup?.stop], ['TP1', setup?.tp1], ['TP2', setup?.tp2], ['TP3', setup?.tp3], ['R/R', setup?.riskReward]
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-xl bg-slate-950 p-3">
            <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
            <div className="mt-1 font-mono text-sm sm:text-base font-bold">{typeof value === 'number' ? (label === 'R/R' ? `1:${value.toFixed(2)}` : `$${money(value)}`) : '--'}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="rounded-xl bg-slate-950 p-3"><div className="text-[10px] text-slate-500">SCORE MESTRE</div><b className="text-xl">{supervisor?.score ?? '--'}/100</b></div>
        <div className="rounded-xl bg-slate-950 p-3"><div className="text-[10px] text-slate-500">CONSENSO</div><b className="text-xl">{supervisor ? `${supervisor.agreement}%` : '--'}</b></div>
        <div className="rounded-xl bg-slate-950 p-3"><div className="text-[10px] text-slate-500">CONFIANÇA</div><b className="text-xl">{supervisor ? `${supervisor.confidence}%` : '--'}</b></div>
        <div className="rounded-xl bg-slate-950 p-3"><div className="text-[10px] text-slate-500">QUALIDADE</div><b className="text-xl">{supervisor?.quality ?? '--'}</b></div>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
          <h3 className="flex items-center gap-2 text-sm font-bold"><CheckCircle2 size={16} className="text-emerald-400"/> Por que este trade?</h3>
          <p className="mt-2 text-sm leading-6 text-slate-300">{setup?.tradeLogic || (setup?.confirmations?.length ? setup.confirmations.join('. ') + '.' : 'Aguardando confluência suficiente para explicar a operação.')}</p>
          {setup?.confirmations?.length ? <ul className="mt-3 space-y-1 text-xs text-slate-400">{setup.confirmations.slice(0, 6).map(x => <li key={x}>• {x}</li>)}</ul> : null}
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
          <h3 className="flex items-center gap-2 text-sm font-bold"><ShieldAlert size={16} className="text-amber-400"/> O que invalida?</h3>
          <p className="mt-2 text-sm leading-6 text-slate-300">{setup?.invalidations?.join('. ') || 'Sem invalidação calculada.'}</p>
          {currentPrice && setup?.entry ? <p className="mt-2 text-xs text-slate-500">Preço observado: ${money(currentPrice)}</p> : null}
        </div>
      </div>

      {!approved && (
        <div className="mt-4 rounded-xl border border-rose-900/60 bg-rose-950/20 p-4">
          <div className="flex items-center gap-2 text-sm font-bold text-rose-300"><AlertTriangle size={16}/> Motivos do bloqueio</div>
          <ul className="mt-2 space-y-1 text-xs leading-5 text-rose-200/80">{blockedReasons.length ? blockedReasons.map(reason => <li key={reason}>• {reason}</li>) : <li>• A decisão ainda não foi validada pelo conjunto completo de regras.</li>}</ul>
        </div>
      )}
    </section>
  );
}
