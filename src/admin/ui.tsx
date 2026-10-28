import type { Child } from 'hono/jsx'
import type { Site } from '../types'

export function Admin(props: { title: string; site?: Site | null; active?: string; user?: string; children: Child; flash?: string }) {
  const s = props.site
  const tab = (key: string, href: string, label: string) => (
    <a href={href} class={props.active === key ? 'on' : undefined}>
      {label}
    </a>
  )
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{props.title} · CMS</title>
        <link rel="stylesheet" href="/_admin/admin.css" />
        <script src="/_admin/admin.js" defer></script>
      </head>
      <body>
        <header class="top">
          <a href="/" class="brand">
            LeadGen CMS
          </a>
          <nav>
            <a href="/">Sites</a>
            <a href="/leads">Leads</a>
          </nav>
          <span class="user">{props.user}</span>
        </header>
        {s ? (
          <div class="sitebar">
            <strong>{s.name}</strong>
            <span class="muted">{s.domain}</span>
            <nav>
              {tab('pages', `/sites/${s.id}/content?type=page`, 'Pages')}
              {tab('posts', `/sites/${s.id}/content?type=post`, 'Posts')}
              {tab('locations', `/sites/${s.id}/content?type=location`, 'Locations')}
              {tab('products', `/sites/${s.id}/content?type=product`, 'Products')}
              {tab('shared', `/sites/${s.id}/shared`, 'Sections')}
              {tab('media', `/sites/${s.id}/media`, 'Media')}
              {tab('redirects', `/sites/${s.id}/redirects`, 'Redirects')}
              {tab('leads', `/leads?site=${s.id}`, 'Leads')}
              {tab('settings', `/sites/${s.id}`, 'Settings')}
            </nav>
          </div>
        ) : null}
        <main class="main">
          {props.flash ? <div class="flash">{props.flash}</div> : null}
          {props.children}
        </main>
      </body>
    </html>
  )
}

export function Field(props: { label: string; name: string; value?: string | number | null; type?: string; help?: string; required?: boolean; placeholder?: string; mono?: boolean; rows?: number }) {
  const v = props.value == null ? '' : String(props.value)
  return (
    <label class="field">
      <span>
        {props.label}
        {props.help ? <em> · {props.help}</em> : null}
      </span>
      {props.type === 'textarea' ? (
        <textarea name={props.name} rows={props.rows || 6} class={props.mono ? 'mono' : undefined} placeholder={props.placeholder}>
          {v}
        </textarea>
      ) : (
        <input name={props.name} value={v} type={props.type || 'text'} required={props.required} placeholder={props.placeholder} />
      )}
    </label>
  )
}

export function Pager(props: { page: number; pages: number; href: (n: number) => string }) {
  if (props.pages <= 1) return null
  return (
    <div class="pager">
      {props.page > 1 ? <a href={props.href(props.page - 1)}>← Prev</a> : null}
      <span>
        Page {props.page} of {props.pages}
      </span>
      {props.page < props.pages ? <a href={props.href(props.page + 1)}>Next →</a> : null}
    </div>
  )
}

export async function page(node: any, status = 200) {
  return new Response('<!doctype html>' + (await Promise.resolve(node)).toString(), {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  })
}
