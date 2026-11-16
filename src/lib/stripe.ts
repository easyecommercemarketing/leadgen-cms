import type { Env } from '../types'

// Minimal Stripe Checkout client (no SDK: two REST calls and a signature check).

const api = (env: Env) => (env.STRIPE_API || 'https://api.stripe.com').replace(/\/$/, '')

function form(obj: Record<string, string | number | undefined>) {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(obj)) if (v !== undefined && v !== '') p.append(k, String(v))
  return p
}

export type CheckoutInput = {
  currency: string // "gbp"
  lines: { name: string; amount: number }[] // amounts in pounds
  email?: string
  leadId: number
  siteId: number
  description: string
  successUrl: string
  cancelUrl: string
}

export async function createCheckout(env: Env, c: CheckoutInput): Promise<{ id: string; url: string }> {
  const params: Record<string, string | number | undefined> = {
    mode: 'payment',
    customer_email: c.email,
    client_reference_id: String(c.leadId),
    'metadata[lead_id]': c.leadId,
    'metadata[site_id]': c.siteId,
    'payment_intent_data[description]': c.description.slice(0, 1000),
    'payment_intent_data[metadata][lead_id]': c.leadId,
    success_url: c.successUrl,
    cancel_url: c.cancelUrl,
  }
  c.lines
    .filter((l) => Math.round(l.amount * 100) > 0)
    .forEach((l, i) => {
      params[`line_items[${i}][quantity]`] = 1
      params[`line_items[${i}][price_data][currency]`] = c.currency
      params[`line_items[${i}][price_data][unit_amount]`] = Math.round(l.amount * 100)
      params[`line_items[${i}][price_data][product_data][name]`] = l.name.slice(0, 250)
    })
  const r = await fetch(`${api(env)}/v1/checkout/sessions`, {
    method: 'POST',
    headers: { authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, 'content-type': 'application/x-www-form-urlencoded', 'idempotency-key': `lead-${c.siteId}-${c.leadId}` },
    body: form(params),
  })
  const j = (await r.json()) as any
  if (!r.ok || !j.url) throw new Error(`Stripe ${r.status}: ${j?.error?.message || 'no checkout url'}`)
  return { id: j.id, url: j.url }
}

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')

/** Checks the Stripe-Signature header (HMAC-SHA256 of "<t>.<body>" with the webhook secret). */
export async function verifyStripeSignature(secret: string, header: string, body: string, toleranceSec = 300) {
  const parts = Object.fromEntries(header.split(',').map((kv) => kv.split('=') as [string, string]).filter((kv) => kv[0] === 't'))
  const t = Number(parts.t)
  const sigs = header
    .split(',')
    .filter((kv) => kv.startsWith('v1='))
    .map((kv) => kv.slice(3))
  if (!t || !sigs.length) return false
  if (Math.abs(Date.now() / 1000 - t) > toleranceSec) return false
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const expected = hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${t}.${body}`)))
  return sigs.some((s) => s.length === expected.length && timingSafeEqual(s, expected))
}

function timingSafeEqual(a: string, b: string) {
  let d = 0
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return d === 0
}
