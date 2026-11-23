/* Public "Overview dashboard" — open to visitors, no sign-in.
   Shows impact totals and a 3-stage progress strip for the chosen period, finished solutions and submissions by Area of Interest.
   Replace SAMPLE data with your public API (no personal details are shown here). */
(function () {
  'use strict';
  var U = UI, $ = function (id) { return document.getElementById(id); };
  var d = function (n) { return new Date(Date.now() + n * U.DAY); };
  var html = document.documentElement;

  /* Areas of Interest, each with a fixed colour (light, dark). Colour follows the area, never its rank.
     Order and colours are the validated categorical palette; the last two use neutral greys. */
  var AREAS = [
    ['Software and Web Development', '#2a78d6', '#3987e5'],
    ['Data Science and Machine Learning', '#eb6834', '#d95926'],
    ['IoT and Embedded Systems', '#1baf7a', '#199e70'],
    ['Environmental Systems and Water', '#eda100', '#c98500'],
    ['Renewable Energy and Sustainability', '#e87ba4', '#d55181'],
    ['Health and Community Wellbeing', '#008300', '#0ca30c'],
    ['Education and Skill Development', '#6250d6', '#9085e9'],
    ['Entrepreneurship and Business Support', '#e34948', '#e66767'],
    ['Design, Media and Communications', '#64748b', '#94a3b8'],
    ['Research', '#a8b3c4', '#64748b']
  ];

  /* ---------- Sample data (sub = date the challenge was submitted) ---------- */
  var D = function (s) { var p = s.split('-'); return new Date(+p[0], p[1] - 1, +p[2]); };
  var CH = [
    { title: 'Campus recycling initiative', area: 6, status: 'Completed', sub: D('2026-07-21'), org: 'University of Zululand', done: d(-12), supervisor: 'Prof Kavitha Naidoo', team: 3,
      summary: 'Sorting stations and a weekly collection route for four residences. Recycled volume rose from 0.4 to 1.6 tonnes a month.' },
    { title: 'Student dropout early-warning dashboard', area: 0, status: 'In Progress', sub: D('2026-08-04'), org: 'University of Zululand', team: 3 },
    { title: 'Township storytelling and publicity drive', area: 7, status: 'Unallocated', sub: D('2026-10-14'), org: 'BET Media' },
    { title: 'Library seat occupancy sensor prototype', area: 2, status: 'Unallocated', sub: D('2026-10-14'), org: 'University of Zululand' },
    { title: 'Solar lighting for night markets', area: 4, status: 'Unallocated', sub: D('2026-10-27'), org: 'uMhlathuze Municipality' },
    { title: 'Clinic queue SMS updates', area: 5, status: 'Unallocated', sub: D('2026-11-03'), org: 'Richards Bay Clinic Trust' },
    { title: 'Rooftop solar feasibility study', area: 4, status: 'Unallocated', sub: D('2026-11-11'), org: 'Mangosuthu University of Technology' },
    { title: 'IT help-desk FAQ chatbot', area: 0, status: 'Submitted', sub: D('2026-11-18'), org: 'University of Zululand' },
    { title: 'Solar-powered phone charging kiosk', area: 4, status: 'Completed', sub: D('2026-02-10'), org: 'uMhlathuze Municipality', done: d(-140), supervisor: 'Prof Kavitha Naidoo', team: 2,
      summary: 'A kiosk with four charging bays powered by a 200 W panel, now running at the taxi rank.' },
    { title: 'Postgraduate research data repository', area: 9, status: 'Completed', sub: D('2026-01-27'), org: 'University of Zululand', done: d(-160), supervisor: 'Prof Anika Pillay', team: 2,
      summary: 'A searchable repository with consistent metadata for 320 postgraduate datasets.' },
    { title: 'Cafeteria food-waste reduction study', area: 3, status: 'Completed', sub: D('2026-02-24'), org: 'University of Zululand', done: d(-150), supervisor: 'Dr Sipho Ndlovu', team: 1,
      summary: 'Portion and menu changes that cut plate waste by 27% over six weeks.' },
    { title: 'Exam venue capacity optimiser', area: 1, status: 'Completed', sub: D('2026-01-20'), org: 'Mangosuthu University of Technology', done: d(-175), supervisor: 'Dr Sipho Ndlovu', team: 3,
      summary: 'A scheduling model that fits exam sessions into 18% fewer venues without clashes.' },
    { title: 'Small-business bookkeeping workshops', area: 7, status: 'Completed', sub: D('2026-02-03'), org: 'BET Media', done: d(-170), supervisor: 'Mr Bongani Sithole', team: 2,
      summary: 'Six workshops for 48 informal traders, with a simple cash-book template in isiZulu and English.' },
    { title: 'Water-leak detection for residences', area: 3, status: 'In Progress', sub: D('2026-03-17'), org: 'University of Zululand', team: 2 },
    { title: 'Community radio podcast series', area: 8, status: 'Completed', sub: D('2026-02-10'), org: 'BET Media', done: d(-165), supervisor: 'Dr Lindiwe Mabaso', team: 2,
      summary: 'Ten episodes on local enterprise, with 2,400 listens in the first month.' },
    { title: 'Township Wi-Fi hotspot map', area: 0, status: 'Completed', sub: D('2025-11-12'), org: 'uMhlathuze Municipality', done: d(-200), supervisor: 'Dr Sipho Ndlovu', team: 2,
      summary: 'A public map of 64 free Wi-Fi points, updated by residents through a simple form.' },
    { title: 'Rainwater harvesting for crèches', area: 3, status: 'Completed', sub: D('2025-12-02'), org: 'Richards Bay Clinic Trust', done: d(-190), supervisor: 'Prof Kavitha Naidoo', team: 3,
      summary: 'Gutter and tank kits for five crèches, each storing about 5,000 litres for dry months.' }
  ];
  var NOTES = [
    { kind: 'meeting', from: 'DCC', text: 'Project showcase day · ' + U.meetWhen({ date: U.workday(5), start: '10:00', mins: 120 }) + ' · Lab DC-001. Everyone welcome.', ago: 0, unread: true },
    { kind: 'update', from: 'DCC', text: 'Challenge submissions for this semester close in 10 days.', ago: 1, unread: true },
    { kind: 'update', from: 'DCC', text: '“Campus recycling initiative” has been completed and verified.', ago: 12, unread: false }
  ];

  var q = '';
  // Date range comes from the shared calendar (UI.rangeInit); default: 1 January this year to today
  var inPeriod = function (c) { return U.inRange(c.sub); };
  var dark = function () { return html.classList.contains('dark'); };
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };

  /* ---------- Icons for the summary cards ---------- */
  var ICON = {
    layers: '<path d="m12 3 9 5-9 5-9-5 9-5z"/><path d="m3 13 9 5 9-5"/>',
    check: '<circle cx="12" cy="12" r="8.5"/><path d="m8.5 12.2 2.4 2.4 4.6-4.8"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    pending: '<circle cx="12" cy="12" r="8.5" stroke-dasharray="2.6 2.6"/>',
    up: '<path d="M7 17 17 7M9 7h8v8"/>',
    org: '<path d="M4 20V6l8-3 8 3v14"/><path d="M9 20v-5h6v5M8 9h.01M12 9h.01M16 9h.01M8 12h.01M16 12h.01"/>',
    people: '<circle cx="9" cy="8" r="3.2"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><path d="M16 5.2a3 3 0 0 1 0 5.6M18 14.2a5.5 5.5 0 0 1 2.5 4.8"/>'
  };
  var svg = function (k, cls) { return '<svg class="' + cls + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICON[k] + '</svg>'; };

  /* Public status journey: internal states are merged into three plain stages */
  var STAGES = [
    { key: 'review', label: 'Under review', color: '#8da2f5', dark: '#7b90ea', of: ['Submitted', 'Under Review', 'Pending Information', 'Approved', 'Unallocated'] },
    { key: 'prog', label: 'In progress', color: '#2b4de0', dark: '#5b7cf0', of: ['Allocated', 'In Progress', 'Pending Verification'] },
    { key: 'done', label: 'Completed', color: '#14a28c', dark: '#2cbfa6', of: ['Completed'] }
  ];
  var CARD = 'rounded-xl border border-slate-200 bg-white px-4 py-3.5 shadow-xs dark:border-[#1f2a44] dark:bg-[#111a2e]';

  function kpi(label, n, note, icon, tone) {
    return '<div class="' + CARD + '">' +
      '<div class="flex items-start justify-between gap-3"><span class="text-[13.5px] text-slate-600 dark:text-slate-300">' + label + '</span>' +
      '<span class="flex size-9 shrink-0 items-center justify-center rounded-lg ' + tone + '">' + svg(icon, 'size-5') + '</span></div>' +
      '<div class="kpi-num -mt-1 text-[28px] leading-none font-bold text-slate-900 tabular-nums dark:text-white">' + pad(n) + '</div>' +
      '<div class="mt-2.5 truncate text-[12px] text-slate-500 dark:text-slate-400">' + note + '</div></div>';
  }

  /* "Challenges received" card: total plus a 3-stage progress strip */
  function journey(list) {
    var total = list.length, parts = STAGES.map(function (s) {
      return { s: s, n: list.filter(function (c) { return s.of.indexOf(c.status) > -1; }).length };
    });
    var col = function (s) { return dark() ? s.dark : s.color; };
    var bar = parts.filter(function (p) { return p.n; }).map(function (p) {
      return '<span class="h-full first:rounded-l-full last:rounded-r-full" style="flex:' + p.n + ';background:' + col(p.s) + '" data-tip="' + p.s.label + ': ' + p.n + ' of ' + total + '"></span>';
    }).join('');
    return '<div class="' + CARD + '">' +
      '<div class="flex items-start justify-between gap-3"><span class="text-[13.5px] text-slate-600 dark:text-slate-300">Challenges received</span>' +
      '<span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">' + svg('layers', 'size-5') + '</span></div>' +
      '<div class="kpi-num -mt-1 text-[28px] leading-none font-bold text-slate-900 tabular-nums dark:text-white">' + pad(total) + '</div>' +
      '<div class="mt-2.5 flex h-2 gap-[2px]" role="img" aria-label="' + parts.map(function (p) { return p.s.label + ' ' + p.n; }).join(', ') + '">' + (bar || '<span class="h-full flex-1 rounded-full bg-slate-200"></span>') + '</div>' +
      '<div class="mt-1.5 flex flex-wrap gap-x-3 text-[11.5px] text-slate-500 dark:text-slate-400">' + parts.map(function (p) {
        return '<span class="inline-flex items-center gap-1"><i class="size-2 rounded-full" style="background:' + col(p.s) + '"></i>' + p.s.label + ' <b class="font-semibold text-slate-700 tabular-nums dark:text-slate-200">' + p.n + '</b></span>';
      }).join('') + '</div></div>';
  }

  function render() {
    Charts.reset();
    var list = CH.filter(inPeriod), count = function (s) { return list.filter(function (c) { return c.status === s; }).length; };
    var match = function (c) { return !q || (c.title + ' ' + c.org + ' ' + AREAS[c.area][0]).toLowerCase().indexOf(q) > -1; };
    var solved = list.filter(function (c) { return c.status === 'Completed' && match(c); }).sort(function (a, b) { return b.done - a.done; });
    var done = list.filter(function (c) { return c.status === 'Completed'; });
    var recent = done.filter(function (c) { return Date.now() - c.done <= 30 * U.DAY; }).length;
    var orgs = list.map(function (c) { return c.org; }).filter(function (o, i, a) { return a.indexOf(o) === i; }).length;
    var active = list.filter(function (c) { return c.team && (c.status === 'Completed' || c.status === 'In Progress'); });
    var students = active.reduce(function (s, c) { return s + c.team; }, 0), teams = active.length;
    var card = 'flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs dark:border-[#1f2a44] dark:bg-[#111a2e]';

    $('content').innerHTML =
      '<section aria-label="Impact summary" class="grid shrink-0 grid-cols-2 gap-4 lg:grid-cols-4">' +
        kpi('Solutions delivered', done.length, recent ? '+' + recent + ' in the last 30 days' : 'Completed and verified', 'check', 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400') +
        kpi('Organisations served', orgs, 'Submitted at least one challenge', 'org', 'bg-sky-50 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400') +
        kpi('Students involved', students, 'On ' + teams + ' project team' + (teams === 1 ? '' : 's'), 'people', 'bg-violet-50 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400') +
        journey(list) +
      '</section>' +
      '<div class="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[1.2fr_1fr]">' +
        '<section class="' + card + '" aria-labelledby="h-sol">' +
          '<div class="flex shrink-0 items-center gap-3 border-b border-slate-200 px-5 py-3.5 dark:border-[#1f2a44]"><h2 id="h-sol" class="text-[17px] font-bold">Previous Solutions</h2>' +
            (solved.length ? '<span class="cnt dark:bg-[#1a2540] dark:text-slate-300">' + solved.length + '</span>' : '') + '</div>' +
          '<div class="panel-b px-5 py-1" data-fit>' + (solved.map(function (c, i) {
            return '<div class="sol flex items-center gap-4 border-b border-slate-100 py-3 last:border-b-0 dark:border-[#1a2540]" data-row>' +
              '<i class="size-2.5 shrink-0 rounded-full" style="background:' + AREAS[c.area][dark() ? 2 : 1] + '" title="' + U.esc(AREAS[c.area][0]) + '"></i>' +
              '<div class="min-w-0 flex-1"><div class="truncate text-[14.5px] font-semibold text-slate-900 dark:text-slate-100">' + U.esc(c.title) + '</div>' +
              '<div class="truncate text-[12.5px] text-slate-500 dark:text-slate-400">' + U.esc(c.org) + ' · completed ' + U.fmt(c.done) + '</div></div>' +
              '<button data-sol="' + CH.indexOf(c) + '" class="btn btn-sm shrink-0 dark:border-[#2a3858] dark:bg-[#16213a] dark:text-slate-100 dark:hover:bg-[#1a2540]">View more</button></div>';
          }).join('') || '<p class="py-10 text-center text-sm text-slate-500 dark:text-slate-400">' + (q ? 'No solutions match your search.' : 'No solutions completed in this date range.') + '</p>') + '</div>' +
        '</section>' +
        '<section class="' + card + '" aria-labelledby="h-area">' +
          '<div class="shrink-0 px-5 pt-3.5"><h2 id="h-area" class="text-[17px] font-bold">Submitted by area of interest</h2></div>' +
          '<div class="min-h-0 flex-1 px-4 pt-2 pb-3"><div id="ch-area" class="h-full" aria-label="Challenges submitted by area of interest"></div></div>' +
        '</section>' +
      '</div>';

    Charts.draw('ch-area', function (el) {
      Charts.pie(el, AREAS.map(function (a, i) { return { label: a[0], value: list.filter(function (c) { return c.area === i; }).length, color: a[dark() ? 2 : 1] }; }),
        { centerLabel: 'Submissions', layout: 'stack', legendAll: true, showPct: false });
    });
    U.fitLists();
  }

  /* ---------- Solution details ---------- */
  function showSolution(c) {
    var row = function (k, v) { return '<div class="flex gap-3 py-1.5"><dt class="w-28 shrink-0 text-slate-500">' + k + '</dt><dd class="min-w-0 font-medium text-slate-800">' + v + '</dd></div>'; };
    U.modal(c.title,
      '<p class="leading-relaxed text-slate-700">' + U.esc(c.summary) + '</p>' +
      '<dl class="mt-3 divide-y divide-slate-100 text-[13px]">' +
        row('Area of interest', '<span class="inline-flex items-center gap-2"><i class="size-2.5 rounded-full" style="background:' + AREAS[c.area][1] + '"></i>' + U.esc(AREAS[c.area][0]) + '</span>') +
        row('Organisation', U.esc(c.org)) + row('Supervisor', U.esc(c.supervisor)) + row('Student team', c.team + ' student' + (c.team > 1 ? 's' : '')) + row('Completed', U.fmt(c.done)) +
      '</dl>', [{ label: 'Close' }]);
  }

  /* ---------- Controls ---------- */
  $('content').addEventListener('click', function (e) { var b = e.target.closest('[data-sol]'); if (b) showSolution(CH[+b.dataset.sol]); });
  $('range-slot').outerHTML = U.rangeHTML();
  U.rangeInit({ preset: 'year', kinds: [{ key: 'sub', label: 'Submitted', color: '#f97316' }],
    events: function () { return CH.map(function (c) { return { date: c.sub, kind: 'sub', title: c.title }; }); }, onChange: function () { render(); } });
  $('search').addEventListener('input', function () { q = this.value.trim().toLowerCase(); render(); });
  // ⌘K / Ctrl K focuses search; show the right key for the platform
  var mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  $('kbd').textContent = mac ? '⌘ K' : 'Ctrl K';
  document.addEventListener('keydown', function (e) { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); $('search').focus(); $('search').select(); } });
  // Light / dark mode
  var MOON = 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z', SUN = 'M12 4V2m0 20v-2m8-8h2M2 12h2m13.7-5.7 1.4-1.4M4.9 19.1l1.4-1.4m0-11.4L4.9 4.9m14.2 14.2-1.4-1.4M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0z';
  function paintTheme() {
    var on = dark();
    $('theme-icon').setAttribute('d', on ? SUN : MOON);
    $('theme').setAttribute('aria-label', on ? 'Switch to light mode' : 'Switch to dark mode');
    $('theme').setAttribute('aria-pressed', on ? 'true' : 'false');
  }
  $('theme').addEventListener('click', function () {
    html.classList.toggle('dark');
    try { localStorage.setItem('dcc-theme', dark() ? 'dark' : 'light'); } catch (e) {}
    paintTheme(); render();
  });

  U.notes(NOTES);
  paintTheme();
  // Backend mode (js/api.js): the visitors' figures come from the API (no sign-in needed)
  if (window.API && API.on()) {
    API.get('/public/overview').then(function (d) {
      CH = API.dates(d.challenges, ['sub', 'done']);
      CH.forEach(function (c) { if (c.team == null) c.team = 0; });
      render();
    }).catch(function (e) { API.fail(e); render(); });
  } else render();
})();
