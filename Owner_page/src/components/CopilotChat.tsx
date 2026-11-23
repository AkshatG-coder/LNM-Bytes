import { useState, useRef, useEffect, useCallback } from 'react';
import api from '../hooks/api';
import { BlocksView } from './CopilotCards';
import type { OwnerUiBlock } from './CopilotCards';
import ChatText from './ChatText';
import VoiceInput from './VoiceInput';
import { streamChat, ChatStreamError } from '../hooks/chatStream';
import { loadChat, saveChat, clearChat } from '../hooks/chatStore';
import { getStoreId, getAuthToken } from '../hooks/config';

interface Message {
    role: 'user' | 'assistant';
    text: string;
    timestamp: Date;
    blocks?: OwnerUiBlock[];
    suggestions?: string[];
    isError?: boolean;
    retryText?: string;
    /** Still being written. Not saved and not sent back as history. */
    streaming?: boolean;
}

const ACCENT = '#F5B400';

const GREETING: Message = {
    role: 'assistant',
    text: "Hi, I'm Copilot.\nAsk me about orders, sales, your menu or store status. I can also mark items out of stock, change prices and open or close the store.",
    timestamp: new Date(),
};

const STARTERS = ['Pending orders', "Today's sales", 'What should I prepare?', 'Sales for the last 7 days', 'Show unavailable items', 'Store status'];

// Short note of the cards shown, so follow-ups like "reject the second one" have context.
function blocksToHistoryNote(blocks?: OwnerUiBlock[]): string {
    if (!blocks || blocks.length === 0) return '';
    const parts = blocks.map((b) => {
        switch (b.type) {
            case 'orders':
                return `orders: ${b.orders.map((o) => `#${o.orderNumber} ${o.userName} (${o.status})`).join(', ')}`;
            case 'menu':
                return `menu items: ${b.items.map((i) => `${i.name} ₹${i.price}${i.isAvailable ? '' : ' (unavailable)'}`).join(', ')}`;
            case 'sales':
                return `sales card: ${b.sales.periodLabel}, revenue ₹${b.sales.totalRevenue}, ${b.sales.totalOrders} orders`;
            case 'store':
                return `store card: ${b.store.name} is ${b.store.status}`;
        }
    });
    return `\n[Cards shown to the owner — ${parts.join('; ')}]`;
}

function Icon({ d, size = 18 }: { d: string; size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d={d} />
        </svg>
    );
}

