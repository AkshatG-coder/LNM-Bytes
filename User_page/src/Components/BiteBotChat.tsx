import { useState, useRef, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../Util/store';
import api from '../Util/api';

interface Message {
  role: 'user' | 'assistant';
  text: string;
  timestamp: Date;
}

const QUICK_PROMPTS = [
  "Konsi canteen open hai abhi? 🏪",
  "Kuch tasty under ₹100 batao! 🍔",
  "Mera latest order kahan hai? 📦",
  "Best cold coffee kahan milegi? ☕",
];

export default function BiteBotChat() {
  const [isOpen, setIsOpen] = useState(false);
  const isAuthenticated = useSelector((s: RootState) => s.User.isAuthenticated);
  const userName = useSelector((s: RootState) => s.User.user?.name);

  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      text: `Hey ${userName ? userName.split(' ')[0] : 'there'}! 👋 Main hoon BiteBot — LNMIIT campus food concierge 🍕\n\nCanteen timings, menu search, cheap cravings ya order tracking — kuch bhi pucho!`,
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
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  const sendMessage = async (textToSend?: string) => {
    const msg = textToSend || input.trim();
    if (!msg || loading) return;

    if (!isAuthenticated) {
      setMessages(prev => [
        ...prev,
        { role: 'user', text: msg, timestamp: new Date() },
        {
          role: 'assistant',
          text: 'BiteBot use karne ke liye pehle login kar lo please! 🔐',
          timestamp: new Date(),
        },
      ]);
      setInput('');
      return;
    }

    const userMsg: Message = { role: 'user', text: msg, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const history = messages
        .filter((_, i) => i > 0)
        .map(m => ({ role: m.role === 'user' ? 'user' : 'model', text: m.text }));

      const { data } = await api.post('/bitebot/chat', {
        message: msg,
        history,
      });

      const assistantMsg: Message = {
        role: 'assistant',
        text: data.message || "Kuch samajh nahi aaya, dobara try karo? 😅",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err: any) {
      const errorText =
        err.response?.data?.message ||
        "Network thoda slow hai — ek baar dobara try karo! 🙏";
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
      {/* Floating launcher button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Open BiteBot Food AI Assistant"
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95 group"
        style={{
          background: 'linear-gradient(135deg, #f97316, #ea580c)',
          color: 'white',
        }}
      >
        {isOpen ? (
          <svg
            width="24"
            height="24"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <div className="relative flex items-center justify-center">
            <span className="text-2xl select-none group-hover:rotate-12 transition-transform duration-200">
              🍕
            </span>
            <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-300 opacity-75" />
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-yellow-400 border-2 border-white" />
            </span>
          </div>
        )}
      </button>

      {/* Chat window panel */}
      {isOpen && (
        <div
          className="fixed bottom-24 right-4 sm:right-6 z-50 w-[380px] max-w-[calc(100vw-2rem)] rounded-2xl shadow-2xl border overflow-hidden flex flex-col animate-fade-in"
          style={{
            height: '520px',
            backgroundColor: 'var(--surface)',
            borderColor: 'var(--border)',
          }}
        >
          {/* Header */}
          <div
            className="px-5 py-4 flex items-center gap-3 border-b text-white"
            style={{
              background: 'linear-gradient(135deg, #f97316, #ea580c)',
              borderColor: 'transparent',
            }}
          >
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-xl shadow-inner">
              🍕
            </div>
            <div className="min-w-0">
              <h3 className="font-black text-sm tracking-tight flex items-center gap-1.5">
                BiteBot <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full font-bold">AI</span>
              </h3>
              <p className="text-white/80 text-[11px] font-medium truncate">
                Campus Food Assistant • LNMIIT
              </p>
            </div>
            <div className="ml-auto flex items-center gap-1.5 bg-white/10 px-2 py-1 rounded-full">
              <span className="w-2 h-2 rounded-full bg-green-300 animate-pulse" />
              <span className="text-white/90 text-[10px] font-bold">Online</span>
            </div>
          </div>

          {/* Messages list */}
          <div
            className="flex-1 overflow-y-auto p-4 space-y-3"
            style={{ backgroundColor: 'var(--bg)' }}
          >
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-medium leading-relaxed whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'rounded-br-md text-white'
                      : 'rounded-bl-md border shadow-sm'
                  }`}
                  style={
                    msg.role === 'user'
                      ? { background: 'linear-gradient(135deg, #f97316, #ea580c)' }
                      : {
                          backgroundColor: 'var(--surface)',
                          borderColor: 'var(--border)',
                          color: 'var(--text-main)',
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
                  className="px-4 py-3 rounded-2xl rounded-bl-md border flex items-center gap-2 shadow-sm"
                  style={{
                    backgroundColor: 'var(--surface)',
                    borderColor: 'var(--border)',
                  }}
                >
                  <span className="flex gap-1">
                    <span className="w-2 h-2 rounded-full bg-orange-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 rounded-full bg-orange-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 rounded-full bg-orange-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </span>
                  <span className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>
                    Finding best bites...
                  </span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick recommendation chips — shown when only greeting is in chat */}
          {messages.length <= 1 && (
            <div
              className="px-4 py-2 border-t flex flex-wrap gap-1.5"
              style={{
                borderColor: 'var(--border)',
                backgroundColor: 'var(--surface)',
              }}
            >
              {QUICK_PROMPTS.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => sendMessage(prompt)}
                  className="text-xs px-2.5 py-1.5 rounded-full border font-semibold transition-all hover:scale-105 active:scale-95 text-left"
                  style={{
                    borderColor: '#f97316',
                    color: '#ea580c',
                    backgroundColor: 'rgba(249, 115, 22, 0.08)',
                  }}
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}

          {/* Input form */}
          <div
            className="px-4 py-3 border-t flex items-center gap-2"
            style={{
              borderColor: 'var(--border)',
              backgroundColor: 'var(--surface)',
            }}
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask for food, stores, orders..."
              disabled={loading}
              className="flex-1 bg-transparent text-xs sm:text-sm font-medium outline-none placeholder:text-gray-400 disabled:opacity-50"
              style={{ color: 'var(--text-main)' }}
            />
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || loading}
              aria-label="Send message"
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:scale-105 active:scale-95 disabled:opacity-30 flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)' }}
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
