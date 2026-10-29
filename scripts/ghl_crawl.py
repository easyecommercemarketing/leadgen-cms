#!/usr/bin/env python3
"""
Crawl a GoHighLevel site and export everything needed
to rebuild it on Cloudflare Pages.

Output (in ./export by default):
  pages.csv          one row per URL: path, type, status, title, meta description,
                     canonical, H1, word count, publish date, image count
  redirects.csv      old path -> new path (pre-filled 1:1; edit only if a URL changes)
  posts.json         every blog post with metadata + markdown body (for importing into a CMS)
  content/<slug>.md  each page/post as markdown with YAML front matter
  raw/<slug>.html    the original HTML of every page, untouched
  images/            every image, downloaded from GHL's CDN at original quality
  images.csv         image manifest: original URL -> local file, plus pages that use it
  errors.csv         anything that failed, so nothing is silently lost

Usage:
  pip install requests beautifulsoup4 markdownify
  python crawl.py                       # full crawl
  python crawl.py --no-images           # pages only
  python crawl.py --out my_export --delay 0.5
"""
import argparse
import csv
import hashlib
import json
import os
import re
import sys
import time
from collections import deque
from urllib.parse import urljoin, urlparse, urlunparse, unquote, parse_qs

import warnings

import requests
from bs4 import BeautifulSoup, XMLParsedAsHTMLWarning
from markdownify import markdownify as to_md

warnings.filterwarnings("ignore", category=XMLParsedAsHTMLWarning)

SITE = "https://easyecommercemarketing.com"
HOST = urlparse(SITE).netloc
UA = "Mozilla/5.0 (compatible; EEM-migration-crawler/1.0)"

SEEDS = ["/", "/blog"]  # plus anything passed with --seed
SITEMAP_CANDIDATES = ["/sitemap.xml", "/sitemap_index.xml", "/blog/sitemap.xml"]

# GHL image hosts. images.leadconnectorhq.com is a resizing proxy that wraps the
# original filesafe.space URL after "/u_", so we unwrap it to get full quality.
IMAGE_HOSTS = ("filesafe.space", "leadconnectorhq.com", "msgsndr.com", "googleusercontent.com")

SKIP_EXT = re.compile(r"\.(pdf|zip|png|jpe?g|gif|webp|svg|ico|css|js|mp4|mp3|woff2?|ttf)$", re.I)


# ---------------------------------------------------------------- helpers

def norm_url(url):
    """Canonical form for de-duplication: https, no fragment, no trailing slash."""
    p = urlparse(url)
    path = p.path or "/"
    if len(path) > 1 and path.endswith("/"):
        path = path[:-1]
    return urlunparse(("https", p.netloc.lower(), path, "", p.query, ""))


def is_internal(url):
    host = urlparse(url).netloc.lower()
    return host in (HOST, "www." + HOST)


def slugify_path(path):
    if path in ("", "/"):
        return "index"
    s = path.strip("/").replace("/", "__")
    s = re.sub(r"[^A-Za-z0-9_\-.]", "-", s)
    return s[:150]


def page_type(path):
    if path.startswith("/post/"):
        return "post"
    if path.startswith("/blog"):
        return "blog-index"
    if path.startswith("/product-details/"):
        return "product"
    return "page"


def unwrap_image(url):
    """images.leadconnectorhq.com/image/f_webp/q_80/r_1200/u_<original> -> <original>"""
    m = re.search(r"/u_(https?://.+)$", url)
    if m:
        url = unquote(m.group(1))
    # GHL's Google Cloud bucket is mirrored on its filesafe CDN
    m = re.match(r"https?://storage\.googleapis\.com/msgsndr/(.+)$", url)
    if m:
        url = "https://assets.cdn.filesafe.space/" + m.group(1)
    return url


class Session:
    def __init__(self, delay):
        self.s = requests.Session()
        self.s.headers["User-Agent"] = UA
        self.delay = delay

    def get(self, url, **kw):
        last = None
        for attempt in range(3):
            try:
                r = self.s.get(url, timeout=30, allow_redirects=True, **kw)
                time.sleep(self.delay)
                if r.status_code in (429, 500, 502, 503, 504):
                    last = f"HTTP {r.status_code}"
                    time.sleep(2 * (attempt + 1))
                    continue
                return r
            except requests.RequestException as e:
                last = str(e)
                time.sleep(2 * (attempt + 1))
        raise RuntimeError(last or "request failed")