export default function CopilotChat() {
    const [isOpen, setIsOpen] = useState(false);
    const [expanded, setExpanded] = useState(false);
    const [messages, setMessages] = useState<Message[]>([GREETING]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [listening, setListening] = useState(false);
    const [voiceError, setVoiceError] = useState<string | null>(null);
    const [status, setStatus] = useState('');
    const storeId = getStoreId();
    const chatKey = storeId ? `lnm:copilot:chat:${storeId}` : null;
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: loading ? 'auto' : 'smooth', block: 'end' });
    }, [loading]);

    useEffect(() => {
        scrollToBottom();
    }, [messages, loading, scrollToBottom]);

    // Bring back this store's chat after a refresh (text only)
    useEffect(() => {
        if (!chatKey) return;
        const saved = loadChat(chatKey);
        if (saved) setMessages(saved.map((m) => ({ role: m.role, text: m.text, timestamp: new Date(m.at) })));
    }, [chatKey]);

    // Keep it saved as the conversation grows
    useEffect(() => {
        if (!chatKey || loading) return;
        const finished = messages.filter((m) => !m.isError && !m.streaming);
        if (finished.length <= 1) return; // just the greeting
        saveChat(chatKey, finished.map((m) => ({ role: m.role, text: m.text, at: m.timestamp.getTime() })));
    }, [messages, loading, chatKey]);

    useEffect(() => {
        if (isOpen) inputRef.current?.focus();
    }, [isOpen]);

    // Esc closes the chat
    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setIsOpen(false);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [isOpen]);

    const sendMessage = async (text?: string) => {
        const msg = (text ?? input).trim();
        if (!msg || loading) return;

        setMessages((prev) => [
            ...prev,
            { role: 'user', text: msg, timestamp: new Date() },
            { role: 'assistant', text: '', timestamp: new Date(), streaming: true },
        ]);
        setInput('');
        setStatus('');
        setLoading(true);

        // The streaming placeholder is always the last message
        const patchLast = (change: (m: Message) => Message) =>
            setMessages((prev) => prev.map((m, i) => (i === prev.length - 1 ? change(m) : m)));

        try {
            // Build history from prior messages (skip greeting, error bubbles and the one being written)
            const history = messages
                .filter((m, i) => i > 0 && !m.isError && !m.streaming)
                .map((m) => ({ role: m.role === 'user' ? 'user' : 'model', text: m.text + blocksToHistoryNote(m.blocks) }));

            const data = await streamChat({
                url: `${api.defaults.baseURL}/copilot/chat`,
                token: getAuthToken() || null,
                body: { message: msg, history },
                handlers: {
                    onStatus: setStatus,
                    onDelta: (t) => patchLast((m) => ({ ...m, text: m.text + t })),
                },
            });

            patchLast((m) => ({
                ...m,
                streaming: false,
                text: data.message || "I couldn't work that out. Try rephrasing it.",
                blocks: Array.isArray(data.blocks) ? (data.blocks as OwnerUiBlock[]) : [],
                suggestions: Array.isArray(data.suggestions) ? data.suggestions : [],
            }));
        } catch (err) {
            const errorText = err instanceof ChatStreamError ? err.message : 'Could not reach the server. Check your connection and try again.';
            patchLast((m) =>
                m.text.trim()
                    ? { ...m, streaming: false, isError: true, retryText: msg, text: `${m.text}\n\n${errorText}` } // keep what was already written
                    : { ...m, streaming: false, isError: true, retryText: msg, text: errorText },
            );
        } finally {
            setLoading(false);
            setStatus('');
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    const last = messages[messages.length - 1];
    const dockChips = loading
        ? []
        : messages.length <= 1
            ? STARTERS
            : last.role === 'assistant' && !last.isError
                ? (last.suggestions ?? [])
                : [];

    const scrollRow: React.CSSProperties = { scrollbarWidth: 'none' };

    return (
        <>
            {/* Launcher */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                aria-label={isOpen ? 'Close Copilot' : 'Open Copilot, your store assistant'}
                aria-expanded={isOpen}
                className="fixed bottom-5 right-5 z-50 h-14 w-14 rounded-xl text-on-primary shadow-lg flex items-center justify-center transition-transform duration-150 hover:scale-105 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2"
                style={{ background: ACCENT, outlineColor: ACCENT }}
            >
                {isOpen ? (
                    <Icon d="M6 18L18 6M6 6l12 12" size={22} />
                ) : (
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M4 5h16v11H9l-5 4z" />
                        <path d="M8 10h8M8 13h5" />
                    </svg>
                )}
            </button>

            {isOpen && (
                <div
                    role="dialog"
                    aria-label="Store Copilot chat"
                    className={`fixed z-50 inset-0 sm:inset-auto sm:bottom-24 sm:right-5 ${expanded ? 'sm:w-[min(780px,calc(100vw-3rem))] sm:h-[calc(100vh-7rem)]' : 'sm:w-[480px] sm:h-[min(760px,calc(100vh-7rem))]'} flex flex-col overflow-hidden sm:rounded-xl sm:border shadow-2xl`}
                    style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)' }}
                >
                    {/* Header */}
                    <div className="flex items-center gap-3 px-4 py-3 text-on-primary flex-shrink-0" style={{ background: ACCENT }}>
                        <div className="w-9 h-9 rounded-xl bg-black/10 flex items-center justify-center flex-shrink-0">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M4 5h16v11H9l-5 4z" />
                                <path d="M8 10h8M8 13h5" />
                            </svg>
                        </div>
                        <div className="min-w-0 flex-1">
                            <h2 className="text-[15px] font-semibold leading-tight">Copilot</h2>
                            <p className="text-xs text-on-primary/75 truncate">Orders, sales, menu and store</p>
                        </div>
                        <button
                            onClick={() => {
                                setMessages([GREETING]);
                                setInput('');
                                if (chatKey) clearChat(chatKey);
                            }}
                            disabled={loading || messages.length <= 1}
                            aria-label="Start a new chat"
                            title="New chat"
                            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-black/10 disabled:opacity-40 disabled:hover:bg-transparent focus-visible:outline-2 focus-visible:outline-[#121B2E]"
                        >
                            <Icon d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5" size={16} />
                        </button>

                        <button
                            onClick={() => setExpanded((v) => !v)}
                            aria-label={expanded ? 'Make the chat smaller' : 'Make the chat larger'}
                            title={expanded ? 'Smaller' : 'Larger'}
                            className="hidden sm:flex w-8 h-8 rounded-lg items-center justify-center hover:bg-black/10 focus-visible:outline-2 focus-visible:outline-[#121B2E]"
                        >
                            <Icon d={expanded ? 'M9 4v5H4M15 20v-5h5M4 9l6-6M20 15l-6 6' : 'M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7'} size={16} />
                        </button>
                        <button
                            onClick={() => setIsOpen(false)}
                            aria-label="Close chat"
                            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-black/10 focus-visible:outline-2 focus-visible:outline-[#121B2E]"
                        >
                            <Icon d="M6 18L18 6M6 6l12 12" size={18} />
                        </button>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto px-3.5 py-4 space-y-3" role="log" aria-live="polite">
                        {messages.map((msg, i) => (msg.streaming && !msg.text ? null : (
                            <div key={i} className="space-y-2">
                                <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div
                                        className={`max-w-[88%] px-3.5 py-2.5 text-[14px] leading-relaxed motion-safe:animate-fade-in ${
                                            msg.role === 'user' ? 'text-on-primary rounded-xl rounded-br-sm' : 'rounded-xl rounded-bl-sm border'
                                        }`}
                                        style={
                                            msg.role === 'user'
                                                ? { background: ACCENT }
                                                : msg.isError
                                                    ? { backgroundColor: 'rgba(239,68,68,0.10)', borderColor: 'rgba(239,68,68,0.35)', color: 'var(--color-text-main)' }
                                                    : { backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-main)' }
                                        }
                                    >
                                        {msg.role === 'user' ? <span className="whitespace-pre-wrap break-words">{msg.text}</span> : <ChatText text={msg.text} />}
                                        {msg.isError && msg.retryText && (
                                            <button
                                                onClick={() => sendMessage(msg.retryText)}
                                                disabled={loading}
                                                className="mt-2 block text-xs font-semibold underline underline-offset-2 disabled:opacity-50 text-brand"
                                            >
                                                Try again
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {msg.role === 'assistant' && msg.blocks && msg.blocks.length > 0 && <BlocksView blocks={msg.blocks} />}
                            </div>
                        )))}

                        {loading && !last?.text && (
                            <div className="flex justify-start" aria-label="Copilot is typing">
                                <div className="px-4 py-3 rounded-xl rounded-bl-sm border flex items-center gap-1.5" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
                                    {[0, 150, 300].map((d) => (
                                        <span key={d} className="w-1.5 h-1.5 rounded-full motion-safe:animate-bounce" style={{ background: ACCENT, animationDelay: `${d}ms` }} />
                                    ))}
                                    {status && <span className="ml-1.5 text-xs" style={{ color: 'var(--color-text-muted)' }}>{status}</span>}
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Suggestions: one scrolling row so they never push the conversation up */}
                    {dockChips.length > 0 && (
                        <div className="flex gap-2 overflow-x-auto px-3.5 pt-2 pb-1 flex-shrink-0" style={scrollRow} aria-label="Suggested replies">
                            {dockChips.map((s) => (
                                <button
                                    key={s}
                                    onClick={() => sendMessage(s)}
                                    className="flex-shrink-0 text-[13px] font-medium px-3.5 py-2 rounded-lg border transition-colors active:scale-95 hover:bg-primary/10"
                                    style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)', color: 'var(--color-text-main)' }}
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Input */}
                    {voiceError && (
                        <p role="status" className="px-4 pt-1 text-xs text-red-500 flex-shrink-0">{voiceError}</p>
                    )}
                    <div className="px-3.5 pt-2 pb-3 flex-shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                        <div
                            className="flex items-center gap-2 rounded-xl border pl-4 pr-2 py-2 focus-within:ring-2 focus-within:ring-primary/60"
                            style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
                        >
                            <input
                                ref={inputRef}
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder={listening ? "Listening… speak in English or Hinglish" : "Ask about orders or sales"}
                                aria-label="Message Copilot"
                                disabled={loading}
                                className="flex-1 min-w-0 bg-transparent text-[15px] outline-none placeholder:text-gray-400 disabled:opacity-60"
                                style={{ color: 'var(--color-text-main)' }}
                            />
                            <VoiceInput value={input} onChange={setInput} disabled={loading} onListening={setListening} onError={setVoiceError} />
                            <button
                                onClick={() => sendMessage()}
                                disabled={!input.trim() || loading}
                                aria-label="Send message"
                                className="w-10 h-10 rounded-lg flex items-center justify-center text-on-primary transition-transform active:scale-95 disabled:opacity-30 flex-shrink-0"
                                style={{ background: ACCENT }}
                            >
                                <Icon d="M5 12h14M13 6l6 6-6 6" size={18} />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
