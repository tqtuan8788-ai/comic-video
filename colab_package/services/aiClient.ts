import { GoogleGenAI, Schema, Type } from "@google/genai";
import { ProviderConfig, selectLLMProvider } from "./providerConfig";

export interface LLMRequestOptions {
  prompt: string;
  schema?: Schema;
  schemaName?: string;
  temperature?: number;
  maxOutputTokens?: number;
  systemPrompt?: string;
}

const GEMINI_KEY_SOURCES = [
  "VITE_GEMINI_API_KEY",
  "GEMINI_API_KEY",
  "VITE_GOOGLE_API_KEY",
  "GOOGLE_API_KEY"
];

const getEnvValue = (key: string): string => {
  const meta = (import.meta as any)?.env?.[key];
  if (meta) return meta;
  if (typeof process !== "undefined" && process.env?.[key]) {
    return process.env[key] as string;
  }
  if (typeof window !== "undefined" && (window as any)[key]) {
    return (window as any)[key];
  }
  return "";
};

const resolveGeminiApiKey = (): string => {
  const provider = selectLLMProvider();
  if (provider?.name === "gemini" && provider.apiKey) {
    return provider.apiKey;
  }

  for (const key of GEMINI_KEY_SOURCES) {
    const value = getEnvValue(key);
    if (value) return value;
  }

  const windowEnv = typeof window !== "undefined" ? (window as any).__COMICVIDEOAI_API_KEY : undefined;
  return windowEnv || "";
};

export const getGeminiClient = (): GoogleGenAI => {
  const apiKey = resolveGeminiApiKey();
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY. Set VITE_GEMINI_API_KEY in your environment.");
  }
  return new GoogleGenAI({ apiKey });
};

const typeMap: Partial<Record<Type, string>> = {
  [Type.OBJECT]: "object",
  [Type.ARRAY]: "array",
  [Type.STRING]: "string",
  [Type.INTEGER]: "integer",
  [Type.NUMBER]: "number",
  [Type.BOOLEAN]: "boolean"
};

const convertSchema = (schema: Schema): any => {
  const json: Record<string, any> = { type: typeMap[schema.type] || "string" };
  if ((schema as any).description) json.description = (schema as any).description;
  if ((schema as any).enum) json.enum = (schema as any).enum;

  if ((schema as any).properties) {
    json.properties = {};
    for (const key of Object.keys((schema as any).properties)) {
      const child = (schema as any).properties[key] as Schema;
      json.properties[key] = convertSchema(child);
    }
  }

  if ((schema as any).required) {
    json.required = (schema as any).required;
  }

  if ((schema as any).items) {
    json.items = convertSchema((schema as any).items as Schema);
  }

  return json;
};

const providerSupportsJsonSchema = (provider: ProviderConfig): boolean => {
  return provider.name === "openai" || provider.name === "groq" || provider.name === "openrouter";
};

const normalizeContent = (content: any): string => {
  if (!content) return "";
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (typeof part === "object" && part !== null) {
          return part.text || part.content || "";
        }
        return "";
      })
      .join("");
  }
  if (typeof content === "object") {
    return content.text || content.content || "";
  }
  return "";
};

const getOpenAIBaseUrl = (provider: ProviderConfig): string => {
  if (provider.baseUrl) return provider.baseUrl.replace(/\/$/, "");
  if (provider.name === "deepseek") return "https://api.deepseek.com";
  if (provider.name === "groq") return "https://api.groq.com/openai/v1";
  if (provider.name === "openrouter") return "https://openrouter.ai/api/v1";
  return "https://api.openai.com/v1";
};

const callOpenAICompatible = async (provider: ProviderConfig, prompt: string, options: LLMRequestOptions): Promise<string> => {
  if (!provider.apiKey) {
    throw new Error(`Missing API key for provider ${provider.name}`);
  }

  const url = `${getOpenAIBaseUrl(provider)}/chat/completions`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${provider.apiKey}`
  };

  if (provider.name === "openrouter") {
    headers["HTTP-Referer"] = typeof window !== "undefined" ? window.location.origin : "https://comicvideoai";
    headers["X-Title"] = "ComicVideoAI";
  }

  const schema = options.schema ? convertSchema(options.schema) : undefined;
  const schemaName = options.schemaName || "response";
  const supportsSchema = schema && providerSupportsJsonSchema(provider);

  let userPrompt = prompt;
  if (schema && !supportsSchema) {
    userPrompt = `${prompt}\n\nReturn ONLY valid JSON matching this schema:\n${JSON.stringify(schema)}`;
  }

  const body: Record<string, any> = {
    model: provider.modelText || "gpt-4o-mini",
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxOutputTokens ?? 1024,
    messages: [
      ...(options.systemPrompt ? [{ role: "system", content: options.systemPrompt }] : []),
      { role: "user", content: userPrompt }
    ]
  };

  if (schema) {
    body.response_format = supportsSchema
      ? { type: "json_schema", json_schema: { name: schemaName, schema } }
      : { type: "json_object" };
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Provider ${provider.name} error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  const message = data.choices?.[0]?.message;
  return normalizeContent(message?.content).trim();
};

const callAnthropic = async (provider: ProviderConfig, prompt: string, options: LLMRequestOptions): Promise<string> => {
  if (!provider.apiKey) {
    throw new Error("Missing API key for Anthropic provider");
  }

  const url = (provider.baseUrl || "https://api.anthropic.com/v1/messages").replace(/\/$/, "");
  const schema = options.schema ? convertSchema(options.schema) : undefined;
  const schemaName = options.schemaName || "response";

  const body: Record<string, any> = {
    model: provider.modelText || "claude-3-5-sonnet",
    max_tokens: options.maxOutputTokens ?? 1024,
    temperature: options.temperature ?? 0.7,
    messages: [
      {
        role: "user",
        content: schema
          ? `${prompt}\n\nReturn ONLY valid JSON matching this schema:\n${JSON.stringify(schema)}`
          : prompt
      }
    ]
  };

  if (options.systemPrompt) {
    body.system = options.systemPrompt;
  }

  if (schema) {
    body.response_format = {
      type: "json_schema",
      json_schema: {
        name: schemaName,
        schema
      }
    };
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": provider.apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Anthropic error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  const contentBlocks = data.content || [];
  const text = contentBlocks.map((block: any) => block.text || "").join("\n");
  return text.trim();
};

export const callLLM = async (options: LLMRequestOptions): Promise<string> => {
  const provider = selectLLMProvider();

  if (!provider || provider.name === "gemini") {
    const ai = getGeminiClient();
    const config: Record<string, any> = options.schema
      ? {
          responseMimeType: "application/json",
          responseSchema: options.schema
        }
      : {};

    if (options.temperature !== undefined) {
      config.temperature = options.temperature;
    }
    if (options.maxOutputTokens !== undefined) {
      config.maxOutputTokens = options.maxOutputTokens;
    }

    const response = await ai.models.generateContent({
      model: provider?.modelText || "gemini-2.5-flash",
      contents: options.prompt,
      ...(Object.keys(config).length ? { config } : {})
    });
    return (response.text || "").trim();
  }

  if (provider.name === "anthropic") {
    return callAnthropic(provider, options.prompt, options);
  }

  return callOpenAICompatible(provider, options.prompt, options);
};
