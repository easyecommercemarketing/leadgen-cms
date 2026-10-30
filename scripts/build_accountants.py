#!/usr/bin/env python3
"""
Build the CMS import data for pivotalaccountants.com, a lead gen site matching people with local accountants.

  python3 scripts/build_accountants.py [--out import-data/accountants]
  node scripts/import.mjs import-data/accountants --api <cms url>

Unlike the GHL migrations this site is written from scratch: copy lives in this file, locations in
accountants_data.py and illustrations are drawn by accountants_art.py. Re-run after editing either.
"""
import argparse, json, os, re, sys, zlib
from collections import Counter

sys.path.insert(0, os.path.dirname(__file__))
from accountants_data import AREAS, REGION_ORDER, REGION_MD, NATION_NOTE, DEFAULT_NATION_NOTE
from accountants_art import make_all

ap = argparse.ArgumentParser()
ap.add_argument("--out", default=os.path.join(os.path.dirname(__file__), "..", "import-data", "accountants"))
args = ap.parse_args()
OUT = os.path.abspath(args.out)

NAME = "Pivotal Accountants"
DOMAIN = "pivotalaccountants.com"
EMAIL = "help@pivotalaccountants.com"
QUOTE = "/find-an-accountant"
LEADS = "/accountancy-leads"

MEDIA = make_all(f"{OUT}/media")


def img(name, alt=""):
    m = MEDIA[name]
    o = {"src": f"/media/{name}", "w": m["w"], "h": m["h"]}
    if alt:
        o["alt"] = alt
    return o


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower().replace("'", "")).strip("-")


def loc_path(name):
    # single path segment, so lead routing (?area=/...) accepts it
    return f"/accountants-in-{slug(name)}"


def pick(seed, items, n=1):
    """Deterministic choice per page, so copy doesn't change between builds."""
    h = zlib.crc32(seed.encode())
    items = list(items)
    out = []
    for i in range(n):
        out.append(items.pop((h >> (i * 3)) % len(items)))
    return out if n > 1 else out[0]


def join_names(xs):
    xs = list(xs)
    return xs[0] if len(xs) == 1 else ", ".join(xs[:-1]) + " and " + xs[-1]


# ================================================================ services

