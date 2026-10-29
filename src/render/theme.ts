import type { Theme } from '../types'

const DEFAULT_COLORS: Record<string, string> = {
  primary: '#37ca37', // buttons
  primary_text: '#ffffff',
  accent: '#ee2a52', // CTA band, highlights
  dark: '#222639', // dark cards
  cream: '#fffbf9', // header / soft section background
  text: '#1f2330',
  muted: '#5b6070',
  border: '#e6e3e1',
  footer: '#212322',
  footer_text: '#ffffff',
  link: '#188bf6',
}

export function themeVars(theme: Theme): string {
  const c: Record<string, string> = { ...DEFAULT_COLORS, ...(theme.colors || {}) }
  // colours that default to others, so existing sites look the same without setting them
  c.brand ??= c.accent
  c.brand_text ??= '#ffffff'
  c.header ??= c.cream
  c.header_text ??= c.text
  c.cta ??= c.accent
  c.nav_active ??= c.header_text === '#ffffff' ? '#ffffff' : c.accent
  c.cta_btn ??= c.primary
  c.cta_btn_text ??= c.primary_text
  const heading = theme.fonts?.heading || 'system-ui, sans-serif'
  const body = theme.fonts?.body || 'system-ui, sans-serif'
  const vars = Object.entries(c).map(([k, v]) => `--c-${k.replace(/_/g, '-')}:${v}`)
  vars.push(`--f-heading:${heading}`, `--f-body:${body}`, `--radius:${theme.radius || '8px'}`)
  return `:root{${vars.join(';')}}`
}

