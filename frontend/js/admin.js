/* Administrator dashboard — members, account approvals, organisations and system activity.
   Replace the sample data with your API (e.g. GET /api/admin/dashboard). */
(function () {
  'use strict';
  var U = UI, d = function (n) { return new Date(Date.now() + n * U.DAY); };
  var ME = { name: 'Nokuthula Mkhize', initials: 'NM', meta: 'Administrator' };

  /* Colours: roles get their own fixed hues; statuses use the spec colours. */
  var ROLE = { Student: '#1d4ed8', Supervisor: '#0d9488', Representative: '#7c3aed' };
  var ST = { 'Submitted': '#2563eb', 'Under Review': '#a16207', 'Unallocated': '#94a3b8', 'In Progress': '#f97316', 'Pending Verification': '#eab308', 'Completed': '#16a34a', 'Rejected': '#dc2626' };
  var NEW = '#1d4ed8', URGENT = '#dc2626';

  /* ---------- Sample data ---------- */
  var MEMBERS = { Student: 148, Supervisor: 23, Representative: 41 };
  var PENDING = [
    { id: 'DCC00231', name: 'Dr Lindiwe Mabaso', role: 'Supervisor', org: 'University of Zululand', email: 'l.mabaso@unizulu.ac.za', when: d(0) },
    { id: 'DCC00229', name: 'Mr Themba Shezi', role: 'Supervisor', org: 'Mangosuthu University of Technology', email: 't.shezi@mut.ac.za', when: d(-1) },
    { id: 'DCC00226', name: 'Ms Zanele Ngcobo', role: 'Representative', org: 'uMhlathuze Municipality', email: 'z.ngcobo@umhlathuze.gov.za', when: d(-2) },
    { id: 'DCC00224', name: 'Mr Bongani Sithole', role: 'Representative', org: 'BET Media', email: 'bongani@betmedia.co.za', when: d(-3) },
    { id: 'DCC00219', name: 'Prof Kavitha Naidoo', role: 'Supervisor', org: 'University of Zululand', email: 'k.naidoo@unizulu.ac.za', when: d(-5) },
    { id: 'DCC00215', name: 'Ms Palesa Molefe', role: 'Representative', org: 'Richards Bay Clinic Trust', email: 'palesa@rbct.org.za', when: d(-8) }
  ];
  var ORGS = [['University of Zululand', 96], ['Mangosuthu University of Technology', 38], ['uMhlathuze Municipality', 21], ['BET Media', 14], ['Richards Bay Clinic Trust', 11], ['Other', 32]];
  var ORG_TOTAL = 14;   // registered organisations ("Other" groups the smaller ones)
  var CHALLENGES = { 'Submitted': 9, 'Under Review': 4, 'Unallocated': 7, 'In Progress': 18, 'Pending Verification': 5, 'Completed': 31, 'Rejected': 3 };
  // New members per month by role (oldest → newest, 12 months)
  var JOINED = { Student: [6, 9, 4, 3, 8, 12, 9, 14, 10, 19, 15, 22], Supervisor: [0, 1, 0, 1, 0, 1, 1, 1, 2, 2, 1, 3], Representative: [1, 2, 1, 1, 2, 2, 2, 3, 3, 6, 6, 6] };
  var LOCKED = [{ id: 'DCC00118', name: 'Mr Sifiso Gumede', why: '3 failed login attempts', ago: 1 }, { id: 'DCC00097', name: 'Ms Ayesha Khan', why: '3 failed login attempts', ago: 4 }];
  var period = 6;
  // Dated registrations for the calendar (sample: spread from the monthly totals above)
  var EVENTS = U.monthlyEvents(JOINED.Student, 'Student', ['New student']).concat(U.monthlyEvents(JOINED.Supervisor, 'Supervisor', ['New supervisor']), U.monthlyEvents(JOINED.Representative, 'Representative', ['New representative']));
  var inR = function (k) { return EVENTS.filter(function (e) { return e.kind === k && U.inRange(e.date); }).length; };
  var ACTIVITY = [
    { who: 'Dr Lindiwe Mabaso', text: 'registered as a Supervisor — awaiting approval.', ago: 0, kind: 'warn' },
    { who: 'Dr Sipho Ndlovu', text: 'verified DCC-000007 as completed.', ago: 0, kind: 'ok' },
    { who: 'BET Media', text: 'submitted DCC-000020 “Small-scale farmers market app”.', ago: 1, kind: 'info' },
    { who: 'System', text: '3 failed login attempts for DCC00118 — account locked.', ago: 1, kind: 'bad' },
    { who: 'Nokuthula Mkhize', text: 'approved Representative account DCC00212.', ago: 2, kind: 'ok' },
    { who: 'Prof Anika Pillay', text: 'rejected DCC-000019 (outside scope).', ago: 3, kind: 'bad' }
  ];
  var q = '';

  U.shell({
    roleLabel: 'Administrator', name: ME.name, initials: ME.initials, meta: ME.meta, active: 'overview',
    profile: { id: 'DCC00001', title: 'Ms', email: 'admin@devchallenges.community', phone: '035 902 6000', org: 'Development Challenges Community', address: 'KwaDlangezwa, 3886', joined: '2025-06-01' }
  });
  document.getElementById('search').placeholder = 'Search members or challenges…';

  var roleChip = function (r) { return '<span class="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset" style="color:' + ROLE[r] + ';background:' + ROLE[r] + '14;--tw-ring-color:' + ROLE[r] + '33">' + r + '</span>'; };

  // Backend mode (js/api.js): load the dashboard from the API and send every action to it
  var live = window.API && API.on();
  function refresh() { return API.get('/dashboard/admin').then(function (d) { API.dates(d.events, ['date']); apply(d); render(); }).catch(API.fail); }
  function call(p) { p.then(function (r) { U.toast(r.message || 'Saved.', 'ok'); refresh(); }).catch(API.fail); }
  function apply(d) {
    ME = d.me; MEMBERS = d.members; PENDING = API.dates(d.pending, ['when']); ORGS = d.orgs.length ? d.orgs : [['—', 0]]; ORG_TOTAL = d.org_total;
    CHALLENGES = d.challenges; CHALLENGES.Completed = CHALLENGES.Completed || 0; LOCKED = d.locked; ACTIVITY = d.activity; EVENTS = d.events;
    U.shell({ roleLabel: ME.roleLabel, name: ME.name, initials: ME.initials, meta: ME.meta, profile: ME.profile });
    U.serverNotes(d.notes);
  }
  var DOT = { ok: '#16a34a', bad: '#dc2626', warn: '#eab308', info: '#2b4de0' };
  function render() {
    Charts.reset();
    var P = U.PAL, total = Object.keys(MEMBERS).reduce(function (a, k) { return a + MEMBERS[k]; }, 0);
    var pend = PENDING.filter(function (p) { return !q || (p.name + ' ' + p.org + ' ' + p.id).toLowerCase().indexOf(q) > -1; });
    var chTotal = Object.keys(CHALLENGES).reduce(function (a, k) { return a + CHALLENGES[k]; }, 0);
    var sts = Object.keys(CHALLENGES).filter(function (k) { return CHALLENGES[k]; }), big = Math.max.apply(null, sts.map(function (k) { return CHALLENGES[k]; }));
    var orgMax = ORGS[0][1];

    document.getElementById('content').innerHTML =
      U.head(ME.name, 'Admin dashboard', period) +
      U.kpis([
        ['Total members', total, '', P.blue, 'people'],
        ['Pending approvals', PENDING.length, 'Accounts to review', P.purple, 'user'],
        ['Organisations', ORG_TOTAL, 'Registered organisations', P.amber, 'org'],
        ['Completed challenges', CHALLENGES.Completed, 'Challenges delivered', P.teal, 'check']
      ]) +
      '<div class="dash-row grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr_1fr_1.2fr]">' +
        U.card({ id: 'st', title: 'Challenges by status', sub: chTotal + ' challenges in the system',
          body: U.bars(sts.map(function (k) { var n = CHALLENGES[k]; return { label: k, value: n, color: k === 'Completed' ? P.teal : n === big ? P.blue : P.light }; })) }) +
        U.card({ id: 'nm', title: 'New members', sub: 'Joined · ' + U.rangeLabel(), body: U.pieBox('ch-new', 'New members by role') }) +
        U.card({ id: 'org', title: 'Members by organisation', sub: 'Where members come from',
          body: U.bars(ORGS.map(function (o) { return { label: o[0], value: o[1], color: o[0] === 'Other' ? '#cbd5e1' : o[1] === orgMax ? P.blue : P.light }; })) }) +
      '</div>' +
      '<div class="dash-row grid grid-cols-1 gap-4 lg:grid-cols-[1.08fr_1fr]" data-rowb>' +
        U.card({ id: 'ap', title: 'Accounts awaiting approval', count: pend.length, sub: 'Supervisor and Representative accounts are activated after review.',
          body: U.table([['Member', 'minmax(0,1fr)'], ['Role', '128px'], ['Registered', '96px'], ['Action', '112px']], pend.map(function (p) {
            return [U.cell(p.name, U.esc(p.org)), roleChip(p.role), '<span class="text-slate-700">' + U.fmt(p.when) + '</span>', '<button data-review="' + p.id + '" class="btn btn-primary btn-sm w-full">Review</button>'];
          }), 'No accounts waiting.') }) +
        '<div class="flex min-h-0 flex-col gap-4">' +
          U.card({ id: 'lock', cls: 'fit-top', title: 'Locked accounts', count: LOCKED.length, tone: 'warn', countRight: true, sub: 'Locked after repeated failed logins.',
            body: U.list(LOCKED.map(function (l) { return '<div class="min-w-0 flex-1">' + U.cell(l.name, l.id + ' · ' + l.why + ' · ' + (l.ago ? l.ago + 'd ago' : 'today'), 'warn') + '</div><button data-unlock="' + l.id + '" class="btn btn-sm w-28 shrink-0">Unlock</button>'; }), 'No locked accounts.') }) +
          U.card({ id: 'act', cls: 'flex-1', title: 'Recent activity',
            body: U.list(ACTIVITY.map(function (a) { return '<i class="inline-block size-2 shrink-0 rounded-full" style="background:' + DOT[a.kind] + '"></i><div class="min-w-0 flex-1 truncate text-slate-700"><b class="font-semibold text-slate-900">' + U.esc(a.who) + '</b> ' + U.esc(a.text) + '</div><span class="shrink-0 text-[12px] text-slate-500">' + (a.ago ? a.ago + 'd ago' : 'today') + '</span>'; })) }) +
        '</div>' +
      '</div>';

    Charts.draw('ch-new', function (el) { Charts.pie(el, [['Students', 'Student', P.blue], ['Supervisors', 'Supervisor', P.teal], ['Representatives', 'Representative', P.purple]].map(function (r) { return { label: r[0], value: inR(r[1]), color: r[2] }; }), { centerLabel: 'joined' }); });
    U.fitLists();
  }

  document.getElementById('content').addEventListener('click', function (e) {
    var u = e.target.closest('[data-unlock]');
    if (u) { var l = LOCKED.filter(function (x) { return x.id === u.dataset.unlock; })[0];
      U.modal('Unlock account — ' + l.id, '<p>Unlock <b>' + U.esc(l.name) + '</b>? They will get an email to reset their password.</p>', [{ label: 'Cancel' }, { label: 'Unlock account', primary: true, onClick: function () {
        if (live) return call(API.post('/admin/users/' + l.id + '/unlock'));
        LOCKED.splice(LOCKED.indexOf(l), 1); ACTIVITY.unshift({ who: ME.name, text: 'unlocked account ' + l.id + '.', ago: 0, kind: 'ok' }); render(); U.toast(l.name + ' can sign in again.', 'ok'); } }]); return; }
    var b = e.target.closest('[data-review]'); if (!b) return;
    var p = PENDING.filter(function (x) { return x.id === b.dataset.review; })[0];
    var row = function (k, v) { return '<div class="flex gap-3 py-1.5"><dt class="w-28 shrink-0 text-slate-500">' + k + '</dt><dd class="min-w-0 font-medium break-words">' + v + '</dd></div>'; };
    var done = function (msg) { PENDING.splice(PENDING.indexOf(p), 1); render(); U.toast(msg, 'ok'); };
    U.modal('Review account — ' + p.id,
      '<dl class="divide-y divide-slate-100 text-sm">' + row('Name', U.esc(p.name)) + row('Role', roleChip(p.role)) + row('Organisation', U.esc(p.org)) + row('Email', U.esc(p.email)) + row('Registered', U.fmt(p.when)) + '</dl>' +
      '<label for="why" class="label mt-3">Reason <span class="font-normal text-slate-500">(required to decline)</span></label><textarea id="why" rows="2" class="input"></textarea><span id="why-err" class="err"></span>', [
      { label: 'Decline', danger: true, onClick: function () {
        if (document.getElementById('why').value.trim().length < 3) { document.getElementById('why-err').textContent = 'Give a reason for declining.'; return false; }
        if (live) return call(API.post('/admin/users/' + p.id + '/reject', { reason: document.getElementById('why').value.trim() }));
        ACTIVITY.unshift({ who: ME.name, text: 'declined ' + p.role + ' account ' + p.id + '.', ago: 0, kind: 'bad' }); done(p.name + ' was declined and notified.');
      } },
      { label: 'Approve & activate', primary: true, onClick: function () {
        if (live) return call(API.post('/admin/users/' + p.id + '/approve'));
        MEMBERS[p.role]++; ACTIVITY.unshift({ who: ME.name, text: 'approved ' + p.role + ' account ' + p.id + '.', ago: 0, kind: 'ok' }); done(p.name + ' is now active.');
      } }]);
  });
  document.getElementById('search').addEventListener('input', function () { q = this.value.trim().toLowerCase(); render(); });
  U.rangeInit({ preset: '6m', presets: [['6m', 'Last 6 months'], ['year', 'This year'], ['sem', 'This semester'], ['last', 'Last semester'], ['all', 'All time']], kinds: [{ key: 'Student', label: 'Students joined', color: U.PAL.blue }, { key: 'Supervisor', label: 'Supervisors', color: U.PAL.teal }, { key: 'Representative', label: 'Representatives', color: U.PAL.purple }], events: function () { return EVENTS; }, onChange: render });
  U.notes(PENDING.slice(0, 3).map(function (p) { return { kind: 'alert', from: p.name, about: p.role, text: 'New ' + p.role + ' account from ' + p.org + ' is waiting for approval.', ago: Math.round((Date.now() - p.when) / U.DAY), unread: true }; })
    .concat([{ kind: 'message', from: 'Dr Sipho Ndlovu', text: 'Please add “Agriculture & Food Security” as an Area of Interest.', ago: 1, unread: true },
             { kind: 'update', from: 'System', about: 'DCC00118', text: '3 failed login attempts — account locked.', ago: 1, unread: false }]));
  if (live) API.boot('admin').then(function (d) { apply(d); render(); }).catch(function (e) { API.fail(e); render(); });
  else render();
})();