SERVICES = [
    {
        "key": "self-assessment", "path": "/self-assessment-tax-return", "name": "Self Assessment",
        "card": "Get your tax return done right and on time, with every allowance and expense claimed.",
        "title": "Self Assessment Accountants – Tax Return Help | Pivotal Accountants",
        "meta": "Find a local accountant to complete your Self Assessment tax return. Avoid penalties, claim the right expenses and get free quotes with no obligation.",
        "h1": "Self Assessment Tax Return Accountants",
        "hero": "Hand your tax return to a local accountant who'll make sure it's accurate, on time and claims everything you're entitled to. Tell us what you need and we'll put you in touch.",
        "sections": [
            ("Who needs to file a Self Assessment tax return?",
             "You'll usually need to file a return if, in the last tax year (6 April to 5 April), you:\n\n"
             "- were self-employed and earned more than £1,000 before expenses\n"
             "- were a partner in a business partnership\n"
             "- had income from renting out property\n"
             "- had untaxed income, such as tips, commission, foreign income or significant savings and investment income\n"
             "- need to pay the High Income Child Benefit Charge\n"
             "- sold assets and made a gain above the Capital Gains Tax allowance\n\n"
             "If you're not sure, an accountant can check your situation in a few minutes and tell you whether you need to register."),
            ("Key Self Assessment deadlines",
             "- **5 October:** register for Self Assessment if you need to file for the first time\n"
             "- **31 October:** paper tax returns are due\n"
             "- **31 January:** online tax returns are due, along with any tax you owe and your first payment on account\n"
             "- **31 July:** your second payment on account is due\n\n"
             "Miss the 31 January deadline and HMRC charges an automatic £100 penalty, even if you don't owe any tax. More penalties and interest follow the longer it's late."),
            ("What an accountant does for you",
             "A good accountant does far more than type numbers into HMRC's website. They'll make sure you claim the expenses and allowances you're entitled to, check whether you can reduce your payments on account, spot anything HMRC is likely to question and file everything on time. Many will also remind you what's coming up, so January is never a last-minute scramble.\n\n"
             "If you're behind on returns or have had a letter from HMRC, an accountant can sort out late returns and deal with HMRC for you."),
        ],
        "faq": [
            ("How much does an accountant charge for a Self Assessment tax return?",
             "As a rough guide, a straightforward return costs from around £150 to £400. It costs more if you have several income sources, rental properties, capital gains or a lot of bookkeeping to tidy up first. Ask for a fixed fee before you commit."),
            ("Can an accountant help if my tax return is late?",
             "Yes. Accountants deal with late and missing returns all the time. They'll get your returns filed, work out what you owe and, where there's a reasonable excuse, can help you appeal penalties."),
            ("What do I need to give my accountant?",
             "Usually your UTR (Unique Taxpayer Reference), your National Insurance number, records of your income and expenses, P60s or P45s from any jobs, and details of any rental income, pensions, savings interest or dividends."),
        ],
    },
    {
        "key": "sole-trader", "path": "/sole-trader-accountants", "name": "Sole Trader",
        "card": "Accounts, tax returns and expenses for the self-employed, plus help with Making Tax Digital.",
        "title": "Sole Trader Accountants – Compare Local Quotes | Pivotal Accountants",
        "meta": "Find an accountant for sole traders and the self-employed. Annual accounts, tax returns, expenses and Making Tax Digital. Free, no-obligation quotes.",
        "h1": "Accountants for Sole Traders and the Self-Employed",
        "hero": "Spend your time on your business, not your books. We'll match you with a local accountant who works with sole traders every day and keeps your tax bill as low as the rules allow.",
        "sections": [
            ("How an accountant helps sole traders",
             "- **Year-end accounts and your tax return:** your profit worked out properly and your Self Assessment filed on time\n"
             "- **Allowable expenses:** making sure you claim everything you're entitled to, from tools and mileage to use of home\n"
             "- **Payments on account:** checking they're right, and reducing them if your profits are falling\n"
             "- **Making Tax Digital:** setting up software and sending your quarterly updates if MTD applies to you\n"
             "- **Planning ahead:** telling you what to put aside for tax, and when it might be worth becoming a limited company"),
            ("Making Tax Digital for sole traders",
             "Making Tax Digital for Income Tax started on 6 April 2026 for sole traders and landlords with qualifying income over £50,000. It extends to income over £30,000 from April 2027 and over £20,000 from April 2028. Qualifying income is your turnover from self-employment and property combined, before expenses.\n\n"
             "If you're caught by it, you'll need to keep digital records and send HMRC an update every quarter. An accountant can choose the right software, keep your records straight and send the updates for you."),
            ("Should I become a limited company?",
             "Once your profits reach a certain level, running your business through a limited company can save tax, but it also brings more paperwork, director's responsibilities and higher accountancy fees. The tipping point depends on your profits, how much you take out and your plans. An accountant can run the numbers for your situation rather than relying on a rule of thumb."),
        ],
        "faq": [
            ("Do sole traders need an accountant?",
             "There's no legal requirement, and plenty of sole traders do their own returns. Most find an accountant pays for themselves through expenses they'd have missed, fewer mistakes and less time spent on tax."),
            ("How much does a sole trader accountant cost?",
             "As a rough guide, annual accounts and a tax return for a sole trader cost from around £300 to £900 a year. Bookkeeping or Making Tax Digital quarterly updates add to that. Many accountants offer a fixed monthly fee."),
            ("What expenses can a sole trader claim?",
             "Costs incurred wholly and exclusively for your business, such as materials, tools, business travel and vehicle costs, phone and internet, insurance, advertising, professional fees and a share of household bills if you work from home. Your accountant will tell you what applies to your trade."),
        ],
    },
    {
        "key": "limited-company", "path": "/limited-company-accountants", "name": "Limited Company",
        "card": "Year-end accounts, corporation tax, director pay planning and Companies House filings.",
        "title": "Limited Company Accountants – Free Quotes | Pivotal Accountants",
        "meta": "Find a local accountant for your limited company: annual accounts, corporation tax, payroll, VAT and director tax planning. Compare free quotes.",
        "h1": "Accountants for Limited Companies",
        "hero": "Running a limited company comes with deadlines from both Companies House and HMRC. We'll match you with a local accountant who handles the lot and helps you take money out of the company tax-efficiently.",
        "sections": [
            ("What a limited company accountant looks after",
             "- **Annual statutory accounts**, filed at Companies House within nine months of your year end\n"
             "- **Corporation tax return (CT600)**, due within twelve months of your year end, with the tax usually payable nine months and one day after it\n"
             "- **Confirmation statement**, filed at Companies House at least once a year\n"
             "- **Directors' Self Assessment returns**, covering salary and dividends\n"
             "- **Payroll, VAT and bookkeeping** if you need them\n"
             "- **Tax planning**, such as the right mix of salary, dividends and pension contributions"),
            ("Corporation tax at a glance",
             "Companies with profits up to £50,000 pay corporation tax at 19%. Profits over £250,000 are taxed at 25%, and companies in between pay a rate that rises gradually through marginal relief. Those limits are shared between associated companies and cut for short accounting periods, which is one of many reasons it's worth having an accountant check your figures."),
            ("Switching accountant",
             "Changing accountant is easier than most directors expect. Your new accountant contacts the old one for a handover (known as professional clearance), takes over as your agent with HMRC and picks up from your last filings. It can be done at any point in the year."),
        ],
        "faq": [
            ("How much does a limited company accountant cost?",
             "As a rough guide, a small owner-managed company pays from around £1,000 to £2,500 a year for annual accounts, the corporation tax return and the director's tax return. Payroll, VAT returns and bookkeeping are usually extra or included in a monthly package."),
            ("Can I do my company's accounts myself?",
             "You can, but company accounts must follow accounting standards and are on public record at Companies House, and directors are responsible for getting them right. Most directors find an accountant saves them time and tax."),
            ("Should I pay myself a salary or dividends?",
             "Most owner-directors take a small salary and the rest as dividends, but the best split depends on your other income, the company's profits and your pension plans. An accountant will work it out each year."),
        ],
    },
    {
        "key": "bookkeeping", "path": "/bookkeeping-services", "name": "Bookkeeping",
        "card": "Day-to-day records kept tidy in Xero, QuickBooks, FreeAgent or Sage.",
        "title": "Bookkeeping Services – Find a Local Bookkeeper | Pivotal Accountants",
        "meta": "Find local bookkeeping help for your business. Bank reconciliations, invoices, receipts and cloud software set-up. Compare free quotes with no obligation.",
        "h1": "Bookkeeping Services for Small Businesses",
        "hero": "Up-to-date books mean fewer surprises, cheaper year-end accounts and a clear view of how your business is doing. We'll connect you with a local bookkeeper or accountant who'll keep on top of them for you.",
        "sections": [
            ("What a bookkeeper does",
             "- Reconciles your bank accounts and card transactions\n"
             "- Records sales invoices and supplier bills, and chases what you're owed\n"
             "- Matches receipts to expenses so nothing is missed\n"
             "- Prepares the figures for VAT returns, payroll and Making Tax Digital updates\n"
             "- Gives you regular reports on profit and cash flow"),
            ("Cloud bookkeeping software",
             "Most bookkeepers work in cloud software such as Xero, QuickBooks, FreeAgent or Sage. Your bank feeds straight in, you snap receipts on your phone and your bookkeeper and accountant can see the same figures as you. If you're still using spreadsheets or a shoebox of receipts, they can move you over."),
            ("Bookkeeper or accountant?",
             "A bookkeeper keeps your day-to-day records. An accountant prepares your year-end accounts and tax returns and advises you on tax. Many accountancy practices do both, which saves passing information back and forth."),
        ],
        "faq": [
            ("How much does a bookkeeper cost?",
             "It depends on how many transactions you have. A small business might pay from around £50 to £300 a month. Many bookkeepers quote a fixed monthly fee once they've seen your records."),
            ("Do I need bookkeeping software for Making Tax Digital?",
             "Yes. VAT-registered businesses, and sole traders and landlords within Making Tax Digital for Income Tax, must keep digital records and file from compatible software. A bookkeeper can set it up for you."),
            ("Can a bookkeeper catch up on months of missing records?",
             "Yes. Catch-up bookkeeping is common. Expect a one-off charge to bring everything up to date before a regular monthly fee."),
        ],
    },
    {
        "key": "payroll", "path": "/payroll-services", "name": "Payroll",
        "card": "Payslips, RTI submissions, pensions auto-enrolment and year-end forms.",
        "title": "Payroll Services for Small Businesses | Pivotal Accountants",
        "meta": "Find a local payroll provider or accountant. Payslips, RTI submissions to HMRC, auto-enrolment pensions and year-end forms. Free, no-obligation quotes.",
        "h1": "Payroll Services for Small Businesses",
        "hero": "Get your staff paid correctly and keep HMRC happy, without learning payroll yourself. We'll match you with a local accountant who runs payroll for businesses like yours.",
        "sections": [
            ("What's included in payroll",
             "- Registering you as an employer with HMRC\n"
             "- Working out tax, National Insurance, student loans and pension deductions\n"
             "- Payslips for your staff\n"
             "- Real Time Information (RTI) submissions to HMRC on or before each payday\n"
             "- Workplace pension auto-enrolment, including letters and contributions\n"
             "- Statutory sick, maternity and paternity pay\n"
             "- P60s at the end of the tax year, and P11D forms for benefits in kind"),
            ("Director-only payroll",
             "Even if you're the only person on the payroll, as a company director taking a salary, you still need to run payroll and file RTI submissions. It's often bundled into a limited company accountancy package at little or no extra cost."),
        ],
        "faq": [
            ("How much does outsourced payroll cost?",
             "As a rough guide, from about £5 to £15 per employee per month, often with a minimum monthly fee. Auto-enrolment and year-end work may be charged separately."),
            ("What happens if payroll is filed late?",
             "HMRC can charge penalties for late RTI submissions and late payment of PAYE. A payroll provider makes sure everything is filed on time every pay period."),
        ],
    },
    {
        "key": "vat", "path": "/vat-accountants", "name": "VAT",
        "card": "VAT registration, the right VAT scheme and quarterly returns filed through Making Tax Digital.",
        "title": "VAT Accountants – VAT Returns and Registration | Pivotal Accountants",
        "meta": "Find a local accountant to handle your VAT: registration, choosing the right scheme and filing VAT returns through Making Tax Digital. Free quotes.",
        "h1": "VAT Accountants and VAT Return Services",
        "hero": "Getting VAT wrong is expensive. We'll match you with a local accountant who'll register you at the right time, pick the best scheme for your business and file your returns.",
        "sections": [
            ("When do you need to register for VAT?",
             "You must register for VAT if your VAT-taxable turnover goes over £90,000 in any rolling 12-month period, or you expect it to in the next 30 days alone. You have 30 days from the end of the month you went over to register. Some businesses register voluntarily below the threshold to reclaim VAT on their costs."),
            ("Choosing a VAT scheme",
             "- **Standard accounting:** you pay VAT on invoices you've raised and reclaim it on purchases\n"
             "- **Cash accounting:** you only pay VAT once your customers have paid you\n"
             "- **Flat Rate Scheme:** you pay a fixed percentage of turnover, which can be simpler (but watch out for the limited cost trader rate)\n"
             "- **Annual accounting:** one VAT return a year, with interim payments\n\n"
             "The right one depends on your margins, your customers and how you get paid. An accountant can compare them for you."),
            ("VAT returns and Making Tax Digital",
             "All VAT-registered businesses have to keep digital records and file VAT returns through Making Tax Digital compatible software. Returns are usually quarterly and due one month and seven days after the end of each period, which is also when the VAT must be paid."),
        ],
        "faq": [
            ("How much does an accountant charge for VAT returns?",
             "As a rough guide, from around £75 to £250 per quarterly return, depending on how many transactions you have and whether your bookkeeping is already done."),
            ("What happens if I register for VAT late?",
             "HMRC will backdate your registration to when you should have registered, and you'll owe the VAT you should have charged from then, plus possible penalties. An accountant can help put it right."),
        ],
    },
    {
        "key": "mtd", "path": "/making-tax-digital", "name": "Making Tax Digital",
        "card": "Software, digital records and quarterly updates sorted for sole traders and landlords.",
        "title": "Making Tax Digital for Income Tax – Get Help | Pivotal Accountants",
        "meta": "Making Tax Digital for Income Tax started in April 2026. Find a local accountant to set up your software and send your quarterly updates. Free quotes.",
        "h1": "Making Tax Digital Accountants",
        "hero": "Making Tax Digital for Income Tax has started for sole traders and landlords. We'll match you with a local accountant who can set you up with the right software and send your quarterly updates for you.",
        "sections": [
            ("Who's affected and when",
             "Making Tax Digital for Income Tax applies to sole traders and landlords based on their qualifying income, which is self-employment and property turnover combined, before expenses:\n\n"
             "- **From 6 April 2026:** qualifying income over £50,000\n"
             "- **From 6 April 2027:** qualifying income over £30,000\n"
             "- **From 6 April 2028:** qualifying income over £20,000\n\n"
             "Whether you're in is based on the income on an earlier tax return, so it's worth checking now even if you're not in the first group."),
            ("What changes under Making Tax Digital",
             "- You keep your business and property records digitally, in compatible software\n"
             "- You send HMRC a summary of your income and expenses every quarter\n"
             "- You still finalise everything once a year, by 31 January\n\n"
             "The quarterly updates aren't tax returns and you don't pay tax quarterly, but they're compulsory, and missing them builds up penalty points."),
            ("How an accountant helps",
             "An accountant can confirm whether you're in scope and from when, choose and set up software that suits you, keep your records or check yours, send the quarterly updates and file your final return. Many offer a fixed monthly fee that covers the lot."),
        ],
        "faq": [
            ("Does Making Tax Digital mean I pay tax every quarter?",
             "No. You send quarterly updates, but your tax is still worked out for the whole year and paid on the usual dates: 31 January and 31 July."),
            ("Can I keep using spreadsheets?",
             "Only with bridging software that links your spreadsheet to HMRC. Most people find dedicated software simpler. An accountant can recommend one."),
            ("I'm under the threshold. Do I need to do anything?",
             "Not yet, but the threshold falls each year until 2028, so keep an eye on your turnover. You can also join voluntarily."),
        ],
    },
    {
        "key": "landlord", "path": "/landlord-accountants", "name": "Landlord",
        "card": "Rental income, mortgage interest, Capital Gains Tax and property company advice.",
        "title": "Landlord Accountants – Property Tax Help | Pivotal Accountants",
        "meta": "Find a local accountant for landlords. Rental income tax returns, mortgage interest relief, Capital Gains Tax, Making Tax Digital and property companies.",
        "h1": "Accountants for Landlords and Property Investors",
        "hero": "Whether you rent out one flat or a growing portfolio, property tax rules keep changing. We'll match you with a local accountant who works with landlords.",
        "sections": [
            ("How an accountant helps landlords",
             "- Reporting your rental income and expenses on your Self Assessment return\n"
             "- Making sure you claim the costs you can, from letting agent fees to repairs\n"
             "- Working out finance cost relief on your mortgage interest\n"
             "- Making Tax Digital quarterly updates if your rental and self-employment income is over the threshold\n"
             "- Capital Gains Tax when you sell, including the 60-day reporting deadline\n"
             "- Advice on owning property personally, jointly or through a limited company"),
            ("Mortgage interest and finance costs",
             "If you own residential property in your own name, you can't deduct mortgage interest from your rental profit. Instead you get a tax credit at the basic rate of 20%. For higher-rate taxpayers that can mean a much bigger bill than expected, and it's one of the main reasons landlords look at holding property in a company."),
            ("Selling a rental property",
             "When you sell a UK residential property that isn't your home and there's tax to pay, you must report the gain to HMRC and pay the Capital Gains Tax within 60 days of completion. An accountant can work out the gain, claim the costs you're allowed and file the return on time."),
        ],
        "faq": [
            ("Do I need to tell HMRC about rental income?",
             "Yes, if your rental income is more than £1,000 a year before expenses. You'll usually need to register for Self Assessment and file a return each year."),
            ("Should I buy property through a limited company?",
             "It can save tax for higher-rate taxpayers and growing portfolios, but there are costs, such as Stamp Duty and Capital Gains Tax if you move existing properties in, and mortgage rates are often higher. Take advice on your own numbers before deciding."),
            ("How much does a landlord accountant cost?",
             "As a rough guide, a tax return with one or two rental properties costs from around £250 to £600. Larger portfolios, property companies and Making Tax Digital updates cost more."),
        ],
    },
    {
        "key": "contractor", "path": "/contractor-accountants", "name": "Contractor",
        "card": "IR35 advice, limited company or umbrella, and accounts for contractors and freelancers.",
        "title": "Contractor Accountants – IR35 and Limited Company | Pivotal Accountants",
        "meta": "Find an accountant for contractors and freelancers. IR35 advice, limited company accounts, expenses and director pay. Compare free, no-obligation quotes.",
        "h1": "Accountants for Contractors and Freelancers",
        "hero": "Contracting brings its own tax questions, from IR35 to how you pay yourself. We'll match you with a local accountant who specialises in contractors.",
        "sections": [
            ("IR35 and the off-payroll working rules",
             "IR35 decides whether a contract should be taxed like employment. If you work through your own limited company for a medium or large client, the client decides your IR35 status and must give you a Status Determination Statement. For small clients, your own company makes the call. An accountant can review your contracts and working practices and explain what each outcome means for your take-home pay."),
            ("Limited company or umbrella?",
             "Outside IR35, running your own limited company usually leaves you with more of your income, but you're responsible for the company's accounts, filings and taxes. Inside IR35, many contractors use an umbrella company instead. A contractor accountant can compare the two for your day rate."),
            ("What contractor accountants usually include",
             "- Company accounts and corporation tax return\n"
             "- Director payroll and your personal tax return\n"
             "- VAT returns, including checking whether the Flat Rate Scheme still suits you\n"
             "- Advice on expenses, pensions and paying yourself\n"
             "- Help when you finish contracting, such as closing the company"),
        ],
        "faq": [
            ("How much does a contractor accountant cost?",
             "Most charge a fixed monthly fee, often from around £90 to £180 a month, covering company accounts, payroll, VAT and your personal tax return."),
            ("Can an accountant tell me if I'm inside IR35?",
             "They can review your contract and working practices and give an opinion, and some offer contract reviews or insurance. For medium and large clients, the client makes the formal decision."),
        ],
    },
    {
        "key": "small-business", "path": "/small-business-accountants", "name": "Small Business",
        "card": "An accountant for your whole business: accounts, tax, payroll, VAT and advice.",
        "title": "Small Business Accountants Near You | Pivotal Accountants",
        "meta": "Find a local accountant for your small business. Accounts, tax returns, payroll, VAT, bookkeeping and advice. Compare free quotes with no obligation.",
        "h1": "Accountants for Small Businesses",
        "hero": "From your first year of trading to your first employees, a good accountant is one of the best investments a small business can make. Tell us about your business and we'll find you one locally.",
        "sections": [
            ("What a small business accountant can do",
             "- Year-end accounts and tax returns for sole traders, partnerships and companies\n"
             "- Bookkeeping, payroll and VAT, so it's all in one place\n"
             "- Making Tax Digital set-up and quarterly updates\n"
             "- Cash flow forecasts and management accounts\n"
             "- Advice on business structure, funding and growth\n"
             "- Dealing with HMRC on your behalf"),
            ("Starting a new business?",
             "Getting the set-up right from day one saves money later. An accountant can help you choose between sole trader, partnership and limited company, register with HMRC and Companies House, set up bookkeeping software and tell you what to put aside for tax."),
            ("Choosing the right accountant",
             "Look for an accountant who already works with businesses of your size and type, who's a member of a professional body such as ICAEW, ACCA, ICAS, CIMA, AAT or CIOT, and who'll give you a clear fixed fee. Ask how they'd like you to keep your records and how quickly they reply."),
        ],
        "faq": [
            ("How much does a small business accountant cost?",
             "It depends on your business structure and what you need. As a rough guide, from a few hundred pounds a year for a simple sole trader to a few thousand for a limited company with payroll and VAT. Many accountants offer monthly packages."),
            ("When should I get an accountant?",
             "Ideally before you start trading or before your first year end. It's never too late, though. An accountant can also help tidy up past years."),
        ],
    },
]
SVC_BY_KEY = {s["key"]: s for s in SERVICES}

