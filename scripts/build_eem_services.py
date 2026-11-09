#!/usr/bin/env python3
"""
Adds the SEO, PPC and Web Design service pages to easyecommercemarketing.com,
and links them from the homepage service cards and the Services page.

  python3 scripts/build_eem_services.py --images <folder with the case study screenshots>
  node scripts/import.mjs import-data/eem-services --api <cms url> --only media,content,settings

The homepage and Services page are only updated if they haven't been edited in the CMS
since the original migration; otherwise the import skips them and keeps your version.
"""
import argparse, json, os, sys
from PIL import Image

HERE = os.path.dirname(__file__)
ap = argparse.ArgumentParser()
ap.add_argument("--images", required=True, help="folder holding the screenshots named as in CASE_IMAGES")
ap.add_argument("--base", default=os.path.join(HERE, "..", "import-data", "eem", "content.json"),
                help="the EEM migration content.json (source for the homepage and Services page)")
ap.add_argument("--out", default=os.path.join(HERE, "..", "import-data", "eem-services"))
args = ap.parse_args()
OUT = os.path.abspath(args.out)
os.makedirs(f"{OUT}/media", exist_ok=True)

AUDIT = "/free-audit"
UNEDITED_SINCE = "2026-10-29 00:00:00"   # after the EEM migration import

# source screenshot -> published filename
CASE_IMAGES = {
    "seo-1.png": "seo-case-organic-revenue-400.webp",
    "seo-2.png": "seo-case-organic-revenue-91.webp",
    "seo-3.png": "seo-case-new-site-search-console.webp",
    "ppc-1.png": "ppc-case-conversion-value-180.webp",
    "ppc-2.png": "ppc-case-conversion-value-178.webp",
    "ppc-3.png": "ppc-case-conversions-66.webp",
    "web-1.png": "web-design-hannabanna-clothing.webp",
    "web-2.png": "web-design-precious-pulse-jewelry.webp",
    "web-3.png": "web-design-football-mastery.webp",
    "leadgen-1.png": "lead-gen-pivotal-accountants.webp",
}
media = {}

def convert():
    for src, dst in CASE_IMAGES.items():
        im = Image.open(os.path.join(args.images, src))
        im = im.convert("RGB")
        if im.width > 1600:
            im = im.resize((1600, round(im.height * 1600 / im.width)), Image.LANCZOS)
        # data screenshots stay crisp; site screenshots can be smaller
        q = 92 if src.startswith(("seo", "ppc")) else 84
        im.save(f"{OUT}/media/{dst}", "WEBP", quality=q, method=6)
        media[dst] = {"w": im.width, "h": im.height, "mime": "image/webp"}

def img(src, alt):
    dst = CASE_IMAGES[src]
    return {"src": f"/media/{dst}", "alt": alt, "w": media[dst]["w"], "h": media[dst]["h"]}

def stats(*pairs):
    cells = "".join(f'<div class="stat"><b>{v}</b><span>{k}</span></div>' for v, k in pairs)
    return f'<div class="stats">{cells}</div>'

def full_size(src):
    return f"[View full size](/media/{CASE_IMAGES[src]})"

def audit_cta(heading, text):
    return {"type": "cta", "heading": heading, "md": text, "buttons": [{"label": "Get Your Free Audit", "href": AUDIT}]}

# ---------------------------------------------------------------- SEO

