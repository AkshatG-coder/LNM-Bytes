/**
 * groqClient.ts — Drop-in replacement for geminiClient.ts using Groq's API,
 * with automatic fallback to Gemini (`geminiClient.ts`) if Groq fails or is unconfigured.
 *
 * Exports the EXACT same function signatures as geminiClient so the controllers
 * only need to change their import line — no other code change required.
 *
 * Format bridge:
 *   Controllers speak Google SDK format (contents/parts/functionCall/functionDeclarations)
 *   This adapter converts to/from OpenAI-compatible format that Groq accepts.
 *
 * Active production models with tool-calling support on Groq:
 *   primary  → openai/gpt-oss-120b  (flagship open-weight model, fast + strong tool use)
 *   fallback → qwen/qwen3.8-27b     (strong multilingual + parallel tool calling)
 *   last     → openai/gpt-oss-20b   (ultra-fast lightweight fallback)
 *   backup   → Gemini (via geminiClient.ts) if all Groq attempts fail or GROQ_API_KEY is unset
 */

import Groq from "groq-sdk";
import logger from "./logger";
import {
    createGeminiRun as createNativeGeminiRun,
    generateStreamWithFallback as geminiGenerateStreamWithFallback,
    generateWithFallback as geminiGenerateWithFallback,
    getGeminiClient as getNativeGeminiClient,
    type GeminiRun as NativeGeminiRun,
} from "./geminiClient";

// ─── Model chain ─────────────────────────────────────────────────────────────
const FALLBACK_MODELS = [
    "qwen/qwen3.8-27b",
    "openai/gpt-oss-20b",
];

// Retry timings — exponential backoff: 2 s → 4 s → 8 s
const BASE_RETRY_MS       = 2_000;
const PER_CALL_TIMEOUT_MS = 12_000;

function primaryModel(): string {
    return process.env.GROQ_MODEL || "openai/gpt-oss-120b";
}

function groqBudgetMs(): number {
    // Leave time for Gemini backup within HTTP request timeouts when Gemini is configured
    return process.env.GEMINI_API_KEY ? 28_000 : 45_000;
}

// ─── Shared run handle (mirrors geminiClient) ─────────────────────────────────
export interface GeminiRun {
    model: string | null;
    provider?: "groq" | "gemini";
    geminiRun?: NativeGeminiRun;
}
export function createGeminiRun(): GeminiRun {
    return { model: null, geminiRun: createNativeGeminiRun() };
}

// Stores original Groq tool_call.id off-object so Google functionCall objects stay schema-clean
const groqCallIds = new WeakMap<object, string>();

// ─── Groq client helper ───────────────────────────────────────────────────────
function getGroq(): Groq {
    return new Groq({
        apiKey: process.env.GROQ_API_KEY || "",
        timeout: PER_CALL_TIMEOUT_MS,
    });
}

// ─── Format converters ────────────────────────────────────────────────────────

/** Recursively lowercase JSON-Schema `type` strings: "OBJECT" → "object", etc. */
function lowerSchema(schema: any): any {
    if (!schema || typeof schema !== "object") return schema;
    if (Array.isArray(schema)) return schema.map(lowerSchema);
    const out: any = {};
    for (const [k, v] of Object.entries(schema)) {
        out[k] = k === "type" && typeof v === "string" ? v.toLowerCase() : lowerSchema(v);
    }
    return out;
}

/**
 * Google functionDeclarations → OpenAI tools array.
 * Input:  [{ functionDeclarations: [{ name, description, parameters }] }]
 * Output: [{ type:"function", function:{ name, description, parameters } }]
 */
function toGroqTools(googleTools: any[]): Groq.Chat.ChatCompletionTool[] {
    const result: Groq.Chat.ChatCompletionTool[] = [];
    for (const group of googleTools ?? []) {
        for (const fd of group.functionDeclarations ?? []) {
            result.push({
                type: "function",
                function: {
                    name: fd.name,
                    description: fd.description ?? "",
                    parameters: lowerSchema(fd.parameters) ?? { type: "object", properties: {} },
                },
            });
        }
    }
    return result;
}

