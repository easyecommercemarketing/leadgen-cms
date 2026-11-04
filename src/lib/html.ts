// Tidies HTML from the visual editor before it's stored and published.
// The admin is behind Cloudflare Access, so this is a safety net rather than a full sanitiser:
// it removes anything that runs code and normalises what the theme expects.

export function cleanHtml(input: string): string {
  let h = String(input || '')
  // anything that can run code: whole elements with their contents, then stray/void tags
  h = h.replace(/<(script|style|object|template|noscript|svg|math|form|button|textarea|select)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
  h = h.replace(/<\/?(script|style|object|template|noscript|svg|math|embed|form|input|button|textarea|select|option|meta|link|base|frameset|frame)\b[^>]*>/gi, '')
  // inside every remaining tag: drop event handlers and script URLs
  h = h.replace(/<[a-z][^>]*>/gi, (tag) =>
    tag
      .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
      .replace(/\s+(href|src|action|formaction|xlink:href)\s*=\s*(["']?)\s*(javascript|vbscript|data:text\/html)[^"'\s>]*\2/gi, ' $1="#"'),
  )
  // iframes: only video embeds
  h = h.replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, (m) =>
    /src=["']https:\/\/(www\.)?(youtube\.com|youtube-nocookie\.com|player\.vimeo\.com|www\.loom\.com)\//i.test(m) ? m : '',
  )
  // the page title is the only H1
  h = h.replace(/<h1(\s|>)/gi, '<h2$1').replace(/<\/h1>/gi, '</h2>')
  // images load lazily
  h = h.replace(/<img\b(?![^>]*\bloading=)/gi, '<img loading="lazy" decoding="async"')
  // external links open in a new tab
  h = h.replace(/<a\b([^>]*\bhref=["']https?:\/\/[^"']+["'][^>]*)>/gi, (m, attrs: string) =>
    /\btarget=/.test(attrs) ? m : `<a${attrs} target="_blank" rel="noopener">`,
  )
  // empty paragraphs left by pasting
  h = h.replace(/<p>(\s|&nbsp;|<br\s*\/?>)*<\/p>/gi, '')
  return h.trim()
}

/** Media URLs are /media/... on the site but /preview/<site id>/media/... inside the admin. */
export function toEditorUrls(html: string, siteId: number) {
  return html.replace(/(src|href)=(["'])\/media\//g, `$1=$2/preview/${siteId}/media/`)
}
export function fromEditorUrls(html: string) {
  return html.replace(/(src|href)=(["'])\/preview\/\d+\/media\//g, '$1=$2/media/')
}
