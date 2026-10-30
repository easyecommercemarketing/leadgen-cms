"""
Locations and region copy for pivotalaccountants.com (used by build_accountants.py).

AREAS: (area name, region, [major towns]). Each area gets a county page and each town a town page.
Area names double as the options in the quote form's County field, which is how general enquiries
are routed to the buyer of that county.
"""

AREAS = [
    # ---- North East
    ("Northumberland", "North East", ["Blyth", "Cramlington", "Ashington", "Morpeth", "Hexham"]),
    ("Tyne and Wear", "North East", ["Newcastle upon Tyne", "Sunderland", "Gateshead", "South Shields", "North Shields"]),
    ("County Durham", "North East", ["Durham", "Darlington", "Hartlepool", "Stockton-on-Tees", "Bishop Auckland"]),
    # ---- North West
    ("Cumbria", "North West", ["Carlisle", "Barrow-in-Furness", "Kendal", "Workington", "Whitehaven"]),
    ("Lancashire", "North West", ["Preston", "Blackpool", "Blackburn", "Burnley", "Lancaster"]),
    ("Greater Manchester", "North West", ["Manchester", "Salford", "Bolton", "Stockport", "Oldham", "Wigan", "Rochdale"]),
    ("Merseyside", "North West", ["Liverpool", "Birkenhead", "St Helens", "Southport"]),
    ("Cheshire", "North West", ["Chester", "Warrington", "Crewe", "Macclesfield"]),
    # ---- Yorkshire and the Humber
    ("North Yorkshire", "Yorkshire and the Humber", ["York", "Harrogate", "Scarborough", "Middlesbrough", "Redcar"]),
    ("West Yorkshire", "Yorkshire and the Humber", ["Leeds", "Bradford", "Wakefield", "Huddersfield", "Halifax"]),
    ("South Yorkshire", "Yorkshire and the Humber", ["Sheffield", "Doncaster", "Rotherham", "Barnsley"]),
    ("East Riding of Yorkshire", "Yorkshire and the Humber", ["Hull", "Beverley", "Bridlington"]),
    # ---- East Midlands
    ("Derbyshire", "East Midlands", ["Derby", "Chesterfield", "Buxton"]),
    ("Nottinghamshire", "East Midlands", ["Nottingham", "Mansfield", "Newark-on-Trent"]),
    ("Leicestershire", "East Midlands", ["Leicester", "Loughborough", "Hinckley"]),
    ("Lincolnshire", "East Midlands", ["Lincoln", "Grimsby", "Scunthorpe", "Boston"]),
    ("Northamptonshire", "East Midlands", ["Northampton", "Kettering", "Corby"]),
    ("Rutland", "East Midlands", ["Oakham"]),
    # ---- West Midlands
    ("West Midlands", "West Midlands", ["Birmingham", "Coventry", "Wolverhampton", "Solihull", "Walsall", "Dudley"]),
    ("Staffordshire", "West Midlands", ["Stoke-on-Trent", "Stafford", "Burton upon Trent", "Tamworth"]),
    ("Warwickshire", "West Midlands", ["Warwick", "Leamington Spa", "Nuneaton", "Rugby"]),
    ("Worcestershire", "West Midlands", ["Worcester", "Redditch", "Kidderminster"]),
    ("Shropshire", "West Midlands", ["Shrewsbury", "Telford"]),
    ("Herefordshire", "West Midlands", ["Hereford"]),
    # ---- East of England
    ("Norfolk", "East of England", ["Norwich", "King's Lynn", "Great Yarmouth"]),
    ("Suffolk", "East of England", ["Ipswich", "Bury St Edmunds", "Lowestoft"]),
    ("Cambridgeshire", "East of England", ["Cambridge", "Peterborough", "Huntingdon"]),
    ("Essex", "East of England", ["Chelmsford", "Colchester", "Southend-on-Sea", "Basildon"]),
    ("Hertfordshire", "East of England", ["St Albans", "Watford", "Stevenage", "Hemel Hempstead"]),
    ("Bedfordshire", "East of England", ["Bedford", "Luton"]),
    # ---- London
    ("Greater London", "London", ["London", "Croydon", "Bromley", "Romford", "Kingston upon Thames", "Harrow", "Ealing"]),
    # ---- South East
    ("Kent", "South East", ["Maidstone", "Canterbury", "Ashford", "Tunbridge Wells", "Dartford"]),
    ("Surrey", "South East", ["Guildford", "Woking", "Epsom"]),
    ("East Sussex", "South East", ["Brighton", "Eastbourne", "Hastings"]),
    ("West Sussex", "South East", ["Crawley", "Worthing", "Chichester", "Horsham"]),
    ("Hampshire", "South East", ["Southampton", "Portsmouth", "Basingstoke", "Winchester"]),
    ("Berkshire", "South East", ["Reading", "Slough", "Bracknell", "Newbury"]),
    ("Buckinghamshire", "South East", ["Milton Keynes", "High Wycombe", "Aylesbury"]),
    ("Oxfordshire", "South East", ["Oxford", "Banbury", "Didcot"]),
    ("Isle of Wight", "South East", ["Ryde"]),
    # ---- South West
    ("Bristol", "South West", []),
    ("Gloucestershire", "South West", ["Gloucester", "Cheltenham", "Stroud"]),
    ("Somerset", "South West", ["Bath", "Taunton", "Yeovil", "Weston-super-Mare"]),
    ("Wiltshire", "South West", ["Swindon", "Salisbury", "Chippenham"]),
    ("Dorset", "South West", ["Bournemouth", "Poole", "Dorchester"]),
    ("Devon", "South West", ["Exeter", "Plymouth", "Torquay", "Barnstaple"]),
    ("Cornwall", "South West", ["Truro", "Falmouth", "Newquay", "St Austell"]),
    # ---- Wales
    ("South Wales", "Wales", ["Cardiff", "Swansea", "Newport", "Bridgend", "Barry"]),
    ("West Wales", "Wales", ["Carmarthen", "Llanelli", "Haverfordwest", "Aberystwyth"]),
    ("North Wales", "Wales", ["Wrexham", "Bangor", "Rhyl", "Llandudno"]),
    ("Mid Wales", "Wales", ["Newtown", "Brecon"]),
    # ---- Scotland
    ("Strathclyde", "Scotland", ["Glasgow", "Paisley", "East Kilbride", "Hamilton", "Motherwell", "Kilmarnock", "Ayr"]),
    ("Lothian", "Scotland", ["Edinburgh", "Livingston"]),
    ("Fife", "Scotland", ["Dunfermline", "Kirkcaldy", "St Andrews"]),
    ("Tayside", "Scotland", ["Dundee", "Perth"]),
    ("Aberdeenshire", "Scotland", ["Aberdeen", "Peterhead"]),
    ("Highlands", "Scotland", ["Inverness", "Fort William"]),
    ("Central Scotland", "Scotland", ["Stirling", "Falkirk"]),
    ("Dumfries and Galloway", "Scotland", ["Dumfries"]),
    ("Scottish Borders", "Scotland", ["Galashiels", "Hawick"]),
    # ---- Northern Ireland
    ("Antrim", "Northern Ireland", ["Belfast", "Lisburn", "Ballymena"]),
    ("Down", "Northern Ireland", ["Newry", "Newtownards"]),
    ("Londonderry", "Northern Ireland", ["Derry", "Coleraine"]),
    ("Armagh", "Northern Ireland", ["Craigavon", "Portadown", "Lurgan"]),
    ("Tyrone", "Northern Ireland", ["Omagh", "Dungannon"]),
    ("Fermanagh", "Northern Ireland", ["Enniskillen"]),
]

