/* Workspace — the single post-login page.
   Top nav buttons are role-gated; clicking one fills the clear area below with that
   feature's lists, details and inline forms. Reuses UI helpers and the API client.
   Works in demo mode (js/config.js → demo:true, sample data) and live mode (Flask API). */
(function () {
  'use strict';
  var U = UI;
  var live = window.API && API.on();
  var d = function (n) { return new Date(Date.now() + n * U.DAY); };

  var role = null, ME = null, D = null, MEET = null;
  var active = null;          // active nav button key
  var sel = null;             // {kind, id} — the inline form currently open
  var q = '';                 // search filter

  /* ---------- role → allowed buttons ---------- */
  var NAV = {
    student:        [['solve', 'Solve', 'check'], ['meetings', 'Meetings', 'calendar']],
    representative: [['submit', 'Submit', 'inbox'], ['solve', 'Solve', 'check'], ['meetings', 'Meetings', 'calendar']],
    supervisor:     [['submit', 'Submit', 'inbox'], ['assign', 'Assign', 'share'], ['review', 'Review', 'report'], ['verify', 'Verify', 'check'], ['meetings', 'Schedule meetings', 'calendar']],
    admin:          [['approvals', 'Approvals', 'user'], ['meetings', 'Meetings', 'calendar']]
  };
  var TITLES = {
    solve: 'Solve', submit: 'Submit a challenge', assign: 'Assign challenges', review: 'Review submissions',
    verify: 'Verify completed work', meetings: 'Meetings', approvals: 'Account approvals'
  };

  /* ---------- small helpers ---------- */
  var esc = U.esc;
  var val = function (id) { var e = document.getElementById(id); return e ? e.value.trim() : ''; };
  var raw = function (id) { var e = document.getElementById(id); return e ? e.value : ''; };
  var setErr = function (id, msg) { var e = document.getElementById(id + '-err'); if (e) e.textContent = msg || ''; var f = document.getElementById(id); if (f) f.classList.toggle('invalid', !!msg); return !msg; };
  var clearErrs = function () { document.querySelectorAll('#content .err').forEach(function (e) { e.textContent = ''; }); document.querySelectorAll('#content .invalid').forEach(function (e) { e.classList.remove('invalid'); }); };
  var match = function (c) { return !q || ((c.id || '') + ' ' + (c.title || '') + ' ' + (c.name || '')).toLowerCase().indexOf(q) > -1; };
  var findCh = function (id) {
    var pools = [D.mine, D.available, D.subs, D.assigned, D.challenges];
    for (var i = 0; i < pools.length; i++) { if (!Array.isArray(pools[i])) continue; var f = pools[i].filter(function (c) { return c.id === id; })[0]; if (f) return f; }
    return null;
  };
  var dueCell = function (due) { var n = U.daysLeft(due); return '<span class="tabular-nums ' + (n < 0 ? 'text-slate-400' : n <= 7 ? 'font-semibold text-red-600' : 'text-slate-700') + '">' + (n < 0 ? '—' : n + ' days') + '</span>'; };
  var btn = function (label, kind, action, style) {
    return '<button data-do="' + kind + '"' + (action ? ' data-action="' + action + '"' : '') + ' class="btn py-2 ' + (style === 'primary' ? 'btn-primary' : style === 'danger' ? 'border-red-200 text-red-700 hover:bg-red-50' : '') + '">' + label + '</button>';
  };
  var cancelBtn = '<button data-cancel class="btn py-2">Cancel</button>';
  var formCard = function (title, inner, actions) {
    return U.card({ id: 'wsform', title: title, body: '<div class="mt-2">' + inner + '</div><div class="ws-form-actions">' + actions + '</div>' });
  };
  var panelHead = function (key, desc) {
    var t = TITLES[key] || 'Workspace';
    var pt = document.getElementById('page-title'); if (pt) { pt.textContent = t; document.title = t + ' — Development Challenges Community'; }
    return '<div class="ws-head"><h2>' + esc(t) + '</h2><p>' + desc + '</p></div>';
  };
  var shellCfg = function () { return { roleLabel: ME.roleLabel, name: ME.name, initials: ME.initials, meta: ME.meta, profile: ME.profile }; };

  /* Normalise an MCDA result (live or demo) to {outcome, ranked:[{student,score,rec}], recommended:[]} */
  function resultFor(code) {
    if (live) {
      var r = (D.results || {})[code]; if (!r) return null;
      var ranked = r.ranked.map(function (x) { return { student: { name: x.name, available: x.available, load: x.load, cap: x.cap }, score: x.score, rec: x.recommended }; });
      return { outcome: r.outcome, ranked: ranked, recommended: ranked.filter(function (x) { return x.rec; }) };
    }
    var c = findCh(code); if (!c) return null;
    if (!D._res) D._res = {};
    if (!D._res[code]) D._res[code] = Matching.run(c, D.students || []);
    var m = D._res[code];
    return { outcome: m.outcome, ranked: m.ranked, recommended: m.recommended };
  }
  function fitFor(c) {
    if (c.fit != null) return c.fit;
    var m = Matching.matchInterests(c), best = 0;
    m.interests.forEach(function (x) { if ((ME.interests || []).indexOf(x.interest) > -1 && x.score > best) best = x.score; });
    return Math.round(best * 100);
  }

  /* ---------- boot ---------- */
  function demoRole() {
    var url = new URLSearchParams(location.search).get('role');
    if (url && NAV[url]) return url;
    try { var r = localStorage.getItem('dcc-demo-role'); if (r && NAV[r]) return r; } catch (e) {}
    return 'student';
  }
  function start() {
    if (live) {
      var u = API.user();
      if (!API.token() || !u) { location.href = 'login.html'; return; }
      role = u.role;
      API.boot(role).then(function (data) { D = data; ME = D.me; normalize(); U.shell(shellCfg()); U.serverNotes(D.notes, noteOpener); renderNav(); renderEmpty(); }).catch(API.fail);
    } else {
      role = demoRole(); D = demoData(role); ME = D.me;
      U.shell(shellCfg()); U.notes(demoNotes()); renderNav(); renderEmpty();
    }
  }
  function normalize() {
    API.dates(D.events, ['date']);
    if (role === 'student') { API.dates(D.mine, ['due', 'assigned']); (D.mine || []).forEach(function (c) { API.dates(c.history, ['at']); }); API.dates(D.available, ['due']); }
    if (role === 'representative') { API.dates(D.subs, ['due']); API.dates(D.assigned, ['due']); }
    if (role === 'supervisor') { API.dates(D.challenges, ['due']); }
    if (role === 'admin') { API.dates(D.pending, ['when']); }
  }
  function noteOpener(n) {
    if (role === 'student' && n.kind === 'assign') return function () { setActive('solve'); };
    if (role === 'supervisor' && n.kind === 'alert') return function () { setActive('assign'); };
    return null;
  }
  function reload() {
    if (!live) { renderPanel(); return Promise.resolve(); }
    return API.get('/dashboard/' + role).then(function (data) {
      D = data; ME = D.me; normalize(); U.shell(shellCfg()); U.serverNotes(D.notes, noteOpener);
      if (active === 'meetings') return API.get('/meetings').then(function (m) { MEET = m; renderPanel(); });
      renderPanel();
    }).catch(API.fail);
  }
  function done(msg) { U.toast(msg || 'Saved.', 'ok'); sel = null; reload(); }

  /* ---------- nav ---------- */
  function renderNav() {
    var nav = document.getElementById('ws-nav');
    nav.innerHTML = (NAV[role] || []).map(function (b) {
      return '<button class="ws-btn' + (active === b[0] ? ' active' : '') + '" data-nav="' + b[0] + '" aria-pressed="' + (active === b[0]) + '">' + U.icon(b[2], 'size-4.5') + esc(b[1]) + '</button>';
    }).join('');
  }
  function setActive(key) {
    active = key; sel = null; renderNav();
    if (key === 'meetings') { openMeetings(); return; }
    renderPanel();
  }
  function openMeetings() {
    if (live) { API.get('/meetings').then(function (m) { MEET = m; renderPanel(); }).catch(API.fail); }
    else { MEET = demoMeetings(); renderPanel(); }
  }
  document.getElementById('ws-nav').addEventListener('click', function (e) {
    var b = e.target.closest('[data-nav]'); if (b) setActive(b.dataset.nav);
  });

  /* ---------- empty prompt ---------- */
  function renderEmpty() {
    var pt = document.getElementById('page-title'); if (pt) { pt.textContent = 'Workspace'; document.title = 'Workspace — Development Challenges Community'; }
    var hints = {
      student: 'Update progress on your assigned challenges, submit completed work, or request to solve a new challenge.',
      representative: 'Submit a challenge, respond to information requests, and track the work assigned to you.',
      supervisor: 'Submit challenges, assign students, review submissions, verify completed work and schedule meetings.',
      admin: 'Approve new accounts, unlock locked accounts and keep an eye on system activity.'
    };
    document.getElementById('content').innerHTML =
      '<div class="ws-empty"><span class="ic">' + U.icon('grid', 'size-5') + '</span>' +
      '<h2>Welcome, ' + esc(ME.name) + '</h2>' +
      '<p>Choose an action above to get started. ' + esc(hints[role] || '') + '</p></div>';
  }

  /* ---------- panel dispatch ---------- */
  function renderPanel() {
    if (!active) return renderEmpty();
    var html = '';
    if (role === 'student' && active === 'solve') html = studentSolve();
    else if (role === 'representative' && active === 'submit') html = repSubmit();
    else if (role === 'representative' && active === 'solve') html = repSolve();
    else if (role === 'supervisor' && active === 'submit') html = supSubmit();
    else if (role === 'supervisor' && active === 'assign') html = supAssign();
    else if (role === 'supervisor' && active === 'review') html = supReview();
    else if (role === 'supervisor' && active === 'verify') html = supVerify();
    else if (role === 'admin' && active === 'approvals') html = adminApprovals();
    else if (active === 'meetings') html = meetingsPanel();
    document.getElementById('content').innerHTML = html;
    bindPanel();
  }

  /* ================= STUDENT · Solve ================= */
  function studentSolve() {
    var mine = (D.mine || []).filter(match);
    var RANK = ['In Progress', 'Allocated', 'Pending Verification', 'Submitted', 'Draft', 'Completed'];
    mine = mine.slice().sort(function (a, b) { return RANK.indexOf(a.status) - RANK.indexOf(b.status) || a.due - b.due; });
    var cols = [['Challenge', 'minmax(0,1fr)'], ['Status', '150px'], ['Time left', '84px'], ['Action', '150px']];
    var rows = mine.map(function (c) {
      var act = (c.status === 'In Progress' || c.status === 'Allocated')
        ? '<div class="flex gap-1.5"><button data-pick="progress|' + c.id + '" class="btn btn-primary btn-sm">Update</button>' + (c.status === 'In Progress' ? '<button data-pick="submitwork|' + c.id + '" class="btn btn-sm">Submit</button>' : '') + '</div>'
        : '<button data-view="' + c.id + '" class="btn btn-sm w-full">View</button>';
      return [U.cell(c.title, c.id + (c.supervisor && c.supervisor !== '—' ? ' · ' + esc(c.supervisor) : '')), U.badge(c.status), dueCell(c.due), act];
    });
    var avail = (D.available || []).filter(match).map(function (c) { return { c: c, fit: fitFor(c) }; }).filter(function (r) { return r.fit > 0; }).sort(function (a, b) { return b.fit - a.fit; });
    var recRows = avail.map(function (r) {
      var c = r.c, action;
      if (c.request === 'pending') action = '<span class="w-24 shrink-0 text-center">' + U.badge('Requested') + '</span>';
      else if (c.request === 'declined') action = '<span class="w-24 shrink-0 text-center">' + U.badge('Declined') + '</span>';
      else action = '<button data-pick="request|' + c.id + '" class="btn btn-sm w-24 shrink-0">Request</button>';
      return '<div class="min-w-0 flex-1">' + U.cell(c.title, c.id + ' · ' + esc(c.supervisor) + ' · ' + r.fit + '% fit') + '</div>' + U.dayChip(c.due) + action;
    });
    var html = panelHead('solve', 'Update progress on the challenges assigned to you, submit completed work, or request access to solve a new challenge.') +
      U.card({ id: 'my', title: 'My challenges', count: mine.length, body: U.table(cols, rows, 'No challenges assigned yet.') }) +
      U.card({ id: 'rec', title: 'Request to solve', count: avail.length, body: '<p class="mt-1 text-xs text-slate-500">Challenges that match your interests and are open for requests.</p>' + U.list(recRows, 'No open challenges match your interests right now.') });
    if (sel) html += studentForm();
    return html;
  }
  function studentForm() {
    var c = findCh(sel.id); if (!c) return '';
    if (sel.kind === 'progress') {
      return formCard('Update progress — ' + c.id,
        '<p class="mb-3 font-semibold">' + esc(c.title) + '</p>' +
        '<div class="ws-field"><label class="label" for="f-pct">Completion: <b id="f-pct-out">' + (c.pct || 0) + '%</b></label><input id="f-pct" type="range" min="0" max="100" step="5" value="' + (c.pct || 0) + '" class="w-full accent-brand-700"></div>' +
        '<div class="ws-field"><label class="label" for="f-note">What did you complete? <span class="text-red-600">*</span></label><textarea id="f-note" rows="3" class="input"></textarea><span id="f-note-err" class="err"></span></div>',
        cancelBtn + btn('Save update', 'progress', null, 'primary'));
    }
    if (sel.kind === 'submitwork') {
      return formCard('Submit completed work — ' + c.id,
        '<p class="mb-3">Submit <b>' + esc(c.title) + '</b> for supervisor verification.</p>' +
        '<div class="ws-field"><label class="label" for="f-file">Final report <span class="ws-hint">(PDF, Word, images · max 10 MB)</span></label><input id="f-file" type="file" class="ws-file"><span id="f-file-err" class="err"></span></div>',
        cancelBtn + btn('Submit for verification', 'submitwork', null, 'primary'));
    }
    if (sel.kind === 'request') {
      return formCard('Request to work on ' + c.id,
        '<p class="mb-1 font-semibold">' + esc(c.title) + '</p><p class="ws-note mb-3">' + esc(c.desc || '') + '</p>' +
        '<div class="ws-field"><label class="label" for="f-msg">Message to the supervisor</label><textarea id="f-msg" rows="2" class="input"></textarea></div>',
        cancelBtn + btn('Send request', 'request', null, 'primary'));
    }
    return '';
  }

  /* ================= REPRESENTATIVE · Submit ================= */
  function repSubmit() {
    var subs = (D.subs || []).filter(match).slice().sort(function (a, b) { return b.id.localeCompare(a.id); });
    var cols = [['Challenge', 'minmax(0,1fr)'], ['Status', '150px'], ['Time left', '84px'], ['Action', '112px']];
    var rows = subs.map(function (c) {
      var act = c.status === 'Pending Information' ? '<button data-pick="respond|' + c.id + '" class="btn btn-primary btn-sm w-full">Respond</button>' : '<button data-view="' + c.id + '" class="btn btn-sm w-full">View</button>';
      return [U.cell(c.title, c.id + (c.team ? ' · ' + esc(c.team) : '')), U.badge(c.status), dueCell(c.due), act];
    });
    var info = (D.subs || []).filter(function (c) { return c.status === 'Pending Information'; });
    var html = panelHead('submit', 'Submit a new challenge for review, track your submissions, and respond when a supervisor needs more information.') +
      '<div class="ws-grid wide">' +
        '<div class="flex flex-col gap-4">' +
          U.card({ id: 'subs', title: 'My submissions', count: subs.length, body: U.table(cols, rows, 'You have not submitted a challenge yet.') }) +
          (info.length ? U.card({ id: 'info', title: 'Supervisor needs information', count: info.length, tone: 'warn', countRight: true, body: U.list(info.map(function (c) { return '<div class="min-w-0 flex-1">' + U.cell(c.title, esc(c.request || ''), 'warn') + '</div><button data-pick="respond|' + c.id + '" class="btn btn-sm w-28 shrink-0">Respond</button>'; }), 'Nothing needs your input.') }) : '') +
        '</div>' +
        '<div>' + challengeForm(true) + '</div>' +
      '</div>';
    if (sel && sel.kind === 'respond') html += respondForm();
    return html;
  }
  function challengeForm(withFunding) {
    var min = U.isoDay(new Date(Date.now() + U.DAY));
    return U.card({ id: 'newch', title: 'Submit a challenge', body:
      '<div class="ws-field"><label class="label" for="f-title">Challenge title <span class="text-red-600">*</span></label><input id="f-title" class="input"><span id="f-title-err" class="err"></span></div>' +
      '<div class="ws-2col ws-field"><div><label class="label" for="f-pri">Priority</label><select id="f-pri" class="input"><option>Low</option><option selected>Medium</option><option>High</option><option>Critical</option></select></div>' +
      '<div><label class="label" for="f-due">Deadline <span class="text-red-600">*</span></label><input id="f-due" type="date" min="' + min + '" class="input"><span id="f-due-err" class="err"></span></div></div>' +
      '<div class="ws-field"><label class="label" for="f-desc">Description <span class="text-red-600">*</span></label><textarea id="f-desc" rows="3" class="input"></textarea><span id="f-desc-err" class="err"></span></div>' +
      (withFunding ? '<div class="ws-field"><span class="label">Will your organisation fund this project? <span class="text-red-600">*</span></span><div class="ws-2col"><label class="ws-opt"><input type="radio" name="f-fund" value="yes">Yes, we will fund it</label><label class="ws-opt"><input type="radio" name="f-fund" value="no">No, we can\'t fund it</label></div><span id="f-fund-err" class="err"></span></div>' : '') +
      '<div class="ws-field"><label class="label" for="f-docs">Supporting documents</label><input id="f-docs" type="file" multiple class="ws-file"></div>' +
      '<div class="ws-form-actions">' + btn('Submit challenge', 'newchallenge', null, 'primary') + '</div>' });
  }
  function respondForm() {
    var c = findCh(sel.id); if (!c) return '';
    return formCard('Add more details — ' + c.id,
      '<p class="mb-1 font-semibold">' + esc(c.title) + '</p><p class="ws-sec-title">Requested by the supervisor</p><p class="ws-quote mb-3">' + esc(c.request || '') + '</p>' +
      '<div class="ws-field"><label class="label" for="f-text">Your response <span class="text-red-600">*</span></label><textarea id="f-text" rows="3" class="input"></textarea><span id="f-text-err" class="err"></span></div>' +
      '<div class="ws-field"><label class="label" for="f-docs">Attach documents</label><input id="f-docs" type="file" multiple class="ws-file"></div>',
      cancelBtn + btn('Send & resubmit', 'respond', null, 'primary'));
  }

  /* ================= REPRESENTATIVE · Solve ================= */
  function repSolve() {
    var assigned = (D.assigned || []).filter(match);
    var rows = assigned.map(function (c) {
      var act = c.status === 'In Progress' ? '<div class="flex gap-1.5"><button data-pick="progress|' + c.id + '" class="btn btn-sm">Update</button><button data-pick="upload|' + c.id + '" class="btn btn-sm">Upload</button></div>' : U.badge(c.status);
      return '<div class="min-w-0 flex-1">' + U.cell(c.title, esc(c.supervisor || '') + ' · ' + (c.pct || 0) + '% · ' + (c.docs || 0) + ' docs') + '</div>' + act;
    });
    var html = panelHead('solve', 'Update progress and upload documents on the work assigned to you.') +
      U.card({ id: 'asg', title: 'Assigned to me', count: assigned.length, body: U.list(rows, 'Nothing assigned to you.') });
    if (sel) html += repWorkForm();
    return html;
  }
  function repWorkForm() {
    var c = findCh(sel.id); if (!c) return '';
    if (sel.kind === 'progress') {
      return formCard('Update progress — ' + c.id,
        '<div class="ws-field"><label class="label" for="f-pct">Completion: <b id="f-pct-out">' + (c.pct || 0) + '%</b></label><input id="f-pct" type="range" min="0" max="100" step="5" value="' + (c.pct || 0) + '" class="w-full accent-brand-700"></div>' +
        '<div class="ws-field"><label class="label" for="f-note">Progress report <span class="text-red-600">*</span></label><textarea id="f-note" rows="3" class="input"></textarea><span id="f-note-err" class="err"></span></div>',
        cancelBtn + btn('Save update', 'progress', null, 'primary'));
    }
    if (sel.kind === 'upload') {
      return formCard('Upload document — ' + c.id,
        '<div class="ws-field"><label class="label" for="f-file">Choose files <span class="ws-hint">(PDF, Word, Excel, images · max 10 MB each)</span></label><input id="f-file" type="file" multiple class="ws-file"><span id="f-file-err" class="err"></span></div>',
        cancelBtn + btn('Upload', 'upload', null, 'primary'));
    }
    return '';
  }

  /* ================= SUPERVISOR ================= */
  function supSubmit() {
    return panelHead('submit', 'Submit your own challenge. Funding is not required for supervisor submissions.') +
      '<div class="ws-grid wide"><div>' + challengeForm(false) + '</div><div>' + supMyList() + '</div></div>';
  }
  function supMyList() {
    var OPEN = ['Unallocated', 'Allocated', 'In Progress', 'Pending Verification'];
    var my = (D.challenges || []).filter(function (c) { return OPEN.indexOf(c.status) > -1 && match(c); });
    var cols = [['Challenge', 'minmax(0,1fr)'], ['Status', '150px'], ['Time left', '84px']];
    return U.card({ id: 'my', title: 'My open challenges', count: my.length, right: '<span class="shrink-0 text-xs font-semibold text-slate-500">Capacity ' + (D.load || 0) + ' / ' + (D.cap || 5) + '</span>', body: U.table(cols, my.map(function (c) { return [U.cell(c.title, c.id + (c.to ? ' · ' + esc(c.to) : '')), U.badge(c.status), dueCell(c.due)]; }), 'No open challenges.') });
  }
  function supAssign() {
    var unalloc = (D.challenges || []).filter(function (c) { return c.status === 'Unallocated' && match(c); });
    var reqs = (D.requests || []).filter(function (r) { return r.status === 'pending'; });
    var rows = unalloc.map(function (c) {
      var r = resultFor(c.id), flagged = r && r.outcome === 'flagged';
      return '<div class="min-w-0 flex-1">' + U.cell(c.title, flagged ? 'No suitable student found' : c.id, flagged ? 'warn' : '') + '</div>' + U.badge(c.status) +
        '<button data-pick="' + (flagged ? 'decide' : 'allocate') + '|' + c.id + '" class="btn btn-sm w-28 shrink-0 ' + (flagged ? '' : 'btn-primary') + '">' + (flagged ? 'Decide' : 'Allocate') + '</button>';
    });
    var reqRows = reqs.map(function (r) {
      return '<div class="min-w-0 flex-1">' + U.cell(r.title, 'Request from ' + esc(r.student)) + '</div>' + U.badge('Student request') +
        '<button data-pick="reqrespond|' + r.rid + '" class="btn btn-sm w-28 shrink-0">Respond</button>';
    });
    var html = panelHead('assign', 'Allocate students to unallocated challenges using the MCDA ranking, decide on flagged challenges, and respond to student requests.') +
      U.card({ id: 'un', title: 'Awaiting allocation', count: unalloc.length, body: U.list(rows, 'Nothing awaiting allocation.') }) +
      U.card({ id: 'rq', title: 'Student requests', count: reqs.length, body: U.list(reqRows, 'No pending requests.') });
    if (sel) html += supAssignForm();
    return html;
  }
  function supAssignForm() {
    if (sel.kind === 'reqrespond') {
      var r = (D.requests || []).filter(function (x) { return String(x.rid) === String(sel.id); })[0]; if (!r) return '';
      var st = (D.students || []).filter(function (s) { return s.name === r.student; })[0] || { interests: [], load: 0, cap: 3 };
      return formCard('Student request — ' + r.id,
        '<p class="mb-2 font-semibold">' + esc(r.title) + '</p>' +
        '<dl class="ws-dl mb-3"><div><dt>Student</dt><dd>' + esc(r.student) + '</dd></div><div><dt>Interests</dt><dd>' + esc((st.interests || []).join(', ') || '—') + '</dd></div><div><dt>Workload</dt><dd>' + st.load + ' / ' + st.cap + (st.load >= st.cap ? ' · at capacity' : '') + '</dd></div></dl>' +
        (r.msg ? '<p class="ws-note mb-3">“' + esc(r.msg) + '”</p>' : '') +
        '<div class="ws-field"><label class="label" for="f-note">Note to the student <span class="ws-hint">(required to decline)</span></label><textarea id="f-note" rows="2" class="input"></textarea><span id="f-note-err" class="err"></span></div>',
        cancelBtn + btn('Decline', 'reqrespond', 'decline', 'danger') + btn('Accept', 'reqrespond', 'accept', 'primary'));
    }
    var c = findCh(sel.id); if (!c) return '';
    if (sel.kind === 'allocate') {
      var r = resultFor(c.id) || { ranked: [], recommended: [] };
      var list = '<div class="ws-rank mb-3">' + r.ranked.map(function (x) {
        var ok = x.student.available && x.student.load < x.student.cap;
        var rec = r.recommended.indexOf(x) > -1;
        return '<label class="' + (ok ? '' : 'disabled') + '"><input type="radio" name="f-pick" value="' + esc(x.student.name) + '"' + (rec && x === r.recommended[0] ? ' checked' : '') + (ok ? '' : ' disabled') + '><span class="min-w-0 flex-1"><b>' + esc(x.student.name) + '</b>' + (rec ? '<span class="ws-rec">RECOMMENDED</span>' : '') + '</span><span class="text-xs text-slate-500">' + (x.student.available ? x.student.load + '/' + x.student.cap + ' active' : 'Unavailable') + '</span></label>';
      }).join('') + '</div><span id="f-pick-err" class="err"></span>';
      return formCard('Allocate ' + c.id,
        '<p class="mb-3 font-semibold">' + esc(c.title) + '</p>' + list +
        '<div class="ws-field"><label class="label" for="f-why">Reason <span class="ws-hint">(if not the recommended student)</span></label><textarea id="f-why" rows="2" class="input"></textarea><span id="f-why-err" class="err"></span></div>',
        cancelBtn + btn('Approve allocation', 'allocate', null, 'primary'));
    }
    if (sel.kind === 'decide') {
      return formCard('Decide — ' + c.id,
        '<p class="mb-1 font-semibold">' + esc(c.title) + '</p><div class="mb-2">' + U.funding(c.funded) + '</div><p class="ws-note mb-3">' + esc(c.desc || '') + '</p>' +
        '<div class="ws-field"><label class="label" for="f-note">Note <span class="ws-hint">(required to reject)</span></label><textarea id="f-note" rows="2" class="input"></textarea><span id="f-note-err" class="err"></span></div>',
        cancelBtn + btn('Reject', 'decide', 'reject', 'danger') + btn('Keep unallocated', 'decide', 'keep') + btn('Approve for further review', 'decide', 'further_review', 'primary'));
    }
    return '';
  }
  function supReview() {
    var list = (D.challenges || []).filter(function (c) { return ['Submitted', 'Under Review'].indexOf(c.status) > -1 && match(c); });
    var rows = list.map(function (c) {
      return '<div class="min-w-0 flex-1">' + U.cell(c.title, 'by ' + esc(c.by || '') + ' · ' + c.id) + '</div>' + U.badge(c.status) +
        '<button data-pick="review|' + c.id + '" class="btn btn-sm w-28 shrink-0">Review</button>';
    });
    var html = panelHead('review', 'Approve, request more information on, or reject submitted challenges.') +
      U.card({ id: 'rv', title: 'Awaiting review', count: list.length, body: U.list(rows, 'Nothing to review.') });
    if (sel && sel.kind === 'review') {
      var c = findCh(sel.id);
      html += formCard('Review ' + c.id,
        '<div class="mb-3"><div class="font-semibold">' + esc(c.title) + '</div><div class="text-xs text-slate-500">Submitted by ' + esc(c.by || '') + ' · due ' + U.fmt(c.due) + '</div><div class="mt-1.5">' + U.funding(c.funded) + '</div><p class="ws-note mt-2">' + esc(c.desc || '') + '</p></div>' +
        '<div class="ws-field"><label class="label" for="f-comment">Comment <span class="ws-hint">(required to reject or request information)</span></label><textarea id="f-comment" rows="3" class="input"></textarea><span id="f-comment-err" class="err"></span></div>',
        cancelBtn + btn('Reject', 'review', 'reject', 'danger') + btn('Request information', 'review', 'request_info') + btn('Approve', 'review', 'approve', 'primary'));
    }
    return html;
  }
  function supVerify() {
    var list = (D.challenges || []).filter(function (c) { return c.status === 'Pending Verification' && match(c); });
    var rows = list.map(function (c) {
      return '<div class="min-w-0 flex-1">' + U.cell(c.title, 'Completed by ' + esc(c.to || '') + ' · ' + c.id) + '</div>' + U.badge(c.status) +
        '<button data-pick="verify|' + c.id + '" class="btn btn-sm w-28 shrink-0 border-green-600 bg-green-600 text-white hover:bg-green-700">Verify</button>';
    });
    var html = panelHead('verify', 'Verify completed work: approve and complete it, or return it to the student with feedback.') +
      U.card({ id: 'vf', title: 'Pending verification', count: list.length, body: U.list(rows, 'Nothing to verify.') });
    if (sel && sel.kind === 'verify') {
      var c = findCh(sel.id);
      html += formCard('Verify completed work — ' + c.id,
        '<p class="mb-3">Verify <b>' + esc(c.title) + '</b> by ' + esc(c.to || '') + '.</p>' +
        '<div class="ws-field"><label class="label" for="f-feedback">Feedback <span class="ws-hint">(required to return)</span></label><textarea id="f-feedback" rows="2" class="input"></textarea><span id="f-feedback-err" class="err"></span></div>',
        cancelBtn + btn('Return for rework', 'verify', 'return') + btn('Approve & complete', 'verify', 'approve', 'primary'));
    }
    return html;
  }

  /* ================= ADMIN · Approvals ================= */
  function adminApprovals() {
    var pend = (D.pending || []).filter(match);
    var cols = [['Member', 'minmax(0,1fr)'], ['Role', '128px'], ['Registered', '96px'], ['Action', '112px']];
    var rows = pend.map(function (p) {
      return [U.cell(p.name, esc(p.org)), esc(p.role), '<span class="text-slate-700">' + U.fmt(p.when) + '</span>', '<button data-pick="account|' + p.id + '" class="btn btn-primary btn-sm w-full">Review</button>'];
    });
    var locked = D.locked || [];
    var lockRows = locked.map(function (l) {
      return '<div class="min-w-0 flex-1">' + U.cell(l.name, l.id + ' · ' + esc(l.why), 'warn') + '</div><button data-pick="unlock|' + l.id + '" class="btn btn-sm w-28 shrink-0">Unlock</button>';
    });
    var act = (D.activity || []).slice(0, 12);
    var DOT = { ok: '#16a34a', bad: '#dc2626', warn: '#eab308', info: '#2b4de0' };
    var actRows = act.map(function (a) {
      return '<i class="inline-block size-2 shrink-0 rounded-full" style="background:' + (DOT[a.kind] || DOT.info) + '"></i><div class="min-w-0 flex-1 truncate text-slate-700"><b class="font-semibold text-slate-900">' + esc(a.who) + '</b> ' + esc(a.text) + '</div><span class="shrink-0 text-[12px] text-slate-500">' + (a.ago ? a.ago + 'd ago' : 'today') + '</span>';
    });
    var html = panelHead('approvals', 'Approve or decline new accounts, unlock locked accounts, and review recent system activity.') +
      U.card({ id: 'ap', title: 'Accounts awaiting approval', count: pend.length, body: U.table(cols, rows, 'No accounts waiting.') }) +
      '<div class="ws-grid">' +
        U.card({ id: 'lock', title: 'Locked accounts', count: locked.length, tone: 'warn', countRight: true, body: U.list(lockRows, 'No locked accounts.') }) +
        U.card({ id: 'act', title: 'Recent activity', body: U.list(actRows, 'No activity yet.') }) +
      '</div>';
    if (sel) html += adminForm();
    return html;
  }
  function adminForm() {
    if (sel.kind === 'account') {
      var p = (D.pending || []).filter(function (x) { return x.id === sel.id; })[0]; if (!p) return '';
      return formCard('Review account — ' + p.id,
        '<dl class="ws-dl mb-3"><div><dt>Name</dt><dd>' + esc(p.name) + '</dd></div><div><dt>Role</dt><dd>' + esc(p.role) + '</dd></div><div><dt>Organisation</dt><dd>' + esc(p.org) + '</dd></div><div><dt>Email</dt><dd>' + esc(p.email) + '</dd></div><div><dt>Registered</dt><dd>' + U.fmt(p.when) + '</dd></div></dl>' +
        '<div class="ws-field"><label class="label" for="f-reason">Reason <span class="ws-hint">(required to decline)</span></label><textarea id="f-reason" rows="2" class="input"></textarea><span id="f-reason-err" class="err"></span></div>',
        cancelBtn + btn('Decline', 'account', 'reject', 'danger') + btn('Approve & activate', 'account', 'approve', 'primary'));
    }
    if (sel.kind === 'unlock') {
      var l = (D.locked || []).filter(function (x) { return x.id === sel.id; })[0]; if (!l) return '';
      return formCard('Unlock account — ' + l.id,
        '<p>Unlock <b>' + esc(l.name) + '</b>? They will be able to sign in again.</p>',
        cancelBtn + btn('Unlock account', 'unlock', null, 'primary'));
    }
    return '';
  }

  /* ================= MEETINGS ================= */
  function meetingsPanel() {
    var mine = (MEET && MEET.meetings) || [];
    var booked = (MEET && MEET.booked) || [];
    var canBook = role === 'supervisor';
    var canCancel = role === 'supervisor' || role === 'admin';
    var rows = mine.map(function (m) {
      return '<div class="ws-meet"><span class="lab">' + esc((m.venue || '').replace('Lab ', '')) + '</span>' +
        '<div class="min-w-0 flex-1"><div class="truncate font-semibold text-slate-900">' + esc(m.title) + (m.cid ? ' <span class="font-normal text-slate-500">· ' + m.cid + '</span>' : '') + '</div><div class="truncate text-[12.5px] text-slate-600">' + esc(U.meetWhen(m)) + (m.people && m.people.length ? ' · ' + esc(m.people.join(', ')) : '') + '</div></div>' +
        '<button data-mopen="' + m.id + '" class="btn btn-sm shrink-0">Details</button>' +
        (canCancel ? '<button data-mcancel="' + m.id + '" class="btn btn-sm shrink-0 border-red-200 text-red-700 hover:bg-red-50">Cancel</button>' : '') + '</div>';
    });
    var desc = canBook ? 'Book an in-person meeting in one of the DC labs, and manage your upcoming meetings.'
      : role === 'admin' ? 'All meetings booked in the DC labs. You can cancel a meeting if needed.'
      : 'Meetings you are invited to. Meetings are booked by supervisors in the DC labs.';
    var html = panelHead('meetings', desc);
    if (canBook) html += bookingForm(booked);
    html += U.card({ id: 'mt', title: canBook ? 'Upcoming meetings' : role === 'admin' ? 'All meetings' : 'My meetings', count: mine.length, body: rows.length ? '<div class="mt-2">' + rows.join('') + '</div>' : '<p class="py-6 text-center text-sm text-slate-500">No meetings scheduled.</p>' });
    return html;
  }
  function clash(venue, date, start, mins) {
    var all = ((MEET && MEET.meetings) || []).concat((MEET && MEET.booked) || []);
    var a = U.toMin(start), b = a + mins;
    return all.filter(function (m) { return m.venue === venue && m.date === date && U.toMin(m.start) < b && a < U.toMin(m.start) + m.mins; })[0];
  }
  function bookingForm(booked) {
    var open = (D.challenges || []).filter(function (c) { return ['Unallocated', 'Allocated', 'In Progress', 'Pending Verification'].indexOf(c.status) > -1; });
    var times = []; for (var t = 8 * 60; t <= 16 * 60 + 30; t += 30) times.push(U.hhmm(t));
    var today = U.isoDay();
    var venues = U.VENUES.map(function (v) { return '<label class="ws-venue" data-venue="' + v + '"><input type="radio" name="m-venue" value="' + v + '"><span class="v">' + v.replace('Lab ', '') + '</span><span class="s">Available</span></label>'; }).join('');
    return U.card({ id: 'book', title: 'Schedule a meeting', body:
      '<div class="ws-field"><label class="label" for="m-c">Challenge <span class="text-red-600">*</span></label><select id="m-c" class="input">' + open.map(function (c) { return '<option value="' + c.id + '">' + esc(c.title) + ' (' + c.id + ')</option>'; }).join('') + '</select><span id="m-c-err" class="err"></span></div>' +
      '<div class="ws-field"><span class="label">Invite <span class="text-red-600">*</span></span><div id="m-people" class="flex flex-wrap gap-x-5 gap-y-1.5"></div><span id="m-people-err" class="err"></span></div>' +
      '<div class="ws-field"><label class="label" for="m-t">Meeting title <span class="text-red-600">*</span></label><input id="m-t" class="input" value="Progress review" maxlength="80"><span id="m-t-err" class="err"></span></div>' +
      '<div class="ws-2col ws-field"><div><label class="label" for="m-d">Date <span class="text-red-600">*</span></label><input id="m-d" type="date" min="' + today + '" value="' + U.workday(1) + '" class="input"><span id="m-d-err" class="err"></span></div>' +
      '<div class="ws-2col"><div><label class="label" for="m-s">Start</label><select id="m-s" class="input">' + times.map(function (x) { return '<option' + (x === '10:00' ? ' selected' : '') + '>' + x + '</option>'; }).join('') + '</select></div>' +
      '<div><label class="label" for="m-m">Length</label><select id="m-m" class="input"><option value="30">30 min</option><option value="60" selected>1 hour</option><option value="90">1½ hours</option><option value="120">2 hours</option></select></div></div></div>' +
      '<div class="ws-field"><span class="label">Venue (in person) <span class="text-red-600">*</span></span><div id="m-v" class="ws-venues">' + venues + '</div><span id="m-v-err" class="err"></span></div>' +
      '<div class="ws-field"><label class="label" for="m-a">Agenda <span class="ws-hint">(optional)</span></label><textarea id="m-a" rows="2" class="input"></textarea></div>' +
      '<div class="ws-form-actions">' + btn('Schedule meeting', 'bookmeeting', null, 'primary') + '</div>' });
  }
  function paintBooking() {
    var cSel = document.getElementById('m-c'); if (!cSel) return;
    var paintPeople = function () {
      var c = findCh(cSel.value), list = [];
      if (c) { if (c.to) list.push([c.to, 'Student on this challenge']); if (c.by && c.by !== c.to) list.push([c.by, 'Submitted the challenge']); }
      document.getElementById('m-people').innerHTML = list.map(function (p) { return '<label class="flex cursor-pointer items-center gap-2 text-[13.5px]"><input type="checkbox" name="m-p" value="' + esc(p[0]) + '" checked class="size-4 accent-brand-700">' + esc(p[0]) + ' <span class="text-xs text-slate-500">' + p[1] + '</span></label>'; }).join('') || '<span class="text-sm text-slate-500">No one to invite yet.</span>';
    };
    var paintVenues = function () {
      var date = raw('m-d'), start = raw('m-s'), mins = +raw('m-m');
      document.querySelectorAll('#m-v .ws-venue').forEach(function (lab) {
        var v = lab.dataset.venue, x = date && clash(v, date, start, mins);
        lab.classList.toggle('disabled', !!x);
        lab.querySelector('input').disabled = !!x;
        lab.querySelector('.s').textContent = x ? 'Booked ' + x.start : 'Available';
        if (x) lab.querySelector('input').checked = false;
      });
    };
    paintPeople(); paintVenues();
    cSel.addEventListener('change', paintPeople);
    ['m-d', 'm-s', 'm-m'].forEach(function (id) { document.getElementById(id).addEventListener('change', paintVenues); });
  }

  /* ---------- read-only details (modal) ---------- */
  function viewChallenge(id) {
    var c = findCh(id); if (!c) return;
    var row = function (k, v) { return '<div><dt>' + k + '</dt><dd>' + v + '</dd></div>'; };
    U.modal(c.id, '<p class="mb-2 font-semibold">' + esc(c.title) + '</p><dl class="ws-dl">' +
      row('Status', U.badge(c.status)) + row('Supervisor', esc(c.supervisor || 'Being assigned')) +
      (c.team ? row('Team', esc(Array.isArray(c.team) ? c.team.join(', ') : c.team)) : '') +
      row('Deadline', U.fmt(c.due)) + (c.funded !== undefined && c.funded !== 'none' ? row('Funding', U.funding(c.funded)) : '') +
      row('Progress', (c.pct || 0) + '%') + (c.desc ? row('Description', esc(c.desc)) : '') + '</dl>', [{ label: 'Close' }]);
  }

  /* ---------- bind + dispatch ---------- */
  function bindPanel() {
    var pct = document.getElementById('f-pct');
    if (pct) pct.addEventListener('input', function () { document.getElementById('f-pct-out').textContent = this.value + '%'; });
    if (active === 'meetings' && role === 'supervisor') paintBooking();
  }
  document.getElementById('content').addEventListener('click', function (e) {
    var pick = e.target.closest('[data-pick]');
    if (pick) { var p = pick.dataset.pick.split('|'); sel = { kind: p[0], id: p[1] }; renderPanel(); return; }
    if (e.target.closest('[data-cancel]')) { sel = null; renderPanel(); return; }
    var view = e.target.closest('[data-view]'); if (view) return viewChallenge(view.dataset.view);
    var mo = e.target.closest('[data-mopen]'); if (mo) { var m = ((MEET && MEET.meetings) || []).filter(function (x) { return x.id === mo.dataset.mopen; })[0]; if (m) U.meetingDetails(m); return; }
    var mc = e.target.closest('[data-mcancel]'); if (mc) return cancelMeeting(mc.dataset.mcancel);
    var doBtn = e.target.closest('[data-do]'); if (doBtn) doAction(doBtn.dataset.do, doBtn.dataset.action);
  });
  document.getElementById('search').addEventListener('input', function () { q = this.value.trim().toLowerCase(); if (active) renderPanel(); });

  function filesTo(fd, id) { var f = document.getElementById(id); if (f && f.files) for (var i = 0; i < f.files.length; i++) fd.append('files', f.files[i]); return fd; }
  function fileCount(id) { var f = document.getElementById(id); return f && f.files ? f.files.length : 0; }
  function oversize(id) { var f = document.getElementById(id); if (!f || !f.files) return null; for (var i = 0; i < f.files.length; i++) if (f.files[i].size > 10 * 1048576) return f.files[i].name; return null; }

  function cancelMeeting(id) {
    var m = ((MEET && MEET.meetings) || []).filter(function (x) { return x.id === id; })[0]; if (!m) return;
    U.modal('Cancel meeting', '<p>Cancel <b>' + esc(m.title) + '</b> on ' + esc(U.meetWhen(m)) + '? Invitees will be notified.</p>',
      [{ label: 'Keep' }, { label: 'Cancel meeting', danger: true, onClick: function () {
        if (live) return API.del('/meetings/' + id).then(function (r) { done(r.message); }).catch(API.fail);
        MEET.meetings = MEET.meetings.filter(function (x) { return x.id !== id; }); U.toast('Meeting cancelled. Invitees notified.', 'ok'); renderPanel();
      } }]);
  }

  /* Server field names → form element ids, per action (for API.fieldErrors). */
  var FEMAP = {
    progress: { pct: 'f-pct', note: 'f-note' },
    newchallenge: { title: 'f-title', description: 'f-desc', due_date: 'f-due', priority: 'f-pri', funded: 'f-fund' },
    respond: { response: 'f-text' },
    allocate: { student: 'f-pick', reason: 'f-why' },
    decide: { note: 'f-note' }, review: { comment: 'f-comment' }, verify: { feedback: 'f-feedback' },
    reqrespond: { note: 'f-note' }, account: { reason: 'f-reason' },
    bookmeeting: { challenge: 'm-c', title: 'm-t', people: 'm-people', date: 'm-d', venue: 'm-v' }
  };
  function doAction(kind, action) {
    clearErrs();
    var ferr = function (er) { API.fieldErrors(er, FEMAP[kind] || {}); API.fail(er); };
    var id = sel ? sel.id : null, c = id ? findCh(id) : null;

    if (kind === 'progress') {
      var note = val('f-note'); if (note.length < 5) return setErr('f-note', 'Describe your progress (5+ characters).');
      var pct = +raw('f-pct');
      if (live) return API.post('/challenges/' + id + '/progress', { pct: pct, note: note }).then(function (r) { done(r.message); }).catch(ferr);
      c.pct = pct; c.status = 'In Progress'; c.last = note; (c.history = c.history || []).push({ at: new Date(), pct: pct }); return done('Progress updated to ' + pct + '%.');
    }
    if (kind === 'submitwork') {
      var big = oversize('f-file'); if (big) return setErr('f-file', big + ' is larger than 10 MB.');
      if (live) return API.post('/challenges/' + id + '/submit-work', filesTo(new FormData(), 'f-file')).then(function (r) { done(r.message); }).catch(ferr);
      c.status = 'Pending Verification'; c.pct = 100; return done('Submitted — your supervisor will verify it.');
    }
    if (kind === 'request') {
      if (live) return API.post('/requests', { challenge: id, message: val('f-msg') }).then(function (r) { done(r.message); }).catch(ferr);
      c.request = 'pending'; return done('Request sent. You will be notified of the decision.');
    }
    if (kind === 'newchallenge') {
      var t = val('f-title'), due = val('f-due'), desc = val('f-desc'), ok = true;
      if (t.length < 5) ok = setErr('f-title', 'Enter a title (5+ characters).') && ok;
      if (!due) ok = setErr('f-due', 'Choose a deadline.') && ok;
      if (desc.length < 20) ok = setErr('f-desc', 'Describe the challenge (20+ characters).') && ok;
      var fund = document.querySelector('input[name=f-fund]:checked');
      if (role === 'representative' && !fund) ok = setErr('f-fund', 'Choose whether your organisation will fund this project.') && ok;
      if (!ok) return;
      if (live) { var fd = new FormData(); fd.append('title', t); fd.append('description', desc); fd.append('due_date', due); fd.append('priority', val('f-pri')); if (fund) fd.append('funded', fund.value); return API.post('/challenges', filesTo(fd, 'f-docs')).then(function (r) { done(r.message); }).catch(ferr); }
      var nid = 'DCC-0000' + (20 + Math.floor(Math.random() * 80));
      var nc = { id: nid, title: t, desc: desc, due: new Date(due + 'T17:00'), pct: 0, funded: fund ? fund.value === 'yes' : 'none' };
      if (role === 'representative') { nc.status = 'Submitted'; D.subs.unshift(nc); }
      else { var open = (D.challenges || []).filter(function (x) { return ['Unallocated', 'Allocated', 'In Progress', 'Pending Verification'].indexOf(x.status) > -1; }).length; nc.by = ME.name; nc.status = open < (D.cap || 5) ? 'Unallocated' : 'Submitted'; D.challenges.unshift(nc); }
      return done(nid + ' submitted.');
    }
    if (kind === 'respond') {
      var text = val('f-text'); if (text.length < 5) return setErr('f-text', 'Write a short response (5+ characters).');
      if (live) { var fd2 = new FormData(); fd2.append('response', text); return API.post('/challenges/' + id + '/respond', filesTo(fd2, 'f-docs')).then(function (r) { done(r.message); }).catch(ferr); }
      c.status = 'Submitted'; delete c.request; return done('Information sent — ' + id + ' is back with the supervisor.');
    }
    if (kind === 'upload') {
      if (!fileCount('f-file')) return setErr('f-file', 'Choose at least one file.');
      var big2 = oversize('f-file'); if (big2) return setErr('f-file', big2 + ' is larger than 10 MB.');
      if (live) return API.post('/challenges/' + id + '/documents', filesTo(new FormData(), 'f-file')).then(function (r) { done(r.message); }).catch(ferr);
      c.docs = (c.docs || 0) + fileCount('f-file'); return done(fileCount('f-file') + ' document(s) uploaded.');
    }
    if (kind === 'allocate') {
      var p = document.querySelector('input[name=f-pick]:checked'); if (!p) return setErr('f-pick', 'Choose a student.');
      var r = resultFor(id) || { recommended: [] }, isRec = r.recommended.some(function (x) { return x.student.name === p.value; }), why = val('f-why');
      if (!isRec && why.length < 3) return setErr('f-why', 'Give a reason.');
      if (live) return API.post('/challenges/' + id + '/allocate', { student: p.value, reason: why }).then(function (res) { done(res.message); }).catch(ferr);
      c.status = 'Allocated'; c.to = p.value; if (D._res) delete D._res[id]; return done(id + ' assigned to ' + p.value + '.');
    }
    if (kind === 'decide') {
      var note = val('f-note');
      if (action === 'reject' && note.length < 3) return setErr('f-note', 'Give a reason for rejecting.');
      if (live) return API.post('/challenges/' + id + '/decide', { action: action, note: note }).then(function (res) { done(res.message); }).catch(ferr);
      if (action === 'reject') c.status = 'Rejected'; else if (action === 'further_review') c.status = 'Interest Review';
      if (D._res) delete D._res[id]; return done(action === 'keep' ? id + ' stays unallocated.' : id + ' updated.');
    }
    if (kind === 'review') {
      var comment = val('f-comment');
      if ((action === 'reject' || action === 'request_info') && comment.length < 3) return setErr('f-comment', action === 'reject' ? 'Give a reason for rejecting.' : 'Say what information is needed.');
      if (live) return API.post('/challenges/' + id + '/review', { action: action, comment: comment }).then(function (res) { done(res.message); }).catch(ferr);
      if (action === 'approve') c.status = 'Unallocated'; else if (action === 'request_info') { c.status = 'Pending Information'; c.request = comment; } else c.status = 'Rejected';
      return done(id + ' updated.');
    }
    if (kind === 'verify') {
      var fb = val('f-feedback');
      if (action === 'return' && fb.length < 3) return setErr('f-feedback', 'Add feedback for the student.');
      if (live) return API.post('/challenges/' + id + '/verify', { action: action, feedback: fb }).then(function (res) { done(res.message); }).catch(ferr);
      c.status = action === 'approve' ? 'Completed' : 'In Progress'; if (action === 'approve') c.pct = 100; return done(id + (action === 'approve' ? ' marked as completed.' : ' returned with feedback.'));
    }
    if (kind === 'reqrespond') {
      var note2 = val('f-note');
      if (action === 'decline' && note2.length < 3) return setErr('f-note', 'Give the student a reason.');
      if (live) return API.post('/requests/' + id + '/' + action, action === 'decline' ? { note: note2 } : {}).then(function (res) { done(res.message); }).catch(ferr);
      var rq = (D.requests || []).filter(function (x) { return String(x.rid) === String(id); })[0];
      if (rq) { rq.status = action === 'accept' ? 'accepted' : 'declined'; if (action === 'accept') { var ch = findCh(rq.id); if (ch) { ch.status = 'Allocated'; ch.to = rq.student; } } }
      return done(action === 'accept' ? 'Student allocated and notified.' : 'Request declined.');
    }
    if (kind === 'account') {
      var reason = val('f-reason');
      if (action === 'reject' && reason.length < 3) return setErr('f-reason', 'Give a reason for declining.');
      if (live) return API.post('/admin/users/' + id + '/' + (action === 'approve' ? 'approve' : 'reject'), action === 'reject' ? { reason: reason } : {}).then(function (res) { done(res.message); }).catch(ferr);
      D.pending = (D.pending || []).filter(function (x) { return x.id !== id; }); return done(action === 'approve' ? 'Account approved.' : 'Registration declined.');
    }
    if (kind === 'unlock') {
      if (live) return API.post('/admin/users/' + id + '/unlock').then(function (res) { done(res.message); }).catch(ferr);
      D.locked = (D.locked || []).filter(function (x) { return x.id !== id; }); return done('Account unlocked.');
    }
    if (kind === 'bookmeeting') {
      var people = [].slice.call(document.querySelectorAll('input[name=m-p]:checked')).map(function (i) { return i.value; });
      var venue = (document.querySelector('input[name=m-venue]:checked') || {}).value;
      var date = val('m-d'), start = val('m-s'), mins = +val('m-m'), title = val('m-t'), ok2 = true;
      if (!people.length) ok2 = setErr('m-people', 'Invite at least one person.') && ok2;
      if (title.length < 3) ok2 = setErr('m-t', 'Give the meeting a title.') && ok2;
      if (!date) ok2 = setErr('m-d', 'Choose a date.') && ok2;
      else if (!(new Date(date + 'T12:00').getDay() % 6)) ok2 = setErr('m-d', 'Choose a weekday — the labs are closed on weekends.') && ok2;
      else if (new Date(date + 'T' + start) < new Date()) ok2 = setErr('m-d', 'Choose a time in the future.') && ok2;
      if (U.toMin(start) + mins > 17 * 60) ok2 = setErr('m-d', 'Meetings must end by 17:00.') && ok2;
      if (!venue) ok2 = setErr('m-v', 'Choose a lab.') && ok2;
      else if (date) { var x = clash(venue, date, start, mins); if (x) ok2 = setErr('m-v', venue + ' is booked at ' + x.start + '. Choose another lab or time.') && ok2; }
      if (!ok2) return;
      var cid = val('m-c');
      if (live) return API.post('/meetings', { challenge: cid, title: title, people: people, date: date, start: start, mins: mins, venue: venue, agenda: val('m-a') }).then(function (res) { done(res.message); }).catch(ferr);
      var ch2 = findCh(cid);
      MEET.meetings.push({ id: 'M-' + (200 + MEET.meetings.length), cid: cid, title: title, challenge: ch2 ? ch2.title + ' (' + cid + ')' : cid, date: date, start: start, mins: mins, venue: venue, organiser: ME.name, people: people, agenda: val('m-a') });
      return done('Meeting booked in ' + venue + '. Invitees notified.');
    }
  }

  /* ---------- demo data ---------- */
  function demoData(r) {
    var profiles = {
      student: { name: 'Amahle Mthembu', initials: 'AM', meta: 'Student · DCC00002', roleLabel: 'Student', interests: ['Design, Media & Communication', 'Data Science & Machine Learning'], profile: { id: 'DCC00002', email: 'amahle.mthembu@unizulu.ac.za', org: 'University of Zululand', interest: 'Design, Media & Communication', joined: '2026-02-14' } },
      representative: { name: 'Sbongokuhle Msomi', initials: 'SM', meta: 'Representative · DCC00003', roleLabel: 'Representative', org: 'BET Media', profile: { id: 'DCC00003', email: 'sbongokuhle@betmedia.co.za', org: 'BET Media', joined: '2026-01-22' } },
      supervisor: { name: 'Dr Sipho Ndlovu', initials: 'SN', meta: 'Supervisor · FAI', roleLabel: 'Supervisor', profile: { id: 'DCC00011', email: 's.ndlovu@unizulu.ac.za', org: 'University of Zululand', interest: 'Data Science & Machine Learning', joined: '2025-08-03' } },
      admin: { name: 'Nokuthula Mkhize', initials: 'NM', meta: 'Administrator', roleLabel: 'Administrator', profile: { id: 'DCC00001', email: 'admin@devchallenges.community', org: 'Development Challenges Community', joined: '2025-06-01' } }
    };
    var me = profiles[r];
    if (r === 'student') return { me: me, events: [], notes: [],
      mine: [
        { id: 'DCC-000006', title: 'Library seat occupancy sensor prototype', status: 'In Progress', supervisor: 'Dr Sipho Ndlovu', due: d(40), pct: 0, history: [], assigned: d(0), team: ['Amahle Mthembu', 'Lwazi Dube'], desc: 'Build a low-cost sensor prototype that detects whether a library seat is occupied and shows live availability.' },
        { id: 'DCC-000001', title: 'Expansion of knowledge through communication', status: 'In Progress', supervisor: 'Dr Sipho Ndlovu', due: d(24), pct: 45, history: [{ at: d(-5), pct: 45 }], last: 'First campaign drafts shared.', desc: 'A communication campaign to expand knowledge.' },
        { id: 'DCC-000011', title: 'Postgraduate research data repository', status: 'Completed', supervisor: 'Prof Anika Pillay', due: d(-45), pct: 100, desc: 'A repository for postgraduate research data.' }
      ],
      available: [
        { id: 'DCC-000002', supervisor: 'Dr Sipho Ndlovu', title: 'Campus Wi-Fi dead-zone mapping', desc: 'Survey signal strength across campus and recommend access-point placement.', due: d(35) },
        { id: 'DCC-000017', supervisor: 'Dr Sipho Ndlovu', title: 'Township storytelling and publicity drive', desc: 'Help local artists with storytelling and publicity for a township heritage festival.', due: d(62) },
        { id: 'DCC-000022', supervisor: 'Prof Anika Pillay', request: 'pending', title: 'Campus gate traffic patterns', desc: 'Analyse traffic patterns at the campus gates during peak hours.', due: d(41) }
      ] };
    if (r === 'representative') return { me: me, events: [], notes: [],
      subs: [
        { id: 'DCC-000001', funded: true, title: 'Expansion of knowledge through communication', status: 'In Progress', due: d(24), pct: 45, team: 'Amahle Mthembu', supervisor: 'Dr Sipho Ndlovu' },
        { id: 'DCC-000010', funded: false, title: 'Community health-literacy workshops', status: 'Pending Information', due: d(30), pct: 0, request: 'Please attach the partner clinic letters and expected attendance numbers.', supervisor: 'Prof Anika Pillay' },
        { id: 'DCC-000005', title: 'Phishing awareness training portal', status: 'Under Review', due: d(45), pct: 0, supervisor: 'Dr Sipho Ndlovu' }
      ],
      assigned: [ { id: 'DCC-000015', title: 'IT help-desk FAQ chatbot', status: 'In Progress', due: d(12), pct: 70, supervisor: 'Dr Sipho Ndlovu', docs: 2 } ] };
    if (r === 'supervisor') {
      var students = [
        { name: 'Amahle Mthembu', interests: ['Design, Media & Communication', 'Data Science & Machine Learning'], load: 1, cap: 3, available: true, record: 0.9 },
        { name: 'Lwazi Dube', interests: ['Software & Web Development', 'Internet of Things & Embedded Systems'], load: 2, cap: 3, available: true, record: 0.7 },
        { name: 'Thando Khumalo', interests: ['Environmental Systems & Water', 'Renewable Energy & Sustainability', 'Research'], load: 1, cap: 3, available: true, record: 0.8 },
        { name: 'Nosipho Cele', interests: ['Health & Community Wellbeing', 'Research'], load: 3, cap: 3, available: true, record: 0.85 }
      ];
      return { me: me, events: [], notes: [], cap: 5, load: 3, students: students, _res: {},
        challenges: [
          { id: 'DCC-000004', funded: true, title: 'Automated timetable clash detection', by: 'Amahle Mthembu', status: 'Submitted', due: d(60), desc: 'Build a tool that detects lecture and venue clashes from the draft timetable.' },
          { id: 'DCC-000003', funded: true, title: 'Student dropout early-warning dashboard', by: 'Amahle Mthembu', status: 'Unallocated', due: d(50), desc: 'Combine LMS activity, attendance and assessment data into an early-warning dashboard.' },
          { id: 'DCC-000024', funded: false, title: 'Reduce queues at the campus clinic', by: 'BET Media', status: 'Unallocated', due: d(29), desc: 'Patients wait hours at the campus clinic without updates.' },
          { id: 'DCC-000001', funded: true, title: 'Expansion of knowledge through communication', by: 'Sbongokuhle Msomi', status: 'In Progress', due: d(24), to: 'Amahle Mthembu', pct: 45 },
          { id: 'DCC-000009', funded: true, title: 'Cafeteria food-waste reduction study', by: 'Sbongokuhle Msomi', status: 'Pending Verification', due: d(3), to: 'Thando Khumalo', pct: 100 }
        ],
        requests: [ { rid: 'R1', id: 'DCC-000024', title: 'Reduce queues at the campus clinic', student: 'Lwazi Dube', msg: 'I built an SMS reminder tool for my residence and would like to help the clinic.', status: 'pending', ago: 0 } ] };
    }
    return { me: me, events: [], notes: [], members: { Student: 148, Supervisor: 23, Representative: 41 }, org_total: 14,
      pending: [
        { id: 'DCC00231', name: 'Dr Lindiwe Mabaso', role: 'Supervisor', org: 'University of Zululand', email: 'l.mabaso@unizulu.ac.za', when: d(0) },
        { id: 'DCC00226', name: 'Ms Zanele Ngcobo', role: 'Representative', org: 'uMhlathuze Municipality', email: 'z.ngcobo@umhlathuze.gov.za', when: d(-2) }
      ],
      locked: [ { id: 'DCC00118', name: 'Mr Sifiso Gumede', why: '3 failed login attempts', ago: 1 } ],
      activity: [
        { who: 'Dr Sipho Ndlovu', text: 'verified DCC-000007 as completed.', ago: 0, kind: 'ok' },
        { who: 'BET Media', text: 'submitted DCC-000020 “Small-scale farmers market app”.', ago: 1, kind: 'info' },
        { who: 'System', text: '3 failed login attempts for DCC00118 — account locked.', ago: 1, kind: 'bad' }
      ],
      challenges: { Submitted: 9, 'In Progress': 18, Completed: 31 } };
  }
  function demoMeetings() {
    if (role === 'supervisor') return { meetings: [
      { id: 'M-101', cid: 'DCC-000001', title: 'Progress review', challenge: 'Expansion of knowledge through communication (DCC-000001)', date: U.workday(1), start: '10:00', mins: 60, venue: 'Lab DC-002', organiser: ME.name, people: ['Amahle Mthembu', 'Sbongokuhle Msomi'], agenda: 'Audience numbers and next milestones.' }
    ], booked: [ { venue: 'Lab DC-003', date: U.workday(1), start: '09:00', mins: 180 }, { venue: 'Lab DC-001', date: U.workday(1), start: '10:00', mins: 90 } ] };
    if (role === 'admin') return { meetings: [ { id: 'M-101', cid: 'DCC-000001', title: 'Progress review', date: U.workday(1), start: '10:00', mins: 60, venue: 'Lab DC-002', organiser: 'Dr Sipho Ndlovu', people: ['Amahle Mthembu', 'Sbongokuhle Msomi'], agenda: '' } ], booked: [] };
    return { meetings: [ { id: 'M-101', cid: 'DCC-000001', title: 'Progress review', challenge: 'Expansion of knowledge through communication (DCC-000001)', date: U.workday(1), start: '10:00', mins: 60, venue: 'Lab DC-002', organiser: 'Dr Sipho Ndlovu', people: [ME.name], agenda: 'Audience numbers and next milestones.' } ], booked: [] };
  }
  function demoNotes() {
    if (role === 'student') return [{ kind: 'assign', from: 'Dr Sipho Ndlovu', about: 'DCC-000006', text: 'You have been added to “Library seat occupancy sensor prototype”.', ago: 0, unread: true }];
    if (role === 'supervisor') return [{ kind: 'alert', from: 'Lwazi Dube', about: 'DCC-000024', text: 'Requested to work on “Reduce queues at the campus clinic”.', ago: 0, unread: true }];
    if (role === 'representative') return [{ kind: 'alert', from: 'Prof Anika Pillay', about: 'DCC-000010', text: 'More information is needed before “Community health-literacy workshops” can be approved.', ago: 0, unread: true }];
    return [{ kind: 'alert', from: 'Dr Lindiwe Mabaso', about: 'Supervisor', text: 'New Supervisor account is waiting for approval.', ago: 0, unread: true }];
  }

  start();
})();