def seo_page():
    return {
        "type": "page", "path": "/seo",
        "title": "Ecommerce SEO Services | Easy Ecommerce Marketing",
        "meta_description": "Ecommerce SEO that grows organic revenue: technical fixes, product and category page optimisation, content and link building. Get a free SEO audit.",
        "h1": "Ecommerce SEO Services",
        "blocks": [
            {"type": "hero", "eyebrow": "SEO", "heading": "Ecommerce SEO Services", "center": True,
             "text": "More of the right people finding your store on Google, and more of them buying. We fix the technical issues "
                     "holding your rankings back, then build the content and links that move you up the results.",
             "buttons": [{"label": "Get Your Free SEO Audit", "href": AUDIT}, {"label": "See Our Results", "href": "#results"}]},
            {"type": "cards", "heading": "What's Included", "columns": 3,
             "intro": "SEO for online stores is different. Most of your traffic should land on category and product pages, not just your blog, so that's where we focus.",
             "items": [
                 {"title": "Technical SEO",
                  "md": "Our audit finds the issues that stop Google crawling and ranking your store: slow pages, duplicate product URLs, "
                        "broken links, missing structured data and indexing problems. We prioritise and fix them."},
                 {"title": "Product & Category Pages",
                  "md": "We optimise the pages that make you money: titles, descriptions, internal linking and on-page copy, "
                        "so your categories and products rank for the searches your customers actually use."},
                 {"title": "Content & Link Building",
                  "md": "We treat content and links as one job. Useful guides and buying advice bring in traffic and naturally earn "
                        "the links that lift your whole site's rankings."},
             ]},
            {"type": "cards", "bg": "soft", "heading": "How We Work", "columns": 4,
             "items": [
                 {"title": "1. Free audit", "md": "A full review of your site, rankings and competitors, so you know exactly where the opportunities are."},
                 {"title": "2. Strategy", "md": "A clear plan built around the products and categories that drive your revenue."},
                 {"title": "3. Implementation", "md": "We make the technical fixes, optimise your pages and publish content each month."},
                 {"title": "4. Reporting", "md": "Monthly reports on rankings, organic traffic and, most importantly, organic revenue."},
             ]},
            {"type": "cases", "anchor": "results", "heading": "SEO Results",
             "intro": "Real numbers from our clients' Google Analytics and Search Console accounts.",
             "items": [
                 {"title": "Online Store With 400% More Organic Revenue",
                  "md": "Comparing 1 January to 9 November 2026 with the same period in 2025, organic search revenue rose from "
                        "$16,455 to $82,337 and organic search became one of the store's biggest revenue channels.\n\n"
                        + stats(("+400%", "organic revenue"), ("+94%", "organic key events"), ("+197%", "organic conversion rate"))
                        + "\n\n" + full_size("seo-1.png"),
                  "image": img("seo-1.png", "Google Analytics: organic search revenue up 400% year on year")},
                 {"title": "Ecommerce Brand Nearly Doubles Organic Revenue",
                  "md": "Year to date, organic search sessions grew from 149,397 to 217,185 and organic revenue grew from "
                        "£65,492 to £125,362 compared with the same period last year.\n\n"
                        + stats(("+91%", "organic revenue"), ("+45%", "organic sessions"), ("+437%", "organic key events"))
                        + "\n\n" + full_size("seo-2.png"),
                  "image": img("seo-2.png", "Google Analytics: organic search revenue up 91% year on year")},
                 {"title": "New Website To 663,000 Search Impressions In 11 Months",
                  "md": "Starting from zero in December 2025, this new site has earned 11,300 clicks and 663,000 impressions "
                        "from Google, with an average ranking position of 7.5, and it's still climbing every month.\n\n"
                        + stats(("663K", "impressions"), ("11.3K", "clicks"), ("7.5", "average position"))
                        + "\n\n" + full_size("seo-3.png"),
                  "image": img("seo-3.png", "Google Search Console: clicks and impressions growing from launch")},
             ]},
            {"type": "shared", "key": "testimonials"},
            {"type": "faq", "heading": "SEO FAQs", "items": [
                {"q": "How long does SEO take to work?",
                 "a": "Technical fixes can show results within weeks, but SEO is a long-term channel. Most stores see meaningful "
                      "growth in rankings and organic traffic over three to six months, and it keeps compounding after that."},
                {"q": "What's the difference between SEO and PPC?",
                 "a": "PPC buys traffic straight away and stops when you stop paying. SEO builds rankings you own, so the traffic "
                      "keeps coming. Many of our clients use both: PPC for instant sales while SEO grows. See our [PPC services](/ppc)."},
                {"q": "What does the free SEO audit include?",
                 "a": "We review your site's technical health, how your key pages rank, and what your competitors are doing, then "
                      "show you the biggest opportunities to grow organic sales. There's no obligation."},
                {"q": "How do you report on results?",
                 "a": "You get a monthly report covering rankings, organic traffic and organic revenue, so you can see exactly "
                      "what SEO is returning for your business."},
            ]},
            audit_cta("Find Out What's Holding Your Rankings Back",
                      "Get a free SEO audit of your store and a clear plan to grow your organic sales."),
        ],
    }

