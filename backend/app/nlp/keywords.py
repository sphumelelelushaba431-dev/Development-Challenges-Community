"""Keyword extraction from a challenge title and description.

Technique: a hybrid pipeline that combines three families of methods, because each one
covers the others' weak spots on short, informal descriptions written by representatives:

  Knowledge-based   normalisation, US→UK spelling, a synonym map, negation handling and a
                    gazetteer of known domain phrases (taxonomy.py).
  Statistical       TF-IDF, with the IDF learned from every challenge already in the database,
                    plus YAKE-style features: position (title / first sentence count more)
                    and spread (a word used across several sentences is more central).
  Graph / phrase    RAKE (Rapid Automatic Keyword Extraction): candidate phrases are the runs of
                    content words between stop words, scored by word degree ÷ frequency.

Each keyword gets a weight:
    weight = tf × idf × position × (1 + spread) × kind
where kind = 3 for a known domain phrase, 1 + 0.25·RAKE for other phrases and 1 for single words.
The keywords then feed the multi-criteria (MCDA) area classifier in classify.py.
"""
import math
import re
from collections import Counter, defaultdict

from .taxonomy import AREA_VOCAB, GENERIC, NEGATIONS, STOP_WORDS, SYNONYMS, UK_SPELLING

_EXCEPTIONS = {w: w for w in ("news", "analysis", "business", "process", "access", "glass", "gas", "series", "species", "status", "bus",
                              "campus", "data", "media", "learning", "training", "funding", "building", "housing", "wellbeing", "sms", "iot")}


def stem(word):
    """Light English stemmer: monitoring / monitored / monitors → monitor."""
    if word in _EXCEPTIONS or len(word) <= 4:
        return word
    w = re.sub(r"(isations|izations|isation|ization)$", "ise", word)
    w = re.sub(r"ational$", "ate", w)
    w = re.sub(r"(nesses|ness|ments|ment|ingly|edly|fully)$", "", w)
    w = re.sub(r"ies$", "y", w)
    w = re.sub(r"(ings|ing|ers|er|ed|es|s|ly)$", "", w)
    w = re.sub(r"(.)\1$", r"\1", w)
    return w or word


def normalise(text):
    t = (text or "").lower()
    t = t.replace("‘", "'").replace("’", "'").replace("“", '"').replace("”", '"')
    t = re.sub(r"https?://\S+|www\.\S+", " ", t)
    t = re.sub(r"\S+@\S+", " ", t)
    t = re.sub(r"\bload shedding\b", "load-shedding", t)
    t = re.sub(r"\bwi[- ]?fi\b", "wifi", t)
    t = re.sub(r"\be learning\b", "e-learning", t)
    t = re.sub(r"[0-9]+([.,][0-9]+)?%?", " ", t)
    return re.sub(r"[a-z]+", lambda m: UK_SPELLING.get(m.group(0), m.group(0)), t)


def _sentences(text):
    """→ list of sentences; each a list of (word, is_stop, is_negated)."""
    out = []
    for sent in re.split(r"[.!?;:\n]+", normalise(text)):
        toks, neg = [], 0
        for w in re.findall(r"[a-z][a-z'\-]*", sent):
            w = re.sub(r"'s$", "", w).strip("-")
            if not w:
                continue
            if w in NEGATIONS:
                neg = 2
                toks.append((w, True, False))
                continue
            stop = w in STOP_WORDS or len(w) < 3
            if not stop:
                w = SYNONYMS.get(w, w)
            toks.append((w, stop, neg > 0 and not stop))
            if not stop:
                neg = max(0, neg - 1)
        if toks:
            out.append(toks)
    return out


def build_idf(documents):
    """Inverse document frequency of every stem across the given texts (smoothed)."""
    df = Counter()
    for doc in documents:
        stems = {stem(w) for s in _sentences(doc) for (w, stop, _n) in s if not stop}
        df.update(stems)
    n = len(documents)
    return {k: math.log((n + 1) / (v + 1)) + 1 for k, v in df.items()}, n


def _idf(key, idf, n_docs):
    if idf:
        parts = key.split(" ")
        default = math.log((n_docs + 1) / 1) + 1  # unseen word: rare → informative
        val = sum(idf.get(p, default) for p in parts) / len(parts)
        top = math.log(n_docs + 1) + 1
        return max(0.3, min(1.5, val / top * 1.5))  # scale to ~0.3–1.5
    return 1.0