/**
 * Google contents array → OpenAI messages array.
 * Prepends a system message when `systemInstruction` is supplied, and pairs
 * tool calls with their responses via a per-name FIFO queue so parallel calls
 * to the same tool never collide.
 */
function toGroqMessages(
    contents: any[],
    systemInstruction?: string,
): Groq.Chat.ChatCompletionMessageParam[] {
    const messages: Groq.Chat.ChatCompletionMessageParam[] = [];
    if (systemInstruction) {
        messages.push({ role: "system", content: systemInstruction });
    }

    const idQueues = new Map<string, string[]>();

    for (let turnIdx = 0; turnIdx < contents.length; turnIdx++) {
        const content = contents[turnIdx];
        const role    = content.role === "model" ? "assistant" : content.role;
        const parts   = content.parts ?? [];

        const fnCalls = parts.filter((p: any) => p.functionCall);
        const fnResps = parts.filter((p: any) => p.functionResponse);
        const texts   = parts.filter((p: any) => p.text && !p.thought);

        if (fnCalls.length) {
            const tool_calls: Groq.Chat.ChatCompletionMessageToolCall[] = fnCalls.map((p: any, idx: number) => {
                const name = p.functionCall.name;
                const id   = groqCallIds.get(p.functionCall) || `call_${turnIdx}_${idx}_${name}`;
                const queue = idQueues.get(name) ?? [];
                queue.push(id);
                idQueues.set(name, queue);
                return {
                    id,
                    type: "function" as const,
                    function: {
                        name,
                        arguments: JSON.stringify(p.functionCall.args ?? {}),
                    },
                };
            });
            messages.push({
                role: "assistant",
                content: texts.map((p: any) => p.text).join("") || null,
                tool_calls,
            } as any);
        } else if (fnResps.length) {
            for (let idx = 0; idx < fnResps.length; idx++) {
                const p         = fnResps[idx];
                const name      = p.functionResponse.name;
                const queue     = idQueues.get(name);
                const callId    = queue?.length ? queue.shift()! : `call_${turnIdx}_${idx}_${name}`;
                const rawResult = p.functionResponse?.response?.result;
                messages.push({
                    role: "tool",
                    content: typeof rawResult === "string" ? rawResult : JSON.stringify(rawResult ?? {}),
                    tool_call_id: callId,
                } as any);
            }
        } else {
            const text = texts.map((p: any) => p.text).join("");
            if (text) {
                messages.push({
                    role: role as any,
                    content: text,
                });
            }
        }
    }

    return messages;
}

/** Remove `<think>...</think>` blocks if a reasoning model emits raw tags. */
function stripThinkTags(text: string): string {
    return text.replace(/<think>[\s\S]*?<\/think>\s*/gi, "").trimStart();
}

/**
 * Groq ChatCompletion → Google-compatible response shape.
 * Controllers read: response.candidates[0].content.parts[].{text | functionCall}
 */
function toGoogleResponse(completion: Groq.Chat.ChatCompletion): any {
    const msg = completion.choices?.[0]?.message;
    if (!msg) return { candidates: [] };

    const parts: any[] = [];

    for (const tc of msg.tool_calls ?? []) {
        let args: any = {};
        try { args = JSON.parse(tc.function.arguments ?? "{}"); } catch { /* keep empty */ }
        const fc = { name: tc.function.name, args };
        if (tc.id) groqCallIds.set(fc, tc.id);
        parts.push({ functionCall: fc });
    }

    if (msg.content) {
        const clean = stripThinkTags(msg.content);
        if (clean) parts.push({ text: clean });
    }

    return { candidates: [{ content: { role: "model", parts } }] };
}

