#!/usr/bin/env python3
"""
Turn the pivotalwindowcleaning.com crawl export into CMS import data.

  python3 scripts/build_pivotal.py --export /path/to/pivotal/export [--out import-data/pivotal]

Then:  node scripts/import.mjs import-data/pivotal --api <cms url>
"""
import argparse, csv, json, os, re, shutil, sys
from collections import Counter
from PIL import Image
from bs4 import BeautifulSoup

sys.path.insert(0, os.path.dirname(__file__))
import eem_extract as X  # generic GHL section reader

ap = argparse.ArgumentParser()
ap.add_argument("--export", required=True)
ap.add_argument("--out", default=os.path.join(os.path.dirname(__file__), "..", "import-data", "pivotal"))
args = ap.parse_args()
X.EXPORT = args.export
OUT = os.path.abspath(args.out)
os.makedirs(f"{OUT}/media", exist_ok=True)

DOMAIN = "pivotalwindowcleaning.com"
EMAIL = "help@pivotalwindowcleaning.com"
QUOTE = "/request-a-quote"
ENQUIRY = "/lead-generation-enquiry-form"
SOCIAL_NAMES = {"Facebook", "Instagram", "X", "LinkedIn", "Youtube", "TikTok"}

# ---------------------------------------------------------------- media

media, rename = {}, {}

def convert_all():
    src_dir = f"{X.EXPORT}/images"
    for name in sorted(os.listdir(src_dir)):
        stem = os.path.splitext(name)[0]
        new = f"{stem}.webp"
        dst = f"{OUT}/media/{new}"
        try:
            im = Image.open(f"{src_dir}/{name}"); im.load()
        except Exception as e:
            print("  skip unreadable image", name, e); continue
        if not os.path.exists(dst):
            if im.mode not in ("RGB", "RGBA"):
                im = im.convert("RGBA" if "transparency" in im.info or im.mode in ("LA", "P") else "RGB")
            if im.width > 1600:
                im = im.resize((1600, round(im.height * 1600 / im.width)), Image.LANCZOS)
            im.save(dst, "WEBP", quality=82, method=5)
        w, h = Image.open(dst).size
        media[new] = {"w": w, "h": h, "mime": "image/webp"}
        rename[name] = new
    if os.path.isdir(f"{X.EXPORT}/files"):
        for f in os.listdir(f"{X.EXPORT}/files"):
            shutil.copy(f"{X.EXPORT}/files/{f}", f"{OUT}/media/{f}")
            media[f] = {"mime": "application/octet-stream"}

def by_id(media_id):
    """Find a converted image by its GHL media id (the start of the filename)."""
    for k, v in rename.items():
        if k.startswith(media_id):
            return v
    raise KeyError(media_id)

def img(media_id, alt=""):
    n = by_id(media_id); m = media[n]
    o = {"src": f"/media/{n}", "w": m.get("w"), "h": m.get("h")}
    if alt: o["alt"] = alt
    return o

def url(media_id):
    return f"/media/{by_id(media_id)}"

LOGO = "67aa300a37cca180d520561a"
HERO = "67a3ac9966a5e35c8c4fe9ea"           # cartoon window cleaner
SVC = [("67aa2dfe6923e87df4544b27", "Domestic"), ("67aa2e6fb3904f2368caa299", "Commercial"), ("67aa2d5beeb7372aa466656c", "Conservatories")]
BODY_IMGS = ["67aa31fc5818a533fb0cfcd9", "67aa32c27d40d938ea281e89"]
ABOUT_IMG = "67acb285feff7e4975edc47e"

# ---------------------------------------------------------------- reading GHL sections

def kind(parts):
    t = " ".join(str(p[1]) for p in parts)
    if "Get Your Free Quote Today" in t and len(parts) <= 4: return "CTA"
    if any(p[0] == "li" and p[1] == "Home" for p in parts): return "HEADER"
    if "Domestic" in t and "Commercial" in t and "Conservatories" in t and len(parts) <= 7: return "SERVICES3"
    if "Professional Window Cleaning Services In" in t: return "BODY"
    if t.startswith("Areas We Cover"): return "AREAS"
    if "What others are saying" in t: return "TESTIMONIALS"
    if "Frequently Asked Questions" in t: return "FAQ"
    if "Window Cleaning Blog" in t: return "BLOG"
    if "COMPANY" in t and "LEGAL" in t: return "FOOTER"
    return "OTHER"

