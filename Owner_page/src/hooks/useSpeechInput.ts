import { useCallback, useEffect, useRef, useState } from 'react'

// Browser speech recognition (Chrome, Edge, Safari). Firefox has none, so the mic button hides there.
// "en-IN" understands Indian English and most Hinglish typed in Roman letters; "hi-IN" gives Devanagari.

export type VoiceLang = 'en-IN' | 'hi-IN'

interface RecognitionResult { 0: { transcript: string }; isFinal: boolean; length: number }
interface RecognitionEvent { results: ArrayLike<RecognitionResult> }
interface Recognition {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  onresult: ((e: RecognitionEvent) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}
type RecognitionCtor = new () => Recognition

const LANG_KEY = 'lnm:voiceLang'

function getCtor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor }
  return w.SpeechRecognition || w.webkitSpeechRecognition || null
}

export function voiceErrorMessage(code: string): string | null {
  switch (code) {
    case 'aborted': return null
    case 'not-allowed':
    case 'service-not-allowed': return 'Microphone access is blocked. Allow it in your browser settings to use voice.'
    case 'no-speech': return 'Did not catch that. Tap the mic and try again.'
    case 'audio-capture': return 'No microphone found.'
    case 'network': return 'Voice input needs an internet connection.'
    default: return 'Voice input stopped. Tap the mic to try again.'
  }
}

function readLang(): VoiceLang {
  try { return localStorage.getItem(LANG_KEY) === 'hi-IN' ? 'hi-IN' : 'en-IN' } catch { return 'en-IN' }
}

/** `onTranscript` gets the full text heard so far in this recording, and whether it is final. */
export function useSpeechInput(onTranscript: (text: string, isFinal: boolean) => void) {
  const [listening, setListening] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lang, setLang] = useState<VoiceLang>(readLang)
  const recRef = useRef<Recognition | null>(null)
  const cbRef = useRef(onTranscript)
  useEffect(() => { cbRef.current = onTranscript }, [onTranscript])

  const supported = getCtor() !== null

  const stop = useCallback(() => { recRef.current?.stop() }, [])

  const start = useCallback(() => {
    const Ctor = getCtor()
    if (!Ctor || recRef.current) return
    setError(null)
    const rec = new Ctor()
    rec.lang = lang
    rec.continuous = false
    rec.interimResults = true
    rec.maxAlternatives = 1
    rec.onresult = (e) => {
      let text = ''
      let isFinal = false
      for (let i = 0; i < e.results.length; i++) {
        text += e.results[i][0].transcript
        isFinal = e.results[i].isFinal
      }
      cbRef.current(text.trim(), isFinal)
    }
    rec.onerror = (e) => {
      setError(voiceErrorMessage(e.error))
      // Some browsers skip onend after an error, so do not leave the mic looking active
      recRef.current = null
      setListening(false)
    }
    rec.onend = () => { recRef.current = null; setListening(false) }
    recRef.current = rec
    try {
      rec.start()
      setListening(true)
    } catch {
      recRef.current = null
      setError('Voice input could not start. Try again.')
    }
  }, [lang])

  const toggleLang = useCallback(() => {
    setLang((l) => {
      const next: VoiceLang = l === 'en-IN' ? 'hi-IN' : 'en-IN'
      try { localStorage.setItem(LANG_KEY, next) } catch { /* private mode */ }
      return next
    })
  }, [])

  // Stop the microphone if the chat closes or the page changes
  useEffect(() => () => { recRef.current?.abort(); recRef.current = null }, [])

  return { supported, listening, error, lang, start, stop, toggleLang, clearError: () => setError(null) }
}