/** Filters `<think>...</think>` spans out of streamed text chunks. */
function createThinkFilter(onText: (text: string) => void) {
    let buffer  = "";
    let inThink = false;
    let leading = true;

    const emit = (chunk: string) => {
        const out = leading ? chunk.replace(/^\s+/, "") : chunk;
        if (!out) return;
        leading = false;
        onText(out);
    };

    return {
        push(delta: string) {
            buffer += delta;
            while (buffer.length > 0) {
                if (inThink) {
                    const closeIdx = buffer.indexOf("</think>");
                    if (closeIdx === -1) {
                        if (buffer.length > 8) buffer = buffer.slice(-8);
                        return;
                    }
                    buffer  = buffer.slice(closeIdx + 8);
                    inThink = false;
                    continue;
                }

                const openIdx = buffer.indexOf("<think>");
                if (openIdx !== -1) {
                    if (openIdx > 0) emit(buffer.slice(0, openIdx));
                    buffer  = buffer.slice(openIdx + 7);
                    inThink = true;
                    continue;
                }

                const partialIdx = buffer.lastIndexOf("<");
                if (partialIdx !== -1 && "<think>".startsWith(buffer.slice(partialIdx))) {
                    if (partialIdx > 0) emit(buffer.slice(0, partialIdx));
                    buffer = buffer.slice(partialIdx);
                    return;
                }

                emit(buffer);
                buffer = "";
            }
        },
        flush() {
            if (!inThink && buffer) emit(buffer);
            buffer = "";
        },
    };
}

// ─── Error helpers ────────────────────────────────────────────────────────────
function errorCodeOf(err: any): string {
    return String(err?.error?.error?.code ?? err?.error?.code ?? err?.code ?? "").toLowerCase();
}

function errorStatusOf(err: any): number | undefined {
    return err?.status ?? err?.statusCode;
}

function isGroqGone(err: any): boolean {
    const status = errorStatusOf(err);
    const code   = errorCodeOf(err);
    const msg    = String(err?.message ?? "");
    if (status === 404) return true;
    if (code === "model_decommissioned" || code === "model_not_found") return true;
    return /decommission|model_not_found|does not exist|not supported/i.test(msg);
}

function isGroqToolGlitch(err: any): boolean {
    return errorCodeOf(err) === "tool_use_failed" || /empty response/i.test(String(err?.message ?? ""));
}

function isGroqBusy(err: any): boolean {
    const status = errorStatusOf(err);
    if (status && [429, 500, 502, 503, 504].includes(status)) return true;
    return /rate.?limit|overload|UNAVAILABLE|service.?unavailable|too.?many|timed? ?out|aborted|fetch failed|ECONNRESET|ETIMEDOUT/i
        .test(String(err?.message ?? ""));
}

const isTimeout = (err: any) => /timed? ?out|aborted|ETIMEDOUT/i.test(String(err?.message ?? ""));

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// ─── Request parameter builder ────────────────────────────────────────────────
function reasoningExtra(model: string): Record<string, any> {
    if (model.startsWith("openai/gpt-oss")) {
        return { reasoning_effort: "low" };
    }
    return {};
}

async function createWithReasoningFallback<T>(
    runCall: (extra: Record<string, any>) => Promise<T>,
    model: string,
): Promise<T> {
    const extra = reasoningExtra(model);
    try {
        return await runCall(extra);
    } catch (err: any) {
        const rejectsReasoning =
            Object.keys(extra).length > 0 &&
            errorStatusOf(err) === 400 &&
            /reasoning/i.test(String(err?.message ?? ""));
        if (!rejectsReasoning) throw err;
        logger.warn({ model }, "Groq model rejected reasoning_effort, retrying without it");
        return runCall({});
    }
}