CARD_TITLE = {"self-assessment": "Self Assessment tax returns", "sole-trader": "Sole trader accountants",
              "limited-company": "Limited company accountants", "bookkeeping": "Bookkeeping", "payroll": "Payroll",
              "vat": "VAT returns", "mtd": "Making Tax Digital", "landlord": "Landlord accountants",
              "contractor": "Contractor accountants", "small-business": "Small business accountants"}
CTA_HEADING = {"self-assessment": "Get your tax return sorted by a local accountant", "sole-trader": "Find a sole trader accountant near you",
               "limited-company": "Find a limited company accountant near you", "bookkeeping": "Find a bookkeeper near you",
               "payroll": "Hand your payroll to a local expert", "vat": "Find a VAT accountant near you",
               "mtd": "Get ready for Making Tax Digital", "landlord": "Find a landlord accountant near you",
               "contractor": "Find a contractor accountant near you", "small-business": "Find a small business accountant near you"}

# ================================================================ forms

AREA_NAMES = sorted(a[0] for a in AREAS)
SERVICE_OPTIONS = ["Self Assessment tax return", "Sole trader accounts", "Limited company accounts", "Bookkeeping", "Payroll",
                   "VAT returns", "Making Tax Digital", "Landlord / property tax", "Contractor / IR35", "Business start-up advice",
                   "Something else"]
