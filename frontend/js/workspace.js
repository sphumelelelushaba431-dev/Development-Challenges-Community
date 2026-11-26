/* Workspace — the single post-login page.
   The role comes only from the signed-in account (never from the URL). One nav button opens one panel. */
(function () {
  'use strict';
  var U = UI;
  var live = !!(window.API && API.on());
  var d = function (n) { return new Date(Date.now() + n * U.DAY); };

  var role = null, ME = null, D = null, MEET = null, AUD = null;
  var active = null, sel = null;

  var ALL_NAV = [['submit', 'Submit'], ['solve', 'Solve'], ['track', 'Track'], ['meetings', 'Meeting'], ['audit', 'Audit log']];
  var ALLOWED = {
    student:        ['solve', 'track'],
    representative: ['submit', 'track'],
    supervisor:     ['submit', 'solve', 'track', 'meetings', 'audit']
  };
  var canUse = function (key) { return (ALLOWED[role] || []).indexOf(key) > -1; };
  var TITLES = { solve: 'Solve', submit: 'Submit', track: 'Track', meetings: 'Meeting', audit: 'Audit log' };
  var LABEL = {
    'Unallocated': 'Open', 'Approved': 'Open', 'Submitted': 'Review', 'Under Review': 'Review',
    'Pending Information': 'More details', 'Allocated': 'In progress', 'In Progress': 'In progress',
    'Pending Verification': 'In progress', 'Completed': 'Completed', 'Rejected': 'Closed'
  };
  var OPEN = ['Unallocated', 'Allocated', 'In Progress'];

  var esc = U.esc;
  var val = function (id) { var e = document.getElementById(id); return e ? e.value.trim() : ''; };
  var raw = function (id) { var e = document.getElementById(id); return e ? e.value : ''; };
  var setErr = function (id, msg) {
    var e = document.getElementById(id + '-err'); if (e) e.textContent = msg || '';
    var f = document.getElementById(id); if (f) f.classList.toggle('invalid', !!msg); return !msg;
  };
  var clearErrs = function () {
    document.querySelectorAll('#content .err').forEach(function (e) { e.textContent = ''; });
    document.querySelectorAll('#content .invalid').forEach(function (e) { e.classList.remove('invalid'); });
  };
  var label = function (s) { return LABEL[s] || s || '—'; };
  var teamText = function (c) { return Array.isArray(c.team) ? c.team.join(', ') : (c.team || ''); };
  var findCh = function (id) {
    var pools = [D.mine, D.open, D.subs, D.challenges];
    for (var i = 0; i < pools.length; i++) {
      var f = (pools[i] || []).filter(function (c) { return c.id === id; })[0];
      if (f) return f;
    }
    return null;
  };
  var dueCell = function (due) {
    if (!due) return '<span class="text-slate-400">—</span>';
    var n = U.daysLeft(due);
    return '<span class="tabular-nums ' + (n < 0 ? 'text-slate-400' : n <= 7 ? 'font-semibold text-red-600' : 'text-slate-700') + '">' + (n < 0 ? '—' : n + ' days') + '</span>';
  };
  var bar = function (pct) {
    pct = Math.max(0, Math.min(100, +pct || 0));
    return '<span class="inline-flex w-28 items-center gap-2"><span class="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200"><i class="block h-full rounded-full bg-brand-600" style="width:' + pct + '%"></i></span><b class="tabular-nums text-xs text-slate-600">' + pct + '%</b></span>';
  };
  var btn = function (text, kind, action, style) {
    return '<button data-do="' + kind + '"' + (action ? ' data-action="' + action + '"' : '') +
      ' class="btn py-2 ' + (style === 'primary' ? 'btn-primary' : style === 'danger' ? 'border-red-200 text-red-700 hover:bg-red-50' : '') + '">' + text + '</button>';
  };
  var cancelBtn = '<button data-cancel class="btn py-2">Cancel</button>';
  var formCard = function (title, inner, actions) {
    return U.card({ id: 'wsform', title: title, body: '<div class="mt-2">' + inner + '</div><div class="ws-form-actions">' + actions + '</div>' });
  };
  // The header title is the panel's only heading; nothing is repeated inside the panel.
  var panelHead = function (key) {
    var t = TITLES[key] || 'Workspace', pt = document.getElementById('page-title');
    if (pt) { pt.textContent = t; document.title = t + ' — Development Challenges Community'; }
    return '';
  };
  var shellCfg = function () { return { roleLabel: ME.roleLabel, name: ME.name, initials: ME.initials, meta: ME.meta, profile: ME.profile }; };

  /* ---------- boot / auth ---------- */
  function start() {
    if (live) {
      var u = API.user();
      if (!API.token() || !u || !ALLOWED[u.role]) { location.replace('login.html'); return; }
      role = u.role;
      API.boot(role).then(function (data) {
        D = data; ME = D.me; normalize(); U.shell(shellCfg()); U.serverNotes(D.notes, noteOpener); renderNav(); renderEmpty();
      }).catch(API.fail);
      return;
    }
    try { role = localStorage.getItem('dcc-demo-role'); } catch (e) {}
    if (!role || !ALLOWED[role]) { location.replace('login.html'); return; }
    D = demoData(role); ME = D.me;
    U.shell(shellCfg()); U.notes(demoNotes()); renderNav(); renderEmpty();
  }
  function normalize() {
    API.dates(D.events || [], ['date']);
    if (role === 'student') {
      API.dates(D.mine || [], ['due', 'assigned', 'completed']);
      API.dates(D.open || [], ['due']);
      (D.mine || []).forEach(function (c) { API.dates(c.history, ['at']); });
    }
    if (role === 'representative') API.dates(D.subs || [], ['due', 'created', 'completed']);
    if (role === 'supervisor') API.dates(D.challenges || [], ['due', 'created', 'completed']);
  }
  function noteOpener(n) {
    if (n.kind === 'meeting') return function () { showMeeting(n.ref || n.about); };
    if (n.kind === 'assign' && role === 'student') return function () { setActive('solve', true); };
    if (n.kind === 'alert' && role === 'supervisor' && /^DCC\d{5}$/i.test(n.about || '')) return function () { setActive('audit', true); };
    if (n.kind === 'alert') return function () { setActive(role === 'supervisor' ? 'solve' : 'submit', true); };
    return null;
  }
  function reload() {
    if (!live) { renderPanel(); return Promise.resolve(); }
    return API.get('/dashboard/' + role).then(function (data) {
      D = data; ME = D.me; normalize(); U.shell(shellCfg()); U.serverNotes(D.notes, noteOpener);
      if (active === 'meetings') return API.get('/meetings').then(function (m) { MEET = m; renderPanel(); });
      if (active === 'audit') return loadAudit();
      renderPanel();
    }).catch(API.fail);
  }
  function done(msg) { U.toast(msg || 'Saved.', 'ok'); sel = null; reload(); }

  /* ---------- nav + one panel ---------- */
  function renderNav() {
    document.getElementById('ws-nav').innerHTML = ALL_NAV.map(function (b) {
      var ok = canUse(b[0]);
      return '<button class="ws-btn' + (active === b[0] ? ' active' : '') + '" data-nav="' + b[0] + '"' +
        (ok ? ' aria-pressed="' + (active === b[0]) + '"' : ' disabled aria-disabled="true"') +
        '>' + esc(b[1]) + '</button>';
    }).join('');
  }
  function setActive(key, force) {
    if (!canUse(key)) return;
    if (!force && active === key) { active = null; sel = null; renderNav(); renderEmpty(); return; }
    active = key; sel = null; renderNav();
    if (key === 'meetings') { openMeetings(); return; }
    if (key === 'audit') { openAudit(); return; }
    renderPanel();
  }
  function openMeetings() {
    if (live) API.get('/meetings').then(function (m) { MEET = m; renderPanel(); }).catch(API.fail);
    else { MEET = demoMeetings(); renderPanel(); }
  }
  function showMeeting(id) {
    var m = ((MEET && MEET.meetings) || []).filter(function (x) { return x.id === id; })[0];
    if (m) return U.meetingDetails(m);
    if (live) return API.get('/meetings').then(function (x) {
      MEET = x; m = (x.meetings || []).filter(function (y) { return y.id === id; })[0];
      if (m) U.meetingDetails(m); else U.toast('Meeting not found.', 'err');
    }).catch(API.fail);
    m = (demoMeetings().meetings || []).filter(function (x) { return x.id === id; })[0];
    if (m) U.meetingDetails(m);
  }
  document.getElementById('ws-nav').addEventListener('click', function (e) {
    var b = e.target.closest('[data-nav]'); if (b && !b.disabled) setActive(b.dataset.nav);
  });
  function renderEmpty() {
    var pt = document.getElementById('page-title');
    if (pt) { pt.textContent = 'Workspace'; document.title = 'Workspace — Development Challenges Community'; }
    document.getElementById('content').innerHTML = '<section class="ws-brand-empty" aria-hidden="true"></section>';
  }
  function renderPanel() {
    if (!active) return renderEmpty();
    var html = '';
    if (role === 'student' && active === 'solve') html = studentSolve();
    else if (role === 'student' && active === 'track') html = studentTrack();
    else if (role === 'representative' && active === 'submit') html = repSubmit();
    else if (role === 'representative' && active === 'track') html = repTrack();
    else if (role === 'supervisor' && active === 'submit') html = supSubmit();
    else if (role === 'supervisor' && active === 'solve') html = supSolve();
    else if (role === 'supervisor' && active === 'track') html = supTrack();
    else if (active === 'meetings') html = meetingsPanel();
    else if (role === 'supervisor' && active === 'audit') html = auditPanel();
    document.getElementById('content').innerHTML = html;
    bindPanel();
  }

  /* ---------- student ---------- */
  function studentSolve() {
    var mine = {}, open = D.open || [];
    (D.mine || []).forEach(function (c) { mine[c.id] = true; });
    var rows = open.map(function (c) {
      var assigned = !!mine[c.id];
      var action = assigned ? '<button data-pick="progress|' + esc(c.id) + '" class="btn btn-primary btn-sm w-full">Update</button>'
        : '<button data-view="' + esc(c.id) + '" class="btn btn-sm w-full">View</button>';
      return [U.cell(c.title, c.id + (assigned ? ' · your team' : '')), dueCell(c.due), action];
    });
    var cols = [['Challenge', 'minmax(0,1fr)'], ['Deadline', '100px'], ['Action', '112px']];
    var html = panelHead('solve') +
      U.card({ id: 'op', title: 'Open challenges', count: open.length, body: U.table(cols, rows, 'No open challenges right now.') });
    if (sel && sel.kind === 'progress') html += progressForm();
    return html;
  }
  function studentTrack() {
    var mine = D.mine || [];
    var rows = mine.map(function (c) {
      var sub = c.id + (teamText(c) ? ' · ' + esc(teamText(c)) : '');
      return [U.cell(c.title, sub), U.badge(label(c.status)), bar(c.pct), dueCell(c.due),
        '<button data-pick="progress|' + esc(c.id) + '" class="btn btn-sm w-full">Update</button>'];
    });
    var cols = [['Challenge', 'minmax(0,1fr)'], ['Status', '112px'], ['Progress', '132px'], ['Deadline', '100px'], ['Action', '100px']];
    var html = panelHead('track') +
      U.card({ id: 'st', title: 'My work', count: mine.length, body: U.table(cols, rows, 'No challenge assigned yet.') });
    if (sel && sel.kind === 'progress') html += progressForm();
    return html;
  }
  function progressForm() {
    var c = findCh(sel.id); if (!c) return '';
    return formCard('Update progress — ' + c.id,
      '<p class="mb-3 font-semibold">' + esc(c.title) + '</p>' +
      '<div class="ws-field"><label class="label" for="f-pct">Completion: <b id="f-pct-out">' + (c.pct || 0) + '%</b></label><input id="f-pct" type="range" min="0" max="100" step="5" value="' + (c.pct || 0) + '" class="w-full accent-brand-700"></div>' +
      '<div class="ws-field"><label class="label" for="f-note">What did you complete? <span class="text-red-600">*</span></label><textarea id="f-note" rows="3" class="input"></textarea><span id="f-note-err" class="err"></span></div>',
      cancelBtn + btn('Save update', 'progress', null, 'primary'));
  }

  /* ---------- representative ---------- */
  function repSubmit() {
    var info = (D.subs || []).filter(function (c) { return c.status === 'Pending Information'; });
    var html = panelHead('submit');
    if (info.length) html += U.card({ id: 'info', title: 'More details requested', count: info.length, tone: 'warn', countRight: true,
      body: U.list(info.map(function (c) {
        return '<div class="min-w-0 flex-1">' + U.cell(c.title, esc(c.request || ''), 'warn') + '</div><button data-pick="respond|' + esc(c.id) + '" class="btn btn-sm w-28 shrink-0">Respond</button>';
      }), 'Nothing needs your input.') });
    html += challengeForm(true);
    if (sel && sel.kind === 'respond') html += respondForm();
    return html;
  }
  function challengeForm(withFunding) {
    var min = U.isoDay(new Date(Date.now() + U.DAY));
    return U.card({ id: 'newch', label: 'New challenge', body:
      '<div class="ws-field"><label class="label" for="f-title">Challenge title <span class="text-red-600">*</span></label><input id="f-title" class="input"><span id="f-title-err" class="err"></span></div>' +
      '<div class="ws-field"><label class="label" for="f-due">Deadline <span class="text-red-600">*</span></label><input id="f-due" type="date" min="' + min + '" class="input"><span id="f-due-err" class="err"></span></div>' +
      '<div class="ws-field"><label class="label" for="f-desc">Description <span class="text-red-600">*</span></label><textarea id="f-desc" rows="3" class="input"></textarea><span id="f-desc-err" class="err"></span></div>' +
      '<div class="ws-field"><label class="label" for="f-detail">More detail <span class="ws-hint">(optional)</span></label><textarea id="f-detail" rows="3" class="input"></textarea></div>' +
      (withFunding ? '<div class="ws-field"><span class="label">Will your organisation fund this project? <span class="text-red-600">*</span></span><div class="ws-2col"><label class="ws-opt"><input type="radio" name="f-fund" value="yes">Yes, we will fund it</label><label class="ws-opt"><input type="radio" name="f-fund" value="no">No, we can\'t fund it</label></div><span id="f-fund-err" class="err"></span></div>' : '') +
      '<div class="ws-form-actions">' + btn('Submit challenge', 'newchallenge', null, 'primary') + '</div>' });
  }
  function respondForm() {
    var c = findCh(sel.id); if (!c) return '';
    return formCard('Add more details — ' + c.id,
      '<p class="mb-1 font-semibold">' + esc(c.title) + '</p><p class="ws-quote mb-3"><b>Supervisor’s request:</b> ' + esc(c.request || '') + '</p>' +
      '<div class="ws-field"><label class="label" for="f-text">Your response <span class="text-red-600">*</span></label><textarea id="f-text" rows="3" class="input"></textarea><span id="f-text-err" class="err"></span></div>',
      cancelBtn + btn('Send & resubmit', 'respond', null, 'primary'));
  }
  function repTrack() {
    var subs = D.subs || [];
    var rows = subs.map(function (c) {
      var sub = c.id + (teamText(c) ? ' · ' + esc(teamText(c)) : '') + (c.supervisor ? ' · ' + esc(c.supervisor) : '');
      return [U.cell(c.title, sub), U.badge(label(c.status)), bar(c.pct), U.dayChip(c.due)];
    });
    return panelHead('track') +
      U.card({ id: 'rt', title: 'My submissions', count: subs.length, body: U.list(rows, 'You have not submitted a challenge yet.') });
  }

  /* ---------- supervisor ---------- */
  function supSubmit() {
    return panelHead('submit') + challengeForm(false);
  }
  function supSolve() {
    var all = D.challenges || [];
    var review = all.filter(function (c) { return c.status === 'Submitted' || c.status === 'Under Review'; });
    var rows = review.map(function (c) {
      return '<div class="min-w-0 flex-1">' + U.cell(c.title, 'by ' + esc(c.by || '') + ' · ' + c.id) + '</div>' + U.badge(label(c.status)) +
        '<button data-pick="review|' + esc(c.id) + '" class="btn btn-sm w-28 shrink-0">Review</button>';
    });
    var open = all.filter(function (c) { return OPEN.indexOf(c.status) > -1; });
    var openRows = open.map(function (c) {
      var sub = c.id + (teamText(c) ? ' · ' + esc(teamText(c)) : '');
      return [U.cell(c.title, sub), U.badge(label(c.status)), bar(c.pct), dueCell(c.due),
        '<button data-view="' + esc(c.id) + '" class="btn btn-sm w-full">View</button>'];
    });
    var html = panelHead('solve') +
      U.card({ id: 'rv', title: 'Awaiting review', count: review.length, body: U.list(rows, 'Nothing to review.') }) +
      U.card({ id: 'op', title: 'In progress', count: open.length,
        body: U.table([['Challenge', 'minmax(0,1fr)'], ['Status', '112px'], ['Progress', '132px'], ['Deadline', '100px'], ['Action', '100px']], openRows, 'No open challenges.') });
    if (sel && sel.kind === 'review') html += reviewForm();
    return html;
  }
  function reviewForm() {
    var c = findCh(sel.id); if (!c) return '';
    return formCard('Review ' + c.id,
      '<div class="mb-3"><div class="font-semibold">' + esc(c.title) + '</div><div class="text-xs text-slate-500">Submitted by ' + esc(c.by || '') + ' · due ' + U.fmt(c.due) + '</div>' +
      (c.funded !== undefined && c.funded !== 'none' ? '<div class="mt-1.5">' + U.funding(c.funded) + '</div>' : '') +
      '<p class="ws-note mt-2">' + esc(c.desc || '') + '</p></div>' +
      '<div class="ws-field"><label class="label" for="f-comment">Comment <span class="ws-hint">(required to reject or request more detail)</span></label><textarea id="f-comment" rows="3" class="input"></textarea><span id="f-comment-err" class="err"></span></div>',
      cancelBtn + btn('Reject', 'review', 'reject', 'danger') + btn('Request more detail', 'review', 'request_info') + btn('Approve', 'review', 'approve', 'primary'));
  }
  function supTrack() {
    var active = (D.challenges || []).filter(function (c) { return c.status === 'Allocated' || c.status === 'In Progress'; });
    var rows = active.map(function (c) {
      var sub = c.id + (teamText(c) ? ' · ' + esc(teamText(c)) : '') + (c.by ? ' · ' + esc(c.by) : '');
      return [U.cell(c.title, sub), U.badge(label(c.status)), bar(c.pct), dueCell(c.due)];
    });
    return panelHead('track') +
      U.card({ id: 'pt', title: 'Active challenges', count: active.length,
        body: U.table([['Challenge', 'minmax(0,1fr)'], ['Status', '112px'], ['Progress', '132px'], ['Deadline', '100px']], rows, 'No active challenges.') }) +
      '<p class="mt-3 text-xs text-slate-500">Capacity ' + (D.load || 0) + ' / ' + (D.cap || 5) + '</p>';
  }

  /* ---------- supervisor meetings ---------- */
  function meetingsPanel() {
    var mine = (MEET && MEET.meetings) || [];
    var rows = mine.map(function (m) {
      return '<div class="ws-meet"><span class="lab">' + esc(m.mode || m.venue || '') + '</span>' +
        '<div class="min-w-0 flex-1"><div class="truncate font-semibold text-slate-900">' + esc(m.title) + (m.cid ? ' <span class="font-normal text-slate-500">· ' + m.cid + '</span>' : '') + '</div>' +
        '<div class="truncate text-[12.5px] text-slate-600">' + esc(U.meetWhen(m)) + '</div></div>' +
        '<button data-mopen="' + esc(m.id) + '" class="btn btn-sm shrink-0">Details</button>' +
        '<button data-mcancel="' + esc(m.id) + '" class="btn btn-sm shrink-0 border-red-200 text-red-700 hover:bg-red-50">Cancel</button></div>';
    });
    return panelHead('meetings') +
      bookingForm() +
      U.card({ id: 'mt', title: 'Upcoming', count: mine.length,
        body: rows.length ? '<div class="mt-2">' + rows.join('') + '</div>' : '<p class="py-6 text-center text-sm text-slate-500">No meetings scheduled.</p>' });
  }
  function bookingForm() {
    var open = (D.challenges || []).filter(function (c) { return OPEN.indexOf(c.status) > -1; });
    var times = []; for (var t = 8 * 60; t <= 17 * 60; t += 30) times.push(U.hhmm(t));
    return U.card({ id: 'book', label: 'New meeting', body:
      '<div class="ws-field"><label class="label" for="m-c">Challenge <span class="text-red-600">*</span></label><select id="m-c" class="input">' +
      open.map(function (c) { return '<option value="' + esc(c.id) + '">' + esc(c.title) + ' (' + esc(c.id) + ')</option>'; }).join('') +
      '</select><span id="m-c-err" class="err"></span></div>' +
      '<div class="ws-field"><label class="label" for="m-t">Meeting title <span class="text-red-600">*</span></label><input id="m-t" class="input" value="Progress review" maxlength="80"><span id="m-t-err" class="err"></span></div>' +
      '<div class="ws-2col ws-field"><div><label class="label" for="m-d">Date <span class="text-red-600">*</span></label><input id="m-d" type="date" min="' + U.isoDay() + '" value="' + U.workday(1) + '" class="input"><span id="m-d-err" class="err"></span></div>' +
      '<div class="ws-2col"><div><label class="label" for="m-s">Start</label><select id="m-s" class="input">' + times.map(function (x) { return '<option' + (x === '10:00' ? ' selected' : '') + '>' + x + '</option>'; }).join('') + '</select><span id="m-s-err" class="err"></span></div>' +
      '<div><label class="label" for="m-m">Length</label><select id="m-m" class="input"><option value="30">30 min</option><option value="60" selected>1 hour</option><option value="90">1½ hours</option><option value="120">2 hours</option></select></div></div></div>' +
      '<div class="ws-field"><span class="label">Mode <span class="text-red-600">*</span></span><div class="ws-2col"><label class="ws-opt"><input type="radio" name="m-mode" value="Online" checked>Online</label><label class="ws-opt"><input type="radio" name="m-mode" value="In person">In person</label></div><span id="m-mode-err" class="err"></span></div>' +
      '<div class="ws-field"><label class="label" for="m-a">Agenda <span class="ws-hint">(optional)</span></label><textarea id="m-a" rows="2" class="input"></textarea></div>' +
      '<div class="ws-form-actions">' + btn('Schedule meeting', 'bookmeeting', null, 'primary') + '</div>' });
  }


  /* ---------- supervisor audit log: manage members + every activity (who, what, when, how long) ---------- */
  var AREA_LABEL = { auth: 'Access', account: 'Accounts', challenge: 'Challenges', meeting: 'Meetings', profile: 'Profile', email: 'E-mail' };
  var STATUS_LABEL = { active: 'Active', pending: 'Pending', locked: 'Locked', rejected: 'Declined' };
  var STATUS_CLS = { active: 'aud-st ok', pending: 'aud-st warn', locked: 'aud-st bad', rejected: 'aud-st off' };
  var DOT = { ok: '#16a34a', bad: '#dc2626', warn: '#eab308', info: '#2b4de0' };
  var PAGE = 50;
  function dur(sec) {
    if (sec == null || sec === '') return '<span class="text-slate-400">—</span>';
    sec = Math.max(0, Math.round(+sec));
    if (sec < 60) return sec + ' s';
    var m = Math.round(sec / 60); if (m < 60) return m + ' min';
    var h = Math.floor(m / 60); m = m % 60; if (h < 48) return h + ' h' + (m ? ' ' + m + ' min' : '');
    return Math.round(h / 24) + ' days';
  }
  function when(ts) {
    var t = ts instanceof Date ? ts : API.date ? API.date(ts) : new Date(ts);
    if (!t || isNaN(t)) return '—';
    return t.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' +
      t.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });
  }
  function openAudit() {
    AUD = AUD || { q: '', area: '', member: '', uq: '', ust: '', limit: PAGE };
    AUD.limit = PAGE;
    loadAudit();
  }
  function auditQuery() {
    var q = [];
    if (AUD.q) q.push('q=' + encodeURIComponent(AUD.q));
    if (AUD.area) q.push('area=' + encodeURIComponent(AUD.area));
    if (AUD.member) q.push('member=' + encodeURIComponent(AUD.member));
    q.push('limit=' + AUD.limit);
    return '?' + q.join('&');
  }
  function loadAudit(logOnly) {
    if (!live) {
      var demo = demoAudit();
      AUD.users = demo.users; AUD.log = filterDemoLog(demo.entries);
      return logOnly ? paintAudit('log') : renderPanel();
    }
    var reqs = [API.get('/audit/log' + auditQuery())];
    if (!logOnly) reqs.push(API.get('/audit/users'));
    return Promise.all(reqs).then(function (r) {
      AUD.log = r[0];
      if (r[1]) { AUD.users = r[1].users; AUD.approval = r[1].require_approval; }
      if (logOnly) paintAudit('log'); else renderPanel();
    }).catch(API.fail);
  }
  function filterDemoLog(all) {
    var q = AUD.q.toLowerCase(), out = all.filter(function (e) {
      return (!AUD.member || e.member === AUD.member) && (!AUD.area || e.action.indexOf(AUD.area + '.') === 0) &&
        (!q || (e.who + ' ' + e.text + ' ' + e.member).toLowerCase().indexOf(q) > -1);
    });
    return { entries: out.slice(0, AUD.limit), total: out.length };
  }
  function auditPanel() {
    panelHead('audit');
    var users = AUD && AUD.users || [];
    var statusOpts = '<option value="">All statuses</option>' + Object.keys(STATUS_LABEL).map(function (k) {
      return '<option value="' + k + '"' + (AUD.ust === k ? ' selected' : '') + '>' + STATUS_LABEL[k] + '</option>'; }).join('');
    var areaOpts = '<option value="">All activity</option>' + Object.keys(AREA_LABEL).map(function (k) {
      return '<option value="' + k + '"' + (AUD.area === k ? ' selected' : '') + '>' + AREA_LABEL[k] + '</option>'; }).join('');
    var counts = { active: 0, pending: 0, locked: 0, online: 0 };
    users.forEach(function (u) { if (counts[u.status] != null) counts[u.status]++; if (u.online) counts.online++; });
    var summary = '<div class="aud-sum">' +
      [['Members', users.length], ['Online now', counts.online], ['Pending', counts.pending], ['Locked', counts.locked]].map(function (k) {
        return '<div><span>' + k[0] + '</span><b>' + k[1] + '</b></div>'; }).join('') + '</div>';
    return summary +
      U.card({ id: 'aud-u', title: 'Members', count: users.length, right:
        '<div class="aud-filters"><input id="aud-uq" class="input" type="search" placeholder="Search name, ID or e-mail" value="' + esc(AUD.uq) + '" aria-label="Search members">' +
        '<select id="aud-ust" class="input" aria-label="Filter by status">' + statusOpts + '</select></div>',
        body: '<div id="aud-users">' + auditUsersTable() + '</div>' }) +
      U.card({ id: 'aud-l', title: 'Activity', right:
        '<div class="aud-filters"><input id="aud-q" class="input" type="search" placeholder="Search activity" value="' + esc(AUD.q) + '" aria-label="Search activity">' +
        '<select id="aud-area" class="input" aria-label="Filter by type">' + areaOpts + '</select></div>',
        body: '<div id="aud-log">' + auditLogTable() + '</div>' });
  }
  function auditUsersTable() {
    var q = (AUD.uq || '').toLowerCase();
    var users = (AUD.users || []).filter(function (u) {
      return (!AUD.ust || u.status === AUD.ust) && (!q || (u.name + ' ' + u.id + ' ' + u.email + ' ' + u.org).toLowerCase().indexOf(q) > -1);
    });
    var meId = ME.profile && ME.profile.id;
    var rows = users.map(function (u) {
      var acts = '<button data-aud="history|' + esc(u.id) + '" class="btn btn-sm">Activity</button>';
      if (u.status === 'pending') acts += '<button data-aud="approve|' + esc(u.id) + '" class="btn btn-primary btn-sm">Approve</button><button data-aud="decline|' + esc(u.id) + '" class="btn btn-sm border-red-200 text-red-700 hover:bg-red-50">Decline</button>';
      else if (u.status === 'locked') acts += '<button data-aud="unlock|' + esc(u.id) + '" class="btn btn-primary btn-sm">Unlock</button>';
      else if (u.status === 'active' && u.id !== meId) acts += '<button data-aud="lock|' + esc(u.id) + '" class="btn btn-sm border-red-200 text-red-700 hover:bg-red-50">Lock</button>';
      var st = '<span class="' + (STATUS_CLS[u.status] || 'aud-st') + '">' + (STATUS_LABEL[u.status] || esc(u.status)) + '</span>' +
        (u.online ? ' <span class="aud-online" title="Signed in now">online</span>' : '') +
        (u.why ? '<div class="truncate text-[11.5px] text-slate-500">' + esc(u.why) + '</div>' : '');
      return [U.cell(u.name, esc(u.id) + ' · ' + esc(u.email)), esc(u.role), st,
        '<span class="text-slate-700">' + (u.last_login ? when(u.last_login) : '<span class="text-slate-400">Never</span>') + '</span>',
        (u.sessions ? '<span class="tabular-nums text-slate-700">' + dur(u.time_online) + '<span class="block text-[11.5px] text-slate-500">' + u.sessions + ' sign-in' + (u.sessions === 1 ? '' : 's') + '</span></span>' : '<span class="text-slate-400">—</span>'),
        '<div class="aud-acts">' + acts + '</div>'];
    });
    return '<div class="aud-scroll">' + U.table([['Member', 'minmax(200px,1fr)'], ['Role', '110px'], ['Status', '120px'], ['Last sign-in', '150px'], ['Time signed in', '120px'], ['Action', '240px']],
      rows, 'No members match.') + '</div>';
  }
  function auditLogTable() {
    var L = AUD.log || { entries: [], total: 0 }, list = L.entries || [];
    var rows = list.map(function (e) {
      var who = e.member ? esc(e.member) + (e.role ? ' · ' + esc(e.role) : '') : 'System';
      var d = dur(e.duration);
      if (e.action === 'auth.login' && e.session) d += '<span class="block text-[11.5px] ' + (e.session === 'active' ? 'text-green-700' : 'text-slate-500') + '">' + (e.session === 'active' ? 'still signed in' : e.session === 'idle' ? 'no recent activity' : 'signed out') + '</span>';
      return ['<span class="tabular-nums text-slate-700">' + when(e.at) + '</span>',
        U.cell(e.who, who),
        '<div class="flex min-w-0 items-start gap-2"><i class="mt-1.5 inline-block size-2 shrink-0 rounded-full" style="background:' + (DOT[e.kind] || DOT.info) + '"></i>' +
          '<div class="min-w-0"><div class="aud-text text-slate-800">' + esc(e.text) + '</div><div class="text-[11.5px] text-slate-500">' + esc(AREA_LABEL[(e.action || '').split('.')[0]] || 'Other') + (e.ip ? ' · ' + esc(e.ip) : '') + '</div></div></div>',
        '<span class="tabular-nums text-slate-700">' + d + '</span>'];
    });
    var chip = AUD.member ? '<div class="aud-chip">Showing activity for <b>' + esc(AUD.member) + '</b><button data-aud="clear|" class="btn btn-sm">Show everyone</button></div>' : '';
    var more = list.length < (L.total || 0) ? '<div class="mt-3 text-center"><button data-aud="more|" class="btn btn-sm">Show more (' + ((L.total || 0) - list.length) + ' older)</button></div>' : '';
    return chip + '<div class="aud-scroll">' + U.table([['When', '150px'], ['By whom', 'minmax(170px,1fr)'], ['What was done', 'minmax(260px,2fr)'], ['How long', '130px']],
      rows, 'No activity recorded.') + '</div>' + '<p class="mt-2 text-[12px] text-slate-500">' + list.length + ' of ' + (L.total || 0) + ' entries. “How long” is the length of a sign-in, the wait before a decision, the time a challenge took, or a meeting’s length.</p>' + more;
  }
  function paintAudit(part) {
    var box = document.getElementById(part === 'log' ? 'aud-log' : 'aud-users');
    if (box) box.innerHTML = part === 'log' ? auditLogTable() : auditUsersTable();
  }
  var audTimer = null;
  document.getElementById('content').addEventListener('input', function (e) {
    if (active !== 'audit' || !AUD) return;
    if (e.target.id === 'aud-uq') { AUD.uq = e.target.value.trim(); paintAudit('users'); }
    if (e.target.id === 'aud-q') { AUD.q = e.target.value.trim(); AUD.limit = PAGE; clearTimeout(audTimer); audTimer = setTimeout(function () { loadAudit(true); }, 300); }
  });
  document.getElementById('content').addEventListener('change', function (e) {
    if (active !== 'audit' || !AUD) return;
    if (e.target.id === 'aud-ust') { AUD.ust = e.target.value; paintAudit('users'); }
    if (e.target.id === 'aud-area') { AUD.area = e.target.value; AUD.limit = PAGE; loadAudit(true); }
  });
  function auditAction(kind, id) {
    var u = (AUD.users || []).filter(function (x) { return x.id === id; })[0];
    if (kind === 'more') { AUD.limit += PAGE; return loadAudit(true); }
    if (kind === 'clear') { AUD.member = ''; AUD.limit = PAGE; return loadAudit(true); }
    if (kind === 'history') {
      AUD.member = id; AUD.limit = PAGE; loadAudit(true);
      var card = document.getElementById('h-aud-l'); if (card) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (!u) return;
    var details = '<dl class="ws-dl mb-3"><div><dt>Member</dt><dd>' + esc(u.name) + ' · ' + esc(u.id) + '</dd></div><div><dt>Role</dt><dd>' + esc(u.role) + '</dd></div>' +
      '<div><dt>Organisation</dt><dd>' + esc(u.org || '') + '</dd></div><div><dt>Email</dt><dd>' + esc(u.email) + '</dd></div>' +
      '<div><dt>Registered</dt><dd>' + when(u.joined) + '</dd></div></dl>';
    var reasonBox = '<div class="ws-field"><label class="label" for="aud-reason">Reason <span class="text-red-600">*</span></label><textarea id="aud-reason" rows="2" class="input"></textarea><span id="aud-reason-err" class="err"></span></div>';
    var post = function (path, body, demoStatus) {
      if (live) { API.post('/approvals/users/' + encodeURIComponent(id) + '/' + path, body || {}).then(function (r) { U.toast(r.message, 'ok'); loadAudit(); }).catch(API.fail); return; }
      u.status = demoStatus; U.toast('Account updated.', 'ok'); renderPanel();
    };
    var needReason = function () {
      var r = (document.getElementById('aud-reason') || {}).value || '';
      if (r.trim().length < 3) { document.getElementById('aud-reason-err').textContent = 'Give a reason (3+ characters).'; return null; }
      return r.trim();
    };
    if (kind === 'approve') return U.modal('Approve account', details + '<p>' + esc(u.name) + ' will be able to log in and will receive an e-mail.</p>',
      [{ label: 'Cancel' }, { label: 'Approve & activate', primary: true, onClick: function () { post('approve', {}, 'active'); } }]);
    if (kind === 'decline') return U.modal('Decline registration', details + reasonBox,
      [{ label: 'Cancel' }, { label: 'Decline', danger: true, onClick: function () { var r = needReason(); if (!r) return false; post('reject', { reason: r }, 'rejected'); } }]);
    if (kind === 'lock') return U.modal('Lock account', details + '<p class="mb-3">' + esc(u.name) + ' will be signed out and cannot log in until the account is unlocked.</p>' + reasonBox,
      [{ label: 'Cancel' }, { label: 'Lock account', danger: true, onClick: function () { var r = needReason(); if (!r) return false; post('lock', { reason: r }, 'locked'); } }]);
    if (kind === 'unlock') return U.modal('Unlock account', details + '<p>' + esc(u.name) + ' will be able to log in again.</p>',
      [{ label: 'Cancel' }, { label: 'Unlock account', primary: true, onClick: function () { post('unlock', {}, 'active'); } }]);
  }

  /* ---------- read-only detail ---------- */
  function viewChallenge(id) {
    var c = findCh(id); if (!c) return;
    var row = function (k, v) { return '<div><dt>' + k + '</dt><dd>' + v + '</dd></div>'; };
    var body = '<p class="mb-2 font-semibold">' + esc(c.title) + '</p><dl class="ws-dl">' + row('Deadline', U.fmt(c.due));
    if (c.desc) body += row('Description', esc(c.desc));
    if (teamText(c)) body += row('Team', esc(teamText(c)));
    if (c.pct != null) body += row('Progress', (c.pct || 0) + '%');
    body += '</dl>';
    U.modal(c.id, body, [{ label: 'Close' }]);
  }

  /* ---------- bind + actions ---------- */
  function bindPanel() {
    var pct = document.getElementById('f-pct');
    if (pct) pct.addEventListener('input', function () { document.getElementById('f-pct-out').textContent = this.value + '%'; });
  }
  document.getElementById('content').addEventListener('click', function (e) {
    var pick = e.target.closest('[data-pick]');
    if (pick) { var p = pick.dataset.pick.split('|'); sel = { kind: p[0], id: p[1] }; renderPanel(); return; }
    if (e.target.closest('[data-cancel]')) { sel = null; renderPanel(); return; }
    var view = e.target.closest('[data-view]'); if (view) return viewChallenge(view.dataset.view);
    var mo = e.target.closest('[data-mopen]'); if (mo) return showMeeting(mo.dataset.mopen);
    var mc = e.target.closest('[data-mcancel]'); if (mc) return cancelMeeting(mc.dataset.mcancel);
    var au = e.target.closest('[data-aud]'); if (au) { var a = au.dataset.aud.split('|'); return auditAction(a[0], a[1]); }
    var doBtn = e.target.closest('[data-do]'); if (doBtn) doAction(doBtn.dataset.do, doBtn.dataset.action);
  });
  function cancelMeeting(id) {
    var m = ((MEET && MEET.meetings) || []).filter(function (x) { return x.id === id; })[0]; if (!m) return;
    U.modal('Cancel meeting', '<p>Cancel <b>' + esc(m.title) + '</b> on ' + esc(U.meetWhen(m)) + '? Everyone invited will be notified.</p>',
      [{ label: 'Keep' }, { label: 'Cancel meeting', danger: true, onClick: function () {
        if (live) return API.del('/meetings/' + id).then(function (r) { done(r.message); }).catch(API.fail);
        MEET.meetings = MEET.meetings.filter(function (x) { return x.id !== id; }); U.toast('Meeting cancelled. Everyone notified.', 'ok'); renderPanel();
      } }]);
  }
  var FEMAP = {
    progress: { pct: 'f-pct', note: 'f-note' },
    newchallenge: { title: 'f-title', description: 'f-desc', due_date: 'f-due', funded: 'f-fund' },
    respond: { response: 'f-text' }, review: { comment: 'f-comment' },
    bookmeeting: { challenge: 'm-c', title: 'm-t', date: 'm-d', mode: 'm-mode', start: 'm-s' }
  };
  function doAction(kind, action) {
    clearErrs();
    var ferr = function (er) { API.fieldErrors(er, FEMAP[kind] || {}); API.fail(er); };
    var id = sel ? sel.id : null, c = id ? findCh(id) : null;

    if (kind === 'progress') {
      var note = val('f-note'); if (note.length < 5) return setErr('f-note', 'Describe your progress (5+ characters).');
      var pct = +raw('f-pct');
      if (live) return API.post('/challenges/' + encodeURIComponent(id) + '/progress', { pct: pct, note: note }).then(function (r) { done(r.message); }).catch(ferr);
      c.pct = pct; (c.history = c.history || []).push({ at: new Date(), pct: pct, note: note });
      if (pct >= 100) { c.status = 'Completed'; c.completed = new Date(); return done('Work completed.'); }
      c.status = 'In progress'; return done('Progress updated to ' + pct + '%.');
    }
    if (kind === 'newchallenge') {
      var t = val('f-title'), due = val('f-due'), desc = val('f-desc'), detail = val('f-detail'), ok = true;
      if (t.length < 5) ok = setErr('f-title', 'Enter a title (5+ characters).') && ok;
      if (!due) ok = setErr('f-due', 'Choose a deadline.') && ok;
      if (desc.length < 20) ok = setErr('f-desc', 'Describe the challenge (20+ characters).') && ok;
      var fund = document.querySelector('input[name=f-fund]:checked');
      if (role === 'representative' && !fund) ok = setErr('f-fund', 'Choose whether your organisation will fund this project.') && ok;
      if (!ok) return;
      if (live) return API.post('/challenges', { title: t, description: desc, detail: detail, due_date: due, funded: fund ? fund.value : undefined }).then(function (r) { done(r.message); }).catch(ferr);
      var nid = 'DCC-' + String(100 + Math.floor(Math.random() * 800)).padStart(6, '0');
      var nc = { id: nid, title: t, desc: desc + (detail ? '\n\nMore detail: ' + detail : ''), due: new Date(due + 'T17:00'), pct: 0,
        status: 'Review', funded: fund ? fund.value === 'yes' : 'none', by: ME.name, team: [], supervisor: ME.name };
      if (role === 'representative') D.subs.unshift(nc); else D.challenges.unshift(nc);
      return done(nid + ' submitted.');
    }
    if (kind === 'respond') {
      var text = val('f-text'); if (text.length < 5) return setErr('f-text', 'Write a short response (5+ characters).');
      if (live) return API.post('/challenges/' + encodeURIComponent(id) + '/respond', { response: text }).then(function (r) { done(r.message); }).catch(ferr);
      c.status = 'Review'; delete c.request; return done('More detail sent.');
    }
    if (kind === 'review') {
      var comment = val('f-comment');
      if ((action === 'reject' || action === 'request_info') && comment.length < 3) return setErr('f-comment', action === 'reject' ? 'Give a reason for rejecting.' : 'Say what detail is needed.');
      if (live) return API.post('/challenges/' + encodeURIComponent(id) + '/review', { action: action, comment: comment }).then(function (r) { done(r.message); }).catch(ferr);
      if (action === 'approve') { c.status = 'Allocated'; c.team = ['Auto-assigned team']; }
      else if (action === 'request_info') { c.status = 'More details'; c.request = comment; }
      else c.status = 'Closed';
      return done(id + ' updated.');
    }
    if (kind === 'bookmeeting') {
      var cid = val('m-c'), title2 = val('m-t'), day = val('m-d'), start = val('m-s'), mins = +val('m-m');
      var mode = (document.querySelector('input[name=m-mode]:checked') || {}).value, ok2 = true;
      if (!cid) ok2 = setErr('m-c', 'Choose a challenge.') && ok2;
      if (title2.length < 3) ok2 = setErr('m-t', 'Give the meeting a title.') && ok2;
      if (!day) ok2 = setErr('m-d', 'Choose a date.') && ok2;
      else if (new Date(day + 'T' + start) <= new Date()) ok2 = setErr('m-d', 'Choose a time in the future.') && ok2;
      if (!mode) ok2 = setErr('m-mode', 'Choose Online or In person.') && ok2;
      if (!ok2) return;
      if (live) return API.post('/meetings', { challenge: cid, title: title2, date: day, start: start, mins: mins, mode: mode, agenda: val('m-a') }).then(function (r) { done(r.message); }).catch(ferr);
      var ch2 = findCh(cid), people = [];
      (Array.isArray(ch2.team) ? ch2.team : []).concat(ch2.by ? [ch2.by] : [], ch2.supervisor ? [ch2.supervisor] : [ME.name]).forEach(function (p) { if (people.indexOf(p) < 0) people.push(p); });
      MEET.meetings.push({ id: 'M-' + (100 + MEET.meetings.length), cid: cid, title: title2, challenge: ch2 ? ch2.title + ' (' + cid + ')' : cid,
        date: day, start: start, mins: mins, mode: mode, organiser: ME.name, people: people, agenda: val('m-a') });
      return done('Meeting scheduled. Everyone invited is notified.');
    }
  }

  /* ---------- demo data (live mode is the default) ---------- */
  function demoData(r) {
    var profiles = {
      student: { name: 'Amahle Mthembu', initials: 'AM', meta: 'Student · DCC00002', roleLabel: 'Student',
        interests: ['Design, Media & Communication'], profile: { id: 'DCC00002', email: 'amahle.mthembu@unizulu.ac.za', org: 'University of Zululand', interest: 'Design, Media & Communication', joined: '2026-02-14' } },
      representative: { name: 'Sbongokuhle Msomi', initials: 'SM', meta: 'Representative · DCC00003', roleLabel: 'Representative', org: 'BET Media',
        profile: { id: 'DCC00003', email: 'sbongokuhle@betmedia.co.za', org: 'BET Media', joined: '2026-01-22' } },
      supervisor: { name: 'Dr Sipho Ndlovu', initials: 'SN', meta: 'Supervisor · DCC00011', roleLabel: 'Supervisor',
        profile: { id: 'DCC00011', email: 's.ndlovu@unizulu.ac.za', org: 'University of Zululand', interest: 'Data Science & Machine Learning', joined: '2025-08-03' } }
    };
    var me = profiles[r], events = [];
    if (r === 'student') return { me: me, events: events, notes: [],
      mine: [{ id: 'DCC-000001', title: 'Expansion of knowledge through communication', status: 'In Progress', supervisor: 'Dr Sipho Ndlovu',
        due: d(24), pct: 45, history: [{ at: d(-5), pct: 45, note: 'Campaign drafts shared.' }], assigned: d(-20), team: ['Amahle Mthembu'],
        desc: 'A communication campaign to expand knowledge.' }],
      open: [
        { id: 'DCC-000003', title: 'Student dropout early-warning dashboard', status: 'Open', due: d(50), desc: 'Flag first-year students at risk.' },
        { id: 'DCC-000005', title: 'Reduce queues at the campus clinic', status: 'Open', due: d(29), desc: 'Give patients wait-time updates.' },
        { id: 'DCC-000014', title: 'Community radio podcast series', status: 'Open', due: d(70), desc: 'A podcast series about youth opportunities.' }
      ] };
    if (r === 'representative') return { me: me, events: events, notes: [],
      subs: [
        { id: 'DCC-000001', funded: true, title: 'Expansion of knowledge through communication', status: 'In Progress', due: d(24), pct: 45, team: ['Amahle Mthembu'], supervisor: 'Dr Sipho Ndlovu' },
        { id: 'DCC-000010', funded: false, title: 'Community health-literacy workshops', status: 'Pending Information', due: d(30), pct: 0, request: 'Please attach the partner clinic letters and expected attendance numbers.' },
        { id: 'DCC-000005', funded: true, title: 'Phishing awareness training portal', status: 'Review', due: d(45), pct: 0 }
      ] };
    return { me: me, events: events, notes: [], cap: 5, load: 3,
      challenges: [
        { id: 'DCC-000006', funded: true, title: 'Automated timetable clash detection', by: 'Kagiso Nkosi', status: 'Submitted', due: d(60), desc: 'Detect lecture and venue clashes.', team: [] },
        { id: 'DCC-000003', funded: true, title: 'Student dropout early-warning dashboard', by: 'Kagiso Nkosi', status: 'Open', due: d(50), desc: 'Combine activity and attendance data.', team: [] },
        { id: 'DCC-000001', funded: true, title: 'Expansion of knowledge through communication', by: 'Sbongokuhle Msomi', status: 'In Progress', due: d(24), team: ['Amahle Mthembu'], pct: 45 },
        { id: 'DCC-000002', funded: true, title: 'Cafeteria food-waste reduction study', by: 'Kagiso Nkosi', status: 'In Progress', due: d(3), team: ['Thando Khumalo'], pct: 85 }
      ] };
  }
  function demoAudit() {
    var h = function (n) { return new Date(Date.now() - n * 3600 * 1000); };
    return {
      users: [
        { id: 'DCC00231', name: 'Dr Lindiwe Mabaso', role: 'Supervisor', org: 'University of Zululand', email: 'l.mabaso@unizulu.ac.za', status: 'pending', joined: h(3), last_login: null, sessions: 0, time_online: 0 },
        { id: 'DCC00118', name: 'Mr Sifiso Gumede', role: 'Student', org: 'University of Zululand', email: 'sifiso.gumede@unizulu.ac.za', status: 'locked', why: '3 failed login attempts', joined: h(900), last_login: h(30), sessions: 4, time_online: 5400 },
        { id: 'DCC00011', name: 'Dr Sipho Ndlovu', role: 'Supervisor', org: 'University of Zululand', email: 's.ndlovu@unizulu.ac.za', status: 'active', joined: h(5000), last_login: h(0.2), sessions: 12, time_online: 31000, online: true },
        { id: 'DCC00002', name: 'Amahle Mthembu', role: 'Student', org: 'University of Zululand', email: 'amahle.mthembu@unizulu.ac.za', status: 'active', joined: h(4000), last_login: h(20), sessions: 7, time_online: 14200 },
        { id: 'DCC00003', name: 'Sbongokuhle Msomi', role: 'Representative', org: 'BET Media', email: 'sbongokuhle@betmedia.co.za', status: 'active', joined: h(4500), last_login: h(26), sessions: 5, time_online: 6100 }
      ],
      entries: [
        { at: h(0.2), who: 'Dr Sipho Ndlovu', member: 'DCC00011', role: 'Supervisor', action: 'auth.login', text: 'signed in.', kind: 'info', duration: 720, session: 'active' },
        { at: h(3), who: 'Dr Lindiwe Mabaso', member: 'DCC00231', role: 'Supervisor', action: 'auth.register', text: 'registered as a Supervisor — awaiting approval.', kind: 'warn' },
        { at: h(3), who: 'System', member: 'DCC00231', role: 'Supervisor', action: 'email.registration', text: 'sent the confirmation e-mail to l.mabaso@unizulu.ac.za.', kind: 'ok' },
        { at: h(19), who: 'Amahle Mthembu', member: 'DCC00002', role: 'Student', action: 'challenge.progress', text: 'updated DCC-000001 to 45%: Campaign drafts shared.', kind: 'info' },
        { at: h(20), who: 'Amahle Mthembu', member: 'DCC00002', role: 'Student', action: 'auth.login', text: 'signed in.', kind: 'info', duration: 1620, session: 'ended' },
        { at: h(24), who: 'Dr Sipho Ndlovu', member: 'DCC00011', role: 'Supervisor', action: 'challenge.approve', text: 'approved DCC-000003 “Student dropout early-warning dashboard”.', kind: 'ok', duration: 172800 },
        { at: h(30), who: 'System', member: 'DCC00118', role: 'Student', action: 'account.locked', text: '3 failed login attempts for DCC00118 — account locked.', kind: 'bad' }
      ]
    };
  }
  function demoMeetings() {
    if (role === 'supervisor') return { meetings: [
      { id: 'M-101', cid: 'DCC-000001', title: 'Progress review', challenge: 'Expansion of knowledge through communication (DCC-000001)',
        date: U.workday(1), start: '10:00', mins: 60, mode: 'Online', organiser: ME.name, people: ['Amahle Mthembu', 'Sbongokuhle Msomi', ME.name], agenda: 'Next milestones.' }
    ], booked: [] };
    return { meetings: [
      { id: 'M-101', cid: 'DCC-000001', title: 'Progress review', challenge: 'Expansion of knowledge through communication (DCC-000001)',
        date: U.workday(1), start: '10:00', mins: 60, mode: 'Online', organiser: 'Dr Sipho Ndlovu', people: [ME.name], agenda: 'Next milestones.' }
    ], booked: [] };
  }
  function demoNotes() {
    if (role === 'student') return [{ kind: 'meeting', from: 'Dr Sipho Ndlovu', about: 'DCC-000001', text: 'Meeting: Progress review · ' + U.workday(1) + ' 10:00 · Online.', ref: 'M-101', ago: 0, unread: true }];
    if (role === 'representative') return [{ kind: 'meeting', from: 'Dr Sipho Ndlovu', about: 'DCC-000001', text: 'Meeting: Progress review · ' + U.workday(1) + ' 10:00 · Online.', ref: 'M-101', ago: 0, unread: true }];
    return [{ kind: 'alert', from: 'Dr Lindiwe Mabaso', about: 'DCC00231', text: 'New Supervisor account is waiting for approval.', ago: 0, unread: true }];
  }

  start();
})();