// ─── Core retry + fallback runner ─────────────────────────────────────────────
async function runWithGroqFallback<T>(
    attempt: (model: string, groq: Groq) => Promise<T>,
    run?: GeminiRun,
    canRetry: () => boolean = () => true,
): Promise<T> {
    const groq      = getGroq();
    const primary   = primaryModel();
    const budgetMs  = groqBudgetMs();
    const chain     = run?.provider === "groq" && run.model
        ? [run.model, primary, ...FALLBACK_MODELS].filter((m, i, a) => a.indexOf(m) === i)
        : [primary, ...FALLBACK_MODELS].filter((m, i, a) => a.indexOf(m) === i);
    const started   = Date.now();
    let sawBusy     = false;

    for (let i = 0; i < chain.length; i++) {
        const model       = chain[i];
        const maxAttempts = i === 0 ? 3 : 1; // primary: 3 tries (2s→4s→8s); fallbacks: 1 try

        for (let n = 1; n <= maxAttempts; n++) {
            try {
                const result = await attempt(model, groq);
                if (run) {
                    run.model    = model;
                    run.provider = "groq";
                }
                if (i > 0) logger.info({ model }, "Groq fallback model answered");
                return result;
            } catch (err: any) {
                const gone       = isGroqGone(err);
                const toolGlitch = !gone && isGroqToolGlitch(err);
                const busy       = !gone && (isGroqBusy(err) || toolGlitch);
                const delay      = BASE_RETRY_MS * Math.pow(2, n - 1); // 2 s, 4 s, 8 s

                logger.warn(
                    {
                        model,
                        attempt: n,
                        maxAttempts,
                        status: errorStatusOf(err),
                        code: errorCodeOf(err) || undefined,
                        busy,
                        gone,
                        nextDelayMs: busy && !toolGlitch && n < maxAttempts ? delay : 0,
                        err: String(err?.message ?? err).slice(0, 300),
                    },
                    "Groq call failed",
                );

                if (!gone && !busy) throw err; // real error (e.g. 400/401) — bubble to Gemini fallback
                if (!canRetry()) throw err;     // text already sent, cannot restart
                if (busy && !toolGlitch) sawBusy = true;
                if (gone) break;                // model retired/not found → next immediately
                if (Date.now() - started > budgetMs) break;
                if (isTimeout(err)) break;      // hung model → skip to fallback immediately

                if (n < maxAttempts) {
                    const waitMs = toolGlitch ? 200 : delay;
                    if (!toolGlitch) logger.info({ model, delayMs: waitMs }, "Groq exponential backoff");
                    await sleep(waitMs);
                }
            }
        }

        if (Date.now() - started > budgetMs) break;
    }

    throw new Error(
        sawBusy
            ? "The AI service is very busy right now. Please try again in a few seconds."
            : "AI model unavailable. Please contact support.",
    );
}

/**
 * Runs Groq first, and automatically falls back to Gemini (`geminiClient.ts`)
 * if GROQ_API_KEY is unset or if Groq fails before any text is emitted.
 */
async function withGeminiBackup<T>(
    runGroq: () => Promise<T>,
    runGemini: () => Promise<T>,
    run?: GeminiRun,
    canFallback: () => boolean = () => true,
): Promise<T> {
    const hasGroq   = Boolean(process.env.GROQ_API_KEY);
    const hasGemini = Boolean(process.env.GEMINI_API_KEY);

    if (run?.provider === "gemini" || !hasGroq) {
        if (!hasGemini) {
            throw new Error("AI service is not configured on server (missing GROQ_API_KEY / GEMINI_API_KEY).");
        }
        const res = await runGemini();
        if (run) run.provider = "gemini";
        return res;
    }

    try {
        return await runGroq();
    } catch (groqErr: any) {
        if (!hasGemini || !canFallback()) throw groqErr;
        logger.warn({ err: String(groqErr?.message ?? groqErr).slice(0, 300) }, "Groq failed — falling back to Gemini");
        const res = await runGemini();
        if (run) run.provider = "gemini";
        return res;
    }
}

// ─── Public API (drop-in for geminiClient exports) ───────────────────────────

function extractRequestConfig(params: { contents: any[]; config?: any }) {
    const cfg     = params.config ?? {};
    const tools   = toGroqTools(cfg.tools ?? []);
    const sysInst = typeof cfg.systemInstruction === "string"
        ? cfg.systemInstruction
        : cfg.systemInstruction?.parts?.map((p: any) => p.text).join("") ?? undefined;
    return { tools, sysInst };
}

/**
 * generateWithFallback — tries Groq first (with retries + model fallbacks),
 * and falls back to Gemini if Groq fails or is unconfigured.
 */
