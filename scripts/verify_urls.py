#!/usr/bin/env python3
"""Check every URL from the old site's crawl against a CMS host.
   python3 scripts/verify_urls.py <export>/pages.csv http://127.0.0.1:8787"""
import csv, re, sys, collections
from concurrent.futures import ThreadPoolExecutor
import requests
from bs4 import BeautifulSoup

pages_csv, base = sys.argv[1], sys.argv[2].rstrip("/")
S = requests.Session(); S.trust_env = False
rows = list(csv.DictReader(open(pages_csv, encoding="utf-8")))

def check(r):
    u = base + r["path"]
    resp = S.get(u, allow_redirects=False, timeout=60)
    out = {"path": r["path"], "status": resp.status_code, "loc": resp.headers.get("location", "")}
    if resp.status_code == 200 and "html" in resp.headers.get("content-type", ""):
        s = BeautifulSoup(resp.text, "html.parser")
        out["h1"] = len(s.find_all("h1"))
        out["title_same"] = (s.title.get_text(strip=True) if s.title else "") == r["title"]
        out["imgs"] = [i.get("src") for i in s.find_all("img") if i.get("src", "").startswith("/media/")]
        out["remote"] = len(re.findall(r"leadconnectorhq|filesafe\.space|googleapis\.com/msgsndr", resp.text))
    return out

with ThreadPoolExecutor(12) as ex:
    res = list(ex.map(check, rows))

print("status:", collections.Counter(r["status"] for r in res))
for r in res:
    if r["status"] != 200: print("  ", r["status"], r["path"], "->", r["loc"])
ok = [r for r in res if r["status"] == 200]
print("pages with H1 count != 1:", [(r["path"], r["h1"]) for r in ok if r.get("h1") != 1][:20])
print("title changed:", sum(1 for r in ok if not r.get("title_same")), [r["path"] for r in ok if not r.get("title_same")][:12])
print("pages still referencing GHL hosts:", [r["path"] for r in ok if r.get("remote")][:10])
imgs = sorted({i for r in ok for i in r.get("imgs", [])})
def head(i): return i, S.head(base + i, timeout=30).status_code
with ThreadPoolExecutor(12) as ex:
    bad = [x for x in ex.map(head, imgs) if x[1] != 200]
print(f"images checked: {len(imgs)}, broken: {len(bad)}", bad[:10])