# ---------------------------------------------------------------- PPC

def ppc_page():
    return {
        "type": "page", "path": "/ppc",
        "title": "PPC Management & Google Ads Agency | Easy Ecommerce Marketing",
        "meta_description": "Google Ads and Shopping campaigns built for ecommerce: Merchant Centre feeds, Shopping and Search campaigns, and ongoing optimisation for profitable ROAS.",
        "h1": "PPC Management for Ecommerce",
        "blocks": [
            {"type": "hero", "eyebrow": "PPC", "heading": "PPC Management for Ecommerce", "center": True,
             "text": "Google Ads campaigns built around profit, not just clicks. We set up and manage Shopping and Search campaigns "
                     "that put your products in front of buyers and keep wasted spend to a minimum.",
             "buttons": [{"label": "Get Your Free PPC Audit", "href": AUDIT}, {"label": "See Our Results", "href": "#results"}]},
            {"type": "cards", "heading": "What's Included", "columns": 3,
             "intro": "Every account is different, so we build campaigns around your industry, your margins and your budget.",
             "items": [
                 {"title": "Google Shopping & Merchant Centre",
                  "md": "We manage your Google Merchant Centre and optimise your product feed (titles, images, attributes and errors) "
                        "so your products show for the right searches."},
                 {"title": "Search & Performance Max",
                  "md": "Search campaigns that capture people looking for exactly what you sell, plus Performance Max where it "
                        "pays its way, all tied to accurate conversion tracking."},
                 {"title": "Ongoing Optimisation",
                  "md": "We work through the data every week: cutting wasted search terms, adjusting bids and budgets, and moving "
                        "spend to the products and campaigns that return the most."},
             ]},
            {"type": "cards", "bg": "soft", "heading": "How We Work", "columns": 4,
             "items": [
                 {"title": "1. Free audit", "md": "We review your account, tracking and product feed to find wasted spend and missed sales."},
                 {"title": "2. Build", "md": "Campaigns structured around your best products and margins, with tracking you can trust."},
                 {"title": "3. Optimise", "md": "Weekly optimisation of search terms, bids, budgets and your feed."},
                 {"title": "4. Report", "md": "Clear monthly reporting on spend, revenue and return on ad spend."},
             ]},
            {"type": "cases", "anchor": "results", "heading": "PPC Results",
             "intro": "Taken straight from our clients' Google Ads accounts, each compared with the previous period.",
             "items": [
                 {"title": "180% More Conversion Value at a 12x ROAS",
                  "md": "Conversions grew 137% and conversion value grew 180%, with the conversion rate up 262%, returning "
                        "£5,148 in conversion value from £414 of ad spend.\n\n"
                        + stats(("+180%", "conversion value"), ("+137%", "conversions"), ("12.4x", "ROAS"))
                        + "\n\n" + full_size("ppc-1.png"),
                  "image": img("ppc-1.png", "Google Ads: conversion value up 180%")},
                 {"title": "CA$205,000 in Conversion Value at a 6x ROAS",
                  "md": "As we scaled this account, conversion value grew 179% while clicks rose 70% and click-through rate "
                        "improved 47%, generating CA$205,523 from CA$34,220 of spend.\n\n"
                        + stats(("+179%", "conversion value"), ("+70%", "clicks"), ("6x", "ROAS"))
                        + "\n\n" + full_size("ppc-2.png"),
                  "image": img("ppc-2.png", "Google Ads: conversion value up 179%")},
                 {"title": "66% More Conversions and Over CA$516,000 in Value",
                  "md": "Conversions grew 66% and conversion value grew 47%, reaching CA$516,772 from CA$42,780 of spend, "
                        "a 12x return on ad spend.\n\n"
                        + stats(("+66%", "conversions"), ("+47%", "conversion value"), ("12x", "ROAS"))
                        + "\n\n" + full_size("ppc-3.png"),
                  "image": img("ppc-3.png", "Google Ads: conversions up 66%")},
             ]},
            {"type": "text", "center": True, "heading": "Is Your Ad Spend Actually Profitable?",
             "md": "Use our free ROI calculator to work out your true return once product costs and fees are included.",
             "buttons": [{"label": "Try the ROI Calculator", "href": "/roi-calculator"}]},
            {"type": "shared", "key": "testimonials"},
            {"type": "faq", "heading": "PPC FAQs", "items": [
                {"q": "How much should I spend on Google Ads?",
                 "a": "It depends on your products, margins and competition. We'll recommend a starting budget after your free "
                      "audit and scale it as the campaigns prove profitable."},
                {"q": "Can you take over my existing Google Ads account?",
                 "a": "Yes. We start with an audit of your current account so we keep what's working and fix what isn't, "
                      "rather than starting from scratch."},
                {"q": "Do you manage Google Merchant Centre?",
                 "a": "Yes. Feed quality has a huge effect on Shopping performance, so managing Merchant Centre and optimising "
                      "your product feed is part of the service."},
                {"q": "How quickly will I see results?",
                 "a": "PPC works fast. Campaigns start driving traffic as soon as they go live, and performance improves over "
                      "the first few weeks as we optimise using real data."},
            ]},
            audit_cta("Stop Wasting Ad Spend", "Get a free audit of your Google Ads account and see where your budget could work harder."),
        ],
    }

