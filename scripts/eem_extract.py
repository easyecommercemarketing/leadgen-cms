"""Shared helpers for reading GHL page sections out of the crawl export."""
import csv, json, os, re
from bs4 import BeautifulSoup

EXPORT = os.environ.get("EEM_EXPORT", "/home/claude/eem-crawl/export")

_imgmap = None
def image_map():
    """original/proxied GHL image URL -> local filename in export/images"""
    global _imgmap
    if _imgmap is None:
        _imgmap = {}
        with open(f"{EXPORT}/images.csv", encoding="utf-8") as f:
            for r in csv.DictReader(f):
                if r["local_file"]:
                    name = os.path.basename(r["local_file"])
                    _imgmap[r["src_as_found"]] = name
                    _imgmap[r["original_url"]] = name
    return _imgmap

def soup(slug):
    return BeautifulSoup(open(f"{EXPORT}/raw/{slug}.html", encoding="utf-8").read(), "html.parser")

def clean(t):
    return re.sub(r"\s+", " ", t or "").strip()

def img_name(src):
    if not src: return None
    m = image_map()
    if src in m: return m[src]
    u = re.search(r"/u_(https?://.+)$", src)
    if u and u.group(1) in m: return m[u.group(1)]
    g = re.match(r"https?://storage\.googleapis\.com/msgsndr/(.+)$", src)
    if g:
        alt = "https://assets.cdn.filesafe.space/" + g.group(1)
        if alt in m: return m[alt]
    return None

def section_parts(sec):
    """Ordered list of meaningful parts in a GHL section."""
    parts = []
    for el in sec.find_all(["h1","h2","h3","h4","h5","h6","p","li","img","a","details"]):
        if el.name == "img":
            n = img_name(el.get("src") or el.get("data-src"))
            if n: parts.append(("img", n, el.get("alt","")))
        elif el.name == "a":
            cls = " ".join(el.get("class") or [])
            t = clean(el.get_text(" "))
            if t and ("btn" in cls or "button" in cls or el.find_parent(class_=re.compile("c-button"))):
                parts.append(("btn", t, el.get("href","")))
        elif el.name in ("p","li"):
            if el.find_parent(["p","li"]) : continue
            t = clean(el.get_text(" "))
            if t: parts.append((el.name, t))
        else:
            if el.find_parent(["h1","h2","h3","h4","h5","h6"]): continue
            t = clean(el.get_text(" "))
            if t: parts.append((el.name, t))
    return parts

def sections(slug):
    s = soup(slug)
    return [(sec.get("id"), section_parts(sec)) for sec in s.select("[id^=section-]")]