CONSENT = f"I agree that {NAME} can pass my details to a local accountancy firm so they can contact me about my enquiry."


def forms():
    return {
        "quote": {
            "submit": "Find My Accountant", "success_path": "/thank-you", "route": True,
            "fields": [
                {"name": "service", "label": "What do you need help with?", "type": "select", "required": True, "options": SERVICE_OPTIONS},
                {"name": "business_type", "label": "Which best describes you?", "type": "select", "required": True,
                 "options": ["Sole trader / self-employed", "Limited company", "Partnership or LLP", "Landlord", "Contractor / freelancer",
                             "Employed, with other income", "Starting a new business", "Charity or not-for-profit"]},
                {"name": "turnover", "label": "Annual turnover (roughly)", "type": "select",
                 "options": ["Not trading yet", "Under £30,000", "£30,000 – £50,000", "£50,000 – £90,000", "£90,000 – £250,000",
                             "£250,000 – £1 million", "Over £1 million"]},
                {"name": "current_accountant", "label": "Do you have an accountant now?", "type": "select",
                 "options": ["No, this would be my first", "Yes, I'm looking to switch", "No, I've been doing it myself"]},
                {"name": "first_name", "label": "First name", "type": "text", "required": True},
                {"name": "last_name", "label": "Last name", "type": "text"},
                {"name": "email", "label": "Email", "type": "email", "required": True},
                {"name": "phone", "label": "Phone", "type": "tel", "required": True},
                {"name": "business_name", "label": "Business name (if you have one)", "type": "text", "width": "full"},
                {"name": "town", "label": "Town or city", "type": "text", "required": True},
                {"name": "county", "label": "County / area", "type": "select", "required": True, "options": AREA_NAMES},
                {"name": "postcode", "label": "Postcode", "type": "text"},
                {"name": "timescale", "label": "When do you need help?", "type": "select",
                 "options": ["As soon as possible", "Within a month", "Before my next deadline", "Just comparing for now"]},
                {"name": "message", "label": "Anything else the accountant should know?", "type": "textarea",
                 "placeholder": "e.g. year end, number of employees, deadlines coming up"},
                {"name": "share_consent", "label": CONSENT, "type": "checkbox", "required": True},
            ],
        },
        "contact": {
            "submit": "Send Message", "success_path": "/thank-you", "route": False,
            "fields": [
                {"name": "name", "label": "Your name", "type": "text", "required": True},
                {"name": "email", "label": "Email", "type": "email", "required": True},
                {"name": "phone", "label": "Phone", "type": "tel"},
                {"name": "message", "label": "Your message", "type": "textarea", "required": True},
            ],
        },
        # Accountancy firms asking to buy leads. Never routed to a buyer.
        "firm_enquiry": {
            "submit": "Check My Area", "success_path": "/thank-you", "route": False,
            "fields": [
                {"name": "name", "label": "Your name", "type": "text", "required": True},
                {"name": "firm", "label": "Firm name", "type": "text", "required": True},
                {"name": "email", "label": "Email", "type": "email", "required": True},
                {"name": "phone", "label": "Phone", "type": "tel", "required": True},
                {"name": "website", "label": "Website", "type": "url", "width": "full"},
                {"name": "areas", "label": "Which towns or counties do you want leads for?", "type": "textarea", "required": True},
                {"name": "services", "label": "Which clients do you most want?", "type": "select",
                 "options": ["Any", "Sole traders", "Limited companies", "Landlords", "Contractors", "Larger businesses (£250k+)"]},
                {"name": "capacity", "label": "How many new clients could you take on each month?", "type": "select",
                 "options": ["1–5", "5–10", "10–20", "20+"]},
            ],
            "consent": f"I'm happy to receive occasional emails about {NAME}'s lead service. You can unsubscribe at any time.",
        },
        # Give this to a buyer as "Their contact form" to show it on their location pages
        "buyer_standard": {
            "submit": "Send My Enquiry", "success_path": "/thank-you", "route": True,
            "fields": [
                {"name": "name", "label": "Your name", "type": "text", "required": True},
                {"name": "email", "label": "Email", "type": "email", "required": True},
                {"name": "phone", "label": "Phone", "type": "tel", "required": True},
                {"name": "service", "label": "What do you need help with?", "type": "select", "options": SERVICE_OPTIONS},
                {"name": "business_type", "label": "Which best describes you?", "type": "select",
                 "options": ["Sole trader / self-employed", "Limited company", "Partnership or LLP", "Landlord", "Contractor / freelancer",
                             "Employed, with other income", "Starting a new business"]},
                {"name": "message", "label": "Tell them a bit about your situation", "type": "textarea"},
            ],
        },
    }


# ================================================================ shared sections

def quote_cta(area=False, heading="Find the right accountant for your business", md="Free, no obligation, and it takes about two minutes."):
    return {"type": "cta", "heading": heading, "md": md,
            "buttons": [{"label": "Get Free Quotes", "href": QUOTE + ("?area={{path}}" if area else "")}]}


def service_cards(keys=None, heading="How a local accountant can help", intro="", buttons=None):
    items = [SVC_BY_KEY[k] for k in keys] if keys else SERVICES
    b = {"type": "cards", "columns": 3, "heading": heading,
         "items": [{"title": CARD_TITLE[s["key"]], "md": s["card"],
                    "image": img(f"svc-{s['key']}.webp"), "href": s["path"], "link_label": "Find out more →"} for s in items]}
    if intro:
        b["intro"] = intro
    if buttons:
        b["buttons"] = buttons
    return b


HOW_IT_WORKS = {
    "type": "cards", "columns": 3, "bg": "soft", "heading": "How it works",
    "intro": "Finding an accountant shouldn't mean ringing round a dozen firms.",
    "items": [
        {"title": "1. Tell us what you need", "md": "Answer a few quick questions about you, your business and what you need help with."},
        {"title": "2. We match you locally", "md": "We pass your enquiry to an accountancy firm that covers your area and works with clients like you."},
        {"title": "3. Talk it through", "md": "The accountant gets in touch, usually within one working day, to understand your situation and give you a quote."},
    ],
    "buttons": [{"label": "Get Started", "href": QUOTE}],
}

