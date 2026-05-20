import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { spawn } from 'child_process';

const readJsonBody = async (req: any): Promise<any> => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
};

const codexImageMiddleware = () => ({
  name: 'comicvideoai-codex-image',
  configureServer(server: any) {
    server.middlewares.use('/api/codex-image/generate', async (req: any, res: any) => {
      if (req.method !== 'POST') {
        res.statusCode = 405;
        res.end('Method not allowed');
        return;
      }

      try {
        const payload = await readJsonBody(req);
        const script = path.resolve(__dirname, 'scripts/openai_codex_image.py');
        const child = spawn(process.env.CODEX_IMAGE_PYTHON || process.env.PYTHON || 'python3', [script], {
          cwd: __dirname,
          stdio: ['pipe', 'pipe', 'pipe'],
          env: {
            ...process.env,
            CODEX_IMAGE_RESPONSES_MODEL: payload.model || process.env.CODEX_IMAGE_RESPONSES_MODEL || 'gpt-5.5',
            CODEX_IMAGE_MODEL: payload.image_model || process.env.CODEX_IMAGE_MODEL || 'gpt-image-2',
            CODEX_IMAGE_SIZE: payload.size || process.env.CODEX_IMAGE_SIZE || '1024x1792'
          }
        });

        const timeout = setTimeout(() => child.kill('SIGKILL'), 180_000);
        let stdout = '';
        let stderr = '';
        child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
        child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
        child.stdin.end(JSON.stringify(payload));

        child.on('close', (code) => {
          clearTimeout(timeout);
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          if (code !== 0) {
            res.statusCode = 503;
            res.end(stdout || JSON.stringify({ ok: false, error: stderr || `codex-image-gen exited ${code}` }));
            return;
          }
          res.end(stdout);
        });
      } catch (error: any) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ ok: false, error: error?.message || String(error) }));
      }
    });
  }
});

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, '.', ''), ...process.env };
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
      https: env.USE_HTTPS === 'true' ? {} : undefined,
      watch: {
        ignored: ['**/.venv-omnivoice/**', '**/.cache/**', '**/.omx/**', '**/dist/**']
      },
      proxy: {
        // Browser fetches /api/omnivoice/* so local OmniVoice does not need CORS.
        // Run the backend at OMNIVOICE_PROXY_TARGET or http://localhost:7861.
        '/api/omnivoice': {
          target: env.OMNIVOICE_PROXY_TARGET || 'http://localhost:7861',
          changeOrigin: true,
          rewrite: (requestPath) => requestPath.replace(/^\/api\/omnivoice/, '')
        },
        '/api/edge-tts': {
          target: env.EDGE_TTS_PROXY_TARGET || 'http://localhost:5050',
          changeOrigin: true,
          rewrite: (requestPath) => requestPath.replace(/^\/api\/edge-tts/, '')
        },
        // Browser uses a same-origin path; Vite forwards to the user's local
        // openai-oauth proxy. Auth remains inside that proxy/Codex CLI login.
        '/api/openai-codex': {
          target: (env.CODEX_OPENAI_BASE_URL || env.OPENAI_BASE_URL || 'http://127.0.0.1:10531/v1').replace(/\/v1\/?$/, ''),
          changeOrigin: true,
          rewrite: (requestPath) => requestPath.replace(/^\/api\/openai-codex/, '')
        }
      }
    },
    // This workspace is on a permissive mounted volume where Node copyFile can
    // throw EPERM when Vite recopies public/favicon.svg over dist/favicon.svg.
    // The app does not depend on public assets at runtime, so skip publicDir.
    publicDir: false,
    plugins: [react(), codexImageMiddleware()],
    define: {
      'process.env': JSON.stringify({
        API_KEY: env.GEMINI_API_KEY,
        GEMINI_API_KEY: env.GEMINI_API_KEY,
        GOOGLE_API_KEY: env.GOOGLE_API_KEY,
        DEEPSEEK_API_KEY: env.DEEPSEEK_API_KEY,
        DEEPSEEK_BASE_URL: env.DEEPSEEK_BASE_URL,
        DEEPSEEK_MODEL_TEXT: env.DEEPSEEK_MODEL_TEXT,
        POLLINATIONS_IMAGE_URL: env.POLLINATIONS_IMAGE_URL,
        POLLINATIONS_MODEL_IMAGE: env.POLLINATIONS_MODEL_IMAGE,
        TTS_FREE_URL: env.TTS_FREE_URL,
        TTS_FREE_KEY: env.TTS_FREE_KEY,
        TTS_FREE_VOICE: env.TTS_FREE_VOICE,
        VITE_TTS_OMNIVOICE_URL: env.VITE_TTS_OMNIVOICE_URL,
        VITE_TTS_OMNIVOICE_KEY: env.VITE_TTS_OMNIVOICE_KEY,
        VITE_TTS_OMNIVOICE_VOICE: env.VITE_TTS_OMNIVOICE_VOICE,
        TTS_OMNIVOICE_URL: env.TTS_OMNIVOICE_URL,
        TTS_OMNIVOICE_KEY: env.TTS_OMNIVOICE_KEY,
        TTS_OMNIVOICE_VOICE: env.TTS_OMNIVOICE_VOICE,
        EDGE_TTS_PROXY_TARGET: env.EDGE_TTS_PROXY_TARGET,
        OMNIVOICE_PROXY_TARGET: env.OMNIVOICE_PROXY_TARGET,
        GROQ_API_KEY: env.GROQ_API_KEY,
        OPENROUTER_API_KEY: env.OPENROUTER_API_KEY,
        PROVIDER_PRIORITY: env.PROVIDER_PRIORITY,
        USE_FREE_ONLY: env.USE_FREE_ONLY,
        CODEX_OPENAI_BASE_URL: env.CODEX_OPENAI_BASE_URL,
        CODEX_OPENAI_MODEL_TEXT: env.CODEX_OPENAI_MODEL_TEXT,
        CODEX_IMAGE_GENERATE_URL: env.CODEX_IMAGE_GENERATE_URL,
        CODEX_IMAGE_MODEL: env.CODEX_IMAGE_MODEL,
        CODEX_IMAGE_RESPONSES_MODEL: env.CODEX_IMAGE_RESPONSES_MODEL,
        CODEX_IMAGE_PYTHON: env.CODEX_IMAGE_PYTHON,
        CODEX_PROVIDER_FALLBACK: env.CODEX_PROVIDER_FALLBACK
      }),
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.DEEPSEEK_API_KEY': JSON.stringify(env.DEEPSEEK_API_KEY),
      'process.env.DEEPSEEK_BASE_URL': JSON.stringify(env.DEEPSEEK_BASE_URL),
      'process.env.DEEPSEEK_MODEL_TEXT': JSON.stringify(env.DEEPSEEK_MODEL_TEXT),
      'process.env.POLLINATIONS_IMAGE_URL': JSON.stringify(env.POLLINATIONS_IMAGE_URL),
      'process.env.POLLINATIONS_MODEL_IMAGE': JSON.stringify(env.POLLINATIONS_MODEL_IMAGE),
      'process.env.TTS_FREE_URL': JSON.stringify(env.TTS_FREE_URL),
      'process.env.TTS_FREE_KEY': JSON.stringify(env.TTS_FREE_KEY),
      'process.env.TTS_FREE_VOICE': JSON.stringify(env.TTS_FREE_VOICE),
      'process.env.VITE_TTS_OMNIVOICE_URL': JSON.stringify(env.VITE_TTS_OMNIVOICE_URL),
      'process.env.VITE_TTS_OMNIVOICE_KEY': JSON.stringify(env.VITE_TTS_OMNIVOICE_KEY),
      'process.env.VITE_TTS_OMNIVOICE_VOICE': JSON.stringify(env.VITE_TTS_OMNIVOICE_VOICE),
      'process.env.TTS_OMNIVOICE_URL': JSON.stringify(env.TTS_OMNIVOICE_URL),
      'process.env.TTS_OMNIVOICE_KEY': JSON.stringify(env.TTS_OMNIVOICE_KEY),
      'process.env.TTS_OMNIVOICE_VOICE': JSON.stringify(env.TTS_OMNIVOICE_VOICE),
      'process.env.EDGE_TTS_PROXY_TARGET': JSON.stringify(env.EDGE_TTS_PROXY_TARGET),
      'process.env.CODEX_OPENAI_BASE_URL': JSON.stringify(env.CODEX_OPENAI_BASE_URL),
      'process.env.CODEX_OPENAI_MODEL_TEXT': JSON.stringify(env.CODEX_OPENAI_MODEL_TEXT),
      'process.env.CODEX_IMAGE_GENERATE_URL': JSON.stringify(env.CODEX_IMAGE_GENERATE_URL),
      'process.env.CODEX_IMAGE_MODEL': JSON.stringify(env.CODEX_IMAGE_MODEL),
      'process.env.CODEX_IMAGE_RESPONSES_MODEL': JSON.stringify(env.CODEX_IMAGE_RESPONSES_MODEL),
      'process.env.CODEX_IMAGE_PYTHON': JSON.stringify(env.CODEX_IMAGE_PYTHON),
      'process.env.CODEX_PROVIDER_FALLBACK': JSON.stringify(env.CODEX_PROVIDER_FALLBACK)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
