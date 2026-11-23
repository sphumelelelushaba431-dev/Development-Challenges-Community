> **The backend decides.** With the Flask backend running, keyword extraction, the Area of Interest and the MCDA ranking are done on the server (`backend/app/nlp/` and `backend/app/mcda.py`: AHP weights, WSM threshold, TOPSIS ranking). This file describes the browser copy in `js/matching.js`, used in demo mode and by `tools/keyword-tester.html`.

# Challenge auto-assignment (matching)

Code: `js/keywords.js` (keyword extraction) and `js/matching.js` (areas and ranking). Neither depends on the UI — the backend can run the same logic. Try descriptions in `tools/keyword-tester.html`.

| Step in your flow | What the code does |
|---|---|
| Representative submits challenge | `Matching.run(challenge, students)` is called on submission |
| Extract keywords from description | `Keywords.extract()`: normalise → synonyms → stop words → negation → stemming → known domain phrases + RAKE phrases → weighting (title × 2, first sentence × 1.3, generic words count less). See README |
| Compare with registered interests → **exact match?** | Known domain phrases (e.g. *machine learning*, *water leak*) and each area's keyword list (e.g. *podcast, radio, campaign* → Design, Media & Communication). Match = alignment up to **1.00** |
| No → **synonyms / related keywords** | Second list per interest (e.g. *storytelling, publicity*). Match = alignment **0.75** |
| No → **semantic similarity** | Fuzzy word matching (character trigrams) against each interest's vocabulary, e.g. *analyse ≈ analytics*. Similarity ≥ 0.30 → alignment **0.35–0.70**. Replace `similarity()` with sentence embeddings in production |
| No similar meaning | → **No suitable interest match** |
| Apply MCDA, calculate & rank | Weighted sum per student: interest alignment **50%**, free capacity **25%**, availability **15%**, track record **10%** → score 0–100 |
| **Minimum threshold met?** | Score ≥ **55** and student available with free capacity → **recommend** |
| No → no suitable match | → **Flag challenge for supervisor review** |
| Supervisor decision | **Approve for further review** (review/update interest categories) · **Keep unallocated** · **Reject** (reason required) |

All weights and thresholds are in `Matching.CFG`.

**Who gets assigned:** the matching assigns each new challenge to the best-matching **supervisor** (supervisors register their areas of expertise like students register interests). The supervisor then **adds students** to the challenge from the dashboard; students whose interests fit are shown as *Suggested*. If no supervisor meets the threshold, the challenge is flagged for review by a coordinating supervisor or administrator.

## Supervisor capacity

A supervisor holds **at most 5 open challenges** at a time (waiting for students, in progress, or waiting for verification) — `Matching.CFG.supervisorCap`. When the matching assigns a new challenge, supervisors who already have 5 are skipped; if every suitable supervisor is full, the challenge waits for a coordinator or administrator. On the Supervisor dashboard the first 3 challenges are listed and **View more** opens the rest.

## Submitting a challenge (no category)

Representatives must also say whether their organisation will fund the project (Yes / No). Supervisors can submit challenges too; funding is not required for those.


The **Submit challenge** form has no Category field. When a Representative submits, the system reads the **title and description**, extracts keywords, works out the Area(s) of Interest (exact → related → similar meaning), and assigns the challenge to a **supervisor whose registered expertise covers that area** — ranked with the same MCDA and skipping supervisors who already hold 5 open challenges (`Matching.assignSupervisor(challenge, supervisors)`). If no supervisor fits, the challenge is flagged for a coordinator or administrator. None of this is shown on screen; the Representative only sees which supervisor the challenge went to.
