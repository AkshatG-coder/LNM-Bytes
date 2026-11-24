// Draws the shareable Wrapped poster on a canvas and hands it to the share sheet (or downloads it).

export interface WrappedData {
  ready: boolean
  needed: number
  firstName: string
  period: { id: string; label: string }
  orders: number
  items: number
  spent: number
  avgOrder: number
  biggestOrder: number
  activeDays: number
  longestStreak: number
  busiestWeekday: string | null
  uniqueItems: number
  nightDeliveries: number
  topItems: { name: string; qty: number }[]
  topStoreName: string | null
  topStoreOrders: number
  persona: { id: string; title: string; line: string; share: number } | null
  topPercent: number | null
}

const INK = '#121B2E'
const HALDI = '#F5B400'
const W = 1080
const H = 1350

export const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString('en-IN')} ${n === 1 ? one : many}`
export const rupees = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`

function fit(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text
  let t = text
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1)
  return `${t}…`
}

/** Notched ticket outline, the same shape as the app logo. */
function ticket(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, notchY: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, notchY - 28)
  ctx.arc(x + w, notchY, 28, -Math.PI / 2, Math.PI / 2, true)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, notchY + 28)
  ctx.arc(x, notchY, 28, Math.PI / 2, -Math.PI / 2, true)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

export async function drawWrappedCard(d: WrappedData): Promise<Blob> {
  try {
    await Promise.all([
      document.fonts.load('800 80px "Bricolage Grotesque"'),
      document.fonts.load('600 32px "Figtree"'),
    ])
  } catch { /* fall back to the system font */ }

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  const display = '"Bricolage Grotesque", "Segoe UI", system-ui, sans-serif'
  const body = '"Figtree", "Segoe UI", system-ui, sans-serif'

  ctx.fillStyle = INK
  ctx.fillRect(0, 0, W, H)

  // Haldi ticket
  ticket(ctx, 70, 70, W - 140, H - 140, 36, 330)
  ctx.fillStyle = HALDI
  ctx.fill()

  // Perforation between header and body
  ctx.strokeStyle = INK
  ctx.globalAlpha = 0.35
  ctx.lineWidth = 4
  ctx.setLineDash([14, 12])
  ctx.beginPath()
  ctx.moveTo(110, 330)
  ctx.lineTo(W - 110, 330)
  ctx.stroke()
  ctx.setLineDash([])
  ctx.globalAlpha = 1

  ctx.fillStyle = INK
  ctx.textBaseline = 'alphabetic'
  ctx.font = `800 40px ${display}`
  ctx.fillText('LNM BYTES  ·  WRAPPED', 120, 160)
  ctx.font = `600 34px ${body}`
  ctx.fillText(d.period.label, 120, 208)
  ctx.font = `800 64px ${display}`
  ctx.fillText(fit(ctx, `${d.firstName}'s semester`, W - 240), 120, 285)

  // Big number
  ctx.font = `800 230px ${display}`
  ctx.fillText(d.orders.toLocaleString('en-IN'), 120, 590)
  const numW = ctx.measureText(d.orders.toLocaleString('en-IN')).width
  ctx.font = `800 52px ${display}`
  ctx.fillText(d.orders === 1 ? 'order' : 'orders', 120 + numW + 28, 590)

  const rows: [string, string][] = []
  if (d.topItems[0]) rows.push(['Signature order', `${d.topItems[0].name} x${d.topItems[0].qty}`])
  if (d.persona) rows.push(['Eater type', d.persona.title.replace(/^The /, '')])
  if (d.topStoreName) rows.push(['Home canteen', d.topStoreName])
  rows.push(['Spent', rupees(d.spent)])
  // The poster has room for five lines: the rank if there is one, otherwise the streak
  if (d.topPercent !== null) rows.push(['Rank', `Top ${d.topPercent}% of users`])
  else if (d.longestStreak > 1) rows.push(['Longest streak', plural(d.longestStreak, 'day') + ' in a row'])

  let y = 672
  for (const [label, value] of rows.slice(0, 5)) {
    ctx.font = `700 28px ${body}`
    ctx.globalAlpha = 0.7
    ctx.fillText(label.toUpperCase(), 120, y)
    ctx.globalAlpha = 1
    ctx.font = `800 54px ${display}`
    ctx.fillText(fit(ctx, value, W - 240), 120, y + 56)
    y += 104
  }

  ctx.font = `700 30px ${body}`
  ctx.fillStyle = INK
  ctx.fillText('Get yours at lnmbytes.me', 120, H - 112)

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not draw the card'))), 'image/png'))
}

/** Opens the phone's share sheet with the poster; downloads it where sharing files is not supported. */
export async function shareWrapped(d: WrappedData): Promise<'shared' | 'downloaded'> {
  const blob = await drawWrappedCard(d)
  const file = new File([blob], 'lnm-bytes-wrapped.png', { type: 'image/png' })
  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean }

  if (nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: 'My LNM Bytes Wrapped', text: `${plural(d.orders, 'order')} this semester. What is yours?` })
      return 'shared'
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return 'shared' // the student closed the sheet
    }
  }

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'lnm-bytes-wrapped.png'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return 'downloaded'
}
