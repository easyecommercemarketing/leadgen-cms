-- What a buyer shows on the location pages they've bought.
ALTER TABLE buyers ADD COLUMN show_listing INTEGER NOT NULL DEFAULT 1;  -- show their details on their location pages
ALTER TABLE buyers ADD COLUMN public_phone TEXT NOT NULL DEFAULT '';    -- phone shown to visitors (blank = none)
ALTER TABLE buyers ADD COLUMN public_email TEXT NOT NULL DEFAULT '';    -- email shown to visitors (blank = none)
ALTER TABLE buyers ADD COLUMN website TEXT NOT NULL DEFAULT '';
ALTER TABLE buyers ADD COLUMN logo TEXT NOT NULL DEFAULT '';            -- media URL
ALTER TABLE buyers ADD COLUMN blurb TEXT NOT NULL DEFAULT '';           -- short intro shown with their details
ALTER TABLE buyers ADD COLUMN form_key TEXT NOT NULL DEFAULT '';        -- a form from site settings with their own questions
