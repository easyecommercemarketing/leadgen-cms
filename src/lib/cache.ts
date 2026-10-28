import type { Site } from '../types'

// Public pages are cached at the edge with a key that includes the site's cache_version.
// Publishing anything bumps cache_version, so stale copies are simply never looked up again
// and age out on their own. No purge API calls needed.

const TTL = 60 * 60 * 24 // a day; versioned keys make long TTLs safe

function keyFor(site: Site, url: URL): Request {
  const page = url.searchParams.get('page')
  const k = `https://edge-cache.internal/${site.id}/v${site.cache_version}${url.pathname}${page ? `?page=${page}` : ''}`
  return new Request(k, { method: 'GET' })
}

export async function cached(
  site: Site,
  req: Request,
  ctx: ExecutionContext,
  render: () => Promise<Response>,
): Promise<Response> {
  const url = new URL(req.url)
  // only cache plain GETs; any other query string (utm, gclid) still shares the clean cache entry
  if (req.method !== 'GET') return render()
  const cache = (caches as unknown as { default: Cache }).default
  const key = keyFor(site, url)
  const hit = await cache.match(key)
  if (hit) {
    const r = new Response(hit.body, hit)
    r.headers.set('x-cache', 'HIT')
    return r
  }
  const res = await render()
  if (res.status === 200 || res.status === 404) {
    const toStore = res.clone()
    const headers = new Headers(toStore.headers)
    headers.set('cache-control', `public, max-age=${TTL}`)
    ctx.waitUntil(cache.put(key, new Response(toStore.body, { status: toStore.status, headers })))
  }
  // browsers revalidate quickly; the edge holds the long copy
  res.headers.set('cache-control', 'public, max-age=60, stale-while-revalidate=600')
  res.headers.set('x-cache', 'MISS')
  return res
}
