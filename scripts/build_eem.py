#!/usr/bin/env python3
"""
One-off: turn the easyecommercemarketing.com crawl export into CMS import data.

  python3 scripts/build_eem.py [--export /path/to/export] [--out import-data/eem]

Writes:
  site.json       site row (theme, nav, footer, forms, GA4)
  shared.json     reusable sections (testimonials, FAQ, logos, location template ...)
  content.json    every page, post, location page and product
  redirects.json  GHL leftovers that should 301
  media/          every image converted to WebP (max 1600px wide) + the PDF
  media.json      filename -> {w, h, mime}

Then push it with:  node scripts/import.mjs import-data/eem --api http://localhost:8787
"""
import argparse, csv, json, os, re, shutil, sys
from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
import eem_extract as X

ap = argparse.ArgumentParser()
ap.add_argument("--export", default=X.EXPORT)
ap.add_argument("--out", default=os.path.join(os.path.dirname(__file__), "..", "import-data", "eem"))
args = ap.parse_args()
X.EXPORT = args.export
OUT = os.path.abspath(args.out)
os.makedirs(f"{OUT}/media", exist_ok=True)

DOMAIN = "easyecommercemarketing.com"
EMAIL = "help@easyecommercemarketing.com"
AUDIT = "/free-audit"

# ---------------------------------------------------------------- media: convert everything to WebP

media = {}      # new filename -> {w,h,mime}
rename = {}     # export filename -> new filename

def convert_all():
    src_dir = f"{X.EXPORT}/images"
    for name in sorted(os.listdir(src_dir)):
        src = os.path.join(src_dir, name)
        stem = os.path.splitext(name)[0]
        new = f"{stem}.webp"
        dst = f"{OUT}/media/{new}"
        try:
            im = Image.open(src)
            im.load()
        except Exception as e:
            print("  skip unreadable image", name, e)
            continue
        if not os.path.exists(dst):
            if im.mode not in ("RGB", "RGBA"):
                im = im.convert("RGBA" if "transparency" in im.info or im.mode in ("LA", "P") else "RGB")
            if im.width > 1600:
                im = im.resize((1600, round(im.height * 1600 / im.width)), Image.LANCZOS)
            im.save(dst, "WEBP", quality=82, method=5)
        w, h = Image.open(dst).size
        media[new] = {"w": w, "h": h, "mime": "image/webp"}
        rename[name] = new
    for f in os.listdir(f"{X.EXPORT}/files"):
        shutil.copy(f"{X.EXPORT}/files/{f}", f"{OUT}/media/{f}")
        media[f] = {"mime": "application/pdf"}
    # simple branded favicon (GHL served its generic one)
    fav = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#ee2a52"/><text x="32" y="45" font-family="Arial,Helvetica,sans-serif" font-size="38" font-weight="700" text-anchor="middle" fill="#fff">E</text></svg>'
    open(f"{OUT}/media/favicon.svg", "w").write(fav)
    media["favicon.svg"] = {"mime": "image/svg+xml"}

def img(export_name, alt=""):
    """Block image object for an image from the export."""
    if not export_name: return None
    n = rename.get(export_name)
    if not n: return None
    m = media[n]
    o = {"src": f"/media/{n}", "w": m.get("w"), "h": m.get("h")}
    if alt: o["alt"] = alt
    return o

def url(export_name):
    n = rename.get(export_name)
    return f"/media/{n}" if n else ""

def local_href(h):
    h = (h or "").replace(f"https://{DOMAIN}", "").replace(f"http://{DOMAIN}", "")
    return h or "/"

# ---------------------------------------------------------------- section helpers

def parts_of(slug, section_id):
    for sid, parts in X.sections(slug):
        if sid == section_id: return parts
    raise KeyError(f"{slug} {section_id}")

def first(parts, kind, n=0):
    found = [p for p in parts if p[0] == kind]
    return found[n] if len(found) > n else None

