import { Marked } from 'marked'

const marked = new Marked({ gfm: true, breaks: false })

marked.use({
  renderer: {
    // lazy-load and size-hint every content image
    image({ href, title, text }) {
      const t = title ? ` title="${esc(title)}"` : ''
      return `<img src="${esc(href)}" alt="${esc(text)}"${t} loading="lazy" decoding="async">`
    },
    // open external links in a new tab
    link({ href, title, tokens }) {
      const inner = this.parser.parseInline(tokens)
      const t = title ? ` title="${esc(title)}"` : ''
      const ext = /^https?:\/\//.test(href) ? ' target="_blank" rel="noopener"' : ''
      return `<a href="${esc(href)}"${t}${ext}>${inner}</a>`
    },
  },
})

function esc(s: string) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
}

/** Full markdown → HTML. Body content never gets an <h1>: the page template owns the only H1. */
export function md(src: string | undefined | null): string {
  if (!src) return ''
  const html = marked.parse(String(src), { async: false }) as string
  return html.replace(/<h1(\s|>)/g, '<h2$1').replace(/<\/h1>/g, '</h2>')
}

/** Inline markdown (bold, links) for short strings such as headings and button labels. */
export function mdInline(src: string | undefined | null): string {
  if (!src) return ''
  return marked.parseInline(String(src), { async: false }) as string
}
