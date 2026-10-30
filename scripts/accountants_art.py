"""
Illustrations for pivotalaccountants.com, drawn as SVG and saved as WebP (used by build_accountants.py).

    from accountants_art import make_all
    media = make_all("/path/to/out/media")   # {filename: {"w","h","mime"}}
"""
import io, os
import cairosvg
from PIL import Image

INK = "#10233D"
BRAND = "#0F3D3E"
TEAL = "#1B7F6E"
AMBER = "#E7A83A"
PAPER = "#F7F3EA"
MINT = "#DCEBE5"
LINE = "#E5DFD2"
WHITE = "#FFFFFF"


def _save(svg, path, w, h, fmt="WEBP"):
    png = cairosvg.svg2png(bytestring=svg.encode(), output_width=w, output_height=h)
    im = Image.open(io.BytesIO(png)).convert("RGBA")
    if fmt == "WEBP":
        im.save(path, "WEBP", quality=88, method=6)
    else:
        im.save(path, fmt)
    return {"w": w, "h": h, "mime": "image/webp" if fmt == "WEBP" else "image/png"}


# ---------------------------------------------------------------- logo

def logo_svg():
    # a pivot: a rising bar chart inside a rounded square, the last bar in amber
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="{BRAND}"/>
  <rect x="14" y="34" width="8" height="16" rx="2" fill="{MINT}"/>
  <rect x="28" y="26" width="8" height="24" rx="2" fill="{MINT}"/>
  <rect x="42" y="14" width="8" height="36" rx="2" fill="{AMBER}"/>
</svg>"""


# ---------------------------------------------------------------- service icons (drawn in a 200x200 box)

def _icon(name):
    s = 'stroke-linecap="round" stroke-linejoin="round"'
    if name == "self-assessment":  # tax return form with a tick
        return f"""<rect x="45" y="25" width="110" height="150" rx="10" fill="{WHITE}" stroke="{INK}" stroke-width="6"/>
<rect x="62" y="48" width="56" height="8" rx="4" fill="{TEAL}"/>
<rect x="62" y="70" width="76" height="6" rx="3" fill="{LINE}"/><rect x="62" y="86" width="76" height="6" rx="3" fill="{LINE}"/>
<rect x="62" y="102" width="50" height="6" rx="3" fill="{LINE}"/>
<circle cx="138" cy="146" r="28" fill="{AMBER}"/><path d="M125 146 l9 9 l17 -19" stroke="{INK}" stroke-width="7" fill="none" {s}/>"""
    if name == "sole-trader":  # person with a briefcase
        return f"""<circle cx="88" cy="62" r="26" fill="{INK}"/>
<path d="M44 160 c0 -40 20 -60 44 -60 s44 20 44 60 z" fill="{TEAL}"/>
<rect x="112" y="118" width="62" height="46" rx="8" fill="{AMBER}" stroke="{INK}" stroke-width="5"/>
<path d="M132 118 v-10 h22 v10" stroke="{INK}" stroke-width="5" fill="none"/><path d="M112 138 h62" stroke="{INK}" stroke-width="4"/>"""
    if name == "limited-company":  # office building
        return f"""<rect x="52" y="40" width="96" height="132" rx="6" fill="{WHITE}" stroke="{INK}" stroke-width="6"/>
{''.join(f'<rect x="{x}" y="{y}" width="18" height="16" rx="2" fill="{TEAL}"/>' for y in (58, 86, 114) for x in (68, 91, 114))}
<rect x="88" y="140" width="24" height="32" rx="2" fill="{AMBER}"/><path d="M36 172 h128" stroke="{INK}" stroke-width="6" {s}/>"""
    if name == "bookkeeping":  # open ledger
        return f"""<path d="M100 56 C80 44 52 42 30 48 v104 c22 -6 50 -4 70 8 z" fill="{WHITE}" stroke="{INK}" stroke-width="6" {s}/>
<path d="M100 56 C120 44 148 42 170 48 v104 c-22 -6 -50 -4 -70 8 z" fill="{WHITE}" stroke="{INK}" stroke-width="6" {s}/>
{''.join(f'<path d="M44 {y} h42" stroke="{LINE}" stroke-width="5" {s}/><path d="M114 {y} h42" stroke="{TEAL}" stroke-width="5" {s}/>' for y in (74, 92, 110, 128))}
<circle cx="156" cy="150" r="20" fill="{AMBER}"/><text x="156" y="158" font-family="Arial" font-weight="700" font-size="24" text-anchor="middle" fill="{INK}">£</text>"""
    if name == "payroll":  # three people and a pound coin
        return f"""<circle cx="64" cy="78" r="18" fill="{TEAL}"/><path d="M34 140 c0 -26 13 -38 30 -38 s30 12 30 38z" fill="{TEAL}"/>
