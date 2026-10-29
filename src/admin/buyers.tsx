import { Hono } from 'hono'
import type { Env } from '../types'
import { getSite } from '../lib/db'
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
        Quotes from a buyer's locations are emailed to them and marked <b>sold</b>. Leads from locations nobody has bought come to you as normal.
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

function BuyerForm(props: { sid: number; b?: Partial<Buyer>; areas: Set<string>; locs: Loc[]; error?: string }) {
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
            Tick every location page this buyer has paid for. A location already sold to someone else shows their name. Two buyers on the same location both
            receive its leads.
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
            {locs.map((l) => (
              <label class="chk" data-name={l.town.toLowerCase()}>
                <input type="checkbox" name="areas" value={l.path} checked={areas.has(l.path)} /> {l.town}
                {l.owners ? <span class="muted small"> · {l.owners}</span> : null}
              </label>
            ))}
          </div>
          {!locs.length ? <p class="muted">This site has no location pages yet.</p> : null}
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
      <BuyerForm sid={s.id} areas={new Set()} locs={await locations(c.env, s.id)} />
    </Admin>,
  )
})

buyers.get('/sites/:sid/buyers/:bid', async (c) => {
  const s = await getSite(c.env, Number(c.req.param('sid')))
  const bid = Number(c.req.param('bid'))
  const b = await c.env.DB.prepare('SELECT * FROM buyers WHERE id = ? AND site_id = ?').bind(bid, s?.id ?? 0).first<Buyer>()
  if (!s || !b) return c.notFound()
  const { results } = await c.env.DB.prepare('SELECT path FROM buyer_areas WHERE buyer_id = ?').bind(bid).all<{ path: string }>()
  const flash = c.req.query('saved') ? 'Saved.' : c.req.query('tested') ? `Test lead sent to ${b.email}.` : c.req.query('testfail') ? `Test email failed: ${c.req.query('testfail')}` : undefined
  return page(
    <Admin title={b.business || b.name} site={s} active="buyers" user={c.get('user')} flash={flash}>
      <h1>{b.business || b.name}</h1>
      <BuyerForm sid={s.id} b={b} areas={new Set(results.map((r) => r.path))} locs={await locations(c.env, s.id, bid)} />
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
          error="A contact name and a valid email are required."
        />
      </Admin>,
      400,
    )
  }
  const price = one('monthly_price') === '' ? null : Number(one('monthly_price'))
  const vals = [one('name'), one('business'), email, one('phone'), price, f.active === '1' ? 1 : 0, one('notes'), one('started_at') || null]
  let id = bid
  if (bid) {
    await c.env.DB.prepare(
      "UPDATE buyers SET name=?, business=?, email=?, phone=?, monthly_price=?, active=?, notes=?, started_at=?, updated_at=datetime('now') WHERE id=? AND site_id=?",
    )
      .bind(...vals, bid, sid)
      .run()
  } else {
    const r = await c.env.DB.prepare(
      'INSERT INTO buyers (site_id, name, business, email, phone, monthly_price, active, notes, started_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id',
    )
      .bind(sid, ...vals)
      .first<{ id: number }>()
    id = (r as { id: number }).id
  }
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM buyer_areas WHERE buyer_id = ?').bind(id),
    ...areas.map((p) => c.env.DB.prepare('INSERT OR IGNORE INTO buyer_areas (buyer_id, path) VALUES (?, ?)').bind(id, p)),
  ])
  return c.redirect(`/sites/${sid}/buyers/${id}?saved=1`)
}

buyers.post('/sites/:sid/buyers/new', (c) => saveBuyer(c))
buyers.post('/sites/:sid/buyers/:bid', (c) => saveBuyer(c, Number(c.req.param('bid'))))

buyers.post('/sites/:sid/buyers/:bid/delete', async (c) => {
  const sid = Number(c.req.param('sid'))
  await c.env.DB.prepare('DELETE FROM buyers WHERE id = ? AND site_id = ?').bind(Number(c.req.param('bid')), sid).run()
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
