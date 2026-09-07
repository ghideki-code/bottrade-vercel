type OpenRouterMessage = { role: 'system' | 'user' | 'assistant'; content: string };

type OpenRouterResult = {
  model: string;
  content: string;
};

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

export async function callOpenRouter(messages: OpenRouterMessage[], options: { model?: string; temperature?: number; maxTokens?: number } = {}): Promise<OpenRouterResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY não configurada');

  const model = options.model || process.env.OPENROUTER_MODEL || 'openai/gpt-chat-latest';
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...(process.env.APP_URL ? { 'HTTP-Referer': process.env.APP_URL } : {}),
      'X-Title': 'BotTrade Vercel',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: options.temperature ?? 0.15,
      max_tokens: options.maxTokens ?? 700,
    }),
    signal: AbortSignal.timeout(25000),
  });

  const data = await response.json() as any;
  if (!response.ok) {
    const detail = data?.error?.message || `OpenRouter HTTP ${response.status}`;
    throw new Error(detail);
  }

  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) throw new Error('OpenRouter retornou uma resposta vazia');
  return { model: data.model || model, content: content.trim() };
}

export function parseJson<T>(text: string): T {
  const cleaned = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
  return JSON.parse(cleaned) as T;
}
