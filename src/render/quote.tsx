import { raw } from 'hono/html'
import type { Block, FormDef } from '../types'
import type { Ctx } from './blocks'

// Window cleaning quote calculator. The widget itself is public/quote-calculator.js (also embeddable on outside sites).
// Prices and options come from the block; anything left out uses the widget's defaults. Leads go through /api/lead
// with the block's form (default "quote_calc"), so the honeypot, Turnstile, buyer routing and email alerts all apply.
// The form must list every field the widget sends (see admin docs), because /api/lead keeps only listed fields.

const VERSION = 1 // bump when public/quote-calculator.js changes, so browsers fetch the new copy

const LAYOUT_KEYS = new Set(['type', 'anchor', 'primary', '_h1'])

export function QuoteCalculator(props: { ctx: Ctx; block: Block }) {
  const { site, content } = props.ctx
  const b = props.block
  const formKey = String(b.form || 'quote_calc')
  const def: FormDef | undefined = site.settings.forms?.[formKey]
  if (!def) return <p>Form “{formKey}” is not set up.</p>

  const colors = site.theme.colors || {}
  const consentField = def.fields.find((f) => f.type === 'checkbox' && f.required)
  const opts: Record<string, any> = {}
  for (const [k, v] of Object.entries(b)) if (!LAYOUT_KEYS.has(k)) opts[k] = v

  const cfg = {
    business: site.name,
    brand: colors.brand || colors.primary || undefined,
    ...opts,
    form: formKey,
    page: content?.path || '/',
    area: content?.type === 'location' ? content.path : '',
    consent: consentField?.label || '',
    consentName: consentField?.name || '',
    turnstile: site.settings.turnstile_sitekey || '',
    webhook: '',
  }
  const json = JSON.stringify(cfg).replace(/</g, '\\u003c')

  return (
    <section class="sec" id={b.anchor || undefined}>
      <div class="wrap">
        {/* the action attribute is rewritten in the admin preview, so the widget posts to the right place there too */}
        <form hidden id="wq-ep" action="/api/lead"></form>
        <div id="wq-quote"></div>
        {raw(`<script>window.WQ_CONFIG=Object.assign(${json},{endpoint:document.getElementById('wq-ep').getAttribute('action')})</script>`)}
        <script src={`/quote-calculator.js?v=${VERSION}`} defer></script>
      </div>
    </section>
  )
}
