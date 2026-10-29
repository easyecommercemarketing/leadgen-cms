import { Hono } from 'hono'
import type { Content, ContentType, Env, Site } from '../types'
import { bumpCache, getContentById, getSite, listSites } from '../lib/db'
import { csvCell, formatDate, normPath, parseJSON, slugify } from '../lib/util'
import { Admin, Field, Pager, page } from './ui'
import { parseCategoryList, saveContent } from './save'
import { importApi } from './import'
import { BLOCK_DOCS } from './docs'
import { putMedia } from '../lib/media'
import { buyers } from './buyers'

type V = { Bindings: Env; Variables: { user: string } }
export const admin = new Hono<V>()

const TYPES: Record<ContentType, { label: string; tab: string }> = {
  page: { label: 'Pages', tab: 'pages' },
  post: { label: 'Posts', tab: 'posts' },
  location: { label: 'Locations', tab: 'locations' },
  product: { label: 'Products', tab: 'products' },
}

async function siteOr404(c: any): Promise<Site | null> {
  return getSite(c.env, Number(c.req.param('sid')))
}

function liveUrl(site: Site, path: string) {
  return `/preview/${site.id}${path === '/' ? '/' : path}`
}

admin.route('/api/import', importApi)
admin.route('/', buyers)

// ---------------------------------------------------------------- dashboard