<circle cx="136" cy="78" r="18" fill="{TEAL}"/><path d="M106 140 c0 -26 13 -38 30 -38 s30 12 30 38z" fill="{TEAL}"/>
<circle cx="100" cy="66" r="22" fill="{INK}"/><path d="M62 150 c0 -32 16 -46 38 -46 s38 14 38 46z" fill="{INK}"/>
<circle cx="150" cy="150" r="24" fill="{AMBER}" stroke="{INK}" stroke-width="4"/><text x="150" y="159" font-family="Arial" font-weight="700" font-size="26" text-anchor="middle" fill="{INK}">£</text>"""
    if name == "vat":  # receipt with a percent sign
        return f"""<path d="M58 28 h84 v144 l-14 -10 l-14 10 l-14 -10 l-14 10 l-14 -10 l-14 10 z" fill="{WHITE}" stroke="{INK}" stroke-width="6" {s}/>
<circle cx="84" cy="70" r="11" fill="none" stroke="{TEAL}" stroke-width="7"/><circle cx="118" cy="110" r="11" fill="none" stroke="{TEAL}" stroke-width="7"/>
<path d="M122 62 l-42 56" stroke="{AMBER}" stroke-width="8" {s}/><path d="M74 140 h52" stroke="{LINE}" stroke-width="6" {s}/>"""
    if name == "mtd":  # laptop with an upload arrow
        return f"""<rect x="40" y="46" width="120" height="82" rx="8" fill="{WHITE}" stroke="{INK}" stroke-width="6"/>
<path d="M24 138 h152 l-10 18 h-132 z" fill="{INK}"/>
<path d="M100 110 v-44 M82 84 l18 -18 l18 18" stroke="{TEAL}" stroke-width="8" fill="none" {s}/>
<circle cx="154" cy="56" r="20" fill="{AMBER}"/><path d="M146 56 l6 6 l10 -12" stroke="{INK}" stroke-width="5" fill="none" {s}/>"""
    if name == "landlord":  # house with a key
        return f"""<path d="M36 96 L100 42 L164 96" stroke="{INK}" stroke-width="7" fill="none" {s}/>
<rect x="54" y="90" width="92" height="76" rx="4" fill="{WHITE}" stroke="{INK}" stroke-width="6"/>
<rect x="66" y="104" width="24" height="22" rx="2" fill="{TEAL}"/><rect x="110" y="104" width="24" height="22" rx="2" fill="{TEAL}"/>
<circle cx="146" cy="150" r="16" fill="{AMBER}" stroke="{INK}" stroke-width="4"/><path d="M146 166 v22 m0 -8 h8 m-8 -8 h6" stroke="{INK}" stroke-width="5" {s}/>"""
    if name == "contractor":  # document with a pen
        return f"""<rect x="50" y="30" width="96" height="136" rx="8" fill="{WHITE}" stroke="{INK}" stroke-width="6"/>
<rect x="66" y="52" width="64" height="8" rx="4" fill="{TEAL}"/>
{''.join(f'<rect x="66" y="{y}" width="64" height="6" rx="3" fill="{LINE}"/>' for y in (74, 90, 106))}
<path d="M70 140 c10 -12 16 4 26 -6 s12 2 18 -2" stroke="{INK}" stroke-width="4" fill="none" {s}/>
<path d="M164 70 l14 14 l-52 52 l-18 4 l4 -18 z" fill="{AMBER}" stroke="{INK}" stroke-width="5" {s}/>"""
    if name == "small-business":  # shop front
        return f"""<rect x="44" y="76" width="112" height="92" rx="4" fill="{WHITE}" stroke="{INK}" stroke-width="6"/>
