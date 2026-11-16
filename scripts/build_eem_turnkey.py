#!/usr/bin/env python3
"""
Adds the Turnkey Shopify Stores page (with its store builder and pricing) to easyecommercemarketing.com.

  python3 scripts/build_eem_turnkey.py
  node scripts/import.mjs import-data/eem-turnkey --api <cms url> --only content,settings

Prices, options and wording of the builder live in site settings under forms.turnkey.builder,
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
    "price_note": "One-off price, excluding VAT. Your Shopify plan and any paid apps are billed by Shopify.",
    "tiers": [
        {"key": "starter", "label": "Starter", "products": 15, "pages": 5, "price": 595},
        {"key": "growth", "label": "Growth", "products": 50, "pages": 8, "price": 895, "note": "Most popular"},
        {"key": "pro", "label": "Pro", "products": 150, "pages": 12, "price": 1395},
    ],
    "addons": [
        {"key": "logo", "label": "Logo design", "desc": "A clean, professional logo with files for your store and social media", "price": 195},
        {"key": "copy", "label": "Product descriptions", "desc": "Unique, SEO-friendly descriptions written for every product (£6 each)", "per_product": 6},
        {"key": "email", "label": "Email marketing setup", "desc": "Klaviyo welcome, abandoned cart and post-purchase emails", "price": 295},
        {"key": "shopping", "label": "Google Shopping setup", "desc": "Merchant Centre account and product feed, ready for Shopping ads", "price": 195},
        {"key": "seo", "label": "SEO starter pack", "desc": "Keyword research, optimised collection pages and 3 blog articles", "price": 295},
        {"key": "premium_theme", "label": "Premium theme setup", "desc": "Built on a premium Shopify theme (theme licence bought separately)", "price": 150},
        {"key": "domain", "label": "Domain & email connection", "desc": "Connect your domain and set up your business email address", "price": 75},
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
    "submit": "Request My Store",
    "success_path": "/thank-you",
    "builder": BUILDER,
    "fields": [
        {"name": "name", "label": "Your Name", "type": "text", "required": True},
        {"name": "email", "label": "Email", "type": "email", "required": True},
        {"name": "phone", "label": "Phone", "type": "tel", "required": True},
        {"name": "shopify_account", "label": "Do you have a Shopify account?", "type": "select",
         "options": ["Yes, I have one", "No, please help me set one up"]},
        {"name": "has_logo", "label": "Do you have a logo?", "type": "select",
         "options": ["Yes", "No (I've added logo design above)", "No, not needed yet"]},
        {"name": "products_ready", "label": "Are your products ready to add?", "type": "select",
         "options": ["Yes, I have a spreadsheet and images", "Partly", "Not yet"]},
        {"name": "notes", "label": "Anything else?", "type": "textarea",
         "placeholder": "e.g. stores you like the look of, launch date, questions"},
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
    "meta_description": "A fully built, ready-to-sell Shopify store in 72 hours. Choose your products, colours and extras, see your price instantly, and launch fast. From £595.",
    "h1": "Your Shopify Store, Built in 72 Hours",
    "blocks": [
        {"type": "hero", "eyebrow": "Turnkey Shopify Stores", "heading": "Your Shopify Store, Built in 72 Hours", "center": True,
         "text": "A fully built, ready-to-sell Shopify store, designed around your brand and loaded with your products. "
                 "Choose your options below, see your price instantly, and be open for business in three days.\n\n**From £595, one-off.**",
         "buttons": [{"label": "Build My Store", "href": "#build"}, {"label": "How It Works", "href": "#how"}]},
        {"type": "cards", "heading": "Included in Every Store", "columns": 3, "items": [
            {"title": "Branded Design", "md": "A clean, mobile-first Shopify theme styled with your logo, colours and fonts."},
            {"title": "Your Products Added", "md": "Products uploaded with images, prices, variants and stock, organised into collections."},
            {"title": "Essential Pages", "md": "Home, About, Contact and FAQ pages, plus refund, privacy, shipping and terms policies."},
            {"title": "Payments & Shipping", "md": "Shopify Payments, PayPal and your shipping rates set up and tested, ready to take orders."},
            {"title": "SEO & Analytics Ready", "md": "Page titles and descriptions, Google Analytics 4 and Search Console connected from day one."},
            {"title": "Handover & Support", "md": "A video walkthrough of your store and 14 days of support after launch for any fixes."},
        ]},
        {"type": "cards", "bg": "soft", "anchor": "how", "heading": "How It Works", "columns": 4, "items": [
            {"title": "1. Build your store", "md": "Choose your products, colours and extras below and see your price straight away."},
            {"title": "2. Send us your content", "md": "We confirm within one working day. You send your products, images and logo."},
            {"title": "3. We build it in 72 hours", "md": "Our team designs and builds your store, loads your products and tests checkout."},
            {"title": "4. Launch", "md": "You review it, we make any tweaks, and your store goes live."},
        ]},
        {"type": "store_builder", "form": "turnkey", "anchor": "build", "heading": "Build Your Store",
         "intro": "Choose your options and see your price instantly. No payment needed now.",
         "more_products": "More than 150 products? [Get in touch](/free-audit) for a custom quote.",
         "after_button": "No payment now. We'll confirm your details within one working day and send your invoice. "
                         "Your 72-hour build starts once we've received payment and your product details, images and logo."},
        {"type": "cases", "heading": "Shopify Stores We've Built", "items": [
            {"title": t, "md": f"{d}\n\n[Visit {t} →]({u})", "image": {"src": f"/media/{img}", "alt": f"{t} Shopify store"}}
            for t, img, u, d in WEB]},
        {"type": "shared", "key": "testimonials"},
        {"type": "faq", "heading": "Turnkey Store FAQs", "items": [
            {"q": "What do I need to provide?",
             "a": "Your product details (a spreadsheet is ideal) with images and prices, your logo if you have one, and access to your "
                  "Shopify account. Don't have an account? We'll help you set one up."},
            {"q": "When does the 72 hours start?",
             "a": "Once we've received payment and everything we need from you: product details, images and logo. We'll send you a "
                  "simple checklist as soon as you order."},
            {"q": "Is the Shopify subscription included?",
             "a": "No. Your store is built in your own Shopify account, so you pay Shopify directly for your plan and any paid apps. "
                  "That means you own the store and everything in it."},
            {"q": "Can I make changes after launch?",
             "a": "Yes. You'll get a video walkthrough so you can update products and pages yourself, and we fix anything that needs "
                  "adjusting for 14 days after launch."},
            {"q": "I have more than 150 products. Can you still help?",
             "a": "Yes. Larger catalogues take a little longer to load and check, so [get in touch](/free-audit) and we'll give you a "
                  "custom quote and timeline."},
            {"q": "Can you help me get sales once the store is live?",
             "a": "Yes, that's what we do. We run [SEO](/seo) and [Google Ads](/ppc) for ecommerce stores, so we can help you get "
                  "traffic and sales from day one."},
        ]},
        {"type": "cta", "heading": "Ready to Launch Your Store?", "md": "Choose your options and get your price in under two minutes.",
         "buttons": [{"label": "Build My Store", "href": "#build"}]},
    ],
}

settings_patch = {
    "set": {"forms.turnkey": FORM},
    "nav_children": [{"href": "/services", "children": [
        {"label": "SEO", "href": "/seo"}, {"label": "PPC", "href": "/ppc"}, {"label": "Web Design", "href": "/web-design"},
        {"label": "Turnkey Shopify Stores", "href": PATH}]}],
    "append_unique": [{"path": "footer.links", "items": [{"label": "Turnkey Shopify Stores", "href": PATH}]}],
}

site = json.load(open(os.path.join(HERE, "..", "import-data", "eem", "site.json"), encoding="utf-8"))
dump = lambda n, o: json.dump(o, open(f"{OUT}/{n}", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
dump("site.json", {"slug": site["slug"], "name": site["name"], "domain": site["domain"]})
dump("content.json", [page])
dump("settings-patch.json", settings_patch)
print("built", PATH)