# ---------------------------------------------------------------- discovery

def urls_from_sitemaps(sess, errors):
    found = set()
    queue = [SITE + p for p in SITEMAP_CANDIDATES]
    # robots.txt may name the sitemap
    try:
        r = sess.get(SITE + "/robots.txt")
        if r.ok:
            for line in r.text.splitlines():
                if line.lower().startswith("sitemap:"):
                    queue.append(line.split(":", 1)[1].strip())
    except Exception as e:
        errors.append(("robots.txt", str(e)))

    seen = set()
    while queue:
        sm = queue.pop(0)
        if sm in seen:
            continue
        seen.add(sm)
        try:
            r = sess.get(sm)
        except Exception as e:
            errors.append((sm, str(e)))
            continue
        if not r.ok or "<" not in r.text[:200]:
            continue
        soup = BeautifulSoup(r.text, "html.parser")
        for loc in soup.find_all("loc"):
            u = loc.get_text(strip=True)
            if u.endswith(".xml"):
                queue.append(u)
            elif is_internal(u):
                found.add(norm_url(u))
    return found


# ---------------------------------------------------------------- extraction

def meta(soup, name=None, prop=None):
    tag = soup.find("meta", attrs={"name": name}) if name else soup.find("meta", attrs={"property": prop})
    return (tag.get("content") or "").strip() if tag else ""


def main_content(soup, ptype):
    """Pick the element holding the page's real content.
    For posts: the container with the most paragraph text that isn't nav/footer/header.
    For other pages: the body minus header/nav/footer/scripts."""
    work = BeautifulSoup(str(soup), "html.parser")
    # keep video embeds: markdown has no iframe syntax, so mark them and restore as raw HTML later
    for fr in work.find_all("iframe"):
        src = fr.get("src", "")
        if src:
            ph = work.new_tag("p")
            ph.string = f"EMBED::{src}::EMBED"
            fr.replace_with(ph)
    for t in work(["script", "style", "noscript", "iframe", "svg", "nav", "footer", "header", "form"]):
        t.decompose()

    if ptype == "post":
        # GHL renders the article body into #blogPostContent
        ghl = work.find(id="blogPostContent")
        if ghl is not None:
            return ghl
        best, best_len = None, 0
        for el in work.find_all(["article", "main", "section", "div"]):
            paras = el.find_all(["p", "li", "h2", "h3", "h4", "blockquote"], recursive=True)
            text_len = sum(len(p.get_text(" ", strip=True)) for p in paras)
            # prefer the tightest container: penalise ones that are mostly non-paragraph text
            total = len(el.get_text(" ", strip=True)) or 1
            score = text_len * (text_len / total)
            if score > best_len:
                best, best_len = el, score
        if best is not None:
            return best

    return work.body or work