<path d="M38 76 l12 -36 h100 l12 36 z" fill="{TEAL}" stroke="{INK}" stroke-width="6" {s}/>
<path d="M66 40 l-6 36 M100 40 v36 M134 40 l6 36" stroke="{INK}" stroke-width="4"/>
<rect x="60" y="96" width="36" height="30" rx="2" fill="{MINT}"/><rect x="112" y="112" width="28" height="56" rx="2" fill="{AMBER}"/>"""
    raise KeyError(name)


def banner_svg(icon, w=800, h=450):
    # icon on a paper card with ledger lines and a soft mint disc
    lines = "".join(f'<path d="M0 {y} H{w}" stroke="{LINE}" stroke-width="2"/>' for y in range(38, h, 38))
    cx, cy = w / 2, h / 2
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}">
<rect width="{w}" height="{h}" fill="{PAPER}"/>{lines}
<path d="M{w*0.12} 0 V{h}" stroke="#E9B9A8" stroke-width="2" opacity=".6"/>
<circle cx="{cx}" cy="{cy}" r="150" fill="{MINT}"/>
<g transform="translate({cx-125},{cy-125}) scale(1.25)">{_icon(icon)}</g>
</svg>"""


# ---------------------------------------------------------------- hero and scene illustrations

def hero_svg():
    # a desk scene: tax return, rising chart card, calculator and a "matched" badge
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 520">
<circle cx="330" cy="270" r="230" fill="{TEAL}" opacity=".35"/>
<circle cx="330" cy="270" r="170" fill="{TEAL}" opacity=".35"/>
<g transform="rotate(-6 250 260)">
 <rect x="130" y="90" width="240" height="320" rx="16" fill="{WHITE}"/>
 <rect x="160" y="124" width="120" height="14" rx="7" fill="{BRAND}"/>
 <rect x="160" y="152" width="70" height="10" rx="5" fill="{LINE}"/>
 {''.join(f'<rect x="160" y="{y}" width="180" height="10" rx="5" fill="{LINE}"/>' for y in (190, 214, 238, 262))}
 <rect x="160" y="300" width="80" height="34" rx="6" fill="{PAPER}" stroke="{LINE}" stroke-width="3"/>
 <rect x="252" y="300" width="88" height="34" rx="6" fill="{PAPER}" stroke="{LINE}" stroke-width="3"/>
 <path d="M164 372 c18 -16 26 6 42 -6 s20 4 32 -4" stroke="{INK}" stroke-width="4" fill="none" stroke-linecap="round"/>
</g>
<g>
 <rect x="350" y="70" width="210" height="150" rx="16" fill="{WHITE}"/>
 <text x="374" y="104" font-family="Arial" font-size="16" font-weight="700" fill="{INK}">Profit</text>
 <rect x="378" y="160" width="22" height="40" rx="4" fill="{MINT}"/><rect x="414" y="140" width="22" height="60" rx="4" fill="{MINT}"/>
 <rect x="450" y="124" width="22" height="76" rx="4" fill="{TEAL}"/><rect x="486" y="100" width="22" height="100" rx="4" fill="{AMBER}"/>
 <path d="M380 150 L425 128 L460 112 L520 84" stroke="{INK}" stroke-width="3" fill="none" stroke-linecap="round" stroke-dasharray="2 7"/>
</g>
<g transform="rotate(8 470 380)">
 <rect x="400" y="270" width="140" height="190" rx="18" fill="{INK}"/>
 <rect x="418" y="290" width="104" height="40" rx="6" fill="{MINT}"/>
 <text x="512" y="318" font-family="Arial" font-size="20" font-weight="700" text-anchor="end" fill="{INK}">£1,250</text>
 {''.join(f'<rect x="{418 + c*36}" y="{344 + r*36}" width="28" height="26" rx="5" fill="{AMBER if (c==2 and r==2) else "#2B4362"}"/>' for r in range(3) for c in range(3))}
</g>
<g>
 <rect x="70" y="380" width="252" height="64" rx="32" fill="{AMBER}"/>
 <circle cx="104" cy="412" r="20" fill="{INK}"/><path d="M95 412 l7 7 l12 -14" stroke="{AMBER}" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
 <text x="136" y="420" font-family="Arial" font-size="20" font-weight="700" fill="{INK}">Accountant found</text>