def secs(slug):
    return [(sid, kind(p), p) for sid, p in X.sections(slug)]

def sec(slug, k, n=0):
    found = [p for _, kk, p in secs(slug) if kk == k]
    return found[n]

def raw_section(slug, section_id):
    return X.soup(slug).select_one(f"#{section_id}")

def texts(parts, kinds=("p",)):
    return [p[1] for p in parts if p[0] in kinds]

def tidy(t):
    """Light copy clean-up: collapse shouty punctuation, fix known typos."""
    t = re.sub(r"!{2,}", "!", t)
    t = t.replace("Northern Island", "Northern Ireland").replace("Additonal", "Additional")
    t = t.replace("Generate More Lead For", "Generate More Leads For")
    return t

def body_md(parts, skip_first_heading=True):
    """GHL body copy → markdown. Headings become ###, ✔ lines become a bullet list."""
    out, seen_heading = [], False
    for p in parts:
        k, t = p[0], tidy(str(p[1]))
        if k in ("h1", "h2") and skip_first_heading and not seen_heading:
            seen_heading = True; continue
        if k in ("h1", "h2", "h3", "h4"):
            out.append(f"### {t}")
        elif k in ("p", "li"):
            if t in SOCIAL_NAMES: continue
            items = [x.strip() for x in re.split(r"\s*✔\s*", t) if x.strip()]
            if "✔" in t:
                out.append("\n".join(f"- {x}" for x in items))
            else:
                out.append(t)
    # consecutive bullet groups become one list
    merged = []
    for block in out:
        if block.startswith("- ") and merged and merged[-1].startswith("- "):
            merged[-1] += "\n" + block
        else:
            merged.append(block)
    return "\n\n".join(merged)

# ---------------------------------------------------------------- the UK areas list (home, about, locations, leadgen)

def areas_html():
    s = X.soup("index")
    groups, current = [], None
    for sid in [el.get("id") for el in s.select("[id^=section-]")]:
        el = s.select_one(f"#{sid}")
        txt = el.get_text(" ", strip=True)
        if not (txt.startswith("The Areas We Cover") or el.find("li") and any(w in txt for w in ("Aberdeenshire", "Antrim"))):
            continue
        for node in el.find_all(["h2", "li"]):
            if node.name == "h2":
                current = {"name": tidy(node.get_text(strip=True)), "items": []}; groups.append(current)
            elif node.find_parent("li") is None:
                a = node.find("a")
                name = node.get_text(" ", strip=True)
                href = a.get("href", "") if a else ""
                href = href.replace(f"https://{DOMAIN}", "").replace(f"http://{DOMAIN}", "")
                if current is None:
                    current = {"name": "", "items": []}; groups.append(current)
                current["items"].append((name, href))
        # the Northern Ireland list sits in its own section without a heading
        if any(n == "Antrim" for n, _ in (groups[-1]["items"] if groups else [])) and groups[-1]["name"] != "Northern Ireland":
            ni = [x for x in groups[-1]["items"] if x[0] in ("Antrim", "Armagh", "Down", "Fermanagh", "Londonderry", "Tyrone")]
            groups[-1]["items"] = [x for x in groups[-1]["items"] if x not in ni]
            groups.append({"name": "Northern Ireland", "items": ni})
    html = []
    for g in groups:
        if not g["items"]: continue
        if g["name"]: html.append(f"<h3>{g['name']}</h3>")
        lis = "".join(f'<li><a href="{h}">{n}</a></li>' if h.startswith("/") else f"<li>{n}</li>" for n, h in g["items"])
        html.append(f'<ul class="towns">{lis}</ul>')
    return "\n".join(html), sum(len(g["items"]) for g in groups)

# ---------------------------------------------------------------- shared sections

def testimonials_from(parts):
    ps = [t for t in texts(parts) if t.strip()]
    items = []
    for i in range(0, len(ps) - 1, 2):
        title = ps[i].strip('"“” ')
        q = ps[i + 1]
        m = re.match(r'^(.*?["”])\s*[-–]\s*(.+)$', q)
        quote, author = (m.group(1), m.group(2)) if m else (q, "")
        items.append({"title": title, "quote": quote.strip(), "author": author.strip()})
    return items

