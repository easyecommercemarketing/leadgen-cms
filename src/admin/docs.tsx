const ex = (o: object) => <pre>{JSON.stringify(o, null, 2)}</pre>

// Shown at /docs/blocks in the admin.
export const BLOCK_DOCS = (
  <>
    <p>
      A page is a JSON array of blocks, rendered top to bottom. Text fields accept markdown. Images are a URL string (for example{' '}
      <code>/media/photo.webp</code>) or <code>{'{"src","alt","w","h"}'}</code>. Most blocks take <code>"bg": "soft"</code> or{' '}
      <code>"dark"</code> for a coloured background. <code>{'{{town}}'}</code>, <code>{'{{image}}'}</code> and <code>{'{{site}}'}</code>{' '}
      are filled in automatically.
    </p>
    <p>
      <b>One H1 per page.</b> The first <code>hero</code> on a page becomes the H1. If its <code>heading</code> is empty it uses the
      page's H1 field. <code>text</code>, <code>split</code> and <code>form</code> blocks can claim the H1 with{' '}
      <code>"primary": true</code>. Every other heading is an H2 or H3.
    </p>
    <h2>hero</h2>
    {ex({ type: 'hero', heading: '', text: 'Intro paragraph…', image: '/media/hero.webp', image_side: 'right', buttons: [{ label: 'Get a free audit', href: '/free-audit' }] })}
    <h2>text</h2>
    {ex({ type: 'text', heading: 'Heading', md: 'Markdown body…', center: false, wide: false, buttons: [] })}
    <h2>split</h2>
    <p>Text beside an image. Use "images" for a stack of images.</p>
    {ex({ type: 'split', heading: 'Heading', md: '…', image: '/media/x.webp', image_side: 'left', buttons: [] })}
    <h2>services</h2>
    <p>A list of service rows. Rows with an image alternate sides.</p>
    {ex({ type: 'services', heading: 'Our Services', intro: '', items: [{ title: 'SEO', md: '…', image: '/media/seo.webp', button: { label: 'Get your free audit', href: '/free-audit' } }] })}
    <h2>cards</h2>
    {ex({ type: 'cards', heading: 'Why us', columns: 3, items: [{ title: 'Fast', md: '…', image: '', href: '/x', link_label: 'More' }] })}
    <h2>logos</h2>
    {ex({ type: 'logos', heading: 'Some of our clients', items: ['/media/a.webp', '/media/b.webp'] })}
    <h2>cases</h2>
    <p>Case studies with alternating image and text.</p>
    {ex({ type: 'cases', heading: 'Success stories', items: [{ title: '586% revenue growth', md: '…', image: '/media/chart.webp' }] })}
    <h2>testimonials</h2>
    {ex({ type: 'testimonials', eyebrow: 'Testimonials', heading: 'What others are saying', anchor: 'testimonials', items: [{ title: 'Great!', quote: '…', author: 'Jo, CEO' }] })}
    <h2>faq</h2>
    <p>Also adds FAQPage structured data for search engines.</p>
    {ex({ type: 'faq', heading: 'FAQs', anchor: 'faqs', items: [{ q: 'Question?', a: 'Markdown answer' }] })}
    <h2>cta</h2>
    {ex({ type: 'cta', heading: 'Ready to grow?', md: '…', buttons: [{ label: 'Get your free audit', href: '/free-audit' }] })}
    <h2>posts</h2>
    {ex({ type: 'posts', heading: 'Our Blog', count: 6, button_label: 'More articles' })}
    <h2>form</h2>
    <p>
      A lead form. <code>form</code> is a key in the site's settings → <code>forms</code>.
    </p>
    {ex({ type: 'form', form: 'audit', heading: 'Get your free audit', md: '…', primary: true })}
    <h2>location_body</h2>
    <p>Location template only. Renders the location's own section (heading and copy from the location editor) beside these images.</p>
    {ex({ type: 'location_body', images: ['/media/proof-1.webp'] })}
    <h2>roi_calculator</h2>
    {ex({ type: 'roi_calculator' })}
    <h2>shared</h2>
    {ex({ type: 'shared', key: 'testimonials' })}
    <h2>html</h2>
    <p>Raw HTML, for embeds.</p>
    {ex({ type: 'html', html: '<div>…</div>' })}
  </>
)
