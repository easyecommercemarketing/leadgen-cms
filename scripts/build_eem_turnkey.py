#!/usr/bin/env python3
"""
Adds the Turnkey Shopify Stores page (with its store builder and pricing) to easyecommercemarketing.com.

  python3 scripts/build_eem_turnkey.py
  node scripts/import.mjs import-data/eem-turnkey --api <cms url> --only content,settings

Prices (VAT included), options and wording of the builder live in site settings under forms.turnkey.builder,
so they can be changed later in the CMS (Settings JSON) without a code change.
"""
import json, os
HERE = os.path.dirname(__file__)
OUT = os.path.abspath(os.path.join(HERE, "..", "import-data", "eem-turnkey"))
os.makedirs(OUT, exist_ok=True)
PATH = "/turnkey-shopify-stores"

BUILDER = {
    "currency": "£",
    "turnaround": "Built in 72 hours",
    "vat": {"rate": 20, "included": True},
    "price_note": "One-off price, including VAT. Your Shopify plan and any paid apps are billed by Shopify.",
    "payment": {"provider": "stripe", "product": "Turnkey Shopify store", "currency": "gbp"},
    "included": ["Store design & setup", "Logo designed for you", "First batch of products loaded", "Product descriptions written for you", "7 days support after launch"],
    "tiers": [
        {"key": "starter", "label": "Starter", "products": 15, "price": 399},
        {"key": "growth", "label": "Growth", "products": 50, "price": 599, "note": "Most popular"},
        {"key": "pro", "label": "Pro", "products": 150, "price": 999},
    ],
    "addons": [
        {"key": "email", "label": "Email marketing setup", "desc": "Klaviyo welcome, abandoned cart and post-purchase emails", "price": 295},
        {"key": "shopping", "label": "Google Shopping setup", "desc": "Merchant Centre account and product feed, ready for Shopping ads", "price": 195},
        {"key": "seo", "label": "SEO starter pack", "desc": "Keyword research, optimised collection pages and 3 blog articles", "price": 295},
        {"key": "premium_theme", "label": "Premium theme setup", "desc": "Built on a premium Shopify theme (theme licence bought separately)", "price": 150},
        {"key": "domain", "label": "Domain & email connection", "desc": "Connect your domain and set up your business email address", "price": 75},
        {"key": "support_30", "group": "support", "label": "30 days", "price": 99},
        {"key": "support_90", "group": "support", "label": "90 days", "price": 199},
        {"key": "support_6m", "group": "support", "label": "6 months", "price": 399},
        {"key": "support_1y", "group": "support", "label": "1 year", "price": 599},
    ],
    "groups": [
        {"key": "support", "label": "Support after launch",
         "hint": "7 days of support is included. Want longer? Extended support covers fixes, small changes and help whenever you need it.",
         "none_label": "7 days"},
    ],
    "industries": ["Fashion & Clothing", "Jewellery & Accessories", "Health & Beauty", "Home & Garden", "Pets",
                   "Sports & Fitness", "Food & Drink", "Baby & Kids", "Electronics & Gadgets", "Arts & Crafts",
                   "Toys & Games", "Automotive"],
    "palettes": [
        {"key": "navy", "label": "Classic Navy", "colors": ["#1F3A5F", "#F2A541", "#FFFFFF"]},
        {"key": "green", "label": "Fresh Green", "colors": ["#2E5E4E", "#E9B44C", "#F7F5EF"]},
        {"key": "black", "label": "Bold Black", "colors": ["#111111", "#E63946", "#FFFFFF"]},
        {"key": "blush", "label": "Soft Blush", "colors": ["#6B4E5B", "#E8A0A8", "#FFF8F6"]},
        {"key": "ocean", "label": "Ocean Blue", "colors": ["#0B4F6C", "#20BF55", "#F4F9FB"]},
        {"key": "earth", "label": "Earthy Neutral", "colors": ["#5C4B3B", "#C08552", "#F8F4EE"]},
    ],
}

FORM = {
    "submit": "Continue to Secure Payment",
    "success_path": "/order-confirmed",
    "builder": BUILDER,
    "fields": [
        {"name": "name", "label": "Your Name", "type": "text", "required": True},
        {"name": "email", "label": "Email", "type": "email", "required": True},
        {"name": "phone", "label": "Phone", "type": "tel", "required": True},
        {"name": "shopify_account", "label": "Do you have a Shopify account?", "type": "select",
         "options": ["Yes, I have one", "No, please help me set one up"]},
        {"name": "notes", "label": "Anything else?", "type": "textarea",
         "placeholder": "e.g. stores you like the look of, the kind of products you'd like, launch date"},
    ],
    "consent": "I'm happy to receive occasional marketing emails from Easy Ecommerce Marketing. You can unsubscribe at any time.",
}

