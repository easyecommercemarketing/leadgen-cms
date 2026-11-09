import { Hono } from 'hono'
import type { Env } from '../types'
import { bumpCache, getSite } from '../lib/db'
import { normPath } from '../lib/util'
import { saveContent, type ContentInput } from './save'
import { putMedia } from '../lib/media'

// JSON API used by scripts/import.mjs. It sits behind the same Cloudflare Access check as the admin,
// so production calls need an Access service token (CF-Access-Client-Id / CF-Access-Client-Secret headers).

export const importApi = new Hono<{ Bindings: Env; Variables: { user: string } }>()

importApi.get('/site/:slug', async (c) => {
  const r = await c.env.DB.prepare('SELECT id FROM sites WHERE slug = ?').bind(c.req.param('slug')).first<{ id: number }>()
  return r ? c.json(r) : c.json({ error: 'no site with that slug' }, 404)
})

importApi.post('/site', async (c) => {
  const b = await c.req.json<{ slug: string; name: string; domain: string; aliases?: string[]; theme?: object; settings?: object }>()
  // keep any aliases added in the admin (e.g. a preview hostname) rather than replacing them
  const existing = await c.env.DB.prepare('SELECT aliases FROM sites WHERE slug = ?').bind(b.slug).first<{ aliases: string }>()
  const merged = [...new Set([...(existing ? (JSON.parse(existing.aliases) as string[]) : []), ...(b.aliases || [])])]
  b.aliases = merged
  const r = await c.env.DB.prepare(
    `INSERT INTO sites (slug, name, domain, aliases, theme, settings) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (slug) DO UPDATE SET name = excluded.name, domain = excluded.domain, aliases = excluded.aliases,
       theme = excluded.theme, settings = excluded.settings, updated_at = datetime('now')
     RETURNING id`,
  )
    .bind(b.slug, b.name, b.domain, JSON.stringify(b.aliases || []), JSON.stringify(b.theme || {}), JSON.stringify(b.settings || {}))
    .first<{ id: number }>()
  return c.json({ id: r!.id })
})

// Targeted settings changes that leave everything else untouched:
//   { nav_children: [{ href: "/services", children: [...] }],   set the dropdown under a menu item
//     append_unique: [{ path: "footer.links", items: [...] }] }  add links not already there (matched by href)
importApi.post('/settings/:slug', async (c) => {
  const row = await c.env.DB.prepare('SELECT id, settings FROM sites WHERE slug = ?').bind(c.req.param('slug')).first<{ id: number; settings: string }>()
  if (!row) return c.json({ error: 'no site with that slug' }, 404)
  const b = await c.req.json<{
    nav_children?: { href: string; children: { label: string; href: string }[] }[]
    append_unique?: { path: string; items: { label: string; href: string }[] }[]
  }>()
  const settings = JSON.parse(row.settings || '{}')
  const done: string[] = []
  for (const op of b.nav_children || []) {
    const item = (settings.nav || []).find((n: { href: string }) => n.href === op.href)
    if (!item) {
      done.push(`menu item ${op.href} not found, skipped`)
      continue
    }
    item.children = op.children
    done.push(`menu: ${op.children.length} dropdown links under ${item.label}`)
  }
  for (const op of b.append_unique || []) {
    const keys = op.path.split('.')
    let obj = settings
    for (const k of keys.slice(0, -1)) obj = obj[k] ??= {}
    const list: { href: string }[] = (obj[keys[keys.length - 1]] ??= [])
    const add = op.items.filter((it) => !list.some((x) => x.href === it.href))
    // insert new links before any mailto/legal links at the end, else append
    const at = list.findIndex((x) => /^mailto:/.test(x.href))
    if (at >= 0) list.splice(at, 0, ...add)
    else list.push(...add)
    done.push(`${op.path}: added ${add.length}, ${op.items.length - add.length} already there`)
  }
  await c.env.DB.prepare("UPDATE sites SET settings = ?, updated_at = datetime('now') WHERE id = ?").bind(JSON.stringify(settings), row.id).run()
  await bumpCache(c.env, row.id)
  return c.json({ ok: true, done })
})

importApi.post('/content', async (c) => {
  const b = await c.req.json<{ site_id: number; items: (ContentInput & { only_if_unedited_since?: string })[] }>()
  const ids: number[] = []
  const errors: { path: string; error: string }[] = []
  const skipped: string[] = []
  for (const it of b.items) {
    try {
      // updates to existing pages can ask to be skipped if the page was edited in the CMS since a given time
      if (it.only_if_unedited_since) {
        const cur = await c.env.DB.prepare('SELECT updated_at FROM content WHERE site_id = ? AND path = ?')
          .bind(b.site_id, normPath(it.path))
          .first<{ updated_at: string }>()
        if (cur && cur.updated_at > it.only_if_unedited_since) {
          skipped.push(it.path)
          continue
        }
      }
      ids.push(await saveContent(c.env, b.site_id, it))
    } catch (e: any) {
      errors.push({ path: it.path, error: e.message })
    }
  }
  return c.json({ saved: ids.length, errors, skipped })
})

importApi.post('/shared', async (c) => {
  const b = await c.req.json<{ site_id: number; items: { key: string; label?: string; blocks: unknown[] }[] }>()
  await c.env.DB.batch(
    b.items.map((it) =>
      c.env.DB.prepare(
        'INSERT INTO shared_blocks (site_id, key, label, blocks) VALUES (?, ?, ?, ?) ON CONFLICT (site_id, key) DO UPDATE SET label = excluded.label, blocks = excluded.blocks',
      ).bind(b.site_id, it.key, it.label || '', JSON.stringify(it.blocks)),
    ),
  )
  return c.json({ saved: b.items.length })
})

importApi.post('/redirects', async (c) => {
  const b = await c.req.json<{ site_id: number; items: { from: string; to: string; code?: number }[] }>()
  if (b.items.length)
    await c.env.DB.batch(
      b.items.map((it) =>
        c.env.DB.prepare(
          'INSERT INTO redirects (site_id, from_path, to_path, code) VALUES (?, ?, ?, ?) ON CONFLICT (site_id, from_path) DO UPDATE SET to_path = excluded.to_path, code = excluded.code',
        ).bind(b.site_id, normPath(it.from), it.to, it.code || 301),
      ),
    )
  return c.json({ saved: b.items.length })
})

// Which media files already exist, so re-runs skip uploads
importApi.get('/media/:sid', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT filename, size FROM media WHERE site_id = ?').bind(Number(c.req.param('sid'))).all()
  return c.json(results)
})

importApi.put('/media/:sid', async (c) => {
  const site = await getSite(c.env, Number(c.req.param('sid')))
  if (!site) return c.json({ error: 'no site' }, 404)
  const filename = c.req.query('filename') || ''
  if (!/^[A-Za-z0-9._-]+$/.test(filename)) return c.json({ error: 'bad filename' }, 400)
  const buf = await c.req.arrayBuffer()
  const w = c.req.query('w') ? Number(c.req.query('w')) : undefined
  const h = c.req.query('h') ? Number(c.req.query('h')) : undefined
  await putMedia(c.env, site, filename, buf, c.req.header('content-type') || 'application/octet-stream', buf.byteLength, w, h, c.req.query('alt') || '')
  return c.json({ ok: true, url: `/media/${filename}` })
})

importApi.post('/finish/:sid', async (c) => {
  await bumpCache(c.env, Number(c.req.param('sid')))
  return c.json({ ok: true })
})
