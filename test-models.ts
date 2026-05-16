// Quick test script to check available models
import { GoogleGenAI } from "@google/genai";

const API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
if (!API_KEY) {
    throw new Error("Set GEMINI_API_KEY or GOOGLE_API_KEY before running this test script.");
}
const ai = new GoogleGenAI({ apiKey: API_KEY });

async function testModels() {
    console.log("Testing Imagen 3...");

    // Test 1: Try Imagen 3
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-image-preview',
            contents: "A simple red circle on white background",
            config: {
                imageConfig: {
                    aspectRatio: "1:1",
                    imageSize: "1K"
                }
            }
        });
        console.log("✅ Imagen 3 WORKS:", response.candidates?.[0]?.content?.parts?.[0]?.inlineData ? "Image generated" : "No image");
    } catch (e: any) {
        console.error("❌ Imagen 3 FAILED:", e.message);
    }

    // Test 2: Try alternative - Gemini 2.0 Flash with imagen
    console.log("\nTesting Gemini 2.0 Flash Experimental...");
    try {
        const response2 = await ai.models.generateContent({
            model: 'gemini-2.0-flash-exp',
            contents: "Generate image: A simple red circle",
            config: {
                imageGenerationConfig: {
                    numberOfImages: 1
                }
            }
        });
        console.log("✅ Gemini 2.0 Flash WORKS:", response2);
    } catch (e: any) {
        console.error("❌ Gemini 2.0 Flash FAILED:", e.message);
    }

    // Test 3: List available models
    console.log("\nListing available models...");
    try {
        const models = await ai.models.list();
        console.log("Available models:", models.map(m => m.name).filter(n => n.includes('image') || n.includes('imagen')));
    } catch (e: any) {
        console.error("Failed to list models:", e.message);
    }
}

testModels();