ENQUIRY = {
    "submit": "Send Enquiry",
    "success_path": "/thank-you",
    "fields": [
        {"name": "name", "label": "Your Name", "type": "text", "required": True, "width": "half"},
        {"name": "email", "label": "Email", "type": "email", "required": True, "width": "half"},
        {"name": "phone", "label": "Phone", "type": "tel", "required": True, "width": "half"},
        {"name": "website", "label": "Store name or website (if you have one)", "type": "text", "width": "half"},
        {"name": "providing", "label": "What would you like to provide?", "type": "select", "required": True,
         "options": ["My own products", "My own logo", "My own products and logo"]},
        {"name": "product_count", "label": "Roughly how many products?", "type": "select",
         "options": ["Up to 15", "16 to 50", "51 to 150", "More than 150"]},
        {"name": "message", "label": "Tell us about your store", "type": "textarea", "required": True,
         "placeholder": "What you sell, where your products come from, and anything else we should know"},
    ],
    "consent": "I'm happy to receive occasional marketing emails from Easy Ecommerce Marketing. You can unsubscribe at any time.",
}

WEB = [  # screenshots uploaded with the web design page
    ("HannaBanna Clothing", "web-design-hannabanna-clothing.webp", "https://www.hannabannaclothing.com/",
     "A US women's and plus-size clothing boutique with a large, easy-to-use menu and product-led design."),
    ("Precious Pulse Jewelry", "web-design-precious-pulse-jewelry.webp", "https://preciouspulsejewelry.com/",
     "An elegant jewellery store with editorial styling and simple, price-led shopping."),
    ("Football Mastery", "web-design-football-mastery.webp", "https://footballmastery.co.uk/",
     "A UK football training equipment store with bundles, reviews and event bookings."),
]

page = {
    "type": "page", "path": PATH,
    "title": "Turnkey Shopify Stores Built in 72 Hours | Easy Ecommerce Marketing",
    "meta_description": "A fully built, ready-to-sell Shopify store in 72 hours, with logo design and product descriptions included. Choose your options, see your price and order online. From £399.",
    "h1": "Your Shopify Store, Built in 72 Hours",
    "blocks": [
        {"type": "hero", "eyebrow": "Turnkey Shopify Stores", "heading": "Your Shopify Store, Built in 72 Hours", "center": True,
         "text": "A fully built, ready-to-sell Shopify store, designed around your brand and loaded with your products. "
                 "Logo design and your first batch of products included. Choose your options below, see your price, and be open for business in three days.\n\n**From £399 including VAT, one-off.**",
         "buttons": [{"label": "Build My Store", "href": "#build"}, {"label": "How It Works", "href": "#how"}]},
        {"type": "cards", "heading": "Included in Every Store", "columns": 4, "items": [
            {"title": "Branded Design", "md": "A clean, mobile-first Shopify theme styled with your colours and fonts."},
            {"title": "Logo Design", "md": "A professional logo designed for your store and social media."},
            {"title": "Your First Products", "md": "We load your store with its first batch of products, with images, prices and variants, organised into collections."},
            {"title": "Product Descriptions", "md": "Unique, SEO-friendly descriptions written for every product in your package."},
            {"title": "Essential Pages", "md": "Home, About, Contact and FAQ pages, plus refund, privacy, shipping and terms policies."},
            {"title": "Payments & Shipping", "md": "Shopify Payments, PayPal and your shipping rates set up and tested, ready to take orders."},
            {"title": "SEO & Analytics Ready", "md": "Page titles and descriptions, Google Analytics 4 and Search Console connected from day one."},
            {"title": "7 Days Support", "md": "A video walkthrough of your store and 7 days of support after launch. Need longer? Add extended support."},
        ]},
        {"type": "cards", "bg": "soft", "anchor": "how", "heading": "How It Works", "columns": 4, "items": [
            {"title": "1. Build & order", "md": "Choose your options below, see your price and pay securely by card."},
            {"title": "2. Quick checklist", "md": "Within one working day we email a short checklist: your business details, shipping preferences and Shopify access."},
            {"title": "3. We build it in 72 hours", "md": "We design your logo and store, load your first products and test checkout."},
            {"title": "4. Launch", "md": "You review it, we make any tweaks, and your store goes live."},
        ]},
        {"type": "store_builder", "form": "turnkey", "anchor": "build", "heading": "Build Your Store",
         "intro": "Choose your options, see your price and order securely online. We design your logo and load your first products for you. "
                  "Want to use your own products or logo? [Send us an enquiry](#enquire) instead.",
         "products_hint": "We'll load your store with its first batch of products, with images, prices and descriptions, and set up your collections. "
                          "Want to use your own products? [Send us an enquiry](#enquire).",
         "palette_hint": "Pick a starting palette. We'll design your logo to match.",
         "more_products": "More than 150 products? [Get in touch](#enquire) for a custom quote.",
         "after_button": "🔒 Secure card payment by Stripe. We'll email you a short checklist within one working day. "
                         "Your 72-hour build starts once we've received it, along with access to your Shopify account."},
        {"type": "form", "form": "turnkey_enquiry", "anchor": "enquire", "bg": "soft", "heading": "Want to Use Your Own Products or Logo?",
         "md": "Our turnkey stores come with a logo designed for you and your first batch of products loaded. "
               "If you'd rather supply your own products or logo, tell us about your store and we'll send you a quote and timeline, "
               "usually within one working day."},
        {"type": "cases", "heading": "Shopify Stores We've Built", "items": [
            {"title": t, "md": f"{d}\n\n[Visit {t} →]({u})", "image": {"src": f"/media/{img}", "alt": f"{t} Shopify store"}}
            for t, img, u, d in WEB]},
        {"type": "shared", "key": "testimonials"},
        {"type": "faq", "heading": "Turnkey Store FAQs", "items": [
            {"q": "What do I need to provide?",
             "a": "Very little. We design your logo and load your first batch of products for you. We just need your business details "
                  "(for your contact page and policies), your shipping preferences and access to your Shopify account. Don't have an "
                  "account? We'll help you set one up."},
            {"q": "Can I use my own products or logo?",
             "a": "Yes, but that's a different service from our turnkey stores. [Send us an enquiry](#enquire) and we'll give you a "
                  "quote and timeline."},
            {"q": "How does payment work?",
             "a": "You pay securely by card when you place your order, through Stripe. All our prices include VAT, and you'll get a "
                  "receipt by email straight away."},
            {"q": "When does the 72 hours start?",
             "a": "Once we've received your completed checklist and access to your Shopify account. We'll email the checklist "
                  "within one working day of your order, and it only takes a few minutes to fill in."},
            {"q": "Is the Shopify subscription included?",
             "a": "No. Your store is built in your own Shopify account, so you pay Shopify directly for your plan and any paid apps. "
                  "That means you own the store and everything in it."},
            {"q": "Can I make changes after launch?",
             "a": "Yes. You'll get a video walkthrough so you can update products and pages yourself, and 7 days of support after "
                  "launch. For longer cover, add extended support of 30 days (£99), 90 days (£199), 6 months (£399) or 1 year (£599)."},
            {"q": "I have more than 150 products. Can you still help?",
             "a": "Yes. Larger catalogues take a little longer to load and check, so [send us an enquiry](#enquire) and we'll give you a "
                  "custom quote and timeline."},
            {"q": "Can you help me get sales once the store is live?",
             "a": "Yes, that's what we do. We run [SEO](/seo) and [Google Ads](/ppc) for ecommerce stores, so we can help you get "
                  "traffic and sales from day one."},
        ]},
        {"type": "cta", "heading": "Ready to Launch Your Store?", "md": "Choose your options and get your price in under two minutes.",
         "buttons": [{"label": "Build My Store", "href": "#build"}]},
    ],
}