def texts(parts, kinds=("p",)):
    return [p[1] for p in parts if p[0] in kinds]

def is_subhead(t):
    return len(t) < 45 and not t.endswith(".") and not t.endswith("?")

def paras_md(lines, bold_subheads=True):
    out = []
    for t in lines:
        out.append(f"**{t}**" if bold_subheads and is_subhead(t) else t)
    return "\n\n".join(out)

# ---------------------------------------------------------------- shared sections (from the homepage)

def build_shared():
    home = "index"
    shared = []

    # testimonials
    p = parts_of(home, "section-n6imNsPft3")
    ps = texts(p)
    items = []
    for i in range(0, len(ps) - 2, 3):
        items.append({"title": ps[i].strip('"“” '), "quote": ps[i + 1], "author": ps[i + 2].lstrip("–- ").strip()})
    shared.append({"key": "testimonials", "label": "Testimonials", "blocks": [
        {"type": "testimonials", "anchor": "testimonials", "eyebrow": "Testimonials", "heading": "What others are saying", "items": items}]})

    # FAQ
    p = parts_of(home, "section-54OGasAEH3")
    qs = [x[1] for x in p if x[0] == "h4"]
    ans = texts(p)
    faq = [{"q": re.sub(r"^\d+\.\s*", "", q).strip() + ("" if q.strip().endswith("?") else "?"), "a": a} for q, a in zip(qs, ans)]
    shared.append({"key": "faq", "label": "FAQs", "blocks": [
        {"type": "faq", "anchor": "faqs", "heading": "Frequently Asked Questions", "items": faq}]})

    # client logos
    p = parts_of(home, "section-L6_n7vEZDK")
    shared.append({"key": "clients", "label": "Client logos", "blocks": [
        {"type": "logos", "heading": "Some Of Our Clients", "items": [img(x[1], "Client logo") for x in p if x[0] == "img"]}]})

    # partners
    p = parts_of(home, "section-X6eLyU75HQ")
    shared.append({"key": "partners", "label": "Accreditations & partners", "blocks": [
        {"type": "logos", "heading": "Our Accreditations & Partners", "items": [img(x[1], x[2]) for x in p if x[0] == "img"]}]})

    # case studies: headings and images appear in the same order
    p = parts_of(home, "section-A3tH0viVlU")
    heads = [x[1] for x in p if x[0] == "h1"][1:]
    subs = [x[1] for x in p if x[0] == "h2"]
    imgs = [x[1] for x in p if x[0] == "img"]
    cases = [{"title": h, "md": s.replace("!!!!", "!"), "image": img(i, h)} for h, s, i in zip(heads, subs, imgs)]
    shared.append({"key": "cases", "label": "2024 success stories", "blocks": [
        {"type": "cases", "heading": "Our 2024 Success Stories", "items": cases}]})

    # closing call to action
    p = parts_of(home, "section-CcSjVPtbCi")
    shared.append({"key": "cta", "label": "Contact call to action", "blocks": [
        {"type": "cta", "anchor": "contact", "heading": "Contact Us", "md": texts(p)[0] if texts(p) else "",
         "buttons": [{"label": "Get Your Free Audit", "href": AUDIT}]}]})

    shared.append({"key": "blog", "label": "Latest posts", "blocks": [{"type": "posts", "heading": "Our Blog", "count": 6, "button_label": "More stories"}]})

    # under every blog post
    shared.append({"key": "post_footer", "label": "Under every blog post", "blocks": [
        {"type": "cta", "heading": "Want results like these for your store?",
         "md": "Get a free audit of your site and marketing. We'll show you exactly where the growth is.",
         "buttons": [{"label": "Get Your Free Audit", "href": AUDIT}]}]})

    # the "proof" sections every page ends with
    shared.append({"key": "proof", "label": "Standard page footer sections", "blocks": [
        {"type": "shared", "key": "cases"}, {"type": "shared", "key": "clients"}, {"type": "shared", "key": "testimonials"},
        {"type": "shared", "key": "faq"}, {"type": "shared", "key": "partners"}, {"type": "shared", "key": "blog"},
        {"type": "shared", "key": "cta"}]})

    # location page template, from Norwich with the town name swapped for {{town}}
    shared.append({"key": "location_template", "label": "Location page layout", "blocks": location_template()})
    return shared

