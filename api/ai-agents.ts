import { callOpenRouter, parseJson } from './_lib/openrouter';

type AgentName = 'TECHNICAL' | 'SMC' | 'WYCKOFF_GANN' | 'DIVERGENCE';
type Decision = 'LONG' | 'SHORT' | 'NEUTRO';

type AgentResult = {
  agent: AgentName;
  decision: Decision;
  confidence: number;
  thesis: string;
  keyLevels: string[];
  invalidation: string;
  riskFlags: string[];
  model?: string;
  error?: string;
};

const AGENTS: Array<{ name: AgentName; mission: string }> = [
  { name: 'TECHNICAL', mission: 'Avalie tendência, EMAs, RSI, ATR, estrutura, volume e contexto multi-timeframe.' },
  { name: 'SMC', mission: 'Avalie estrutura SMC: BOS, CHoCH, liquidez, sweep, FVG, order blocks e deslocamento.' },
  { name: 'WYCKOFF_GANN', mission: 'Procure fases Wyckoff, causa/efeito, spring/upthrust e confluências de ciclos/níveis Gann. Não invente níveis que não estejam nos dados.' },
  { name: 'DIVERGENCE', mission: 'Avalie divergências e confirmações entre preço, RSI, volume e momentum. Diferencie divergência regular de hidden quando os dados permitirem.' },
];

function promptFor(agent: typeof AGENTS[number], symbol: string, market: unknown) {
  return `Você é o agente ${agent.name} do BotTrade. Sua missão: ${agent.mission}

Ativo: ${symbol}
Dados objetivos disponíveis:
${JSON.stringify(market)}

Regras:
- Não invente dados, preços, notícias ou indicadores ausentes.
- Não execute ordens e não forneça instruções de alavancagem.
- Trabalhe apenas como analista de mercado.
- Retorne SOMENTE JSON válido.
- confidence deve ser número de 0 a 100.

Formato:
{"decision":"LONG|SHORT|NEUTRO","confidence":0,"thesis":"","keyLevels":[""],"invalidation":"","riskFlags":[""]}`;
}

function normalizeAgent(parsed: Omit<AgentResult, 'agent' | 'model'>): Omit<AgentResult, 'agent' | 'model'> {
  const decision: Decision = parsed.decision === 'LONG' || parsed.decision === 'SHORT' ? parsed.decision : 'NEUTRO';
  const confidence = Math.max(0, Math.min(100, Number(parsed.confidence) || 0));
  return {
    ...parsed,
    decision,
    confidence,
    thesis: String(parsed.thesis || ''),
    keyLevels: Array.isArray(parsed.keyLevels) ? parsed.keyLevels.map(String).slice(0, 8) : [],
    invalidation: String(parsed.invalidation || ''),
    riskFlags: Array.isArray(parsed.riskFlags) ? parsed.riskFlags.map(String).slice(0, 8) : [],
  };
}

async function runAgent(agent: typeof AGENTS[number], symbol: string, market: unknown): Promise<AgentResult> {
  try {
    const result = await callOpenRouter([
      { role: 'system', content: 'Você é um analista quantitativo disciplinado. Seja objetivo e conservador.' },
      { role: 'user', content: promptFor(agent, symbol, market) },
    ], {
      model: process.env[`OPENROUTER_MODEL_${agent.name}`] || process.env.OPENROUTER_MODEL,
      temperature: 0.1,
      maxTokens: 650,
    });
    const parsed = normalizeAgent(parseJson<Omit<AgentResult, 'agent' | 'model'>>(result.content));
    return { agent: agent.name, ...parsed, model: result.model };
  } catch (error) {
    return {
      agent: agent.name,
      decision: 'NEUTRO',
      confidence: 0,
      thesis: 'Agente indisponível nesta rodada.',
      keyLevels: [],
      invalidation: 'Sem validação.',
      riskFlags: [error instanceof Error ? error.message : 'Erro desconhecido'],
      error: 'AGENT_UNAVAILABLE',
    };
  }
}

