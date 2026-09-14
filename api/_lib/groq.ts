type GroqMessage = { role: 'system' | 'user' | 'assistant'; content: string };
type GroqResult = { model: string; content: string };

const ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';

export async function callGroq(
  messages: GroqMessage[],
  options: { model?: string; temperature?: number; maxTokens?: number } = {},
): Promise<GroqResult> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY não configurada no Vercel');

  const model = options.model || process.env.GROQ_MODEL || 'openai/gpt-oss-20b';
  const requestMessages: GroqMessage[] = [
    {
      role: 'system',
      content: 'Responda SOMENTE com um objeto JSON válido. Não use markdown, comentários, texto antes ou depois do JSON. Campos obrigatórios: decision, confidence, thesis, keyLevels, invalidation, riskFlags. decision deve ser LONG, SHORT ou NEUTRO; confidence deve ser número de 0 a 100; keyLevels e riskFlags devem ser arrays de strings.',
    },
    ...messages,
  ];

  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: requestMessages,
      temperature: options.temperature ?? 0.1,
      max_completion_tokens: options.maxTokens ?? 400,
      reasoning_effort: 'low',
      response_format: { type: 'json_object' },
    }),
    signal: AbortSignal.timeout(20000),
  });

  const data = await response.json() as any;
  if (!response.ok) {
    const detail = data?.error?.message || `Groq HTTP ${response.status}`;
    throw new Error(response.status === 429 ? `GROQ_RATE_LIMIT: ${detail}` : detail);
  }

  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('Groq retornou uma resposta vazia');
  }

  return { model: data.model || model, content: content.trim() };
}

export function parseJson<T>(text: string): T {
  const cleaned = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  return JSON.parse(cleaned) as T;
}
