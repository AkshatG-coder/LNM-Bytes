import { useEffect, useState } from 'react';
import { isAxiosError } from 'axios';
import api from '../hooks/api';

interface Settings {
  enabled: boolean;
  lastSentAt: string | null;
  email: string;
  emailConfigured: boolean;
}

type Notice = { kind: 'ok' | 'error'; text: string } | null;

function errorText(e: unknown, fallback: string): string {
  if (isAxiosError(e)) {
    const m = (e.response?.data as { message?: string } | undefined)?.message;
    if (m) return m;
  }
  return fallback;
}

/** Opt-in Monday email with last week's numbers. */
export default function WeeklyEmail() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [busy, setBusy] = useState<'toggle' | 'test' | null>(null);
  const [notice, setNotice] = useState<Notice>(null);

  useEffect(() => {
    let alive = true;
    api.get('/summary/settings')
      .then((res) => { if (alive && res.data?.success) setSettings(res.data.data as Settings); })
      .catch(() => { /* an older server has no email feature, so hide the card */ });
    return () => { alive = false; };
  }, []);

  if (!settings) return null;

  const toggle = async () => {
    setBusy('toggle');
    setNotice(null);
    try {
      const res = await api.put('/summary/settings', { enabled: !settings.enabled });
      setSettings(res.data.data as Settings);
      setNotice({ kind: 'ok', text: res.data.data.enabled ? 'Done. The first email arrives next Monday morning.' : 'Weekly email is off.' });
    } catch (e) {
      setNotice({ kind: 'error', text: errorText(e, 'Could not change this setting. Try again.') });
    } finally {
      setBusy(null);
    }
  };

  const sendTest = async () => {
    setBusy('test');
    setNotice(null);
    try {
      const res = await api.post('/summary/send-now', {}, { timeout: 30000 });
      setNotice({ kind: 'ok', text: res.data?.message || 'Sent.' });
    } catch (e) {
      setNotice({ kind: 'error', text: errorText(e, 'The email could not be sent. Try again.') });
    } finally {
      setBusy(null);
    }
  };

  const last = settings.lastSentAt
    ? new Date(settings.lastSentAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
    : null;

  return (
    <section className="mt-6 rounded-xl border p-5" aria-label="Weekly email"
      style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold" style={{ color: 'var(--color-text-main)' }}>Weekly email</h2>
          <p className="text-xs mt-1 max-w-md" style={{ color: 'var(--color-text-muted)' }}>
            Get last week's sales, best sellers and busiest times in your inbox every Monday at 8 am, sent to {settings.email}.
            {last && settings.enabled ? ` Last sent ${last}.` : ''}
          </p>
        </div>
        <button type="button" role="switch" aria-checked={settings.enabled} aria-label="Send me the weekly email"
          disabled={busy !== null || (!settings.enabled && !settings.emailConfigured)} onClick={toggle}
          className="relative shrink-0 w-11 h-6 rounded-full transition-colors disabled:opacity-50"
          style={{ backgroundColor: settings.enabled ? 'var(--color-primary)' : 'var(--color-border)' }}>
          <span className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform"
            style={{ transform: settings.enabled ? 'translateX(20px)' : 'none' }} />
        </button>
      </div>

      {!settings.emailConfigured && (
        <p className="text-xs mt-3 font-semibold" style={{ color: 'var(--viz-bad, #dc2626)' }}>
          Email is not set up on the server yet, so this cannot be turned on.
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" onClick={sendTest} disabled={busy !== null || !settings.emailConfigured}
          className="px-3 py-1.5 rounded-lg text-xs font-bold border disabled:opacity-50"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-main)' }}>
          {busy === 'test' ? 'Sending…' : 'Email me last week now'}
        </button>
        <span role="status" className="text-xs font-semibold"
          style={{ color: notice?.kind === 'error' ? 'var(--viz-bad, #dc2626)' : 'var(--color-text-muted)' }}>
          {notice?.text}
        </span>
      </div>
    </section>
  );
}
