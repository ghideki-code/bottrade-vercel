import { callGroq, parseJson } from './_lib/groq.js';

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
  {
    name: 'TECHNICAL',
    mission: `Você é o especialista em análise técnica e Triple Screen. Analise primeiro o contexto maior e depois desça para a execução. Avalie tendência, estrutura de máximas/mínimas, EMA 9/21/50/200, RSI, MACD quando disponível, ATR, volume, momentum, volatilidade, suportes, resistências, rompimentos e retestes. Procure alinhamento entre 4H, 1H e 15M. Diferencie tendência de ruído. Não use um indicador isolado como gatilho. A entrada precisa estar coerente com estrutura, risco e localização do preço.`,
  },
  {
    name: 'SMC',
    mission: `Você é o especialista em Smart Money Concepts. Reconstrua a estrutura externa e interna quando os dados permitirem. Avalie BOS, CHoCH, swing highs/lows, buy-side liquidity (BSL), sell-side liquidity (SSL), liquidity sweep, equal highs/lows, displacement, inducement, mitigation, Fair Value Gaps/imbalances, Order Blocks e premium/discount. Procure a sequência liquidez -> deslocamento -> mudança/confirmação de estrutura -> retorno à zona -> continuação/reversão. Um FVG ou Order Block sozinho não é confirmação. Identifique se a zona ainda está ativa ou já foi mitigada.`,
  },
  {
    name: 'WYCKOFF_GANN',
    mission: `Você é o especialista em Wyckoff e Gann. Em Wyckoff, avalie contexto de acumulação, distribuição, markup, markdown, spring, test, SOS, LPS, upthrust/UTAD, SOW, esforço versus resultado, absorção e clímax. Em Gann, só use relações de preço, tempo, ângulos ou ciclos se houver dados objetivos suficientes para sustentá-las. Nunca invente um ângulo, ciclo ou nível. Use Gann como confluência, nunca como gatilho isolado. Dê mais peso ao comportamento real de preço/volume e à estrutura.`,
  },
  {
    name: 'DIVERGENCE',
    mission: `Você é o especialista em divergências e momentum. Procure divergência regular bullish/bearish e divergência oculta bullish/bearish entre preço e RSI, MACD, momentum ou outras séries realmente fornecidas. Compare pivôs equivalentes, não pontos aleatórios. Verifique se a divergência está confirmada ou apenas potencial. Considere timeframe e contexto de tendência. Uma divergência isolada não autoriza trade. Avalie também divergência de volume e, quando houver, Open Interest/funding.`,
  },
];