// Shared base stylesheet for every site. Sites differ through the variables above.
export const BASE_CSS = `
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;scroll-behavior:smooth}
body{margin:0;font-family:var(--f-body);color:var(--c-text);background:#fff;line-height:1.6;font-size:16px}
img{max-width:100%;height:auto;display:block}
a{color:var(--c-link)}
h1,h2,h3,h4{font-family:var(--f-heading);line-height:1.25;margin:0 0 .6em;color:var(--c-text)}
h1{font-size:clamp(1.9rem,4vw,2.6rem)} h2{font-size:clamp(1.5rem,3vw,2rem)} h3{font-size:1.25rem}
p{margin:0 0 1em}
.wrap{max-width:1180px;margin:0 auto;padding:0 20px}
.narrow{max-width:820px;margin:0 auto;padding:0 20px}
.center{text-align:center}
.sec{padding:64px 0}
.sec.soft{background:var(--c-cream)}
.sec.dark{background:var(--c-dark);color:#fff}.sec.dark h2,.sec.dark h3{color:#fff}
.sec.brand{background:var(--c-brand);color:var(--c-brand-text)}.sec.brand h1,.sec.brand h2,.sec.brand h3,.sec.brand .lead{color:var(--c-brand-text)}.sec.brand .eyebrow{color:var(--c-brand-text);opacity:.85}
.sec.brand .btn{background:var(--c-cta-btn);color:var(--c-cta-btn-text)}
.btn{display:inline-block;background:var(--c-primary);color:var(--c-primary-text);font-weight:600;padding:13px 30px;border-radius:var(--radius);text-decoration:none;border:0;cursor:pointer;font-size:1rem;font-family:var(--f-body);transition:filter .15s}
.btn:hover{filter:brightness(.93)}
.btn.lg{padding:16px 38px;font-size:1.05rem}
.btn.block{display:block;width:100%;text-align:center}
.btns{display:flex;gap:12px;flex-wrap:wrap;margin-top:8px}
.eyebrow{text-transform:uppercase;letter-spacing:.08em;font-size:.8rem;font-weight:600;color:var(--c-accent);margin-bottom:.4em}
.lead{font-size:1.12rem;color:var(--c-muted)}

/* header */
.hdr{background:var(--c-header);position:sticky;top:0;z-index:50;border-bottom:1px solid rgba(0,0,0,.04)}
.hdr .wrap{display:flex;align-items:center;justify-content:space-between;min-height:84px;gap:20px}
.logo{display:flex;align-items:center;gap:12px;text-decoration:none;color:var(--c-header-text)}.logo img{height:auto}.logo-text{font-family:var(--f-heading);font-weight:600;font-size:1.05rem}
.nav{display:flex;gap:22px;align-items:center}
.nav a{color:var(--c-header-text);text-decoration:none;font-size:.92rem;font-weight:500}
.nav a:hover,.nav a[aria-current]{color:var(--c-nav-active)}
.nav a[aria-current]:not(.btn){text-decoration:underline;text-underline-offset:6px;text-decoration-thickness:2px}
.nav .btn,.nav .btn:hover,.nav .btn[aria-current]{background:var(--c-cta-btn);color:var(--c-cta-btn-text);padding:10px 20px}
.menu-btn{color:var(--c-header-text)}
.menu-toggle,.menu-btn{display:none}
@media (max-width:960px){
  .menu-btn{display:block;cursor:pointer;padding:8px;font-size:1.6rem;line-height:1}
  .nav{display:none;position:absolute;left:0;right:0;top:84px;background:var(--c-header);flex-direction:column;align-items:stretch;padding:12px 20px 20px;gap:4px;box-shadow:0 10px 20px rgba(0,0,0,.06)}
  .nav a{padding:10px 0;font-size:1rem;border-bottom:1px solid var(--c-border)}
  .menu-toggle:checked ~ .nav{display:flex}
}

/* layouts */
.split{display:grid;grid-template-columns:1fr 1fr;gap:48px;align-items:center}
.split.img-left .s-media{order:-1}
.cols{display:grid;gap:28px}
.cols-2{grid-template-columns:repeat(2,1fr)}.cols-3{grid-template-columns:repeat(3,1fr)}.cols-4{grid-template-columns:repeat(4,1fr)}
@media (max-width:860px){.split{grid-template-columns:1fr;gap:28px}.split.img-left .s-media{order:0}.cols-3,.cols-4{grid-template-columns:repeat(2,1fr)}}
@media (max-width:560px){.cols-2,.cols-3,.cols-4{grid-template-columns:1fr}.sec{padding:44px 0}}

/* hero */
.hero h1{margin-bottom:.4em}
.hero .s-media img{margin:0 auto;border-radius:var(--radius)}

/* cards */
.card{background:#fff;border:1px solid var(--c-border);border-radius:var(--radius);overflow:hidden;display:flex;flex-direction:column}
.card .c-body{padding:22px}
.card h3{margin-bottom:.4em}
.card p{color:var(--c-muted);font-size:.96rem}
.card a.c-link{margin-top:auto;font-weight:600;text-decoration:none}

/* services list (heading + text rows) */
.svc h3{font-size:1.35rem}
.svc + .svc{margin-top:28px}

/* logos */
.logos{display:flex;flex-wrap:wrap;gap:28px;justify-content:center;align-items:center}
.logos img{max-height:120px;width:auto}

/* case studies */
.case{display:grid;grid-template-columns:1fr 1fr;gap:40px;align-items:center;padding:24px 0}
.case:nth-child(even) .case-media{order:-1}
.case h3{font-size:1.4rem}
@media (max-width:860px){.case{grid-template-columns:1fr;gap:16px}.case:nth-child(even) .case-media{order:0}}

/* testimonials */
.tcard{background:var(--c-dark);color:#fff;border-radius:6px;padding:32px;display:flex;flex-direction:column;justify-content:center}
.tcard h3{color:#fff;font-size:1.15rem}
.tcard blockquote{margin:0 0 1em;font-size:.95rem;opacity:.92}
.tcard cite{font-style:normal;font-size:.92rem;opacity:.85}
.tcard.light{background:#fff;color:var(--c-text);border:1px solid var(--c-border);box-shadow:0 6px 20px rgba(0,0,0,.04)}.tcard.light h3{color:var(--c-text)}.tcard.light blockquote{color:var(--c-muted)}
.stars{color:#f5b301;letter-spacing:2px;margin-top:10px;font-size:1.1rem}

/* faq */
.faq details{border:1px solid var(--c-accent);border-radius:6px;margin-bottom:10px;background:#fff}
.faq summary{cursor:pointer;padding:14px 18px;font-weight:700;font-family:var(--f-heading);list-style:none}
.faq summary::-webkit-details-marker{display:none}
.faq summary::after{content:'+';float:right;font-weight:400}
.faq details[open] summary::after{content:'–'}
.faq .a{padding:0 18px 14px;color:var(--c-muted)}

/* cta band */
.cta{background:var(--c-cta);color:#fff;text-align:center;padding:64px 0}
.cta .btn{background:var(--c-cta-btn);color:var(--c-cta-btn-text)}
.cta .eyebrow{color:#fff;opacity:.9;font-size:1rem;text-transform:none;letter-spacing:0;font-weight:700}
.cta h2{color:#fff}.cta p{opacity:.95;max-width:680px;margin:0 auto 1.4em}

/* blog */
.posts{display:grid;grid-template-columns:repeat(3,1fr);gap:26px}
@media (max-width:860px){.posts{grid-template-columns:repeat(2,1fr)}}
@media (max-width:560px){.posts{grid-template-columns:1fr}}
.pcard{border:1px solid var(--c-border);border-radius:var(--radius);overflow:hidden;background:#fff;display:flex;flex-direction:column;text-decoration:none;color:inherit;transition:box-shadow .15s}
.pcard:hover{box-shadow:0 8px 24px rgba(0,0,0,.08)}
.pcard img{aspect-ratio:16/9;object-fit:cover;width:100%}
.pcard .c-body{padding:18px;display:flex;flex-direction:column;gap:8px;flex:1}
.pcard h3{font-size:1.1rem;margin:0}
.pcard p{font-size:.92rem;color:var(--c-muted);margin:0}
.meta{font-size:.82rem;color:var(--c-muted)}
.tags{display:flex;flex-wrap:wrap;gap:6px}
.tag{font-size:.75rem;background:var(--c-cream);color:var(--c-text);padding:3px 10px;border-radius:99px;text-decoration:none;border:1px solid var(--c-border)}
.pager{display:flex;gap:8px;justify-content:center;margin-top:40px;flex-wrap:wrap}
.pager a,.pager span{padding:8px 14px;border:1px solid var(--c-border);border-radius:6px;text-decoration:none;color:var(--c-text);font-size:.9rem}
.pager span.cur{background:var(--c-text);color:#fff;border-color:var(--c-text)}
.catbar{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin:0 0 32px}

/* article */
.article{padding:40px 0 64px}
.article .feat{border-radius:var(--radius);margin:0 0 24px;width:100%}
.article h1{font-size:clamp(1.8rem,3.4vw,2.4rem)}
.prose{font-size:1.04rem;line-height:1.75}
.prose h2{margin-top:1.8em;font-size:1.6rem}.prose h3{margin-top:1.4em}
.prose img{border-radius:6px;margin:1.2em auto}
.prose ul,.prose ol{padding-left:1.4em}
.prose ul.towns{padding-left:0;list-style:none}.prose ul.towns li{margin:0;padding:5px 0}
.areas h3{text-align:center;margin:28px 0 14px;font-weight:600}.prose li{margin:.35em 0}
.prose table{border-collapse:collapse;width:100%;margin:1.4em 0;font-size:.94rem;display:block;overflow-x:auto}
.prose th,.prose td{border:1px solid var(--c-border);padding:8px 12px;text-align:left;vertical-align:top}
.prose th{background:var(--c-cream)}
.prose blockquote{border-left:4px solid var(--c-accent);margin:1.4em 0;padding:.4em 1.2em;background:var(--c-cream)}
.prose hr{border:0;border-top:1px solid var(--c-border);margin:2em 0}
.prose iframe{width:100%;aspect-ratio:16/9;height:auto;border:0;border-radius:6px}
.prose code{background:#f4f4f6;padding:2px 5px;border-radius:4px;font-size:.92em}
.crumbs{font-size:.85rem;color:var(--c-muted);margin-bottom:12px}.crumbs a{color:inherit}

/* forms */
.form{display:grid;grid-template-columns:1fr 1fr;gap:14px 16px;text-align:left}
.form .full{grid-column:1/-1}
.form label{display:block;font-size:.88rem;font-weight:600;margin-bottom:5px}
.form input,.form select,.form textarea{width:100%;padding:12px 14px;border:1px solid #cfd3da;border-radius:6px;font:inherit;background:#fff}
.form input:focus,.form select:focus,.form textarea:focus{outline:2px solid var(--c-primary);outline-offset:1px;border-color:transparent}
.form textarea{min-height:120px;resize:vertical}
.form .chk{display:flex;gap:10px;align-items:flex-start;font-weight:400;font-size:.85rem;color:var(--c-muted)}
.form .chk input{width:auto;margin-top:3px}
.form .hp{position:absolute;left:-9999px}
.req{color:var(--c-accent)}
.formbox{background:#fff;border:1px solid var(--c-border);border-radius:var(--radius);padding:32px;box-shadow:0 10px 30px rgba(0,0,0,.05)}
@media (max-width:560px){.form{grid-template-columns:1fr}.formbox{padding:20px}}

/* featured buyer on location pages */
.featured{display:grid;grid-template-columns:1fr;gap:28px;align-items:start;max-width:760px;margin:0 auto}
.featured.with-form{grid-template-columns:1fr 1fr;max-width:none}
.fb-card{background:#fff;border:2px solid var(--c-brand);border-radius:var(--radius);padding:28px;color:var(--c-text)}
.fb-card h2{color:var(--c-text)}
.fb-logo{max-height:80px;width:auto;margin:0 0 14px}
.fb-contact{list-style:none;padding:0;margin:0 0 18px}.fb-contact li{padding:6px 0;border-bottom:1px solid var(--c-border)}
.fb-contact span{display:inline-block;min-width:80px;color:var(--c-muted);font-size:.88rem}
@media (max-width:860px){.featured.with-form{grid-template-columns:1fr}}

/* town list */
.towns{columns:4 170px;column-gap:28px;list-style:none;padding:0;margin:0}
.towns li{padding:5px 0;break-inside:avoid}
.towns a{color:var(--c-text);text-decoration:none;border-bottom:1px solid var(--c-border)}.towns a:hover{color:var(--c-accent)}

/* footer */
.ftr{background:var(--c-footer);color:var(--c-footer-text);padding:44px 0 28px;text-align:center;font-size:.92rem}
.ftr a{color:inherit}
.ftr .social{display:flex;justify-content:center;gap:16px;margin-bottom:18px}
.ftr .social a{display:inline-flex;width:38px;height:38px;border-radius:50%;background:rgba(255,255,255,.1);align-items:center;justify-content:center}
.ftr .social svg{width:18px;height:18px;fill:currentColor}
.ftr .flinks{display:flex;gap:18px;justify-content:center;flex-wrap:wrap;margin-bottom:14px}
.ftr hr{border:0;border-top:1px solid rgba(255,255,255,.4);margin:18px auto;max-width:840px}
`
