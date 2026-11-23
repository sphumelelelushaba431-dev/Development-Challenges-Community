/* =====================================================================
   Keyword extraction for challenge descriptions (used by js/matching.js)

   Technique — a small NLP pipeline that runs in the browser (no libraries):
     1. Normalise     lower-case, straight quotes, US → UK spelling, remove links,
                      e-mails and numbers, unify hyphenated words ("e-learning").
     2. Synonyms      map everyday words to the system's vocabulary
                      ("hospital" → "clinic", "pv" → "solar", "kids" → "learners").
     3. Tokenise      split into words; drop stop words and filler words
                      ("please", "want", "problem", "project" …).
     4. Negation      ignore words right after "no / not / without / except"
                      ("not a software project" does not count as software).
     5. Stem          light suffix stripping with exceptions, so "monitoring",
                      "monitored" and "monitors" are counted as one word.
     6. Phrases       a) known domain phrases ("machine learning", "water leak",
                         "small business", "mental health" …) are detected first;
                      b) RAKE (Rapid Automatic Keyword Extraction) finds other
                         multi-word candidates between stop words and scores them
                         by word degree ÷ frequency.
     7. Weighting     term frequency × position boost (title × 2, first sentence × 1.3)
                      × specificity (generic words such as "system" or "community"
                      count less, like an inverse-document-frequency weight).
     8. Rank          return the top keywords and phrases with their weights.

   Keywords.extract(text, title) → { keywords: [{ term, stem, weight, kind }], top: [term…], stems: [stem…],
                                     free: [stems outside known phrases], phrases: [{ phrase, area, count }] }
   ===================================================================== */
