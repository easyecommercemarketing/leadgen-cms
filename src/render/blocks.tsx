import { raw } from 'hono/html'
import type { Block, Content, Env, FormDef, Site } from '../types'
import { getShared, listPosts, type PostSummary } from '../lib/db'
import { md, mdInline } from '../lib/markdown'
import { fillPlaceholders, formatDate } from '../lib/util'
import { RoiCalculator } from './roi'
import { buyersForArea, type Buyer } from '../lib/routing'

export type Ctx = {
  env: Env
  site: Site
  content: Content | null
  jsonld: object[]
  h1Done: boolean // each page gets exactly one H1
  vars: Record<string, string> // {{placeholders}} available to block text
}

type Img = string | { src: string; alt?: string; w?: number; h?: number }

function Image(props: { img?: Img; alt?: string; eager?: boolean; class?: string }) {
  if (!props.img) return null
  const o = typeof props.img === 'string' ? { src: props.img } : props.img
  if (!o.src) return null
  return (
    <img
      src={o.src}
      alt={o.alt ?? props.alt ?? ''}
      width={o.w}
      height={o.h}
      loading={props.eager ? 'eager' : 'lazy'}
      decoding="async"
      fetchpriority={props.eager ? 'high' : undefined}
      class={props.class}
    />
  )
}

function Heading(props: { ctx: Ctx; text?: string; level?: 2 | 3; primary?: boolean; class?: string }) {
  const { ctx } = props
  let text = props.text
  // renderBlocks decides up front which block owns the page's single H1 (passed in as primary)
  if (props.primary) {
    text = text || ctx.content?.h1 || ctx.content?.title || ''
    return <h1 class={props.class}>{raw(mdInline(text))}</h1>
  }
  if (!text) return null
  return props.level === 3 ? (
    <h3 class={props.class}>{raw(mdInline(text))}</h3>
  ) : (
    <h2 class={props.class}>{raw(mdInline(text))}</h2>
  )
}

function Buttons(props: { buttons?: { label: string; href: string }[]; center?: boolean }) {
  if (!props.buttons?.length) return null
  return (
    <div class="btns" style={props.center ? 'justify-content:center' : undefined}>
      {props.buttons.map((b) => (
        <a class="btn lg" href={b.href}>
          {b.label}
        </a>
      ))}
    </div>
  )
}

const secClass = (b: Block) => `sec${b.bg ? ' ' + String(b.bg).replace(/[^a-z-]/g, '') : ''}`

export function PostCard(props: { p: PostSummary; blogPath: string }) {
  const { p } = props
  const cats = (p.cats || '').split('|').filter(Boolean).map((c) => c.split(':')[1])
  return (
    <a class="pcard" href={p.path}>
      {p.image ? <Image img={p.image} alt="" /> : null}
      <div class="c-body">
        <h3>{p.h1 || p.title}</h3>
        {p.excerpt ? <p>{p.excerpt}</p> : null}
        <div class="meta" style="margin-top:auto">
          {formatDate(p.published_at)}
          {p.minutes ? ` · ${p.minutes} min read` : ''}
          {cats.length ? ` · ${cats.join(', ')}` : ''}
        </div>
      </div>
    </a>
  )
}

