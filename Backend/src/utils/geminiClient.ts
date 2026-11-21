import { GoogleGenAI } from "@google/genai";
import type { GenerateContentParameters, GenerateContentResponse } from "@google/genai";
import logger from "./logger";

// Default Gemini model. Override on the server with the GEMINI_MODEL env var.
// NOTE: do not auto-pick a model from ListModels. It also returns models that
// are still listed but no longer available to this key (e.g. gemini-2.5-flash),
// which causes 404 NOT_FOUND on generateContent.
export const DEFAULT_GEMINI_MODEL = "gemini-3.8-flash";

// Tried in order when the primary model is overloaded (503/429) or gone (404).
const FALLBACK_MODELS = ["gemini-3.5-flash", "gemini-3.1-flash-lite"];

const PER_CALL_TIMEOUT_MS = 25_000; // abort a single hung Gemini call
const TOTAL_BUDGET_MS = 40_000;     // stop retrying/falling back after this long
const RETRY_DELAY_MS = 800;

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

/** The model name itself is retired / not available to this key. */
function isModelGone(err: any): boolean {
    if (statusOf(err) === 404) return true;
    return /no longer available|is not found|not supported for generateContent/i.test(String(err?.message ?? ""));
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Runs `attempt` with retry + model fallback.
 * - busy (503/429/timeout): retry the primary model once, then try the fallback models
 * - model retired (404): skip straight to the next model
 * - anything else (e.g. 400 bad request): thrown as-is, not hidden
 * `canRetry` lets a streaming call refuse to start over once the student has already seen text.
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
        const attempts = i === 0 ? 2 : 1;

        for (let n = 1; n <= attempts; n++) {
            try {
                const result = await attempt(model);
                if (run) run.model = model;
                if (i > 0) logger.info({ model }, "Gemini fallback model answered");
                return result;
            } catch (err: any) {
                const gone = isModelGone(err);
                const busy = !gone && isBusy(err);
                logger.warn(
                    { model, attempt: n, status: statusOf(err), busy, gone, err: String(err?.message ?? err).slice(0, 300) },
                    "Gemini call failed",
                );

                if (!gone && !busy) throw err; // real error — don't mask it
                if (!canRetry()) throw err;    // text already reached the student, so cannot start over
                if (busy) sawBusy = true;
                if (gone) break;               // this model is out — go to the next one
                if (Date.now() - started > TOTAL_BUDGET_MS) break;
                if (n < attempts) await sleep(RETRY_DELAY_MS);
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

const withTimeout = (params: Omit<GenerateContentParameters, "model">) => ({
    ...params.config,
    httpOptions: { ...params.config?.httpOptions, timeout: PER_CALL_TIMEOUT_MS },
});

/** generateContent with retry + model fallback. */
export async function generateWithFallback(
    ai: GoogleGenAI,
    params: Omit<GenerateContentParameters, "model">,
    run?: GeminiRun,
): Promise<GenerateContentResponse> {
    return runWithFallback(
        (model) => ai.models.generateContent({ ...params, model, config: withTimeout(params) }),
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
            const stream = await ai.models.generateContentStream({ ...params, model, config: withTimeout(params) });
            const parts: any[] = []; // kept exactly as received, so tool-call signatures survive
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