(function () {
  'use strict';

  var UK = { analyze: 'analyse', analyzing: 'analysing', analyzed: 'analysed', organization: 'organisation', organizations: 'organisations', optimize: 'optimise', optimization: 'optimisation', visualization: 'visualisation', color: 'colour', center: 'centre', program: 'programme', behavior: 'behaviour', utilize: 'utilise', prioritize: 'prioritise', minimize: 'minimise', maximize: 'maximise', modeling: 'modelling', traveling: 'travelling', fiber: 'fibre', meter: 'metre' };
  var SYN = {
    hospital: 'clinic', hospitals: 'clinic', nurses: 'clinic', nurse: 'clinic', doctor: 'medical', doctors: 'medical', illness: 'disease', sick: 'disease',
    kids: 'learners', children: 'learners', pupils: 'learners', schools: 'school', tutor: 'tutoring', lecturers: 'teaching', lessons: 'teaching',
    pv: 'solar', photovoltaic: 'solar', panels: 'solar', loadshedding: 'load-shedding', outage: 'electricity', outages: 'electricity', electric: 'electricity',
    webpage: 'website', webapp: 'web', smartphone: 'mobile', cellphone: 'mobile', ussd: 'sms', whatsapp: 'sms',
    ml: 'machine', ai: 'ai', analytics: 'analytics', spreadsheet: 'data', records: 'data', statistics: 'statistics', stats: 'statistics',
    rubbish: 'waste', garbage: 'waste', trash: 'waste', dumping: 'dumping', pipes: 'plumbing', taps: 'water', boreholes: 'water', borehole: 'water',
    shop: 'business', shops: 'business', spaza: 'business', vendors: 'traders', hawkers: 'traders', accounting: 'bookkeeping', money: 'finance',
    advert: 'marketing', adverts: 'marketing', advertising: 'marketing', flyers: 'poster', logo: 'branding', film: 'video', documentary: 'video',
    questionnaire: 'survey', interviews: 'interviews', literature: 'research', investigate: 'investigation'
  };
  var STOP = ('a an the and or but of to in for on with by from at as is are was were be been being this that these those it its we our us their they them i you your he she his her ' +
    'will would can could should shall may might must need needs needed into over under about across more most very also not no than then so such which who whom what when where why how ' +
    'all any each other some new using use used help helps helping make makes making get gets got do does did done have has had there here up down out off only just like want wants ' +
    'please would-like able many much lot lots well way ways thing things currently current today now often always every per via etc e.g i.e ' +
    'students student challenge challenges project projects problem problems issue issues solution solutions team teams people person ' +
    'organisation organisations university campus local area areas around within between because while during before after').split(' ');
  // Generic words: still kept, but they say little about the area, so they weigh less (like a low IDF)
  var GENERIC = { system: 0.5, systems: 0.5, community: 0.6, service: 0.6, services: 0.6, information: 0.6, process: 0.6, support: 0.6, improve: 0.5, better: 0.4, tool: 0.6, tools: 0.6, simple: 0.4, time: 0.5, staff: 0.6, users: 0.6, user: 0.6, report: 0.7, work: 0.5 };
  var NEG = ['no', 'not', 'without', 'except', 'excluding', 'non'];
  // Known domain phrases → the Area of Interest they point to (names match js/matching.js)
  var PHRASES = {
    'Software & Web Development': ['mobile app', 'web app', 'web portal', 'online platform', 'booking system', 'management system', 'sms alerts', 'sms reminders', 'help desk', 'faq chatbot', 'user interface', 'online booking', 'cyber security', 'phishing awareness', 'information system'],
    'Data Science & Machine Learning': ['machine learning', 'data analysis', 'predictive model', 'early warning', 'early-warning', 'data dashboard', 'data science', 'artificial intelligence', 'big data', 'data visualisation', 'risk score'],
    'Internet of Things & Embedded Systems': ['sensor network', 'smart meter', 'occupancy sensor', 'real-time monitoring', 'remote monitoring', 'embedded system', 'flow sensor', 'low-cost sensor'],
    'Environmental Systems & Water': ['water leak', 'water leaks', 'water supply', 'waste management', 'food waste', 'plate waste', 'clean water', 'water quality', 'illegal dumping', 'rainwater harvesting', 'water conservation'],
    'Renewable Energy & Sustainability': ['solar power', 'solar panel', 'solar lighting', 'renewable energy', 'energy efficiency', 'charging kiosk', 'phone charging', 'carbon footprint', 'load-shedding'],
    'Health & Community Wellbeing': ['mental health', 'public health', 'health literacy', 'campus clinic', 'patient queue', 'waiting room', 'primary health care', 'community health'],
    'Education & Skills Development': ['skills development', 'online learning', 'e-learning', 'study skills', 'peer tutoring', 'learner support', 'teacher training', 'career guidance'],
    'Entrepreneurship & Small Business Support': ['small business', 'small businesses', 'informal traders', 'business plan', 'market access', 'cash flow', 'farmers market', 'start-up'],
    'Design, Media & Communication': ['social media', 'radio station', 'podcast series', 'awareness campaign', 'brand identity', 'video content', 'graphic design', 'publicity drive'],
    'Research': ['feasibility study', 'needs assessment', 'impact assessment', 'literature review', 'baseline survey', 'case study', 'data collection']
  };

  var EXC = { news: 'news', analysis: 'analysis', business: 'business', process: 'process', access: 'access', glass: 'glass', gas: 'gas', series: 'series', species: 'species', status: 'status', bus: 'bus', campus: 'campus', data: 'data', media: 'media', learning: 'learning', training: 'training', funding: 'funding', building: 'building', housing: 'housing' };
  function stem(w) {
    if (EXC[w]) return EXC[w];
    if (w.length <= 4) return w;
    return w.replace(/(isations|izations|isation|ization)$/, 'ise')
      .replace(/(ational)$/, 'ate')
      .replace(/(nesses|ness|ments|ment|ingly|edly|fully)$/, '')
      .replace(/(ies)$/, 'y')
      .replace(/(ings|ing|ers|er|ed|es|s|ly)$/, '')
      .replace(/(.)\1$/, '$1');
  }

  function normalise(text) {
    var t = String(text || '').toLowerCase()
      .replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
      .replace(/https?:\/\/\S+|www\.\S+/g, ' ').replace(/\S+@\S+/g, ' ')
      .replace(/\b(e|m)-(learning|commerce|health|waste)\b/g, 'e-$2')
      .replace(/\bload shedding\b/g, 'load-shedding').replace(/\bwi[- ]?fi\b/g, 'wifi')
      .replace(/[0-9]+([.,][0-9]+)?%?/g, ' ');
    return t.replace(/[a-z]+/g, function (w) { return UK[w] || w; });
  }

  // Split into sentences → words; mark stop words, negated words and synonyms
  function wordsOf(text) {
    var out = [];
    normalise(text).split(/[.!?;:\n]+/).forEach(function (sent, si) {
      var words = sent.match(/[a-z][a-z'\-]*/g) || [], neg = 0;
      words.forEach(function (w) {
        w = w.replace(/'s$/, '').replace(/^-+|-+$/g, '');
        if (NEG.indexOf(w) > -1) { neg = 2; out.push({ w: w, stop: true, s: si }); return; }
        var isStop = STOP.indexOf(w) > -1 || w.length < 3;
        if (!isStop && SYN[w]) w = SYN[w];
        out.push({ w: w, stop: isStop, neg: neg > 0 && !isStop, s: si });
        if (!isStop) neg = Math.max(0, neg - 1);
      });
      out.push({ w: '|', stop: true, s: si }); // sentence boundary
    });
    return out;
  }

  function extract(text, title) {
    var body = wordsOf(text), head = title ? wordsOf(title) : [], scores = {}, kinds = {}, show = {};
    var add = function (term, st, wgt, kind) {
      if (!scores[st]) { scores[st] = 0; kinds[st] = kind; show[st] = term; }
      scores[st] += wgt; if (kind === 'phrase') kinds[st] = 'phrase';
    };
    // 6a. Known domain phrases (matched on the normalised text, title counts double)
    var flat = ' ' + normalise((title ? title + ' ' + title + ' . ' : '') + text).replace(/[^a-z\- ]+/g, ' ').replace(/\s+/g, ' ') + ' ';
    var phraseHits = [];
    Object.keys(PHRASES).forEach(function (area) {
      PHRASES[area].forEach(function (p) {
        var n = flat.split(' ' + p + ' ').length - 1;
        if (n) { add(p, p, 3 * n, 'phrase'); phraseHits.push({ phrase: p, area: area, count: n }); }
      });
    });
    // 6b + 7. Single words and RAKE candidate phrases
    function scan(list, boost) {
      var run = [], freq = {}, deg = {};
      var flush = function () {
        if (run.length > 1 && run.length <= 3) {
          var ph = run.map(function (x) { return x.w; }).join(' ');
          run.forEach(function (x) { deg[x.w] = (deg[x.w] || 0) + run.length - 1; });
          add(ph, run.map(function (x) { return stem(x.w); }).join(' '), 0, 'rake');
          (scan.cands = scan.cands || []).push({ ph: ph, words: run.map(function (x) { return x.w; }), boost: boost });
        }
        run = [];
      };
      list.forEach(function (x) {
        if (x.stop || x.neg) { flush(); return; }
        if (run.length && run[run.length - 1].w === x.w) return; // "spaza shop" → "business business" counts once
        freq[x.w] = (freq[x.w] || 0) + 1;
        var pos = boost * (x.s === 0 ? 1.3 : 1), spec = GENERIC[x.w] || 1;
        add(x.w, stem(x.w), pos * spec, 'word');
        run.push(x);
      });
      flush();
      // RAKE score: sum over words of (degree + frequency) / frequency
      (scan.cands || []).forEach(function (c) {
        var r = c.words.reduce(function (a, w) { return a + ((deg[w] || 0) + freq[w]) / freq[w]; }, 0);
        scores[c.words.map(stem).join(' ')] += 0.4 * r * c.boost;
      });
      scan.cands = [];
    }
    scan(body, 1);
    if (head.length) scan(head, 2);

    var list = Object.keys(scores).filter(function (k) { return scores[k] > 0; }).map(function (k) {
      return { term: show[k], stem: k, weight: Math.round(scores[k] * 100) / 100, kind: kinds[k] };
    }).sort(function (a, b) { return b.weight - a.weight || (b.kind === 'phrase') - (a.kind === 'phrase'); });
    var seen = {};
    list = list.filter(function (k) { var key = k.term.replace(/-/g, ' '); if (seen[key]) return false; seen[key] = 1; return true; });
    var top = list.slice(0, 40);
    // stems of words used OUTSIDE the matched domain phrases ("learning" in "machine learning" is not education)
    var rest = flat; phraseHits.forEach(function (p) { rest = rest.split(' ' + p.phrase + ' ').join(' | '); });
    var free = [];
    wordsOf(rest).forEach(function (x) { if (!x.stop && !x.neg) { var st = stem(x.w); if (free.indexOf(st) < 0) free.push(st); } });
    // every word stem inside the top terms, for matching single-word vocabularies
    var stems = [];
    top.forEach(function (k) { k.stem.split(' ').forEach(function (s) { if (stems.indexOf(s) < 0) stems.push(s); }); });
    return { keywords: top, top: top.map(function (k) { return k.term; }), stems: stems, free: free, phrases: phraseHits };
  }

  window.Keywords = { extract: extract, normalise: normalise, stem: stem, PHRASES: PHRASES };
})();