export function LeadForm(props: { ctx: Ctx; formKey: string; submit?: string }) {
  const { site } = props.ctx
  const def: FormDef | undefined = site.settings.forms?.[props.formKey]
  if (!def) return <p>Form “{props.formKey}” is not set up.</p>
  const ts = site.settings.turnstile_sitekey
  return (
    <form class="form" method="post" action="/api/lead">
      <div class="full form-err" hidden style="background:#fdecef;color:#9b1c31;padding:10px 14px;border-radius:6px"></div>
      {raw(
        `<script>(function(){var e=new URLSearchParams(location.search).get('error');if(!e)return;var d=document.currentScript.parentNode.querySelector('.form-err');d.hidden=false;d.textContent=e==='spam'?'Sorry, the spam check failed. Please try again.':'Please fill in all the required fields.';d.scrollIntoView({block:'center'})})()</script>`,
      )}
      <input type="hidden" name="_form" value={props.formKey} />
      <input type="hidden" name="_page" value={props.ctx.content?.path || '/'} />
      {/* location the visitor came from (location pages link here with ?area=/kent); used for lead routing */}
      <input type="hidden" name="_area" value={props.ctx.content?.type === 'location' ? props.ctx.content.path : ''} />
      {props.ctx.content?.type === 'location'
        ? null
        : raw(
            `<script>(function(){var a=new URLSearchParams(location.search).get('area');if(!a)try{a=sessionStorage.getItem('lead_area')}catch(e){}if(a&&/^\\/[a-z0-9-]+$/.test(a)){var f=document.currentScript.parentNode;f.querySelector('[name=_area]').value=a}})()</script>`,
          )}
      <div class="hp" aria-hidden="true">
        <label>
          Leave this empty <input type="text" name="_hp" tabindex={-1} autocomplete="off" />
        </label>
      </div>
      {def.fields.map((f) => {
        const id = `f-${props.formKey}-${f.name}`
        const full = f.width === 'full' || f.type === 'textarea'
        const label = (
          <label for={id}>
            {f.label}
            {f.required ? <span class="req"> *</span> : null}
          </label>
        )
        if (f.type === 'checkbox')
          return (
            <label class="chk full">
              <input type="checkbox" name={f.name} value="yes" required={f.required} /> {f.label}
            </label>
          )
        return (
          <div class={full ? 'full' : undefined}>
            {label}
            {f.type === 'textarea' ? (
              <textarea id={id} name={f.name} required={f.required} placeholder={f.placeholder}></textarea>
            ) : f.type === 'select' ? (
              <select id={id} name={f.name} required={f.required}>
                <option value="">Select…</option>
                {(f.options || []).map((o) => (
                  <option>{o}</option>
                ))}
              </select>
            ) : (
              <input
                id={id}
                name={f.name}
                type={f.type}
                required={f.required}
                placeholder={f.placeholder}
                autocomplete={f.type === 'email' ? 'email' : f.type === 'tel' ? 'tel' : f.name.includes('name') ? f.name : undefined}
              />
            )}
          </div>
        )
      })}
      {def.consent ? (
        <label class="chk full">
          <input type="checkbox" name="_consent" value="yes" /> {def.consent}
        </label>
      ) : null}
      {ts ? (
        <div class="full">
          <div class="cf-turnstile" data-sitekey={ts}></div>
          <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
        </div>
      ) : null}
      <div class="full">
        <button class="btn lg block" type="submit">
          {props.submit || def.submit || 'Submit'}
        </button>
      </div>
    </form>
  )
}

/** Expand shared blocks and pre-fetch anything async, then render. */
export async function renderBlocks(ctx: Ctx, blocks: Block[], depth = 0): Promise<any[]> {
  const out: any[] = []
  for (const raw0 of blocks) {
    const b = fillPlaceholders(raw0, ctx.vars)
    if (b.type === 'shared') {
      if (depth > 3) continue
      const inner = await getShared(ctx.env, ctx.site.id, b.key)
      out.push(...(await renderBlocks(ctx, inner, depth + 1)))
      continue
    }
    // the first hero, or the first block marked "primary", owns the page's H1
    b._h1 = false
    if (!ctx.h1Done && (b.type === 'hero' || b.primary)) {
      b._h1 = true
      ctx.h1Done = true
    }
    if (b.type === 'featured_buyer') {
      // only on location pages that an active buyer with a public listing has bought
      if (ctx.content?.type !== 'location') continue
      const listed = (await buyersForArea(ctx.env, ctx.site.id, ctx.content.path)).find((x) => x.show_listing)
      if (!listed) continue
      b._buyer = listed
    }
    if (b.type === 'posts') {
      const { posts } = await listPosts(ctx.env, ctx.site.id, { limit: b.count || 6 })
      b._posts = posts
    }
    out.push(renderBlock(ctx, b))
  }
  return out
}