def faq_from(parts):
    """Questions are h4 or bold p ending in '?'; answers are the paragraphs that follow."""
    items, q, a = [], None, []
    for p in parts:
        t = tidy(str(p[1]))
        if t == "Frequently Asked Questions": continue
        is_q = p[0] in ("h3", "h4") or (p[0] == "p" and t.endswith("?") and len(t) < 140)
        if is_q:
            if q: items.append({"q": q, "a": "\n\n".join(a)})
            q, a = t, []
        elif q and p[0] in ("p", "li"):
            a.append(t)
    if q: items.append({"q": q, "a": "\n\n".join(a)})
    return items

def quote_cta(area_param=False):
    href = QUOTE + ("?area={{path}}" if area_param else "")
    return {"type": "cta", "eyebrow": "Get Your Free Quote Today!", "heading": "For a professional, reliable, affordable, local service get in touch today.",
            "buttons": [{"label": "Get A Quote Today", "href": href}]}

def services3():
    return {"type": "cards", "columns": 3, "items": [{"title": t, "md": "", "image": img(i, f"{t} window cleaning")} for i, t in SVC]}

def build_shared(areas):
    home = "index"
    cust_t = testimonials_from(sec(home, "TESTIMONIALS"))
    faq = faq_from(sec(home, "FAQ"))
    shared = [
        {"key": "quote_cta", "label": "Free quote call to action", "blocks": [quote_cta()]},
        {"key": "services", "label": "Domestic / Commercial / Conservatories", "blocks": [services3()]},
        {"key": "testimonials", "label": "Customer testimonials", "blocks": [
            {"type": "testimonials", "anchor": "testimonials", "heading": "What others are saying", "style": "light", "stars": True,
             "items": cust_t, "buttons": [{"label": "Get A Quote Today", "href": QUOTE}]}]},
        {"key": "faq", "label": "Customer FAQs", "blocks": [{"type": "faq", "anchor": "faqs", "heading": "Frequently Asked Questions", "items": faq}]},
        {"key": "blog", "label": "Latest posts", "blocks": [{"type": "posts", "heading": "Window Cleaning Blog", "count": 6, "button_label": "More stories"}]},
        {"key": "areas", "label": "UK areas we cover", "blocks": [
            {"type": "text", "wide": True, "center": True, "heading": "The Areas We Cover",
             "md": f"Below is the list of regions we cover in the UK. Click on yours to find your town or city within that county.\n\n<div class=\"areas\">{areas}</div>"}]},
        {"key": "post_footer", "label": "Under every blog post", "blocks": [quote_cta()]},
        {"key": "location_template", "label": "Location page layout", "blocks": location_template()},
    ]
    return shared, len(cust_t), len(faq)

def location_template():
    return [
        {"type": "hero", "bg": "brand", "center": True, "heading": "{{hero_heading}}", "text": "{{hero_md}}",
         "image": img(HERO, "Window cleaner in {{town}}"), "buttons": [{"label": "Get A Quote Today", "href": QUOTE + "?area={{path}}"}]},
        {"type": "featured_buyer", "heading": "Your Local Window Cleaner In {{town}}", "bg": "soft"},
        {"type": "shared", "key": "services"},
        quote_cta(area_param=True),
        {"type": "location_body", "images": [img(i, "Window cleaning in {{town}}") for i in BODY_IMGS]},
        quote_cta(area_param=True),
        {"type": "text", "wide": True, "center": True, "heading": "{{areas_heading}}", "md": "{{areas_intro}}\n\n{{areas_html}}"},
        quote_cta(area_param=True),
        {"type": "shared", "key": "testimonials"},
        {"type": "shared", "key": "faq"},
        quote_cta(area_param=True),
        {"type": "shared", "key": "blog"},
    ]

# ---------------------------------------------------------------- pages

META = {}

def meta(path, field):
    return META.get(path, {}).get(field, "")

def hero_parts(parts):
    """Texts after the nav in a GHL header section."""
    nav_done, out = False, []
    for p in parts:
        if p[0] == "li": nav_done = True; continue
        if nav_done and p[0] in ("h1", "h2", "p") and p[1] != "Pivotal Window Cleaning":
            out.append(tidy(str(p[1])))
    return out

