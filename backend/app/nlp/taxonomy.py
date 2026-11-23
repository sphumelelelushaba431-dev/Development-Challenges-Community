"""Domain knowledge used by the keyword extractor and the area classifier.

Add words and phrases here to make the matching more accurate over time.
"""

AREAS = [
    "Software & Web Development",
    "Data Science & Machine Learning",
    "Internet of Things & Embedded Systems",
    "Environmental Systems & Water",
    "Renewable Energy & Sustainability",
    "Health & Community Wellbeing",
    "Education & Skills Development",
    "Entrepreneurship & Small Business Support",
    "Design, Media & Communication",
    "Research",
]

# keywords: strong single-word evidence · related: synonyms / related words (weaker)
# profile: a short description used for the semantic (TF-IDF cosine) similarity criterion
# phrases: multi-word expressions that point to the area with high confidence
AREA_VOCAB = {
    "Software & Web Development": {
        "keywords": ["software", "app", "application", "web", "website", "portal", "platform", "database", "programming", "mobile", "chatbot", "cybersecurity", "security", "phishing", "password", "network", "wifi", "booking"],
        "related": ["code", "coding", "developer", "online", "sms", "api", "digital", "automation", "automate", "scheduling", "login", "e-commerce", "timetable", "clash"],
        "profile": "build software applications websites web portals mobile apps online platforms databases digital tools automation chatbots booking systems security",
        "phrases": ["mobile app", "web app", "web portal", "online platform", "booking system", "management system", "sms alerts", "sms reminders", "help desk", "faq chatbot", "user interface", "online booking", "cyber security", "phishing awareness", "information system"],
    },
    "Data Science & Machine Learning": {
        "keywords": ["data", "dashboard", "analytics", "machine", "prediction", "predict", "model", "statistics", "ai", "dataset"],
        "related": ["forecast", "insight", "visualisation", "metric", "trend", "dropout", "attrition", "classification", "clustering", "optimiser", "optimise"],
        "profile": "analyse data build dashboards predictive models machine learning statistics insights trends forecasting optimisation",
        "phrases": ["machine learning", "data analysis", "predictive model", "early warning", "early-warning", "data dashboard", "data science", "artificial intelligence", "big data", "data visualisation", "risk score"],
    },
    "Internet of Things & Embedded Systems": {
        "keywords": ["sensor", "iot", "embedded", "device", "arduino", "microcontroller", "hardware", "prototype", "raspberry"],
        "related": ["monitoring", "detection", "detect", "occupancy", "smart", "wireless", "meter", "rfid", "gps"],
        "profile": "sensors devices hardware prototypes microcontrollers monitoring detection smart wireless systems",
        "phrases": ["sensor network", "smart meter", "occupancy sensor", "real-time monitoring", "remote monitoring", "embedded system", "flow sensor", "low-cost sensor"],
    },
    "Environmental Systems & Water": {
        "keywords": ["water", "leak", "environment", "environmental", "waste", "pollution", "recycling", "recycle", "sanitation"],
        "related": ["conservation", "plumbing", "drought", "litter", "dumping", "river", "compost", "climate"],
        "profile": "water supply conservation leaks waste recycling pollution environment sanitation climate",
        "phrases": ["water leak", "water leaks", "water supply", "waste management", "food waste", "plate waste", "clean water", "water quality", "illegal dumping", "rainwater harvesting", "water conservation"],
    },
    "Renewable Energy & Sustainability": {
        "keywords": ["solar", "energy", "renewable", "power", "electricity", "sustainability", "sustainable"],
        "related": ["charging", "kiosk", "grid", "efficiency", "carbon", "load-shedding", "battery", "wind", "lighting"],
        "profile": "solar renewable energy electricity power efficiency sustainability charging batteries load-shedding",
        "phrases": ["solar power", "solar panel", "solar lighting", "renewable energy", "energy efficiency", "charging kiosk", "phone charging", "carbon footprint", "load-shedding"],
    },
    "Health & Community Wellbeing": {
        "keywords": ["health", "clinic", "patient", "wellbeing", "medical", "nutrition", "disease"],
        "related": ["hygiene", "care", "medication", "wellness", "mental", "queue", "nurse", "counselling", "elderly", "elders", "lonely", "isolation", "isolated", "disability"],
        "profile": "community health clinics patients wellbeing care medical nutrition mental health",
        "phrases": ["mental health", "public health", "health literacy", "campus clinic", "patient queue", "waiting room", "primary health care", "community health"],
    },
    "Education & Skills Development": {
        "keywords": ["education", "training", "skills", "tutoring", "workshop", "literacy", "learners", "school", "teaching"],
        "related": ["mentorship", "mentor", "course", "curriculum", "awareness", "orientation", "lesson", "coaching"],
        "profile": "education training skills tutoring workshops teaching learners schools mentorship courses",
        "phrases": ["skills development", "online learning", "e-learning", "study skills", "peer tutoring", "learner support", "teacher training", "career guidance"],
    },
    "Entrepreneurship & Small Business Support": {
        "keywords": ["business", "entrepreneur", "bookkeeping", "finance", "market", "traders", "sme"],
        "related": ["startup", "sales", "farmers", "procurement", "informal", "pricing", "customers", "income"],
        "profile": "small business entrepreneurs traders finance bookkeeping markets customers sales income",
        "phrases": ["small business", "small businesses", "informal traders", "business plan", "market access", "cash flow", "farmers market", "start-up"],
    },
    "Design, Media & Communication": {
        "keywords": ["design", "media", "communication", "campaign", "podcast", "radio", "video", "social", "branding", "content"],
        "related": ["storytelling", "marketing", "graphic", "publicity", "messaging", "poster", "outreach", "festival", "audience"],
        "profile": "design media communication campaigns podcasts radio video social media branding content storytelling publicity",
        "phrases": ["social media", "radio station", "podcast series", "awareness campaign", "brand identity", "video content", "graphic design", "publicity drive"],
    },
    "Research": {
        "keywords": ["research", "study", "survey", "investigation", "evaluation"],
        "related": ["assessment", "audit", "mapping", "findings", "interviews", "questionnaire", "baseline", "feasibility"],
        "profile": "research studies surveys investigation evaluation assessment findings interviews feasibility",
        "phrases": ["feasibility study", "needs assessment", "impact assessment", "literature review", "baseline survey", "case study", "data collection"],
    },
}