def townify(s, town):
    return re.sub(re.escape(town), "{{town}}", s)

def location_template():
    T = "Norwich"
    hero = parts_of("norwich", "section-GWZOfFsXz")
    hp = texts(hero)
    why_choose = next((x[1] for x in hero if x[0] == "h4"), "Why Choose Us?")
    hero_md = "\n\n".join([townify(hp[0], T), townify(hp[1], T), f"**{why_choose}**", townify(hp[2], T), townify(hp[3], T)])
    why = parts_of("norwich", "section-O4Yil_5B3V")
    proof = [img(x[1], "Client results") for x in why if x[0] == "img"]

    def svc(section, title_kind="h2"):
        p = parts_of("norwich", section)
        title = townify(first(p, "h2")[1], T)
        body = paras_md([townify(t, T) for t in texts(p) if t not in ("Facebook", "Instagram", "X", "LinkedIn", "Youtube", "TikTok")])
        im = next((x[1] for x in p if x[0] == "img"), None)
        return {"title": title, "md": body, "image": img(im, title.replace("{{town}}", "").strip()),
                "button": {"label": "Get Your FREE Audit", "href": AUDIT}}

    return [
        {"type": "hero", "text": hero_md, "image": "{{image}}", "image_alt": "Digital marketing in {{town}}",
         "buttons": [{"label": "Get Your Free Audit Today", "href": AUDIT}]},
        {"type": "location_body", "images": proof},
        {"type": "services", "heading": "Our Services In {{town}}", "items": [
            svc("section-FHAz5JliV3"), svc("section-C_iSOAfOYO"), svc("section-r4TaSfCodA"), svc("section--maFJ2nFI5")]},
        {"type": "shared", "key": "proof"},
    ]

# ---------------------------------------------------------------- core pages

