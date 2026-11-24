import { GoogleGenAI } from "@google/genai";
import type { GenerateContentParameters, GenerateContentResponse } from "@google/genai";
import logger from "./logger";

// Default Gemini model. Override on the server with the GEMINI_MODEL env var.
// NOTE: do not auto-pick a model from ListModels. It also returns models that
// are still listed but no longer available to this key (e.g. gemini-2.5-flash),
// which causes 404 NOT_FOUND on generateContent.
export const DEFAULT_GEMINI_MODEL = "gemini-3.6-flash";

// Tried in order when the primary model is overloaded (503/429) or gone (404).
// gemini-3.8-flash produces near-zero output on the free tier right now — kept only as last resort.
const FALLBACK_MODELS = ["gemini-3.1-flash-lite", "gemini-3.8-flash"];

const PER_CALL_TIMEOUT_MS = 20_000; // abort a single hung Gemini call
const TOTAL_BUDGET_MS    = 45_000; // stop retrying/falling back after this long
const BASE_RETRY_MS      = 2_000;  // exponential backoff base: 2 s → 4 s → 8 s (avoids 429 loops)

// Gemini 3 models "think" before answering, which adds seconds of silence. Chat answers need little
// reasoning, so ask for a light level. Override with GEMINI_THINKING (minimal|low|medium|high|off).
function thinkingLevel(): string | null {
    const v = (process.env.GEMINI_THINKING || "low").toLowerCase();
    return v === "off" ? null : v;
}
const rejectsThinking = (err: any) => /thinking/i.test(String(err?.message ?? "")) && statusOf(err) === 400;

export function getGeminiClient(): GoogleGenAI {
    const key = process.env.GEMINI_API_KEY || "";
    return new GoogleGenAI({
        apiKey: key,
        apiVersion: "v1beta",
    });
}

/** Remembers which model answered, so one chat turn's tool-call loop stays on one model. */
export interface GeminiRun {
    model: string | null;
}

export function createGeminiRun(): GeminiRun {
    return { model: null };
}

function modelChain(run?: GeminiRun): string[] {
    const primary = process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
    const chain = [primary, ...FALLBACK_MODELS];
    if (run?.model) chain.unshift(run.model);
    return chain.filter((m, i) => chain.indexOf(m) === i); // de-duplicate, keep order
}

function statusOf(err: any): number | undefined {
    const s = err?.status ?? err?.code ?? err?.error?.code;
    if (typeof s === "number") return s;
    const m = /"code"\s*:\s*(\d{3})/.exec(String(err?.message ?? ""));
    return m ? Number(m[1]) : undefined;
}

/** Temporary problems: worth a retry / another model. */
function isBusy(err: any): boolean {
    const status = statusOf(err);
    if (status && [429, 500, 502, 503, 504].includes(status)) return true;
    return /UNAVAILABLE|high demand|overloaded|RESOURCE_EXHAUSTED|timed? ?out|aborted|fetch failed|ECONNRESET|ETIMEDOUT/i
        .test(String(err?.message ?? ""));
}

const isTimeout = (err: any) => /timed? ?out|aborted|ETIMEDOUT/i.test(String(err?.message ?? ""));

