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
    <h2>quote_calculator</h2>
    <p>
      Window cleaning instant quote. The visitor picks property type, bedrooms, extras and frequency, sees a price per clean, and sends it as a
      lead through <code>form</code> (default <code>quote_calc</code>), so buyer routing and alerts work as on any form. Every price is optional:
      leave a key out to keep the default. <code>base</code> is the price per clean for 2 bedrooms; <code>perBed</code> is added or taken off for
      each bedroom above or below; <code>firstMult</code> marks up the first clean; frequency <code>mult</code> multiplies the per-clean price.
      Set <code>on: false</code> to hide an extra, frequency or one-off job. The required tick box on the form becomes the consent box.
    </p>
    {ex({
      type: 'quote_calculator',
      form: 'quote_calc',
      phone: '',
      accent: '#ffd23f',
      perBed: 3,
      minimum: 10,
      firstMult: 1.5,
      types: [
        { id: 'flat', label: 'Flat or maisonette', base: 10, gutter: 50 },
        { id: 'terraced', label: 'Terraced', base: 13, gutter: 60 },
        { id: 'semi', label: 'Semi-detached', base: 16, gutter: 70 },
        { id: 'detached', label: 'Detached', base: 20, gutter: 90 },
        { id: 'bungalow', label: 'Bungalow', base: 15, gutter: 65 },
      ],
      extras: [
        { id: 'cons', label: 'Conservatory (sides)', price: 8 },
        { id: 'ext', label: 'Extension or porch', price: 4 },
        { id: 'frames', label: 'Frames and sills', price: 5 },
      ],
      velux: { label: 'Velux or skylight windows', price: 2 },
      freq: [
        { id: '4w', label: 'Every 4 weeks', mult: 1 },
        { id: '8w', label: 'Every 8 weeks', mult: 1.2 },
        { id: 'once', label: 'One-off clean', mult: 1.75 },
      ],
      oneoffs: [
        { id: 'gutter', label: 'Gutter clearing', byType: true },
        { id: 'fascia', label: 'Fascia and soffit clean', price: 55 },
        { id: 'roof', label: 'Conservatory roof clean', price: 45, needs: 'cons' },
      ],
    })}
    <p>The form it sends to must list these fields (labels are what appear in lead emails and the dashboard):</p>
    {ex({
      quote_calc: {
        success_path: '/thank-you',
        route: true,
        fields: [
          { name: 'name', label: 'Name', type: 'text', required: true },
          { name: 'phone', label: 'Phone', type: 'tel' },
          { name: 'email', label: 'Email', type: 'email' },
          { name: 'postcode', label: 'Postcode', type: 'text', required: true },
          { name: 'summary', label: 'Quote', type: 'text' },
          { name: 'property', label: 'Property', type: 'text' },
          { name: 'bedrooms', label: 'Bedrooms', type: 'text' },
          { name: 'frequency', label: 'Frequency', type: 'text' },
          { name: 'price_per_clean', label: 'Price per clean', type: 'text' },
          { name: 'first_clean', label: 'First clean', type: 'text' },
          { name: 'extras', label: 'Extras', type: 'text' },
          { name: 'one_off_jobs', label: 'One-off jobs', type: 'text' },
          { name: 'one_off_total', label: 'One-off total', type: 'text' },
          { name: 'notes', label: 'Access notes', type: 'textarea' },
          { name: 'share_consent', label: 'I agree my details can be shared with a local window cleaner so they can contact me about my quote.', type: 'checkbox', required: true },
        ],
      },
    })}
    <h2>shared</h2>
    {ex({ type: 'shared', key: 'testimonials' })}
    <h2>html</h2>
    <p>Raw HTML, for embeds.</p>
    {ex({ type: 'html', html: '<div>…</div>' })}
  </>
)
