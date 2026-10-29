import { Hono } from 'hono'
import type { Env } from '../types'
import { bumpCache, getSite } from '../lib/db'
import type { Buyer } from '../lib/routing'
import { emailsOf } from '../lib/routing'
import { Admin, Field, page } from './ui'

type V = { Bindings: Env; Variables: { user: string } }
export const buyers = new Hono<V>()

type Loc = { path: string; town: string; owners: string | null }

async function locations(env: Env, siteId: number, exceptBuyer = 0): Promise<Loc[]> {
  const { results } = await env.DB.prepare(
    `SELECT c.path, COALESCE(json_extract(c.data, '$.town'), c.h1, c.path) town,
            (SELECT group_concat(COALESCE(NULLIF(b.business, ''), b.name), ', ') FROM buyer_areas a JOIN buyers b ON b.id = a.buyer_id
              WHERE a.path = c.path AND b.site_id = c.site_id AND b.active = 1 AND b.id != ?) owners
     FROM content c WHERE c.site_id = ? AND c.type = 'location' ORDER BY town`,
  )
    .bind(exceptBuyer, siteId)
    .all<Loc>()
  return results
}

// ---------------------------------------------------------------- list

buyers.get('/sites/:sid/buyers', async (c) => {
  const s = await getSite(c.env, Number(c.req.param('sid')))
  if (!s) return c.notFound()
  const { results } = await c.env.DB.prepare(
    `SELECT b.*,
            (SELECT COUNT(*) FROM buyer_areas a WHERE a.buyer_id = b.id) n_areas,
            (SELECT group_concat(COALESCE(json_extract(ct.data, '$.town'), a.path), ', ') FROM buyer_areas a
               LEFT JOIN content ct ON ct.site_id = b.site_id AND ct.path = a.path WHERE a.buyer_id = b.id) areas,
            (SELECT COUNT(*) FROM leads l WHERE l.site_id = b.site_id AND l.routed_to LIKE '%"buyer_id":' || b.id || ',%'
               AND l.created_at >= date('now','start of month')) leads_month,
            (SELECT COUNT(*) FROM leads l WHERE l.site_id = b.site_id AND l.routed_to LIKE '%"buyer_id":' || b.id || ',%') leads_all
     FROM buyers b WHERE b.site_id = ? ORDER BY b.active DESC, b.business, b.name`,
  )
    .bind(s.id)
    .all<Buyer & { n_areas: number; areas: string | null; leads_month: number; leads_all: number }>()
  const [locs, unsold] = await Promise.all([
    locations(c.env, s.id),
    c.env.DB.prepare("SELECT COUNT(*) n FROM leads WHERE site_id = ? AND status = 'new' AND area != '' AND created_at >= date('now','start of month')")
      .bind(s.id)
      .first<{ n: number }>(),
  ])
  const covered = locs.filter((l) => l.owners).length
  const mrr = results.filter((b) => b.active).reduce((t, b) => t + (b.monthly_price || 0), 0)
  return page(
    <Admin title="Buyers" site={s} active="buyers" user={c.get('user')} flash={c.req.query('saved') ? 'Saved.' : undefined}>
      <div class="bar">
        <h1>Lead buyers</h1>
        <a class="btn" href={`/sites/${s.id}/buyers/new`}>
          + Add buyer
        </a>
      </div>
      <div class="stats">
        <div class="panel">
          <b>{results.filter((b) => b.active).length}</b>
          <span>active buyers</span>
        </div>
        <div class="panel">
          <b>
            {covered} / {locs.length}
          </b>
          <span>locations sold</span>
        </div>
        <div class="panel">
          <b>£{mrr.toFixed(2)}</b>
          <span>per month</span>
        </div>
        <div class="panel">
          <b>{unsold?.n || 0}</b>
          <span>unsold leads this month</span>
        </div>
      </div>
      <p class="muted">
        Leads from a buyer's location pages, plus general enquiries whose county matches one of their county pages, are emailed to them and marked <b>sold</b>.
        Leads from locations nobody has bought come to you as normal.
      </p>
      <table class="tbl">
        <thead>
          <tr>
            <th>Buyer</th>
            <th>Locations</th>
            <th>£/month</th>
            <th>Leads (this month / all)</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {results.map((b) => (
            <tr>
              <td>
                <a href={`/sites/${s.id}/buyers/${b.id}`}>
                  <b>{b.business || b.name}</b>
                </a>
                <div class="muted">
                  {b.business ? `${b.name} · ` : ''}
                  {b.email}
                </div>
              </td>
              <td class="small">
                <b>{b.n_areas}</b>
                {b.areas ? ` · ${b.areas.length > 140 ? b.areas.slice(0, 140) + '…' : b.areas}` : ''}
              </td>
              <td>{b.monthly_price != null ? `£${Number(b.monthly_price).toFixed(2)}` : '—'}</td>
              <td>
                <a href={`/leads?site=${s.id}&buyer=${b.id}`}>
                  {b.leads_month} / {b.leads_all}
                </a>
              </td>
              <td>{b.active ? <span class="pill published">active</span> : <span class="pill draft">paused</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!results.length ? <p class="muted">No buyers yet. Every lead currently comes to you.</p> : null}
    </Admin>,
  )
})

// ---------------------------------------------------------------- edit

function BuyerForm(props: { sid: number; b?: Partial<Buyer>; areas: Set<string>; locs: Loc[]; forms: string[]; error?: string }) {
  const { b, locs, areas } = props
  return (
    <form method="post" class="form editor">
      {props.error ? <div class="flash err">{props.error}</div> : null}
      <div class="ed-main">
        <div class="grid2">
          <Field label="Contact name" name="name" value={b?.name} required />
          <Field label="Business name" name="business" value={b?.business} />
          <Field label="Email(s)" name="email" value={b?.email} required help="leads are sent here; separate several with commas" />
          <Field label="Phone" name="phone" value={b?.phone} />
        </div>
        <fieldset>
          <legend>Locations ({areas.size} selected)</legend>
          <p class="muted small">
            Tick every location page this buyer has paid for. Each location can only belong to one active buyer, so locations already sold to someone else are
            shown with their name and can't be selected. Pause or edit that buyer first to free them up.
          </p>
          <input type="search" placeholder="Filter locations…" class="loc-filter" data-target="loc-list" />
          <div class="loc-actions">
            <button type="button" class="link" data-check-all="loc-list">
              Select shown
            </button>{' '}
            ·{' '}
            <button type="button" class="link" data-check-none="loc-list">
              Clear shown
            </button>
          </div>
          <div class="loc-list" id="loc-list">
            {[...locs.filter((l) => areas.has(l.path)), ...locs.filter((l) => !areas.has(l.path))].map((l) => (
              <label class="chk" data-name={l.town.toLowerCase()}>
                <input type="checkbox" name="areas" value={l.path} checked={areas.has(l.path)} disabled={!!l.owners && !areas.has(l.path)} /> {l.town}
                {l.owners ? <span class="muted small"> · {l.owners}</span> : null}
              </label>
            ))}
          </div>
          {!locs.length ? <p class="muted">This site has no location pages yet.</p> : null}
        </fieldset>
        <fieldset>
          <legend>Listing on their location pages</legend>
          <label class="chk">
            <input type="checkbox" name="show_listing" value="1" checked={b?.show_listing !== 0} /> Show this buyer's details on their location pages
          </label>
          <div class="grid2">
            <Field label="Phone shown to visitors" name="public_phone" value={b?.public_phone} help="blank = not shown" />
            <Field label="Email shown to visitors" name="public_email" value={b?.public_email} help="blank = not shown" />
            <Field label="Website" name="website" value={b?.website} placeholder="https://" />
            <Field label="Logo" name="logo" value={b?.logo} help="a /media/… URL from Media" />
          </div>
          <Field label="Short intro" name="blurb" type="textarea" rows={3} value={b?.blurb} help="optional, e.g. 'Family-run, fully insured, 15 years in Kent'" />
          <label class="field">
            <span>
              Their contact form <em>· a form from this site's Settings with the questions they want; leads go straight to them</em>
            </span>
            <select name="form_key">
              <option value="">None: visitors use the site's standard quote form</option>
              {props.forms.map((k) => (
                <option value={k} selected={b?.form_key === k}>
                  {k}
                </option>
              ))}
            </select>
          </label>
        </fieldset>
        <Field label="Notes" name="notes" type="textarea" rows={4} value={b?.notes} />
      </div>
      <aside class="ed-side">
        <div class="panel">
          <label class="chk">
            <input type="checkbox" name="active" value="1" checked={b?.active !== 0} /> Active (receives leads)
          </label>
          <Field label="Monthly price (£)" name="monthly_price" type="number" value={b?.monthly_price} />
          <Field label="Start date" name="started_at" type="date" value={b?.started_at?.slice(0, 10)} />
          <button class="btn block">Save buyer</button>
        </div>
        {b?.id ? (
          <>
            <a class="btn ghost block" href={`/leads?site=${props.sid}&buyer=${b.id}`}>
              View their leads
            </a>
            <form method="post" action={`/sites/${props.sid}/buyers/${b.id}/test`} style="margin-top:8px">
              <button class="btn ghost block" title="Sends a sample lead to this buyer's email, marked as a test">
                Send test lead
              </button>
            </form>
            <form method="post" action={`/sites/${props.sid}/buyers/${b.id}/delete`} data-confirm="Delete this buyer? Their past leads keep their history." style="margin-top:8px">
              <button class="btn danger block">Delete buyer</button>
            </form>
          </>
        ) : null}
      </aside>
    </form>
  )
}

buyers.get('/sites/:sid/buyers/new', async (c) => {
  const s = await getSite(c.env, Number(c.req.param('sid')))
  if (!s) return c.notFound()
  return page(
    <Admin title="New buyer" site={s} active="buyers" user={c.get('user')}>
      <h1>New buyer</h1>
      <BuyerForm sid={s.id} areas={new Set()} locs={await locations(c.env, s.id)} forms={Object.keys(s.settings.forms || {})} />
    </Admin>,
  )
})

buyers.get('/sites/:sid/buyers/:bid', async (c) => {
  const s = await getSite(c.env, Number(c.req.param('sid')))
  const bid = Number(c.req.param('bid'))
  const b = await c.env.DB.prepare('SELECT * FROM buyers WHERE id = ? AND site_id = ?').bind(bid, s?.id ?? 0).first<Buyer>()
  if (!s || !b) return c.notFound()
  const { results } = await c.env.DB.prepare('SELECT path FROM buyer_areas WHERE buyer_id = ?').bind(bid).all<{ path: string }>()
  const flash = c.req.query('taken') ? `Saved, but these locations already belong to another active buyer and were not added: ${c.req.query('taken')}` : c.req.query('saved') ? 'Saved.' : c.req.query('tested') ? `Test lead sent to ${b.email}.` : c.req.query('testfail') ? `Test email failed: ${c.req.query('testfail')}` : undefined
  return page(
    <Admin title={b.business || b.name} site={s} active="buyers" user={c.get('user')} flash={flash}>
      <h1>{b.business || b.name}</h1>
      <BuyerForm sid={s.id} b={b} areas={new Set(results.map((r) => r.path))} locs={await locations(c.env, s.id, bid)} forms={Object.keys(s.settings.forms || {})} />
    </Admin>,
  )
})

async function saveBuyer(c: import("hono").Context<V>, bid?: number) {
  const sid = Number(c.req.param('sid'))
  const f = await c.req.parseBody({ all: true })
  const one = (k: string) => String(Array.isArray(f[k]) ? f[k][0] : (f[k] ?? '')).trim()
  const areas = ([] as unknown[]).concat(f.areas || []).map(String)
  const email = one('email')
  if (!one('name') || !emailsOf({ email } as Buyer).length) {
    const s = await getSite(c.env, sid)
    return page(
      <Admin title="Buyer" site={s} active="buyers" user={c.get('user')}>
        <h1>Couldn't save</h1>
        <BuyerForm
          sid={sid}
          b={{ id: bid, name: one('name'), business: one('business'), email, phone: one('phone'), notes: one('notes') }}
          areas={new Set(areas)}
          locs={await locations(c.env, sid, bid || 0)}
          forms={Object.keys(s?.settings.forms || {})}
          error="A contact name and a valid email are required."
        />
      </Admin>,
      400,
    )
  }
  // locations are exclusive: skip any already owned by another active buyer
  let taken: string[] = []
  if (f.active === '1' && areas.length) {
    const { results } = await c.env.DB.prepare(
      `SELECT DISTINCT a.path FROM buyer_areas a JOIN buyers b ON b.id = a.buyer_id
       WHERE b.site_id = ? AND b.active = 1 AND b.id != ? AND a.path IN (${areas.map(() => '?').join(',')})`,
    )
      .bind(sid, bid || 0, ...areas)
      .all<{ path: string }>()
    taken = results.map((r) => r.path)
  }
  const keep = areas.filter((a) => !taken.includes(a))
  const price = one('monthly_price') === '' ? null : Number(one('monthly_price'))
  const vals = [
    one('name'), one('business'), email, one('phone'), price, f.active === '1' ? 1 : 0, one('notes'), one('started_at') || null,
    f.show_listing === '1' ? 1 : 0, one('public_phone'), one('public_email'), one('website'), one('logo'), one('blurb'), one('form_key'),
  ]
  let id = bid
  if (bid) {
    await c.env.DB.prepare(
      "UPDATE buyers SET name=?, business=?, email=?, phone=?, monthly_price=?, active=?, notes=?, started_at=?, show_listing=?, public_phone=?, public_email=?, website=?, logo=?, blurb=?, form_key=?, updated_at=datetime('now') WHERE id=? AND site_id=?",
    )
      .bind(...vals, bid, sid)
      .run()
  } else {
    const r = await c.env.DB.prepare(
      'INSERT INTO buyers (site_id, name, business, email, phone, monthly_price, active, notes, started_at, show_listing, public_phone, public_email, website, logo, blurb, form_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id',
    )
      .bind(sid, ...vals)
      .first<{ id: number }>()
    id = (r as { id: number }).id
  }
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM buyer_areas WHERE buyer_id = ?').bind(id),
    ...keep.map((p) => c.env.DB.prepare('INSERT OR IGNORE INTO buyer_areas (buyer_id, path) VALUES (?, ?)').bind(id, p)),
  ])
  await bumpCache(c.env, sid) // their listing appears on location pages
  return c.redirect(`/sites/${sid}/buyers/${id}?saved=1${taken.length ? `&taken=${encodeURIComponent(taken.join(', '))}` : ''}`)
}

buyers.post('/sites/:sid/buyers/new', (c) => saveBuyer(c))
buyers.post('/sites/:sid/buyers/:bid', (c) => saveBuyer(c, Number(c.req.param('bid'))))

buyers.post('/sites/:sid/buyers/:bid/delete', async (c) => {
  const sid = Number(c.req.param('sid'))
  await c.env.DB.prepare('DELETE FROM buyers WHERE id = ? AND site_id = ?').bind(Number(c.req.param('bid')), sid).run()
  await bumpCache(c.env, sid)
  return c.redirect(`/sites/${sid}/buyers`)
})

buyers.post('/sites/:sid/buyers/:bid/test', async (c) => {
  const s = await getSite(c.env, Number(c.req.param('sid')))
  const bid = Number(c.req.param('bid'))
  const b = await c.env.DB.prepare('SELECT * FROM buyers WHERE id = ? AND site_id = ?').bind(bid, s?.id ?? 0).first<Buyer>()
  if (!s || !b) return c.notFound()
  const back = `/sites/${s.id}/buyers/${bid}`
  if (!c.env.RESEND_API_KEY || !s.settings.email_from) return c.redirect(`${back}?testfail=${encodeURIComponent('email sending is not set up for this site')}`)
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${c.env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: s.settings.email_from,
      to: emailsOf(b),
      subject: `[TEST] New enquiry – ${s.name}`,
      html: `<p>Hi ${b.name.split(' ')[0]},</p><p>This is a <b>test</b> to confirm new enquiries from <b>${s.name}</b> will reach this inbox. Real enquiries arrive in this format, and replying goes straight to the customer.</p>`,
    }),
  })
  return c.redirect(r.ok ? `${back}?tested=1` : `${back}?testfail=${encodeURIComponent(`${r.status} ${(await r.text()).slice(0, 120)}`)}`)
})