/** The model name itself is retired / not available to this key. */
function isModelGone(err: any): boolean {
    if (statusOf(err) === 404) return true;
    return /no longer available|is not found|not supported for generateContent/i.test(String(err?.message ?? ""));
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Runs `attempt` with exponential-backoff retry + model fallback.
 * - busy (429/500/503/504/timeout): retry primary model up to 3× with 2s→4s→8s delay
 * - model retired (404 / zero output): skip to the next model immediately
 * - anything else (e.g. 400 bad request): thrown as-is, not hidden
 * `canRetry` lets a streaming call refuse to restart once text has already reached the client.
 */
async function runWithFallback<T>(
    attempt: (model: string) => Promise<T>,
    run?: GeminiRun,
    canRetry: () => boolean = () => true,
): Promise<T> {
    const started = Date.now();
    const chain = modelChain(run);
    let sawBusy = false;

    for (let i = 0; i < chain.length; i++) {
        const model = chain[i];
        const maxAttempts = i === 0 ? 3 : 1; // primary: 3 tries (2s→4s→8s); fallbacks: 1 try each

        for (let n = 1; n <= maxAttempts; n++) {
            try {
                const result = await attempt(model);
                if (run) run.model = model;
                if (i > 0) logger.info({ model }, "Gemini fallback model answered");
                return result;
            } catch (err: any) {
                const gone = isModelGone(err);
                const busy = !gone && isBusy(err);
                const delay = BASE_RETRY_MS * Math.pow(2, n - 1); // 2 000 ms, 4 000 ms, 8 000 ms
                logger.warn(
                    { model, attempt: n, maxAttempts, status: statusOf(err), busy, gone, nextDelayMs: busy && n < maxAttempts ? delay : 0, err: String(err?.message ?? err).slice(0, 300) },
                    "Gemini call failed",
                );

                if (!gone && !busy) throw err; // real error — don't mask it
                if (!canRetry()) throw err;    // text already reached the client, cannot restart
                if (busy) sawBusy = true;
                if (gone) break;               // model retired — go to next immediately
                if (Date.now() - started > TOTAL_BUDGET_MS) break;
                if (isTimeout(err)) break;     // hung model will likely hang again — skip to next

                // Exponential backoff before retrying the same model
                if (n < maxAttempts) {
                    logger.info({ model, delayMs: delay }, "Gemini exponential backoff");
                    await sleep(delay);
                }
            }
        }

        if (Date.now() - started > TOTAL_BUDGET_MS) break;
    }

    throw new Error(
        sawBusy
            ? "The AI service is very busy right now. Please try again in a few seconds."
            : "The AI model is unavailable for this API key. Set GEMINI_MODEL to a model that is currently available.",
    );
}

const buildConfig = (params: Omit<GenerateContentParameters, "model">, withThinking: boolean) => {
    const level = withThinking ? thinkingLevel() : null;
    return {
        ...params.config,
        ...(level && !params.config?.thinkingConfig ? { thinkingConfig: { thinkingLevel: level as any } } : {}),
        httpOptions: { ...params.config?.httpOptions, timeout: PER_CALL_TIMEOUT_MS },
    };
};

/** Runs `call` with a light thinking level; if the model refuses that setting, runs it again without. */
async function withThinkingFallback<T>(call: (withThinking: boolean) => Promise<T>): Promise<T> {
    try {
        return await call(true);
    } catch (err: any) {
        if (!rejectsThinking(err)) throw err;
        logger.warn("Gemini model rejected the thinking setting, retrying without it");
        return call(false);
    }
}

/** generateContent with retry + model fallback. */
export async function generateWithFallback(
    ai: GoogleGenAI,
    params: Omit<GenerateContentParameters, "model">,
    run?: GeminiRun,
): Promise<GenerateContentResponse> {
    return runWithFallback(
        (model) => withThinkingFallback((t) => ai.models.generateContent({ ...params, model, config: buildConfig(params, t) })),
        run,
    );
}

/**
 * Same as generateWithFallback, but the answer is read as a stream and every piece of text is passed to
 * `onText` as it arrives. Returns a response shaped like generateContent's, so tool-call loops need no change.
 * A busy or retired model is still skipped, but only while nothing has been sent to `onText` yet.
 */
export async function generateStreamWithFallback(
    ai: GoogleGenAI,
    params: Omit<GenerateContentParameters, "model">,
    run: GeminiRun | undefined,
    onText: (text: string) => void,
): Promise<GenerateContentResponse> {
    let emitted = false;
    return runWithFallback(
        async (model) => {
            const parts: any[] = [];
            const stream = await withThinkingFallback((t) => ai.models.generateContentStream({ ...params, model, config: buildConfig(params, t) })); // kept exactly as received, so tool-call signatures survive
            for await (const chunk of stream) {
                for (const part of chunk.candidates?.[0]?.content?.parts ?? []) {
                    parts.push(part);
                    if (part.text && !(part as any).thought) {
                        emitted = true;
                        onText(part.text);
                    }
                }
            }
            return { candidates: [{ content: { role: "model", parts } }] } as unknown as GenerateContentResponse;
        },
        run,
        () => !emitted,
    );
}