WHY_US = {
    "type": "split", "image_side": "left", "heading": "Why use Pivotal Accountants?",
    "md": "- **Free for you.** You never pay us anything. Accountancy firms pay to be listed.\n"
          "- **Local.** We match you with a firm that covers your town, so you can meet in person if you'd like.\n"
          "- **The right fit.** We pass on what you need, so the accountant already knows your situation when they call.\n"
          "- **No obligation.** Get a quote, ask questions, and only go ahead if you're happy.\n"
          "- **Your details stay private.** We only share your enquiry with the firm we match you with.",
    "image": img("meeting.webp", "Meeting a local accountant"),
    "buttons": [{"label": "Find an Accountant", "href": QUOTE}],
}

GENERAL_FAQ = [
    ("How does Pivotal Accountants work?",
     "You tell us what you need through our short form. We pass your enquiry to a local accountancy firm that covers your area, and they contact you to talk it through and give you a quote."),
    ("Is it free?",
     "Yes, completely free for you, and there's no obligation to go ahead with the accountant we put you in touch with. The accountancy firms pay us to be listed."),
    ("Are you an accountancy firm?",
     "No. Pivotal Accountants is a free matching service. We don't give tax or accounting advice ourselves. Your accountant does that, and you agree terms directly with them."),
    ("How quickly will I hear back?",
     "Usually within one working day. If you have a deadline coming up, mention it in the form."),
    ("How much does an accountant cost?",
     "It depends on what you need. As a rough guide: a simple Self Assessment tax return from about £150 to £400, sole trader accounts and tax return from about £300 to £900 a year, and a small limited company from about £1,000 to £2,500 a year. Always ask for a fixed fee in writing."),
    ("How do I know an accountant is properly qualified?",
     "Anyone can call themselves an accountant in the UK, so ask which professional body they belong to, such as ICAEW, ACCA, ICAS, CIMA, AAT or CIOT. Members have to follow professional rules, hold insurance and be supervised for anti-money laundering."),
    ("Can I change accountant part way through the year?",
     "Yes. Your new accountant will ask your old one for a handover, take over as your agent with HMRC and carry on from your last filings."),
]


def faq_block(items, heading="Frequently asked questions"):
    return {"type": "faq", "anchor": "faqs", "heading": heading, "items": [{"q": q, "a": a} for q, a in items]}


def regions():
    out = {r: [] for r in REGION_ORDER}
    for a in AREAS:
        out[a[1]].append(a)
    return out


def counties_html():
    html = []
    for r, areas in regions().items():
        html.append(f"<h3>{r}</h3>")
        html.append('<ul class="towns">' + "".join(f'<li><a href="{loc_path(a[0])}">{a[0]}</a></li>' for a in areas) + "</ul>")
    return "\n".join(html)


def towns_html():
    html = []
    for r, areas in regions().items():
        towns = sorted(t for a in areas for t in a[2])
        if not towns:
            continue
        html.append(f"<h3>{r}</h3>")
        html.append('<ul class="towns">' + "".join(f'<li><a href="{loc_path(t)}">{t}</a></li>' for t in towns) + "</ul>")
    return "\n".join(html)


def location_template():
    return [
        {"type": "hero", "bg": "brand", "eyebrow": "Free, no-obligation quotes", "heading": "{{hero_heading}}", "text": "{{hero_md}}",
         "image": img("hero.webp", "Finding an accountant in {{town}}"),
         "buttons": [{"label": "Get Free Quotes", "href": QUOTE + "?area={{path}}"}]},
        {"type": "featured_buyer", "eyebrow": "Recommended locally", "heading": "Your Local Accountant in {{town}}", "bg": "soft"},
        {"type": "location_body", "images": [img("meeting.webp", "Talking to an accountant in {{town}}"), img("deadlines.webp", "Tax deadlines")]},
        quote_cta(area=True, heading="Get quotes from an accountant in {{town}}"),
        service_cards(["self-assessment", "sole-trader", "limited-company", "bookkeeping", "vat", "landlord"],
                      heading="What accountants in {{town}} can help with"),
        dict(HOW_IT_WORKS, buttons=[{"label": "Get Started", "href": QUOTE + "?area={{path}}"}]),
        {"type": "text", "wide": True, "center": True, "heading": "{{areas_heading}}", "md": "{{areas_intro}}\n\n{{areas_html}}"},
        faq_block([
            ("How much does an accountant cost in {{town}}?",
             "Fees vary from firm to firm. As a rough guide, a simple Self Assessment tax return costs from about £150 to £400, sole trader accounts and tax return from about £300 to £900 a year, and a small limited company from about £1,000 to £2,500 a year. Ask any accountant in {{town}} for a fixed fee in writing before you start."),
            ("Do I need an accountant based in {{town}}?",
             "Not necessarily, as most work can be done online. But a local accountant can meet you face to face, often knows the local business community, and is easy to drop records in to. We'll match you with a firm that covers {{town}}."),
            ("Are the tax rules any different in {{town}}?", "{{nation_note}}"),
            ("How do I check an accountant is properly qualified?",
             "Ask which professional body they belong to, such as ICAEW, ACCA, ICAS, CIMA, AAT or CIOT. Members follow professional rules, hold insurance and are supervised for anti-money laundering."),
            ("Is this service free?",
             "Yes. It's free for you, with no obligation. The accountancy firms pay to be listed."),
        ], heading="Accountants in {{town}}: your questions answered"),
        quote_cta(area=True, heading="Ready to find an accountant in {{town}}?"),
    ]


def build_shared():
    return [
        {"key": "quote_cta", "label": "Free quotes call to action", "blocks": [quote_cta()]},
        {"key": "how_it_works", "label": "How it works (3 steps)", "blocks": [HOW_IT_WORKS]},
        {"key": "why_us", "label": "Why use Pivotal Accountants", "blocks": [WHY_US]},
        {"key": "faq", "label": "General FAQs", "blocks": [faq_block(GENERAL_FAQ)]},
        {"key": "areas", "label": "Counties we cover", "blocks": [
            {"type": "text", "wide": True, "center": True, "heading": "Find an accountant near you",
             "md": f"Choose your county to find accountants in your area, or see [all towns and cities](/locations).\n\n<div class=\"areas\">{counties_html()}</div>"}]},
        {"key": "post_footer", "label": "Under every blog post", "blocks": [quote_cta()]},
        {"key": "location_template", "label": "Location page layout", "blocks": location_template()},
    ]


# ================================================================ location pages

INTROS = [
    "Looking for an accountant in {place}? Whether you're filing your first tax return, running a growing limited company or letting out property, the right accountant saves you time, stress and usually money. Tell us what you need and we'll put you in touch with an accountancy firm that covers {place}.",
    "Finding a good accountant in {place} usually means asking around, comparing websites and waiting for call-backs. We do the legwork for you: tell us about your situation and we'll match you with a local firm that works with people like you.",
    "From sole traders and landlords to limited companies and contractors, people across {place} use Pivotal Accountants to find an accountant they can trust. It's free, there's no obligation, and it only takes a couple of minutes.",
    "If you run a business or have income outside a payslip in {place}, an accountant can take tax off your plate and make sure you're not paying more than you should. We'll connect you with a local accountancy firm that covers {place}, free of charge.",
]

TIPS = [
    "**Check their qualifications.** Look for membership of a professional body such as ICAEW, ACCA, ICAS, CIMA, AAT or CIOT.",
    "**Ask for a fixed fee.** A clear quote in writing means no surprise bills at year end.",
    "**Find a specialist.** An accountant who already works with businesses like yours will spot savings others miss.",
    "**Ask about software.** Make sure they support the bookkeeping software you use, or will recommend one for Making Tax Digital.",
    "**Agree how you'll work.** Some accountants prefer email, others regular meetings. Pick one whose style suits you.",
    "**Check response times.** Ask how quickly they normally reply, especially around the January deadline.",
]

SVC_LINE = {
    "self-assessment": "[Self Assessment tax returns]({path})",
    "sole-trader": "[accounts for sole traders]({path})",
    "limited-company": "[limited company accounts and corporation tax]({path})",
    "bookkeeping": "[bookkeeping]({path})",
    "payroll": "[payroll]({path})",
    "vat": "[VAT registration and returns]({path})",
    "mtd": "[Making Tax Digital]({path})",
    "landlord": "[landlord and property tax]({path})",
    "contractor": "[IR35 and contractor accounts]({path})",
}