confirmed = {
    "type": "page", "path": "/order-confirmed", "noindex": 1,
    "title": "Order Confirmed | Easy Ecommerce Marketing",
    "meta_description": "Thank you for your order.",
    "h1": "Thank You, Your Order Is In",
    "blocks": [
        {"type": "hero", "heading": "Thank You, Your Order Is In", "center": True,
         "text": "We're excited to build your store. If you paid by card, your receipt is on its way to your inbox."},
        {"type": "cards", "heading": "What Happens Next", "columns": 3, "items": [
            {"title": "1. Your checklist", "md": "Within one working day we'll email you a simple checklist of what we need."},
            {"title": "2. Send your details", "md": "Your business details, shipping preferences and access to your Shopify account."},
            {"title": "3. 72-hour build", "md": "We design your logo, build your store and load your first products, then send it to you to review."},
        ]},
        {"type": "cta", "heading": "Questions in the Meantime?", "md": "Just reply to your confirmation email and we'll get straight back to you.",
         "buttons": [{"label": "Back to Home", "href": "/"}]},
    ],
}

settings_patch = {
    "set": {"forms.turnkey": FORM, "forms.turnkey_enquiry": ENQUIRY},
    "nav_children": [{"href": "/services", "children": [
        {"label": "SEO", "href": "/seo"}, {"label": "PPC", "href": "/ppc"}, {"label": "Web Design", "href": "/web-design"},
        {"label": "Turnkey Shopify Stores", "href": PATH}]}],
    "append_unique": [{"path": "footer.links", "items": [{"label": "Turnkey Shopify Stores", "href": PATH}]}],
}

site = json.load(open(os.path.join(HERE, "..", "import-data", "eem", "site.json"), encoding="utf-8"))
dump = lambda n, o: json.dump(o, open(f"{OUT}/{n}", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
dump("site.json", {"slug": site["slug"], "name": site["name"], "domain": site["domain"]})
dump("content.json", [page, confirmed])
dump("settings-patch.json", settings_patch)
print("built", PATH)
