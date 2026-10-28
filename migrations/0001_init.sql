-- Multi-tenant CMS schema. Every row belongs to a site; the Worker picks the site by hostname.

CREATE TABLE sites (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  slug          TEXT NOT NULL UNIQUE,              -- short handle, also the R2 media prefix
  name          TEXT NOT NULL,
  domain        TEXT NOT NULL UNIQUE,              -- primary hostname, e.g. easyecommercemarketing.com
  aliases       TEXT NOT NULL DEFAULT '[]',        -- JSON array of extra hostnames (www., preview hosts); they 301 to domain
  theme         TEXT NOT NULL DEFAULT '{}',        -- JSON: colours, fonts, logo
  settings      TEXT NOT NULL DEFAULT '{}',        -- JSON: nav, footer, ga4, contact, forms, notify email
  cache_version INTEGER NOT NULL DEFAULT 1,        -- bumped on every publish; part of the edge cache key
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Pages, posts, location pages and products all live here, keyed by URL path.
CREATE TABLE content (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id          INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  type             TEXT NOT NULL CHECK (type IN ('page','post','location','product')),
  path             TEXT NOT NULL,                  -- '/', '/services', '/post/my-slug', '/norwich'
  title            TEXT NOT NULL DEFAULT '',       -- <title>
  meta_description TEXT NOT NULL DEFAULT '',
  h1               TEXT NOT NULL DEFAULT '',
  excerpt          TEXT NOT NULL DEFAULT '',
  blocks           TEXT NOT NULL DEFAULT '[]',     -- JSON array of blocks (page layout)
  body_md          TEXT NOT NULL DEFAULT '',       -- markdown source (posts, rich text)
  body_html        TEXT NOT NULL DEFAULT '',       -- rendered once on save, so requests do no markdown work
  data             TEXT NOT NULL DEFAULT '{}',     -- JSON type-specific fields (town, price, categories ...)
  image            TEXT NOT NULL DEFAULT '',       -- featured / OG image (media URL)
  status           TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft','published')),
  noindex          INTEGER NOT NULL DEFAULT 0,
  published_at     TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (site_id, path)
);
CREATE INDEX idx_content_list ON content (site_id, type, status, published_at DESC);

-- Post categories (many-to-many)
CREATE TABLE categories (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id     INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  slug        TEXT NOT NULL,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  UNIQUE (site_id, slug)
);
CREATE TABLE content_categories (
  content_id  INTEGER NOT NULL REFERENCES content(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (content_id, category_id)
);
CREATE INDEX idx_cc_category ON content_categories (category_id);

-- Reusable sections (testimonials, FAQ, logos ...) a page can pull in with {"type":"shared","key":"..."}
CREATE TABLE shared_blocks (
  site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  key     TEXT NOT NULL,
  label   TEXT NOT NULL DEFAULT '',
  blocks  TEXT NOT NULL DEFAULT '[]',
  PRIMARY KEY (site_id, key)
);

CREATE TABLE redirects (
  site_id   INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  from_path TEXT NOT NULL,
  to_path   TEXT NOT NULL,
  code      INTEGER NOT NULL DEFAULT 301,
  PRIMARY KEY (site_id, from_path)
);

-- Files live in R2 under <site slug>/<filename>; this is the library index.
CREATE TABLE media (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id    INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  filename   TEXT NOT NULL,
  mime       TEXT NOT NULL,
  size       INTEGER NOT NULL DEFAULT 0,
  width      INTEGER,
  height     INTEGER,
  alt        TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (site_id, filename)
);

CREATE TABLE leads (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id     INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  form        TEXT NOT NULL DEFAULT 'contact',
  page_path   TEXT NOT NULL DEFAULT '',
  name        TEXT NOT NULL DEFAULT '',
  email       TEXT NOT NULL DEFAULT '',
  phone       TEXT NOT NULL DEFAULT '',
  fields      TEXT NOT NULL DEFAULT '{}',          -- every submitted field, as JSON
  status      TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','qualified','sold','invalid')),
  buyer       TEXT NOT NULL DEFAULT '',            -- who the lead was sold to
  price       REAL,                                -- what it sold for
  notes       TEXT NOT NULL DEFAULT '',
  country     TEXT NOT NULL DEFAULT '',
  referrer    TEXT NOT NULL DEFAULT '',
  utm         TEXT NOT NULL DEFAULT '{}',
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_leads_site ON leads (site_id, created_at DESC);
CREATE INDEX idx_leads_status ON leads (site_id, status);