def core_pages(areas):
    pages = []

    # ---- home
    hp = hero_parts(sec("index", "HEADER"))
    body = sec("index", "OTHER") if False else next(p for _, k, p in secs("index") if any(x[0] == "h1" and "Nationwide Professional" in str(x[1]) for x in p))
    body_h = next(x[1] for x in body if x[0] == "h1")
    pages.append({
        "type": "page", "path": "/", "title": meta("/", "title"), "meta_description": meta("/", "meta_description"),
        "h1": hp[0],
        "blocks": [
            {"type": "hero", "bg": "brand", "heading": hp[0], "text": hp[1], "image": img(HERO, "Cartoon window cleaner"),
             "buttons": [{"label": "Get A Quote Today", "href": QUOTE}]},
            {"type": "shared", "key": "services"},
            {"type": "shared", "key": "quote_cta"},
            {"type": "split", "image_side": "left", "heading": tidy(body_h), "md": body_md(body), "images": [img(i, "Window cleaning team at work") for i in BODY_IMGS]},
            {"type": "shared", "key": "quote_cta"},
            {"type": "shared", "key": "areas"},
            {"type": "shared", "key": "quote_cta"},
            {"type": "shared", "key": "testimonials"},
            {"type": "shared", "key": "faq"},
            {"type": "shared", "key": "quote_cta"},
            {"type": "shared", "key": "blog"},
        ]})

    # ---- about
    about = next(p for _, k, p in secs("about") if any(x[0] == "h1" and "About" in str(x[1]) for x in p))
    sub = next((x[1] for x in about if x[0] == "h2"), "")
    pages.append({
        "type": "page", "path": "/about", "title": meta("/about", "title"), "meta_description": meta("/about", "meta_description"), "h1": "About Pivotal Window Cleaning",
        "blocks": [
            {"type": "split", "primary": True, "heading": "About Pivotal Window Cleaning", "md": body_md(about), "image": img(ABOUT_IMG, "Pivotal Window Cleaning team")},
            {"type": "shared", "key": "quote_cta"},
            {"type": "shared", "key": "areas"},
            {"type": "shared", "key": "quote_cta"},
            {"type": "shared", "key": "faq"},
        ]})

    # ---- request a quote
    q = next(p for _, k, p in secs("request-a-quote") if any(x[0] == "h1" and "Request A Quote" in str(x[1]) for x in p))
    pages.append({
        "type": "page", "path": QUOTE, "title": meta(QUOTE, "title") or "Request A Quote | Pivotal Window Cleaning", "meta_description": meta(QUOTE, "meta_description"),
        "h1": "Request A Quote",
        "blocks": [
            {"type": "form", "form": "quote", "primary": True, "heading": "Request A Quote", "md": tidy(texts(q)[0])},
            {"type": "shared", "key": "testimonials"},
            {"type": "shared", "key": "faq"},
        ]})

    # ---- contact
    pages.append({
        "type": "page", "path": "/contact-us", "title": meta("/contact-us", "title"), "meta_description": meta("/contact-us", "meta_description"), "h1": "Contact Us",
        "blocks": [
            {"type": "form", "form": "contact", "primary": True, "heading": "Contact Us",
             "md": f"For any questions or queries please use the contact form. For a free quote please use our [quote form]({QUOTE}).\n\nEmail: [{EMAIL}](mailto:{EMAIL})"},
            {"type": "shared", "key": "faq"},
        ]})

    # ---- locations
    pages.append({
        "type": "page", "path": "/locations", "title": meta("/locations", "title") or "Locations | Pivotal Window Cleaning",
        "meta_description": meta("/locations", "meta_description") or "The counties, cities and towns across the UK where Pivotal Window Cleaning teams work.",
        "h1": "Locations We Cover",
        "blocks": [
            {"type": "text", "wide": True, "center": True, "primary": True, "heading": "Locations We Cover",
             "md": f"Below is the list of regions we cover in the UK. Click on yours to find your town or city within that county.\n\n<div class=\"areas\">{areas}</div>"},
            {"type": "shared", "key": "quote_cta"},
            {"type": "shared", "key": "testimonials"},
            {"type": "shared", "key": "faq"},
        ]})

    # ---- window cleaner lead generation (sales page for buyers)
    lg = "window-cleaning-lead-generation"
    S = secs(lg)
    hp = hero_parts(S[0][2])
    other = [p for _, k, p in S if k == "OTHER"]
    def heading_block(parts):
        hs = [tidy(str(x[1])) for x in parts if x[0] in ("h1", "h2")]
        return {"type": "cta", "heading": hs[0], "md": hs[1] if len(hs) > 1 else "", "buttons": [{"label": "Get More Leads Today", "href": ENQUIRY}]}
    how = next(p for p in other if any("How it works" in str(x[1]) for x in p))
    how_md = body_md([x for x in how if x[0] != "img"]).replace("[email protected]", f"[{EMAIL}](mailto:{EMAIL})")
    how_md = how_md.replace("### How it works -", "**How it works**").replace("we can even great a new", "we can even create a new").replace("your already in profit", "you're already in profit")
    ctas = [p for p in other if any(x[0] == "btn" for x in p) and not any("How it works" in str(x[1]) for x in p)]
    buyer_t = testimonials_from(sec(lg, "TESTIMONIALS"))
    buyer_faq = faq_from(sec(lg, "FAQ"))
    pages.append({
        "type": "page", "path": "/window-cleaning-lead-generation", "title": meta("/window-cleaning-lead-generation", "title"),
        "meta_description": meta("/window-cleaning-lead-generation", "meta_description"), "h1": hp[0],
        "blocks": [
            {"type": "hero", "bg": "brand", "heading": hp[0], "text": hp[1] if len(hp) > 1 else "", "image": img(HERO, "Cartoon window cleaner"),
             "buttons": [{"label": "Get More Leads Today", "href": ENQUIRY}]},
            {"type": "shared", "key": "services"},
            heading_block(ctas[0]),
            {"type": "split", "image_side": "left", "heading": next(tidy(str(x[1])) for x in how if x[0] == "h1"), "md": how_md,
             "images": [img(i, "Window cleaning business") for i in BODY_IMGS], "buttons": [{"label": "Get More Leads Today", "href": ENQUIRY}]},
            heading_block(ctas[1]),
            {"type": "shared", "key": "areas"},
            heading_block(ctas[2]),
            {"type": "testimonials", "heading": "What others are saying", "style": "light", "stars": True, "items": buyer_t,
             "buttons": [{"label": "Get More Leads Today", "href": ENQUIRY}]},
            {"type": "faq", "heading": "Frequently Asked Questions", "items": buyer_faq},
            heading_block(ctas[3]) if len(ctas) > 3 else {"type": "shared", "key": "quote_cta"},
            {"type": "shared", "key": "blog"},
        ]})

    # ---- lead generation enquiry form (window cleaners sign up)
    pages.append({
        "type": "page", "path": ENQUIRY, "title": meta(ENQUIRY, "title") or "Get More Leads For Your Window Cleaning Business | Pivotal Window Cleaning",
        "meta_description": meta(ENQUIRY, "meta_description") or "Tell us which locations you'd like leads for and we'll be in touch.",
        "h1": "Get More Leads For Your Window Cleaning Business",
        "blocks": [
            {"type": "form", "form": "lead_enquiry", "primary": True, "heading": "Get More Leads For Your Window Cleaning Business",
             "md": f"If you are interested in getting more leads for your window cleaning business then please fill in the form.\n\nPrefer email? Contact [{EMAIL}](mailto:{EMAIL})."},
        ]})

    # ---- thank you (new: GHL showed an in-form message)
    pages.append({
        "type": "page", "path": "/thank-you", "title": "Thank You | Pivotal Window Cleaning", "noindex": True, "h1": "Thank you",
        "blocks": [
            {"type": "hero", "bg": "brand", "center": True, "heading": "Thank you",
             "text": "We've received your details and a local window cleaning team will be in touch shortly.", "buttons": [{"label": "Back to the homepage", "href": "/"}]},
            {"type": "shared", "key": "blog"},
        ]})

    # ---- legal pages: keep the text, structured as headings and paragraphs
    for path in ("/terms-and-conditions", "/privacy-policy", "/cookie-policy"):
        slug = path.strip("/")
        part = next(p for _, k, p in secs(slug) if k == "OTHER")
        h = next(tidy(str(x[1])) for x in part if x[0] == "h1")
        pages.append({"type": "page", "path": path, "title": meta(path, "title") or f"{h} | Pivotal Window Cleaning",
                      "meta_description": meta(path, "meta_description"), "h1": h, "body_md": body_md(part).replace("[email protected]", EMAIL)})
    return pages, len(buyer_t), len(buyer_faq)

