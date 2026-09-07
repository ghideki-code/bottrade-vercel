import { callOpenRouter, parseJson } from './_lib/openrouter';

type AgentName = 'TECHNICAL' | 'SMC' | 'WYCKOFF_GANN' | 'DIVERGENCE';

type AgentResult = {
  agent: AgentName;
  decision: 'LONG' | 'SHORT' | 'NEUTRO';
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
    const parsed = parseJson<Omit<AgentResult, 'agent' | 'model'>>(result.content);
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

function supervise(results: AgentResult[]) {
  const valid = results.filter(r => !r.error && r.confidence > 0);
  const score = valid.reduce((sum, r) => sum + (r.decision === 'LONG' ? r.confidence : r.decision === 'SHORT' ? -r.confidence : 0), 0);
  const average = valid.length ? Math.round(Math.abs(score) / valid.length) : 0;
  const decision = score >= 120 ? 'LONG' : score <= -120 ? 'SHORT' : 'NEUTRO';
  const agreement = valid.length ? Math.round((valid.filter(r => r.decision === decision).length / valid.length) * 100) : 0;

  return {
    decision,
    confidence: Math.min(100, average),
    agreement,
    agentsUsed: valid.length,
    status: valid.length >= 3 ? 'CONFLUENCIA_PARCIAL' : 'DADOS_INSUFICIENTES',
    executionAllowed: false,
    note: 'Esta decisão é analítica. O Risk Engine e a execução não fazem parte desta etapa.',
  };
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const symbol = String(body?.symbol || 'BTCUSDT').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const market = body?.market;
    if (!market) return new Response(JSON.stringify({ error: 'Envie o campo market com os dados objetivos da análise.' }), { status: 400, headers: { 'content-type': 'application/json' } });

    const results = await Promise.all(AGENTS.map(agent => runAgent(agent, symbol, market)));
    return new Response(JSON.stringify({
      symbol,
      timestamp: Date.now(),
      mode: 'AI_ANALYSIS_ONLY',
      agents: results,
      supervisor: supervise(results),
    }), { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Falha no orquestrador de agentes' }), { status: 500, headers: { 'content-type': 'application/json' } });
  }
}