REGION_ORDER = ["North East", "North West", "Yorkshire and the Humber", "East Midlands", "West Midlands", "East of England",
                "London", "South East", "South West", "Wales", "Scotland", "Northern Ireland"]

# A paragraph about the local business mix, so each region's pages read differently.
REGION_MD = {
    "North East": "The North East has a busy mix of small firms: trades and construction, engineering and manufacturing suppliers, hospitality, and a growing number of digital and creative businesses around the cities. A good local accountant here will be used to everything from a one-van sole trader to a family-run limited company with a handful of staff.",
    "North West": "From the city-centre agencies and hospitality businesses of Manchester and Liverpool to the manufacturers, farms and tourism businesses further out, the North West has one of the widest spreads of small businesses in the country. Local accountants here see a lot of growing limited companies, contractors and landlords, as well as plenty of sole traders.",
    "Yorkshire and the Humber": "Yorkshire's economy runs on small and family businesses: trades, retail, manufacturing, food and drink, logistics and a fast-growing tech scene in the big cities. Accountants across the region are well used to sole traders, partnerships and owner-managed limited companies, and many specialise in property and landlord tax too.",
    "East Midlands": "The East Midlands is home to a lot of manufacturing, logistics, retail and trade businesses, along with farms and rural enterprises across the counties. Local accountants here handle everything from first Self Assessment returns to payroll and VAT for growing firms.",
    "West Midlands": "Birmingham and the wider West Midlands have one of the UK's largest small-business populations: engineering and automotive suppliers, trades, retail, hospitality and professional services. Accountants in the region see a lot of limited companies, contractors and businesses close to the VAT threshold.",
    "East of England": "The East of England mixes agriculture and rural businesses with commuter-belt professionals, contractors and fast-growing tech and science firms around Cambridge. Local accountants here deal with plenty of limited companies, IR35 questions and rental property, alongside traditional sole traders.",
    "London": "London has more small businesses and self-employed people than anywhere else in the UK, from freelancers and contractors to restaurants, retailers, agencies and landlords. Because there are so many accountants to choose from, it pays to compare a few on price, specialism and how they like to work before you commit.",
    "South East": "The South East has a large number of owner-managed limited companies, contractors and consultants, alongside trades, retail and a busy rental market. Accountants in the region often specialise, so it's worth finding one who already works with businesses like yours.",
    "South West": "The South West's small businesses range from tourism, hospitality and holiday lets to farming, trades, creative businesses and a growing tech sector around Bristol. Local accountants are used to seasonal income, furnished holiday lets and rural businesses as well as standard sole trader and company work.",
    "Wales": "Small businesses are the backbone of the Welsh economy: trades, farming, tourism, retail and a growing number of digital and creative firms. Welsh taxpayers pay Welsh rates of income tax, which are set by the Senedd, so it helps to use an accountant who knows how that shows up on your tax return.",
    "Scotland": "Scotland sets its own income tax rates and bands, so a Scottish taxpayer's bill can be quite different from someone earning the same in England. If you're self-employed, a landlord or a company director taking a salary in Scotland, an accountant who works with Scottish taxpayers every day will make sure your tax is worked out on the right basis.",
    "Northern Ireland": "Northern Ireland's small businesses include trades, agriculture, retail, hospitality and a strong tech and services sector around Belfast. Many trade across the border too, which can bring extra VAT and customs questions, so a local accountant who knows the NI rules is well worth having.",
}

# National notes for the location FAQ ("Do the tax rules differ in {{town}}?")
NATION_NOTE = {
    "Scotland": "Yes. If you live in Scotland you pay Scottish income tax, which has more bands and different rates from the rest of the UK. National Insurance, VAT and corporation tax are the same UK-wide.",
    "Wales": "Mostly no. Welsh taxpayers pay Welsh rates of income tax, which are set in Wales but have so far matched the rates in England. National Insurance, VAT and corporation tax are the same across the UK.",
    "Northern Ireland": "Income tax, National Insurance and corporation tax work the same as in England. Businesses moving goods between Northern Ireland, Great Britain and the EU can have extra VAT and customs rules to deal with.",
}
DEFAULT_NATION_NOTE = "No. Income tax, National Insurance, VAT and corporation tax are the same across England. Your accountant just needs to know your personal situation and how your business is set up."