# ---------------------------------------------------------------- Web design

def web_page():
    def visit(url, label):
        return f"[Visit {label} →]({url})"
    return {
        "type": "page", "path": "/web-design",
        "title": "Ecommerce Web Design & Shopify Development | Easy Ecommerce Marketing",
        "meta_description": "Shopify stores and lead generation websites designed to convert, built by a team that also runs your SEO and ads. See our recent work.",
        "h1": "Ecommerce Web Design",
        "blocks": [
            {"type": "hero", "eyebrow": "Web Design & Development", "heading": "Ecommerce Web Design", "center": True,
             "text": "Your website is your digital storefront. We design and build Shopify stores and lead generation sites "
                     "that look great, load fast and are built from day one to rank and convert.",
             "buttons": [{"label": "Talk To Us About Your Website", "href": AUDIT}, {"label": "See Our Work", "href": "#work"}]},
            {"type": "cards", "heading": "What We Build", "columns": 3,
             "items": [
                 {"title": "Shopify Stores",
                  "md": "New stores and redesigns on Shopify, with custom theme work, clear navigation and product pages "
                        "designed to sell."},
                 {"title": "Lead Generation Websites",
                  "md": "Fast sites built to capture enquiries, with service and location pages, quote forms and leads "
                        "delivered straight to your inbox."},
                 {"title": "Built for Marketing",
                  "md": "Because we also run SEO and paid ads, every site we build is ready for both: clean structure, "
                        "fast pages and accurate tracking."},
             ]},
            {"type": "cases", "anchor": "work", "heading": "Recent Work", "items": [
                {"title": "HannaBanna Clothing",
                 "md": "A Shopify store for a US women's and plus-size clothing boutique. A large menu helps shoppers find "
                       "exactly what they want by type, size, colour and occasion, with product-led imagery and free US "
                       "shipping and returns front and centre.\n\n" + visit("https://www.hannabannaclothing.com/", "HannaBanna Clothing"),
                 "image": img("web-1.png", "HannaBanna Clothing website homepage")},
                {"title": "Precious Pulse Jewelry",
                 "md": "An elegant Shopify store for affordable sterling silver jewellery. Editorial typography and lifestyle "
                       "photography give a premium feel, while clear categories and prices keep shopping simple.\n\n"
                       + visit("https://preciouspulsejewelry.com/", "Precious Pulse Jewelry"),
                 "image": img("web-2.png", "Precious Pulse Jewelry website homepage")},
                {"title": "Football Mastery",
                 "md": "A Shopify store for a UK football training equipment brand, selling kit to players, parents and "
                       "coaches alongside event bookings. Bundles, reviews and trust messages like free delivery, "
                       "30-day returns and Klarna are built into the shopping journey.\n\n"
                       + visit("https://footballmastery.co.uk/", "Football Mastery"),
                 "image": img("web-3.png", "Football Mastery website homepage")},
            ]},
            {"type": "cases", "bg": "soft", "heading": "Lead Generation Websites",
             "intro": "We also build and run lead generation websites that turn search traffic into enquiries.",
             "items": [
                 {"title": "Pivotal Accountants",
                  "md": "A UK service matching people and businesses with local accountants. The site has 10 service pages "
                        "and nearly 300 county and town pages, each with a quote form that sends the enquiry straight to "
                        "the right local firm.\n\n" + visit("https://pivotalaccountants.com/", "Pivotal Accountants"),
                  "image": img("leadgen-1.png", "Pivotal Accountants website homepage")},
             ]},
            {"type": "shared", "key": "testimonials"},
            {"type": "faq", "heading": "Web Design FAQs", "items": [
                {"q": "Do you only build on Shopify?",
                 "a": "Shopify is our main platform for online stores. For lead generation sites we build on a fast, low-cost "
                      "platform that's easy for you to update. Tell us what you need and we'll recommend the right fit."},
                {"q": "Can you redesign my existing store?",
                 "a": "Yes. We can redesign your current Shopify store, keeping your products, customers and order history, "
                      "and protecting the rankings you've already earned."},
                {"q": "Will my new website be SEO friendly?",
                 "a": "Yes. Every site is built with clean page structure, fast loading and proper redirects, so it's ready "
                      "to rank from launch. See our [SEO services](/seo)."},
                {"q": "Can I update the website myself?",
                 "a": "Yes. We'll show you how to update products, pages and blog posts yourself, and we're on hand if you "
                      "need help."},
            ]},
            audit_cta("Ready For a Website That Sells?", "Tell us about your business and we'll show you what we'd build."),
        ],
    }

