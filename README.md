<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1lsn118-BF0LWz-WCGs0Jh06Od3JqZ1tW

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Configure providers in [.env.local](.env.local). Current no-GPU setup:
   ```env
   PROVIDER_PRIORITY="deepseek,pollinations,tts_free,gemini,openai,groq,openrouter,tts_elevenlabs,sdxl_local"
   DEEPSEEK_API_KEY=your_deepseek_key
   DEEPSEEK_BASE_URL=https://api.deepseek.com
   DEEPSEEK_MODEL_TEXT=deepseek-chat
   POLLINATIONS_IMAGE_URL=https://image.pollinations.ai/prompt
   POLLINATIONS_MODEL_IMAGE=flux
   TTS_FREE_PROVIDER=omnivoice
   TTS_FREE_URL=/api/omnivoice/tts
   OMNIVOICE_PROXY_TARGET=http://localhost:7861
   ```
   Pollinations Flux is used for image generation so SDXL/ComfyUI local can stay disabled on CPU-only machines.
3. Run the app:
   `npm run dev`
