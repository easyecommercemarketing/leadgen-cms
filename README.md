# LeadGen CMS

One Cloudflare Worker that serves any number of websites from a single D1 database, with a built-in CMS and lead dashboard. The first site on it is **easyecommercemarketing.com**, migrated from GoHighLevel. The lead generation network will run on the same install.

- **Multi-site.** The incoming domain picks the site. A new site is a row in the database plus a custom domain on the Worker.
- **Pages from blocks.** Pages are built from reusable blocks (hero, services, testimonials, FAQ, forms…) with one shared stylesheet, re-skinned per site through theme colours and fonts.
- **Location pages at scale.** One `location_template` section lays out every town page. Each town only stores its name, image and local copy.
- **Blog** with categories, pagination, related posts, RSS, sitemap, and Article, Breadcrumb and FAQ structured data.
- **Lead capture.** Forms save to D1, with a honeypot, optional Turnstile spam check and optional email alerts. The lead dashboard has filters, statuses, buyer and price fields for sold leads, and CSV export.
- **Fast and cheap.** Pages are cached at Cloudflare's edge, and publishing anything clears that site's cache instantly. Images are served from R2.
- **Admin** sits behind Cloudflare Access, so there are no passwords to manage.

## What it costs

| | Free plan | If you outgrow it |
|---|---|---|
| Workers | 100,000 requests/day | $5/month for 10M requests |
| D1 | 5 GB, 5M row reads/day | included in the $5 plan |
| R2 | 10 GB storage, free egress | $0.015/GB-month |
| Cloudflare Access | free up to 50 users | |

Cached pages still count as Worker requests, but each one is cheap. EEM's 108 MB of images fits comfortably in R2's free tier.

---

## Project layout

```
src/index.tsx          entry: picks the site by hostname, routes admin vs public
src/render/            public site: layout, blocks, page views, ROI calculator, theme CSS
src/admin/             CMS admin, import API, block reference
src/api/lead.ts        form handler
src/lib/               D1 queries, edge cache, Cloudflare Access check, markdown
migrations/            D1 schema
public/_admin/         admin CSS and JS (served as static assets)
scripts/import.mjs     pushes a site's import data into any CMS install (local or live)
scripts/build_eem.py   one-off: converts the GHL crawl export into import data
scripts/verify_urls.py checks every old URL against a CMS host
```

## Run it locally

```bash
npm install
npx wrangler d1 migrations apply leadgen-cms --local
printf 'DEV_BYPASS_AUTH=true\nADMIN_HOST=localhost\n' > .dev.vars
npx wrangler dev
```

- Admin: http://localhost:8787
- Site: http://127.0.0.1:8787 (EEM lists `127.0.0.1` as an alias)

To load EEM locally (the import data is not in git because it's 108 MB of images; it's in the `eem-import-data.zip` download):

```bash
unzip eem-import-data.zip -d import-data/
node scripts/import.mjs import-data/eem --api http://localhost:8787
```

---

## Deploy

### 1. Create the Cloudflare resources

```bash
npx wrangler login
npx wrangler d1 create leadgen-cms           # copy the database_id into wrangler.jsonc
npx wrangler r2 bucket create leadgen-cms-media
npx wrangler d1 migrations apply leadgen-cms --remote
npx wrangler deploy
```

### 2. Put easyecommercemarketing.com on Cloudflare DNS

If the domain isn't in your Cloudflare account yet, add it (Websites → Add a site) and switch the nameservers at your registrar. **Before you switch, check that Cloudflare copied your MX, SPF, DKIM and DMARC records**, otherwise email to help@ will break. GHL keeps serving the site until step 6.

### 3. Admin domain + Cloudflare Access

1. Workers & Pages → leadgen-cms → Settings → Domains & Routes → add the custom domain `cms.easyecommercemarketing.com`.
2. Zero Trust → Access → Applications → Add → Self-hosted:
   - Domain: `cms.easyecommercemarketing.com`
   - Policy: Allow, emails = your address(es)
   - Copy the **Application Audience (AUD) tag**.
3. In `wrangler.jsonc` set `ACCESS_TEAM_DOMAIN` (e.g. `yourteam.cloudflareaccess.com`) and `ACCESS_AUD`, then `npx wrangler deploy` again.
4. For the import script: Zero Trust → Access → Service Auth → create a **service token**, and add a second policy to the app with Action **Service Auth** that includes that token.

### 4. Import EEM

```bash
export CF_ACCESS_CLIENT_ID=...  CF_ACCESS_CLIENT_SECRET=...
node scripts/import.mjs import-data/eem --api https://cms.easyecommercemarketing.com
```

It's safe to re-run. Everything upserts and uploaded images are skipped.

### 5. Preview before go-live

In the admin, open EEM → Settings and add your workers.dev hostname (e.g. `leadgen-cms.<you>.workers.dev`) to **Aliases**. The live site is then served there. Check it against the old one:

```bash
python3 scripts/verify_urls.py <crawl export>/pages.csv https://leadgen-cms.<you>.workers.dev
```

You can also preview any page, drafts included, in the admin under `/preview/<site id>/…`.

### 6. Go live

1. Workers → leadgen-cms → Domains & Routes → add `easyecommercemarketing.com` and `www.easyecommercemarketing.com`. Cloudflare replaces the old DNS records pointing at GHL.
2. Submit `https://easyecommercemarketing.com/sitemap.xml` in Google Search Console.
3. Submit a test lead on `/free-audit` and check it appears under **Leads**.
4. Watch Search Console → Pages for 404s for a couple of weeks, then cancel GHL.

### Optional extras

- **Spam protection:** create a Turnstile widget, put its site key in the site's Settings JSON as `turnstile_sitekey`, then run `npx wrangler secret put TURNSTILE_SECRET`.
- **Lead email alerts:** create a Resend account, verify the domain, run `npx wrangler secret put RESEND_API_KEY`, and set `email_from` (e.g. `"Leads <leads@easyecommercemarketing.com>"`) in Settings. Alerts go to `notify_email`.
- **Store checkout:** create a Stripe Payment Link for each product and paste it into the product's **Payment link** field.

---

## Adding a lead gen site

1. Admin → Sites → **New site**. Enter the name and domain, then fill in Theme and Settings. Copying EEM's JSON is a good starting point: change colours, logo, nav and the form fields.
2. **Sections:** create `location_template`. That's the layout every town page uses, with `{{town}}` wherever the town name goes and `{{image}}` for its photo.
3. Add pages (home, services, contact with a `form` block) and location pages, by hand or in bulk with `scripts/import.mjs` and a `content.json`.
4. Add the domain to the Worker under Domains & Routes.

Leads from every site land in the same dashboard. Filter by site, mark leads sold with buyer and price, and export to CSV.

The block reference is in the admin at `/docs/blocks`.
