-- Lead buyers: businesses that pay to receive leads for specific location pages.

CREATE TABLE buyers (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id       INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,                 -- contact name
  business      TEXT NOT NULL DEFAULT '',
  email         TEXT NOT NULL,                 -- where their leads are sent (comma separated for several)
  phone         TEXT NOT NULL DEFAULT '',
  monthly_price REAL,                          -- what they pay per month (for your reference)
  active        INTEGER NOT NULL DEFAULT 1,    -- paused buyers receive nothing
  notes         TEXT NOT NULL DEFAULT '',
  started_at    TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_buyers_site ON buyers (site_id, active);

-- Which location pages each buyer has bought (by URL path, e.g. '/kent')
CREATE TABLE buyer_areas (
  buyer_id INTEGER NOT NULL REFERENCES buyers(id) ON DELETE CASCADE,
  path     TEXT NOT NULL,
  PRIMARY KEY (buyer_id, path)
);
CREATE INDEX idx_buyer_areas_path ON buyer_areas (path);

ALTER TABLE leads ADD COLUMN area TEXT NOT NULL DEFAULT '';        -- matched location path
ALTER TABLE leads ADD COLUMN routed_to TEXT NOT NULL DEFAULT '[]'; -- JSON [{buyer_id, name, email}]
CREATE INDEX idx_leads_area ON leads (site_id, area);
