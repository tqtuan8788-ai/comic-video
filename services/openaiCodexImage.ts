import { ProviderConfig } from './providerConfig';

export interface CodexImageOptions {
  prompt: string;
  provider: ProviderConfig;
  size?: string;
  outputFormat?: 'png' | 'jpeg' | 'webp';
}

const CODEX_IMAGE_TIMEOUT_MS = 180_000;

const readEnv = (key: string): string => {
  const meta = (import.meta as any)?.env?.[key];
  if (meta !== undefined && meta !== 'undefined' && meta !== 'null') return meta;
  if (typeof process !== 'undefined' && process.env?.[key]) {
    const value = process.env[key] as string;
    return value === 'undefined' || value === 'null' ? '' : value;
  }
  return '';
};

export const isOpenAICodexImageProvider = (provider?: ProviderConfig): boolean =>
  provider?.id === 'openai_codex_image' || provider?.name === 'openai_codex_image';

export const generateOpenAICodexImage = async ({
  prompt,
  provider,
  size = '1024x1792',
  outputFormat = 'png'
}: CodexImageOptions): Promise<string> => {
  const endpoint = (provider.baseUrl || '/api/codex-image/generate').trim();
  const imageToolModel = provider.modelImage || 'gpt-image-2';
  const responsesModel = readEnv('VITE_CODEX_IMAGE_RESPONSES_MODEL') || readEnv('CODEX_IMAGE_RESPONSES_MODEL') || 'gpt-5.5';
  const started = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CODEX_IMAGE_TIMEOUT_MS);

  console.info(`[openai-codex-image] start imageTool=${imageToolModel} responsesModel=${responsesModel} endpoint=${endpoint} size=${size}`);
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, size, model: responsesModel, image_model: imageToolModel, output_format: outputFormat }),
      signal: controller.signal
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`Codex image endpoint error ${response.status}: ${errorText || response.statusText}`);
    }

    const data = await response.json();
    const dataUri = data.dataUri || data.data_uri;
    const base64 = data.base64 || data.image || data.data;
    const mimeType = data.mimeType || data.mime_type || `image/${outputFormat}`;

    const result = dataUri || (base64 ? `data:${mimeType};base64,${base64}` : '');
    if (!result.startsWith('data:image/')) {
      throw new Error('Codex image endpoint returned no image data');
    }

    console.info(`[openai-codex-image] ok imageTool=${imageToolModel} durationMs=${Date.now() - started}`);
    return result;
  } catch (error: any) {
    const reason = error?.name === 'AbortError' ? `timeout after ${CODEX_IMAGE_TIMEOUT_MS}ms` : (error?.message || String(error));
    console.warn(`[openai-codex-image] failed imageTool=${imageToolModel} durationMs=${Date.now() - started}: ${reason}`);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};
