// Reads a streamed chat answer (server-sent events) from BiteBot or Copilot.
// Falls back to a normal JSON reply, so it also works against a server that does not stream yet.

export interface ChatFinal {
  message: string
  blocks: unknown[]
  suggestions: string[]
}

export interface StreamHandlers {
  /** A friendly line while a tool runs, e.g. "Searching menus…" */
  onStatus?: (text: string) => void
  /** A piece of the answer as it is written */
  onDelta?: (text: string) => void
}

export class ChatStreamError extends Error {
  status?: number
  /** True when some of the answer had already been shown */
  partial: boolean
  constructor(message: string, opts: { status?: number; partial?: boolean } = {}) {
    super(message)
    this.status = opts.status
    this.partial = opts.partial ?? false
  }
}

/** Turns one event block ("event: x\ndata: {...}") into an object. Comments and junk give null. */
export interface SseData {
  text?: string
  message?: string
  success?: boolean
  blocks?: unknown[]
  suggestions?: string[]
}

export function parseSseBlock(block: string): { event: string; data: SseData } | null {
  let event = 'message'
  const dataLines: string[] = []
  for (const line of block.split('\n')) {
    if (line.startsWith(':') || line === '') continue
    if (line.startsWith('event:')) event = line.slice(6).trim()
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).replace(/^ /, ''))
  }
  if (dataLines.length === 0) return null
  try {
    return { event, data: JSON.parse(dataLines.join('\n')) }
  } catch {
    return null
  }
}

const IDLE_TIMEOUT_MS = 45_000

export async function streamChat(opts: {
  url: string
  token: string | null
  body: Record<string, unknown>
  handlers?: StreamHandlers
  /** Called on a 401, so the app can sign the user out like its other requests do */
  onUnauthorized?: () => void
}): Promise<ChatFinal> {
  const { url, token, body, handlers, onUnauthorized } = opts
  const controller = new AbortController()
  let idle: ReturnType<typeof setTimeout> | undefined
  let gotText = false
  const bump = () => {
    if (idle) clearTimeout(idle)
    idle = setTimeout(() => controller.abort(), IDLE_TIMEOUT_MS)
  }

  try {
    bump()
    let res: Response
    try {
      res = await fetch(url, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream, application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ ...body, stream: true }),
      })
    } catch {
      throw new ChatStreamError('Could not reach the assistant. Check your connection and try again.')
    }

    const type = res.headers.get('content-type') || ''

    if (!res.ok || type.includes('application/json')) {
      if (res.status === 401) onUnauthorized?.()
      let data: SseData | null = null
      try { data = (await res.json()) as SseData } catch { /* not JSON */ }
      if (!res.ok || data?.success === false) {
        throw new ChatStreamError(data?.message || 'The assistant is busy right now. Please try again.', { status: res.status })
      }
      return { message: data?.message ?? '', blocks: data?.blocks ?? [], suggestions: data?.suggestions ?? [] }
    }

    if (!res.body) throw new ChatStreamError('Streaming is not supported in this browser.')

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let final: ChatFinal | null = null

    const handle = (block: string) => {
      const evt = parseSseBlock(block)
      if (!evt) return
      if (evt.event === 'delta' && typeof evt.data?.text === 'string') {
        gotText = true
        handlers?.onDelta?.(evt.data.text)
      } else if (evt.event === 'status' && typeof evt.data?.text === 'string') {
        handlers?.onStatus?.(evt.data.text)
      } else if (evt.event === 'done') {
        final = { message: evt.data?.message ?? '', blocks: evt.data?.blocks ?? [], suggestions: evt.data?.suggestions ?? [] }
      } else if (evt.event === 'error') {
        throw new ChatStreamError(evt.data?.message || 'The assistant ran into a problem. Please try again.', { partial: gotText })
      }
    }

    for (;;) {
      let chunk: ReadableStreamReadResult<Uint8Array>
      try {
        chunk = await reader.read()
      } catch {
        throw new ChatStreamError('The connection dropped. Please try again.', { partial: gotText })
      }
      if (chunk.done) break
      bump()
      buffer += decoder.decode(chunk.value, { stream: true }).replace(/\r\n/g, '\n')
      let cut: number
      while ((cut = buffer.indexOf('\n\n')) !== -1) {
        handle(buffer.slice(0, cut))
        buffer = buffer.slice(cut + 2)
      }
    }
    if (buffer.trim()) handle(buffer)

    if (!final) throw new ChatStreamError('The connection dropped. Please try again.', { partial: gotText })
    return final
  } finally {
    if (idle) clearTimeout(idle)
  }
}
