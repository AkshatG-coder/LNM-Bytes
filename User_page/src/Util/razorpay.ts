import api from './api'

export interface RazorpayInfo {
  keyId: string
  orderId: string
  amount: number
  currency: string
  storeName?: string
  prefill?: { name?: string; email?: string; contact?: string }
}

type Outcome = 'paid' | 'dismissed' | 'failed'

let loading: Promise<boolean> | null = null
function loadCheckout(): Promise<boolean> {
  if ((window as any).Razorpay) return Promise.resolve(true)
  if (loading) return loading
  loading = new Promise((resolve) => {
    const s = document.createElement('script')
    s.src = 'https://checkout.razorpay.com/v1/checkout.js'
    s.onload = () => resolve(true)
    s.onerror = () => { loading = null; resolve(false) }
    document.body.appendChild(s)
  })
  return loading
}

/**
 * Opens Razorpay Checkout for an order the server created, then asks the server to verify
 * the signature. Resolves 'paid' only after the server confirmed it.
 */
export async function payWithRazorpay(dbOrderId: string, info: RazorpayInfo): Promise<Outcome> {
  if (!(await loadCheckout())) throw new Error('Payment could not load. Check your connection and try again.')
  return new Promise<Outcome>((resolve) => {
    const rzp = new (window as any).Razorpay({
      key: info.keyId,
      order_id: info.orderId,
      amount: info.amount,
      currency: info.currency || 'INR',
      name: 'LNM Bytes',
      description: info.storeName ? `Order from ${info.storeName}` : 'Canteen order',
      prefill: info.prefill,
      theme: { color: '#F5B400' },
      modal: { ondismiss: () => resolve('dismissed') },
      handler: async (resp: { razorpay_payment_id: string; razorpay_signature: string }) => {
        try {
          const r = await api.post(`/order/verify-payment/${dbOrderId}`, {
            razorpay_payment_id: resp.razorpay_payment_id,
            razorpay_signature: resp.razorpay_signature,
          })
          resolve(r.data?.success ? 'paid' : 'failed')
        } catch {
          resolve('failed')
        }
      },
    })
    rzp.on('payment.failed', () => { /* user can retry inside the modal */ })
    rzp.open()
  })
}
