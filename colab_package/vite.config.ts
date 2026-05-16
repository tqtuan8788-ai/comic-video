import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
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
        }
      }
    },
    // This workspace is on a permissive mounted volume where Node copyFile can
    // throw EPERM when Vite recopies public/favicon.svg over dist/favicon.svg.
    // The app does not depend on public assets at runtime, so skip publicDir.
    publicDir: false,
    plugins: [react()],
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
        OMNIVOICE_PROXY_TARGET: env.OMNIVOICE_PROXY_TARGET,
        GROQ_API_KEY: env.GROQ_API_KEY,
        OPENROUTER_API_KEY: env.OPENROUTER_API_KEY,
        PROVIDER_PRIORITY: env.PROVIDER_PRIORITY,
        USE_FREE_ONLY: env.USE_FREE_ONLY
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
      'process.env.TTS_FREE_VOICE': JSON.stringify(env.TTS_FREE_VOICE)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
