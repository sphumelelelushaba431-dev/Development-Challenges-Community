/* =====================================================================
   Challenge auto-assignment (matching) — implements the agreed flow:

   Representative submits challenge
     → extract keywords from description
     → compare keywords with registered interests
        exact match?           yes → identify matching students
        no → synonyms / related keywords → related interest found? yes → related-interest score
        no → semantic similarity → similar meaning? yes → semantic alignment score
                                                    no → NO SUITABLE INTEREST MATCH
     → apply MCDA to candidate students → calculate & rank alignment scores
     → minimum threshold met?  yes → RECOMMEND suitable students (supervisor approves)
                               no  → NO SUITABLE INTEREST MATCH
   No match → flag challenge for supervisor review → supervisor decision:
     approve for further review (review/update interest categories) · keep unallocated · reject

   Assignment rule: the matching assigns each challenge to the best-matching SUPERVISOR
   (call run(challenge, supervisors)); the supervisor then adds students to the challenge.
   rankStudents() is also used to show suggested students when the supervisor builds the team.
   "Semantic similarity" here is a lightweight text-similarity (fuzzy trigram word matching
   against each interest's vocabulary). In production, swap similarity() for sentence
   embeddings from your backend — the rest of the flow stays the same.
   ===================================================================== */
(function () {
  'use strict';
  var INTERESTS = {
    'Software & Web Development': { k: ['software', 'app', 'application', 'web', 'website', 'portal', 'platform', 'database', 'programming', 'mobile', 'chatbot', 'cybersecurity', 'security', 'phishing', 'password', 'network', 'wi-fi', 'wifi', 'system'], s: ['code', 'coding', 'developer', 'online', 'booking', 'sms', 'api', 'digital', 'automation', 'automated', 'scheduling'], p: 'build software applications websites portals mobile apps online platforms digital tools automation' },
    'Data Science & Machine Learning': { k: ['data', 'dashboard', 'analytics', 'machine', 'learning', 'prediction', 'model', 'statistics', 'ai'], s: ['early-warning', 'forecast', 'insights', 'visualisation', 'visualization', 'metrics', 'trends', 'dropout'], p: 'analyse data build dashboards predictive models statistics insights trends' },
    'Internet of Things & Embedded Systems': { k: ['sensor', 'sensors', 'iot', 'embedded', 'device', 'arduino', 'microcontroller', 'hardware', 'prototype'], s: ['monitoring', 'detection', 'occupancy', 'smart', 'wireless', 'meter'], p: 'sensors devices hardware prototypes monitoring detection smart systems' },
    'Environmental Systems & Water': { k: ['water', 'leak', 'leaks', 'environment', 'environmental', 'waste', 'pollution', 'recycling', 'sanitation'], s: ['conservation', 'plumbing', 'drought', 'litter', 'dumping', 'river'], p: 'water conservation waste recycling pollution environment sanitation' },
    'Renewable Energy & Sustainability': { k: ['solar', 'energy', 'renewable', 'power', 'electricity', 'sustainability', 'sustainable'], s: ['charging', 'kiosk', 'grid', 'efficiency', 'carbon', 'load-shedding'], p: 'solar renewable energy electricity power efficiency sustainability' },
    'Health & Community Wellbeing': { k: ['health', 'clinic', 'patient', 'patients', 'wellbeing', 'medical', 'nutrition'], s: ['hygiene', 'care', 'medication', 'disease', 'wellness', 'mental'], p: 'community health clinics patients wellbeing care medical' },
    'Education & Skills Development': { k: ['education', 'training', 'skills', 'learning', 'tutoring', 'workshop', 'workshops', 'literacy', 'learners'], s: ['mentorship', 'mentor', 'teaching', 'course', 'curriculum', 'awareness', 'school'], p: 'education training skills tutoring workshops teaching learners schools' },
    'Entrepreneurship & Small Business Support': { k: ['business', 'entrepreneur', 'entrepreneurs', 'bookkeeping', 'finance', 'market', 'traders', 'sme'], s: ['startup', 'sales', 'farmers', 'procurement', 'informal', 'pricing', 'customers'], p: 'small business entrepreneurs traders finance bookkeeping markets customers sales' },
    'Design, Media & Communication': { k: ['design', 'media', 'communication', 'campaign', 'podcast', 'radio', 'video', 'social', 'branding', 'content'], s: ['storytelling', 'marketing', 'graphic', 'publicity', 'messaging', 'poster', 'outreach'], p: 'design media communication campaigns podcasts radio video social media branding content' },
    'Research': { k: ['research', 'study', 'survey', 'investigation', 'evaluation'], s: ['assessment', 'audit', 'mapping', 'report', 'findings', 'interviews'], p: 'research studies surveys investigation evaluation assessment findings' }
  };
  var STOP = 'a an the and or of to in for on with by from at as is are be this that these those it its we our their they them will would can could should need needs into over under about across more most very also not no than then so such which who whom what when where how all any each other some new using use used help helps students student challenge challenges current currently'.split(' ');
  var CFG = {
    weights: { alignment: 50, capacity: 25, availability: 15, record: 10 }, // MCDA weights for ranking students (total 100)
    stageScore: { exact: 1, related: 0.75 },                                   // alignment for each match type
    semanticMin: 0.3,                                                           // minimum similarity to count as "similar meaning"
    threshold: 55,                                                              // minimum MCDA score to be recommended
    supervisorCap: 5                                                            // max open challenges per supervisor; full supervisors are skipped
  };

  var stem = function (w) { return w.replace(/(ings|ing|ers|er|ies|es|s|ed|ly)$/, ''); };
  function tokens(text) { return (String(text).toLowerCase().match(/[a-z][a-z\-]+/g) || []).filter(function (w) { return w.length > 2 && STOP.indexOf(w) < 0; }); }
  // Keyword extraction: uses the NLP pipeline in js/keywords.js (normalise → synonyms → stop words →
  // negation → stemming → domain phrases + RAKE → weighting). Falls back to word frequency if it is not loaded.
  function extractKeywords(text, title) {
    if (window.Keywords) return window.Keywords.extract(text, title).top;
    var f = {}; tokens(text).forEach(function (w) { f[w] = (f[w] || 0) + 1; });
    return Object.keys(f).sort(function (a, b) { return f[b] - f[a]; }).slice(0, 60);
  }
  // Lightweight "meaning" similarity: fuzzy word matching (character trigrams) between the challenge
  // text and each interest's vocabulary, so e.g. "analyse" ≈ "analytics", "teach" ≈ "teaching".
  function grams(w) { var g = {}, x = '#' + w + '#'; for (var i = 0; i < x.length - 2; i++) g[x.substr(i, 3)] = 1; return g; }
  function dice(a, b) { var A = grams(a), B = grams(b), n = 0, na = 0, nb = 0, k; for (k in A) { na++; if (B[k]) n++; } for (k in B) nb++; return 2 * n / (na + nb); }
  function similarity(text, name) {
    var I = INTERESTS[name], vocab = tokens(I.p + ' ' + I.k.join(' ') + ' ' + I.s.join(' ')), toks = tokens(text), hits = [];
    toks.filter(function (t, i) { return toks.indexOf(t) === i; }).forEach(function (t) {
      var best = 0; vocab.forEach(function (v) { var d = dice(t, v); if (d > best) best = d; });
      if (best >= 0.5) hits.push(best);
    });
    if (!hits.length) return 0;
    var avg = hits.reduce(function (a, b) { return a + b; }, 0) / hits.length;
    return avg * Math.min(1, hits.length / 2);
  }

  /* Steps 1–4: which interest areas does the challenge belong to, and how strongly? */
  function matchInterests(challenge) {
    var text = challenge.title + '. ' + (challenge.desc || ''), K = window.Keywords ? window.Keywords.extract(challenge.desc || '', challenge.title) : null;
    var kw = K ? K.top : extractKeywords(text), kws = K ? K.free : kw.map(stem);
    var st = K ? window.Keywords.stem : stem;
    var has = function (list) { return list.filter(function (w) { return kws.indexOf(st(w)) > -1 || kws.indexOf(stem(w)) > -1; }); };
    // Known domain phrases found in the text count as strong exact matches for their area
    var phraseFor = function (n) { return K ? K.phrases.filter(function (p) { return p.area === n; }).map(function (p) { return p.phrase; }) : []; };
    var trace = ['Extracted keywords: ' + kw.slice(0, 8).join(', ')];
    var exact = [], related = [], semantic = [];
    Object.keys(INTERESTS).forEach(function (n) { var p = phraseFor(n), h = p.concat(has(INTERESTS[n].k)); if (h.length) exact.push({ interest: n, score: CFG.stageScore.exact * Math.min(1, 0.55 + 0.15 * h.length + 0.1 * p.length), via: h }); });
    if (exact.length) { trace.push('Exact keyword match → ' + exact.map(function (x) { return x.interest + ' (' + x.via.join(', ') + ')'; }).join('; ')); return { stage: 'exact', keywords: kw, interests: exact, trace: trace }; }
    trace.push('No exact keyword match — checking synonyms and related keywords');
    Object.keys(INTERESTS).forEach(function (n) { var h = has(INTERESTS[n].s); if (h.length) related.push({ interest: n, score: CFG.stageScore.related * Math.min(1, 0.55 + 0.15 * h.length), via: h }); });
    if (related.length) { trace.push('Related interest found → ' + related.map(function (x) { return x.interest + ' (' + x.via.join(', ') + ')'; }).join('; ')); return { stage: 'related', keywords: kw, interests: related, trace: trace }; }
    trace.push('No related keywords — checking semantic similarity');
    Object.keys(INTERESTS).forEach(function (n) { var s = similarity(text, n); if (s >= CFG.semanticMin) semantic.push({ interest: n, score: Math.min(0.7, 0.35 + 0.4 * s), via: ['similarity ' + s.toFixed(2)] }); });
    if (semantic.length) { semantic.sort(function (a, b) { return b.score - a.score; }); trace.push('Similar meaning detected → ' + semantic.map(function (x) { return x.interest + ' (' + x.via[0] + ')'; }).join('; ')); return { stage: 'semantic', keywords: kw, interests: semantic.slice(0, 3), trace: trace }; }
    trace.push('No similar meaning detected → no suitable interest match');
    return { stage: 'none', keywords: kw, interests: [], trace: trace };
  }

  /* Steps 5–7: apply MCDA to students, rank, check threshold */
  function rankStudents(match, students) {
    var w = CFG.weights, tot = w.alignment + w.capacity + w.availability + w.record;
    return students.map(function (s) {
      var best = 0, via = '';
      match.interests.forEach(function (m) { if (s.interests.indexOf(m.interest) > -1 && m.score > best) { best = m.score; via = m.interest; } });
      var cap = Math.max(0, 1 - s.load / s.cap), avail = s.available ? 1 : 0, rec = s.record == null ? 0.5 : s.record;
      var parts = { alignment: best, capacity: cap, availability: avail, record: rec };
      var score = 100 * (w.alignment * best + w.capacity * cap + w.availability * avail + w.record * rec) / tot;
      return { student: s, score: Math.round(score * 10) / 10, alignment: best, via: via, parts: parts, eligible: best > 0 && avail === 1 && s.load < s.cap };
    }).sort(function (a, b) { return b.score - a.score; });
  }

  function run(challenge, students) {
    var m = matchInterests(challenge);
    if (m.stage === 'none') return { challenge: challenge, match: m, ranked: [], recommended: [], outcome: 'flagged', trace: m.trace.concat(['Flagged for supervisor review']) };
    var ranked = rankStudents(m, students);
    var rec = ranked.filter(function (r) { return r.eligible && r.score >= CFG.threshold; });
    var trace = m.trace.concat(['Applied MCDA to ' + students.length + ' students (alignment ' + CFG.weights.alignment + '%, capacity ' + CFG.weights.capacity + '%, availability ' + CFG.weights.availability + '%, record ' + CFG.weights.record + '%)']);
    if (rec.length) trace.push('Minimum threshold (' + CFG.threshold + ') met by ' + rec.length + ' student(s) → recommend; supervisor approves');
    else trace.push('No student reached the minimum threshold (' + CFG.threshold + ') → no suitable interest match → flagged for supervisor review');
    return { challenge: challenge, match: m, ranked: ranked, recommended: rec, outcome: rec.length ? 'recommended' : 'flagged', trace: trace };
  }

  /* Supervisor assignment for a new challenge (no category needed):
     keywords from the title + description → Area(s) of Interest → supervisors whose expertise covers them,
     ranked with the same MCDA; supervisors who already hold CFG.supervisorCap open challenges are skipped. */
  function assignSupervisor(challenge, supervisors) {
    var m = matchInterests(challenge), w = CFG.weights, tot = w.alignment + w.capacity + w.availability + w.record;
    var all = m.interests.reduce(function (a, x) { return a + x.score; }, 0) || 1, strongest = m.interests.reduce(function (a, x) { return Math.max(a, x.score); }, 0);
    var ranked = supervisors.map(function (s) {
      var exp = s.expertise || s.interests || [], covered = m.interests.filter(function (x) { return exp.indexOf(x.interest) > -1; });
      var share = covered.reduce(function (a, x) { return a + x.score; }, 0) / all;                      // part of the challenge they cover
      var align = covered.length ? Math.min(1, 0.5 * share + 0.5 * Math.max.apply(null, covered.map(function (x) { return x.score; })) / (strongest || 1)) : 0;
      var cap = Math.max(0, 1 - s.load / CFG.supervisorCap), avail = s.available === false ? 0 : 1, rec = s.record == null ? 0.8 : s.record;
      var score = 100 * (w.alignment * align + w.capacity * cap + w.availability * avail + w.record * rec) / tot;
      return { supervisor: s, score: Math.round(score * 10) / 10, alignment: align, eligible: align > 0 && avail === 1 && s.load < CFG.supervisorCap };
    }).sort(function (a, b) { return b.score - a.score; });
    var best = ranked.filter(function (r) { return r.eligible && r.score >= CFG.threshold; })[0];
    return {
      supervisor: best ? best.supervisor : null,
      areas: m.interests.slice().sort(function (a, b) { return b.score - a.score; }).map(function (i) { return i.interest; }),
      keywords: m.keywords,
      outcome: best ? 'assigned' : 'flagged',   // flagged → the supervisors review it
      ranked: ranked, match: m
    };
  }

  window.Matching = { assignSupervisor: assignSupervisor, run: run, matchInterests: matchInterests, rankStudents: rankStudents, extractKeywords: extractKeywords, INTERESTS: Object.keys(INTERESTS), CFG: CFG };
})();
