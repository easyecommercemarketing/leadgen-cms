import type { Env, FormDef, Site } from '../types'
import { buyersForArea, emailsOf, resolveArea } from '../lib/routing'

const MAX_FIELD = 5000

async function verifyTurnstile(env: Env, token: string, ip: string | null): Promise<boolean> {
  const body = new FormData()
  body.append('secret', env.TURNSTILE_SECRET!)
  body.append('response', token)
  if (ip) body.append('remoteip', ip)
  const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body })
  const j = (await r.json()) as { success: boolean }
  return !!j.success
}

function back(req: Request, path: string, params: Record<string, string>) {
  const u = new URL(path, req.url)
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v)
  return Response.redirect(u.toString(), 303)
}

function wantsJson(req: Request) {
  return (req.headers.get('accept') || '').includes('application/json')
}

export async function handleLead(req: Request, env: Env, site: Site, ctx: ExecutionContext): Promise<Response> {
  const form = await req.formData()
  const formKey = String(form.get('_form') || 'contact')
  const page = String(form.get('_page') || '/')
  const def = site.settings.forms?.[formKey]
  if (!def) return new Response('Unknown form', { status: 400 })
  const success = def.success_path || '/thank-you'

  // Bots fill the hidden honeypot. Pretend it worked so they don't retry.
  if (String(form.get('_hp') || '')) return wantsJson(req) ? Response.json({ ok: true }) : back(req, success, {})

  if (env.TURNSTILE_SECRET && site.settings.turnstile_sitekey) {
    const ok = await verifyTurnstile(env, String(form.get('cf-turnstile-response') || ''), req.headers.get('cf-connecting-ip'))
    if (!ok) return wantsJson(req) ? Response.json({ ok: false, error: 'spam check failed' }, { status: 400 }) : back(req, page, { error: 'spam' })
  }

  const fields: Record<string, string> = {}
  const missing: string[] = []
  for (const f of def.fields) {
    const v = String(form.get(f.name) ?? '').trim().slice(0, MAX_FIELD)
    if (f.required && !v) missing.push(f.label)
    if (v) fields[f.name] = v
  }
  if (form.get('_consent')) fields._consent = 'yes'
  if (missing.length) {
    return wantsJson(req)
      ? Response.json({ ok: false, error: `Missing: ${missing.join(', ')}` }, { status: 400 })
      : back(req, page, { error: 'missing' })
  }

  // Pull the common contact fields out into their own columns for the dashboard
  const pick = (...names: string[]) => {
    for (const n of names) for (const [k, v] of Object.entries(fields)) if (k.toLowerCase().includes(n)) return v
    return ''
  }
  const first = fields.first_name || ''
  const last = fields.last_name || ''
  const name = (first || last ? `${first} ${last}` : pick('name')).trim()
  const email = pick('email')
  const phone = pick('phone', 'tel', 'mobile')

  const referrer = req.headers.get('referer') || ''
  const utm: Record<string, string> = {}
  try {
    const ru = new URL(referrer)
    for (const [k, v] of ru.searchParams) if (/^(utm_|gclid|fbclid|msclkid)/.test(k)) utm[k] = v
  } catch {}
  const country = ((req as any).cf?.country as string) || ''

  // Lead routing: forms with "route": true are sent to whichever buyer owns the matched location
  const area = def.route ? await resolveArea(env, site, page, String(form.get('_area') || ''), fields) : ''
  const buyers = def.route ? await buyersForArea(env, site.id, area) : []
  const routed = buyers.map((b) => ({ buyer_id: b.id, name: b.business || b.name, email: b.email }))
  const sold = routed.length > 0

  const res = await env.DB.prepare(
    `INSERT INTO leads (site_id, form, page_path, name, email, phone, fields, country, referrer, utm, area, routed_to, status, buyer)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
  )
    .bind(
      site.id, formKey, page, name, email, phone, JSON.stringify(fields), country, referrer, JSON.stringify(utm),
      area, JSON.stringify(routed), sold ? 'sold' : 'new', routed.map((r) => r.name).join(', '),
    )
    .first<{ id: number }>()
  const id = res?.id

  const areaName = area ? await areaLabel(env, site.id, area) : ''
  const rows = Object.entries(fields)
    .filter(([k]) => !k.startsWith('_'))
    .map(([k, v]) => `<tr><td style="padding:6px 12px;color:#666;vertical-align:top">${esc(label(def, k))}</td><td style="padding:6px 12px">${esc(v).replace(/\n/g, '<br>')}</td></tr>`)
    .join('')
  const table = `<table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px">${rows}</table>`

  const sends: { to: string[]; subject: string; html: string; who: string }[] = []

  // 1. each matched buyer gets the lead under their own subject line
  for (const b of buyers) {
    const to = emailsOf(b)
    if (!to.length) {
      console.error(`lead #${id}: buyer #${b.id} (${b.name}) has no valid email`)
      continue
    }
    sends.push({
      to,
      who: `buyer ${b.business || b.name}`,
      subject: `New enquiry${areaName ? ` in ${areaName}` : ''} – ${name || 'website visitor'}`,
      html: `<p>Hi ${esc(b.name.split(' ')[0] || b.name)},</p><p>You have a new enquiry from <b>${esc(site.name)}</b>${
        areaName ? ` for <b>${esc(areaName)}</b>` : ''
      }. Reply to this email to contact them directly.</p>${table}<p style="color:#888;font-size:12px">Lead #${id}</p>`,
    })
  }

  // 2. the site owner gets a copy (or the only copy when nobody bought this area)
  const admin = def.notify?.length ? def.notify : site.settings.notify_email ? [site.settings.notify_email] : []
  const copyAdmin = site.settings.routing?.copy_admin !== false
  if (admin.length && (!sold || copyAdmin)) {
    const routedNote = sold
      ? `<p>Sent to: <b>${esc(routed.map((r) => `${r.name} <${r.email}>`).join(', '))}</b></p>`
      : def.route
        ? `<p>${area ? `No active buyer for <b>${esc(areaName || area)}</b>.` : 'No location matched.'} This lead is unsold.</p>`
        : ''
    sends.push({
      to: admin,
      who: 'site owner',
      subject: `${sold ? '[Sold] ' : ''}New ${formKey} lead #${id}${areaName ? ` (${areaName})` : ''} – ${site.name}`,
      html: `<p>New lead from <b>${esc(site.domain)}${esc(page)}</b></p>${routedNote}${table}`,
    })
  }

  if (!env.RESEND_API_KEY) console.log(`lead #${id}: no alert sent (RESEND_API_KEY secret not set)`)
  else if (!site.settings.email_from) console.log(`lead #${id}: no alert sent (no email_from in site settings)`)
  else if (!sends.length) console.log(`lead #${id}: no alert sent (no notify_email in site settings and no buyer)`)
  else
    for (const m of sends)
      ctx.waitUntil(
        fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
          body: JSON.stringify({ from: site.settings.email_from, to: m.to, reply_to: email || undefined, subject: m.subject, html: m.html }),
        })
          .then(async (r) => {
            const body = await r.text()
            if (r.ok) console.log(`lead #${id}: alert sent to ${m.who} (${m.to.join(', ')})`)
            else console.error(`lead #${id}: Resend rejected the alert to ${m.who} (${r.status}): ${body.slice(0, 500)}`)
          })
          .catch((e) => console.error(`lead #${id}: could not reach Resend: ${e}`)),
      )

  return wantsJson(req) ? Response.json({ ok: true, id }) : back(req, success, {})
}

function esc(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
}

function label(def: FormDef, key: string) {
  return def.fields.find((f) => f.name === key)?.label || key.replace(/_/g, ' ')
}

async function areaLabel(env: Env, siteId: number, path: string) {
  const r = await env.DB.prepare("SELECT json_extract(data, '$.town') town, h1 FROM content WHERE site_id = ? AND path = ?")
    .bind(siteId, path)
    .first<{ town: string | null; h1: string }>()
  return r?.town || r?.h1 || path
}
