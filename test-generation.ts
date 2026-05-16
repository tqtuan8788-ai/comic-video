// Quick test for image and audio generation
import { GoogleGenAI, Modality } from "@google/genai";

const API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
if (!API_KEY) {
    throw new Error("Set GEMINI_API_KEY or GOOGLE_API_KEY before running this test script.");
}
const ai = new GoogleGenAI({ apiKey: API_KEY });

async function testGenerations() {
    // Test Image Generation
    console.log("=== Testing Image Generation ===");
    try {
        const parts = [
            { text: "A Vietnamese blacksmith in a simple workshop, comic book style, cinematic lighting, 9:16 vertical format" }
        ];

        const imageResponse = await ai.models.generateContent({
            model: 'gemini-3-pro-image-preview',
            contents: { parts },
            config: {
                imageConfig: {
                    aspectRatio: "9:16",
                    imageSize: "1K"
                }
            }
        });

        const imagePart = imageResponse.candidates?.[0]?.content?.parts?.[0];
        if (imagePart?.inlineData?.data) {
            console.log("✅ IMAGE GENERATION WORKS! Size:", imagePart.inlineData.data.length);
        } else {
            console.log("❌ IMAGE FAILED - No data in response");
        }
    } catch (e: any) {
        console.log("❌ IMAGE ERROR:", e.message);
    }

    // Test Audio Generation  
    console.log("\n=== Testing Audio Generation ===");
    try {
        const audioResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash-preview-tts',
            contents: [{
                role: "user",
                parts: [{ text: "Ngày xưa có ông già nghèo" }]
            }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: 'Zephyr' }
                    }
                }
            }
        });

        const audioPart = audioResponse.candidates?.[0]?.content?.parts?.[0];
        if (audioPart?.inlineData?.data) {
            console.log("✅ AUDIO GENERATION WORKS! Size:", audioPart.inlineData.data.length);
            console.log("   MIME type:", audioPart.inlineData.mimeType);
        } else {
            console.log("❌ AUDIO FAILED - No data in response");
        }
    } catch (e: any) {
        console.log("❌ AUDIO ERROR:", e.message);
    }
}

testGenerations().then(() => {
    console.log("\n=== Test Complete ===");
    process.exit(0);
});
