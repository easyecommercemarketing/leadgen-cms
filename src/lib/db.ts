import type { Block, Category, Content, Env, Site } from '../types'
import { parseJSON } from './util'

// ---------------------------------------------------------------- sites

type SiteRow = Omit<Site, 'aliases' | 'theme' | 'settings'> & { aliases: string; theme: string; settings: string }

export function rowToSite(r: SiteRow): Site {
  return {
    ...r,
    aliases: parseJSON<string[]>(r.aliases, []),
    theme: parseJSON(r.theme, {}),
    settings: parseJSON(r.settings, {}),
  }
}

// Hostname → site lookups are cached in the isolate for 20s. This keeps D1 reads tiny while
// still letting a publish (which bumps cache_version) reach every visitor within seconds.
const hostCache = new Map<string, { site: Site | null; redirectTo?: string; at: number }>()
const HOST_TTL = 20_000

export async function siteForHost(env: Env, host: string): Promise<{ site: Site | null; redirectTo?: string }> {
  host = host.toLowerCase().replace(/:\d+$/, '')
  const hit = hostCache.get(host)
  if (hit && Date.now() - hit.at < HOST_TTL) return hit

  let site: Site | null = null
  let redirectTo: string | undefined
  const direct = await env.DB.prepare('SELECT * FROM sites WHERE domain = ?').bind(host).first<SiteRow>()
  if (direct) site = rowToSite(direct)
  else {
    // aliases is a JSON array; json_each lets SQLite search inside it
    const alias = await env.DB.prepare(
      'SELECT s.* FROM sites s, json_each(s.aliases) a WHERE a.value = ? LIMIT 1',
    )
      .bind(host)
      .first<SiteRow>()
    if (alias) {
      site = rowToSite(alias)
      // preview hosts (workers.dev, localhost) serve directly; real alias domains 301 to the primary
      const servesDirectly = /(\.workers\.dev|\.pages\.dev|localhost|127\.0\.0\.1)$/.test(host)
      if (!servesDirectly) redirectTo = site.domain
    }
  }
  const entry = { site, redirectTo, at: Date.now() }
  hostCache.set(host, entry)
  return entry
}

export function clearHostCache() {
  hostCache.clear()
}

export async function getSite(env: Env, id: number): Promise<Site | null> {
  const r = await env.DB.prepare('SELECT * FROM sites WHERE id = ?').bind(id).first<SiteRow>()
  return r ? rowToSite(r) : null
}

export async function listSites(env: Env): Promise<Site[]> {
  const { results } = await env.DB.prepare('SELECT * FROM sites ORDER BY name').all<SiteRow>()
  return results.map(rowToSite)
}

/** Invalidate a site's edge cache: every cached page key includes cache_version. */
export async function bumpCache(env: Env, siteId: number) {
  await env.DB.prepare("UPDATE sites SET cache_version = cache_version + 1, updated_at = datetime('now') WHERE id = ?")
    .bind(siteId)
    .run()
  clearHostCache()
}

// ---------------------------------------------------------------- content

type ContentRow = Omit<Content, 'blocks' | 'data' | 'categories'> & { blocks: string; data: string }

export function rowToContent(r: ContentRow): Content {
  return { ...r, blocks: parseJSON<Block[]>(r.blocks, []), data: parseJSON(r.data, {}) }
}

export async function getContentByPath(env: Env, siteId: number, path: string, includeDrafts = false) {
  const r = await env.DB.prepare(
    `SELECT * FROM content WHERE site_id = ? AND path = ? ${includeDrafts ? '' : "AND status = 'published'"}`,
  )
    .bind(siteId, path)
    .first<ContentRow>()
  if (!r) return null
  const c = rowToContent(r)
  if (c.type === 'post') c.categories = await categoriesFor(env, c.id)
  return c
}

export async function getContentById(env: Env, id: number) {
  const r = await env.DB.prepare('SELECT * FROM content WHERE id = ?').bind(id).first<ContentRow>()
  if (!r) return null
  const c = rowToContent(r)
  c.categories = await categoriesFor(env, c.id)
  return c
}

export async function categoriesFor(env: Env, contentId: number): Promise<Category[]> {
  const { results } = await env.DB.prepare(
    `SELECT c.id, c.slug, c.name, c.description FROM categories c
     JOIN content_categories cc ON cc.category_id = c.id WHERE cc.content_id = ? ORDER BY c.name`,
  )
    .bind(contentId)
    .all<Category>()
  return results
}

