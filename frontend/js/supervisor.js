/* Supervisor dashboard — charts + auto-assignment (Matching module).
   Replace the sample data with your API (e.g. GET /api/supervisor/dashboard). */
(function () {
  'use strict';
  var U = UI, d = function (n) { return new Date(Date.now() + n * U.DAY); };
  var ME = { name: 'Dr Sipho Ndlovu', initials: 'SN', meta: 'Supervisor · FAI' };
  var ST = { 'Submitted': '#2563eb', 'Under Review': '#a16207', 'Pending Information': '#facc15', 'Approved': '#0d9488', 'Unallocated': '#94a3b8', 'Allocated': '#7c3aed', 'In Progress': '#f97316', 'Pending Verification': '#eab308', 'Completed': '#16a34a', 'Rejected': '#dc2626', 'Interest Review': '#64748b' };

  var C = [
    { id: 'DCC-000004', funded: true, title: 'Automated timetable clash detection', by: 'Amahle Mthembu', status: 'Submitted', due: d(60), desc: 'Timetable clashes are found too late. Build a tool that detects lecture and venue clashes from the draft timetable.' },
    { id: 'DCC-000005', funded: false, title: 'Phishing awareness training portal', by: 'Sbongokuhle Msomi', status: 'Under Review', due: d(45), desc: 'Design a self-paced awareness portal with simulated phishing examples.' },
    { id: 'DCC-000020', funded: false, title: 'Small-scale farmers market app', by: 'BET Media', status: 'Submitted', due: d(38), desc: 'Farmers need a simple way to list produce for local buyers.' },
    { id: 'DCC-000003', funded: true, title: 'Student dropout early-warning dashboard', by: 'Amahle Mthembu', status: 'Unallocated', due: d(50), score: 72.2, desc: 'First-year attrition is high. Combine LMS activity, attendance and assessment data into an early-warning dashboard for advisors.' },
    { id: 'DCC-000017', funded: true, title: 'Township storytelling and publicity drive', by: 'Sbongokuhle Msomi', status: 'Unallocated', due: d(62), score: 68.5, desc: 'Local artists want help with storytelling and publicity for a township heritage festival.' },
    { id: 'DCC-000024', funded: false, title: 'Reduce queues at the campus clinic', by: 'BET Media', status: 'Unallocated', due: d(29), score: 66.0, desc: 'Patients wait hours at the campus clinic without updates; nurses want a calmer waiting room.' },
    { id: 'DCC-000001', funded: true, title: 'Expansion of knowledge through communication', by: 'Sbongokuhle Msomi', status: 'In Progress', due: d(24), to: 'Amahle Mthembu' },
    { id: 'DCC-000009', funded: true, title: 'Cafeteria food-waste reduction study', by: 'Sbongokuhle Msomi', status: 'Pending Verification', due: d(3), to: 'Thando Khumalo' },
    { id: 'DCC-000007', funded: true, title: 'Solar-powered phone charging kiosk', by: 'Nolwazi Nxumalo', status: 'Completed', due: d(-20), to: 'Thando Khumalo' },
    { id: 'DCC-000011', funded: false, title: 'Postgraduate research data repository', by: 'Ayanda Zulu', status: 'Completed', due: d(-45), to: 'Amahle Mthembu' },
    { id: 'DCC-000013', funded: true, title: 'Alumni mentorship matching app', by: 'Sbongokuhle Msomi', status: 'Approved', due: d(70) }
  ];
  var STUDENTS = [
    { name: 'Amahle Mthembu', interests: ['Design, Media & Communication', 'Data Science & Machine Learning'], load: 1, cap: 3, available: true, record: 0.9 },
    { name: 'Lwazi Dube', interests: ['Software & Web Development', 'Internet of Things & Embedded Systems'], load: 2, cap: 3, available: true, record: 0.7 },
    { name: 'Thando Khumalo', interests: ['Environmental Systems & Water', 'Renewable Energy & Sustainability', 'Research'], load: 1, cap: 3, available: true, record: 0.8 },
    { name: 'Ayanda Zulu', interests: ['Software & Web Development', 'Education & Skills Development'], load: 0, cap: 3, available: false, record: 0.6 },
    { name: 'Nosipho Cele', interests: ['Health & Community Wellbeing', 'Research'], load: 3, cap: 3, available: true, record: 0.85 }
  ];
  // Challenges submitted and completed per month (oldest → newest, 12 months)
  var TREND = { submitted: [3, 5, 2, 4, 6, 3, 4, 6, 5, 8, 7, 9], completed: [2, 1, 3, 2, 2, 4, 1, 2, 4, 3, 5, 4] };
  var period = 6;
  // Dated activity for the calendar (sample: spread from the monthly totals above)
  var titles = function (f) { return C.filter(f).map(function (c) { return c.title; }); };
  var EVENTS = U.monthlyEvents(TREND.submitted, 'sub', titles(function () { return true; }))
    .concat(U.monthlyEvents(TREND.completed, 'done', titles(function (c) { return c.status === 'Completed' || c.status === 'Pending Verification'; })));
  var inR = function (k) { return EVENTS.filter(function (e) { return e.kind === k && U.inRange(e.date); }).length; };
  var results = {}, q = '';
  // Students asking to work on one of my challenges (from the server in production)
  var REQUESTS = [
    { rid: 'R1', id: 'DCC-000024', student: 'Lwazi Dube', msg: 'I built an SMS reminder tool for my residence and would like to help the clinic.', ago: 0, status: 'pending' },
    { rid: 'R2', id: 'DCC-000017', student: 'Thando Khumalo', msg: 'I have done publicity for a community festival before.', ago: 1, status: 'pending' }
  ];
  var pendingReq = function () { return REQUESTS.filter(function (r) { return r.status === 'pending' && match(find(r.id)); }); };
  var subSeq = 30;
  // Backend mode (js/api.js): load the dashboard from the API and send every action to it
  var live = window.API && API.on();
  function refresh() { return API.get('/dashboard/supervisor').then(function (d) { API.dates(d.events, ['date']); apply(d); render(); }).catch(API.fail); }
  function call(p, after) { p.then(function (r) { U.toast(r.message || 'Saved.', 'ok'); refresh().then(after); }).catch(API.fail); }
  function apply(d) {
    ME = d.me; CAP = d.cap || CAP; EVENTS = d.events;
    C = API.dates(d.challenges, ['due']); STUDENTS = d.students; REQUESTS = d.requests; MEETINGS = d.meetings; BOOKED = d.booked;
    results = {};
    Object.keys(d.results || {}).forEach(function (k) {   // the API's MCDA ranking → the shape the allocation window uses
      var ranked = d.results[k].ranked.map(function (x) { return { student: { name: x.name, available: x.available, load: x.load, cap: x.cap }, score: x.score, rec: x.recommended }; });
      results[k] = { outcome: d.results[k].outcome, ranked: ranked, recommended: ranked.filter(function (x) { return x.rec; }) };
    });
    U.shell({ roleLabel: ME.roleLabel, name: ME.name, initials: ME.initials, meta: ME.meta, profile: ME.profile });
    U.serverNotes(d.notes);
  }
  function rematch() { if (live) return; C.forEach(function (c) { if (c.status === 'Unallocated') results[c.id] = Matching.run(c, STUDENTS); }); }

  U.shell({
    roleLabel: 'Supervisor', name: ME.name, initials: ME.initials, meta: ME.meta, active: 'overview',
    profile: { id: 'DCC00011', title: 'Dr', email: 's.ndlovu@unizulu.ac.za', phone: '082 345 6789', org: 'University of Zululand', interest: 'Data Science & Machine Learning', address: 'Faculty of Science, Agriculture & Engineering, KwaDlangezwa, 3886', joined: '2025-08-03' }
  });

  var match = function (c) { return !q || (c.id + ' ' + c.title).toLowerCase().indexOf(q) > -1; };
  
  // Meetings are always in person, in one of the DC labs. BOOKED = the labs' existing bookings (all users).
  var MEETINGS = [
    { id: 'M-101', cid: 'DCC-000001', title: 'Progress review', challenge: 'Expansion of knowledge through communication (DCC-000001)', date: U.workday(1), start: '10:00', mins: 60, venue: 'Lab DC-002', organiser: ME.name, people: ['Amahle Mthembu', 'Sbongokuhle Msomi'], agenda: 'Audience numbers and next milestones.' },
    { id: 'M-102', cid: 'DCC-000009', title: 'Final report walkthrough', challenge: 'Cafeteria food-waste reduction study (DCC-000009)', date: U.workday(2), start: '14:00', mins: 60, venue: 'Lab DC-001', organiser: ME.name, people: ['Thando Khumalo'], agenda: '' }
  ];
  var BOOKED = [   // other supervisors' bookings
    { venue: 'Lab DC-003', date: U.workday(1), start: '09:00', mins: 180 },
    { venue: 'Lab DC-004', date: U.workday(1), start: '13:00', mins: 120 },
    { venue: 'Lab DC-001', date: U.workday(1), start: '10:00', mins: 90 }
  ];
  function clash(venue, date, start, mins, skip) {
    var a = U.toMin(start), b = a + mins;
    return MEETINGS.concat(BOOKED).filter(function (m) { return m !== skip && m.venue === venue && m.date === date && U.toMin(m.start) < b && a < U.toMin(m.start) + m.mins; })[0];
  }
  var upcoming = function () { var today = U.isoDay(); return MEETINGS.filter(function (m) { return m.date >= today; }).sort(function (a, b) { return (a.date + a.start).localeCompare(b.date + b.start); }); };

  function scheduleMeeting(preset) {
    var open = C.filter(function (c) { return ['Unallocated', 'Allocated', 'In Progress', 'Pending Verification'].indexOf(c.status) > -1; });
    var times = []; for (var t = 8 * 60; t <= 16 * 60 + 30; t += 30) times.push(U.hhmm(t));
    var today = U.isoDay();
    U.modal('Schedule a meeting',
      '<div class="grid grid-cols-2 gap-x-4 gap-y-3">' +
        '<div class="col-span-2"><label for="mt-c" class="label">Challenge <span class="text-red-600">*</span></label><select id="mt-c" class="input">' + open.map(function (c) { return '<option value="' + c.id + '"' + (preset === c.id ? ' selected' : '') + '>' + U.esc(c.title) + ' (' + c.id + ')</option>'; }).join('') + '</select></div>' +
        '<div class="col-span-2"><span class="label">Invite <span class="text-red-600">*</span></span><div id="mt-people" class="flex flex-wrap gap-x-5 gap-y-1.5"></div><span id="mt-people-err" class="err"></span></div>' +
        '<div class="col-span-2"><label for="mt-t" class="label">Meeting title <span class="text-red-600">*</span></label><input id="mt-t" class="input" value="Progress review" maxlength="80"><span id="mt-t-err" class="err"></span></div>' +
        '<div><label for="mt-d" class="label">Date <span class="text-red-600">*</span></label><input id="mt-d" type="date" min="' + today + '" value="' + U.workday(1) + '" class="input"><span id="mt-d-err" class="err"></span></div>' +
        '<div class="grid grid-cols-2 gap-3"><div><label for="mt-s" class="label">Start</label><select id="mt-s" class="input">' + times.map(function (x) { return '<option' + (x === '10:00' ? ' selected' : '') + '>' + x + '</option>'; }).join('') + '</select></div>' +
          '<div><label for="mt-m" class="label">Length</label><select id="mt-m" class="input"><option value="30">30 min</option><option value="60" selected>1 hour</option><option value="90">1½ hours</option><option value="120">2 hours</option></select></div></div>' +
        '<div class="col-span-2"><span class="label">Venue (in person) <span class="text-red-600">*</span></span><div id="mt-v" role="radiogroup" class="grid grid-cols-4 gap-2"></div><span id="mt-v-err" class="err"></span></div>' +
        '<div class="col-span-2"><label for="mt-a" class="label">Agenda <span class="font-normal text-slate-500">(optional)</span></label><textarea id="mt-a" rows="2" class="input"></textarea></div>' +
      '</div>',
      [{ label: 'Cancel' }, { label: 'Schedule meeting', primary: true, onClick: function () {
        var g = function (id) { return document.getElementById(id).value.trim(); }, ok = true;
        var bad = function (id, msg) { document.getElementById(id + '-err').textContent = msg; ok = false; };
        document.querySelectorAll('#modal-root .err').forEach(function (e) { e.textContent = ''; });
        var people = [].slice.call(document.querySelectorAll('input[name=mt-p]:checked')).map(function (i) { return i.value; });
        var venue = (document.querySelector('input[name=mt-venue]:checked') || {}).value, date = g('mt-d'), start = g('mt-s'), mins = +g('mt-m');
        if (!people.length) bad('mt-people', 'Invite at least one person.');
        if (g('mt-t').length < 3) bad('mt-t', 'Give the meeting a title.');
        if (!date) bad('mt-d', 'Choose a date.');
        else if (!(new Date(date + 'T12:00').getDay() % 6)) bad('mt-d', 'Choose a weekday — the labs are closed on weekends.');
        else if (new Date(date + 'T' + start) < new Date()) bad('mt-d', 'Choose a time in the future.');
        if (U.toMin(start) + mins > 17 * 60) bad('mt-d', 'Meetings must end by 17:00.');
        if (!venue) bad('mt-v', 'Choose a lab.');
        else if (date) { var x = clash(venue, date, start, mins); if (x) bad('mt-v', venue + ' is booked ' + x.start + '–' + U.hhmm(U.toMin(x.start) + x.mins) + '. Choose another lab or time.'); }
        if (!ok) return false;
        var c = find(g('mt-c'));
        if (live) return call(API.post('/meetings', { challenge: c.id, title: g('mt-t'), people: people, date: date, start: start, mins: mins, venue: venue, agenda: g('mt-a') }));
        MEETINGS.push({ id: 'M-' + (103 + MEETINGS.length), cid: c.id, title: g('mt-t'), challenge: c.title + ' (' + c.id + ')', date: date, start: start, mins: mins, venue: venue, organiser: ME.name, people: people, agenda: g('mt-a') });
        render(); U.toast('Meeting booked in ' + venue + '. ' + people.join(', ') + (people.length > 1 ? ' have' : ' has') + ' been notified.', 'ok');
        // Send to your API here; each invitee gets a "Meeting" notification with the details.
      } }]);
    var root = document.getElementById('modal-root'), dlg = root.querySelector('[role=dialog]'); if (dlg) dlg.classList.replace('max-w-lg', 'max-w-xl');
    var paintPeople = function () {
      var c = find(document.getElementById('mt-c').value), list = [];
      if (c.to) list.push([c.to, 'Student on this challenge']); if (c.by && c.by !== c.to) list.push([c.by, 'Submitted the challenge']);
      document.getElementById('mt-people').innerHTML = list.map(function (p) { return '<label class="flex cursor-pointer items-center gap-2 text-[13.5px]"><input type="checkbox" name="mt-p" value="' + U.esc(p[0]) + '" checked class="size-4 accent-brand-700">' + U.esc(p[0]) + ' <span class="text-xs text-slate-500">' + p[1] + '</span></label>'; }).join('') || '<span class="text-sm text-slate-500">No one to invite yet.</span>';
    };
    var paintVenues = function () {   // booked labs are greyed out for the chosen date and time
      var date = document.getElementById('mt-d').value, start = document.getElementById('mt-s').value, mins = +document.getElementById('mt-m').value;
      var cur = (document.querySelector('input[name=mt-venue]:checked') || {}).value;
      document.getElementById('mt-v').innerHTML = U.VENUES.map(function (v) {
        var x = date && clash(v, date, start, mins), on = cur === v && !x;
        return '<label class="flex flex-col items-center rounded-lg border px-2 py-2 text-center text-[13px] ' + (x ? 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400' : 'cursor-pointer border-slate-300 hover:border-brand-500 has-[:checked]:border-brand-700 has-[:checked]:bg-brand-50 has-[:checked]:text-brand-900') + '">' +
          '<input type="radio" name="mt-venue" value="' + v + '" class="sr-only"' + (x ? ' disabled' : '') + (on ? ' checked' : '') + '><span class="font-semibold">' + v.replace('Lab ', '') + '</span><span class="text-[11px]">' + (x ? 'Booked ' + x.start : 'Available') + '</span></label>';
      }).join('');
    };
    paintPeople(); paintVenues();
    document.getElementById('mt-c').addEventListener('change', paintPeople);
    ['mt-d', 'mt-s', 'mt-m'].forEach(function (id) { document.getElementById(id).addEventListener('change', paintVenues); });
  }

  function meetingList() {
    var list = upcoming();
    U.modal('Upcoming meetings (' + list.length + ')', list.length ? '<div class="-my-2 divide-y divide-slate-100">' + list.map(function (m) {
      return '<div class="flex items-center gap-3 py-2.5"><span class="w-24 shrink-0 rounded-md bg-brand-50 py-1 text-center text-[12px] font-bold text-brand-800 ring-1 ring-brand-200">' + U.esc(m.venue.replace('Lab ', '')) + '</span>' +
        '<div class="min-w-0 flex-1"><div class="truncate font-semibold text-slate-900">' + U.esc(m.title) + ' <span class="font-normal text-slate-500">· ' + m.cid + '</span></div><div class="truncate text-[12.5px] text-slate-600">' + U.esc(U.meetWhen(m)) + ' · ' + U.esc(m.people.join(', ')) + '</div></div>' +
        '<button data-mopen="' + m.id + '" class="btn btn-sm shrink-0">Details</button><button data-mcancel="' + m.id + '" class="btn btn-sm shrink-0 border-red-200 text-red-700 hover:bg-red-50">Cancel</button></div>';
    }).join('') + '</div>' : '<p class="py-6 text-center text-slate-500">No meetings scheduled.</p>',
      [{ label: 'Close' }, { label: 'Schedule meeting', primary: true, onClick: function () { setTimeout(function () { scheduleMeeting(); }, 0); } }]);
    var root = document.getElementById('modal-root'), dlg = root.querySelector('[role=dialog]'); if (dlg) dlg.classList.replace('max-w-lg', 'max-w-2xl');
    root.addEventListener('click', function pick(e) {
      var o = e.target.closest('[data-mopen]'), k = e.target.closest('[data-mcancel]'); if (!o && !k) return;
      root.removeEventListener('click', pick);
      var m = MEETINGS.filter(function (x) { return x.id === (o || k).dataset[o ? 'mopen' : 'mcancel']; })[0];
      if (o) return U.meetingDetails(m);
      if (live) return call(API.del('/meetings/' + m.id), meetingList);
      MEETINGS.splice(MEETINGS.indexOf(m), 1); render(); U.toast('Meeting cancelled. ' + m.people.join(', ') + ' notified.'); meetingList();
    });
  }

  // A supervisor has at most CAP open challenges (waiting for students, in progress or waiting for verification).
  // The matching assigns no new challenges to a supervisor who is full.
  var CAP = 5, OPEN = ['Unallocated', 'Allocated', 'In Progress', 'Pending Verification'];
  var NEED = ['Unallocated', 'Pending Verification', 'In Progress', 'Allocated'];
  var ORDER = ['Submitted', 'Under Review', 'Pending Information', 'Approved', 'Unallocated', 'Allocated', 'In Progress', 'Pending Verification', 'Completed', 'Rejected', 'Interest Review'];

  var mine = function () { return C.filter(function (c) { return OPEN.indexOf(c.status) > -1; }).sort(function (a, b) {
    var fa = a.status === 'Unallocated' && results[a.id] && results[a.id].outcome === 'flagged', fb = b.status === 'Unallocated' && results[b.id] && results[b.id].outcome === 'flagged';
    return (NEED.indexOf(a.status) + (fa ? 0.5 : 0)) - (NEED.indexOf(b.status) + (fb ? 0.5 : 0)) || a.due - b.due; }); };
  var flaggedOf = function (c) { return c.status === 'Unallocated' && results[c.id] && results[c.id].outcome === 'flagged'; };
  var actionsOf = function () { return C.filter(function (c) { return ['Submitted', 'Under Review', 'Pending Verification'].indexOf(c.status) > -1 && c.by !== ME.name && match(c); }); };
  // Action queue = student requests first, then reviews and verifications
  var queueRows = function () { return pendingReq().map(reqRow).concat(actionsOf().map(actRow)); };
  var MY_COLS = [['Challenge', 'minmax(0,1fr)'], ['Status', '150px'], ['Time left', '84px'], ['Action', '112px']];
  function myRow(c) {
    var n = U.daysLeft(c.due), act;
    if (c.status === 'Unallocated') act = flaggedOf(c) ? '<button data-match="' + c.id + '" class="btn btn-sm w-full">Decide</button>' : '<button data-match="' + c.id + '" class="btn btn-primary btn-sm w-full">Allocate</button>';
    else if (c.status === 'Pending Verification') act = '<button data-verify="' + c.id + '" class="btn btn-sm w-full border-green-600 bg-green-600 text-white hover:bg-green-700">Verify</button>';
    else act = '<button data-view="' + c.id + '" class="btn btn-sm w-full">View</button>';
    return [U.cell(c.title, c.id + (c.to ? ' · ' + U.esc(c.to) : '')), U.badge(c.status), '<span class="tabular-nums ' + (n <= 7 ? 'font-semibold text-red-600' : 'text-slate-700') + '">' + n + ' days</span>', act];
  }
  function decRow(c) { return '<div class="min-w-0 flex-1">' + U.cell(c.title, 'No suitable student found', 'warn') + '</div><button data-match="' + c.id + '" class="btn btn-sm w-28 shrink-0">Decide</button>'; }
  function reqRow(r) {
    var c = find(r.id);
    return '<div class="min-w-0 flex-1">' + U.cell(c.title, 'Request from ' + U.esc(r.student)) + '</div>' + U.badge('Student request') +
      '<button data-req="' + r.rid + '" class="btn btn-sm w-28 shrink-0">Respond</button>';
  }
  function actRow(c) {
    var verify = c.status === 'Pending Verification';
    return '<div class="min-w-0 flex-1">' + U.cell(c.title, verify ? 'Completed by ' + U.esc(c.to) : 'by ' + U.esc(c.by)) + '</div>' + U.badge(c.status) +
      (verify ? '<button data-verify="' + c.id + '" class="btn btn-sm w-28 shrink-0 border-green-600 bg-green-600 text-white hover:bg-green-700">Verify</button>' : '<button data-review="' + c.id + '" class="btn btn-sm w-28 shrink-0">Review</button>');
  }
  // "View more": the full list in a window; its buttons work the same as on the dashboard
  function viewMore(key) {
    var all = mine(), html, title;
    if (key === 'my') { title = 'My challenges (' + all.length + ')'; html = U.table(MY_COLS, all.map(myRow)); }
    else if (key === 'dec') { var f = all.filter(flaggedOf); title = 'Needs your decision (' + f.length + ')'; html = U.list(f.map(decRow)); }
    else { var a = queueRows(); title = 'Action queue (' + a.length + ')'; html = U.list(a); }
    U.modal(title, '<div class="-my-2 flex flex-col">' + html + '</div>', [{ label: 'Close' }]);
    var root = document.getElementById('modal-root'), box = root.querySelector('[data-fit]'); if (box) box.removeAttribute('data-fit');
    var dlg = root.querySelector('[role=dialog]'); if (dlg) dlg.classList.replace('max-w-lg', 'max-w-3xl');
    root.addEventListener('click', function pick(e) {
      var b = e.target.closest('[data-match],[data-verify],[data-review],[data-view]'); if (!b) return;
      root.removeEventListener('click', pick); act(b);
    });
  }

  function render() {
    rematch(); Charts.reset();
    var P = U.PAL, count = function (l) { return C.filter(function (c) { return l.indexOf(c.status) > -1; }).length; };
    var unalloc = C.filter(function (c) { return c.status === 'Unallocated' && match(c); }).sort(function (a, b) { return b.score - a.score; });
    var flagged = unalloc.filter(function (c) { return results[c.id] && results[c.id].outcome === 'flagged'; });
    var actions = C.filter(function (c) { return ['Submitted', 'Under Review', 'Pending Verification'].indexOf(c.status) > -1 && match(c); });
    var statuses = ORDER.filter(function (s) { return count([s]); }), big = Math.max.apply(null, statuses.map(function (s) { return count([s]); }));
    var my = mine().filter(match), actions = queueRows(), S = U.SHOW;

    document.getElementById('content').innerHTML =
      U.head(ME.name, 'Supervisor dashboard', period, '<button data-meet="list" class="btn shrink-0 py-2.5">' + U.icon('calendar', 'size-4') + 'Meetings (' + upcoming().length + ')</button><button data-meet="new" class="btn shrink-0 py-2.5">Schedule meeting</button>', '<button data-sub="new" class="btn btn-primary shrink-0 py-2.5">Submit challenge</button>') +
      U.kpis([
        ['My challenges', my.length, '', my.length >= CAP ? '#dc2626' : P.blue, 'layers'],
        ['Awaiting allocation', unalloc.length, '', P.purple, 'pending'],
        ['Needs your decision', flagged.length, '', P.amber, 'flag'],
        ['Completed', count(['Completed']), '', P.teal, 'check']
      ]) +
      '<div class="dash-row grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr_1fr_1.2fr]">' +
        U.card({ id: 'st', title: 'Challenges by status', sub: C.length + ' challenges in your workspace',
          body: U.bars(statuses.map(function (s) { var n = count([s]); return { label: s, value: n, color: s === 'Completed' ? P.teal : n === big ? P.blue : P.light }; })) }) +
        U.card({ id: 'tr', title: 'Submitted vs completed', sub: 'Challenge activity · ' + U.rangeLabel(), body: U.pieBox('ch-trend', 'Challenges submitted and completed') }) +
        U.card({ id: 'load', title: 'Student workload', sub: 'Active challenges / student capacity',
          body: U.segs(STUDENTS.map(function (s) { return { name: s.name + (s.available ? '' : ' (away)'), value: s.load, max: s.cap, label: s.load + ' / ' + s.cap, warn: s.load >= s.cap, color: s.available ? P.blue : P.light, tip: s.available ? '' : 'Unavailable' }; })) }) +
      '</div>' +
      '<div class="dash-row grid grid-cols-1 gap-4 lg:grid-cols-[1.08fr_1fr]" data-rowb>' +
        U.card({ id: 'my', title: 'My challenges', count: my.length, tone: my.length >= CAP ? 'warn' : '',
          body: U.table(MY_COLS, my.slice(0, S).map(myRow), 'No open challenges.', U.viewMore('my', my.length)) }) +
        '<div class="flex min-h-0 flex-col gap-4">' +
          U.card({ id: 'dec', cls: 'fit-top', title: 'Needs your decision', count: flagged.length, tone: 'warn', countRight: true,
            body: U.list(flagged.slice(0, S).map(decRow), 'Nothing needs a decision.', U.viewMore('dec', flagged.length)) }) +
          U.card({ id: 'act', cls: 'flex-1', title: 'Action queue', count: actions.length,
            body: U.list(actions.slice(0, S), 'All caught up.', U.viewMore('act', actions.length)) }) +
        '</div>' +
      '</div>';

    Charts.draw('ch-trend', function (el) { Charts.pie(el, [{ label: 'Submitted', value: inR('sub'), color: P.blue }, { label: 'Completed', value: inR('done'), color: P.teal }], { centerLabel: 'challenges' }); });
    U.fitLists();
  }

  function matchModal(c) {
    var r = results[c.id], flagged = r.outcome === 'flagged';
    var list = '<div class="max-h-56 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">' + r.ranked.map(function (x) {
      var rec = r.recommended.indexOf(x) > -1, ok = x.student.available && x.student.load < x.student.cap;
      return '<label class="flex items-center gap-3 px-3 py-2 ' + (ok ? 'cursor-pointer' : 'cursor-not-allowed opacity-55') + '"><input type="radio" name="pick" value="' + U.esc(x.student.name) + '" ' + (rec && x === r.recommended[0] ? 'checked' : '') + (ok ? '' : ' disabled') + ' class="accent-brand-700">' +
        '<span class="min-w-0 flex-1"><b class="font-semibold">' + U.esc(x.student.name) + '</b>' + (rec ? ' <span class="ml-1 rounded bg-brand-700 px-1.5 py-px text-[10px] font-bold text-white">RECOMMENDED</span>' : '') + '</span>' +
        '<span class="text-xs text-slate-500">' + (x.student.available ? x.student.load + '/' + x.student.cap + ' active' : 'Unavailable') + '</span></label>';
    }).join('') + '</div>';
    if (!flagged) {
      U.modal('Allocate ' + c.id, '<p class="mb-3 font-semibold">' + U.esc(c.title) + '</p>' + list +
        '<label for="why" class="label mt-3">Reason <span class="font-normal text-slate-500">(if not the recommended student)</span></label><textarea id="why" rows="2" class="input"></textarea><span id="why-err" class="err"></span>', [
        { label: 'Cancel' },
        { label: 'Approve allocation', primary: true, onClick: function () {
          var p = document.querySelector('input[name=pick]:checked'); if (!p) { document.getElementById('why-err').textContent = 'Choose a student.'; return false; }
          var isRec = r.recommended.some(function (x) { return x.student.name === p.value; }), why = document.getElementById('why').value.trim();
          if (!isRec && why.length < 3) { document.getElementById('why-err').textContent = 'Give a reason.'; return false; }
          if (live) return call(API.post('/challenges/' + c.id + '/allocate', { student: p.value, reason: why }));
          var st = STUDENTS.filter(function (s) { return s.name === p.value; })[0]; st.load++;
          c.status = 'In Progress'; c.to = st.name; delete results[c.id]; render(); U.toast(c.id + ' assigned to ' + st.name + '. They have been notified.', 'ok');
        } }]);
    } else {
      U.modal('Decide — ' + c.id, '<p class="mb-1 font-semibold">' + U.esc(c.title) + '</p><div class="mb-1.5">' + U.funding(c.funded) + '</div><p class="mb-3 text-[13px] text-slate-600">' + U.esc(c.desc) + '</p>' +
        '<label for="dec" class="label">Note <span class="font-normal text-slate-500">(required to reject)</span></label><textarea id="dec" rows="2" class="input"></textarea><span id="dec-err" class="err"></span>', [
        { label: 'Reject', danger: true, onClick: function () { if (document.getElementById('dec').value.trim().length < 3) { document.getElementById('dec-err').textContent = 'Give a reason for rejecting.'; return false; } if (live) return call(API.post('/challenges/' + c.id + '/decide', { action: 'reject', note: document.getElementById('dec').value.trim() })); c.status = 'Rejected'; delete results[c.id]; render(); U.toast(c.id + ' rejected.'); } },
        { label: 'Keep unallocated', onClick: function () { if (live) return call(API.post('/challenges/' + c.id + '/decide', { action: 'keep' })); U.toast(c.id + ' stays unallocated.'); } },
        { label: 'Approve for further review', primary: true, onClick: function () { if (live) return call(API.post('/challenges/' + c.id + '/decide', { action: 'further_review', note: document.getElementById('dec').value.trim() })); c.status = 'Interest Review'; delete results[c.id]; render(); U.toast(c.id + ' sent for further review.', 'ok'); } }]);
    }
  }

  // A student's request to work on a challenge: accept (student is allocated) or decline (reason required)
  function respond(r) {
    var c = find(r.id), s = STUDENTS.filter(function (x) { return x.name === r.student; })[0] || { interests: [], load: 0, cap: 3 };
    var full = s.load >= s.cap, row = function (k, v) { return '<div class="flex gap-3"><dt class="w-28 shrink-0 text-slate-500">' + k + '</dt><dd class="min-w-0">' + v + '</dd></div>'; };
    U.modal('Student request — ' + c.id,
      '<p class="mb-2 font-semibold">' + U.esc(c.title) + '</p>' +
      '<dl class="space-y-1 text-[13px]">' + row('Student', '<b>' + U.esc(r.student) + '</b>') + row('Interests', U.esc(s.interests.join(', ') || '—')) +
        row('Workload', s.load + ' / ' + s.cap + (full ? ' <span class="font-semibold text-red-600">· at capacity</span>' : '')) + row('Status', U.badge(c.status)) + '</dl>' +
      (r.msg ? '<p class="mt-3 rounded-md bg-slate-50 px-3 py-2 text-[13px] text-slate-700">“' + U.esc(r.msg) + '”</p>' : '') +
      '<label for="rq" class="label mt-3">Note to the student <span class="font-normal text-slate-500">(required to decline)</span></label><textarea id="rq" rows="2" class="input"></textarea><span id="rq-err" class="err"></span>', [
      { label: 'Decline', danger: true, onClick: function () {
        if (document.getElementById('rq').value.trim().length < 3) { document.getElementById('rq-err').textContent = 'Give the student a reason.'; return false; }
        if (live) return call(API.post('/requests/' + r.rid + '/decline', { note: document.getElementById('rq').value.trim() }));
        r.status = 'declined'; render(); U.toast('Request declined — ' + r.student + ' has been notified.'); } },
      { label: 'Accept', primary: true, onClick: function () {
        var open = OPEN.indexOf(c.status) > -1;
        if (full) { document.getElementById('rq-err').textContent = r.student + ' already has ' + s.cap + ' challenges.'; return false; }
        if (!open && mine().length >= CAP) { document.getElementById('rq-err').textContent = 'You already have ' + CAP + ' open challenges.'; return false; }
        if (live) return call(API.post('/requests/' + r.rid + '/accept'));
        r.status = 'accepted'; c.to = r.student; c.status = 'Allocated'; s.load++; delete results[c.id];
        REQUESTS.forEach(function (x) { if (x.id === c.id && x.status === 'pending') x.status = 'declined'; });
        render(); U.toast(r.student + ' allocated to ' + c.id + ' and notified.', 'ok'); } }]);
  }
  // Supervisors can submit their own challenges; funding is not required for these
  function submitChallenge() {
    var min = U.isoDay(new Date(Date.now() + U.DAY));
    var e = function (id, m) { document.getElementById(id + '-err').textContent = m; document.getElementById(id).classList.add('invalid'); return false; };
    U.modal('Submit challenge',
      '<div class="space-y-3"><div><label for="s-title" class="label">Challenge title <span class="text-red-600">*</span></label><input id="s-title" class="input"><span id="s-title-err" class="err"></span></div>' +
      '<div class="grid grid-cols-2 gap-3">' +
      '<div><label for="s-pri" class="label">Priority</label><select id="s-pri" class="input"><option>Low</option><option selected>Medium</option><option>High</option><option>Critical</option></select></div>' +
      '<div><label for="s-due" class="label">Deadline <span class="text-red-600">*</span></label><input id="s-due" type="date" min="' + min + '" class="input"><span id="s-due-err" class="err"></span></div></div>' +
      '<div><label for="s-desc" class="label">Description <span class="text-red-600">*</span></label><textarea id="s-desc" rows="3" class="input"></textarea><span id="s-desc-err" class="err"></span></div>' +
      '<div><label for="s-docs" class="label">Supporting documents</label><input id="s-docs" type="file" multiple class="block w-full text-sm file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:font-semibold file:text-brand-800"></div></div>',
      [{ label: 'Cancel' }, { label: 'Submit challenge', primary: true, onClick: function () {
        var t = document.getElementById('s-title').value.trim(), due = document.getElementById('s-due').value, desc = document.getElementById('s-desc').value.trim(), ok = true;
        if (t.length < 5) ok = e('s-title', 'Enter a title (5+ characters).');
        if (!due) ok = e('s-due', 'Choose a deadline.');
        if (desc.length < 20) ok = e('s-desc', 'Describe the challenge (20+ characters).');
        if (!ok) return false;
        if (live) {
          var fd = new FormData(), fl = document.getElementById('s-docs').files;
          fd.append('title', t); fd.append('description', desc); fd.append('due_date', due); fd.append('priority', document.getElementById('s-pri').value);
          for (var i = 0; i < fl.length; i++) fd.append('files', fl[i]);
          return call(API.post('/challenges', fd));
        }
        var room = mine().length < CAP;
        var c = { id: 'DCC-0000' + (++subSeq), funded: 'none', title: t, desc: desc, by: ME.name, status: room ? 'Unallocated' : 'Submitted', due: new Date(due + 'T17:00') };
        C.unshift(c); render();
        U.toast(room ? c.id + ' added to your challenges — students are being matched.' : c.id + ' submitted. You have ' + CAP + ' open challenges, so another supervisor will take it.', 'ok');
      } }]);
  }
  var find = function (id) { return C.filter(function (c) { return c.id === id; })[0]; };
  document.getElementById('content').addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) act(b); });
  function act(b) {
    var c;
    if (b.dataset.meet) return b.dataset.meet === 'new' ? scheduleMeeting() : meetingList();
    if (b.dataset.sub) return submitChallenge();
    if (b.dataset.req) return respond(REQUESTS.filter(function (r) { return String(r.rid) === b.dataset.req; })[0]);
    if (b.dataset.more) viewMore(b.dataset.more);
    else if (b.dataset.view) {
      c = find(b.dataset.view);
      U.modal(c.id, '<p class="mb-2 font-semibold">' + U.esc(c.title) + '</p><dl class="space-y-1 text-[13px]"><div class="flex gap-3"><dt class="w-24 text-slate-500">Status</dt><dd>' + U.badge(c.status) + '</dd></div><div class="flex gap-3"><dt class="w-24 text-slate-500">Student</dt><dd>' + U.esc(c.to || '—') + '</dd></div><div class="flex gap-3"><dt class="w-24 text-slate-500">Submitted by</dt><dd>' + U.esc(c.by) + '</dd></div><div class="flex gap-3"><dt class="w-24 text-slate-500">Deadline</dt><dd>' + U.fmt(c.due) + '</dd></div><div class="flex gap-3"><dt class="w-24 text-slate-500">Funding</dt><dd>' + U.funding(c.funded) + '</dd></div></dl>', [{ label: 'Close' }]);
    }
    else if (b.dataset.match) matchModal(find(b.dataset.match));
    else if (b.dataset.review) {
      c = find(b.dataset.review); if (c.status === 'Submitted') { c.status = 'Under Review'; render(); if (live) API.post('/challenges/' + c.id + '/open').catch(function () {}); }
      U.modal('Review ' + c.id, '<div class="mb-3"><div class="font-semibold">' + U.esc(c.title) + '</div><div class="text-xs text-slate-500">Submitted by ' + U.esc(c.by) + ' · due ' + U.fmt(c.due) + '</div><div class="mt-1.5">' + U.funding(c.funded) + '</div><p class="mt-2 text-[13px] text-slate-700">' + U.esc(c.desc || '') + '</p></div>' +
        '<label for="rv" class="label">Comment <span class="font-normal text-slate-500">(required to reject or request information)</span></label><textarea id="rv" rows="3" class="input"></textarea><span id="rv-err" class="err"></span>', [
        { label: 'Reject', danger: true, onClick: function () { var t = document.getElementById('rv').value.trim(); if (t.length < 3) { document.getElementById('rv-err').textContent = 'Give a reason for rejecting.'; return false; } if (live) return call(API.post('/challenges/' + c.id + '/review', { action: 'reject', comment: t })); c.status = 'Rejected'; render(); U.toast(c.id + ' rejected.'); } },
        { label: 'Request information', onClick: function () { var t = document.getElementById('rv').value.trim(); if (t.length < 3) { document.getElementById('rv-err').textContent = 'Say what information is needed.'; return false; } if (live) return call(API.post('/challenges/' + c.id + '/review', { action: 'request_info', comment: t })); c.status = 'Pending Information'; render(); U.toast('Information requested on ' + c.id + '.'); } },
        { label: 'Approve', primary: true, onClick: function () { if (live) return call(API.post('/challenges/' + c.id + '/review', { action: 'approve', comment: document.getElementById('rv').value.trim() })); c.status = 'Approved'; render(); U.toast(c.id + ' approved.', 'ok'); } }]);
    } else if (b.dataset.verify) {
      c = find(b.dataset.verify);
      U.modal('Verify completed work', '<p class="mb-3">Verify <b>' + U.esc(c.title) + '</b> by ' + U.esc(c.to) + '.</p><label for="fb" class="label">Feedback <span class="font-normal text-slate-500">(required to return)</span></label><textarea id="fb" rows="2" class="input"></textarea><span id="fb-err" class="err"></span>', [
        { label: 'Return for rework', onClick: function () { if (document.getElementById('fb').value.trim().length < 3) { document.getElementById('fb-err').textContent = 'Add feedback for the student.'; return false; } if (live) return call(API.post('/challenges/' + c.id + '/verify', { action: 'return', feedback: document.getElementById('fb').value.trim() })); c.status = 'In Progress'; render(); U.toast(c.id + ' returned with feedback.'); } },
        { label: 'Approve & complete', primary: true, onClick: function () { if (live) return call(API.post('/challenges/' + c.id + '/verify', { action: 'approve', feedback: document.getElementById('fb').value.trim() })); c.status = 'Completed'; render(); U.toast(c.id + ' marked as completed.', 'ok'); } }]);
    }
  }
  document.getElementById('search').addEventListener('input', function () { q = this.value.trim().toLowerCase(); render(); });
  U.rangeInit({ preset: '6m', presets: [['6m', 'Last 6 months'], ['year', 'This year'], ['sem', 'This semester'], ['last', 'Last semester'], ['all', 'All time']], kinds: [{ key: 'sub', label: 'Submitted', color: U.PAL.blue }, { key: 'done', label: 'Completed', color: U.PAL.teal }], events: function () { return EVENTS; }, onChange: render });
  U.notes([
    { kind: 'alert', from: 'Lwazi Dube', about: 'DCC-000024', text: 'Requested to work on “Reduce queues at the campus clinic”. Respond in the Action queue.', ago: 0, unread: true },
    { kind: 'alert', from: 'Thando Khumalo', about: 'DCC-000009', text: 'Final report submitted — waiting for your verification.', ago: 0, unread: true },
    { kind: 'alert', from: 'BET Media', about: 'DCC-000020', text: 'New challenge submitted for review.', ago: 0, unread: true },
    { kind: 'message', from: 'Lwazi Dube', about: 'DCC-000015', text: 'Could we meet on Thursday to go through the chatbot test results?', ago: 1, unread: true },
    { kind: 'message', from: 'Sbongokuhle Msomi', about: 'DCC-000001', text: 'Thank you for the update — the audience numbers will follow next week.', ago: 2, unread: false },
    { kind: 'update', from: 'Amahle Mthembu', about: 'DCC-000001', text: 'Progress updated to 45%.', ago: 3, unread: false }
  ]);
  if (live) API.boot('supervisor').then(function (d) { apply(d); render(); }).catch(function (e) { API.fail(e); render(); });
  else render();
})();
