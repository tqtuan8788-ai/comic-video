import React from 'react';
import { Book, Film, Zap, Layers, Settings, Wand2 } from 'lucide-react';

export const GuideTab: React.FC = () => {
    return (
        <div className="max-w-4xl mx-auto space-y-8 p-6 bg-slate-900 text-slate-100 rounded-xl border border-slate-800">
            <div className="text-center space-y-4">
                <div className="inline-flex p-4 rounded-full bg-blue-900/30 text-blue-400 mb-2">
                    <Book className="w-12 h-12" />
                </div>
                <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                    Hướng dẫn sử dụng ComicVideoAI
                </h2>
                <p className="text-slate-400 max-w-2xl mx-auto">
                    Quy trình tạo Video Viral từ A-Z với kiến trúc Hollywood Director Studio.
                </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
                {/* Step 1 */}
                <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 hover:border-blue-500/50 transition-colors">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-lg">1</div>
                        <h3 className="text-xl font-bold text-white">Input & Duration</h3>
                    </div>
                    <p className="text-slate-300 mb-4">
                        Nhập nội dung gốc (bài viết, truyện, ý tưởng). Chọn chế độ thời lượng:
                    </p>
                    <ul className="space-y-2 text-sm text-slate-400">
                        <li className="flex items-start gap-2">
                            <span className="text-blue-400">•</span>
                            <span><strong>Short (30s):</strong> Tối ưu cho TikTok/Reels/Shorts. 8-12 cảnh.</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-blue-400">•</span>
                            <span><strong>Medium (60s):</strong> Storytelling ngắn gọn. 15-20 cảnh.</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-blue-400">•</span>
                            <span><strong>Long (2m+):</strong> Giữ nguyên chi tiết. 40-60 cảnh.</span>
                        </li>
                    </ul>
                </div>

                {/* Step 2 */}
                <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 hover:border-purple-500/50 transition-colors">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-10 h-10 rounded-lg bg-purple-600 flex items-center justify-center font-bold text-lg">2</div>
                        <h3 className="text-xl font-bold text-white">Analysis & Characters</h3>
                    </div>
                    <p className="text-slate-300 mb-4">
                        AI phân tích cốt truyện, tìm "Hook" (điểm thu hút) và thiết kế nhân vật.
                    </p>
                    <ul className="space-y-2 text-sm text-slate-400">
                        <li className="flex items-start gap-2">
                            <span className="text-purple-400">•</span>
                            <span><strong>Viral Analysis:</strong> Xác định theme, tone và khán giả mục tiêu.</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-purple-400">•</span>
                            <span><strong>Character Design:</strong> Chỉnh sửa mô tả ngoại hình nhân vật để giữ sự nhất quán (consistent character).</span>
                        </li>
                    </ul>
                </div>

                {/* Step 3 */}
                <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 hover:border-pink-500/50 transition-colors">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-10 h-10 rounded-lg bg-pink-600 flex items-center justify-center font-bold text-lg">3</div>
                        <h3 className="text-xl font-bold text-white">Storyboard & Presets</h3>
                    </div>
                    <p className="text-slate-300 mb-4">
                        Chọn style hình ảnh và tinh chỉnh kịch bản phân cảnh.
                    </p>
                    <ul className="space-y-2 text-sm text-slate-400">
                        <li className="flex items-start gap-2">
                            <span className="text-pink-400">•</span>
                            <span><strong>Presets:</strong> Thư viện style có sẵn (Manhua, Anime, Horror, Realism...). Chọn tab "Presets" để đổi style nhanh.</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-pink-400">•</span>
                            <span><strong>Storyboard:</strong> Kịch bản chi tiết từng cảnh. AI tự chia beat để pacing nhanh (1.5 - 3s/cảnh).</span>
                        </li>
                    </ul>
                </div>

                {/* Step 4 */}
                <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 hover:border-amber-500/50 transition-colors">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-10 h-10 rounded-lg bg-amber-600 flex items-center justify-center font-bold text-lg">4</div>
                        <h3 className="text-xl font-bold text-white">Generation & Export</h3>
                    </div>
                    <p className="text-slate-300 mb-4">
                        Tạo hình ảnh/âm thanh hàng loạt và xuất video.
                    </p>
                    <ul className="space-y-2 text-sm text-slate-400">
                        <li className="flex items-start gap-2">
                            <span className="text-amber-400">•</span>
                            <span><strong>Batch Processing:</strong> Hệ thống tự động tạo ảnh và TTS (thêm delay 3s để tránh lỗi 429).</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-amber-400">•</span>
                            <span><strong>Supervisor:</strong> Thanh bên phải hiển thị checklist viral, cho phép sửa lỗi (Fix Images/Audio) nhanh.</span>
                        </li>
                    </ul>
                </div>
            </div>

            <div className="mt-8 bg-slate-800/50 border border-slate-700 rounded-xl p-6">
                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <Settings className="w-5 h-5 text-slate-400" />
                    Settings & Troubleshooting
                </h3>
                <div className="grid md:grid-cols-2 gap-8">
                    <div>
                        <h4 className="font-semibold text-blue-400 mb-2">API Configuration (Settings Tab)</h4>
                        <p className="text-sm text-slate-400 mb-2">
                            Quản lý API Key cho Gemini, OpenAI, ElevenLabs tại tab Settings.
                        </p>
                        <ul className="list-disc list-inside text-sm text-slate-500 space-y-1">
                            <li>Hỗ trợ Multi-provider fallback.</li>
                            <li>Cấu hình Cost Policy để tiết kiệm chi phí.</li>
                        </ul>
                    </div>
                    <div>
                        <h4 className="font-semibold text-red-400 mb-2">Common Issues</h4>
                        <ul className="space-y-2 text-sm text-slate-400">
                            <li>
                                <strong>Lỗi 429 (Rate Limit):</strong> Hệ thống quá tải. Chờ 1-2 phút rồi nhấn nút "Regenerate" ở scene bị lỗi.
                            </li>
                            <li>
                                <strong>Hình ảnh không khớp:</strong> Sửa lại mô tả nhân vật ở bước Characters hoặc Visual Prompt trong Edit Scene.
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};
