import type { Block, ContentType, Env } from '../types'
import { setCategories } from '../lib/db'
import { md } from '../lib/markdown'
import { normPath, readingMinutes, slugify, stripTags, truncate } from '../lib/util'

export type ContentInput = {
  id?: number
  type: ContentType
  path: string
  title?: string
  meta_description?: string
  h1?: string
  excerpt?: string
  blocks?: Block[]
  body_md?: string
  data?: Record<string, any>
  image?: string
  status?: 'draft' | 'published'
  noindex?: boolean | number
  published_at?: string | null
  categories?: { slug: string; name: string }[]
}

/** Validates, derives HTML/excerpt/reading time, and upserts one content item. Returns its id. */
export async function saveContent(env: Env, siteId: number, input: ContentInput): Promise<number> {
  const path = normPath(input.path)
  if (!['page', 'post', 'location', 'product'].includes(input.type)) throw new Error(`Bad type: ${input.type}`)
  if (!/^\/[^\s?#]*$/.test(path)) throw new Error(`Bad path: ${input.path}`)

  const data = { ...(input.data || {}) }
  const body_md = input.body_md || ''
  const body_html = md(body_md)
  if (input.type === 'post') data.minutes = readingMinutes(body_html)
  if (input.type === 'location' && data.why_md != null) data.why_html = md(data.why_md)

  const excerpt = input.excerpt?.trim() || (input.type === 'post' ? truncate(input.meta_description || stripTags(body_html), 170) : '')
  const status = input.status || 'published'
  const published_at = input.published_at || (status === 'published' ? new Date().toISOString() : null)

  const row = await env.DB.prepare(
    `INSERT INTO content (site_id, type, path, title, meta_description, h1, excerpt, blocks, body_md, body_html, data, image, status, noindex, published_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT (site_id, path) DO UPDATE SET
       type = excluded.type, title = excluded.title, meta_description = excluded.meta_description, h1 = excluded.h1,
       excerpt = excluded.excerpt, blocks = excluded.blocks, body_md = excluded.body_md, body_html = excluded.body_html,
       data = excluded.data, image = excluded.image, status = excluded.status, noindex = excluded.noindex,
       published_at = excluded.published_at, updated_at = datetime('now')
     RETURNING id`,
  )
    .bind(
      siteId,
      input.type,
      path,
      input.title || '',
      input.meta_description || '',
      input.h1 || '',
      excerpt,
      JSON.stringify(input.blocks || []),
      body_md,
      body_html,
      JSON.stringify(data),
      input.image || '',
      status,
      input.noindex ? 1 : 0,
      published_at,
    )
    .first<{ id: number }>()
  const id = row!.id

  // Path changed on an existing item: move it (the upsert above created/updated the new path)
  if (input.id && input.id !== id) {
    await env.DB.prepare('DELETE FROM content WHERE id = ? AND site_id = ?').bind(input.id, siteId).run()
  }

  if (input.categories) await setCategories(env, siteId, id, input.categories)
  return id
}

/** "SEO, Social Media" → [{slug:'seo',name:'SEO'},{slug:'social-media',name:'Social Media'}] */
export function parseCategoryList(s: string) {
  return s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
    .map((name) => ({ slug: slugify(name), name }))
}
