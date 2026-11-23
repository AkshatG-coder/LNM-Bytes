// Opening-hours helpers for the settings page. Pure functions, no network.
// The rules mirror the order check in the backend (Order_Controller), which compares IST "HH:MM" strings.

export function fmt12(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

/** True when closing time is earlier than opening time (the shop stays open past midnight). */
export function isOvernight(open: string, close: string): boolean {
  return close < open;
}

/** Whole and half hours the shop is open per day, e.g. 14 or 14.5. */
export function openHours(open: string, close: string): number {
  let diff = toMin(close) - toMin(open);
  if (diff <= 0) diff += 24 * 60;
  return Math.round((diff / 60) * 2) / 2;
}

/** Current time in India as "HH:MM", independent of the browser's timezone. */
export function nowIST(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date);
  const h = parts.find(p => p.type === 'hour')?.value ?? '00';
  const m = parts.find(p => p.type === 'minute')?.value ?? '00';
  return `${h}:${m}`;
}

export function isWithinHours(open: string, close: string, now: string): boolean {
  return close < open ? now >= open || now <= close : now >= open && now <= close;
}

export type ShopState = {
  kind: 'open' | 'outside_hours' | 'app_paused' | 'closed';
  headline: string;
  detail: string;
};

/**
 * What students can actually do right now. Two things have to line up: the owner's open/closed
 * switch and the opening hours (night-delivery orders are the one exception to the hours check).
 */
export function shopState(
  s: { status: 'open' | 'closed'; isOnlineOrderAvailable: boolean; nightDelivery: boolean },
  hours: { open: string; close: string },
  now: string,
): ShopState {
  if (s.status === 'closed') {
    return { kind: 'closed', headline: 'Shop is closed', detail: 'You switched the shop off, so nobody can place a new order.' };
  }
  if (!s.isOnlineOrderAvailable) {
    return { kind: 'app_paused', headline: 'Shop is open, app orders are paused', detail: 'Students can see your menu but can not order through the app.' };
  }
  if (!isWithinHours(hours.open, hours.close, now)) {
    return {
      kind: 'outside_hours',
      headline: 'Shop is open, but outside your hours',
      detail: `Students can order again at ${fmt12(hours.open)}${s.nightDelivery ? ', or now as night delivery' : ''}.`,
    };
  }
  return { kind: 'open', headline: 'Shop is open', detail: 'Students can browse and order right now.' };
}