def extract(url, html):
    soup = BeautifulSoup(html, "html.parser")
    path = urlparse(url).path or "/"
    ptype = page_type(path)

    title = soup.title.get_text(strip=True) if soup.title else ""
    canon = soup.find("link", rel="canonical")
    h1s = [h.get_text(" ", strip=True) for h in soup.find_all("h1")]

    jsonld = []
    for s in soup.find_all("script", type="application/ld+json"):
        try:
            jsonld.append(json.loads(s.string or ""))
        except Exception:
            pass

    # publish date: meta tags, JSON-LD, then <time>
    date = (meta(soup, prop="article:published_time") or meta(soup, name="date")
            or meta(soup, name="publish_date"))
    if not date:
        for block in jsonld:
            items = block if isinstance(block, list) else [block]
            for it in items:
                if isinstance(it, dict) and it.get("datePublished"):
                    date = it["datePublished"]
                    break
    if not date:
        t = soup.find("time")
        if t:
            date = t.get("datetime") or t.get_text(strip=True)
    if not date and ptype == "post":
        # GHL shows the date only as visible text, e.g. "October 21, 2026"
        m = re.search(r"\b(January|February|March|April|May|June|July|August|September|"
                      r"October|November|December) (\d{1,2}), (20\d\d)\b",
                      soup.get_text(" ", strip=True))
        if m:
            from datetime import datetime
            date = datetime.strptime(f"{m.group(1)} {m.group(2)} {m.group(3)}", "%B %d %Y").date().isoformat()

    content_el = main_content(soup, ptype)
    body_md = to_md(str(content_el), heading_style="ATX", strip=["span"])
    body_md = re.sub(r"EMBED::(.+?)::EMBED",
                     lambda m: f'<iframe src="{m.group(1).replace(chr(92), "")}" width="560" height="315" '
                               'loading="lazy" allowfullscreen></iframe>', body_md)
    body_md = re.sub(r"(?m)^\s*Custom HTML/CSS/JavaScript\s*$", "", body_md)  # GHL placeholder
    body_md = re.sub(r"\n{3,}", "\n\n", body_md).strip()
    words = len(re.findall(r"\w+", content_el.get_text(" ", strip=True)))

    links = set()
    for a in soup.find_all("a", href=True):
        href = urljoin(url, a["href"].strip())
        if href.startswith("http") and is_internal(href):
            links.add(norm_url(href))

    images = set()
    for img in soup.find_all(["img", "source"]):
        for attr in ("src", "data-src", "srcset", "data-srcset"):
            v = img.get(attr)
            if not v or v.strip().startswith("data:"):
                continue
            for part in v.split(","):
                src = part.strip().split(" ")[0]
                if src and not src.startswith("data:"):
                    images.add(urljoin(url, src))
    # background images in inline styles
    for el in soup.find_all(style=True):
        for m in re.finditer(r"url\(['\"]?([^'\")]+)", el["style"]):
            images.add(urljoin(url, m.group(1)))
    # CSS backgrounds in <style> blocks and in the GHL page payload (section backgrounds live here)
    page_text = html.replace("\\u002F", "/")
    for m in re.finditer(r"background(?:-image)?\s*:\s*url\(['\"]?(https?://[^'\")]+)", page_text):
        if "intl-tel-input" not in m.group(1):
            images.add(m.group(1))
    og_img = meta(soup, prop="og:image")
    if og_img:
        images.add(og_img)

    tags = []
    if ptype == "post":
        for a in soup.select("a[href*='/blog/category/']"):
            slug = a["href"].rstrip("/").split("/")[-1]
            if slug and slug not in tags:
                tags.append(slug)

    return {
        "url": url,
        "path": path,
        "type": ptype,
        "title": title,
        "meta_description": meta(soup, name="description"),
        "canonical": canon.get("href", "") if canon else "",
        "robots": meta(soup, name="robots"),
        "og_title": meta(soup, prop="og:title"),
        "og_description": meta(soup, prop="og:description"),
        "og_image": og_img,
        "h1": " | ".join(h1s),
        "date": date,
        "categories": tags,
        "word_count": words,
        "jsonld": jsonld,
        "links": sorted(links),
        "images": sorted(images),
        "body_md": body_md,
    }


def front_matter(rec):
    def q(v):
        return json.dumps(v, ensure_ascii=False)
    lines = ["---",
             f"url: {q(rec['path'])}",
             f"type: {q(rec['type'])}",
             f"title: {q(rec['title'])}",
             f"meta_description: {q(rec['meta_description'])}",
             f"h1: {q(rec['h1'])}",
             f"date: {q(rec['date'])}",
             f"og_image: {q(rec['og_image'])}",
             f"categories: {q(rec['categories'])}",
             "---", ""]
    return "\n".join(lines)


# ---------------------------------------------------------------- images

