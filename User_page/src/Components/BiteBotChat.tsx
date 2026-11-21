import { useState, useRef, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../Util/store';
import api from '../Util/api';
import { BlocksView, blocksToHistoryNote } from './BiteBotCards';
import type { UiBlock } from './BiteBotCards';
import ChatText from './ChatText';

interface Message {
  role: 'user' | 'assistant';
  text: string;
  timestamp: Date;
  blocks?: UiBlock[];
  suggestions?: string[];
  isError?: boolean;
  retryText?: string;
}

const QUICK_PROMPTS = [
  'Which canteens are open?',
  'Meals under ₹100',
  'Track my latest order',
  'Show my favourites',
  'Order my usual again',
];

const BRAND = '#ea580c';

const greeting = (name?: string): Message => ({
  role: 'assistant',
  text: `Hi ${name ? name.split(' ')[0] : 'there'}, I'm BiteBot.\nI can find open canteens and menus, suggest meals for your budget, reorder your usual, and track your orders. You confirm before anything is placed.`,
  timestamp: new Date(),
});

function Icon({ d, size = 18 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

export default function BiteBotChat() {
  const [isOpen, setIsOpen] = useState(false);
  const isAuthenticated = useSelector((s: RootState) => s.User.isAuthenticated);
  const userName = useSelector((s: RootState) => s.User.user?.name);

  const [messages, setMessages] = useState<Message[]>(() => [greeting(userName)]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
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

  const sendMessage = async (textToSend?: string) => {
    const msg = (textToSend ?? input).trim();
    if (!msg || loading) return;

    if (!isAuthenticated) {
      setMessages((prev) => [
        ...prev,
        { role: 'user', text: msg, timestamp: new Date() },
        { role: 'assistant', text: 'Sign in to your student account to chat with BiteBot.', timestamp: new Date() },
      ]);
      setInput('');
      return;
    }

    setMessages((prev) => [...prev, { role: 'user', text: msg, timestamp: new Date() }]);
    setInput('');
    setLoading(true);

    try {
      const history = messages
        .filter((m, i) => i > 0 && !m.isError)
        .map((m) => ({
          role: m.role === 'user' ? 'user' : 'model',
          // hidden note lists the cards shown, so "add the first one" can be understood
          text: m.text + blocksToHistoryNote(m.blocks),
        }));

      // AI replies can take a while (model + tool-call loop), so allow more than the default 15s
      const { data } = await api.post('/bitebot/chat', { message: msg, history }, { timeout: 60000 });

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
      const errorText = err.response?.data?.message || 'Could not reach BiteBot. Check your connection and try again.';
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
      ? QUICK_PROMPTS
      : last.role === 'assistant' && !last.isError
        ? (last.suggestions ?? [])
        : [];

  return (
    <>
      {/* Launcher */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label={isOpen ? 'Close BiteBot' : 'Open BiteBot, your food assistant'}
        aria-expanded={isOpen}
        className="fixed bottom-5 right-5 z-50 h-14 w-14 rounded-full text-white shadow-lg flex items-center justify-center transition-transform duration-150 hover:scale-105 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        style={{ background: BRAND, outlineColor: BRAND }}
      >
        {isOpen ? (
          <Icon d="M6 18L18 6M6 6l12 12" size={22} />
        ) : (
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 11h18a0 0 0 0 1 0 0 9 9 0 0 1-18 0 0 0 0 0 1 0 0z" />
            <path d="M8 7c0-1.5 1-2 1-3.5M12 7c0-1.5 1-2 1-3.5M16 7c0-1.5 1-2 1-3.5" />
          </svg>
        )}
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-label="BiteBot chat"
          className="fixed z-50 inset-0 sm:inset-auto sm:bottom-24 sm:right-5 sm:w-[400px] sm:h-[min(660px,calc(100vh-7rem))] flex flex-col overflow-hidden sm:rounded-2xl sm:border shadow-2xl"
          style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)' }}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 text-white flex-shrink-0" style={{ background: BRAND }}>
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 11h18a9 9 0 0 1-18 0z" />
                <path d="M8 7c0-1.5 1-2 1-3.5M12 7c0-1.5 1-2 1-3.5M16 7c0-1.5 1-2 1-3.5" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-[15px] font-semibold leading-tight">BiteBot</h2>
              <p className="text-xs text-white/80 truncate">Menus, orders and picks</p>
            </div>
            <button
              onClick={() => {
                setMessages([greeting(userName)]);
                setInput('');
              }}
              disabled={loading || messages.length <= 1}
              aria-label="Start a new chat"
              title="New chat"
              className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/15 disabled:opacity-40 disabled:hover:bg-transparent focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
            >
              <Icon d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5" size={16} />
            </button>
            <button
              onClick={() => setIsOpen(false)}
              aria-label="Close chat"
              className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
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
                    className={`max-w-[88%] px-3.5 py-2.5 text-[13.5px] leading-relaxed motion-safe:animate-fade-in ${
                      msg.role === 'user'
                        ? 'text-white rounded-2xl rounded-br-md'
                        : 'rounded-2xl rounded-bl-md border'
                    }`}
                    style={
                      msg.role === 'user'
                        ? { background: BRAND }
                        : msg.isError
                          ? { backgroundColor: 'rgba(239,68,68,0.10)', borderColor: 'rgba(239,68,68,0.35)', color: 'var(--text-main)' }
                          : { backgroundColor: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-main)' }
                    }
                  >
                    {msg.role === 'user' ? <span className="whitespace-pre-wrap break-words">{msg.text}</span> : <ChatText text={msg.text} />}
                    {msg.isError && msg.retryText && (
                      <button
                        onClick={() => sendMessage(msg.retryText)}
                        disabled={loading}
                        className="mt-2 block text-xs font-semibold underline underline-offset-2 disabled:opacity-50"
                        style={{ color: BRAND }}
                      >
                        Try again
                      </button>
                    )}
                  </div>
                </div>

                {msg.role === 'assistant' && msg.blocks && msg.blocks.length > 0 && (
                  <BlocksView blocks={msg.blocks} onAsk={sendMessage} onClose={() => setIsOpen(false)} />
                )}
              </div>
            ))}

            {loading && (
              <div className="flex justify-start" aria-label="BiteBot is typing">
                <div className="px-4 py-3 rounded-2xl rounded-bl-md border flex items-center gap-1.5" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
                  {[0, 150, 300].map((d) => (
                    <span key={d} className="w-1.5 h-1.5 rounded-full motion-safe:animate-bounce" style={{ background: BRAND, animationDelay: `${d}ms` }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Suggestions: one scrolling row so they never push the conversation up */}
          {dockChips.length > 0 && (
            <div className="flex gap-2 overflow-x-auto no-scrollbar px-3.5 pt-2 pb-1 flex-shrink-0" aria-label="Suggested replies">
              {dockChips.map((s) => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  className="flex-shrink-0 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors active:scale-95 hover:bg-orange-500/10"
                  style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)', color: 'var(--text-main)' }}
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="px-3.5 pt-2 pb-3 flex-shrink-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <div
              className="flex items-center gap-2 rounded-full border pl-4 pr-1.5 py-1.5 focus-within:ring-2 focus-within:ring-orange-500/50"
              style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
            >
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about food, canteens or orders"
                aria-label="Message BiteBot"
                disabled={loading}
                className="flex-1 min-w-0 bg-transparent text-sm outline-none placeholder:text-gray-400 disabled:opacity-60"
                style={{ color: 'var(--text-main)' }}
              />
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || loading}
                aria-label="Send message"
                className="w-9 h-9 rounded-full flex items-center justify-center text-white transition-transform active:scale-95 disabled:opacity-30 flex-shrink-0"
                style={{ background: BRAND }}
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
