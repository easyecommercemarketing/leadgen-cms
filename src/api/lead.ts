import type { Env, Site } from '../types'

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

  const res = await env.DB.prepare(
    `INSERT INTO leads (site_id, form, page_path, name, email, phone, fields, country, referrer, utm)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
  )
    .bind(site.id, formKey, page, name, email, phone, JSON.stringify(fields), country, referrer, JSON.stringify(utm))
    .first<{ id: number }>()

  const notify = def.notify?.length ? def.notify : site.settings.notify_email ? [site.settings.notify_email] : []
  if (env.RESEND_API_KEY && notify.length && site.settings.email_from) {
    const rows = Object.entries(fields)
      .map(([k, v]) => `<tr><td style="padding:4px 10px;color:#666">${esc(k)}</td><td style="padding:4px 10px">${esc(v)}</td></tr>`)
      .join('')
    ctx.waitUntil(
      fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          from: site.settings.email_from,
          to: notify,
          reply_to: email || undefined,
          subject: `New ${formKey} lead #${res?.id} – ${site.name}`,
          html: `<p>New lead from <b>${esc(site.domain)}${esc(page)}</b></p><table>${rows}</table>`,
        }),
      }).catch(() => {}),
    )
  }

  return wantsJson(req) ? Response.json({ ok: true, id: res?.id }) : back(req, success, {})
}

function esc(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
}
