import type { Env, Site } from '../types'
import { getSite } from '../lib/db'
import { verifyStripeSignature } from '../lib/stripe'
import { leadTable, sendAlerts, setLeadField, esc } from './lead'

// Stripe webhook (one endpoint for every site): https://<any site domain>/api/stripe-webhook
// Events used: checkout.session.completed (paid) and checkout.session.expired (abandoned, after 24 hours).

export async function handleStripeWebhook(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  if (!env.STRIPE_WEBHOOK_SECRET) return new Response('Stripe webhook secret not set', { status: 500 })
  const body = await req.text()
  const ok = await verifyStripeSignature(env.STRIPE_WEBHOOK_SECRET, req.headers.get('stripe-signature') || '', body)
  if (!ok) return new Response('Bad signature', { status: 400 })

  const ev = JSON.parse(body) as { type: string; data: { object: any } }
  const s = ev.data?.object
  const leadId = Number(s?.metadata?.lead_id)
  const siteId = Number(s?.metadata?.site_id)
  if (!leadId || !siteId || !['checkout.session.completed', 'checkout.session.expired'].includes(ev.type)) return Response.json({ ignored: true })

  const lead = await env.DB.prepare('SELECT id, form, page_path, name, email, fields FROM leads WHERE id = ? AND site_id = ?').bind(leadId, siteId).first<{
    id: number; form: string; page_path: string; name: string; email: string; fields: string
  }>()
  const site = await getSite(env, siteId)
  if (!lead || !site) return Response.json({ ignored: 'unknown lead' })
  const fields = JSON.parse(lead.fields || '{}') as Record<string, string>

  if (ev.type === 'checkout.session.completed') {
    if (s.payment_status !== 'paid') return Response.json({ waiting: s.payment_status })
    if (/^Paid/.test(fields.payment || '')) return Response.json({ already: true }) // Stripe can send an event twice
    const amount = `${(s.currency || 'gbp') === 'gbp' ? '£' : (s.currency || '').toUpperCase() + ' '}${((s.amount_total || 0) / 100).toLocaleString('en-GB', { minimumFractionDigits: 2 })}`
    fields.payment = `Paid ${amount} on ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC (Stripe ${s.payment_intent || s.id})`
    await setLeadField(env, lead.id, 'payment', fields.payment)
    await env.DB.prepare("UPDATE leads SET status = 'qualified' WHERE id = ? AND status = 'new'").bind(lead.id).run()
    alert(env, site, ctx, lead, fields, `💷 New paid order #${lead.id}: ${fields.store_name || lead.name} (${amount})`, `<p><b>New paid order</b> from ${esc(site.domain)}. Reply to this email to contact the customer.</p>`)
  } else {
    if (/^Paid/.test(fields.payment || '')) return Response.json({ already: true })
    fields.payment = 'Not paid: checkout abandoned'
    await setLeadField(env, lead.id, 'payment', fields.payment)
    alert(env, site, ctx, lead, fields, `Unpaid order #${lead.id}: ${fields.store_name || lead.name} (checkout abandoned)`, `<p>This customer started an order on ${esc(site.domain)} but didn't finish paying. Worth a follow-up: reply to this email to contact them.</p>`)
  }
  return Response.json({ ok: true })
}

function alert(env: Env, site: Site, ctx: ExecutionContext, lead: { id: number; form: string; email: string }, fields: Record<string, string>, subject: string, intro: string) {
  const def = site.settings.forms?.[lead.form]
  const to = def?.notify?.length ? def.notify : site.settings.notify_email ? [site.settings.notify_email] : []
  sendAlerts(env, site, ctx, lead.id, [{ to, who: 'site owner', subject, html: `${intro}${leadTable(def, fields)}` }].filter((m) => m.to.length), lead.email)
}