# ---------------------------------------------------------------- location pages

def location_pages():
    out = []
    for path, r in META.items():
        if r["type"] != "page" or "Professional Window Cleaning Services In" not in r["h1"]:
            continue
        slug = path.strip("/")
        S = secs(slug)
        hp = hero_parts(S[0][2])
        body = next(p for _, k, p in S if k == "BODY")
        body_h = next(str(x[1]) for x in body if x[0] in ("h1", "h2") and "Services In" in str(x[1]))
        town = body_h.split("Services In", 1)[1].strip()
        if not town and hp:
            # a few live pages have the town missing from this heading: take it from the hero and repair the heading
            town = re.sub(r"^Reliable Window Cleaners\s+(In\s+)?", "", hp[0]).strip()
            body_h = f"{body_h.rstrip()} {town}"
        areas_parts = next(p for _, k, p in S if k == "AREAS")
        areas_sid = next(sid for sid, k, p in S if k == "AREAS")
        el = raw_section(slug, areas_sid)
        items = []
        for li in el.find_all("li"):
            if li.find_parent("li"): continue
            a = li.find("a")
            href = (a.get("href", "") if a else "").replace(f"https://{DOMAIN}", "").replace(f"http://{DOMAIN}", "")
            name = li.get_text(" ", strip=True)
            items.append(f'<li><a href="{href}">{name}</a></li>' if href.startswith("/") and href != path else f"<li>{name}</li>")
        hs = [tidy(str(x[1])) for x in areas_parts if x[0] in ("h1", "h2")]
        out.append({
            "type": "location", "path": path, "title": r["title"], "meta_description": r["meta_description"],
            "h1": hp[0] if hp else f"Window Cleaners {town}", "image": "",
            "data": {
                "town": town,
                "hero_heading": hp[0] if hp else f"Reliable Window Cleaners In {town}",
                "hero_md": hp[1] if len(hp) > 1 else "",
                "why_heading": tidy(body_h),
                "why_md": body_md(body),
                "areas_heading": hs[0] if hs else f"Areas We Cover In {town}",
                "areas_intro": hs[1] if len(hs) > 1 else "",
                "areas_html": f'<ul class="towns">{"".join(items)}</ul>',
            },
        })
    return out

