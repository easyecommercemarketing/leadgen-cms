export type Env = {
  DB: D1Database
  MEDIA: R2Bucket
  ASSETS: Fetcher
  ADMIN_HOST: string
  ACCESS_TEAM_DOMAIN: string
  ACCESS_AUD: string
  DEV_BYPASS_AUTH: string
  TURNSTILE_SECRET?: string
  RESEND_API_KEY?: string
}

export type NavItem = { label: string; href: string }

export type FormField = {
  name: string
  label: string
  type: 'text' | 'email' | 'tel' | 'url' | 'textarea' | 'select' | 'checkbox'
  required?: boolean
  options?: string[]
  placeholder?: string
  width?: 'half' | 'full'
}

export type FormDef = {
  fields: FormField[]
  submit?: string
  success_path?: string // where to send people after submitting
  consent?: string // optional checkbox text shown above the button
  notify?: string[] // emails to notify on each lead
  route?: boolean // send leads to the buyer who owns the matched location
}

export type Theme = {
  colors?: Record<string, string> // primary, accent, dark, cream, text, muted, footer ...
  fonts?: { heading?: string; body?: string; google?: string } // google = css2 family query
  logo?: string
  logo_width?: number
  logo_text?: boolean // show the site name beside the logo
  favicon?: string
  radius?: string
}

export type SiteSettings = {
  nav?: NavItem[]
  footer?: { text?: string; hours?: string; social?: NavItem[]; links?: NavItem[] }
  ga4?: string
  turnstile_sitekey?: string
  forms?: Record<string, FormDef>
  notify_email?: string // default lead notification address
  email_from?: string // verified sender for Resend
  blog?: { path?: string; title?: string; intro?: string; per_page?: number; post_prefix?: string }
  location?: { template?: string } // shared_blocks key used for location pages
  default_og_image?: string
  head_html?: string // extra tags for <head> (verification meta, pixels)
  routing?: { area_field?: string | string[]; copy_admin?: boolean } // lead routing to buyers
}

export type Site = {
  id: number
  slug: string
  name: string
  domain: string
  aliases: string[]
  theme: Theme
  settings: SiteSettings
  cache_version: number
}

export type ContentType = 'page' | 'post' | 'location' | 'product'

export type Content = {
  id: number
  site_id: number
  type: ContentType
  path: string
  title: string
  meta_description: string
  h1: string
  excerpt: string
  blocks: Block[]
  body_md: string
  body_html: string
  data: Record<string, any>
  image: string
  status: 'draft' | 'published'
  noindex: number
  published_at: string | null
  updated_at: string
  categories?: Category[]
}

export type Category = { id: number; slug: string; name: string; description: string }

export type Block = { type: string; [k: string]: any }
