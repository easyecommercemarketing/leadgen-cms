import { raw } from 'hono/html'
import type { Child } from 'hono/jsx'
import type { Site } from '../types'
import { BASE_CSS, themeVars } from './theme'

export type Seo = {
  title: string
  description?: string
  path: string
  image?: string
  noindex?: boolean
  type?: 'website' | 'article'
  published?: string | null
  jsonld?: object[]
}

function abs(site: Site, u: string) {
  if (!u) return ''
  return /^https?:\/\//.test(u) ? u : `https://${site.domain}${u.startsWith('/') ? '' : '/'}${u}`
}

const SOCIAL_LABEL: Record<string, string> = {
  facebook: 'f',
  instagram: 'ig',
  linkedin: 'in',
  x: 'X',
  twitter: 'X',
  youtube: 'yt',
  tiktok: 'tt',
}

export function Layout(props: { site: Site; seo: Seo; children: Child; bodyClass?: string }) {
  const { site, seo } = props
  const s = site.settings
  const t = site.theme
  const canonical = `https://${site.domain}${seo.path === '/' ? '/' : seo.path}`
  const ogImage = abs(site, seo.image || s.default_og_image || '')
  const nav = s.nav || []
  const ld = [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: site.name,
      url: `https://${site.domain}/`,
      ...(t.logo ? { logo: abs(site, t.logo) } : {}),
    },
    ...(seo.jsonld || []),
  ]

  return (
    <html lang="en-GB">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{seo.title}</title>
        {seo.description ? <meta name="description" content={seo.description} /> : null}
        <link rel="canonical" href={canonical} />
        {seo.noindex ? <meta name="robots" content="noindex, follow" /> : null}
        <meta property="og:type" content={seo.type || 'website'} />
        <meta property="og:title" content={seo.title} />
        {seo.description ? <meta property="og:description" content={seo.description} /> : null}
        <meta property="og:url" content={canonical} />
        <meta property="og:site_name" content={site.name} />
        {ogImage ? <meta property="og:image" content={ogImage} /> : null}
        <meta name="twitter:card" content={ogImage ? 'summary_large_image' : 'summary'} />
        {seo.published ? <meta property="article:published_time" content={seo.published} /> : null}
        {t.favicon ? <link rel="icon" href={t.favicon} /> : null}
        {t.fonts?.google ? (
          <>
            <link rel="preconnect" href="https://fonts.googleapis.com" />
            <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" />
            <link rel="stylesheet" href={`https://fonts.googleapis.com/css2?${t.fonts.google}&display=swap`} />
          </>
        ) : null}
        <style>{raw(themeVars(t) + BASE_CSS)}</style>
        <script type="application/ld+json">{raw(JSON.stringify(ld).replace(/</g, '\\u003c'))}</script>
        {s.ga4 ? (
          <>
            <script async src={`https://www.googletagmanager.com/gtag/js?id=${s.ga4}`}></script>
            {raw(
              `<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${s.ga4}');</script>`,
            )}
          </>
        ) : null}
        {s.head_html ? raw(s.head_html) : null}
      </head>
      <body class={props.bodyClass}>
        <header class="hdr">
          <div class="wrap">
            <a class="logo" href="/" aria-label={`${site.name} home`}>
              {t.logo ? (
                <img src={t.logo} alt={site.name} width={t.logo_width || 120} style={`width:${t.logo_width || 120}px`} />
              ) : (
                <strong>{site.name}</strong>
              )}
            </a>
            <input type="checkbox" id="menu" class="menu-toggle" aria-hidden="true" />
            <label for="menu" class="menu-btn" aria-label="Menu">
              ☰
            </label>
            <nav class="nav" aria-label="Main">
              {nav.map((n, i) => (
                <a
                  href={n.href}
                  class={i === nav.length - 1 && /audit|contact|quote/i.test(n.label) ? 'btn' : undefined}
                  aria-current={n.href === seo.path ? 'page' : undefined}
                >
                  {n.label}
                </a>
              ))}
            </nav>
          </div>
        </header>
        <main>{props.children}</main>
        <footer class="ftr">
          <div class="wrap">
            {s.footer?.social?.length ? (
              <div class="social">
                {s.footer.social.map((x) => (
                  <a href={x.href} target="_blank" rel="noopener" aria-label={x.label}>
                    <span style="font-weight:700;font-size:.85rem">{SOCIAL_LABEL[x.label.toLowerCase()] || x.label[0]}</span>
                  </a>
                ))}
              </div>
            ) : null}
            {s.footer?.links?.length ? (
              <div class="flinks">
                {s.footer.links.map((x) => (
                  <a href={x.href}>{x.label}</a>
                ))}
              </div>
            ) : null}
            {s.footer?.hours ? <div>{s.footer.hours}</div> : null}
            <hr />
            <div>{(s.footer?.text || `© ${site.name} {year}. All rights reserved.`).replace('{year}', String(new Date().getFullYear()))}</div>
          </div>
        </footer>
      </body>
    </html>
  )
}
