"""Multi-Criteria Decision Analysis (MCDA) for matching people to challenges.

Criteria (all "benefit" criteria — higher is better), weights from config.MCDA_WEIGHTS:
    alignment     how well the person's registered areas cover the challenge's areas (from nlp.classify)
    capacity      free capacity: 1 − open load ÷ cap
    availability  1 if available, else 0
    record        track record 0–1

Weights can be set directly or derived with AHP from pairwise judgements (config.MCDA_AHP_PAIRWISE).

Two methods are computed for every candidate:
    WSM     weighted-sum score 0–100. Absolute, so it is used for the minimum threshold.
    TOPSIS  closeness to the ideal candidate 0–1 (Technique for Order of Preference by
            Similarity to Ideal Solution). Relative to the other candidates, so it is used
            for the ranking order when MCDA_RANKING = "topsis".
"""
import math

CRITERIA = ("alignment", "capacity", "availability", "record")
RANDOM_INDEX = {1: 0.0, 2: 0.0, 3: 0.58, 4: 0.90, 5: 1.12, 6: 1.24, 7: 1.32, 8: 1.41}


def ahp_weights(pairwise, criteria=CRITERIA):
    """AHP (Analytic Hierarchy Process): criterion weights from pairwise judgements.

    pairwise: {("alignment", "capacity"): 3, ...} — how many times more important the first is than the
    second on Saaty's 1–9 scale (missing pairs default to 1; the reverse pair is 1/x).
    Returns (weights, consistency_ratio). A consistency ratio below 0.10 means the judgements agree.
    """
    n = len(criteria)
    m = [[1.0] * n for _ in range(n)]
    for i, a in enumerate(criteria):
        for j, b in enumerate(criteria):
            if i != j:
                if (a, b) in pairwise:
                    m[i][j] = float(pairwise[(a, b)])
                elif (b, a) in pairwise:
                    m[i][j] = 1.0 / float(pairwise[(b, a)])
    # principal eigenvector via the geometric-mean method
    gm = [math.prod(row) ** (1.0 / n) for row in m]
    w = [x / sum(gm) for x in gm]
    # consistency: λmax from A·w
    aw = [sum(m[i][j] * w[j] for j in range(n)) for i in range(n)]
    lam = sum(aw[i] / w[i] for i in range(n)) / n
    ci = (lam - n) / (n - 1) if n > 1 else 0.0
    cr = ci / RANDOM_INDEX[n] if RANDOM_INDEX.get(n) else 0.0
    return {c: round(x, 4) for c, x in zip(criteria, w)}, round(cr, 4)


def _alignment(classification, areas, supervisor=False):
    matched = [a for a in classification["areas"] if a["area"] in areas]
    if not matched:
        return 0.0, None
    best = max(matched, key=lambda a: a["alignment"])
    value = best["alignment"]
    if supervisor and len(matched) > 1:          # a supervisor covering more of the challenge is better
        value = min(1.0, value + 0.1 * (len(matched) - 1))
    return round(value, 4), best["area"]


def topsis(rows, weights):
    """rows: list of {criterion: value}. Returns closeness coefficients (0–1) in the same order."""
    if not rows:
        return []
    norms = {c: math.sqrt(sum(r[c] ** 2 for r in rows)) for c in CRITERIA}
    v = [{c: (r[c] / norms[c] if norms[c] else 0.0) * weights[c] for c in CRITERIA} for r in rows]
    best = {c: max(x[c] for x in v) for c in CRITERIA}
    worst = {c: min(x[c] for x in v) for c in CRITERIA}
    out = []
    for x in v:
        d_plus = math.sqrt(sum((x[c] - best[c]) ** 2 for c in CRITERIA))
        d_minus = math.sqrt(sum((x[c] - worst[c]) ** 2 for c in CRITERIA))
        out.append(1.0 if d_plus + d_minus == 0 else d_minus / (d_plus + d_minus))
    return out


def rank(classification, candidates, cfg, supervisor=False):
    """candidates: [{id, name, areas, load, cap, available, record}] → ranked list with scores."""
    w = cfg["MCDA_WEIGHTS"]
    rows = []
    for c in candidates:
        align, via = _alignment(classification, c["areas"], supervisor)
        crit = {
            "alignment": align,
            "capacity": max(0.0, 1 - c["load"] / c["cap"]) if c["cap"] else 0.0,
            "availability": 1.0 if c.get("available", True) else 0.0,
            "record": float(c.get("record", 0.8)),
        }
        wsm = 100 * sum(w[k] * crit[k] for k in CRITERIA) / sum(w.values())
        rows.append({**c, "criteria": crit, "via": via, "wsm": round(wsm, 1),
                     "eligible": align > 0 and crit["availability"] == 1 and c["load"] < c["cap"]})
    closeness = topsis([r["criteria"] for r in rows], w)
    for r, cc in zip(rows, closeness):
        r["topsis"] = round(cc, 4)
        r["recommended"] = r["eligible"] and r["wsm"] >= cfg["MCDA_THRESHOLD"]
    # eligible candidates first (available, with capacity and some alignment), then by the chosen method
    key = (lambda r: (not r["eligible"], -r["topsis"], -r["wsm"])) if cfg.get("MCDA_RANKING") == "topsis" else (lambda r: (not r["eligible"], -r["wsm"], -r["topsis"]))
    rows.sort(key=key)
    return rows
