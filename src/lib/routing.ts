import type { Env, Site } from '../types'
import { normPath } from './util'

export type Buyer = {
  id: number
  site_id: number
  name: string
  business: string
  email: string
  phone: string
  monthly_price: number | null
  active: number
  notes: string
  started_at: string | null
  show_listing: number
  public_phone: string
  public_email: string
  website: string
  logo: string
  blurb: string
  form_key: string
}

/**
 * Work out which location a lead belongs to. In order:
 *   1. it was submitted on a location page
 *   2. the visitor came from a location page (its quote buttons pass ?area=/kent, kept in a hidden _area field)
 *   3. a form field (settings.routing.area_field, e.g. "county") matches a location's town name
 * Returns the location's path, or '' if none matched.
 */
export async function resolveArea(env: Env, site: Site, page: string, hintedArea: string, fields: Record<string, string>): Promise<string> {
  const candidates = [normPath(page)]
  if (hintedArea) candidates.push(normPath(hintedArea))
  for (const p of candidates) {
    const hit = await env.DB.prepare("SELECT path FROM content WHERE site_id = ? AND path = ? AND type = 'location'")
      .bind(site.id, p)
      .first<{ path: string }>()
    if (hit) return hit.path
  }
  const fieldNames = ([] as string[]).concat(site.settings.routing?.area_field || [])
  for (const f of fieldNames) {
    const v = (fields[f] || '').trim().toLowerCase().replace(/^county\s+/, '').replace(/\s+/g, ' ')
    if (!v) continue
    const hit = await env.DB.prepare(
      `SELECT path FROM content WHERE site_id = ? AND type = 'location'
         AND (lower(json_extract(data, '$.town')) = ? OR lower(json_extract(data, '$.town')) = ? OR path = ?)
       LIMIT 1`,
    )
      .bind(site.id, v, 'county ' + v, '/' + v.replace(/\s+/g, '-'))
      .first<{ path: string }>()
    if (hit) return hit.path
  }
  return ''
}

// Locations are exclusive (the admin allows one active buyer per location), so this normally returns
// at most one buyer. If data ever has two, the earliest buyer wins so a lead is never sent twice.
export async function buyersForArea(env: Env, siteId: number, area: string): Promise<Buyer[]> {
  if (!area) return []
  const { results } = await env.DB.prepare(
    `SELECT b.* FROM buyers b JOIN buyer_areas a ON a.buyer_id = b.id
     WHERE b.site_id = ? AND b.active = 1 AND a.path = ? ORDER BY b.id LIMIT 1`,
  )
    .bind(siteId, area)
    .all<Buyer>()
  return results
}

export function emailsOf(b: Buyer): string[] {
  return b.email
    .split(/[,;\s]+/)
    .map((e) => e.trim())
    .filter((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e))
}
