// Keep in sync with Backend/src/utils/rejectReasons.ts
export const REJECT_REASON_TEXT: Record<string, string> = {
  out_of_stock: 'An item in your order is out of stock',
  too_busy: 'The kitchen is too busy right now',
  closing_soon: 'The canteen is closing soon',
  order_issue: 'There was a problem with the order',
  other: 'The canteen could not take this order',
}

export function rejectionLine(order: { rejectionReason?: string | null; rejectionNote?: string }): string | null {
  if (!order.rejectionReason && !order.rejectionNote) return null
  const base = REJECT_REASON_TEXT[order.rejectionReason ?? 'other'] ?? REJECT_REASON_TEXT.other
  return order.rejectionNote ? `${base} (${order.rejectionNote})` : base
}

/** Tells the alert watcher that an order was placed or changed, so it checks right away. */
export const ORDERS_CHANGED_EVENT = 'lnm:orders-changed'
export function announceOrdersChanged(): void {
  window.dispatchEvent(new Event(ORDERS_CHANGED_EVENT))
}