# ---------------------------------------------------------------- posts

def posts():
    data = json.load(open(f"{X.EXPORT}/posts.json", encoding="utf-8"))
    out = []
    def fix(md):
        md = re.sub(r"/images/([A-Za-z0-9._-]+)", lambda m: f"/media/{rename[m.group(1)]}" if m.group(1) in rename else m.group(0), md)
        return re.sub(r"/files/([A-Za-z0-9._-]+)", r"/media/\1", md)
    for p in data:
        og = os.path.basename(p.get("og_image_local") or "")
        out.append({
            "type": "post", "path": p["path"], "title": p["title"], "meta_description": p["meta_description"],
            "h1": p["h1"].split(" | ")[0] or p["title"], "excerpt": p["meta_description"],
            "image": f"/media/{rename[og]}" if og in rename else "", "body_md": fix(p["body_md"]),
            "published_at": (p["date"] + "T12:00:00Z") if p.get("date") else None,
            "categories": [{"slug": c, "name": c.replace("-", " ").title()} for c in p.get("categories", [])],
        })
    return out

# ---------------------------------------------------------------- site

SELECT = lambda *o: list(o)

def site():
    return {
        "slug": "pivotal", "name": "Pivotal Window Cleaning", "domain": DOMAIN,
        "aliases": [f"www.{DOMAIN}"],
        "theme": {
            "colors": {"primary": "#1706D4", "primary_text": "#ffffff", "accent": "#0038FF", "brand": "#1706D4", "brand_text": "#ffffff",
                       "header": "#1706D4", "header_text": "#ffffff", "cta": "#1706D4", "cta_btn": "#ffffff", "cta_btn_text": "#000321",
                       "dark": "#1706D4", "cream": "#F6F6FF", "text": "#000321", "muted": "#565A7C", "border": "#e4e6f0",
                       "footer": "#0E182C", "footer_text": "#ffffff", "link": "#0038FF"},
            "fonts": {"heading": "'Montserrat', system-ui, sans-serif", "body": "'Lato', system-ui, sans-serif",
                      "google": "family=Montserrat:wght@600;700;800&family=Lato:wght@400;700"},
            "logo": url(LOGO), "logo_width": 44, "logo_text": True, "favicon": url(LOGO), "radius": "6px",
        },
        "settings": {
            "ga4": "G-E42D3MFDFB",
            "nav": [{"label": "Home", "href": "/"}, {"label": "About", "href": "/about"}, {"label": "Locations", "href": "/locations"},
                    {"label": "Blog", "href": "/blog"}, {"label": "Contact Us", "href": "/contact-us"}, {"label": "Get A Quote", "href": QUOTE}],
            "footer": {
                "text": "Copyright {year}. Pivotal Window Cleaning. All Rights Reserved.",
                "links": [{"label": "About", "href": "/about"}, {"label": "Locations", "href": "/locations"}, {"label": "Blog", "href": "/blog"},
                          {"label": "Contact Us", "href": "/contact-us"}, {"label": "Get A Quote", "href": QUOTE},
                          {"label": "Window Cleaning Business Leads", "href": "/window-cleaning-lead-generation"},
                          {"label": "Terms & Conditions", "href": "/terms-and-conditions"}, {"label": "Privacy Policy", "href": "/privacy-policy"},
                          {"label": "Cookie Policy", "href": "/cookie-policy"}, {"label": EMAIL, "href": f"mailto:{EMAIL}"}],
                "social": [{"label": "Facebook", "href": "https://www.facebook.com/pivotalwindowcleaning"},
                           {"label": "Instagram", "href": "https://www.instagram.com/pivotalwindowcleaning/"}],
            },
            "blog": {"path": "/blog", "title": "Window Cleaning Blog", "per_page": 12, "post_prefix": "/post/",
                     "intro": "Tips, prices and advice on window cleaning for homes and businesses."},
            "location": {"template": "location_template"},
            "default_og_image": url(HERO),
            "notify_email": EMAIL,
            "email_from": "Pivotal Window Cleaning <leads@pivotalwindowcleaning.com>",
            # General enquiries (home, blog, contact) go to the buyer of the county the customer enters
            "routing": {"area_field": "county", "copy_admin": True},
            "forms": {
                "quote": {
                    "submit": "Send", "success_path": "/thank-you", "route": True,
                    "fields": [
                        {"name": "first_name", "label": "First Name", "type": "text"},
                        {"name": "last_name", "label": "Last Name", "type": "text", "required": True},
                        {"name": "phone", "label": "Phone", "type": "tel", "required": True},
                        {"name": "email", "label": "Email", "type": "email", "required": True},
                        {"name": "street_address", "label": "Street Address", "type": "text", "required": True, "width": "full"},
                        {"name": "city", "label": "Town / City", "type": "text"},
                        {"name": "county", "label": "County", "type": "text"},
                        {"name": "postcode", "label": "Postcode", "type": "text"},
                        {"name": "country", "label": "Country", "type": "select", "options": ["England", "Scotland", "Wales", "Northern Ireland"]},
                        {"name": "property_type", "label": "Type Of Property", "type": "select",
                         "options": ["Bungalow", "Bungalow Dormer", "Terraced", "Semi-Detached", "Detached", "Town House", "Commercial"]},
                        {"name": "windows", "label": "How Many Windows Does Your Property Have?", "type": "text"},
                        {"name": "frequency", "label": "How Often Would You Like Your Service?", "type": "select",
                         "options": ["4 Weekly", "8 Weekly", "One-Off", "Quarterly", "Other (Please Specify In Additional Info Box)"]},
                        {"name": "rear_access", "label": "How Do We Access The Rear Of The Property?", "type": "select",
                         "options": ["No Restrictions", "Side Access", "Through House", "Rear Alley or Lane", "Other (Please Specify In Additional Info Box)"]},
                        {"name": "additional_info", "label": "Additional Info", "type": "textarea", "placeholder": "Please place any extra info that we need here."},
                        {"name": "share_consent", "label": "I agree my details can be shared with a local Pivotal Window Cleaning team so they can contact me about my quote.",
                         "type": "checkbox", "required": True},
                    ],
                },
                "contact": {
                    "submit": "Send", "success_path": "/thank-you", "route": True,
                    "fields": [
                        {"name": "first_name", "label": "First Name", "type": "text"},
                        {"name": "last_name", "label": "Last Name", "type": "text", "required": True},
                        {"name": "phone", "label": "Phone", "type": "tel", "required": True},
                        {"name": "email", "label": "Email", "type": "email", "required": True},
                        {"name": "county", "label": "County", "type": "text"},
                        {"name": "postcode", "label": "Postcode", "type": "text"},
                        {"name": "message", "label": "Your Message", "type": "textarea", "required": True},
                        {"name": "share_consent", "label": "I agree my details can be shared with a local Pivotal Window Cleaning team so they can reply to my enquiry.",
                         "type": "checkbox", "required": True},
                    ],
                },
                # Window cleaners asking to buy locations. Never routed to a buyer.
                "lead_enquiry": {
                    "submit": "Submit", "success_path": "/thank-you", "route": False,
                    "fields": [
                        {"name": "first_name", "label": "First Name", "type": "text"},
                        {"name": "last_name", "label": "Last Name", "type": "text"},
                        {"name": "phone", "label": "Phone", "type": "tel", "required": True},
                        {"name": "email", "label": "Email", "type": "email", "required": True},
                        {"name": "business_name", "label": "Business Name", "type": "text", "required": True, "width": "full"},
                        {"name": "locations", "label": "Location(s) You're Interested In", "type": "textarea", "required": True},
                    ],
                    "consent": "I'm happy to receive occasional emails about Pivotal's lead generation service. You can unsubscribe at any time.",
                },
                # A ready-made form to give a buyer on their location pages (Buyers → their contact form)
                "buyer_standard": {
                    "submit": "Send My Enquiry", "success_path": "/thank-you", "route": True,
                    "fields": [
                        {"name": "name", "label": "Your Name", "type": "text", "required": True},
                        {"name": "phone", "label": "Phone", "type": "tel", "required": True},
                        {"name": "email", "label": "Email", "type": "email", "required": True},
                        {"name": "postcode", "label": "Postcode", "type": "text", "required": True},
                        {"name": "property_type", "label": "Type Of Property", "type": "select",
                         "options": ["Bungalow", "Bungalow Dormer", "Terraced", "Semi-Detached", "Detached", "Town House", "Commercial"]},
                        {"name": "message", "label": "What do you need?", "type": "textarea"},
                    ],
                },
            },
        },
    }

