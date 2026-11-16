// Store builder pricing: shared by the configurator on the page (as JSON for the browser)
// and the lead handler (which recalculates the quote so it can't be edited in the browser).

export type BuilderTier = { key: string; label: string; products: number; pages?: number; price: number; note?: string }
// addons with a "group" are pick-one (e.g. support length); the rest are tick boxes
export type BuilderAddon = { key: string; label: string; desc?: string; price?: number; per_product?: number; group?: string }
export type BuilderGroup = { key: string; label: string; hint?: string; none_label?: string } // none_label = the free default option
export type BuilderPalette = { key: string; label: string; colors: string[] } // [primary, accent, background]
export type BuilderConfig = {
  currency?: string
  tiers: BuilderTier[]
  addons: BuilderAddon[]
  groups?: BuilderGroup[]
  included?: string[] // shown as ticks in the summary
  industries: string[]
  palettes: BuilderPalette[]
  turnaround?: string
  price_note?: string // e.g. "One-off price, including VAT"
  vat?: { rate: number; included: boolean } // included: prices already contain VAT; otherwise VAT is added on top
  payment?: { provider: 'stripe'; product?: string; currency?: string } // take card payment when the form is sent (currency: Stripe code, default gbp)
}

export type QuoteLine = { label: string; amount: number }

export function addonPrice(a: BuilderAddon, tier: BuilderTier) {
  return a.per_product ? a.per_product * tier.products : a.price || 0
}

/** "Support after launch: 6 months" for pick-one options, the plain label otherwise */
export function addonLabel(cfg: BuilderConfig, a: BuilderAddon) {
  const g = a.group && cfg.groups?.find((x) => x.key === a.group)
  return g ? `${g.label}: ${a.label}` : a.label
}

export function quote(cfg: BuilderConfig, tierKey: string, addonKeys: string[]) {
  const tier = cfg.tiers.find((t) => t.key === tierKey)
  if (!tier) return null
  const seen = new Set<string>()
  const addons = cfg.addons.filter((a) => {
    if (!addonKeys.includes(a.key)) return false
    if (!a.group) return true
    if (seen.has(a.group)) return false // only one option per group
    seen.add(a.group)
    return true
  })
  const lines: QuoteLine[] = [{ label: `${tier.label} store (up to ${tier.products} products)`, amount: tier.price }, ...addons.map((a) => ({ label: addonLabel(cfg, a), amount: addonPrice(a, tier) }))]
  const subtotal = lines.reduce((t, l) => t + l.amount, 0)
  const rate = cfg.vat?.rate || 0
  let vat = 0
  let total = subtotal
  if (rate && cfg.vat?.included) vat = subtotal - subtotal / (1 + rate / 100)
  else if (rate) {
    vat = (subtotal * rate) / 100
    total = subtotal + vat
  }
  return { tier, addons, lines, subtotal, vat: Math.round(vat * 100) / 100, total: Math.round(total * 100) / 100 }
}

export function money(cfg: BuilderConfig, n: number, pence = false) {
  const whole = Math.abs(n - Math.round(n)) < 0.005
  return `${cfg.currency || '£'}${n.toLocaleString('en-GB', { minimumFractionDigits: pence && !whole ? 2 : 0, maximumFractionDigits: pence ? 2 : 0 })}`
}
