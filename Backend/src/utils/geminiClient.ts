import { GoogleGenAI } from "@google/genai";
import logger from "./logger";

let cachedModel: string | null = null;

// Modern Flash models ordered from newest to legacy fallback
const FALLBACK_MODELS = [
    "gemini-3.5-flash",
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-2.0-flash-exp",
];

export function getGeminiClient(): GoogleGenAI {
    const key = process.env.GEMINI_API_KEY || "";
    return new GoogleGenAI({
        apiKey: key,
        apiVersion: "v1beta",
    });
}

/**
 * Dynamically resolves the active Gemini Flash model supported by the current API key.
 * Queries Google's ModelService.ListModels so we never get a hardcoded 404.
 */
export async function getActiveGeminiModel(ai: GoogleGenAI): Promise<string> {
    if (process.env.GEMINI_MODEL) {
        return process.env.GEMINI_MODEL;
    }
    if (cachedModel) {
        return cachedModel;
    }

    try {
        const pager = await ai.models.list();
        for await (const m of pager) {
            const rawName = m.name || "";
            const cleanName = rawName.replace(/^models\//, "");
            const methods = (m as any).supportedGenerationMethods || (m as any).supportedActions || [];
            const canGenerate = methods.length === 0 || methods.includes("generateContent");

            // Look for an active flash model
            if (canGenerate && cleanName.toLowerCase().includes("flash")) {
                cachedModel = cleanName;
                logger.info({ resolvedModel: cleanName }, "Auto-discovered active Gemini model from API");
                return cleanName;
            }
        }
    } catch (err: any) {
        logger.warn({ err: err.message }, "Could not query listModels — using fallback candidate list");
    }

    cachedModel = FALLBACK_MODELS[0]; // defaults to "gemini-2.5-flash"
    return cachedModel;
}

export { FALLBACK_MODELS };