# US → UK spelling
UK_SPELLING = {
    "analyze": "analyse", "analyzing": "analysing", "analyzed": "analysed", "organization": "organisation", "organizations": "organisations",
    "optimize": "optimise", "optimization": "optimisation", "optimizer": "optimiser", "visualization": "visualisation", "color": "colour",
    "center": "centre", "behavior": "behaviour", "utilize": "utilise", "prioritize": "prioritise", "minimize": "minimise", "maximize": "maximise",
    "modeling": "modelling", "traveling": "travelling", "fiber": "fibre", "counseling": "counselling",
}

# everyday words → system vocabulary
SYNONYMS = {
    "hospital": "clinic", "hospitals": "clinic", "nurses": "nurse", "doctor": "medical", "doctors": "medical", "illness": "disease", "sick": "disease",
    "kids": "learners", "children": "learners", "pupils": "learners", "schools": "school", "tutor": "tutoring", "lecturers": "teaching", "lessons": "lesson",
    "pv": "solar", "photovoltaic": "solar", "panels": "solar", "loadshedding": "load-shedding", "outage": "electricity", "outages": "electricity", "electric": "electricity",
    "webpage": "website", "webapp": "web", "smartphone": "mobile", "cellphone": "mobile", "ussd": "sms", "whatsapp": "sms",
    "ml": "machine", "stats": "statistics", "spreadsheet": "data", "records": "data",
    "rubbish": "waste", "garbage": "waste", "trash": "waste", "pipes": "plumbing", "taps": "water", "borehole": "water", "boreholes": "water",
    "shop": "business", "shops": "business", "spaza": "business", "vendors": "traders", "hawkers": "traders", "accounting": "bookkeeping", "money": "finance",
    "advert": "marketing", "adverts": "marketing", "advertising": "marketing", "flyers": "poster", "logo": "branding", "film": "video", "documentary": "video",
    "questionnaire": "questionnaire", "investigate": "investigation",
}

STOP_WORDS = set("""
a an the and or but of to in for on with by from at as is are was were be been being this that these those it its we our us their they them i you your he she his her
will would can could should shall may might must need needs needed into over under about across more most very also not no than then so such which who whom what when where why how
all any each other some new using use used help helps helping make makes making get gets got do does did done have has had there here up down out off only just like want wants
please able many much lot lots well way ways thing things currently current today now often always every per via etc
students student challenge challenges project projects problem problems issue issues solution solutions team teams people person
organisation organisations university campus local area areas around within between because while during before after
""".split())

# Generic words carry little information about the area (like a low IDF)
GENERIC = {"system": 0.5, "systems": 0.5, "community": 0.6, "service": 0.6, "services": 0.6, "information": 0.6, "process": 0.6, "support": 0.6,
           "improve": 0.5, "better": 0.4, "tool": 0.6, "tools": 0.6, "simple": 0.4, "time": 0.5, "staff": 0.6, "users": 0.6, "user": 0.6, "report": 0.7, "work": 0.5}

NEGATIONS = {"no", "not", "without", "except", "excluding", "non"}
