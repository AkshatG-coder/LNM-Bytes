import { useState, useRef, useEffect, useCallback } from 'react';
import api from '../hooks/api';
import { BlocksView } from './CopilotCards';
import type { OwnerUiBlock } from './CopilotCards';
import ChatText from './ChatText';
import VoiceInput from './VoiceInput';

interface Message {
    role: 'user' | 'assistant';
    text: string;
    timestamp: Date;
    blocks?: OwnerUiBlock[];
    suggestions?: string[];
    isError?: boolean;
    retryText?: string;
}

const ACCENT = '#4f46e5';

const GREETING: Message = {
    role: 'assistant',
    text: "Hi, I'm Copilot.\nAsk me about orders, sales, your menu or store status. I can also mark items out of stock, change prices and open or close the store.",
    timestamp: new Date(),
};

const STARTERS = ['Pending orders', "Today's sales", 'Sales for the last 7 days', 'Show unavailable items', 'Store status'];

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
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [messages, loading, scrollToBottom]);

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

        setMessages((prev) => [...prev, { role: 'user', text: msg, timestamp: new Date() }]);
        setInput('');
        setLoading(true);

        try {
            // Build history from prior messages (skip greeting and error bubbles)
            const history = messages
                .filter((m, i) => i > 0 && !m.isError)
                .map((m) => ({ role: m.role === 'user' ? 'user' : 'model', text: m.text + blocksToHistoryNote(m.blocks) }));

            // AI replies can take a while (model + tool-call loop), so allow more than the default 10s
            const { data } = await api.post('/copilot/chat', { message: msg, history }, { timeout: 60000 });

            setMessages((prev) => [
                ...prev,
                {
                    role: 'assistant',
                    text: data.message || "I couldn't work that out. Try rephrasing it.",
                    timestamp: new Date(),
                    blocks: Array.isArray(data.blocks) ? data.blocks : [],
                    suggestions: Array.isArray(data.suggestions) ? data.suggestions : [],
                },
            ]);
        } catch (err: any) {
            const errorText = err.response?.data?.message || 'Could not reach the server. Check your connection and try again.';
            setMessages((prev) => [
                ...prev,
                { role: 'assistant', text: errorText, timestamp: new Date(), isError: true, retryText: msg },
            ]);
        } finally {
            setLoading(false);
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
                className="fixed bottom-5 right-5 z-50 h-14 w-14 rounded-2xl text-white shadow-lg flex items-center justify-center transition-transform duration-150 hover:scale-105 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2"
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
                    className={`fixed z-50 inset-0 sm:inset-auto sm:bottom-24 sm:right-5 ${expanded ? 'sm:w-[min(780px,calc(100vw-3rem))] sm:h-[calc(100vh-7rem)]' : 'sm:w-[480px] sm:h-[min(760px,calc(100vh-7rem))]'} flex flex-col overflow-hidden sm:rounded-2xl sm:border shadow-2xl`}
                    style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)' }}
                >
                    {/* Header */}
                    <div className="flex items-center gap-3 px-4 py-3 text-white flex-shrink-0" style={{ background: ACCENT }}>
                        <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M4 5h16v11H9l-5 4z" />
                                <path d="M8 10h8M8 13h5" />
                            </svg>
                        </div>
                        <div className="min-w-0 flex-1">
                            <h2 className="text-[15px] font-semibold leading-tight">Copilot</h2>
                            <p className="text-xs text-white/80 truncate">Orders, sales, menu and store</p>
                        </div>
                        <button
                            onClick={() => {
                                setMessages([GREETING]);
                                setInput('');
                            }}
                            disabled={loading || messages.length <= 1}
                            aria-label="Start a new chat"
                            title="New chat"
                            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/15 disabled:opacity-40 disabled:hover:bg-transparent focus-visible:outline-2 focus-visible:outline-white"
                        >
                            <Icon d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5" size={16} />
                        </button>

                        <button
                            onClick={() => setExpanded((v) => !v)}
                            aria-label={expanded ? 'Make the chat smaller' : 'Make the chat larger'}
                            title={expanded ? 'Smaller' : 'Larger'}
                            className="hidden sm:flex w-8 h-8 rounded-lg items-center justify-center hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-white"
                        >
                            <Icon d={expanded ? 'M9 4v5H4M15 20v-5h5M4 9l6-6M20 15l-6 6' : 'M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7'} size={16} />
                        </button>
                        <button
                            onClick={() => setIsOpen(false)}
                            aria-label="Close chat"
                            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-white"
                        >
                            <Icon d="M6 18L18 6M6 6l12 12" size={18} />
                        </button>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto px-3.5 py-4 space-y-3" role="log" aria-live="polite">
                        {messages.map((msg, i) => (
                            <div key={i} className="space-y-2">
                                <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div
                                        className={`max-w-[88%] px-3.5 py-2.5 text-[14px] leading-relaxed motion-safe:animate-fade-in ${
                                            msg.role === 'user' ? 'text-white rounded-xl rounded-br-sm' : 'rounded-xl rounded-bl-sm border'
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
                                                className="mt-2 block text-xs font-semibold underline underline-offset-2 disabled:opacity-50 text-indigo-600 dark:text-indigo-300"
                                            >
                                                Try again
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {msg.role === 'assistant' && msg.blocks && msg.blocks.length > 0 && <BlocksView blocks={msg.blocks} />}
                            </div>
                        ))}

                        {loading && (
                            <div className="flex justify-start" aria-label="Copilot is typing">
                                <div className="px-4 py-3 rounded-xl rounded-bl-sm border flex items-center gap-1.5" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
                                    {[0, 150, 300].map((d) => (
                                        <span key={d} className="w-1.5 h-1.5 rounded-full motion-safe:animate-bounce" style={{ background: ACCENT, animationDelay: `${d}ms` }} />
                                    ))}
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
                                    className="flex-shrink-0 text-[13px] font-medium px-3.5 py-2 rounded-lg border transition-colors active:scale-95 hover:bg-indigo-500/10"
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
                            className="flex items-center gap-2 rounded-xl border pl-4 pr-2 py-2 focus-within:ring-2 focus-within:ring-indigo-500/50"
                            style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
                        >
                            <input
                                ref={inputRef}
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder={listening ? "Listening… speak in English or Hinglish" : "Ask about orders, sales or menu"}
                                aria-label="Message Copilot"
                                disabled={loading}
                                className="flex-1 min-w-0 bg-transparent text-[15px] outline-none placeholder:text-gray-400 disabled:opacity-60"
                                style={{ color: 'var(--color-text-main)' }}
                            />
                            <VoiceInput value={input} onChange={setInput} disabled={loading} accent={ACCENT} onListening={setListening} onError={setVoiceError} />
                            <button
                                onClick={() => sendMessage()}
                                disabled={!input.trim() || loading}
                                aria-label="Send message"
                                className="w-10 h-10 rounded-lg flex items-center justify-center text-white transition-transform active:scale-95 disabled:opacity-30 flex-shrink-0"
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
