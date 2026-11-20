import { useState, useRef, useEffect, useCallback } from 'react';
import api from '../hooks/api';

interface Message {
    role: 'user' | 'assistant';
    text: string;
    timestamp: Date;
}

const SUGGESTIONS = [
    "Aaj ki sales kya hai?",
    "Kitne pending orders hain?",
    "Menu dikha do",
    "Dukaan band kardo",
];

export default function CopilotChat() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        {
            role: 'assistant',
            text: "Hey! 👋 Main tumhara Copilot hoon. Menu manage karna ho, sales dekhni ho, ya koi item band karna ho — bas bolo!",
            timestamp: new Date(),
        },
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [messages, scrollToBottom]);

    useEffect(() => {
        if (isOpen) inputRef.current?.focus();
    }, [isOpen]);

    const sendMessage = async (text?: string) => {
        const msg = text || input.trim();
        if (!msg || loading) return;

        const userMsg: Message = { role: 'user', text: msg, timestamp: new Date() };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setLoading(true);

        try {
            // Build history from prior messages (skip system greeting)
            const history = messages
                .filter((_, i) => i > 0) // skip initial greeting
                .map(m => ({ role: m.role === 'user' ? 'user' : 'model', text: m.text }));

            const { data } = await api.post('/copilot/chat', {
                message: msg,
                history,
            });

            const assistantMsg: Message = {
                role: 'assistant',
                text: data.message || "Kuch samajh nahi aaya, dobara try karo?",
                timestamp: new Date(),
            };
            setMessages(prev => [...prev, assistantMsg]);
        } catch (err: any) {
            const errorText = err.response?.data?.message || "Network error — backend check karo.";
            setMessages(prev => [
                ...prev,
                { role: 'assistant', text: `⚠️ ${errorText}`, timestamp: new Date() },
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

    return (
        <>
            {/* Floating button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95"
                style={{
                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    color: 'white',
                }}
                title="AI Copilot"
            >
                {isOpen ? (
                    <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                ) : (
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.48 2 2 6.48 2 12c0 1.85.5 3.58 1.37 5.07L2 22l4.93-1.37A9.95 9.95 0 0012 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm-1 14h-1.5v-1.5H11V16zm2.07-4.75l-.9.92c-.5.51-.82.93-.97 1.42-.1.3-.15.63-.15.91H9.5c0-.5.08-.95.25-1.37.22-.54.62-1.07 1.05-1.5l1.24-1.26c.46-.44.68-1.1.55-1.76a1.99 1.99 0 00-1.56-1.55c-.82-.16-1.57.09-2.1.59-.37.36-.59.83-.65 1.35H6.73c.07-.97.47-1.83 1.14-2.49A4.03 4.03 0 0112 5.5c1.56 0 2.86.82 3.52 2.07.5.9.55 2.01.1 2.99-.3.65-.82 1.19-1.55 1.69z" />
                    </svg>
                )}
            </button>

            {/* Chat panel */}
            {isOpen && (
                <div
                    className="fixed bottom-24 right-6 z-50 w-[380px] max-w-[calc(100vw-2rem)] rounded-2xl shadow-2xl border overflow-hidden flex flex-col"
                    style={{
                        height: '520px',
                        backgroundColor: 'var(--color-surface)',
                        borderColor: 'var(--color-border)',
                    }}
                >
                    {/* Header */}
                    <div
                        className="px-5 py-4 flex items-center gap-3 border-b"
                        style={{
                            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                            borderColor: 'transparent',
                        }}
                    >
                        <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white text-lg">
                            🤖
                        </div>
                        <div>
                            <h3 className="text-white font-black text-sm tracking-tight">AI Copilot</h3>
                            <p className="text-white/70 text-[10px] font-bold">
                                Menu • Orders • Analytics • Store Control
                            </p>
                        </div>
                        <div className="ml-auto flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                            <span className="text-white/60 text-[10px] font-bold">Online</span>
                        </div>
                    </div>

                    {/* Messages */}
                    <div
                        className="flex-1 overflow-y-auto p-4 space-y-3"
                        style={{ backgroundColor: 'var(--color-background)' }}
                    >
                        {messages.map((msg, i) => (
                            <div
                                key={i}
                                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                <div
                                    className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm font-medium leading-relaxed whitespace-pre-wrap ${
                                        msg.role === 'user'
                                            ? 'rounded-br-md text-white'
                                            : 'rounded-bl-md border'
                                    }`}
                                    style={
                                        msg.role === 'user'
                                            ? { background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }
                                            : {
                                                  backgroundColor: 'var(--color-surface)',
                                                  borderColor: 'var(--color-border)',
                                                  color: 'var(--color-text-main)',
                                              }
                                    }
                                >
                                    {msg.text}
                                </div>
                            </div>
                        ))}

                        {loading && (
                            <div className="flex justify-start">
                                <div
                                    className="px-4 py-3 rounded-2xl rounded-bl-md border flex items-center gap-2"
                                    style={{
                                        backgroundColor: 'var(--color-surface)',
                                        borderColor: 'var(--color-border)',
                                    }}
                                >
                                    <span className="flex gap-1">
                                        <span className="w-2 h-2 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                                        <span className="w-2 h-2 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                                        <span className="w-2 h-2 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                                    </span>
                                    <span className="text-xs font-bold" style={{ color: 'var(--color-text-sub)' }}>
                                        Thinking...
                                    </span>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Quick suggestions — only show when no user messages sent */}
                    {messages.length <= 1 && (
                        <div className="px-4 pb-2 flex flex-wrap gap-1.5">
                            {SUGGESTIONS.map((s, i) => (
                                <button
                                    key={i}
                                    onClick={() => sendMessage(s)}
                                    className="text-xs px-3 py-1.5 rounded-full border font-bold transition-all hover:scale-105 active:scale-95"
                                    style={{
                                        borderColor: '#8b5cf6',
                                        color: '#8b5cf6',
                                        backgroundColor: 'rgba(139, 92, 246, 0.05)',
                                    }}
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Input */}
                    <div
                        className="px-4 py-3 border-t flex items-center gap-2"
                        style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
                    >
                        <input
                            ref={inputRef}
                            type="text"
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Type a message..."
                            disabled={loading}
                            className="flex-1 bg-transparent text-sm font-medium outline-none placeholder:text-gray-400 disabled:opacity-50"
                            style={{ color: 'var(--color-text-main)' }}
                        />
                        <button
                            onClick={() => sendMessage()}
                            disabled={!input.trim() || loading}
                            className="w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:scale-105 active:scale-95 disabled:opacity-30"
                            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
                        >
                            <svg width="18" height="18" fill="white" viewBox="0 0 24 24">
                                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                            </svg>
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
