import { GoogleGenAI } from "@google/genai";

// Default Gemini model. Override on the server with the GEMINI_MODEL env var.
// NOTE: do not auto-pick a model from ListModels. It also returns models that
// are still listed but no longer available to this key (e.g. gemini-2.5-flash),
// which causes 404 NOT_FOUND on generateContent.
export const DEFAULT_GEMINI_MODEL = "gemini-3.8-flash";

export function getGeminiClient(): GoogleGenAI {
    const key = process.env.GEMINI_API_KEY || "";
    return new GoogleGenAI({
        apiKey: key,
        apiVersion: "v1beta",
    });
}

/**
 * Returns the Gemini model to use: GEMINI_MODEL if set, otherwise the default.
 * Kept async with the same signature so existing callers don't change.
 */
export async function getActiveGeminiModel(_ai?: GoogleGenAI): Promise<string> {
    return process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
}
