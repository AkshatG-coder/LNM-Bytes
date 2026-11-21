import { useEffect, useRef } from 'react'
import { useSpeechInput } from '../Util/useSpeechInput'

interface Props {
  value: string
  onChange: (text: string) => void
  disabled?: boolean
  accent: string
  onListening?: (listening: boolean) => void
  onError?: (message: string | null) => void
}

/** Language chip and mic button for a chat input. The spoken text lands in the input so it can be edited before sending. */
export default function VoiceInput({ value, onChange, disabled, accent, onListening, onError }: Props) {
  const base = useRef('')
  const { supported, listening, error, lang, start, stop, toggleLang } = useSpeechInput((text) => {
    onChange(base.current ? `${base.current} ${text}` : text)
  })

  useEffect(() => { onListening?.(listening) }, [listening, onListening])
  useEffect(() => { onError?.(error) }, [error, onError])

  if (!supported) return null

  const toggle = () => {
    if (listening) { stop(); return }
    base.current = value.trim()
    start()
  }

  return (
    <>
      <button
        type="button"
        onClick={toggleLang}
        disabled={listening}
        aria-label={lang === 'en-IN' ? 'Voice language: English or Hinglish. Switch to Hindi' : 'Voice language: Hindi. Switch to English or Hinglish'}
        title={lang === 'en-IN' ? 'English / Hinglish' : 'हिन्दी'}
        className="h-8 px-2 rounded-md text-[11px] font-bold border flex-shrink-0 disabled:opacity-40"
        style={{ borderColor: 'var(--border, var(--color-border))', color: 'var(--text-muted, var(--color-text-muted))' }}
      >
        {lang === 'en-IN' ? 'EN' : 'हिं'}
      </button>
      <button
        type="button"
        onClick={toggle}
        disabled={disabled}
        aria-pressed={listening}
        aria-label={listening ? 'Stop voice input' : 'Speak your message'}
        className={`w-10 h-10 rounded-lg flex items-center justify-center transition-transform active:scale-95 disabled:opacity-30 flex-shrink-0 ${listening ? 'animate-pulse' : ''}`}
        style={listening
          ? { background: '#dc2626', color: 'white' }
          : { border: `1px solid ${accent}55`, color: accent }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z" />
          <path d="M19 11a7 7 0 0 1-14 0" />
          <path d="M12 18v3" />
        </svg>
      </button>
    </>
  )
}