</g>
</svg>"""


def meeting_svg():
    # two people across a table with a document: "talk to a local accountant"
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 450">
<rect width="600" height="450" rx="18" fill="{PAPER}"/>
{''.join(f'<path d="M0 {y} H600" stroke="{LINE}" stroke-width="2"/>' for y in range(40, 450, 40))}
<circle cx="170" cy="150" r="44" fill="{INK}"/><path d="M90 330 c0 -80 34 -126 80 -126 s80 46 80 126z" fill="{TEAL}"/>
<circle cx="430" cy="150" r="44" fill="#7A4B2A"/><path d="M350 330 c0 -80 34 -126 80 -126 s80 46 80 126z" fill="{BRAND}"/>
<rect x="60" y="300" width="480" height="24" rx="8" fill="{INK}"/><path d="M110 324 v80 M490 324 v80" stroke="{INK}" stroke-width="12" stroke-linecap="round"/>
<rect x="250" y="250" width="100" height="56" rx="6" fill="{WHITE}" stroke="{INK}" stroke-width="4"/>
<rect x="264" y="264" width="50" height="7" rx="3" fill="{TEAL}"/><rect x="264" y="280" width="72" height="6" rx="3" fill="{LINE}"/>
<circle cx="300" cy="96" r="34" fill="{AMBER}"/><text x="300" y="108" font-family="Arial" font-size="34" font-weight="700" text-anchor="middle" fill="{INK}">£</text>
</svg>"""


def deadlines_svg():
    # a calendar with key dates circled
    cells = []
    for r in range(5):
        for c in range(7):
            x, y = 110 + c * 56, 170 + r * 44
            cells.append(f'<rect x="{x}" y="{y}" width="46" height="34" rx="6" fill="{WHITE}" stroke="{LINE}" stroke-width="2"/>')
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 450">
<rect width="600" height="450" rx="18" fill="{MINT}"/>
<rect x="90" y="80" width="420" height="330" rx="18" fill="{PAPER}"/>
<rect x="90" y="80" width="420" height="70" rx="18" fill="{BRAND}"/><rect x="90" y="120" width="420" height="30" fill="{BRAND}"/>
<text x="300" y="126" font-family="Arial" font-size="26" font-weight="700" text-anchor="middle" fill="{WHITE}">31 JANUARY</text>
<path d="M150 64 v34 M450 64 v34" stroke="{INK}" stroke-width="12" stroke-linecap="round"/>
{''.join(cells)}
<circle cx="301" cy="319" r="30" fill="none" stroke="{AMBER}" stroke-width="6"/>
<circle cx="469" cy="231" r="30" fill="none" stroke="{TEAL}" stroke-width="6"/>
</svg>"""


def og_svg():
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630">
<rect width="1200" height="630" fill="{BRAND}"/>
<circle cx="980" cy="330" r="260" fill="{TEAL}" opacity=".45"/>
<rect x="80" y="90" width="102" height="102" rx="22" fill="{TEAL}"/>
<g transform="translate(80,90) scale(1.6)">{logo_svg().split('>',1)[1].rsplit('</svg>',1)[0]}</g>
<text x="80" y="300" font-family="Georgia, serif" font-size="72" font-weight="700" fill="{WHITE}">Pivotal Accountants</text>
<text x="80" y="370" font-family="Arial" font-size="34" fill="{MINT}">Find a trusted local accountant, free.</text>
<rect x="80" y="430" width="380" height="74" rx="37" fill="{AMBER}"/>
<text x="270" y="478" font-family="Arial" font-size="30" font-weight="700" text-anchor="middle" fill="{INK}">Get free quotes</text>
<g transform="translate(860,170) scale(1.3)">{_icon('self-assessment')}</g>
</svg>"""


SERVICE_ICONS = ["self-assessment", "sole-trader", "limited-company", "bookkeeping", "payroll", "vat", "mtd", "landlord",
                 "contractor", "small-business"]


def make_all(out_dir):
    os.makedirs(out_dir, exist_ok=True)
    media = {}
    with open(f"{out_dir}/logo.svg", "w") as f:
        f.write(logo_svg())
    media["logo.svg"] = {"w": 64, "h": 64, "mime": "image/svg+xml"}
    media["favicon.png"] = _save(logo_svg(), f"{out_dir}/favicon.png", 64, 64, fmt="PNG")
    media["hero.webp"] = _save(hero_svg(), f"{out_dir}/hero.webp", 960, 780)
    media["meeting.webp"] = _save(meeting_svg(), f"{out_dir}/meeting.webp", 900, 675)
    media["deadlines.webp"] = _save(deadlines_svg(), f"{out_dir}/deadlines.webp", 900, 675)
    media["og.webp"] = _save(og_svg(), f"{out_dir}/og.webp", 1200, 630)
    for name in SERVICE_ICONS:
        media[f"svc-{name}.webp"] = _save(banner_svg(name), f"{out_dir}/svc-{name}.webp", 800, 450)
    return media


if __name__ == "__main__":
    import sys
    print(make_all(sys.argv[1] if len(sys.argv) > 1 else "art-preview"))
