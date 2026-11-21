import type { Response } from "express";

// Server-sent events for streaming chat answers.
// Events: status {text}, delta {text}, done {...final answer}, error {message}.

export interface SseStream {
    send: (event: "status" | "delta" | "done" | "error", data: unknown) => void;
    end: () => void;
}

export function formatSse(event: string, data: unknown): string {
    return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export function startSse(res: Response): SseStream {
    res.status(200);
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    // no-transform keeps the compression middleware (and proxies) from holding the stream back
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    let closed = false;
    res.on("close", () => { closed = true; });

    const write = (chunk: string) => {
        if (closed || res.writableEnded) return;
        res.write(chunk);
        (res as any).flush?.();
    };
    write(": open\n\n");

    return {
        send: (event, data) => write(formatSse(event, data)),
        end: () => { if (!closed && !res.writableEnded) res.end(); },
    };
}

/** Short friendly line shown while a tool runs. */
export function toolStatus(labels: Record<string, string>, tool: string): string {
    return labels[tool] ?? "Working on it…";
}