# ---------------------------------------------------------------- link the new pages from existing ones

def linked_pages():
    base = {c["path"]: c for c in json.load(open(args.base, encoding="utf-8"))}
    out = []
    home = json.loads(json.dumps(base["/"]))
    links = {"SEO": "/seo", "PPC": "/ppc", "Web Design & Dev": "/web-design"}
    for b in home["blocks"]:
        if b["type"] == "cards" and b.get("heading") == "Our Services":
            for it in b["items"]:
                if it["title"] in links:
                    it["href"] = links[it["title"]]
                    it["link_label"] = "Find out more →"
    home["only_if_unedited_since"] = UNEDITED_SINCE
    out.append(home)

    svc = json.loads(json.dumps(base["/services"]))
    for b in svc["blocks"]:
        if b["type"] == "services":
            for it in b["items"]:
                t = it["title"]
                if t.startswith("SEO"):
                    it["button"] = {"label": "See Our SEO Services", "href": "/seo"}
                elif t.startswith("PPC"):
                    it["button"] = {"label": "See Our PPC Services", "href": "/ppc"}
            b["items"].append({
                "title": "Web Design & Development",
                "md": "We design and build Shopify stores and lead generation websites that look great, load fast and are "
                      "built to rank and convert from day one.",
                "image": img("web-3.png", "Football Mastery Shopify store"),
                "button": {"label": "See Our Web Design Work", "href": "/web-design"},
            })
    svc["only_if_unedited_since"] = UNEDITED_SINCE
    out.append(svc)
    return out

# ---------------------------------------------------------------- run

convert()
content = [seo_page(), ppc_page(), web_page()] + linked_pages()
site = json.load(open(os.path.join(os.path.dirname(args.base), "site.json"), encoding="utf-8"))
dump = lambda n, o: json.dump(o, open(f"{OUT}/{n}", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
dump("site.json", site)   # only its slug is used with --only media,content
dump("content.json", content)
dump("media.json", media)
# Services dropdown in the top menu + footer links, applied without touching other settings
dump("settings-patch.json", {
    "nav_children": [{"href": "/services", "children": [
        {"label": "SEO", "href": "/seo"}, {"label": "PPC", "href": "/ppc"}, {"label": "Web Design", "href": "/web-design"}]}],
    "append_unique": [{"path": "footer.links", "items": [
        {"label": "SEO", "href": "/seo"}, {"label": "PPC", "href": "/ppc"}, {"label": "Web Design", "href": "/web-design"}]}],
})
print("pages:", [c["path"] for c in content], "| images:", len(media))
