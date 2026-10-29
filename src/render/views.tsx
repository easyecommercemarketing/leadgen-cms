import { raw } from 'hono/html'
import type { Category, Content, Env, Site } from '../types'
import { getCategory, getShared, listCategories, listPosts, sitemapEntries } from '../lib/db'
import { escapeXml, formatDate } from '../lib/util'
import { renderBlocks, PostCard, type Ctx } from './blocks'
import { Layout, type Seo } from './layout'

function ctxFor(env: Env, site: Site, content: Content | null): Ctx {
  const vars: Record<string, string> = { site: site.name, year: String(new Date().getFullYear()) }
  if (content?.data?.town) vars.town = content.data.town
  if (content?.image) vars.image = content.image
  if (content) vars.path = content.path
  return { env, site, content, jsonld: [], h1Done: false, vars }
}

async function html(node: any, status = 200): Promise<Response> {
  const body = '<!doctype html>' + (await Promise.resolve(node)).toString()
  return new Response(body, { status, headers: { 'content-type': 'text/html; charset=utf-8' } })
}

function seoFor(c: Content): Seo {
  return {
    title: c.title || c.h1,
    description: c.meta_description,
    path: c.path,
    image: c.image,
    noindex: !!c.noindex,
  }
}

// ---------------------------------------------------------------- pages built from blocks

export async function renderPage(env: Env, site: Site, c: Content): Promise<Response> {
  const ctx = ctxFor(env, site, c)
  let blocks = c.blocks
  if (c.type === 'location') {
    const key = site.settings.location?.template || 'location_template'
    blocks = await getShared(env, site.id, key)
  }
  let body: any[]
  if (blocks.length) body = await renderBlocks(ctx, blocks)
  else
    body = [
      <section class="sec">
        <div class="narrow">
          <h1>{c.h1 || c.title}</h1>
          <div class="prose">{raw(c.body_html)}</div>
        </div>
      </section>,
    ]
  // a page whose blocks never produced an H1 still needs one for SEO; add it visually hidden
  const h1 = ctx.h1Done ? null : (
    <h1 style="position:absolute;left:-9999px">{c.h1 || c.title}</h1>
  )
  const seo = seoFor(c)
  seo.jsonld = ctx.jsonld
  const remember =
    c.type === 'location'
      ? raw(`<script>try{sessionStorage.setItem('lead_area',${JSON.stringify(c.path)})}catch(e){}</script>`)
      : null
  return html(
    <Layout site={site} seo={seo}>
      {h1}
      {body}
      {remember}
    </Layout>,
  )
}

// ---------------------------------------------------------------- blog post