export type PostSummary = Pick<Content, 'id' | 'path' | 'title' | 'h1' | 'excerpt' | 'image' | 'published_at'> & {
  minutes: number
  cats: string // "slug:Name|slug:Name"
}

/** Posts for listings: never selects body_html, so listing pages stay cheap. */
export async function listPosts(
  env: Env,
  siteId: number,
  opts: { limit: number; offset?: number; categoryId?: number },
): Promise<{ posts: PostSummary[]; total: number }> {
  const where = opts.categoryId
    ? `c.site_id = ? AND c.type = 'post' AND c.status = 'published' AND c.id IN (SELECT content_id FROM content_categories WHERE category_id = ?)`
    : `c.site_id = ? AND c.type = 'post' AND c.status = 'published'`
  const binds: unknown[] = opts.categoryId ? [siteId, opts.categoryId] : [siteId]
  const [list, count] = await env.DB.batch([
    env.DB.prepare(
      `SELECT c.id, c.path, c.title, c.h1, c.excerpt, c.image, c.published_at,
              CAST(json_extract(c.data, '$.minutes') AS INTEGER) AS minutes,
              (SELECT group_concat(cat.slug || ':' || cat.name, '|') FROM categories cat
                 JOIN content_categories cc ON cc.category_id = cat.id WHERE cc.content_id = c.id) AS cats
       FROM content c WHERE ${where}
       ORDER BY c.published_at DESC, c.id DESC LIMIT ? OFFSET ?`,
    ).bind(...binds, opts.limit, opts.offset ?? 0),
    env.DB.prepare(`SELECT COUNT(*) AS n FROM content c WHERE ${where}`).bind(...binds),
  ])
  return {
    posts: (list.results as PostSummary[]) ?? [],
    total: ((count.results?.[0] as { n: number }) ?? { n: 0 }).n,
  }
}

export async function listCategories(env: Env, siteId: number) {
  const { results } = await env.DB.prepare(
    `SELECT c.*, (SELECT COUNT(*) FROM content_categories cc JOIN content p ON p.id = cc.content_id
                   WHERE cc.category_id = c.id AND p.status = 'published') AS n
     FROM categories c WHERE c.site_id = ? ORDER BY c.name`,
  )
    .bind(siteId)
    .all<Category & { n: number }>()
  return results
}

export async function getCategory(env: Env, siteId: number, slug: string) {
  return env.DB.prepare('SELECT * FROM categories WHERE site_id = ? AND slug = ?').bind(siteId, slug).first<Category>()
}

export async function getShared(env: Env, siteId: number, key: string): Promise<Block[]> {
  const r = await env.DB.prepare('SELECT blocks FROM shared_blocks WHERE site_id = ? AND key = ?')
    .bind(siteId, key)
    .first<{ blocks: string }>()
  return r ? parseJSON<Block[]>(r.blocks, []) : []
}

export async function getRedirect(env: Env, siteId: number, path: string) {
  return env.DB.prepare('SELECT to_path, code FROM redirects WHERE site_id = ? AND from_path = ?')
    .bind(siteId, path)
    .first<{ to_path: string; code: number }>()
}

export async function sitemapEntries(env: Env, siteId: number) {
  const { results } = await env.DB.prepare(
    `SELECT path, type, COALESCE(updated_at, published_at) AS lastmod FROM content
     WHERE site_id = ? AND status = 'published' AND noindex = 0 ORDER BY type, path`,
  )
    .bind(siteId)
    .all<{ path: string; type: string; lastmod: string }>()
  return results
}

/** Replace a content item's categories, creating any that don't exist yet. */
export async function setCategories(env: Env, siteId: number, contentId: number, cats: { slug: string; name: string }[]) {
  const stmts = [env.DB.prepare('DELETE FROM content_categories WHERE content_id = ?').bind(contentId)]
  for (const c of cats) {
    stmts.push(
      env.DB.prepare('INSERT INTO categories (site_id, slug, name) VALUES (?, ?, ?) ON CONFLICT (site_id, slug) DO NOTHING').bind(
        siteId,
        c.slug,
        c.name,
      ),
      env.DB.prepare(
        'INSERT OR IGNORE INTO content_categories (content_id, category_id) SELECT ?, id FROM categories WHERE site_id = ? AND slug = ?',
      ).bind(contentId, siteId, c.slug),
    )
  }
  await env.DB.batch(stmts)
}
