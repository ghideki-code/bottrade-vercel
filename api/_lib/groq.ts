type GroqMessage = { role: 'system' | 'user' | 'assistant'; content: string };

type GroqResult = { model: string; content: string };

const ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';

const AGENT_SCHEMA = {
  type: 'object',
  properties: {
    decision: { type: 'string', enum: ['LONG', 'SHORT', 'NEUTRO'] },
    confidence: { type: 'number', minimum: 0, maximum: 100 },
    thesis: { type: 'string' },
    keyLevels: { type: 'array', items: { type: 'string' } },
    invalidation: { type: 'string' },
    riskFlags: { type: 'array', items: { type: 'string' } },
  },
  required: ['decision', 'confidence', 'thesis', 'keyLevels', 'invalidation', 'riskFlags'],
  additionalProperties: false,
};

export async function callGroq(
  messages: GroqMessage[],
  options: { model?: string; temperature?: number; maxTokens?: number } = {},
): Promise<GroqResult> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY não configurada no Vercel');

  const model = options.model || process.env.GROQ_MODEL || 'openai/gpt-oss-20b';
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: options.temperature ?? 0.1,
      max_completion_tokens: options.maxTokens ?? 450,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'bottrade_agent_analysis',
          strict: true,
          schema: AGENT_SCHEMA,
        },
      },
    }),
    signal: AbortSignal.timeout(25000),
  });

  const data = await response.json() as any;
  if (!response.ok) {
    const detail = data?.error?.message || `Groq HTTP ${response.status}`;
    throw new Error(detail);
  }

  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('Groq retornou uma resposta vazia');
  }

  return { model: data.model || model, content: content.trim() };
}

export function parseJson<T>(text: string): T {
  const cleaned = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
  return JSON.parse(cleaned) as T;
}
