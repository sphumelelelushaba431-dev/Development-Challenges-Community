"""Area of Interest classification — an MCDA (weighted-sum) decision over four criteria.

For every Area of Interest the challenge is scored on:

  C1  Phrase evidence     known domain phrases found (e.g. "machine learning")         weight 0.35
  C2  Keyword evidence    the area's core keywords found outside those phrases          weight 0.30
  C3  Related evidence    synonyms / related words found                                 weight 0.15
  C4  Semantic similarity cosine similarity between the challenge's TF-IDF vector and
                          the area's profile vector                                      weight 0.20

Each criterion is normalised to 0–1 and combined:  score = Σ wᵢ·Cᵢ.
The stage reported back follows the agreed flow: exact match → related → semantic → none.
"""
import math
from collections import Counter

from .keywords import _sentences, extract, stem
from .taxonomy import AREA_VOCAB, AREAS

CRITERIA_WEIGHTS = {"phrase": 0.35, "keyword": 0.30, "related": 0.15, "semantic": 0.20}
MIN_AREA_SCORE = 0.12          # areas below this are ignored
SEMANTIC_MIN = 0.12            # minimum cosine to count as "similar meaning"
STAGE_FACTOR = {"exact": 1.0, "related": 0.75, "semantic": 0.6, "none": 0.0}

_AREA_STEMS = {}


def _area_profile(area):
    if area not in _AREA_STEMS:
        v = AREA_VOCAB[area]
        text = " ".join([v["profile"], " ".join(v["keywords"]), " ".join(v["related"]), " ".join(v["phrases"])])
        _AREA_STEMS[area] = Counter(stem(w) for s in _sentences(text) for (w, stop, _n) in s if not stop)
    return _AREA_STEMS[area]


def _cosine(a, b, idf):
    def wv(c):
        return {k: v * (idf.get(k, 1.0) if idf else 1.0) for k, v in c.items()}
    a, b = wv(a), wv(b)
    dot = sum(a[k] * b.get(k, 0) for k in a)
    na, nb = math.sqrt(sum(x * x for x in a.values())), math.sqrt(sum(x * x for x in b.values()))
    return dot / (na * nb) if na and nb else 0.0


def classify(description, title="", idf=None, n_docs=0):
    """→ {"stage", "areas": [{"area","score","criteria","via"}], "keywords": [...], "trace": [...]}"""
    ex = extract(description, title, idf, n_docs)
    free = ex["free_stems"]
    text_vec = Counter()
    for k in ex["keywords"]:
        for p in k["stem"].split(" "):
            text_vec[p] += k["weight"]

    areas = []
    for area in AREAS:
        v = AREA_VOCAB[area]
        ph = [h["phrase"] for h in ex["phrases"] if h["area"] == area]
        kw = sorted({w for w in v["keywords"] if stem(w) in free})
        rel = sorted({w for w in v["related"] if stem(w) in free and w not in kw})
        sem = _cosine(text_vec, _area_profile(area), idf)
        c = {
            "phrase": min(1.0, sum(h["count"] for h in ex["phrases"] if h["area"] == area) / 2),
            "keyword": min(1.0, len(kw) / 3),
            "related": min(1.0, len(rel) / 3),
            "semantic": min(1.0, sem / 0.5),
        }
        score = sum(CRITERIA_WEIGHTS[k] * c[k] for k in c)
        if ph or kw:
            stage = "exact"
        elif rel:
            stage = "related"
        elif sem >= SEMANTIC_MIN:
            stage = "semantic"
        else:
            stage = "none"
        if stage in ("exact", "related") or (stage == "semantic" and score >= MIN_AREA_SCORE):
            areas.append({"area": area, "score": round(score, 3), "stage": stage, "criteria": {k: round(x, 3) for k, x in c.items()},
                          "via": ph + kw + rel or ["similarity %.2f" % sem]})

    areas.sort(key=lambda a: -a["score"])
    stages = [a["stage"] for a in areas]
    overall = "exact" if "exact" in stages else "related" if "related" in stages else "semantic" if stages else "none"
    if overall != "none":                       # keep the strongest stage only, like the agreed flow
        areas = [a for a in areas if a["stage"] == overall] or areas
    best = areas[0]["score"] if areas else 1
    for a in areas:                              # alignment 0–1 used by the people-ranking MCDA
        a["alignment"] = round(STAGE_FACTOR[a["stage"]] * min(1.0, 0.55 + 0.45 * a["score"] / best), 3)

    trace = ["Extracted keywords: " + ", ".join(k["term"] for k in ex["keywords"][:8])]
    if overall == "none":
        trace.append("No exact, related or similar-meaning match → no suitable interest match")
    else:
        trace.append({"exact": "Exact keyword / phrase match", "related": "Related keywords", "semantic": "Similar meaning"}[overall] + " → " +
                     "; ".join("%s (%s)" % (a["area"], ", ".join(a["via"][:4])) for a in areas[:3]))
    return {"stage": overall, "areas": areas[:3], "keywords": ex["keywords"], "trace": trace}
