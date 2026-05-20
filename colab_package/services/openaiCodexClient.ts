import { Schema, Type } from '@google/genai';
import { ProviderConfig } from './providerConfig';
import type { LLMRequestOptions } from './aiClient';

/**
 * OpenAI-compatible client for the local `openai-oauth` proxy.
 *
 * This does NOT talk directly to api.openai.com and must not read or log
 * `~/.codex/auth.json`. Authentication is handled by the local proxy which the
 * user starts separately with `npx openai-oauth`.
 */

const CODEX_BASE_URL_DEFAULT = 'http://127.0.0.1:10531/v1';
const CODEX_TIMEOUT_MS = 60_000;

const typeMap: Partial<Record<Type, string>> = {
  [Type.OBJECT]: 'object',
  [Type.ARRAY]: 'array',
  [Type.STRING]: 'string',
  [Type.INTEGER]: 'integer',
  [Type.NUMBER]: 'number',
  [Type.BOOLEAN]: 'boolean'
};

const convertSchema = (schema: Schema): any => {
  const json: Record<string, any> = { type: typeMap[schema.type] || 'string' };
  if ((schema as any).description) json.description = (schema as any).description;
  if ((schema as any).enum) json.enum = (schema as any).enum;

  if ((schema as any).properties) {
    json.properties = {};
    for (const key of Object.keys((schema as any).properties)) {
      json.properties[key] = convertSchema((schema as any).properties[key] as Schema);
    }
  }

  if ((schema as any).required) json.required = (schema as any).required;
  if ((schema as any).items) json.items = convertSchema((schema as any).items as Schema);
  return json;
};

const normalizeContent = (content: any): string => {
  if (!content) return '';
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map((part) => typeof part === 'string' ? part : (part?.text || part?.content || '')).join('');
  }
  if (typeof content === 'object') return content.text || content.content || '';
  return '';
};

const resolveCodexBaseUrl = (provider: ProviderConfig): string => {
  const configured = (provider.baseUrl || '').trim();
  if (configured) return configured.replace(/\/$/, '');
  return CODEX_BASE_URL_DEFAULT;
};

export const isOpenAICodexProvider = (provider?: ProviderConfig): boolean =>
  provider?.id === 'openai_codex' || provider?.name === 'openai_codex';

export const callOpenAICodexOAuth = async (
  provider: ProviderConfig,
  prompt: string,
  options: LLMRequestOptions
): Promise<string> => {
  const baseUrl = resolveCodexBaseUrl(provider);
  const model = provider.modelText || 'gpt-5.5';
  const started = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CODEX_TIMEOUT_MS);

  const schema = options.schema ? convertSchema(options.schema) : undefined;
  const schemaName = options.schemaName || 'response';
  const userPrompt = schema
    ? `${prompt}\n\nReturn ONLY valid JSON matching this schema:\n${JSON.stringify(schema)}`
    : prompt;

  const body: Record<string, any> = {
    model,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxOutputTokens ?? 1024,
    messages: [
      ...(options.systemPrompt ? [{ role: 'system', content: options.systemPrompt }] : []),
      { role: 'user', content: userPrompt }
    ]
  };

  if (schema) {
    // The openai-oauth proxy is OpenAI-compatible, but different proxy versions
    // may not expose full json_schema support. Keep the schema in the prompt and
    // request JSON object mode for broader compatibility.
    body.response_format = { type: 'json_object' };
    body.metadata = { schemaName };
  }

  console.info(`[openai-codex] text start model=${model} baseUrl=${baseUrl}`);
  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`OpenAI Codex OAuth proxy error ${response.status}: ${errorText || response.statusText}`);
    }

    const data = await response.json();
    const text = normalizeContent(data.choices?.[0]?.message?.content).trim();
    if (!text) throw new Error('OpenAI Codex OAuth proxy returned empty content');
    console.info(`[openai-codex] text ok model=${model} durationMs=${Date.now() - started}`);
    return text;
  } catch (error: any) {
    const reason = error?.name === 'AbortError' ? `timeout after ${CODEX_TIMEOUT_MS}ms` : (error?.message || String(error));
    console.warn(`[openai-codex] text failed model=${model} durationMs=${Date.now() - started}: ${reason}`);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};