export async function renderPost(env: Env, site: Site, c: Content): Promise<Response> {
  const blogPath = site.settings.blog?.path || '/blog'
  const ctx = ctxFor(env, site, c)
  ctx.h1Done = true
  const cats = c.categories || []
  const related = cats.length
    ? (await listPosts(env, site.id, { limit: 4, categoryId: cats[0].id })).posts.filter((p) => p.id !== c.id).slice(0, 3)
    : []
  const after = await renderBlocks(ctx, await getShared(env, site.id, 'post_footer'))
  const seo = seoFor(c)
  seo.type = 'article'
  seo.published = c.published_at
  seo.jsonld = [
    {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: c.h1 || c.title,
      description: c.meta_description,
      datePublished: c.published_at,
      dateModified: c.updated_at,
      image: c.image ? `https://${site.domain}${c.image}` : undefined,
      author: { '@type': 'Organization', name: site.name },
      publisher: { '@type': 'Organization', name: site.name },
      mainEntityOfPage: `https://${site.domain}${c.path}`,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `https://${site.domain}/` },
        { '@type': 'ListItem', position: 2, name: 'Blog', item: `https://${site.domain}${blogPath}` },
        { '@type': 'ListItem', position: 3, name: c.h1 || c.title },
      ],
    },
  ]
  return html(
    <Layout site={site} seo={seo}>
      <article class="article">
        <div class="narrow">
          <div class="crumbs">
            <a href="/">Home</a> › <a href={blogPath}>Blog</a>
          </div>
          <h1>{c.h1 || c.title}</h1>
          <div class="meta" style="margin-bottom:14px">
            {formatDate(c.published_at)}
            {c.data.minutes ? ` · ${c.data.minutes} min read` : ''}
          </div>
          {cats.length ? (
            <div class="tags" style="margin-bottom:22px">
              {cats.map((k) => (
                <a class="tag" href={`${blogPath}/category/${k.slug}`}>
                  {k.name}
                </a>
              ))}
            </div>
          ) : null}
          {c.image ? <img class="feat" src={c.image} alt={c.h1 || c.title} fetchpriority="high" /> : null}
          <div class="prose">{raw(c.body_html)}</div>
        </div>
      </article>
      {after}
      {related.length ? (
        <section class="sec soft">
          <div class="wrap">
            <h2 class="center">Related articles</h2>
            <div class="posts" style="margin-top:24px">
              {related.map((p) => (
                <PostCard p={p} blogPath={blogPath} />
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </Layout>,
  )
}

// ---------------------------------------------------------------- blog index + category pages

export async function renderBlogIndex(env: Env, site: Site, page: number, category?: Category | null) {
  const b = site.settings.blog || {}
  const blogPath = b.path || '/blog'
  const per = b.per_page || 12
  const { posts, total } = await listPosts(env, site.id, { limit: per, offset: (page - 1) * per, categoryId: category?.id })
  const pages = Math.max(1, Math.ceil(total / per))
  if (page > pages) return null
  const cats = (await listCategories(env, site.id)).filter((x) => x.n > 0)
  const base = category ? `${blogPath}/category/${category.slug}` : blogPath
  const title = category ? `${category.name} Articles` : b.title || 'Blog'
  const pageSuffix = page > 1 ? ` – Page ${page}` : ''
  const seo: Seo = {
    title: `${title}${pageSuffix} | ${site.name}`,
    description: category?.description || b.intro || `The latest articles from ${site.name}.`,
    path: base + (page > 1 ? `?page=${page}` : ''),
  }
  const link = (n: number) => (n === 1 ? base : `${base}?page=${n}`)
  const nums: number[] = []
  for (let i = 1; i <= pages; i++) if (i === 1 || i === pages || Math.abs(i - page) <= 2) nums.push(i)

  return html(
    <Layout site={site} seo={seo}>
      <section class="sec">
        <div class="wrap">
          <div class="center" style="margin-bottom:28px">
            <h1>
              {title}
              {pageSuffix}
            </h1>
            {!category && b.intro ? <p class="lead">{b.intro}</p> : null}
            {category?.description ? <p class="lead">{category.description}</p> : null}
          </div>
          <nav class="catbar" aria-label="Categories">
            <a class="tag" href={blogPath} style={!category ? 'background:var(--c-text);color:#fff' : undefined}>
              All
            </a>
            {cats.map((k) => (
              <a
                class="tag"
                href={`${blogPath}/category/${k.slug}`}
                style={category?.id === k.id ? 'background:var(--c-text);color:#fff' : undefined}
              >
                {k.name}
              </a>
            ))}
          </nav>
          <div class="posts">
            {posts.map((p) => (
              <PostCard p={p} blogPath={blogPath} />
            ))}
          </div>
          {pages > 1 ? (
            <nav class="pager" aria-label="Pages">
              {page > 1 ? <a href={link(page - 1)}>← Newer</a> : null}
              {nums.map((n, i) => (
                <>
                  {i > 0 && n - nums[i - 1] > 1 ? <span style="border:0">…</span> : null}
                  {n === page ? <span class="cur">{n}</span> : <a href={link(n)}>{n}</a>}
                </>
              ))}
              {page < pages ? <a href={link(page + 1)}>Older →</a> : null}
            </nav>
          ) : null}
        </div>
      </section>
    </Layout>,
  )
}

export async function renderCategory(env: Env, site: Site, slug: string, page: number) {
  const cat = await getCategory(env, site.id, slug)
  if (!cat) return null
  return renderBlogIndex(env, site, page, cat)
}

// ---------------------------------------------------------------- product

export async function renderProduct(env: Env, site: Site, c: Content): Promise<Response> {
  const d = c.data || {}
  const seo = seoFor(c)
  seo.jsonld = [
    {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: c.h1 || c.title,
      description: c.meta_description,
      image: c.image ? `https://${site.domain}${c.image}` : undefined,
      offers: d.price
        ? { '@type': 'Offer', price: d.price, priceCurrency: d.currency || 'GBP', availability: 'https://schema.org/InStock' }
        : undefined,
    },
  ]
  return html(
    <Layout site={site} seo={seo}>
      <section class="sec">
        <div class="wrap">
          <div class="crumbs">
            <a href="/">Home</a> › <a href={d.back_path || '/store'}>Store</a>
          </div>
          <div class="split" style="align-items:start">
            <div>{c.image ? <img src={c.image} alt={c.h1 || c.title} style="border-radius:var(--radius)" /> : null}</div>
            <div>
              <h1>{c.h1 || c.title}</h1>
              {d.price ? (
                <p style="font-size:1.6rem;font-weight:700;font-family:var(--f-heading)">
                  {({ GBP: '£', USD: '$', EUR: '€' } as Record<string, string>)[d.currency || 'GBP']}
                  {Number(d.price).toFixed(2)}
                </p>
              ) : null}
              {d.payment_link ? (
                <a class="btn lg" href={d.payment_link}>
                  {d.button_label || 'Buy now'}
                </a>
              ) : (
                <p class="meta">Checkout coming soon. Contact us to purchase.</p>
              )}
              <div class="prose" style="margin-top:24px">
                {raw(c.body_html)}
              </div>
            </div>
          </div>
        </div>
      </section>
    </Layout>,
  )
}

// ---------------------------------------------------------------- 404

export async function renderNotFound(env: Env, site: Site): Promise<Response> {
  const ctx = ctxFor(env, site, null)
  const custom = await getShared(env, site.id, 'not_found')
  const body = custom.length
    ? await renderBlocks(ctx, custom)
    : [
        <section class="sec">
          <div class="narrow center">
            <h1>Page not found</h1>
            <p class="lead">Sorry, that page doesn't exist or has moved.</p>
            <div class="btns" style="justify-content:center">
              <a class="btn" href="/">
                Go to the homepage
              </a>
            </div>
          </div>
        </section>,
      ]
  return html(
    <Layout site={site} seo={{ title: `Page not found | ${site.name}`, path: '/404', noindex: true }}>{body}</Layout>,
    404,
  )
}

// ---------------------------------------------------------------- feeds

export async function renderSitemap(env: Env, site: Site): Promise<Response> {
  const rows = await sitemapEntries(env, site.id)
  const blogPath = site.settings.blog?.path || '/blog'
  const cats = (await listCategories(env, site.id)).filter((c) => c.n > 0)
  const urls = [
    ...rows.map((r) => ({ loc: r.path, lastmod: r.lastmod })),
    { loc: blogPath, lastmod: '' },
    ...cats.map((c) => ({ loc: `${blogPath}/category/${c.slug}`, lastmod: '' })),
  ]
  const seen = new Set<string>()
  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls
      .filter((u) => (seen.has(u.loc) ? false : (seen.add(u.loc), true)))
      .map(
        (u) =>
          `<url><loc>${escapeXml(`https://${site.domain}${u.loc}`)}</loc>${
            u.lastmod ? `<lastmod>${u.lastmod.slice(0, 10)}</lastmod>` : ''
          }</url>`,
      )
      .join('\n') +
    '\n</urlset>\n'
  return new Response(xml, { headers: { 'content-type': 'application/xml; charset=utf-8' } })
}

export function renderRobots(site: Site): Response {
  return new Response(`User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: https://${site.domain}/sitemap.xml\n`, {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  })
}

export async function renderRss(env: Env, site: Site): Promise<Response> {
  const { posts } = await listPosts(env, site.id, { limit: 30 })
  const items = posts
    .map(
      (p) => `<item><title>${escapeXml(p.h1 || p.title)}</title><link>https://${site.domain}${p.path}</link><guid>https://${
        site.domain
      }${p.path}</guid>${p.published_at ? `<pubDate>${new Date(p.published_at).toUTCString()}</pubDate>` : ''}<description>${escapeXml(
        p.excerpt || '',
      )}</description></item>`,
    )
    .join('')
  const xml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${escapeXml(site.name)}</title><link>https://${
    site.domain
  }/</link><description>${escapeXml(site.name)} blog</description>${items}</channel></rss>`
  return new Response(xml, { headers: { 'content-type': 'application/rss+xml; charset=utf-8' } })
}