def why_md(place, seed, region, extra):
    keys = pick(seed + "svc", list(SVC_LINE), 6)
    svc = join_names(SVC_LINE[k].format(path=SVC_BY_KEY[k]["path"]) for k in keys)
    tips = pick(seed + "tips", TIPS, 3)
    parts = [
        pick(seed, INTROS).format(place=place),
        REGION_MD[region],
        f"Accountants in {place} can help with {svc}, as well as advice on how to structure your business and plan for tax.",
        f"### Choosing an accountant in {place}",
        "\n".join(f"- {t}" for t in tips),
    ]
    if extra:
        parts.append(extra)
    return "\n\n".join(parts)


def location_pages():
    out = []
    by_region = regions()
    for county, region, towns in AREAS:
        nation = NATION_NOTE.get(region, DEFAULT_NATION_NOTE)
        others = [a[0] for a in by_region[region] if a[0] != county]
        cpath = loc_path(county)
        # ---- county page
        town_links = "".join(f'<li><a href="{loc_path(t)}">{t}</a></li>' for t in towns)
        other_links = "".join(f'<li><a href="{loc_path(o)}">{o}</a></li>' for o in others)
        areas_html = ""
        if towns:
            areas_html += f'<ul class="towns">{town_links}</ul>'
        if others:
            areas_html += f'<h3>Other areas in {region}</h3><ul class="towns">{other_links}</ul>'
        extra = f"We cover the whole of {county}, including {join_names(towns)}." if towns else ""
        out.append({
            "type": "location", "path": cpath,
            "title": f"Accountants in {county} – Free Local Quotes | {NAME}",
            "meta_description": f"Find a local accountant in {county}. Self Assessment, sole trader and limited company accounts, bookkeeping, payroll and VAT. Free, no-obligation quotes.",
            "h1": f"Find an Accountant in {county}", "image": "",
            "data": {
                "town": county, "county": county, "region": region,
                "hero_heading": f"Find an Accountant in {county}",
                "hero_md": f"Compare quotes from local accountancy firms across {county}. Tell us what you need and we'll match you with an accountant who works with people like you.",
                "why_heading": f"Accountants in {county}",
                "why_md": why_md(county, cpath, region, extra),
                "areas_heading": f"Towns we cover in {county}" if towns else f"Other areas in {region}",
                "areas_intro": f"Choose your town for accountants near you in {county}." if towns else "",
                "areas_html": areas_html if towns else f'<ul class="towns">{other_links}</ul>',
                "nation_note": nation,
            },
        })
        # ---- town pages
        for t in towns:
            tpath = loc_path(t)
            near = [x for x in towns if x != t]
            near_links = "".join(f'<li><a href="{loc_path(x)}">{x}</a></li>' for x in near)
            extra = (f"We also match people with accountants in nearby {join_names(near)}, and across [{county}]({cpath})."
                     if near else f"We match people with accountants across [{county}]({cpath}).")
            out.append({
                "type": "location", "path": tpath,
                "title": f"Accountants in {t} – Compare Free Quotes | {NAME}",
                "meta_description": f"Find a trusted accountant in {t}, {county}. Tax returns, sole trader and limited company accounts, bookkeeping and VAT. Free, no-obligation quotes.",
                "h1": f"Find an Accountant in {t}", "image": "",
                "data": {
                    "town": t, "county": county, "region": region,
                    "hero_heading": f"Find an Accountant in {t}",
                    "hero_md": f"Get matched with a local accountancy firm covering {t} and the rest of {county}. Free, no obligation, and it takes about two minutes.",
                    "why_heading": f"Local accountants in {t}",
                    "why_md": why_md(t, tpath, region, extra),
                    "areas_heading": f"Accountants near {t}",
                    "areas_intro": f"We also cover these towns in [{county}]({cpath}):" if near else f"See all of [{county}]({cpath}) or nearby areas:",
                    "areas_html": f'<ul class="towns">{near_links}</ul>' if near else
                                  f'<ul class="towns">{"".join(f"<li><a href={chr(34)}{loc_path(o)}{chr(34)}>{o}</a></li>" for o in others)}</ul>',
                    "nation_note": nation,
                },
            })
    return out


# ================================================================ pages

def service_page(s):
    sections = []
    for i, (h, body) in enumerate(s["sections"]):
        if i == 0:
            sections.append({"type": "split", "heading": h, "md": body, "image": img("meeting.webp" if s["key"] != "mtd" else "deadlines.webp", h)})
        else:
            sections.append({"type": "text", "heading": h, "md": body, **({"bg": "soft"} if i % 2 else {})})
    order = ["self-assessment", "sole-trader", "limited-company", "bookkeeping", "vat", "mtd", "landlord", "payroll", "contractor", "small-business"]
    others = [k for k in order if k != s["key"]][:6]
    return {
        "type": "page", "path": s["path"], "title": s["title"], "meta_description": s["meta"], "h1": s["h1"],
        "blocks": [
            {"type": "hero", "bg": "brand", "eyebrow": "Free, no-obligation quotes", "heading": s["h1"], "text": s["hero"],
             "image": img(f"svc-{s['key']}.webp", s["h1"]), "buttons": [{"label": "Get Free Quotes", "href": QUOTE}]},
            *sections[:1],
            quote_cta(heading=CTA_HEADING[s["key"]]),
            *sections[1:],
            faq_block(s["faq"], heading=f"{s['name']} questions"),
            {"type": "form", "form": "quote", "heading": "Tell us what you need",
             "md": "Answer a few quick questions and we'll pass your enquiry to a local accountancy firm that covers your area. It's free and there's no obligation.\n\n"
                   "- Usually a reply within one working day\n- One local firm, not a flood of calls\n- You decide whether to go ahead"},
            service_cards(others, heading="Other ways an accountant can help"),
        ],
    }


