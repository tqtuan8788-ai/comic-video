# ComicVideoAI Colab Package

Thư mục này là gói tối thiểu để chạy ComicVideoAI trên Google Colab.

## Cách chạy nhanh

1. Mở notebook: `ComicVideoAI_Colab.ipynb`.
2. Chạy lần lượt các cell từ trên xuống.
3. Điền API key vào form trong notebook nếu muốn dùng DeepSeek/Gemini/OpenAI/Groq/OpenRouter/ElevenLabs.
4. Cell cuối sẽ in ra URL public qua Cloudflare Tunnel để mở giao diện Vite.

## Thành phần trong gói

- Source React/Vite cần thiết: `App.tsx`, `components/`, `services/`, `prompts/`, `types/`.
- Runtime/config: `package.json`, `package-lock.json`, `vite.config.ts`, Tailwind/PostCSS/TypeScript config.
- Backend TTS tùy chọn: `scripts/omnivoice-api-server.py`.
- Notebook Colab: `ComicVideoAI_Colab.ipynb`.
- Python deps cho OmniVoice: `requirements.txt`.
- Mẫu biến môi trường: `colab.env.example`.

## Lưu ý

- Pollinations dùng được không cần key cho tạo ảnh.
- Tính năng LLM cần ít nhất một API key hợp lệ, ví dụ `DEEPSEEK_API_KEY` hoặc `GEMINI_API_KEY`.
- OmniVoice là tùy chọn và có thể tải model lớn; mặc định notebook không bật để tiết kiệm thời gian.

## System packages

Notebook cài `ffmpeg` bằng `apt-get install -y ffmpeg`. `ffmpeg` không nằm trong `requirements.txt` vì đó là system package, không phải pip package.