def download_images(sess, image_pages, out, errors):
    img_dir = os.path.join(out, "images")
    os.makedirs(img_dir, exist_ok=True)
    rows = []
    done = {}
    total = len(image_pages)
    for i, (src, pages) in enumerate(sorted(image_pages.items()), 1):
        original = unwrap_image(src)
        host = urlparse(original).netloc
        if host == "stcdn.leadconnectorhq.com":
            # GHL's stock UI icons (social icons, store arrows); replace with your own in the rebuild
            rows.append([src, original, "", "skipped (GHL stock icon)", ";".join(sorted(pages))])
            continue
        if not any(h in host for h in IMAGE_HOSTS) and not is_internal(original):
            rows.append([src, original, "", "skipped (external host)", ";".join(sorted(pages))])
            continue
        if original in done:
            rows.append([src, original, done[original], "dup", ";".join(sorted(pages))])
            continue
        name = os.path.basename(urlparse(original).path) or "image"
        name = re.sub(r"[^A-Za-z0-9_\-.]", "-", name)
        if "." not in name:
            name += ".bin"
        stem, ext = os.path.splitext(name)
        name = f"{stem}-{hashlib.md5(original.encode()).hexdigest()[:6]}{ext}"
        dest = os.path.join(img_dir, name)
        try:
            r = sess.get(original)
            if not r.ok:
                # fall back to the proxied URL if the original refuses
                r = sess.get(src)
            r.raise_for_status()
            with open(dest, "wb") as f:
                f.write(r.content)
            done[original] = "images/" + name
            rows.append([src, original, "images/" + name, "ok", ";".join(sorted(pages))])
        except Exception as e:
            errors.append((original, f"image: {e}"))
            rows.append([src, original, "", f"error: {e}", ";".join(sorted(pages))])
        if i % 25 == 0:
            print(f"  images {i}/{total}")
    with open(os.path.join(out, "images.csv"), "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["src_as_found", "original_url", "local_file", "status", "used_on"])
        w.writerows(rows)
    return sum(1 for r in rows if r[3] == "ok")


def rewrite_image_links(out, records):
    """Point image URLs in content/*.md and posts.json at the downloaded files.
    Originals stay in raw/*.html untouched."""
    mapping = {}
    with open(os.path.join(out, "images.csv"), encoding="utf-8") as f:
        for row in csv.DictReader(f):
            if row["local_file"]:
                mapping[row["src_as_found"]] = "/" + row["local_file"]
                mapping[row["original_url"]] = "/" + row["local_file"]
    keys = sorted(mapping, key=len, reverse=True)  # longest first so proxied URLs win

    def sub(text):
        for k in keys:
            if k in text:
                text = text.replace(k, mapping[k])
        return text

    for rec in records:
        md = os.path.join(out, "content", slugify_path(rec["path"]) + ".md")
        with open(md, encoding="utf-8") as f:
            text = f.read()
        with open(md, "w", encoding="utf-8") as f:
            f.write(sub(text))
    pj = os.path.join(out, "posts.json")
    posts = json.load(open(pj, encoding="utf-8"))
    for post in posts:
        post["body_md"] = sub(post["body_md"])
        post["og_image_local"] = mapping.get(post["og_image"], "")
    with open(pj, "w", encoding="utf-8") as f:
        json.dump(posts, f, ensure_ascii=False, indent=2)


# ---------------------------------------------------------------- main

def crawl(out, delay, max_pages, with_images):
    os.makedirs(os.path.join(out, "content"), exist_ok=True)
    os.makedirs(os.path.join(out, "raw"), exist_ok=True)
    sess = Session(delay)
    errors = []

    print("Reading sitemap...")
    sitemap_urls = urls_from_sitemaps(sess, errors)
    print(f"  {len(sitemap_urls)} URLs in sitemap")

    queue = deque(sorted(sitemap_urls | {norm_url(SITE + p) for p in SEEDS}))
    # walk blog pagination explicitly in case links are JS-driven
    guessed = set()
    for n in range(2, 60):
        u = norm_url(f"{SITE}/blog?page={n}")
        guessed.add(u)
        queue.append(u)

    seen, records = set(), []
    image_pages = {}
    statuses = {}

    while queue and len(seen) < max_pages:
        url = queue.popleft()
        if url in seen or SKIP_EXT.search(urlparse(url).path):
            continue
        seen.add(url)
        try:
            r = sess.get(url)
        except Exception as e:
            errors.append((url, str(e)))
            continue
        final = norm_url(r.url)
        statuses[url] = (r.status_code, final if final != url else "")
        if r.status_code != 200 or "text/html" not in r.headers.get("content-type", ""):
            if r.status_code != 200 and url not in guessed:
                errors.append((url, f"HTTP {r.status_code}"))
            continue

        rec = extract(final, r.text)
        query = urlparse(final).query
        is_pagination = "page=" in query
        if is_pagination and any(x["url"] == final for x in records):
            continue

        for link in rec["links"]:
            if link not in seen and not SKIP_EXT.search(urlparse(link).path):
                q = urlparse(link).query
                # follow only blog pagination queries; ignore tracking/filter params
                if q and not re.fullmatch(r"page=\d+", q):
                    continue
                queue.append(link)
        for img in rec["images"]:
            image_pages.setdefault(img, set()).add(rec["path"])

        if is_pagination:
            continue  # pagination pages are only used for discovery

        slug = slugify_path(rec["path"])
        with open(os.path.join(out, "raw", slug + ".html"), "w", encoding="utf-8") as f:
            f.write(r.text)
        with open(os.path.join(out, "content", slug + ".md"), "w", encoding="utf-8") as f:
            f.write(front_matter(rec) + rec["body_md"] + "\n")
        rec["status"] = r.status_code
        rec["redirected_from"] = url if final != url else ""
        records.append(rec)
        print(f"[{len(records):>4}] {rec['type']:<10} {rec['path']}")

    # pages.csv
    with open(os.path.join(out, "pages.csv"), "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["path", "type", "status", "title", "title_len", "meta_description",
                    "meta_len", "canonical", "robots", "h1", "date", "word_count",
                    "image_count", "in_sitemap", "redirected_from"])
        for rec in sorted(records, key=lambda x: (x["type"], x["path"])):
            w.writerow([rec["path"], rec["type"], rec["status"], rec["title"], len(rec["title"]),
                        rec["meta_description"], len(rec["meta_description"]), rec["canonical"],
                        rec["robots"], rec["h1"], rec["date"], rec["word_count"],
                        len(rec["images"]), norm_url(rec["url"]) in sitemap_urls,
                        rec["redirected_from"]])

    # redirects.csv: 1:1 by default. Cloudflare Pages _redirects can be generated from this.
    with open(os.path.join(out, "redirects.csv"), "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["old_path", "new_path", "status"])
        for rec in sorted(records, key=lambda x: x["path"]):
            w.writerow([rec["path"], rec["path"], 301])

    # posts.json for CMS import
    posts = [{k: rec[k] for k in ("path", "title", "meta_description", "h1", "date",
                                   "categories", "og_image", "word_count", "body_md", "jsonld")}
             for rec in records if rec["type"] == "post"]
    posts.sort(key=lambda p: p["date"] or "", reverse=True)
    with open(os.path.join(out, "posts.json"), "w", encoding="utf-8") as f:
        json.dump(posts, f, ensure_ascii=False, indent=2)

    n_imgs = 0
    if with_images:
        print(f"Downloading {len(image_pages)} image references...")
        n_imgs = download_images(sess, image_pages, out, errors)
        rewrite_image_links(out, records)

    # sitemap URLs never reached = possible orphan pages or crawl gaps
    reached = {norm_url(r["url"]) for r in records}
    for u in sorted(sitemap_urls - reached):
        errors.append((u, "in sitemap but not exported"))

    with open(os.path.join(out, "errors.csv"), "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["url", "error"])
        w.writerows(errors)

    by_type = {}
    for rec in records:
        by_type[rec["type"]] = by_type.get(rec["type"], 0) + 1
    print("\nDone.")
    print("  pages exported:", len(records), by_type)
    print("  images downloaded:", n_imgs)
    print("  errors:", len(errors), "(see errors.csv)")
    print("  output:", os.path.abspath(out))


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--site", default=SITE, help="e.g. https://pivotalwindowcleaning.com")
    ap.add_argument("--seed", action="append", default=[], help="extra path to start from (repeatable)")
    ap.add_argument("--out", default="export")
    ap.add_argument("--delay", type=float, default=0.3, help="seconds between requests")
    ap.add_argument("--max-pages", type=int, default=2000)
    ap.add_argument("--no-images", action="store_true")
    a = ap.parse_args()
    try:
        SITE = a.site.rstrip("/")
        HOST = urlparse(SITE).netloc.lower().removeprefix("www.")
        SEEDS += a.seed
        crawl(a.out, a.delay, a.max_pages, not a.no_images)
    except KeyboardInterrupt:
        sys.exit("\nStopped.")
