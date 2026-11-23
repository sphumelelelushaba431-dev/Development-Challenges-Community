/* Representative dashboard. Replace the sample data with your API (e.g. GET /api/representative/dashboard).
   Representatives can: submit challenges, respond to information requests, monitor progress,
   update progress and upload documents on work assigned to them, view MCDA results and message supervisors.
   They cannot evaluate (score) or allocate challenges. */
(function () {
  'use strict';
  var U = UI, d = function (n) { return new Date(Date.now() + n * U.DAY); };
  var ME = { name: 'Sbongokuhle Msomi', initials: 'SM', meta: 'Representative · DCC00003', org: 'BET Media' };

  var subs = [
    { id: 'DCC-000001', funded: true, title: 'Expansion of knowledge through communication', status: 'In Progress', due: d(24), pct: 45, team: 'Amahle Mthembu', score: 70.0, rank: 2 },
    { id: 'DCC-000010', funded: false, title: 'Community health-literacy workshops', status: 'Pending Information', due: d(30), pct: 0, request: 'Please attach the partner clinic letters and expected attendance numbers.' },
    { id: 'DCC-000017', funded: true, title: 'Community radio podcast series', status: 'Unallocated', due: d(62), pct: 0, score: 68.5, rank: 3 },
    { id: 'DCC-000002', title: 'Campus Wi-Fi dead-zone mapping', status: 'Unallocated', due: d(35), pct: 0, score: 62.8, rank: 5 },
    { id: 'DCC-000005', title: 'Phishing awareness training portal', status: 'Under Review', due: d(45), pct: 0 },
    { id: 'DCC-000009', title: 'Cafeteria food-waste reduction study', status: 'Pending Verification', due: d(3), pct: 100, team: 'Thando Khumalo', score: 54.7, rank: 7 },
    { id: 'DCC-000007', title: 'Solar-powered phone charging kiosk', status: 'Completed', due: d(-20), pct: 100, team: 'Thando Khumalo', score: 66.1, rank: 4 }
  ];
  var assigned = [{ id: 'DCC-000015', title: 'IT help-desk FAQ chatbot', status: 'In Progress', due: d(12), pct: 70, supervisor: 'Dr Sipho Ndlovu', docs: 2 }];
  var msgs = [
    { from: 'Dr Sipho Ndlovu', text: 'The help-desk chatbot is looking good. Please share the test results on Friday.', ago: 1, about: 'DCC-000015' },
    { from: 'Dr Sipho Ndlovu', text: 'We need the clinic letters before DCC-000010 can be approved.', ago: 2, about: 'DCC-000010' },
    { from: 'Prof Anika Pillay', text: 'Thank you for the kiosk feedback — it has been shared with the team.', ago: 9, about: 'DCC-000007' }
  ];
  // My challenges submitted and completed per month (oldest → newest, 12 months)
  var TREND = { submitted: [1, 0, 1, 1, 0, 2, 1, 0, 1, 2, 1, 2], completed: [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 1] };
  var seq = 21, q = '', period = 6;
  var EVENTS = null; // built after the sample challenges load (see below)
  var inR = function (k) { return EVENTS.filter(function (e) { return e.kind === k && U.inRange(e.date); }).length; };
  // Students the matching flow compares against (from the server in production)
  // Supervisors and their areas of expertise (from registration). Load = open challenges (max 5).
  var SUPERVISORS = [
    { name: 'Dr Sipho Ndlovu', expertise: ['Data Science & Machine Learning', 'Software & Web Development'], load: 5, record: 0.9 },
    { name: 'Prof Anika Pillay', expertise: ['Health & Community Wellbeing', 'Research'], load: 2, record: 0.85 },
    { name: 'Dr Lindiwe Mabaso', expertise: ['Design, Media & Communication', 'Education & Skills Development'], load: 1, record: 0.8 },
    { name: 'Mr Themba Shezi', expertise: ['Software & Web Development', 'Internet of Things & Embedded Systems'], load: 3, record: 0.75 },
    { name: 'Prof Kavitha Naidoo', expertise: ['Environmental Systems & Water', 'Renewable Energy & Sustainability'], load: 2, record: 0.8 },
    { name: 'Mr Bongani Sithole', expertise: ['Entrepreneurship & Small Business Support', 'Research'], load: 1, record: 0.8 }
  ];
  var match = function (c) { return !q || (c.id + ' ' + c.title).toLowerCase().indexOf(q) > -1; };
  // Backend mode (js/api.js): load the dashboard from the API and send every action to it
  var live = window.API && API.on();
  function refresh() { return API.get('/dashboard/representative').then(function (d) { API.dates(d.events, ['date']); apply(d); render(); }).catch(API.fail); }
  function call(p) { p.then(function (r) { U.toast(r.message || 'Saved.', 'ok'); refresh(); }).catch(API.fail); }
  function apply(d) {
    ME = d.me; subs = API.dates(d.subs, ['due']); assigned = API.dates(d.assigned || [], ['due']); EVENTS = d.events;
    U.shell({ roleLabel: ME.roleLabel, name: ME.name, initials: ME.initials, meta: ME.meta, profile: ME.profile });
    U.serverNotes(d.notes);
  }
  function files(fd, input) { var f = document.getElementById(input).files; for (var i = 0; i < f.length; i++) fd.append('files', f[i]); return fd; }

  U.shell({
    roleLabel: 'Representative', name: ME.name, initials: ME.initials, meta: ME.meta, active: 'overview',
    profile: { id: 'DCC00003', title: 'Ms', email: 'sbongokuhle@betmedia.co.za', phone: '073 456 7890', org: 'BET Media', interest: 'Design, Media & Communication', address: '45 Bullion Boulevard, Richards Bay, 3900', joined: '2026-01-22' }
  });

  var ORDER = ['Submitted', 'Under Review', 'Pending Information', 'Unallocated', 'Allocated', 'In Progress', 'Pending Verification', 'Completed', 'Rejected'];
  // "My submissions" shows the NEWEST 2; "View more" opens the full list
  var NEWEST = 2, SUB_COLS = [['Challenge', 'minmax(0,1fr)'], ['Status', '150px'], ['Time left', '84px'], ['Action', '112px']];
  var newest = function (list) { return list.slice().sort(function (a, b) { return b.id.localeCompare(a.id); }); };   // higher ID = submitted later
  function subRow(c) {
    var n = U.daysLeft(c.due);
    return [U.cell(c.title, c.id + (c.team ? ' · ' + U.esc(c.team) : '')), U.badge(c.status), '<span class="tabular-nums ' + (n < 0 ? 'text-slate-400' : n <= 7 ? 'font-semibold text-red-600' : 'text-slate-700') + '">' + (n < 0 ? '—' : n + ' days') + '</span>',
      c.status === 'Pending Information' ? '<button data-info="' + c.id + '" class="btn btn-primary btn-sm w-full">Respond</button>' : '<button data-view="' + c.id + '" class="btn btn-sm w-full">View</button>'];
  }
  function allSubmissions() {
    var all = newest(subs);
    U.modal('My submissions (' + all.length + ')', '<div class="-my-2 flex flex-col">' + U.table(SUB_COLS, all.map(subRow)) + '</div>', [{ label: 'Close' }]);
    var root = document.getElementById('modal-root'), box = root.querySelector('[data-fit]'); if (box) box.removeAttribute('data-fit');
    var dlg = root.querySelector('[role=dialog]'); if (dlg) dlg.classList.replace('max-w-lg', 'max-w-3xl');
    root.addEventListener('click', function pick(e) {
      var b = e.target.closest('[data-view],[data-info]'); if (!b) return;
      root.removeEventListener('click', pick); act(b);
    });
  }

  function render() {
    Charts.reset();
    var P = U.PAL, count = function (l) { return subs.filter(function (c) { return l.indexOf(c.status) > -1; }).length; };
    var info = subs.filter(function (c) { return c.status === 'Pending Information'; });
    var statuses = ORDER.filter(function (s) { return count([s]); }), big = Math.max.apply(null, statuses.map(function (s) { return count([s]); }));
    var prog = subs.filter(function (c) { return ['Allocated', 'In Progress', 'Pending Verification', 'Completed'].indexOf(c.status) > -1; });
    var shown = newest(subs.filter(match));
    var near = subs.concat(assigned).filter(function (c) { return ['In Progress', 'Allocated', 'Pending Verification'].indexOf(c.status) > -1; }).sort(function (a, b) { return a.due - b.due; })[0];

    document.getElementById('content').innerHTML =
      U.head(ME.name + ' · ' + ME.org, 'Representative dashboard', period, '', '<button data-act="new" class="btn btn-primary shrink-0 py-2.5">Submit challenge</button>') +
      U.kpis([
        ['My submissions', subs.length, 'Across all statuses', P.blue, 'inbox'],
        ['Awaiting review', count(['Submitted', 'Under Review', 'Pending Information']), 'Being reviewed', P.purple, 'pending'],
        ['In progress', count(['Allocated', 'In Progress', 'Pending Verification']), 'Teams working', P.amber, 'clock'],
        ['Completed', count(['Completed']), 'Challenges delivered', P.teal, 'check']
      ]) +
      '<div class="dash-row grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr_1fr_1.2fr]">' +
        U.card({ id: 'st', title: 'My challenges by status', sub: subs.length + ' challenges you submitted',
          body: U.bars(statuses.map(function (s) { var n = count([s]); return { label: s, value: n, color: s === 'Completed' ? P.teal : n === big ? P.blue : P.light }; })) }) +
        U.card({ id: 'tr', title: 'Submitted vs completed', sub: 'Your challenge activity · ' + U.rangeLabel(), body: U.pieBox('ch-trend', 'Challenges you submitted and completed') }) +
        U.card({ id: 'pr', title: 'Progress Tracking', sub: 'Completion by the student teams · target 100%',
          body: U.pieBox('ch-prog', 'Progress of my challenges against the 100% target') +
            (near ? '<p class="note"><b>Next deadline: ' + U.esc(near.title) + '</b>' + U.daysLeft(near.due) + ' days left · ' + near.id + '</p>' : '') }) +
      '</div>' +
      '<div class="dash-row grid grid-cols-1 gap-4 lg:grid-cols-[1.08fr_1fr]" data-rowb>' +
        U.card({ id: 'subs', title: 'My submissions', count: shown.length,
          body: U.table(SUB_COLS, shown.slice(0, NEWEST).map(subRow), 'You have not submitted a challenge yet.',
            shown.length > NEWEST ? '<button data-more="subs" class="view-more">View more (' + (shown.length - NEWEST) + ')</button>' : '') }) +
        '<div class="flex min-h-0 flex-col gap-4">' +
          U.card({ id: 'info', cls: 'fit-top keep-meta', title: 'Supervisors Attention', count: info.length, tone: 'warn', countRight: true, sub: 'The supervisor needs more before approving.',
            body: U.list(info.map(function (c) { return '<div class="min-w-0 flex-1">' + U.cell(c.title, U.esc(c.request), 'warn') + '</div><button data-info="' + c.id + '" class="btn btn-sm w-28 shrink-0">Respond</button>'; }), 'Nothing needs your input.') }) +
          U.card({ id: 'asg', cls: 'flex-1', title: 'Assigned to me',
            body: U.list(assigned.map(function (c) { return '<div class="min-w-0 flex-1">' + U.cell(c.title, U.esc(c.supervisor) + ' · ' + c.pct + '% · ' + c.docs + ' docs') + '</div>' + U.badge(c.status) +
              (c.status === 'In Progress' ? '<button data-progress="' + c.id + '" class="btn btn-sm shrink-0">Update</button><button data-upload="' + c.id + '" class="btn btn-sm shrink-0">Upload</button>' : ''); }), 'Nothing assigned to you.') }) +
        '</div>' +
      '</div>';

    Charts.draw('ch-trend', function (el) { Charts.pie(el, [{ label: 'Submitted', value: inR('sub'), color: P.blue }, { label: 'Completed', value: inR('done'), color: P.teal }], { centerLabel: 'challenges' }); });
    // Bullet graph: grey bands = 0–50% / 50–80% / 80–100%, bar = actual progress, black tick = 100% target
    Charts.draw('ch-prog', function (el) { Charts.bullet(el, prog.map(function (c) { return { label: c.title, value: c.pct, target: 100, max: 100, color: c.pct >= 100 ? P.teal : P.blue, tip: c.id + ' · ' + c.title + ': ' + c.pct + '%' + (c.team ? ' · team ' + c.team : '') }; }), { max: 100, bands: [0.5, 0.8], fmt: function (v) { return v + '%'; } }); });
    U.fitLists();
  }

  var find = function (id) { return subs.concat(assigned).filter(function (c) { return c.id === id; })[0]; };
  var err = function (id, m) { document.getElementById(id + '-err').textContent = m; var el = document.getElementById(id); if (el) el.classList.add('invalid'); return false; };
  document.getElementById('content').addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) act(b); });
  function act(b) {
    var c;
    if (b.dataset.more === 'subs') allSubmissions();
    else if (b.dataset.view) {
      c = find(b.dataset.view);
      U.modal(c.id, '<p class="mb-2 font-semibold">' + U.esc(c.title) + '</p><dl class="space-y-1 text-[13px]"><div class="flex gap-3"><dt class="w-24 text-slate-500">Status</dt><dd>' + U.badge(c.status) + '</dd></div><div class="flex gap-3"><dt class="w-24 text-slate-500">Supervisor</dt><dd>' + U.esc(c.supervisor || 'Being assigned') + '</dd></div><div class="flex gap-3"><dt class="w-24 text-slate-500">Team</dt><dd>' + U.esc(c.team || 'Not allocated yet') + '</dd></div><div class="flex gap-3"><dt class="w-24 text-slate-500">Deadline</dt><dd>' + U.fmt(c.due) + '</dd></div><div class="flex gap-3"><dt class="w-24 text-slate-500">Funding</dt><dd>' + U.funding(c.funded) + '</dd></div><div class="flex gap-3"><dt class="w-24 text-slate-500">Progress</dt><dd>' + c.pct + '%</dd></div></dl>', [{ label: 'Close' }]);
    } else if (b.dataset.act === 'new') {
      var min = U.isoDay(new Date(Date.now() + U.DAY));
      U.modal('Submit challenge',
        '<div class="space-y-3"><div><label for="n-title" class="label">Challenge title <span class="text-red-600">*</span></label><input id="n-title" class="input"><span id="n-title-err" class="err"></span></div>' +
        '<div class="grid grid-cols-2 gap-3">' +
        '<div><label for="n-pri" class="label">Priority</label><select id="n-pri" class="input"><option>Low</option><option selected>Medium</option><option>High</option><option>Critical</option></select></div>' +
        '<div><label for="n-due" class="label">Deadline <span class="text-red-600">*</span></label><input id="n-due" type="date" min="' + min + '" class="input"><span id="n-due-err" class="err"></span></div></div>' +
        '<div><label for="n-desc" class="label">Description <span class="text-red-600">*</span></label><textarea id="n-desc" rows="3" class="input"></textarea><span id="n-desc-err" class="err"></span></div>' +
        '<fieldset><legend class="label">Will your organisation fund this project? <span class="text-red-600">*</span></legend>' +
          '<div class="grid grid-cols-2 gap-2" role="radiogroup">' +
          '<label class="fund-opt flex cursor-pointer items-center gap-2.5 rounded-lg border border-slate-200 px-3 py-2.5 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50"><input type="radio" name="n-fund" value="yes" onchange="document.getElementById(\'n-fund-err\').textContent = \'\'" class="size-4 accent-brand-700"><span class="text-[13.5px] font-semibold text-slate-900">Yes, we will fund it</span></label>' +
          '<label class="fund-opt flex cursor-pointer items-center gap-2.5 rounded-lg border border-slate-200 px-3 py-2.5 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50"><input type="radio" name="n-fund" value="no" onchange="document.getElementById(\'n-fund-err\').textContent = \'\'" class="size-4 accent-brand-700"><span class="text-[13.5px] font-semibold text-slate-900">No, we can\'t fund it</span></label>' +
          '</div><span id="n-fund-err" class="err"></span></fieldset>' +
        '<div><label for="n-docs" class="label">Supporting documents</label><input id="n-docs" type="file" multiple class="block w-full text-sm file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:font-semibold file:text-brand-800"></div></div>',
        [{ label: 'Cancel' }, { label: 'Submit challenge', primary: true, onClick: function () {
          var t = document.getElementById('n-title').value.trim(), due = document.getElementById('n-due').value, desc = document.getElementById('n-desc').value.trim(), ok = true;
          if (t.length < 5) ok = err('n-title', 'Enter a title (5+ characters).');
          if (!due) ok = err('n-due', 'Choose a deadline.');
          if (desc.length < 20) ok = err('n-desc', 'Describe the challenge (20+ characters).');
          var fund = document.querySelector('input[name=n-fund]:checked');
          if (!fund) ok = err('n-fund', 'Choose whether your organisation will fund this project.');
          if (!ok) return false;
          if (live) {
            var fd = new FormData(); fd.append('title', t); fd.append('description', desc); fd.append('due_date', due);
            fd.append('priority', document.getElementById('n-pri').value); fd.append('funded', fund.value);
            return call(API.post('/challenges', files(fd, 'n-docs')));
          }
          var id = 'DCC-0000' + (++seq);
          var c = { id: id, title: t, desc: desc, funded: fund.value === 'yes', status: 'Submitted', due: new Date(due + 'T17:00'), pct: 0 };
          subs.unshift(c); render();
          // On the server: keywords from the description → Area of Interest → supervisor with that expertise (max 5 each).
          var a = Matching.assignSupervisor(c, SUPERVISORS);
          if (a.supervisor) { c.supervisor = a.supervisor.name; a.supervisor.load++; }
          c.areas = a.areas;
          U.toast(id + ' submitted for review.', 'ok');
        } }]);
    } else if (b.dataset.info) {
      c = find(b.dataset.info);
      U.modal('Add more details — ' + c.id, '<p class="mb-1 font-semibold">' + U.esc(c.title) + '</p><p class="mb-1 text-xs font-semibold tracking-wide text-slate-500 uppercase">Requested by the supervisor</p><p class="mb-2 rounded-md bg-yellow-50 px-3 py-2 text-yellow-900">' + U.esc(c.request) + '</p><label for="i-text" class="label">Your response <span class="text-red-600">*</span></label><textarea id="i-text" rows="3" class="input"></textarea><span id="i-text-err" class="err"></span>' +
        '<label for="i-docs" class="label mt-3">Attach documents</label><input id="i-docs" type="file" multiple class="block w-full text-sm file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:font-semibold file:text-brand-800">',
        [{ label: 'Cancel' }, { label: 'Send & resubmit', primary: true, onClick: function () {
          if (document.getElementById('i-text').value.trim().length < 5) return err('i-text', 'Write a short response (5+ characters).');
          if (live) { var fd = new FormData(); fd.append('response', document.getElementById('i-text').value.trim()); return call(API.post('/challenges/' + c.id + '/respond', files(fd, 'i-docs'))); }
          c.status = 'Submitted'; delete c.request; render(); U.toast('Information sent — ' + c.id + ' is back with the supervisor.', 'ok');
        } }]);
    } else if (b.dataset.progress) {
      c = find(b.dataset.progress);
      U.modal('Update progress — ' + c.id, '<label for="pct" class="label">Completion: <b id="pct-out">' + c.pct + '%</b></label><input id="pct" type="range" min="0" max="100" step="5" value="' + c.pct + '" class="w-full accent-brand-700" oninput="document.getElementById(\'pct-out\').textContent=this.value+\'%\'">' +
        '<label for="note" class="label mt-3">Progress report <span class="text-red-600">*</span></label><textarea id="note" rows="3" class="input"></textarea><span id="note-err" class="err"></span>',
        [{ label: 'Cancel' }, { label: 'Save update', primary: true, onClick: function () {
          if (document.getElementById('note').value.trim().length < 5) return err('note', 'Describe your progress (5+ characters).');
          if (live) return call(API.post('/challenges/' + c.id + '/progress', { pct: +document.getElementById('pct').value, note: document.getElementById('note').value.trim() }));
          c.pct = +document.getElementById('pct').value; render(); U.toast('Progress updated to ' + c.pct + '%.', 'ok');
        } }]);
    } else if (b.dataset.upload) {
      c = find(b.dataset.upload);
      U.modal('Upload document — ' + c.id, '<label for="u-file" class="label">Choose files <span class="font-normal text-slate-500">(PDF, Word, Excel, images · max 10 MB each)</span></label><input id="u-file" type="file" multiple class="input file:mr-3 file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-1 file:font-semibold file:text-brand-800"><span id="u-file-err" class="err"></span>',
        [{ label: 'Cancel' }, { label: 'Upload', primary: true, onClick: function () {
          var f = document.getElementById('u-file').files; if (!f.length) return err('u-file', 'Choose at least one file.');
          for (var i = 0; i < f.length; i++) if (f[i].size > 10 * 1048576) return err('u-file', f[i].name + ' is larger than 10 MB.');
          if (live) return call(API.post('/challenges/' + c.id + '/documents', files(new FormData(), 'u-file')));
          c.docs += f.length; render(); U.toast(f.length + ' document(s) uploaded.', 'ok');
        } }]);
    } else if (b.dataset.reply != null) {
      var m = msgs[+b.dataset.reply];
      U.modal('Reply to ' + m.from, '<p class="mb-2 rounded-md bg-slate-50 px-3 py-2 text-slate-700">' + U.esc(m.text) + '</p><label for="r-text" class="label">Your reply <span class="text-red-600">*</span></label><textarea id="r-text" rows="3" class="input"></textarea><span id="r-text-err" class="err"></span>',
        [{ label: 'Cancel' }, { label: 'Send', primary: true, onClick: function () {
          if (!document.getElementById('r-text').value.trim()) return err('r-text', 'Write a message.');
          if (live) return call(API.post('/messages', { to: m.from, about: m.about, text: document.getElementById('r-text').value.trim() }));
          U.toast('Message sent to ' + m.from + '.', 'ok');
        } }]);
    }
  }
  document.getElementById('search').addEventListener('input', function () { q = this.value.trim().toLowerCase(); render(); });
  var names = function () { return subs.map(function (c) { return c.title; }); };
  EVENTS = U.monthlyEvents(TREND.submitted, 'sub', names()).concat(U.monthlyEvents(TREND.completed, 'done', subs.filter(function (c) { return c.status === 'Completed'; }).map(function (c) { return c.title; }).concat(names()).slice(0, 6)));
  U.rangeInit({ preset: '6m', presets: [['6m', 'Last 6 months'], ['year', 'This year'], ['sem', 'This semester'], ['last', 'Last semester'], ['all', 'All time']], kinds: [{ key: 'sub', label: 'Submitted', color: U.PAL.blue }, { key: 'done', label: 'Completed', color: U.PAL.teal }], events: function () { return EVENTS; }, onChange: render });
  U.notes(subs.filter(function (c) { return c.status === 'Pending Information'; }).map(function (c) { return { kind: 'alert', from: 'Dr Sipho Ndlovu', about: c.id, text: 'More information is needed before “' + c.title + '” can be approved.', ago: 0, unread: true }; })
    .concat([{ kind: 'meeting', from: 'Dr Sipho Ndlovu', about: 'DCC-000001', text: 'Meeting: Progress review · ' + U.meetWhen({ date: U.workday(1), start: '10:00', mins: 60 }) + ' · Lab DC-002 (in person).', ago: 0, unread: true,
      open: function () { U.meetingDetails({ title: 'Progress review', challenge: 'Expansion of knowledge through communication (DCC-000001)', date: U.workday(1), start: '10:00', mins: 60, venue: 'Lab DC-002', organiser: 'Dr Sipho Ndlovu', people: ['Amahle Mthembu', 'Sbongokuhle Msomi'], agenda: 'Audience numbers and next milestones.' }); } }])
    .concat(msgs.map(function (m) { return { kind: 'message', from: m.from, about: m.about, text: m.text, ago: m.ago, unread: m.ago < 2 }; })));
  if (live) API.boot('representative').then(function (d) { apply(d); render(); }).catch(function (e) { API.fail(e); render(); });
  else render();
})();