function numeric(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function directional(value: unknown): number {
  const text = String(value || '').toUpperCase();
  if (text.includes('BULL') || text.includes('LONG') || text.includes('BUY')) return 1;
  if (text.includes('BEAR') || text.includes('SHORT') || text.includes('SELL')) return -1;
  return 0;
}

function masterScore(results: AgentResult[], market: any) {
  const valid = results.filter(r => !r.error && r.confidence > 0);
  const agentRaw = valid.reduce((sum, r) => sum + (r.decision === 'LONG' ? r.confidence : r.decision === 'SHORT' ? -r.confidence : 0), 0);
  const agentScore = valid.length ? Math.round(agentRaw / valid.length) : 0;

  const setup = market?.setup;
  const setupSide = setup?.side as Decision | undefined;
  const setupScore = numeric(setup?.score) ?? 0;
  const setupContribution = setupSide === 'LONG' ? Math.min(20, setupScore / 5) : setupSide === 'SHORT' ? -Math.min(20, setupScore / 5) : 0;

  const pillars = market?.current?.fourPillars;
  const pillarValues = pillars ? [pillars.classicTA?.score, pillars.smc?.score, pillars.wyckoff?.score, pillars.sentiment?.score].map(numeric).filter((x): x is number => x !== null) : [];
  const pillarAverage = pillarValues.length ? pillarValues.reduce((a, b) => a + b, 0) / pillarValues.length : 50;
  const pillarBias = Math.max(-15, Math.min(15, pillarAverage - 50));

  const technicalBias = directional(market?.technical?.confluence);
  const smcFrames = market?.smc?.timeframes ? Object.values(market.smc.timeframes) as any[] : [];
  const smcBiasValues = smcFrames.map(x => directional(x?.bias)).filter(Boolean);
  const smcBias = smcBiasValues.length ? smcBiasValues.reduce((a, b) => a + b, 0) / smcBiasValues.length : 0;

  const objectiveBonus = Math.max(-10, Math.min(10, technicalBias * 5 + smcBias * 5));
  const rawMaster = agentScore * 0.65 + setupContribution + pillarBias + objectiveBonus;
  const score = Math.round(Math.max(-100, Math.min(100, rawMaster)));
  const decision: Decision = score >= 35 ? 'LONG' : score <= -35 ? 'SHORT' : 'NEUTRO';
  const aligned = valid.filter(r => r.decision === decision).length;
  const agreement = valid.length ? Math.round((aligned / valid.length) * 100) : 0;

  const quality = valid.length < 3 ? 'DADOS_INSUFICIENTES' : Math.abs(score) >= 70 && agreement >= 75 ? 'A+' : Math.abs(score) >= 50 && agreement >= 60 ? 'A' : Math.abs(score) >= 35 && agreement >= 50 ? 'B' : 'C';
  const trigger = decision === 'NEUTRO' ? 'AGUARDAR CONFLUÊNCIA' : agreement >= 75 && Math.abs(score) >= 60 ? 'AGUARDAR GATILHO' : 'AGUARDAR CONFIRMAÇÃO';

  return {
    score,
    decision,
    confidence: Math.min(100, Math.round(Math.abs(score) * 0.8 + agreement * 0.2)),
    agreement,
    quality,
    trigger,
    components: { agentScore, setupContribution: Math.round(setupContribution), pillarBias: Math.round(pillarBias), objectiveBonus: Math.round(objectiveBonus) },
  };
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const symbol = String(body?.symbol || 'BTCUSDT').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const market = body?.market;
    if (!market) return new Response(JSON.stringify({ error: 'Envie o campo market com os dados objetivos da análise.' }), { status: 400, headers: { 'content-type': 'application/json' } });

    const results = await Promise.all(AGENTS.map(agent => runAgent(agent, symbol, market)));
    const master = masterScore(results, market);
    return new Response(JSON.stringify({
      symbol,
      timestamp: Date.now(),
      mode: 'AI_ANALYSIS_ONLY',
      agents: results,
      supervisor: {
        ...master,
        agentsUsed: results.filter(r => !r.error && r.confidence > 0).length,
        status: master.quality === 'DADOS_INSUFICIENTES' ? 'DADOS_INSUFICIENTES' : 'CONFLUENCIA_MESTRE',
        executionAllowed: false,
        note: 'Score Mestre é analítico. Risk Engine e execução continuam separados e bloqueados.',
      },
    }), { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Falha no orquestrador de agentes' }), { status: 500, headers: { 'content-type': 'application/json' } });
  }
}