def core_pages():
    pages = []
    # ---- home
    pages.append({
        "type": "page", "path": "/", "title": f"Find a Local Accountant – Free Quotes | {NAME}",
        "meta_description": "Find a trusted local accountant for your tax return, sole trader or limited company accounts, bookkeeping, payroll or VAT. Free, no-obligation quotes across the UK.",
        "h1": "Find a Local Accountant Who Gets Your Business",
        "blocks": [
            {"type": "hero", "bg": "brand", "eyebrow": "Free, no-obligation quotes", "heading": "Find a Local Accountant Who Gets Your Business",
             "text": "Tax returns, company accounts, bookkeeping, VAT or Making Tax Digital: tell us what you need and we'll match you with a local accountancy firm. It's free and takes about two minutes.",
             "image": img("hero.webp", "Tax return, profit chart and calculator"),
             "buttons": [{"label": "Find an Accountant", "href": QUOTE}, {"label": "How it works", "href": "/how-it-works"}]},
            {"type": "shared", "key": "how_it_works"},
            service_cards(["self-assessment", "sole-trader", "limited-company", "bookkeeping", "vat", "landlord"],
                          buttons=[{"label": "See all services", "href": "/services"}]),
            {"type": "shared", "key": "why_us"},
            {"type": "split", "bg": "soft", "heading": "Making Tax Digital for Income Tax is here",
             "md": "Since 6 April 2026, sole traders and landlords with qualifying income over £50,000 have had to keep digital records and send HMRC quarterly updates. The threshold drops to £30,000 in April 2027 and £20,000 in April 2028.\n\n"
                   "An accountant can tell you when it applies to you, set up the software and send the updates for you.",
             "image": img("deadlines.webp", "Tax deadlines calendar"),
             "buttons": [{"label": "Making Tax Digital help", "href": "/making-tax-digital"}]},
            {"type": "shared", "key": "quote_cta"},
            {"type": "shared", "key": "areas"},
            {"type": "shared", "key": "faq"},
            {"type": "shared", "key": "quote_cta"},
        ]})

    # ---- find an accountant (main form)
    pages.append({
        "type": "page", "path": QUOTE, "title": f"Find an Accountant – Get Free Quotes | {NAME}",
        "meta_description": "Tell us what you need and we'll match you with a local accountancy firm. Free, no obligation, and it takes about two minutes.",
        "h1": "Find an Accountant",
        "blocks": [
            {"type": "form", "form": "quote", "primary": True, "heading": "Find an Accountant",
             "md": "Answer a few quick questions and we'll pass your enquiry to a local accountancy firm that covers your area and works with people like you.\n\n"
                   "- **Free** for you, with no obligation\n- **Local**, so you can meet in person if you'd like\n- **Quick**: most people hear back within one working day\n\n"
                   f"We only share your details with the firm we match you with. See our [privacy policy](/privacy-policy).",
             "image": img("meeting.webp", "Meeting a local accountant")},
            {"type": "shared", "key": "faq"},
        ]})

    # ---- how it works
    pages.append({
        "type": "page", "path": "/how-it-works", "title": f"How It Works | {NAME}",
        "meta_description": "How Pivotal Accountants matches you with a local accountancy firm, free and with no obligation.",
        "h1": "How Pivotal Accountants Works",
        "blocks": [
            {"type": "hero", "bg": "brand", "heading": "How Pivotal Accountants Works",
             "text": "We're a free service that puts people and businesses in touch with local accountants. Here's what happens when you send us an enquiry.",
             "image": img("hero.webp", "Matching you with an accountant"), "buttons": [{"label": "Get Started", "href": QUOTE}]},
            {"type": "shared", "key": "how_it_works"},
            {"type": "text", "heading": "Who are the accountants?",
             "md": "The firms we work with are independent local accountancy practices that pay to receive enquiries from their area. We pass your enquiry to one firm, so you won't be flooded with calls.\n\n"
                   "Before you sign up with any accountant, ask which professional body they belong to (such as ICAEW, ACCA, ICAS, CIMA, AAT or CIOT) and for a fixed fee in writing. You agree terms directly with them, and you're under no obligation to go ahead."},
            {"type": "text", "bg": "soft", "heading": "What it costs you",
             "md": "Nothing. Our service is free for you. Accountancy firms pay us to be listed, and that never affects the price they quote you."},
            {"type": "shared", "key": "faq"},
            {"type": "shared", "key": "quote_cta"},
        ]})

    # ---- services index
    pages.append({
        "type": "page", "path": "/services", "title": f"Accountancy Services | {NAME}",
        "meta_description": "Tax returns, sole trader and limited company accounts, bookkeeping, payroll, VAT, Making Tax Digital, landlord and contractor accountants.",
        "h1": "Accountancy Services",
        "blocks": [
            {"type": "hero", "bg": "brand", "heading": "Accountancy Services",
             "text": "Whatever you need help with, we'll match you with a local accountant who does it every day.",
             "buttons": [{"label": "Get Free Quotes", "href": QUOTE}]},
            service_cards(heading="What do you need help with?"),
            {"type": "shared", "key": "quote_cta"},
        ]})

    # ---- locations
    pages.append({
        "type": "page", "path": "/locations", "title": f"Find an Accountant Near You | {NAME}",
        "meta_description": "Find a local accountant in your county, town or city across England, Scotland, Wales and Northern Ireland.",
        "h1": "Find an Accountant Near You",
        "blocks": [
            {"type": "text", "wide": True, "center": True, "primary": True, "heading": "Find an Accountant Near You",
             "md": f"Choose your county, town or city below.\n\n<div class=\"areas\">{counties_html()}</div>"},
            {"type": "text", "wide": True, "center": True, "bg": "soft", "heading": "Towns and cities",
             "md": f"<div class=\"areas\">{towns_html()}</div>"},
            {"type": "shared", "key": "quote_cta"},
        ]})

    # ---- about
    pages.append({
        "type": "page", "path": "/about", "title": f"About Us | {NAME}",
        "meta_description": "Pivotal Accountants is a free service matching people and small businesses with local accountancy firms across the UK.",
        "h1": "About Pivotal Accountants",
        "blocks": [
            {"type": "split", "primary": True, "heading": "About Pivotal Accountants",
             "md": "Most people find an accountant by word of mouth, or by trawling through websites and waiting for call-backs. We built Pivotal Accountants to make that quicker.\n\n"
                   "Tell us what you need and where you are, and we'll pass your enquiry to a local accountancy firm that covers your area and works with people like you. It's free for you and there's no obligation.\n\n"
                   "We're not an accountancy firm and we don't give tax advice ourselves. We just help you find someone good, locally.",
             "image": img("meeting.webp", "Meeting a local accountant")},
            {"type": "shared", "key": "how_it_works"},
            {"type": "shared", "key": "quote_cta"},
        ]})

    # ---- contact
    pages.append({
        "type": "page", "path": "/contact-us", "title": f"Contact Us | {NAME}",
        "meta_description": f"Get in touch with {NAME}.",
        "h1": "Contact Us",
        "blocks": [
            {"type": "form", "form": "contact", "primary": True, "heading": "Contact Us",
             "md": f"Have a question about our service? Send us a message and we'll get back to you.\n\n"
                   f"**Looking for an accountant?** Use our [quick form]({QUOTE}) instead, so we can match you straight away.\n\n"
                   f"**Accountancy firm?** See how to [get leads in your area]({LEADS}).\n\n"
                   f"Email: [{EMAIL}](mailto:{EMAIL})"},
        ]})

    # ---- for accountants (sales page for buyers)
    pages.append({
        "type": "page", "path": LEADS, "title": f"Accountancy Leads for Your Area | {NAME}",
        "meta_description": "Exclusive enquiries from people and businesses looking for an accountant in your area. One firm per location, sent straight to your inbox.",
        "h1": "Exclusive Accountancy Leads in Your Area",
        "blocks": [
            {"type": "hero", "bg": "brand", "eyebrow": "For accountancy firms", "heading": "Exclusive Accountancy Leads in Your Area",
             "text": "Sole traders, landlords, contractors and limited companies looking for an accountant near them. Claim your towns and every enquiry from them comes straight to you.",
             "image": img("hero.webp", "Accountancy leads"), "buttons": [{"label": "Check My Area", "href": "#apply"}]},
            {"type": "cards", "columns": 3, "heading": "How it works for firms",
             "items": [
                 {"title": "Exclusive areas", "md": "One firm per location. When you claim a town or county, its enquiries come only to you."},
                 {"title": "Sent instantly", "md": "Each enquiry is emailed to you the moment it's submitted, with what they need, their business type and turnover."},
                 {"title": "Your name on the page", "md": "Your firm's details and your own contact form can appear on your area pages, so people contact you directly."},
             ]},
            {"type": "text", "bg": "soft", "heading": "What's in each enquiry",
             "md": "- The service they need, from Self Assessment to limited company accounts\n- Whether they're a sole trader, company, landlord or contractor\n"
                   "- Their rough annual turnover\n- Whether they're switching from another accountant\n- When they need help\n- Name, email, phone, town and postcode\n\n"
                   "Every enquirer agrees for their details to be passed to a local accountancy firm before they submit."},
            {"type": "form", "form": "firm_enquiry", "anchor": "apply", "heading": "Check availability in your area",
             "md": f"Tell us which towns or counties you'd like and we'll let you know what's available and the monthly price.\n\nPrefer email? Contact [{EMAIL}](mailto:{EMAIL})."},
        ]})

    # ---- thank you
    pages.append({
        "type": "page", "path": "/thank-you", "title": f"Thank You | {NAME}", "noindex": 1, "h1": "Thank you",
        "blocks": [
            {"type": "hero", "bg": "brand", "center": True, "heading": "Thank you",
             "text": "We've received your enquiry. If you asked to be matched with an accountant, a local firm will be in touch, usually within one working day.",
             "buttons": [{"label": "Back to the homepage", "href": "/"}]},
            service_cards(["self-assessment", "mtd", "limited-company"], heading="While you wait"),
        ]})

    # ---- legal
    for path, h, md in LEGAL:
        pages.append({"type": "page", "path": path, "title": f"{h} | {NAME}", "meta_description": f"{NAME} {h.lower()}.", "h1": h, "body_md": md})
    return pages


