import { Hono } from 'hono'
import type { Env, Site } from './types'
import { getContentByPath, getRedirect, getSite, siteForHost } from './lib/db'
import { cached } from './lib/cache'
import { verifyAccess } from './lib/access'
import { normPath } from './lib/util'
import { handleLead } from './api/lead'
import { admin } from './admin/routes'
import {
  renderBlogIndex,
  renderCategory,
  renderNotFound,
  renderPage,
  renderPost,
  renderProduct,
  renderRobots,
  renderRss,
  renderSitemap,
} from './render/views'

// ---------------------------------------------------------------- shared site renderer

async function serveMedia(env: Env, site: Site, filename: string, req: Request): Promise<Response> {
  const obj = await env.MEDIA.get(`${site.slug}/${filename}`)
  if (!obj) return new Response('Not found', { status: 404 })
  const headers = new Headers()
  obj.writeHttpMetadata(headers)
  headers.set('etag', obj.httpEtag)
  headers.set('cache-control', 'public, max-age=31536000, immutable')
  if (req.headers.get('if-none-match') === obj.httpEtag) return new Response(null, { status: 304, headers })
  return new Response(obj.body, { headers })
}

/** Resolves a path for a site to a response. Used by the live sites and by the admin preview. */
async function renderPath(env: Env, site: Site, url: URL, opts: { drafts?: boolean; base?: string } = {}): Promise<Response> {
  const path = normPath(url.pathname.slice((opts.base || '').length) || '/')
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1)
  const base = opts.base || ''

  const rd = await getRedirect(env, site.id, path)
  if (rd) {
    const to = /^https?:\/\//.test(rd.to_path) ? rd.to_path : base + rd.to_path
    return new Response(null, { status: rd.code, headers: { location: to } })
  }

  const c = await getContentByPath(env, site.id, path, opts.drafts)
  if (c) {
    if (c.type === 'post') return renderPost(env, site, c)
    if (c.type === 'product') return renderProduct(env, site, c)
    return renderPage(env, site, c)
  }

  const blogPath = site.settings.blog?.path || '/blog'
  if (path === blogPath) return (await renderBlogIndex(env, site, page)) || renderNotFound(env, site)
  if (path.startsWith(`${blogPath}/category/`)) {
    const r = await renderCategory(env, site, path.slice(`${blogPath}/category/`.length), page)
    if (r) return r
  }
  return renderNotFound(env, site)
}

// ---------------------------------------------------------------- admin host

const adminApp = new Hono<{ Bindings: Env; Variables: { user: string } }>()

adminApp.use('*', async (c, next) => {
  const user = await verifyAccess(c.req.raw, c.env)
  if (!user) return c.text('Forbidden: this admin is protected by Cloudflare Access.', 403)
  c.set('user', user.email)
  await next()
})

// Preview any site's pages (drafts included, never cached) at /preview/<site id>/<path>
adminApp.all('/preview/:sid/*', async (c) => {
  const site = await getSite(c.env, Number(c.req.param('sid')))
  if (!site) return c.notFound()
  const url = new URL(c.req.url)
  const base = `/preview/${site.id}`
  const rest = url.pathname.slice(base.length) || '/'
  if (rest.startsWith('/media/')) return serveMedia(c.env, site, rest.slice(7), c.req.raw)
  if (rest === '/api/lead' && c.req.method === 'POST') return handleLead(c.req.raw, c.env, site, c.executionCtx as any)
  const res = await renderPath(c.env, site, url, { drafts: true, base })
  // keep the preview's links inside the preview
  if ((res.headers.get('content-type') || '').includes('text/html')) {
    const html = (await res.text())
      .replace(/(href|src|action)="\/(?!\/)/g, `$1="${base}/`)
      .replace(/<head>/, '<head><meta name="robots" content="noindex">')
    return new Response(html, { status: res.status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } })
  }
  return res
})
adminApp.get('/preview/:sid', (c) => c.redirect(`/preview/${c.req.param('sid')}/`))

adminApp.route('/', admin)

// ---------------------------------------------------------------- entry

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url)
    const host = url.hostname.toLowerCase()

    if (host === env.ADMIN_HOST) return adminApp.fetch(req, env, ctx)

    const { site, redirectTo } = await siteForHost(env, host)
    if (!site) return new Response(`No site is configured for ${host}.`, { status: 404 })
    if (redirectTo) return Response.redirect(`https://${redirectTo}${url.pathname}${url.search}`, 301)

    // one canonical URL per page: no trailing slash, no repeated slashes
    if (url.pathname.length > 1 && (url.pathname.endsWith('/') || url.pathname.includes('//'))) {
      return Response.redirect(`${url.origin}${normPath(url.pathname)}${url.search}`, 301)
    }

    const p = url.pathname
    if (p === '/robots.txt') return renderRobots(site)
    if (p === '/sitemap.xml') return cached(site, req, ctx, () => renderSitemap(env, site))
    if (p === '/rss.xml' || p === '/feed') return cached(site, req, ctx, () => renderRss(env, site))
    if (p.startsWith('/media/')) return serveMedia(env, site, decodeURIComponent(p.slice(7)), req)
    if (p === '/api/lead') {
      if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })
      return handleLead(req, env, site, ctx)
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') return new Response('Method not allowed', { status: 405 })

    return cached(site, req, ctx, () => renderPath(env, site, url))
  },
} satisfies ExportedHandler<Env>
