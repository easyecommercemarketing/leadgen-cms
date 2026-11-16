// Store builder pricing: shared by the configurator on the page (as JSON for the browser)
// and the lead handler (which recalculates the quote so it can't be edited in the browser).

export type BuilderTier = { key: string; label: string; products: number; pages: number; price: number; note?: string }
export type BuilderAddon = { key: string; label: string; desc?: string; price?: number; per_product?: number }
export type BuilderPalette = { key: string; label: string; colors: string[] } // [primary, accent, background]
export type BuilderConfig = {
  currency?: string
  tiers: BuilderTier[]
  addons: BuilderAddon[]
  industries: string[]
  palettes: BuilderPalette[]
  turnaround?: string
  price_note?: string // e.g. "One-off price, excluding VAT"
}

export function addonPrice(a: BuilderAddon, tier: BuilderTier) {
  return a.per_product ? a.per_product * tier.products : a.price || 0
}

export function quote(cfg: BuilderConfig, tierKey: string, addonKeys: string[]) {
  const tier = cfg.tiers.find((t) => t.key === tierKey)
  if (!tier) return null
  const addons = cfg.addons.filter((a) => addonKeys.includes(a.key))
  const lines = [{ label: `${tier.label} store (up to ${tier.products} products)`, amount: tier.price }, ...addons.map((a) => ({ label: a.label, amount: addonPrice(a, tier) }))]
  return { tier, addons, lines, total: lines.reduce((t, l) => t + l.amount, 0) }
}

export function money(cfg: BuilderConfig, n: number) {
  return `${cfg.currency || '£'}${n.toLocaleString('en-GB', { maximumFractionDigits: 0 })}`
}