function promptFor(agent: typeof AGENTS[number], symbol: string, market: unknown) {
  return `Você é um dos quatro analistas independentes do BotTrade.

ATIVO: ${symbol}

MISSÃO DO AGENTE:
${agent.mission}

DADOS OBJETIVOS RECEBIDOS:
${JSON.stringify(market)}

PROTOCOLO DE ANÁLISE:
1. Use exclusivamente os dados recebidos.
2. Primeiro identifique o contexto e o timeframe; depois avalie a possível oportunidade.
3. Procure CONFLUÊNCIA, não uma justificativa única.
4. Separe fatos observáveis de interpretação.
5. Não invente candles, preços, indicadores, notícias, volume, liquidez, ciclos, níveis ou padrões que não estejam sustentados pelos dados.
6. Se um dado necessário não existir, trate-o como desconhecido.
7. Se a evidência for insuficiente ou contraditória, escolha NEUTRO e confidence 0-49 conforme a gravidade.
8. LONG ou SHORT só devem ser escolhidos quando existir uma tese direcional objetiva.
9. Explique a tese de forma curta, técnica e auditável.
10. keyLevels deve conter somente níveis realmente observáveis ou derivados diretamente dos dados fornecidos.
11. invalidation deve dizer qual condição de preço/estrutura destrói a tese.
12. riskFlags deve listar riscos concretos, não frases genéricas.
13. Não execute ordens, não forneça credenciais e não determine alavancagem.
14. Você não é o Risk Engine. Não aprove execução sozinho.
15. Sua função é fornecer uma opinião independente ao Supervisor.

REGRA CRÍTICA:
Nunca aumente confidence para parecer convincente. Se não houver evidência, reduza a confiança.

RETORNE SOMENTE O JSON DO SCHEMA. SEM MARKDOWN. SEM EXPLICAÇÕES FORA DO JSON.`;
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
    const model = process.env[`GROQ_MODEL_${agent.name}`] || process.env.GROQ_MODEL || 'openai/gpt-oss-20b';
    const result = await callGroq([
      { role: 'system', content: 'Você é um analista quantitativo independente, conservador e auditável. Nunca invente evidências.' },
      { role: 'user', content: promptFor(agent, symbol, market) },
    ], { model, temperature: 0.1, maxTokens: 450 });
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

async function runAgentsWithLimit(symbol: string, market: unknown): Promise<AgentResult[]> {
  const results: AgentResult[] = [];
  for (let i = 0; i < AGENTS.length; i += 2) {
    const batch = AGENTS.slice(i, i + 2);
    const batchResults = await Promise.all(batch.map(agent => runAgent(agent, symbol, market)));
    results.push(...batchResults);
  }
  return results;
}

function numeric(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function directional(value: unknown): number {
  const text = String(value || '').toUpperCase();
  if (text.includes('BULL') || text.includes('LONG') || text.includes('BUY') || text.includes('ALTA')) return 1;
  if (text.includes('BEAR') || text.includes('SHORT') || text.includes('SELL') || text.includes('BAIXA')) return -1;
  return 0;
}

function masterScore(results: AgentResult[], market: any) {
  const valid = results.filter(r => !r.error && r.confidence > 0 && (r.decision === 'LONG' || r.decision === 'SHORT'));
  const agentRaw = valid.reduce((sum, r) => sum + (r.decision === 'LONG' ? r.confidence : -r.confidence), 0);
  const directionalAgentScore = valid.length ? agentRaw / valid.length : 0;

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

  const directionalRaw = directionalAgentScore * 0.65 + setupContribution + pillarBias + objectiveBonus;
  const score = Math.round(Math.max(0, Math.min(100, Math.abs(directionalRaw))));
  const decision: Decision = valid.length >= 3 && directionalRaw >= 35 ? 'LONG' : valid.length >= 3 && directionalRaw <= -35 ? 'SHORT' : 'NEUTRO';
  const aligned = valid.filter(r => r.decision === decision).length;
  const agreement = valid.length >= 3 && decision !== 'NEUTRO' ? Math.round((aligned / valid.length) * 100) : 0;
  const quality = valid.length < 3 ? 'DADOS_INSUFICIENTES' : score >= 70 && agreement >= 75 ? 'A+' : score >= 50 && agreement >= 60 ? 'A' : score >= 35 && agreement >= 50 ? 'B' : 'C';
  const trigger = decision === 'NEUTRO' ? 'AGUARDAR CONFLUÊNCIA' : agreement >= 75 && score >= 60 ? 'AGUARDAR GATILHO' : 'AGUARDAR CONFIRMAÇÃO';
  const confidence = valid.length >= 3 ? Math.min(100, Math.round(score * 0.8 + agreement * 0.2)) : 0;

  return {
    score,
    decision,
    confidence,
    agreement,
    quality,
    trigger,
    components: { agentScore: Math.round(directionalAgentScore), setupContribution: Math.round(setupContribution), pillarBias: Math.round(pillarBias), objectiveBonus: Math.round(objectiveBonus) },
  };
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const symbol = String(body?.symbol || 'BTCUSDT').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const market = body?.market;
    if (!market) return new Response(JSON.stringify({ error: 'Envie o campo market com os dados objetivos da análise.' }), { status: 400, headers: { 'content-type': 'application/json' } });

    const results = await runAgentsWithLimit(symbol, market);
    const master = masterScore(results, market);
    return new Response(JSON.stringify({
      symbol,
      timestamp: Date.now(),
      mode: 'AI_ANALYSIS_ONLY',
      provider: 'GROQ',
      agents: results,
      supervisor: {
        ...master,
        agentsUsed: results.filter(r => !r.error && r.confidence > 0).length,
        status: master.quality === 'DADOS_INSUFICIENTES' ? 'DADOS_INSUFICIENTES' : 'CONFLUENCIA_MESTRE',
        executionAllowed: false,
        note: 'Os 4 especialistas são independentes. O Supervisor exige 3+ agentes válidos, qualidade A/A+, consenso >=60% e validação independente do Risk Engine. Execução real permanece bloqueada.',
      },
    }), { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Falha no orquestrador de agentes' }), { status: 500, headers: { 'content-type': 'application/json' } });
  }
}