function renderBlock(ctx: Ctx, b: Block): any {
  switch (b.type) {
    case 'hero':
      return (
        <section class={`hero ${secClass(b)}`}>
          <div class="wrap">
            <div class={`split${b.image_side === 'left' ? ' img-left' : ''}`} style={b.image ? undefined : 'grid-template-columns:1fr'}>
              <div class={b.center ? 'center' : undefined}>
                {b.eyebrow ? <div class="eyebrow">{b.eyebrow}</div> : null}
                <Heading ctx={ctx} text={b.heading} primary={b._h1} />
                {b.text ? <div class="lead">{raw(md(b.text))}</div> : null}
                <Buttons buttons={b.buttons} center={b.center} />
              </div>
              {b.image ? (
                <div class="s-media">
                  <Image img={b.image} alt={b.image_alt} eager />
                </div>
              ) : null}
            </div>
          </div>
        </section>
      )

    case 'text':
      return (
        <section class={secClass(b)}>
          <div class={b.wide ? 'wrap' : 'narrow'}>
            <div class={b.center ? 'center' : undefined}>
              <Heading ctx={ctx} text={b.heading} primary={b._h1} />
              <div class="prose">{raw(md(b.md))}</div>
              <Buttons buttons={b.buttons} center={b.center} />
            </div>
          </div>
        </section>
      )

    case 'split':
      return (
        <section class={secClass(b)}>
          <div class="wrap">
            <div class={`split${b.image_side === 'left' ? ' img-left' : ''}`} style={Array.isArray(b.images) ? 'align-items:start' : undefined}>
              <div>
                <Heading ctx={ctx} text={b.heading} primary={b._h1} />
                <div class="prose">{raw(md(b.md))}</div>
                <Buttons buttons={b.buttons} />
              </div>
              <div class="s-media">
                {(Array.isArray(b.images) ? b.images : [b.image]).map((im: Img) => (
                  <div style="margin-bottom:14px">
                    <Image img={im} alt={b.image_alt} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )

    case 'services':
      // heading + list of service rows, each with optional image alternating sides
      return (
        <section class={secClass(b)}>
          <div class="wrap">
            {b.heading ? (
              <div class="center" style="margin-bottom:32px">
                <Heading ctx={ctx} text={b.heading} />
                {b.intro ? <div class="lead">{raw(md(b.intro))}</div> : null}
              </div>
            ) : null}
            {(b.items || []).map((it: any, i: number) =>
              it.image ? (
                <div class={`split svc${i % 2 ? ' img-left' : ''}`} style="margin-bottom:40px">
                  <div>
                    <Heading ctx={ctx} text={it.title} level={3} />
                    <div class="prose">{raw(md(it.md))}</div>
                    {it.button ? <Buttons buttons={[it.button]} /> : null}
                  </div>
                  <div class="s-media">
                    <Image img={it.image} alt={it.title} />
                  </div>
                </div>
              ) : (
                <div class="svc narrow" style="padding:0">
                  <Heading ctx={ctx} text={it.title} level={3} />
                  <div class="prose">{raw(md(it.md))}</div>
                </div>
              ),
            )}
            {b.buttons ? <Buttons buttons={b.buttons} center /> : null}
          </div>
        </section>
      )

    case 'cards':
      return (
        <section class={secClass(b)}>
          <div class="wrap">
            {b.heading ? (
              <div class="center" style="margin-bottom:32px">
                <Heading ctx={ctx} text={b.heading} />
                {b.intro ? <div class="lead">{raw(md(b.intro))}</div> : null}
              </div>
            ) : null}
            <div class={`cols cols-${b.columns || 3}`}>
              {(b.items || []).map((it: any) => (
                <div class="card">
                  {it.image ? <Image img={it.image} alt={it.title} /> : null}
                  <div class="c-body">
                    <Heading ctx={ctx} text={it.title} level={3} />
                    <div>{raw(md(it.md))}</div>
                    {it.href ? (
                      <a class="c-link" href={it.href}>
                        {it.link_label || 'Learn more →'}
                      </a>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
            {b.buttons ? (
              <div style="margin-top:32px">
                <Buttons buttons={b.buttons} center />
              </div>
            ) : null}
          </div>
        </section>
      )

    case 'logos':
      return (
        <section class={secClass(b)}>
          <div class="wrap center">
            <Heading ctx={ctx} text={b.heading} />
            <div class="logos" style="margin-top:24px">
              {(b.items || []).map((im: Img) => (
                <Image img={im} />
              ))}
            </div>
          </div>
        </section>
      )

    case 'cases':
      return (
        <section class={secClass(b)}>
          <div class="wrap">
            <div class="center">
              <Heading ctx={ctx} text={b.heading} />
            </div>
            {(b.items || []).map((it: any) => (
              <div class="case">
                <div class="center">
                  <Heading ctx={ctx} text={it.title} level={3} />
                  <div>{raw(md(it.md))}</div>
                </div>
                <div class="case-media">
                  <Image img={it.image} alt={it.title} />
                </div>
              </div>
            ))}
          </div>
        </section>
      )

    case 'testimonials':
      return (
        <section class={`sec soft`} id={b.anchor}>
          <div class="wrap">
            <div class="center" style="margin-bottom:28px">
              {b.eyebrow ? <div class="eyebrow">{b.eyebrow}</div> : null}
              <Heading ctx={ctx} text={b.heading} />
            </div>
            <div class="cols cols-2">
              {(b.items || []).map((it: any) => (
                <div class={`tcard${b.style === 'light' ? ' light' : ''}`}>
                  <h3>{it.title}</h3>
                  <blockquote>{it.quote}</blockquote>
                  <cite>– {it.author}</cite>
                  {b.stars ? <div class="stars" aria-label="5 stars">★★★★★</div> : null}
                </div>
              ))}
            </div>
            <Buttons buttons={b.buttons} center />
          </div>
        </section>
      )

    case 'faq': {
      const items = b.items || []
      ctx.jsonld.push({
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: items.map((i: any) => ({
          '@type': 'Question',
          name: i.q,
          acceptedAnswer: { '@type': 'Answer', text: md(i.a) },
        })),
      })
      return (
        <section class={secClass(b)} id={b.anchor}>
          <div class="narrow faq">
            <div class="center" style="margin-bottom:24px">
              <Heading ctx={ctx} text={b.heading} />
            </div>
            {items.map((i: any) => (
              <details>
                <summary>{i.q}</summary>
                <div class="a">{raw(md(i.a))}</div>
              </details>
            ))}
          </div>
        </section>
      )
    }

    case 'cta':
      return (
        <section class="cta" id={b.anchor}>
          <div class="wrap">
            {b.eyebrow ? <div class="eyebrow">{b.eyebrow}</div> : null}
            <Heading ctx={ctx} text={b.heading} />
            {b.md ? <div>{raw(md(b.md))}</div> : null}
            <Buttons buttons={b.buttons} center />
          </div>
        </section>
      )

    case 'posts': {
      const blogPath = ctx.site.settings.blog?.path || '/blog'
      return (
        <section class={secClass(b)}>
          <div class="wrap">
            <div class="center" style="margin-bottom:28px">
              <Heading ctx={ctx} text={b.heading} />
            </div>
            <div class="posts">
              {(b._posts as PostSummary[]).map((p) => (
                <PostCard p={p} blogPath={blogPath} />
              ))}
            </div>
            <div class="center" style="margin-top:32px">
              <a class="btn" href={blogPath}>
                {b.button_label || 'More articles'}
              </a>
            </div>
          </div>
        </section>
      )
    }

    case 'form':
      return (
        <section class={secClass(b)} id={b.anchor}>
          <div class="wrap">
            <div class={b.image || b.md ? 'split' : 'narrow'} style="align-items:start">
              {b.md || b.heading ? (
                <div>
                  <Heading ctx={ctx} text={b.heading} primary={b._h1} />
                  {b.md ? <div class="prose">{raw(md(b.md))}</div> : null}
                  {b.image ? <Image img={b.image} /> : null}
                </div>
              ) : null}
              <div class="formbox">
                <LeadForm ctx={ctx} formKey={b.form} submit={b.submit} />
              </div>
            </div>
          </div>
        </section>
      )

    case 'location_body': {
      // location pages: the unique "why" copy for this town, beside its proof images
      const d = ctx.content?.data || {}
      return (
        <section class={secClass(b)}>
          <div class="wrap">
            <div class="split img-left" style="align-items:start">
              <div>
                <Heading ctx={ctx} text={d.why_heading} />
                <div class="prose">{raw(d.why_html || md(d.why_md))}</div>
              </div>
              <div class="s-media">
                {(b.images || []).map((im: Img) => (
                  <div style="margin-bottom:14px">
                    <Image img={im} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )
    }

    case 'featured_buyer': {
      const x: Buyer = b._buyer
      const name = x.business || x.name
      const site = x.website && /^https?:\/\//.test(x.website) ? x.website : x.website ? `https://${x.website}` : ''
      return (
        <section class={secClass(b)} id="local-cleaner">
          <div class="wrap">
            <div class={`featured${x.form_key ? ' with-form' : ''}`}>
              <div class="fb-card">
                {b.eyebrow ? <div class="eyebrow">{b.eyebrow}</div> : null}
                <Heading ctx={ctx} text={b.heading || `Your local expert: ${name}`} />
                {x.logo ? <img class="fb-logo" src={x.logo} alt={name} loading="lazy" /> : null}
                {x.business && x.business !== name ? <p><b>{x.business}</b></p> : null}
                {x.blurb ? <div class="prose">{raw(md(x.blurb))}</div> : null}
                <ul class="fb-contact">
                  {x.public_phone ? (
                    <li>
                      <span>Phone</span> <a href={`tel:${x.public_phone.replace(/\s+/g, '')}`}>{x.public_phone}</a>
                    </li>
                  ) : null}
                  {x.public_email ? (
                    <li>
                      <span>Email</span> <a href={`mailto:${x.public_email}`}>{x.public_email}</a>
                    </li>
                  ) : null}
                  {site ? (
                    <li>
                      <span>Website</span>{' '}
                      <a href={site} target="_blank" rel="noopener">
                        {site.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                      </a>
                    </li>
                  ) : null}
                </ul>
                {x.public_phone ? (
                  <a class="btn lg" href={`tel:${x.public_phone.replace(/\s+/g, '')}`}>
                    Call {name}
                  </a>
                ) : null}
              </div>
              {x.form_key && ctx.site.settings.forms?.[x.form_key] ? (
                <div class="formbox">
                  <h3 style="margin-top:0">{b.form_heading || `Contact ${name}`}</h3>
                  <LeadForm ctx={ctx} formKey={x.form_key} />
                </div>
              ) : null}
            </div>
          </div>
        </section>
      )
    }

    case 'roi_calculator':
      return <RoiCalculator ctx={ctx} block={b} />

    case 'html':
      return raw(b.html || '')

    default:
      return null
  }
}