def known_phrases(text_norm):
    """Gazetteer lookup: [(phrase, area, count)]."""
    flat = " " + re.sub(r"\s+", " ", re.sub(r"[^a-z\- ]+", " ", text_norm)) + " "
    hits = []
    for area, vocab in AREA_VOCAB.items():
        for p in vocab["phrases"]:
            n = flat.count(" " + p + " ")
            if n:
                hits.append({"phrase": p, "area": area, "count": n})
    return hits, flat


def extract(description, title="", idf=None, n_docs=0, top_n=30):
    """Return the weighted keywords of a challenge.

    {"keywords": [{"term", "stem", "weight", "kind"}], "phrases": [...], "free_stems": set, "stems": set}
    """
    title_s, body_s = _sentences(title), _sentences(description)
    sentences = [(s, True) for s in title_s] + [(s, False) for s in body_s]
    n_sent = max(1, len(body_s))

    tf = Counter()
    first = {}
    seen_in = defaultdict(set)
    display = {}
    kind = {}
    degree, freq = Counter(), Counter()
    rake_cands = []

    def add(key, term, k, weight, sent_no, in_title):
        tf[key] += weight * (2 if in_title else 1)
        display.setdefault(key, term)
        if kind.get(key) != "phrase":
            kind[key] = k
        pos = -1 if in_title else sent_no
        first[key] = min(first.get(key, 99), pos)
        if not in_title:
            seen_in[key].add(sent_no)

    for i, (sent, in_title) in enumerate(sentences):
        sent_no = i - len(title_s)
        run = []

        def flush():
            if 2 <= len(run) <= 3:
                words = [w for w in run]
                for w in words:
                    degree[w] += len(words) - 1
                key = " ".join(stem(w) for w in words)
                add(key, " ".join(words), "rake", 1, sent_no, in_title)
                rake_cands.append(words)
            run.clear()

        for (w, stop, neg) in sent:
            if stop or neg:
                flush()
                continue
            if run and run[-1] == w:          # "spaza shop" → "business business": count once
                continue
            freq[w] += 1
            add(stem(w), w, "word", GENERIC.get(w, 1.0), sent_no, in_title)
            run.append(w)
        flush()

    # Known domain phrases (gazetteer) — strongest evidence
    norm_all = normalise((title + " . " + title + " . " if title else "") + description)
    phrase_hits, flat = known_phrases(norm_all)
    for h in phrase_hits:
        key = h["phrase"]
        tf[key] += 3 * h["count"]
        display[key] = key
        kind[key] = "phrase"
        first[key] = -1 if title and h["phrase"] in normalise(title) else 0

    # RAKE score per candidate phrase
    rake_score = {}
    for words in rake_cands:
        key = " ".join(stem(w) for w in words)
        rake_score[key] = sum((degree[w] + freq[w]) / max(1, freq[w]) for w in words)

    results = []
    for key, f in tf.items():
        if f <= 0:
            continue
        pos = 1.3 if first.get(key, 99) <= 0 else 1.0
        spread = len(seen_in[key]) / n_sent if seen_in[key] else 0
        k = kind[key]
        kind_w = 3.0 if k == "phrase" else (1 + 0.25 * rake_score.get(key, 0)) if k == "rake" else 1.0
        if k == "rake" and f < 2 and rake_score.get(key, 0) < 4:
            kind_w *= 0.5                     # one-off long phrases are usually noise
        weight = f * _idf(key, idf, n_docs) * pos * (1 + spread) * kind_w
        results.append({"term": display[key], "stem": key, "weight": round(weight, 3), "kind": "phrase" if k == "phrase" else k})

    # de-duplicate by surface form and rank
    best = {}
    for r in sorted(results, key=lambda r: -r["weight"]):
        best.setdefault(r["term"].replace("-", " "), r)
    ranked = sorted(best.values(), key=lambda r: (-r["weight"], r["kind"] != "phrase"))[:top_n]

    # stems of words that occur OUTSIDE known phrases ("learning" in "machine learning" is not education)
    rest = flat
    for h in phrase_hits:
        rest = rest.replace(" " + h["phrase"] + " ", " | ")
    free = {stem(w) for s in _sentences(rest) for (w, stop, neg) in s if not stop and not neg}
    all_stems = {p for r in ranked for p in r["stem"].split(" ")}
    return {"keywords": ranked, "phrases": phrase_hits, "free_stems": free, "stems": all_stems}