admin.get('/', async (c) => {
  const sites = await listSites(c.env)
  const { results: counts } = await c.env.DB.prepare(
    `SELECT site_id,
            SUM(type='page') pages, SUM(type='post') posts, SUM(type='location') locations,
            (SELECT COUNT(*) FROM leads l WHERE l.site_id = content.site_id AND l.status = 'new') new_leads,
            (SELECT COUNT(*) FROM leads l WHERE l.site_id = content.site_id AND l.created_at > datetime('now','-30 days')) leads_30d
     FROM content GROUP BY site_id`,
  ).all<any>()
  const by = Object.fromEntries(counts.map((r) => [r.site_id, r]))
  return page(
    <Admin title="Sites" user={c.get('user')}>
      <div class="bar">
        <h1>Sites</h1>
        <a class="btn" href="/sites/new">
          + New site
        </a>
      </div>
      <table class="tbl">
        <thead>
          <tr>
            <th>Site</th>
            <th>Pages</th>
            <th>Posts</th>
            <th>Locations</th>
            <th>New leads</th>
            <th>Leads (30d)</th>
          </tr>
        </thead>
        <tbody>
          {sites.map((s) => {
            const n = by[s.id] || {}
            return (
              <tr>
                <td>
                  <a href={`/sites/${s.id}/content?type=page`}>
                    <b>{s.name}</b>
                  </a>
                  <div class="muted">{s.domain}</div>
                </td>
                <td>{n.pages || 0}</td>
                <td>{n.posts || 0}</td>
                <td>{n.locations || 0}</td>
                <td>{n.new_leads ? <a href={`/leads?site=${s.id}&status=new`}>{n.new_leads}</a> : 0}</td>
                <td>{n.leads_30d || 0}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {!sites.length ? <p class="muted">No sites yet. Create one, or run the import script.</p> : null}
    </Admin>,
  )
})

// ---------------------------------------------------------------- site settings

function SiteForm(props: { s?: Site }) {
  const s = props.s
  return (
    <form method="post" class="form">
      <div class="grid2">
        <Field label="Name" name="name" value={s?.name} required />
        <Field label="Slug" name="slug" value={s?.slug} help="short id, used for media paths" required />
        <Field label="Domain" name="domain" value={s?.domain} help="no https://, no trailing slash" required />
        <Field label="Aliases" name="aliases" value={(s?.aliases || []).join(', ')} help="comma separated; redirect to the domain" />
      </div>
      <Field label="Theme (JSON)" name="theme" type="textarea" mono rows={12} value={JSON.stringify(s?.theme || {}, null, 2)} />
      <Field label="Settings (JSON)" name="settings" type="textarea" mono rows={24} value={JSON.stringify(s?.settings || {}, null, 2)} help="nav, footer, forms, ga4, blog" />
      <button class="btn">Save site</button>
    </form>
  )
}

admin.get('/sites/new', (c) =>
  page(
    <Admin title="New site" user={c.get('user')}>
      <h1>New site</h1>
      <SiteForm />
    </Admin>,
  ),
)

async function readSiteForm(c: any) {
  const f = await c.req.parseBody()
  const theme = JSON.parse(String(f.theme || '{}'))
  const settings = JSON.parse(String(f.settings || '{}'))
  const aliases = String(f.aliases || '')
    .split(',')
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean)
  return {
    name: String(f.name).trim(),
    slug: slugify(String(f.slug || f.name)),
    domain: String(f.domain).trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, ''),
    aliases: JSON.stringify(aliases),
    theme: JSON.stringify(theme),
    settings: JSON.stringify(settings),
  }
}

admin.post('/sites/new', async (c) => {
  let v
  try {
    v = await readSiteForm(c)
  } catch (e: any) {
    return c.text(`Invalid JSON: ${e.message}`, 400)
  }
  const r = await c.env.DB.prepare('INSERT INTO sites (name, slug, domain, aliases, theme, settings) VALUES (?, ?, ?, ?, ?, ?) RETURNING id')
    .bind(v.name, v.slug, v.domain, v.aliases, v.theme, v.settings)
    .first<{ id: number }>()
  return c.redirect(`/sites/${r!.id}`)
})

admin.get('/sites/:sid', async (c) => {
  const s = await siteOr404(c)
  if (!s) return c.notFound()
  return page(
    <Admin title="Settings" site={s} active="settings" user={c.get('user')} flash={c.req.query('saved') ? 'Saved.' : undefined}>
      <div class="bar">
        <h1>Site settings</h1>
        <form method="post" action={`/sites/${s.id}/purge`}>
          <button class="btn ghost" title="Force every page to re-render">
            Clear page cache
          </button>
        </form>
      </div>
      <SiteForm s={s} />
    </Admin>,
  )
})

admin.post('/sites/:sid', async (c) => {
  const id = Number(c.req.param('sid'))
  let v
  try {
    v = await readSiteForm(c)
  } catch (e: any) {
    return c.text(`Invalid JSON: ${e.message}`, 400)
  }
  await c.env.DB.prepare(
    "UPDATE sites SET name=?, slug=?, domain=?, aliases=?, theme=?, settings=?, updated_at=datetime('now') WHERE id=?",
  )
    .bind(v.name, v.slug, v.domain, v.aliases, v.theme, v.settings, id)
    .run()
  await bumpCache(c.env, id)
  return c.redirect(`/sites/${id}?saved=1`)
})

admin.post('/sites/:sid/purge', async (c) => {
  const id = Number(c.req.param('sid'))
  await bumpCache(c.env, id)
  return c.redirect(`/sites/${id}?saved=1`)
})

// ---------------------------------------------------------------- content list

admin.get('/sites/:sid/content', async (c) => {
  const s = await siteOr404(c)
  if (!s) return c.notFound()
  const type = (c.req.query('type') || 'page') as ContentType
  const q = (c.req.query('q') || '').trim()
  const pg = Math.max(1, Number(c.req.query('page') || 1))
  const per = 50
  const where = `site_id = ? AND type = ? ${q ? 'AND (title LIKE ? OR path LIKE ? OR h1 LIKE ?)' : ''}`
  const binds: unknown[] = [s.id, type, ...(q ? [`%${q}%`, `%${q}%`, `%${q}%`] : [])]
  const [list, count] = await c.env.DB.batch([
    c.env.DB.prepare(
      `SELECT id, path, title, h1, status, published_at, updated_at, noindex FROM content WHERE ${where}
       ORDER BY ${type === 'post' ? 'published_at DESC' : 'path'} LIMIT ? OFFSET ?`,
    ).bind(...binds, per, (pg - 1) * per),
    c.env.DB.prepare(`SELECT COUNT(*) n FROM content WHERE ${where}`).bind(...binds),
  ])
  const rows = list.results as any[]
  const total = (count.results[0] as any).n as number
  const T = TYPES[type]
  return page(
    <Admin title={T.label} site={s} active={T.tab} user={c.get('user')}>
      <div class="bar">
        <h1>
          {T.label} <span class="muted">({total})</span>
        </h1>
        <form class="search">
          <input type="hidden" name="type" value={type} />
          <input name="q" value={q} placeholder="Search title or URL" />
        </form>
        <a class="btn" href={`/sites/${s.id}/content/new?type=${type}`}>
          + New
        </a>
      </div>
      <table class="tbl">
        <thead>
          <tr>
            <th>Title</th>
            <th>URL</th>
            <th>Status</th>
            <th>{type === 'post' ? 'Published' : 'Updated'}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr>
              <td>
                <a href={`/sites/${s.id}/content/${r.id}`}>{r.h1 || r.title || '(untitled)'}</a>
              </td>
              <td>
                <a class="muted" href={liveUrl(s, r.path)} target="_blank">
                  {r.path}
                </a>
              </td>
              <td>
                <span class={`pill ${r.status}`}>{r.status}</span>
                {r.noindex ? <span class="pill draft">noindex</span> : null}
              </td>
              <td class="muted">{formatDate(type === 'post' ? r.published_at : r.updated_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <Pager
        page={pg}
        pages={Math.ceil(total / per)}
        href={(n) => `/sites/${s.id}/content?type=${type}&page=${n}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
      />
    </Admin>,
  )
})

// ---------------------------------------------------------------- content editor

function Editor(props: { s: Site; item: Partial<Content> & { type: ContentType }; error?: string }) {
  const { s, item } = props
  const d = item.data || {}
  const t = item.type
  const others = { ...d }
  // fields with their own inputs are hidden from the raw JSON box
  for (const k of ['town', 'why_heading', 'why_md', 'why_html', 'price', 'currency', 'payment_link', 'button_label', 'minutes']) delete others[k]
  return (
    <form method="post" class="form editor">
      {props.error ? <div class="flash err">{props.error}</div> : null}
      <input type="hidden" name="type" value={t} />
      <div class="ed-main">
        <Field label="Page title (SEO)" name="title" value={item.title} help={`${(item.title || '').length} chars, aim ≤ 60`} />
        <Field label="H1 heading" name="h1" value={item.h1} />
        <Field label="Meta description" name="meta_description" type="textarea" rows={2} value={item.meta_description} help={`${(item.meta_description || '').length} chars, aim ≤ 160`} />

        {t === 'location' ? (
          <fieldset>
            <legend>Location</legend>
            <Field label="Town / city" name="d_town" value={d.town} help="fills {{town}} in the location template" />
            <Field label="Local section heading" name="d_why_heading" value={d.why_heading} />
            <Field label="Local section copy (markdown)" name="d_why_md" type="textarea" rows={16} value={d.why_md} />
          </fieldset>
        ) : null}

        {t === 'product' ? (
          <fieldset>
            <legend>Product</legend>
            <div class="grid3">
              <Field label="Price" name="d_price" value={d.price} />
              <Field label="Currency" name="d_currency" value={d.currency || 'GBP'} />
              <Field label="Button label" name="d_button_label" value={d.button_label} placeholder="Buy now" />
            </div>
            <Field label="Payment link" name="d_payment_link" value={d.payment_link} help="e.g. a Stripe Payment Link" />
          </fieldset>
        ) : null}

        {t === 'page' ? (
          <Field
            label="Blocks (JSON)"
            name="blocks"
            type="textarea"
            mono
            rows={28}
            value={JSON.stringify(item.blocks || [], null, 2)}
            help="page layout, see Block reference"
          />
        ) : null}

        {t !== 'location' ? (
          <Field label="Body (markdown)" name="body_md" type="textarea" rows={t === 'post' ? 30 : 10} value={item.body_md} help={t === 'page' ? 'used only when Blocks is empty' : undefined} />
        ) : null}

        <details>
          <summary>Advanced: extra data (JSON)</summary>
          <Field label="Data" name="data" type="textarea" mono rows={8} value={JSON.stringify(others, null, 2)} />
        </details>
      </div>

      <aside class="ed-side">
        <div class="panel">
          <Field label="URL path" name="path" value={item.path} required help={t === 'post' ? '/post/your-slug' : undefined} />
          <label class="field">
            <span>Status</span>
            <select name="status">
              <option value="published" selected={item.status !== 'draft'}>
                Published
              </option>
              <option value="draft" selected={item.status === 'draft'}>
                Draft
              </option>
            </select>
          </label>
          <Field label="Publish date" name="published_at" value={item.published_at?.slice(0, 10)} type="date" />
          <label class="chk">
            <input type="checkbox" name="noindex" value="1" checked={!!item.noindex} /> Hide from search engines
          </label>
          <button class="btn block">Save</button>
          {item.id ? (
            <a class="btn ghost block" href={liveUrl(s, item.path || '/')} target="_blank">
              Preview ↗
            </a>
          ) : null}
        </div>
        <div class="panel">
          <Field label="Featured / OG image" name="image" value={item.image} />
          <button type="button" class="btn ghost small" data-pick-media={`/sites/${s.id}/media.json`} data-target="image">
            Choose from media
          </button>
          {item.image ? <img src={`/preview/${s.id}${item.image}`} class="thumb" /> : null}
        </div>
        {t === 'post' ? (
          <div class="panel">
            <Field label="Categories" name="categories" value={(item.categories || []).map((c) => c.name).join(', ')} help="comma separated" />
            <Field label="Excerpt" name="excerpt" type="textarea" rows={3} value={item.excerpt} help="blank = from meta description" />
          </div>
        ) : null}
        {t === 'page' ? (
          <div class="panel">
            <a href="/docs/blocks" target="_blank">
              Block reference ↗
            </a>
          </div>
        ) : null}
        {item.id ? (
          <form method="post" action={`/sites/${s.id}/content/${item.id}/delete`} data-confirm="Delete this permanently?">
            <button class="btn danger block">Delete</button>
          </form>
        ) : null}
      </aside>
    </form>
  )
}

admin.get('/sites/:sid/content/new', async (c) => {
  const s = await siteOr404(c)
  if (!s) return c.notFound()
  const type = (c.req.query('type') || 'page') as ContentType
  const path = type === 'post' ? `${s.settings.blog?.post_prefix || '/post/'}` : '/'
  return page(
    <Admin title="New" site={s} active={TYPES[type].tab} user={c.get('user')}>
      <h1>New {type}</h1>
      <Editor s={s} item={{ type, path, status: 'published', blocks: [], data: {} }} />
    </Admin>,
  )
})

async function readEditor(c: any) {
  const f = await c.req.parseBody()
  const type = String(f.type) as ContentType
  const data: Record<string, any> = JSON.parse(String(f.data || '{}'))
  for (const [k, v] of Object.entries(f)) if (k.startsWith('d_') && String(v).trim() !== '') data[k.slice(2)] = String(v)
  if (data.price) data.price = Number(data.price)
  return {
    type,
    path: String(f.path || ''),
    title: String(f.title || ''),
    h1: String(f.h1 || ''),
    meta_description: String(f.meta_description || ''),
    excerpt: String(f.excerpt || ''),
    body_md: String(f.body_md || ''),
    blocks: f.blocks != null ? JSON.parse(String(f.blocks || '[]')) : [],
    data,
    image: String(f.image || ''),
    status: (String(f.status) === 'draft' ? 'draft' : 'published') as 'draft' | 'published',
    noindex: f.noindex === '1',
    published_at: f.published_at ? String(f.published_at) : null,
    categories: type === 'post' ? parseCategoryList(String(f.categories || '')) : undefined,
  }
}

async function saveFromEditor(c: any, existingId?: number) {
  const s = await siteOr404(c)
  if (!s) return c.notFound()
  let input
  try {
    input = await readEditor(c)
    const id = await saveContent(c.env, s.id, { ...input, id: existingId })
    await bumpCache(c.env, s.id)
    return c.redirect(`/sites/${s.id}/content/${id}?saved=1`)
  } catch (e: any) {
    const item: any = input ? { ...input, id: existingId } : { type: 'page', id: existingId }
    return page(
      <Admin title="Edit" site={s} user={c.get('user')}>
        <h1>Couldn't save</h1>
        <Editor s={s} item={item} error={e.message} />
      </Admin>,
      400,
    )
  }
}

admin.post('/sites/:sid/content/new', (c) => saveFromEditor(c))
admin.post('/sites/:sid/content/:cid', (c) => saveFromEditor(c, Number(c.req.param('cid'))))

admin.get('/sites/:sid/content/:cid', async (c) => {
  const s = await siteOr404(c)
  const item = await getContentById(c.env, Number(c.req.param('cid')))
  if (!s || !item || item.site_id !== s.id) return c.notFound()
  return page(
    <Admin title={item.h1 || item.title} site={s} active={TYPES[item.type].tab} user={c.get('user')} flash={c.req.query('saved') ? 'Saved and published.' : undefined}>
      <div class="bar">
        <h1>{item.h1 || item.title || 'Edit'}</h1>
      </div>
      <Editor s={s} item={item} />
    </Admin>,
  )
})

admin.post('/sites/:sid/content/:cid/delete', async (c) => {
  const sid = Number(c.req.param('sid'))
  const r = await c.env.DB.prepare('DELETE FROM content WHERE id = ? AND site_id = ? RETURNING type').bind(Number(c.req.param('cid')), sid).first<{ type: string }>()
  await bumpCache(c.env, sid)
  return c.redirect(`/sites/${sid}/content?type=${r?.type || 'page'}`)
})

// ---------------------------------------------------------------- shared sections

admin.get('/sites/:sid/shared', async (c) => {
  const s = await siteOr404(c)
  if (!s) return c.notFound()
  const { results } = await c.env.DB.prepare('SELECT key, label, length(blocks) size FROM shared_blocks WHERE site_id = ? ORDER BY key').bind(s.id).all<any>()
  return page(
    <Admin title="Sections" site={s} active="shared" user={c.get('user')}>
      <div class="bar">
        <h1>Shared sections</h1>
        <form method="get" action={`/sites/${s.id}/shared/new`} class="search">
          <input name="key" placeholder="new_section_key" required pattern="[a-z0-9_]+" />
          <button class="btn">+ New</button>
        </form>
      </div>
      <p class="muted">
        Reusable groups of blocks. Use one in a page with <code>{'{"type":"shared","key":"…"}'}</code>. <code>location_template</code> lays out every location page; <code>post_footer</code> appears under every post; <code>not_found</code> is the 404 page.
      </p>
      <table class="tbl">
        <tbody>
          {results.map((r) => (
            <tr>
              <td>
                <a href={`/sites/${s.id}/shared/${r.key}`}>
                  <code>{r.key}</code>
                </a>
              </td>
              <td>{r.label}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Admin>,
  )
})

admin.get('/sites/:sid/shared/:key', async (c) => {
  const s = await siteOr404(c)
  if (!s) return c.notFound()
  const key = c.req.param('key') === 'new' ? String(c.req.query('key') || '') : c.req.param('key')
  const r = await c.env.DB.prepare('SELECT * FROM shared_blocks WHERE site_id = ? AND key = ?').bind(s.id, key).first<any>()
  return page(
    <Admin title={key} site={s} active="shared" user={c.get('user')} flash={c.req.query('saved') ? 'Saved.' : undefined}>
      <h1>
        Section <code>{key}</code>
      </h1>
      <form method="post" action={`/sites/${s.id}/shared/${key}`} class="form">
        <Field label="Label" name="label" value={r?.label} />
        <Field label="Blocks (JSON)" name="blocks" type="textarea" mono rows={36} value={JSON.stringify(parseJSON(r?.blocks, []), null, 2)} />
        <button class="btn">Save</button> <a href="/docs/blocks" target="_blank">Block reference ↗</a>
      </form>
    </Admin>,
  )
})

admin.post('/sites/:sid/shared/:key', async (c) => {
  const sid = Number(c.req.param('sid'))
  const key = c.req.param('key')
  const f = await c.req.parseBody()
  let blocks
  try {
    blocks = JSON.parse(String(f.blocks || '[]'))
    if (!Array.isArray(blocks)) throw new Error('Blocks must be a JSON array')
  } catch (e: any) {
    return c.text(`Invalid JSON: ${e.message}`, 400)
  }
  await c.env.DB.prepare(
    'INSERT INTO shared_blocks (site_id, key, label, blocks) VALUES (?, ?, ?, ?) ON CONFLICT (site_id, key) DO UPDATE SET label = excluded.label, blocks = excluded.blocks',
  )
    .bind(sid, key, String(f.label || ''), JSON.stringify(blocks))
    .run()
  await bumpCache(c.env, sid)
  return c.redirect(`/sites/${sid}/shared/${key}?saved=1`)
})

// ---------------------------------------------------------------- media

admin.get('/sites/:sid/media', async (c) => {
  const s = await siteOr404(c)
  if (!s) return c.notFound()
  const q = c.req.query('q') || ''
  const { results } = await c.env.DB.prepare(
    `SELECT * FROM media WHERE site_id = ? ${q ? 'AND filename LIKE ?' : ''} ORDER BY created_at DESC, id DESC LIMIT 300`,
  )
    .bind(...(q ? [s.id, `%${q}%`] : [s.id]))
    .all<any>()
  return page(
    <Admin title="Media" site={s} active="media" user={c.get('user')}>
      <div class="bar">
        <h1>Media</h1>
        <form class="search">
          <input name="q" value={q} placeholder="Search filenames" />
        </form>
        <form method="post" action={`/sites/${s.id}/media`} enctype="multipart/form-data" class="upload">
          <input type="file" name="file" multiple accept="image/*,application/pdf" required />
          <button class="btn">Upload</button>
        </form>
      </div>
      <div class="media-grid">
        {results.map((m) => (
          <figure>
            {m.mime.startsWith('image/') ? <img src={`/preview/${s.id}/media/${m.filename}`} loading="lazy" /> : <div class="file">{m.mime}</div>}
            <figcaption>
              <input readonly value={`/media/${m.filename}`} onclick="this.select()" />
              <span class="muted">
                {Math.round(m.size / 1024)} KB{m.width ? ` · ${m.width}×${m.height}` : ''}
              </span>
              <form method="post" action={`/sites/${s.id}/media/${m.id}/delete`} data-confirm="Delete this file? Pages using it will show a broken image.">
                <button class="link danger">delete</button>
              </form>
            </figcaption>
          </figure>
        ))}
      </div>
    </Admin>,
  )
})

admin.get('/sites/:sid/media.json', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT filename, mime FROM media WHERE site_id = ? ORDER BY created_at DESC, id DESC LIMIT 500')
    .bind(Number(c.req.param('sid')))
    .all<any>()
  return c.json(results)
})

admin.post('/sites/:sid/media', async (c) => {
  const s = await siteOr404(c)
  if (!s) return c.notFound()
  const body = await c.req.parseBody({ all: true })
  const files = ([] as any[]).concat(body.file || []).filter((f) => f instanceof File) as File[]
  for (const f of files) {
    const dot = f.name.lastIndexOf('.')
    const base = slugify(dot > 0 ? f.name.slice(0, dot) : f.name) || 'file'
    const ext = dot > 0 ? f.name.slice(dot).toLowerCase() : ''
    const name = `${base}-${Date.now().toString(36)}${ext}`
    await putMedia(c.env, s, name, await f.arrayBuffer(), f.type || 'application/octet-stream', f.size)
  }
  return c.redirect(`/sites/${s.id}/media`)
})

admin.post('/sites/:sid/media/:mid/delete', async (c) => {
  const s = await siteOr404(c)
  if (!s) return c.notFound()
  const m = await c.env.DB.prepare('DELETE FROM media WHERE id = ? AND site_id = ? RETURNING filename').bind(Number(c.req.param('mid')), s.id).first<{ filename: string }>()
  if (m) await c.env.MEDIA.delete(`${s.slug}/${m.filename}`)
  return c.redirect(`/sites/${s.id}/media`)
})

// ---------------------------------------------------------------- redirects

admin.get('/sites/:sid/redirects', async (c) => {
  const s = await siteOr404(c)
  if (!s) return c.notFound()
  const { results } = await c.env.DB.prepare('SELECT * FROM redirects WHERE site_id = ? ORDER BY from_path').bind(s.id).all<any>()
  return page(
    <Admin title="Redirects" site={s} active="redirects" user={c.get('user')}>
      <h1>Redirects</h1>
      <form method="post" class="form">
        <Field label="Add redirects" name="lines" type="textarea" mono rows={5} placeholder={'/old-page /new-page\n/another-old https://example.com/page 302'} help="one per line: from to [code]" />
        <button class="btn">Add</button>
      </form>
      <table class="tbl">
        <thead>
          <tr>
            <th>From</th>
            <th>To</th>
            <th>Code</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {results.map((r) => (
            <tr>
              <td>
                <code>{r.from_path}</code>
              </td>
              <td>
                <code>{r.to_path}</code>
              </td>
              <td>{r.code}</td>
              <td>
                <form method="post" action={`/sites/${s.id}/redirects/delete`}>
                  <input type="hidden" name="from" value={r.from_path} />
                  <button class="link danger">remove</button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Admin>,
  )
})

admin.post('/sites/:sid/redirects', async (c) => {
  const sid = Number(c.req.param('sid'))
  const f = await c.req.parseBody()
  const stmts = String(f.lines || '')
    .split('\n')
    .map((l) => l.trim().split(/\s+/))
    .filter((p) => p.length >= 2 && p[0].startsWith('/'))
    .map(([from, to, code]) =>
      c.env.DB.prepare('INSERT INTO redirects (site_id, from_path, to_path, code) VALUES (?, ?, ?, ?) ON CONFLICT (site_id, from_path) DO UPDATE SET to_path = excluded.to_path, code = excluded.code').bind(
        sid,
        normPath(from),
        to,
        Number(code) === 302 ? 302 : 301,
      ),
    )
  if (stmts.length) await c.env.DB.batch(stmts)
  await bumpCache(c.env, sid)
  return c.redirect(`/sites/${sid}/redirects`)
})

admin.post('/sites/:sid/redirects/delete', async (c) => {
  const sid = Number(c.req.param('sid'))
  const f = await c.req.parseBody()
  await c.env.DB.prepare('DELETE FROM redirects WHERE site_id = ? AND from_path = ?').bind(sid, String(f.from)).run()
  await bumpCache(c.env, sid)
  return c.redirect(`/sites/${sid}/redirects`)
})

// ---------------------------------------------------------------- leads

const STATUSES = ['new', 'contacted', 'qualified', 'sold', 'invalid']

function leadFilters(c: any) {
  const site = c.req.query('site')
  const status = c.req.query('status')
  const q = (c.req.query('q') || '').trim()
  const from = c.req.query('from')
  const to = c.req.query('to')
  const where: string[] = []
  const binds: unknown[] = []
  if (site) (where.push('l.site_id = ?'), binds.push(Number(site)))
  if (status) (where.push('l.status = ?'), binds.push(status))
  if (q) (where.push('(l.name LIKE ? OR l.email LIKE ? OR l.phone LIKE ? OR l.fields LIKE ?)'), binds.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`))
  const buyer = c.req.query('buyer')
  const area = c.req.query('area')
  if (buyer) (where.push(`l.routed_to LIKE ?`), binds.push(`%"buyer_id":${Number(buyer)},%`))
  if (area) (where.push('l.area = ?'), binds.push(area))
  if (from) (where.push('l.created_at >= ?'), binds.push(from))
  if (to) (where.push("l.created_at < date(?, '+1 day')"), binds.push(to))
  return { where: where.length ? 'WHERE ' + where.join(' AND ') : '', binds, site, status, q, from, to, buyer, area }
}

admin.get('/leads', async (c) => {
  const f = leadFilters(c)
  const pg = Math.max(1, Number(c.req.query('page') || 1))
  const per = 50
  const sites = await listSites(c.env)
  const [list, count] = await c.env.DB.batch([
    c.env.DB.prepare(
      `SELECT l.*, s.name site_name FROM leads l JOIN sites s ON s.id = l.site_id ${f.where} ORDER BY l.created_at DESC, l.id DESC LIMIT ? OFFSET ?`,
    ).bind(...f.binds, per, (pg - 1) * per),
    c.env.DB.prepare(`SELECT COUNT(*) n, SUM(COALESCE(price,0)) revenue FROM leads l ${f.where}`).bind(...f.binds),
  ])
  const rows = list.results as any[]
  const agg = count.results[0] as any
  const qs = new URLSearchParams(Object.entries({ site: f.site, status: f.status, q: f.q, from: f.from, to: f.to, buyer: f.buyer, area: f.area }).filter(([, v]) => v) as [string, string][]).toString()
  const site = f.site ? sites.find((s) => s.id === Number(f.site)) : null
  return page(
    <Admin title="Leads" site={site} active="leads" user={c.get('user')}>
      <div class="bar">
        <h1>
          Leads <span class="muted">({agg.n})</span>
        </h1>
        <a class="btn ghost" href={`/leads.csv?${qs}`}>
          Export CSV
        </a>
      </div>
      <form class="filters">
        <select name="site">
          <option value="">All sites</option>
          {sites.map((s) => (
            <option value={s.id} selected={String(s.id) === f.site}>
              {s.name}
            </option>
          ))}
        </select>
        <select name="status">
          <option value="">Any status</option>
          {STATUSES.map((s) => (
            <option selected={s === f.status}>{s}</option>
          ))}
        </select>
        <input type="date" name="from" value={f.from} title="From" />
        <input type="date" name="to" value={f.to} title="To" />
        <input name="q" value={f.q} placeholder="Name, email, phone…" />
        {f.buyer ? <input type="hidden" name="buyer" value={f.buyer} /> : null}
        {f.area ? <input type="hidden" name="area" value={f.area} /> : null}
        <button class="btn">Filter</button>
        {agg.revenue ? <span class="muted">Sold value: £{Number(agg.revenue).toFixed(2)}</span> : null}
      </form>
      <table class="tbl leads">
        <thead>
          <tr>
            <th>Date</th>
            <th>Site / form</th>
            <th>Contact</th>
            <th>Details</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((l) => {
            const fields = parseJSON<Record<string, string>>(l.fields, {})
            const extra = Object.entries(fields).filter(([k]) => !/name|email|phone/i.test(k) && !k.startsWith('_'))
            return (
              <tr>
                <td class="muted nowrap">
                  <a href={`/leads/${l.id}`}>#{l.id}</a>
                  <br />
                  {l.created_at.slice(0, 16).replace('T', ' ')}
                </td>
                <td>
                  {l.site_name}
                  <div class="muted">
                    {l.form} · {l.page_path}
                    {l.area && l.area !== l.page_path ? <> · <a href={`/leads?site=${l.site_id}&area=${encodeURIComponent(l.area)}`}>{l.area}</a></> : null}
                  </div>
                </td>
                <td>
                  <b>{l.name || '—'}</b>
                  <div>{l.email ? <a href={`mailto:${l.email}`}>{l.email}</a> : null}</div>
                  <div>{l.phone ? <a href={`tel:${l.phone}`}>{l.phone}</a> : null}</div>
                </td>
                <td class="small">
                  {extra.slice(0, 4).map(([k, v]) => (
                    <div>
                      <span class="muted">{k.replace(/_/g, ' ')}:</span> {v.length > 120 ? v.slice(0, 120) + '…' : v}
                    </div>
                  ))}
                </td>
                <td>
                  <form method="post" action={`/leads/${l.id}`} class="inline" data-autosubmit>
                    <input type="hidden" name="back" value={`/leads?${qs}&page=${pg}`} />
                    <select name="status">
                      {STATUSES.map((s) => (
                        <option selected={s === l.status}>{s}</option>
                      ))}
                    </select>
                  </form>
                  {l.buyer ? (
                    <div class="muted small">
                      → {l.buyer}
                      {l.price ? ` £${l.price}` : ''}
                    </div>
                  ) : null}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {!rows.length ? <p class="muted">No leads match.</p> : null}
      <Pager page={pg} pages={Math.ceil(agg.n / per)} href={(n) => `/leads?${qs}&page=${n}`} />
    </Admin>,
  )
})

admin.get('/leads.csv', async (c) => {
  const f = leadFilters(c)
  const { results } = await c.env.DB.prepare(
    `SELECT l.*, s.name site_name, s.domain FROM leads l JOIN sites s ON s.id = l.site_id ${f.where} ORDER BY l.created_at DESC LIMIT 50000`,
  )
    .bind(...f.binds)
    .all<any>()
  // every distinct form field becomes its own column
  const keys = new Set<string>()
  const parsed = results.map((r) => {
    const fl = parseJSON<Record<string, string>>(r.fields, {})
    Object.keys(fl).forEach((k) => keys.add(k))
    return { r, fl }
  })
  const fk = [...keys]
  const head = ['id', 'created_at', 'site', 'domain', 'form', 'page', 'area', 'name', 'email', 'phone', 'status', 'buyer', 'price', 'notes', 'country', ...fk.map((k) => `field_${k}`)]
  const lines = [head.join(',')]
  for (const { r, fl } of parsed)
    lines.push(
      [r.id, r.created_at, r.site_name, r.domain, r.form, r.page_path, r.area, r.name, r.email, r.phone, r.status, r.buyer, r.price ?? '', r.notes, r.country, ...fk.map((k) => fl[k] ?? '')]
        .map(csvCell)
        .join(','),
    )
  return new Response(lines.join('\n'), {
    headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="leads-${new Date().toISOString().slice(0, 10)}.csv"` },
  })
})

admin.get('/leads/:id', async (c) => {
  const l = await c.env.DB.prepare('SELECT l.*, s.name site_name, s.domain FROM leads l JOIN sites s ON s.id = l.site_id WHERE l.id = ?').bind(Number(c.req.param('id'))).first<any>()
  if (!l) return c.notFound()
  const fields = parseJSON<Record<string, string>>(l.fields, {})
  const utm = parseJSON<Record<string, string>>(l.utm, {})
  return page(
    <Admin title={`Lead #${l.id}`} user={c.get('user')} flash={c.req.query('saved') ? 'Saved.' : undefined}>
      <div class="bar">
        <h1>Lead #{l.id}</h1>
        <a href={`/leads?site=${l.site_id}`}>← {l.site_name} leads</a>
      </div>
      <div class="grid2">
        <div class="panel">
          <table class="kv">
            <tr>
              <th>Received</th>
              <td>{l.created_at}</td>
            </tr>
            <tr>
              <th>Site</th>
              <td>
                {l.domain}
                {l.page_path}
              </td>
            </tr>
            <tr>
              <th>Form</th>
              <td>{l.form}</td>
            </tr>
            {l.area ? (
              <tr>
                <th>Location</th>
                <td>{l.area}</td>
              </tr>
            ) : null}
            <tr>
              <th>Sent to</th>
              <td>
                {parseJSON<{ name: string; email: string }[]>(l.routed_to, []).map((r) => `${r.name} <${r.email}>`).join(', ') || 'You only (unsold)'}
              </td>
            </tr>
            {Object.entries(fields).map(([k, v]) => (
              <tr>
                <th>{k.replace(/_/g, ' ')}</th>
                <td style="white-space:pre-wrap">{v}</td>
              </tr>
            ))}
            <tr>
              <th>Country</th>
              <td>{l.country}</td>
            </tr>
            <tr>
              <th>Referrer</th>
              <td class="small">{l.referrer}</td>
            </tr>
            {Object.keys(utm).length ? (
              <tr>
                <th>Campaign</th>
                <td class="small">{Object.entries(utm).map(([k, v]) => `${k}=${v}`).join(' · ')}</td>
              </tr>
            ) : null}
          </table>
        </div>
        <form method="post" action={`/leads/${l.id}`} class="panel form">
          <input type="hidden" name="back" value={`/leads/${l.id}?saved=1`} />
          <label class="field">
            <span>Status</span>
            <select name="status">
              {STATUSES.map((s) => (
                <option selected={s === l.status}>{s}</option>
              ))}
            </select>
          </label>
          <Field label="Sold to (buyer)" name="buyer" value={l.buyer} />
          <Field label="Sale price (£)" name="price" value={l.price} type="number" />
          <Field label="Notes" name="notes" type="textarea" rows={6} value={l.notes} />
          <button class="btn">Save</button>
        </form>
      </div>
      <form method="post" action={`/leads/${l.id}/delete`} data-confirm="Delete this lead permanently?" style="margin-top:20px">
        <button class="btn danger small">Delete lead</button>
      </form>
    </Admin>,
  )
})

admin.post('/leads/:id', async (c) => {
  const f = await c.req.parseBody()
  const sets: string[] = []
  const binds: unknown[] = []
  if (f.status && STATUSES.includes(String(f.status))) (sets.push('status = ?'), binds.push(String(f.status)))
  if (f.buyer != null) (sets.push('buyer = ?'), binds.push(String(f.buyer)))
  if (f.price != null) (sets.push('price = ?'), binds.push(String(f.price) === '' ? null : Number(f.price)))
  if (f.notes != null) (sets.push('notes = ?'), binds.push(String(f.notes)))
  if (sets.length) await c.env.DB.prepare(`UPDATE leads SET ${sets.join(', ')}, updated_at = datetime('now') WHERE id = ?`).bind(...binds, Number(c.req.param('id'))).run()
  const back = String(f.back || '/leads')
  return c.redirect(back.startsWith('/') ? back : '/leads')
})

admin.post('/leads/:id/delete', async (c) => {
  const l = await c.env.DB.prepare('DELETE FROM leads WHERE id = ? RETURNING site_id').bind(Number(c.req.param('id'))).first<{ site_id: number }>()
  return c.redirect(`/leads?site=${l?.site_id || ''}`)
})

// ---------------------------------------------------------------- docs

admin.get('/docs/blocks', (c) =>
  page(
    <Admin title="Block reference" user={c.get('user')}>
      <h1>Block reference</h1>
      <div class="docs">{BLOCK_DOCS}</div>
    </Admin>,
  ),
)

