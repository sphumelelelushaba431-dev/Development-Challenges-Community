/* Student dashboard — charts + challenges recommended by interest (Matching module).
   Replace the sample data with your API (e.g. GET /api/student/dashboard).
   Challenges assigned by a supervisor appear in My challenges straight away (no accept step). The student is told
   through a notification; "View details" shows the challenge title, description and the supervisor who added them.
   Students update progress and submit work.
   They cannot allocate, change MCDA weights or approve their own work. */
(function () {
  'use strict';
  var U = UI, d = function (n) { return new Date(Date.now() + n * U.DAY); };
  var ME = { name: 'Amahle Mthembu', initials: 'AM', meta: 'Student · DCC00002', interests: ['Design, Media & Communication', 'Data Science & Machine Learning'] };
  var ST = { 'Submitted': '#2563eb', 'Allocated': '#7c3aed', 'In Progress': '#f97316', 'Pending Verification': '#eab308', 'Completed': '#16a34a', 'Draft': '#cbd5e1' };

  var mine = [
    { id: 'DCC-000006', title: 'Library seat occupancy sensor prototype', status: 'In Progress', supervisor: 'Dr Sipho Ndlovu', due: d(40), pct: 0, history: [], assigned: d(0), team: ['Amahle Mthembu', 'Lwazi Dube'],
      desc: 'Students struggle to find free seats in the library during exams. Build a low-cost sensor prototype that detects whether a seat is occupied and shows live availability on a simple web page.' },
    { id: 'DCC-000001', title: 'Expansion of knowledge through communication', status: 'In Progress', supervisor: 'Dr Sipho Ndlovu', due: d(24), pct: 45,
      history: [{ at: d(-35), pct: 5 }, { at: d(-28), pct: 15 }, { at: d(-20), pct: 25 }, { at: d(-12), pct: 30 }, { at: d(-5), pct: 45 }], last: 'First campaign drafts shared with the reporter.' },
    { id: 'DCC-000003', title: 'Student dropout early-warning dashboard', status: 'Submitted', supervisor: 'Dr Sipho Ndlovu', due: d(50), pct: 0 },
    { id: 'DCC-000011', title: 'Postgraduate research data repository', status: 'Completed', supervisor: 'Prof Anika Pillay', due: d(-45), pct: 100 },
    { id: 'DCC-000025', title: 'Residence orientation video', status: 'Completed', supervisor: 'Dr Sipho Ndlovu', due: d(-80), pct: 100 },
    { id: 'DCC-000016', title: 'Exam venue capacity optimiser', status: 'Draft', supervisor: '—', due: d(80), pct: 0 }
  ];
  var available = [
    { id: 'DCC-000002', supervisor: 'Dr Sipho Ndlovu', title: 'Campus Wi-Fi dead-zone mapping', desc: 'Survey signal strength across campus and recommend access-point placement.', due: d(35) },
    { id: 'DCC-000017', supervisor: 'Dr Sipho Ndlovu', title: 'Township storytelling and publicity drive', desc: 'Local artists want help with storytelling and publicity for a township heritage festival.', due: d(62) },
    { id: 'DCC-000018', supervisor: 'Dr Lindiwe Mabaso', title: 'Community radio podcast series', desc: 'Produce a podcast series with the local community radio station about youth opportunities.', due: d(70) },
    { id: 'DCC-000022', supervisor: 'Prof Anika Pillay', request: 'pending', title: 'Campus gate traffic patterns', desc: 'Analyse traffic patterns at the campus gates during peak hours.', due: d(41) },
    { id: 'DCC-000014', supervisor: 'Prof Kavitha Naidoo', title: 'Water-leak detection for residences', desc: 'Prototype flow sensors that alert maintenance teams to leaks.', due: d(55) }
  ];
  var feedback = [['Dr Sipho Ndlovu', 'Good progress on DCC-000001 — please include audience numbers in the next update.', 2], ['Prof Anika Pillay', 'DCC-000011 verified and approved. Excellent documentation.', 30]];
  // Challenges allocated to me and completed by me per month (oldest → newest, 12 months)
  var TREND = { allocated: [0, 1, 0, 0, 1, 0, 1, 0, 1, 0, 1, 1], completed: [0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 1, 0] };
  var q = '', period = 6;
  var EVENTS = null;
  var inR = function (k) { return EVENTS.filter(function (e) { return e.kind === k && U.inRange(e.date); }).length; };

  U.shell({
    roleLabel: 'Student', name: ME.name, initials: ME.initials, meta: ME.meta, active: 'overview',
    profile: { id: 'DCC00002', title: 'Ms', email: 'amahle.mthembu@unizulu.ac.za', phone: '071 234 5678', org: 'University of Zululand', interest: 'Design, Media & Communication', address: '12 Mkhize Road, KwaDlangezwa, 3886', joined: '2026-02-14' }
  });

  // How well does each available challenge fit my interests? (same matching flow the supervisor uses)
  function fitFor(c) {
    if (c.fit != null) return { score: c.fit, via: '', stage: 'server' };   // backend mode: fit computed by the API's MCDA
    var m = Matching.matchInterests(c), best = 0, via = '';
    m.interests.forEach(function (x) { if (ME.interests.indexOf(x.interest) > -1 && x.score > best) { best = x.score; via = x.interest; } });
    return { score: Math.round(best * 100), via: via, stage: m.stage };
  }

  // Backend mode (js/api.js): load the dashboard from the API and send every action to it
  var live = window.API && API.on();
  function refresh() { return API.get('/dashboard/student').then(function (d) { API.dates(d.events, ['date']); apply(d); render(); }).catch(API.fail); }
  function call(p) { p.then(function (r) { U.toast(r.message || 'Saved.', 'ok'); refresh(); }).catch(API.fail); }
  function apply(d) {
    ME = d.me; EVENTS = d.events;
    mine = API.dates(d.mine, ['due', 'assigned']); mine.forEach(function (c) { API.dates(c.history, ['at']); });
    available = API.dates(d.available, ['due']);
    U.shell({ roleLabel: ME.roleLabel, name: ME.name, initials: ME.initials, meta: ME.meta, profile: ME.profile });
    U.serverNotes(d.notes, function (n) {
      var c = mine.filter(function (x) { return x.id === n.ref; })[0];
      return n.kind === 'assign' && c ? function () { showAssignment(c); } : null;
    });
  }

  var ORDER = ['Draft', 'Submitted', 'Allocated', 'In Progress', 'Pending Verification', 'Completed'];
  // "My challenges" shows the first 2 (work in progress first); "View more" opens the full list
  var FIRST = 2, MY_COLS = [['Challenge', 'minmax(0,1fr)'], ['Status', '150px'], ['Time left', '84px'], ['Action', '112px']];
  var RANK = ['In Progress', 'Allocated', 'Pending Verification', 'Submitted', 'Draft', 'Completed'];   // what needs you first, completed last
  var ordered = function (list) { return list.slice().sort(function (a, b) { return RANK.indexOf(a.status) - RANK.indexOf(b.status) || a.due - b.due; }); };
  function myRow(c) {
            var n = U.daysLeft(c.due), act = (c.status === 'In Progress' || c.status === 'Allocated') ? '<button data-act="progress" data-id="' + c.id + '" class="btn btn-primary btn-sm w-full">Update</button>'
              : '<button data-view="' + c.id + '" class="btn btn-sm w-full">View</button>';
            return [U.cell(c.title, c.id + (c.supervisor !== '—' ? ' · ' + U.esc(c.supervisor) : '')), U.badge(c.status), '<span class="tabular-nums ' + (n < 0 ? 'text-slate-400' : n <= 7 ? 'font-semibold text-red-600' : 'text-slate-700') + '">' + (n < 0 ? '—' : n + ' days') + '</span>', act];
  }
  function allMine() {
    U.modal('My challenges (' + mine.length + ')', '<div class="-my-2 flex flex-col">' + U.table(MY_COLS, ordered(mine).map(myRow)) + '</div>', [{ label: 'Close' }]);
    var root = document.getElementById('modal-root'), box = root.querySelector('[data-fit]'); if (box) box.removeAttribute('data-fit');
    var dlg = root.querySelector('[role=dialog]'); if (dlg) dlg.classList.replace('max-w-lg', 'max-w-3xl');
    root.addEventListener('click', function pick(e) {
      if (!e.target.closest('[data-view],[data-act]')) return;
      root.removeEventListener('click', pick); handle(e);
    });
  }

  // Opened from the "Assigned" notification: what the challenge is and who added you
  function showAssignment(c) {
    var sup = c.supervisor, ini = sup.replace(/^(Dr|Prof|Mr|Ms|Mrs)\s+/, '').split(' ').map(function (w) { return w[0]; }).join('').slice(0, 2);
    var mates = (c.team || []).filter(function (n) { return n !== ME.name; });
    U.modal('New assignment — ' + c.id,
      '<h4 class="text-[16px] font-bold text-brand-950">' + U.esc(c.title) + '</h4>' +
      '<p class="mt-1.5 text-[13.5px] leading-relaxed text-slate-700">' + U.esc(c.desc || 'No description provided.') + '</p>' +
      '<div class="mt-4 flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-2.5"><span class="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-950 text-[13px] font-bold text-white">' + U.esc(ini) + '</span>' +
        '<div class="min-w-0"><div class="text-[11.5px] font-semibold tracking-wide text-slate-500 uppercase">Added by your supervisor</div><div class="font-semibold text-slate-900">' + U.esc(sup) + '</div></div></div>' +
      '<dl class="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-[13px]">' +
        '<div><dt class="text-slate-500">Assigned</dt><dd class="font-medium">' + U.fmt(c.assigned || new Date()) + '</dd></div>' +
        '<div><dt class="text-slate-500">Deadline</dt><dd class="font-medium">' + U.fmt(c.due) + ' · ' + U.daysLeft(c.due) + ' days left</dd></div>' +
        (mates.length ? '<div class="col-span-2"><dt class="text-slate-500">Team</dt><dd class="font-medium">You, ' + U.esc(mates.join(', ')) + '</dd></div>' : '') +
      '</dl>',
      [{ label: 'Close' }, { label: 'Update progress', primary: true, onClick: function () { setTimeout(function () { var b = document.createElement('button'); b.dataset.act = 'progress'; b.dataset.id = c.id; handle({ target: b }); }, 0); } }]);
  }

  function render() {
    Charts.reset();
    var P = U.PAL, by = function (s) { return mine.filter(function (c) { return c.status === s; }); };
    var shown = mine.filter(function (c) { return !q || (c.id + ' ' + c.title).toLowerCase().indexOf(q) > -1; });
    var recs = available.filter(function (c) { return !q || (c.id + ' ' + c.title).toLowerCase().indexOf(q) > -1; }).map(function (c) { return { c: c, f: fitFor(c) }; }).filter(function (r) { return r.f.score > 0; }).sort(function (a, b) { return b.f.score - a.f.score; });
    var statuses = ORDER.filter(function (s) { return by(s).length; }), big = Math.max.apply(null, statuses.map(function (s) { return by(s).length; }));
    var work = mine.filter(function (c) { return ['Allocated', 'In Progress', 'Pending Verification'].indexOf(c.status) > -1; }).sort(function (a, b) { return a.due - b.due; });
    var next = work.filter(function (c) { return c.status !== 'Pending Verification'; })[0];

    document.getElementById('content').innerHTML =
      U.head(ME.name, 'Student dashboard', period) +
      U.kpis([
        ['My challenges', mine.filter(function (c) { return c.status !== 'Draft'; }).length, 'Across all statuses', P.blue, 'layers'],
        ['Pending verification', by('Pending Verification').length, '', P.purple, 'pending'],
        ['In progress', by('In Progress').length + by('Pending Verification').length, 'Being worked on', P.amber, 'clock'],
        ['Completed', by('Completed').length, 'Challenges delivered', P.teal, 'check']
      ]) +
      '<div class="dash-row grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr_1fr_1.2fr]">' +
        U.card({ id: 'st', title: 'My challenges by status', sub: mine.length + ' challenges in your workspace',
          body: U.bars(statuses.map(function (s) { var n = by(s).length; return { label: s, value: n, color: s === 'Completed' ? P.teal : n === big ? P.blue : P.light }; })) }) +
        U.card({ id: 'tr', title: 'Assigned vs completed', sub: 'Your challenge activity · ' + U.rangeLabel(), body: U.pieBox('ch-trend', 'Challenges allocated to you and completed') }) +
        U.card({ id: 'pr', title: 'My progress',
          body: U.pieBox('ch-myprog', 'Progress of my active challenges against the 100% target') +
            (next ? '<p class="note"><b>Next deadline: ' + U.esc(next.title) + '</b>' + U.daysLeft(next.due) + ' days left · ' + next.id + '</p>' : '') }) +
      '</div>' +
      '<div class="dash-row grid grid-cols-1 gap-4 lg:grid-cols-[1.08fr_1fr]" data-rowb>' +
        U.card({ id: 'my', title: 'My challenges', count: shown.length,
          body: U.table(MY_COLS, ordered(shown).slice(0, FIRST).map(myRow), 'No challenges yet.',
            shown.length > FIRST ? '<button data-more="my" class="view-more">View more (' + (shown.length - FIRST) + ')</button>' : '') }) +
        '<div class="flex min-h-0 flex-col gap-4">' +
          U.card({ id: 'rec', cls: 'flex-1', title: 'Recommended for you',
            body: U.list(recs.map(function (r) { return '<div class="min-w-0 flex-1">' + U.cell(r.c.title, r.c.id + ' · ' + U.esc(r.c.supervisor)) + '</div>' + U.dayChip(r.c.due) + reqBtn(r.c); }), 'No recommendations yet.') }) +
        '</div>' +
      '</div>';

    Charts.draw('ch-trend', function (el) { Charts.pie(el, [{ label: 'Assigned', value: inR('asg'), color: P.purple }, { label: 'Completed', value: inR('done'), color: P.teal }], { centerLabel: 'challenges' }); });
    // Bullet graph: grey bands = 0–50% / 50–80% / 80–100%, bar = my progress, black tick = 100% target
    Charts.draw('ch-myprog', function (el) { Charts.bullet(el, work.map(function (c) { return { label: c.title, value: c.pct, target: 100, max: 100, color: c.pct >= 100 ? P.teal : P.blue, tip: c.id + ' · ' + c.title + ': ' + c.pct + '% · ' + c.status }; }), { max: 100, bands: [0.5, 0.8], fmt: function (v) { return v + '%'; } }); });
    U.fitLists();
  }

  // Ask the supervisor to work on a recommended challenge; the supervisor accepts or declines
  function reqBtn(c) {
    if (c.request === 'pending') return '<span class="w-24 shrink-0 text-center">' + U.badge('Requested') + '</span>';
    if (c.request === 'declined') return '<span class="w-24 shrink-0 text-center">' + U.badge('Declined') + '</span>';
    return '<button data-req="' + c.id + '" class="btn btn-sm w-24 shrink-0">Request</button>';
  }
  function requestModal(c) {
    U.modal('Request to work on ' + c.id,
      '<p class="mb-1 font-semibold">' + U.esc(c.title) + '</p><p class="mb-2 text-[13px] text-slate-600">' + U.esc(c.desc) + '</p>' +
      '<dl class="mb-3 space-y-1 text-[13px]"><div class="flex gap-3"><dt class="w-24 text-slate-500">Supervisor</dt><dd>' + U.esc(c.supervisor) + '</dd></div><div class="flex gap-3"><dt class="w-24 text-slate-500">Deadline</dt><dd>' + U.fmt(c.due) + '</dd></div></dl>' +
      '<label for="rq-msg" class="label">Message to the supervisor</label><textarea id="rq-msg" rows="2" class="input"></textarea>',
      [{ label: 'Cancel' }, { label: 'Send request', primary: true, onClick: function () {
        if (live) return call(API.post('/requests', { challenge: c.id, message: document.getElementById('rq-msg').value.trim() }));
        c.request = 'pending'; render(); U.toast('Request sent to ' + c.supervisor + '. You will be notified of the decision.', 'ok');
      } }]);
  }
  document.getElementById('content').addEventListener('click', function (e) {
    var r = e.target.closest('[data-req]'); if (r) return requestModal(available.filter(function (c) { return c.id === r.dataset.req; })[0]);
    handle(e);
  });
  function handle(e) {
    if (e.target.closest('[data-more=my]')) return allMine();
    var v = e.target.closest('[data-view]');
    if (v) { var c = mine.filter(function (x) { return x.id === v.dataset.view; })[0];
      U.modal(c.id, '<p class="mb-2 font-semibold">' + U.esc(c.title) + '</p><dl class="space-y-1 text-[13px]"><div class="flex gap-3"><dt class="w-24 text-slate-500">Status</dt><dd>' + U.badge(c.status) + '</dd></div><div class="flex gap-3"><dt class="w-24 text-slate-500">Supervisor</dt><dd>' + U.esc(c.supervisor) + '</dd></div><div class="flex gap-3"><dt class="w-24 text-slate-500">Deadline</dt><dd>' + U.fmt(c.due) + '</dd></div><div class="flex gap-3"><dt class="w-24 text-slate-500">Progress</dt><dd>' + c.pct + '%</dd></div></dl>', [{ label: 'Close' }]); return; }
    var b = e.target.closest('[data-act]'); if (!b) return;
    var active = mine.filter(function (c) { return c.id === b.dataset.id; })[0] || mine.filter(function (c) { return c.status === 'In Progress'; })[0];
    if (active && !active.history) active.history = [];
    switch (b.dataset.act) {
      case 'progress':
        U.modal('Update progress — ' + active.id, '<label for="pct" class="label">Completion: <b id="pct-out">' + active.pct + '%</b></label><input id="pct" type="range" min="0" max="100" step="5" value="' + active.pct + '" class="w-full accent-brand-700" oninput="document.getElementById(\'pct-out\').textContent=this.value+\'%\'">' +
          '<label for="note" class="label mt-3">What did you complete? <span class="text-red-600">*</span></label><textarea id="note" rows="3" class="input"></textarea><span id="note-err" class="err"></span>', [{ label: 'Cancel' }, { label: 'Submit as complete', onClick: function () { if (live) return call(API.post('/challenges/' + active.id + '/submit-work')); active.status = 'Pending Verification'; active.pct = 100; render(); U.toast('Submitted — your supervisor will verify it.', 'ok'); } }, { label: 'Save update', primary: true, onClick: function () {
          var n = document.getElementById('note').value.trim(); if (n.length < 5) { document.getElementById('note-err').textContent = 'Describe your progress (5+ characters).'; return false; }
          if (live) return call(API.post('/challenges/' + active.id + '/progress', { pct: +document.getElementById('pct').value, note: n }));
          active.pct = +document.getElementById('pct').value; active.last = n; active.history.push({ at: new Date(), pct: active.pct }); render(); U.toast('Progress updated to ' + active.pct + '%.', 'ok'); } }]);
        break;
      case 'submitwork':
        U.modal('Submit completed work', '<p class="mb-3">Submit <b>' + U.esc(active.title) + '</b> for supervisor verification?</p><label for="final" class="label">Final report</label><input id="final" type="file" class="block w-full text-sm file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:font-semibold file:text-brand-800">', [{ label: 'Cancel' }, { label: 'Submit for verification', primary: true, onClick: function () {
          if (live) { var fd = new FormData(), fl = document.getElementById('final').files[0]; if (fl) fd.append('files', fl); return call(API.post('/challenges/' + active.id + '/submit-work', fd)); }
          active.status = 'Pending Verification'; active.pct = 100; render(); U.toast('Submitted — your supervisor will verify it.', 'ok'); } }]);
        break;
    }
  }
  document.getElementById('search').addEventListener('input', function () { q = this.value.trim().toLowerCase(); render(); });
  var mineTitles = mine.map(function (c) { return c.title; });
  EVENTS = U.monthlyEvents(TREND.allocated, 'asg', mineTitles).concat(U.monthlyEvents(TREND.completed, 'done', mine.filter(function (c) { return c.status === 'Completed'; }).map(function (c) { return c.title; }).concat(mineTitles)));
  U.rangeInit({ preset: '6m', presets: [['6m', 'Last 6 months'], ['year', 'This year'], ['sem', 'This semester'], ['last', 'Last semester'], ['all', 'All time']], kinds: [{ key: 'asg', label: 'Assigned', color: U.PAL.purple }, { key: 'done', label: 'Completed', color: U.PAL.teal }], events: function () { return EVENTS; }, onChange: render });
  U.notes([
    { kind: 'meeting', from: 'Dr Sipho Ndlovu', about: 'DCC-000001', text: 'Meeting: Progress review · ' + U.meetWhen({ date: U.workday(1), start: '10:00', mins: 60 }) + ' · Lab DC-002 (in person).', ago: 0, unread: true,
      open: function () { U.meetingDetails({ title: 'Progress review', challenge: 'Expansion of knowledge through communication (DCC-000001)', date: U.workday(1), start: '10:00', mins: 60, venue: 'Lab DC-002', organiser: 'Dr Sipho Ndlovu', people: ['Amahle Mthembu', 'Sbongokuhle Msomi'], agenda: 'Audience numbers and next milestones.' }); } },
    { kind: 'assign', from: 'Dr Sipho Ndlovu', about: 'DCC-000006', text: 'You have been added to “Library seat occupancy sensor prototype”.', ago: 0, unread: true, open: function () { showAssignment(mine.filter(function (c) { return c.id === 'DCC-000006'; })[0]); } }
  ].concat(feedback.map(function (f) { return { kind: 'message', from: f[0], text: f[1], ago: f[2], unread: f[2] < 7 }; })));
  if (live) API.boot('student').then(function (d) { apply(d); render(); }).catch(function (e) { API.fail(e); render(); });
  else render();
})();