def redirects():
    return [
        {"from": "/home", "to": "/"},
        {"from": "/blog/author/67ade7ab6b4c99084dfbc0ab", "to": "/blog"},
    ]

# ---------------------------------------------------------------- run

print("Converting images to WebP…")
convert_all()
print(f"  {len(media)} media files")
with open(f"{X.EXPORT}/pages.csv", encoding="utf-8") as f:
    for r in csv.DictReader(f):
        META[r["path"]] = r
areas, n_areas = areas_html()
shared, n_t, n_faq = build_shared(areas)
core, n_bt, n_bfaq = core_pages(areas)
locs = location_pages()
content = core + locs + posts()

dump = lambda name, obj: json.dump(obj, open(f"{OUT}/{name}", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
dump("site.json", site()); dump("shared.json", shared); dump("content.json", content)
dump("redirects.json", redirects()); dump("media.json", media)

print("content:", dict(Counter(c["type"] for c in content)), "| shared:", len(shared))
print(f"areas list: {n_areas} | customer testimonials: {n_t}, FAQs: {n_faq} | buyer testimonials: {n_bt}, FAQs: {n_bfaq}")
before = sum(os.path.getsize(f"{X.EXPORT}/images/{f}") for f in os.listdir(f"{X.EXPORT}/images"))
after = sum(os.path.getsize(f"{OUT}/media/{f}") for f in os.listdir(f"{OUT}/media"))
print(f"images: {before/1e6:.0f} MB -> {after/1e6:.0f} MB")