LEGAL = [
    ("/privacy-policy", "Privacy Policy", f"""This policy explains how {NAME} ("we", "us") collects and uses your personal information when you use {DOMAIN}.

## What we collect

When you fill in one of our forms we collect the details you give us, such as your name, email address, phone number, town, postcode, business details and what you need help with. We also record the page you were on, the date and time, and basic technical information such as your country and the website that referred you.

## How we use it

- To pass your enquiry to a local accountancy firm so they can contact you about it. We do this because you asked us to, and you confirm it when you submit the form.
- To reply to messages you send us.
- To keep our service running, stop spam and improve the website.

## Who we share it with

If you ask to be matched with an accountant, we share your enquiry with one accountancy firm that covers your area. That firm becomes responsible for your information under its own privacy policy once it receives it. We don't sell your information to anyone else, and we don't share it for marketing.

We use trusted service providers to host the website and send emails, and they only process your information on our instructions.

## How long we keep it

We keep enquiries for up to two years, then delete them, unless we need to keep them longer for legal reasons.

## Your rights

You can ask for a copy of the information we hold about you, ask us to correct or delete it, or object to how we use it. Email [{EMAIL}](mailto:{EMAIL}). If you're unhappy with how we've handled your information, you can complain to the Information Commissioner's Office (ico.org.uk).

## Contact

[{EMAIL}](mailto:{EMAIL})"""),
    ("/terms-and-conditions", "Terms and Conditions", f"""These terms apply to your use of {DOMAIN}.

## Our service

{NAME} is a free service that passes enquiries from people looking for an accountant to local accountancy firms. We are not an accountancy firm and we don't provide tax, accounting or financial advice. Information on this website is general guidance only and may not reflect your circumstances or the latest rules. Always take advice from a qualified professional before acting on it.

## Accountants

The accountancy firms we pass enquiries to are independent businesses. Any agreement you make is between you and the firm. We don't guarantee their work, prices or availability, and we're not responsible for the advice or service they provide. We recommend checking any accountant's professional body membership and agreeing a fee in writing.

## Using the website

You agree to give accurate information in our forms and not to submit enquiries on behalf of someone else without their permission. We may change or withdraw the website at any time.

## Liability

We're not liable for any loss arising from your use of this website or from the services of any accountant you contact through it, except where the law doesn't allow us to exclude liability.

## Contact

[{EMAIL}](mailto:{EMAIL})"""),
    ("/cookie-policy", "Cookie Policy", f"""{DOMAIN} uses very little browser storage.

- **Location memory:** when you view a town page we remember which one in your browser's session storage, so your enquiry goes to the right local accountant. It's deleted when you close the tab.
- **Spam protection:** our forms may use Cloudflare Turnstile to check you're not a bot. It doesn't track you across other websites.
- **Analytics:** if we add website analytics, we'll update this page and ask for your consent where needed.

Questions? Email [{EMAIL}](mailto:{EMAIL})."""),
]


# ================================================================ site

EXTRA_CSS = """<style>
.hdr{border-bottom:1px solid var(--c-border)}
.logo-text{font-size:1.15rem;letter-spacing:-.01em}
h1,h2{letter-spacing:-.015em;font-weight:650}
.hero.sec{padding:72px 0;background:radial-gradient(ellipse at 90% 10%,rgba(231,168,58,.16),transparent 45%),var(--c-brand)}
.hero .eyebrow{display:inline-block;background:rgba(255,255,255,.1);padding:6px 12px;border-radius:99px;font-size:.75rem}
.hero .btns .btn+.btn{background:transparent;color:#fff;box-shadow:inset 0 0 0 2px rgba(255,255,255,.5)}
.card{transition:transform .15s,box-shadow .15s}.card:hover{transform:translateY(-3px);box-shadow:0 14px 30px rgba(16,35,61,.08)}
.card>img{aspect-ratio:16/9;object-fit:cover;width:100%}
.sec.soft .card{border-color:transparent;box-shadow:0 4px 18px rgba(16,35,61,.05)}
.faq details{border-color:var(--c-border)}.faq details[open]{border-color:var(--c-accent)}
.cta{background:radial-gradient(ellipse at 10% 90%,rgba(231,168,58,.18),transparent 45%),var(--c-cta)}
.formbox{border-top:4px solid var(--c-primary)}
.prose ul li::marker{color:var(--c-accent)}
.towns a:hover{color:var(--c-accent)}
</style>"""


def site():
    return {
        "slug": "accountants", "name": NAME, "domain": DOMAIN, "aliases": [f"www.{DOMAIN}"],
        "theme": {
            "colors": {"primary": "#E7A83A", "primary_text": "#10233D", "accent": "#1B7F6E", "brand": "#0F3D3E", "brand_text": "#ffffff",
                       "header": "#ffffff", "header_text": "#10233D", "nav_active": "#1B7F6E", "cta": "#0F3D3E", "cta_btn": "#E7A83A",
                       "cta_btn_text": "#10233D", "dark": "#10233D", "cream": "#F7F3EA", "text": "#10233D", "muted": "#55606E",
                       "border": "#E5DFD2", "footer": "#0B1F2E", "footer_text": "#ffffff", "link": "#1B7F6E"},
            "fonts": {"heading": "'Fraunces', Georgia, serif", "body": "'Figtree', system-ui, sans-serif",
                      "google": "family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Figtree:wght@400;600;700"},
            "logo": "/media/logo.svg", "logo_width": 40, "logo_text": True, "favicon": "/media/favicon.png", "radius": "10px",
        },
        "settings": {
            "nav": [{"label": "Services", "href": "/services"}, {"label": "Locations", "href": "/locations"},
                    {"label": "How It Works", "href": "/how-it-works"}, {"label": "For Accountants", "href": LEADS},
                    {"label": "Contact", "href": "/contact-us"}, {"label": "Get Free Quotes", "href": QUOTE}],
            "footer": {
                "text": f"© {{year}} {NAME}. A free service matching you with independent local accountancy firms. We don't provide tax or accounting advice.",
                "links": [{"label": s["name"] + (" Accountants" if s["key"] not in ("mtd", "bookkeeping", "payroll", "self-assessment") else ""), "href": s["path"]}
                          for s in SERVICES]
                         + [{"label": "Locations", "href": "/locations"}, {"label": "About", "href": "/about"},
                            {"label": "For Accountants", "href": LEADS}, {"label": "Contact", "href": "/contact-us"},
                            {"label": "Privacy Policy", "href": "/privacy-policy"}, {"label": "Terms", "href": "/terms-and-conditions"},
                            {"label": "Cookie Policy", "href": "/cookie-policy"}, {"label": EMAIL, "href": f"mailto:{EMAIL}"}],
            },
            "blog": {"path": "/blog", "title": "Tax and Accounting Guides", "per_page": 12, "post_prefix": "/guides/",
                     "intro": "Plain-English guides to tax returns, Making Tax Digital and running your business finances."},
            "location": {"template": "location_template"},
            "default_og_image": "/media/og.webp",
            "notify_email": EMAIL,
            "email_from": f"{NAME} <leads@{DOMAIN}>",
            # General enquiries go to the buyer of the town typed in, else the county picked
            "routing": {"area_field": ["town", "county"], "copy_admin": True},
            "head_html": EXTRA_CSS,
            "forms": forms(),
        },
    }


# ================================================================ run

shared = build_shared()
content = core_pages() + [service_page(s) for s in SERVICES] + location_pages()

paths = Counter(c["path"] for c in content)
dupes = [p for p, n in paths.items() if n > 1]
assert not dupes, f"duplicate paths: {dupes}"
locs = {c["data"]["town"].lower() for c in content if c["type"] == "location"}
assert len(locs) == sum(1 for c in content if c["type"] == "location"), "two locations share a name, so routing by name would be ambiguous"

dump = lambda name, obj: json.dump(obj, open(f"{OUT}/{name}", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
dump("site.json", site())
dump("shared.json", shared)
dump("content.json", content)
dump("redirects.json", [])
dump("media.json", MEDIA)

print("content:", dict(Counter(c["type"] for c in content)), "| shared:", len(shared), "| media:", len(MEDIA))
print("output:", OUT)