def page_meta():
    rows = {}
    with open(f"{X.EXPORT}/pages.csv", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            rows[r["path"]] = r
    return rows

META = None

def core_pages():
    out = []
    M = META

    # ---- home
    p = parts_of("index", "section-cy__GJ-GC6")
    h2s = [x[1] for x in p if x[0] == "h2"]
    hero_imgs = [x[1] for x in p if x[0] == "img"]
    ps = texts(p)
    sv = parts_of("index", "section--0WKYPABSI")
    names = [x[1] for x in sv if x[0] == "h2"][1:]
    # services alternate: name, description (descriptions are h2 or p in GHL)
    seq = [x[1] for x in sv if x[0] in ("h2", "p")][1:]
    svc_items = [{"title": seq[i], "md": seq[i + 1]} for i in range(0, len(seq) - 1, 2)]
    team = parts_of("index", "section-tTaQc13iIZ")
    team_h = [x[1] for x in team if x[0] == "h2"]
    out.append({
        "type": "page", "path": "/", "title": M["/"]["title"], "meta_description": M["/"]["meta_description"],
        "h1": "Bringing New Customers To You",
        "blocks": [
            {"type": "hero", "eyebrow": h2s[0], "heading": "Bringing New Customers To You",
             "text": f"{h2s[1]}\n\n**{ps[0]}**", "image": img("79a65c71-3ec9-42e4-a077-73db0014864e-bg.png", "Smiling woman giving the OK sign"), "image_side": "left",
             "buttons": [{"label": "Get Your FREE Audit", "href": AUDIT}]},
            {"type": "text", "center": True, "heading": ps[1] if len(ps) > 1 else "Clients From All Around The World", "md": h2s[2] if len(h2s) > 2 else ""},
            {"type": "cards", "heading": "Our Services", "columns": 3, "items": svc_items,
             "buttons": [{"label": "Find Out More About Our Services", "href": "/services"}]},
            {"type": "split", "bg": "soft", "heading": team_h[0], "md": team_h[1], "image": img("671001cc4e44e6d29deff0e9-2aca21.png", "Search Console growth for a client"),
             "buttons": [{"label": "Get Your FREE Audit", "href": AUDIT}]},
            {"type": "shared", "key": "proof"},
        ]})

    # ---- services
    p = parts_of("services", "section-6py2gcA1m")
    intro = [x[1] for x in p if x[0] == "h2"][0]
    tp = texts(p)
    def svc_section(sid, title=None):
        q = parts_of("services", sid)
        t = title or first(q, "h2")[1]
        lines = [x for x in texts(q) if x not in ("Facebook", "Instagram", "X", "LinkedIn", "Youtube", "TikTok")]
        im = next((x[1] for x in q if x[0] == "img"), None)
        return {"title": t, "md": paras_md(lines), "image": img(im, t), "button": {"label": "Get Your FREE Audit", "href": AUDIT}}
    out.append({
        "type": "page", "path": "/services", "title": M["/services"]["title"], "meta_description": M["/services"]["meta_description"],
        "h1": "Services",
        "blocks": [
            {"type": "hero", "heading": "Our Digital Marketing Services", "center": True,
             "text": f"{intro}\n\n**{tp[0]}**\n\n{tp[1]}", "buttons": [{"label": "Get Your FREE Audit", "href": AUDIT}]},
            {"type": "services", "items": [svc_section("section-uPtLtzEPxF"), svc_section("section-VH88eQn1ol"),
                                           svc_section("section-M1v_DAr8w-"), svc_section("section-F_DXhse1PQ")]},
            {"type": "shared", "key": "clients"}, {"type": "shared", "key": "testimonials"}, {"type": "shared", "key": "faq"},
            {"type": "shared", "key": "partners"}, {"type": "shared", "key": "cta"},
        ]})
    # services page heading: "Services" alone was the GHL H1; give it a descriptive one
    out[-1]["h1"] = "Our Digital Marketing Services"

    # ---- free audit
    p = parts_of("free-audit", "section-yH_22mrChc")
    intro = [x[1] for x in p if x[0] == "h2"][0]
    out.append({
        "type": "page", "path": "/free-audit", "title": M["/free-audit"]["title"], "meta_description": M["/free-audit"]["meta_description"],
        "h1": "Get Your Free Audit",
        "blocks": [
            {"type": "form", "form": "audit", "heading": "Get Your Free Audit",
             "md": f"{intro}\n\nIf you have any questions at all please contact the team at [{EMAIL}](mailto:{EMAIL}).", "primary": True},
            {"type": "shared", "key": "testimonials"},
        ]})

    # ---- thank you (noindex)
    out.append({
        "type": "page", "path": "/thank-you", "title": "Thank You | Easy Ecommerce Marketing", "noindex": True, "h1": "Thank you",
        "blocks": [
            {"type": "hero", "heading": "Thank you", "center": True,
             "text": "We've received your details and a member of the team will be in touch shortly.",
             "buttons": [{"label": "Back to the homepage", "href": "/"}]},
            {"type": "shared", "key": "blog"},
        ]})

    # ---- ROI calculator
    p = parts_of("roi-calculator", "section-wzrT4Nan6Q")
    tp = texts(p)
    h3 = [x[1] for x in p if x[0] == "h3"]
    out.append({
        "type": "page", "path": "/roi-calculator", "title": M["/roi-calculator"]["title"] or "ROI Calculator | Easy Ecommerce Marketing",
        "meta_description": M["/roi-calculator"]["meta_description"] or tp[0],
        "h1": "Is your ad spend actually profitable?",
        "blocks": [
            {"type": "hero", "heading": "Is your ad spend actually profitable?", "center": True, "text": tp[0]},
            {"type": "roi_calculator"},
            {"type": "cards", "bg": "soft", "heading": "How it works", "intro": tp[2], "columns": 3,
             "items": [{"title": h3[i], "md": tp[3 + i]} for i in range(3)]},
            {"type": "cta", "heading": h3[3], "md": f"{tp[6]}\n\n{tp[1]}", "buttons": [{"label": "Get Your FREE Audit", "href": AUDIT}]},
            {"type": "text", "heading": h3[4], "md": tp[7] + "\n\n" + "\n".join([
                "- **Total cost** = ad spend + cost of goods + agency fees",
                "- **ROAS** = revenue ÷ ad spend",
                "- **True ROI** = (revenue − total cost) ÷ total cost × 100",
                "- **Net profit** = revenue − total cost",
                "- **Profit margin** = net profit ÷ revenue × 100",
                "- **Break-even ROAS** = total cost ÷ ad spend",
                "- **CPA** = total cost ÷ conversions"])},
        ]})

    # ---- store + products
    p = parts_of("store", "section-44bcEkCAs0")
    hs = [x[1] for x in p if x[0] == "h2"]
    prods = [
        {"slug": "cyber-vulnerability-report-template", "name": "Cyber Vulnerability Report Template", "price": 10, "img": "6761b5f8106c5cea4df00f7b-0c72db.jpeg"},
        {"slug": "gpsr-compliance-templates", "name": "GPSR Compliance Templates", "price": 5, "img": "673dbeb49dd641437f08c0c4-d8abf2.webp"},
    ]
    out.append({
        "type": "page", "path": "/store", "title": M["/store"]["title"], "meta_description": M["/store"]["meta_description"],
        "h1": "Marketing Tools & Assets",
        "blocks": [
            {"type": "hero", "heading": "Marketing Tools & Assets", "center": True, "text": f"{hs[0]}\n\n{texts(p)[0]}"},
            {"type": "cards", "columns": 3, "items": [
                {"title": x["name"], "md": f"**£{x['price']:.2f}**", "image": img(x["img"], x["name"]),
                 "href": f"/product-details/product/{x['slug']}", "link_label": "View details →"} for x in prods]},
            {"type": "shared", "key": "cta"},
        ]})
    for x in prods:
        path = f"/product-details/product/{x['slug']}"
        out.append({"type": "product", "path": path, "title": M[path]["title"] or f"{x['name']} | Easy Ecommerce Marketing",
                    "meta_description": M[path]["meta_description"], "h1": x["name"], "image": url(x["img"]),
                    "data": {"price": x["price"], "currency": "GBP", "back_path": "/store", "payment_link": ""}, "body_md": ""})

    # ---- locations index
    towns = sorted([(r["path"], town_of(r)) for r in M.values() if is_town(r)], key=lambda t: t[1])
    links = "".join(f'<li><a href="{p}">{t}</a></li>' for p, t in towns)
    out.append({
        "type": "page", "path": "/locations", "title": M["/locations"]["title"] or "Locations | Easy Ecommerce Marketing",
        "meta_description": M["/locations"]["meta_description"] or "The UK towns and cities we provide SEO, PPC and social media marketing in.",
        "h1": "Locations",
        "blocks": [
            {"type": "hero", "heading": "Locations We Cover", "center": True, "text": "Here are some of the locations that we cover:"},
            {"type": "html", "html": f'<section class="sec" style="padding-top:0"><div class="wrap"><ul class="towns">{links}</ul></div></section>'},
            {"type": "shared", "key": "testimonials"}, {"type": "shared", "key": "faq"}, {"type": "shared", "key": "cta"},
        ]})
    return out

CORE = {"/", "/services", "/free-audit", "/thank-you", "/roi-calculator", "/locations", "/store", "/store109858", "/product-details"}

def is_town(r):
    return r["type"] == "page" and r["path"] not in CORE and r["path"].count("/") == 1

def town_of(r):
    h1 = r["h1"].split(" | ")[0]
    m = re.match(r"SEO, PPC & Social Media Marketing (.+)$", h1)
    return m.group(1).strip() if m else r["path"].strip("/").replace("-", " ").title()

# ---------------------------------------------------------------- location pages

def location_pages():
    out = []
    for r in META.values():
        if not is_town(r): continue
        town = town_of(r)
        slug = X.__dict__  # noqa
        rawslug = r["path"].strip("/")
        secs = dict(X.sections(rawslug))
        hero = secs.get("section-GWZOfFsXz") or next(iter(secs.values()))
        hero_img = next((x[1] for x in hero if x[0] == "img"), None)
        # the "why" section id differs between towns; find it by its heading
        why = None
        for sid, parts in secs.items():
            if any(x[0] in ("h1", "h2") and x[1].lower().startswith("why you need digital marketing") for x in parts):
                why = parts
                break
        why_heading, md = "", []
        if why:
            for x in why:
                if x[0] in ("h1", "h2") and not why_heading:
                    why_heading = x[1]
                elif x[0] in ("h3", "h4"):
                    md.append(f"### {x[1]}")
                elif x[0] in ("p", "li"):
                    md.append(x[1])
        if not why:
            print("  !! no local section for", r["path"])
        out.append({
            "type": "location", "path": r["path"], "title": r["title"], "meta_description": r["meta_description"],
            "h1": f"SEO, PPC & Social Media Marketing {town}", "image": url(hero_img),
            "data": {"town": town, "why_heading": why_heading, "why_md": "\n\n".join(md)},
        })
    return out

# ---------------------------------------------------------------- posts

CAT_NAMES = {"seo": "SEO", "ppc": "PPC", "ecommerce": "Ecommerce", "social-media": "Social Media", "web-design": "Web Design",
             "email-marketing": "Email Marketing", "security": "Security"}

def fix_media_links(md):
    def sub_img(m):
        n = rename.get(m.group(1))
        return f"/media/{n}" if n else m.group(0)
    md = re.sub(r"/images/([A-Za-z0-9._-]+)", sub_img, md)
    md = re.sub(r"/files/([A-Za-z0-9._-]+)", r"/media/\1", md)
    return md

def posts():
    data = json.load(open(f"{X.EXPORT}/posts.json", encoding="utf-8"))
    out = []
    for p in data:
        og = os.path.basename(p.get("og_image_local") or "")
        out.append({
            "type": "post", "path": p["path"], "title": p["title"], "meta_description": p["meta_description"],
            "h1": p["h1"].split(" | ")[0] or p["title"], "excerpt": p["meta_description"],
            "image": url(og), "body_md": fix_media_links(p["body_md"]),
            "published_at": (p["date"] + "T12:00:00Z") if p.get("date") else None,
            "categories": [{"slug": c, "name": CAT_NAMES.get(c, c.replace("-", " ").title())} for c in p.get("categories", [])],
        })
    return out

# ---------------------------------------------------------------- site

def site():
    logo = url("670fe4cc66a7bab197c966f5-ad03f9.png")
    return {
        "slug": "eem", "name": "Easy Ecommerce Marketing", "domain": DOMAIN,
        # www 301s to the root domain. Add your workers.dev hostname here (Settings in the admin) to preview before go-live.
        "aliases": [f"www.{DOMAIN}", "127.0.0.1"],
        "theme": {
            "colors": {"primary": "#37ca37", "accent": "#ee2a52", "dark": "#222639", "cream": "#fffbf9",
                       "text": "#1f2330", "muted": "#5b6070", "footer": "#212322", "link": "#188bf6"},
            "fonts": {"heading": "'Montserrat', system-ui, sans-serif", "body": "'Poppins', system-ui, sans-serif",
                      "google": "family=Montserrat:wght@600;700;800&family=Poppins:wght@400;500;600"},
            "logo": logo, "logo_width": 104, "favicon": "/media/favicon.svg", "radius": "8px",
        },
        "settings": {
            "ga4": "G-6CPKGN9WF6",
            "nav": [
                {"label": "Home", "href": "/"}, {"label": "Services", "href": "/services"},
                {"label": "ROI Calculator", "href": "/roi-calculator"}, {"label": "Testimonials", "href": "/#testimonials"},
                {"label": "FAQs", "href": "/#faqs"}, {"label": "Blog", "href": "/blog"}, {"label": "Store", "href": "/store"},
                {"label": "Free Audit", "href": AUDIT},
            ],
            "footer": {
                "hours": "Opening Hours | Monday – Friday | 08:00 AM – 05:00 PM",
                "text": "© Copyright Easy Ecommerce Marketing {year}. All rights reserved.",
                "links": [{"label": "Services", "href": "/services"}, {"label": "Locations", "href": "/locations"},
                          {"label": "Blog", "href": "/blog"}, {"label": "Store", "href": "/store"},
                          {"label": EMAIL, "href": f"mailto:{EMAIL}"}],
                "social": [{"label": "Facebook", "href": "https://www.facebook.com/easyecommercemarketing"},
                           {"label": "Instagram", "href": "https://www.instagram.com/easyecommercemarketing"},
                           {"label": "LinkedIn", "href": "https://www.linkedin.com/company/easy-ecommerce-marketing"}],
            },
            "blog": {"path": "/blog", "title": "Our Blog", "per_page": 12, "post_prefix": "/post/",
                     "intro": "Practical guides on ecommerce SEO, PPC, social media and email marketing."},
            "location": {"template": "location_template"},
            "default_og_image": logo,
            "notify_email": EMAIL,
            "forms": {
                "audit": {
                    "submit": "Get My Free Audit",
                    "success_path": "/thank-you",
                    "fields": [
                        {"name": "first_name", "label": "First Name", "type": "text"},
                        {"name": "last_name", "label": "Last Name", "type": "text"},
                        {"name": "phone", "label": "Phone", "type": "tel", "required": True},
                        {"name": "email", "label": "Email", "type": "email", "required": True},
                        {"name": "website", "label": "Website", "type": "url", "required": True, "placeholder": "https://", "width": "full"},
                        {"name": "position", "label": "Your Position In The Business", "type": "text"},
                        {"name": "budget", "label": "Monthly Marketing Budget (If Known)", "type": "text"},
                        {"name": "notes", "label": "Any Other Relevant Information", "type": "textarea"},
                    ],
                    "consent": "I'm happy to receive occasional marketing emails from Easy Ecommerce Marketing. You can unsubscribe at any time.",
                }
            },
        },
    }

def redirects():
    return [
        {"from": "/store109858", "to": "/store"},
        {"from": "/product-details", "to": "/store"},
        {"from": "/blog/author/672209c5a89f4879cad5b9af", "to": "/blog"},
        {"from": "/home", "to": "/"},
    ]

# ---------------------------------------------------------------- run

print("Converting images to WebP…")
convert_all()
print(f"  {len(media)} media files")
META = page_meta()
shared = build_shared()
content = core_pages() + location_pages() + posts()

dump = lambda name, obj: json.dump(obj, open(f"{OUT}/{name}", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
dump("site.json", site())
dump("shared.json", shared)
dump("content.json", content)
dump("redirects.json", redirects())
dump("media.json", media)

from collections import Counter
print("content:", dict(Counter(c["type"] for c in content)), "| shared:", len(shared), "| redirects:", len(redirects()))
before = sum(os.path.getsize(f"{X.EXPORT}/images/{f}") for f in os.listdir(f"{X.EXPORT}/images"))
after = sum(os.path.getsize(f"{OUT}/media/{f}") for f in os.listdir(f"{OUT}/media"))
print(f"images: {before/1e6:.0f} MB -> {after/1e6:.0f} MB")