export async function generateWithFallback(
    _ai: any,
    params: { contents: any[]; config?: any },
    run?: GeminiRun,
): Promise<any> {
    const { tools, sysInst } = extractRequestConfig(params);

    return withGeminiBackup(
        () =>
            runWithGroqFallback(async (model, groq) => {
                const messages = toGroqMessages(params.contents, sysInst);
                const completion = await createWithReasoningFallback(
                    (extra) =>
                        groq.chat.completions.create({
                            model,
                            messages,
                            ...(tools.length ? { tools, tool_choice: "auto" } : {}),
                            temperature: 0.4,
                            ...extra,
                        } as any),
                    model,
                );
                const googleRes = toGoogleResponse(completion as Groq.Chat.ChatCompletion);
                if (!googleRes.candidates?.[0]?.content?.parts?.length) {
                    throw new Error("Groq returned an empty response");
                }
                return googleRes;
            }, run),
        () => geminiGenerateWithFallback(getNativeGeminiClient(), params as any, run?.geminiRun),
        run,
    );
}

/**
 * generateStreamWithFallback — streams from Groq first, and falls back to
 * streaming from Gemini if Groq fails before any text reaches `onText`.
 */
export async function generateStreamWithFallback(
    _ai: any,
    params: { contents: any[]; config?: any },
    run: GeminiRun | undefined,
    onText: (text: string) => void,
): Promise<any> {
    const { tools, sysInst } = extractRequestConfig(params);
    let emitted = false;

    return withGeminiBackup<any>(
        () =>
            runWithGroqFallback(async (model, groq) => {
                const messages = toGroqMessages(params.contents, sysInst);

                const stream = await createWithReasoningFallback(
                    (extra) =>
                        groq.chat.completions.create({
                            model,
                            messages,
                            ...(tools.length ? { tools, tool_choice: "auto" } : {}),
                            temperature: 0.4,
                            stream: true,
                            ...extra,
                        } as any) as unknown as Promise<AsyncIterable<Groq.Chat.ChatCompletionChunk>>,
                    model,
                );

                let fullText = "";
                const accToolCalls: Map<number, { id: string; name: string; args: string }> = new Map();
                const filter = createThinkFilter((clean) => {
                    emitted = true;
                    onText(clean);
                });

                for await (const chunk of stream) {
                    const delta = chunk.choices?.[0]?.delta;
                    if (!delta) continue;

                    if (delta.content) {
                        fullText += delta.content;
                        filter.push(delta.content);
                    }

                    for (const tc of delta.tool_calls ?? []) {
                        const existing = accToolCalls.get(tc.index) ?? { id: "", name: "", args: "" };
                        accToolCalls.set(tc.index, {
                            id:   tc.id                  ? existing.id   + tc.id                  : existing.id,
                            name: tc.function?.name      ? existing.name + tc.function.name      : existing.name,
                            args: tc.function?.arguments ? existing.args + tc.function.arguments : existing.args,
                        });
                    }
                }
                filter.flush();

                const parts: any[] = [];
                for (const [, tc] of [...accToolCalls.entries()].sort(([a], [b]) => a - b)) {
                    let args: any = {};
                    try { args = JSON.parse(tc.args || "{}"); } catch { /* keep empty */ }
                    const fc = { name: tc.name, args };
                    if (tc.id) groqCallIds.set(fc, tc.id);
                    parts.push({ functionCall: fc });
                }
                const cleanFull = stripThinkTags(fullText);
                if (cleanFull) parts.push({ text: cleanFull });
                if (parts.length === 0) {
                    throw new Error("Groq returned an empty response");
                }

                return { candidates: [{ content: { role: "model", parts } }] };
            }, run, () => !emitted),
        () => geminiGenerateStreamWithFallback(getNativeGeminiClient(), params as any, run?.geminiRun, onText),
        run,
        () => !emitted,
    );
}

/** Legacy compat — controllers call this but don't use the return value as an AI client */
export function getGeminiClient(): null { return null; }
export const DEFAULT_GEMINI_MODEL = primaryModel();
export async function getActiveGeminiModel(): Promise<string> { return primaryModel(); }
