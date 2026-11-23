/* Shared UI helpers for the role screens (Student, Supervisor):
   header, profile panel, notifications, icons, badges, toast and modal. No framework. */
(function () {
  'use strict';
  var P = {
    grid: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z', list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01', user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    inbox: 'M22 12h-6l-2 3h-4l-2-3H2M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z', clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2',
    layers: 'M12 2 2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5', check: 'M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4 12 14.01l-3-3', scale: 'M12 3v18M7 21h10M5 7h14M5 7l-3 7a3.5 3.5 0 0 0 6 0L5 7zM19 7l-3 7a3.5 3.5 0 0 0 6 0l-3-7z',
    bars: 'M18 20V10M12 20V4M6 20v-6', share: 'M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5', report: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8',
    bell: 'M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0', msg: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
    cog: 'M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2zM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0', logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
    search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.35-4.35', menu: 'M3 12h18M3 6h18M3 18h18', x: 'M18 6 6 18M6 6l12 12', compass: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM16.24 7.76l-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12z',
    upload: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12', activity: 'M22 12h-4l-3 9L9 3l-3 9H2', calendar: 'M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zM16 2v4M8 2v4M3 10h18'
  };
  var icon = function (n, cls) { return '<svg class="' + (cls || 'size-4.5 shrink-0') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + P[n] + '"/></svg>'; };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var DAY = 864e5;
  var fmt = function (dt) { return dt.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' }); };
  var daysLeft = function (dt) { return Math.ceil((dt - Date.now()) / DAY); };
  var dayChip = function (dt) {
    var d = daysLeft(dt), cls = d < 0 ? 'bg-red-100 text-red-800' : d <= 7 ? 'bg-orange-100 text-orange-800' : 'bg-slate-100 text-slate-700';
    return '<span class="shrink-0 rounded-md px-2 py-0.5 text-xs font-bold ' + cls + '">' + (d < 0 ? -d + 'd overdue' : d === 0 ? 'Due today' : d + 'd left') + '</span>';
  };
  /* Status colours from the spec: Submitted blue · In Progress orange · Unallocated grey · Completed green · Rejected red · Pending yellow */
  var BADGE = {
    'Submitted': 'bg-blue-50 text-blue-700 ring-blue-600/15', 'Under Review': 'bg-yellow-50 text-yellow-800 ring-yellow-600/20', 'Pending Information': 'bg-yellow-50 text-yellow-800 ring-yellow-600/20',
    'Approved': 'bg-teal-50 text-teal-700 ring-teal-600/15', 'Rejected': 'bg-red-50 text-red-700 ring-red-600/15', 'Unallocated': 'bg-slate-100 text-slate-600 ring-slate-500/15',
    'Allocated': 'bg-violet-50 text-violet-700 ring-violet-600/15', 'In Progress': 'bg-orange-50 text-orange-700 ring-orange-600/15', 'Pending Verification': 'bg-yellow-50 text-yellow-800 ring-yellow-600/20',
    'Completed': 'bg-green-50 text-green-700 ring-green-600/15', 'Draft': 'bg-slate-50 text-slate-500 ring-slate-400/20', 'Cancelled': 'bg-slate-200 text-slate-700 ring-slate-500/10',
    'Student request': 'bg-violet-50 text-violet-700 ring-violet-600/15', 'Requested': 'bg-amber-50 text-amber-800 ring-amber-600/20', 'Declined': 'bg-red-50 text-red-700 ring-red-600/15'
  };
  var badge = function (s) { return '<span class="badge ' + (BADGE[s] || BADGE.Draft) + '">' + esc(s) + '</span>'; };

  function shell(cfg) {
    ME = cfg;
    document.getElementById('top-avatar').textContent = cfg.initials;
  }
  /* Notifications panel — opened from the bell.
     Messages are notifications too: items with kind 'message' get a Reply button.
     items: [{kind:'message'|'alert'|'update', from, text, about, ago (days), unread}] */
  var NOTES = [], tab = 'all';
  function notes(items) { NOTES = items; paintBell(); }
  // Notifications from the API → panel items. opener(n) may return a function for "View details".
  function serverNotes(list, opener) {
    notes((list || []).map(function (n) {
      var item = { nid: n.id, kind: n.kind, from: n.from, about: n.about, text: n.text, ago: n.ago, unread: n.unread, ref: n.ref };
      var o = opener && opener(item); if (o) item.open = o;
      return item;
    }));
  }
  function paintBell() {
    var n = NOTES.filter(function (x) { return x.unread; }).length, c = document.getElementById('bell-count');
    if (c) { c.textContent = ''; c.classList.toggle('hidden', !n); }
    var b = document.getElementById('bell'); if (b) b.setAttribute('aria-label', 'Notifications' + (n ? ', ' + n + ' unread' : ''));
  }
  function openNotes() {
    var box = document.getElementById('notes-pop');
    if (box) { box.remove(); return; }
    box = document.createElement('div'); box.id = 'notes-pop';
    box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', 'Notifications');
    box.className = 'fixed top-14 right-3 z-[60] flex max-h-[calc(100vh-72px)] w-[min(400px,calc(100vw-24px))] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl';
    document.body.appendChild(box); paintNotes();
  }
  var KIND = { meeting: ['calendar', 'bg-brand-50 text-brand-700', 'Meeting'], assign: ['check', 'bg-green-50 text-green-700', 'Assigned'], message: ['msg', 'bg-brand-50 text-brand-700', 'Message'], alert: ['bell', 'bg-yellow-50 text-yellow-700', 'Action needed'], update: ['activity', 'bg-slate-100 text-slate-600', 'Update'] };
  function paintNotes() {
    var box = document.getElementById('notes-pop'); if (!box) return;
    var list = NOTES.filter(function (x) { return tab === 'all' || x.kind === 'message'; }), msgs = NOTES.filter(function (x) { return x.kind === 'message'; }).length;
    var tabBtn = function (k, l) { return '<button data-tab="' + k + '" class="cursor-pointer rounded-md px-2.5 py-1 text-xs font-semibold ' + (tab === k ? 'bg-brand-700 text-white' : 'text-slate-600 hover:bg-slate-100') + '">' + l + '</button>'; };
    box.innerHTML = '<div class="flex items-center gap-2 border-b border-slate-200 px-4 py-2.5"><h2 class="text-sm font-bold">Notifications</h2><div class="ml-2 flex gap-1">' + tabBtn('all', 'All') + tabBtn('message', 'Messages (' + msgs + ')') + '</div>' +
      '<button data-readall class="ml-auto cursor-pointer text-xs font-semibold text-brand-700 hover:underline">Mark all read</button></div>' +
      '<ul class="min-h-0 flex-1 divide-y divide-slate-100 overflow-y-auto">' + (list.map(function (x) {
        var k = KIND[x.kind] || KIND.update, i = NOTES.indexOf(x);
        return '<li class="flex gap-3 px-4 py-2.5 ' + (x.unread ? 'bg-brand-50/50' : '') + '"><span class="flex size-7 shrink-0 items-center justify-center rounded-lg ' + k[1] + '">' + icon(k[0], 'size-3.5') + '</span>' +
          '<div class="min-w-0 flex-1"><div class="text-[12px] text-slate-500"><b class="font-semibold text-brand-900">' + esc(x.from) + '</b>' + (x.about ? ' · ' + esc(x.about) : '') + ' · ' + (x.ago ? x.ago + 'd ago' : 'today') + '</div>' +
          '<div class="text-[12.5px] text-slate-700">' + esc(x.text) + '</div>' + (x.kind === 'message' ? '<button data-reply="' + i + '" class="btn mt-1.5 px-2.5 py-0.5 text-xs">Reply</button>' : '') +
          (x.open ? '<button data-open="' + i + '" class="btn btn-primary mt-1.5 px-2.5 py-0.5 text-xs">View details</button>' : '') + '</div>' +
          (x.unread ? '<i class="mt-1.5 size-2 shrink-0 rounded-full bg-brand-600" aria-label="unread"></i>' : '') + '</li>';
      }).join('') || '<li class="px-4 py-8 text-center text-sm text-slate-500">Nothing here.</li>') + '</ul>';
  }
  document.addEventListener('click', function (e) {
    var box = document.getElementById('notes-pop');
    if (e.target.closest('#bell')) { e.stopPropagation(); openNotes(); return; }
    if (!box) return;
    if (!box.contains(e.target)) { box.remove(); return; }
    var t = e.target.closest('[data-tab]'); if (t) { tab = t.dataset.tab; paintNotes(); return; }
    if (e.target.closest('[data-readall]')) { NOTES.forEach(function (x) { x.unread = false; }); paintNotes(); paintBell(); if (window.API && API.on()) API.post('/notifications/read-all').catch(API.fail); return; }
    var o = e.target.closest('[data-open]'); if (o) { var n = NOTES[+o.dataset.open]; if (n.unread && n.nid && window.API && API.on()) API.post('/notifications/' + n.nid + '/read').catch(function () {}); n.unread = false; box.remove(); paintBell(); n.open(); return; }
    var r = e.target.closest('[data-reply]'); if (r) {
      var m = NOTES[+r.dataset.reply]; if (m.unread && m.nid && window.API && API.on()) API.post('/notifications/' + m.nid + '/read').catch(function () {}); m.unread = false; box.remove(); paintBell();
      modal('Reply to ' + m.from, '<p class="mb-2 rounded-lg bg-slate-50 px-3 py-2 text-[13px] text-slate-600">' + esc(m.text) + '</p><label for="reply-txt" class="label">Your reply</label><textarea id="reply-txt" rows="3" class="input"></textarea><span id="reply-err" class="err"></span>', [
        { label: 'Cancel' },
        { label: 'Send', primary: true, onClick: function () { if (document.getElementById('reply-txt').value.trim().length < 2) { document.getElementById('reply-err').textContent = 'Write a reply.'; return false; } if (window.API && API.on()) { API.post('/messages', { to: m.from, about: m.about || '', text: document.getElementById('reply-txt').value.trim() }).then(function () { toast('Reply sent to ' + m.from + '.', 'ok'); }).catch(API.fail); return; } toast('Reply sent to ' + m.from + '.', 'ok'); } }]);
    }
  }, true);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { var b = document.getElementById('notes-pop'); if (b) b.remove(); } });

  /* ---------- Profile panel (opened from the initials button) ---------- */
  var ME = null;
  var AREAS = ['Software & Web Development', 'Data Science & Machine Learning', 'Internet of Things & Embedded Systems', 'Environmental Systems & Water', 'Renewable Energy & Sustainability', 'Health & Community Wellbeing', 'Education & Skills Development', 'Entrepreneurship & Small Business Support', 'Design, Media & Communication', 'Research'];   // same as registration
  function logout() {
    modal('Log out', '<p>Are you sure you want to log out of Development Challenges Community?</p>', [{ label: 'Cancel' }, { label: 'Log out', primary: true, onClick: function () { if (window.API && API.on()) return API.logout(); try { sessionStorage.clear(); } catch (e) {} location.href = 'login.html'; } }]);
  }
  function closeProfile() { var p = document.getElementById('profile-pop'); if (p) p.remove(); var a = document.getElementById('top-avatar'); if (a) a.setAttribute('aria-expanded', 'false'); }
  function openProfile() {
    if (document.getElementById('profile-pop')) return closeProfile();
    var box = document.createElement('div'), p = ME.profile || {};
    box.id = 'profile-pop'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', 'Your profile');
    box.className = 'fixed top-16 right-3 z-[60] w-[min(400px,calc(100vw-24px))] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl';
    var row = function (k, v) { return v ? '<div class="flex gap-3 py-1.5"><dt class="w-24 shrink-0 text-slate-500">' + k + '</dt><dd class="min-w-0 font-medium break-words text-slate-800">' + esc(v) + '</dd></div>' : ''; };
    box.innerHTML =
      '<div class="flex items-center gap-3 bg-brand-950 px-4 py-4"><span class="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-600 text-[16px] font-bold text-white ring-2 ring-white/20">' + (p.photo ? '<img src="' + p.photo + '" alt="" class="size-full object-cover">' : esc(ME.initials)) + '</span>' +
        '<div class="min-w-0 flex-1"><div class="truncate text-[15px] font-semibold text-white">' + esc(ME.name) + '</div><div class="truncate text-[12px] text-blue-200">' + esc(ME.roleLabel) + (p.id ? ' · ' + esc(p.id) : '') + '</div></div>' +
        '<button data-prof="settings" aria-label="Settings" title="Settings" class="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-blue-200 hover:bg-white/10 hover:text-white">' + icon('cog', 'size-5') + '</button></div>' +
      '<dl class="divide-y divide-slate-100 px-4 py-1.5 text-[13px]">' + row('Email', p.email) + row('Phone', p.phone) + row('Organisation', p.org) + row('Interest', p.interest) + row('Address', p.address) + row('Member since', p.joined ? fmt(new Date(p.joined)) : '') + '</dl>' +
      '<div class="grid grid-cols-[1fr_auto_auto] gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3"><button data-prof="edit" class="btn btn-primary py-2 text-[13px]">' + icon('user', 'size-4') + 'Update information</button>' +
        '<button data-prof="settings" class="btn px-3 py-2 text-[13px]">' + icon('cog', 'size-4') + 'Settings</button><button data-prof="logout" class="btn border-red-200 px-3 py-2 text-[13px] text-red-700 hover:bg-red-50">' + icon('logout', 'size-4') + 'Logout</button></div>';
    document.body.appendChild(box); document.getElementById('top-avatar').setAttribute('aria-expanded', 'true');
    box.querySelector('[data-prof=edit]').focus();
  }
  function editProfile() {
    closeProfile();
    var p = ME.profile || {}, f = function (id, label, val, type, extra) { return '<div><label for="pf-' + id + '" class="label">' + label + '</label><input id="pf-' + id + '" type="' + (type || 'text') + '" value="' + esc(val || '') + '" class="input py-2" ' + (extra || '') + '><span id="pf-' + id + '-err" class="err"></span></div>'; };
    modal('Update information',
      '<div class="grid grid-cols-2 gap-x-4 gap-y-2.5">' +
        '<div class="col-span-2 flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-2"><span class="flex size-9 items-center justify-center rounded-full bg-brand-100 text-[13px] font-bold text-brand-700">' + esc(ME.initials) + '</span><div class="min-w-0 flex-1"><div class="truncate font-semibold">' + esc(ME.name) + '</div><div class="text-xs text-slate-500">' + esc(ME.roleLabel) + (p.id ? ' · ' + esc(p.id) : '') + ' · name and ID can only be changed by an administrator</div></div></div>' +
        f('email', 'Email address <span class="text-red-600">*</span>', p.email, 'email', 'autocomplete="email"') +
        f('phone', 'Phone number <span class="text-red-600">*</span>', p.phone, 'tel', 'autocomplete="tel"') +
        f('org', 'Organisation <span class="text-red-600">*</span>', p.org, 'text', 'autocomplete="organization"') +
        (p.interest !== undefined ? '<div><label for="pf-interest" class="label">Area of Interest</label><select id="pf-interest" class="input py-2">' + AREAS.map(function (a) { return '<option' + (a === p.interest ? ' selected' : '') + '>' + esc(a) + '</option>'; }).join('') + '</select></div>' : '<div></div>') +
        '<div class="col-span-2">' + f('address', 'Physical address', p.address, 'text', 'autocomplete="street-address"') + '</div>' +
        '<div class="col-span-2"><label for="pf-photo" class="label">Profile photo <span class="font-normal text-slate-500">(JPG/PNG, max 2 MB)</span></label><input id="pf-photo" type="file" accept="image/jpeg,image/png" class="block w-full text-sm file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:font-semibold file:text-brand-800"><span id="pf-photo-err" class="err"></span></div>' +
      '</div>',
      [{ label: 'Cancel' }, { label: 'Save changes', primary: true, onClick: function () {
        var v = function (id) { return document.getElementById('pf-' + id).value.trim(); }, ok = true;
        var bad = function (id, m) { document.getElementById('pf-' + id + '-err').textContent = m; document.getElementById('pf-' + id).classList.add('invalid'); ok = false; };
        document.querySelectorAll('#modal-root .err').forEach(function (e) { e.textContent = ''; }); document.querySelectorAll('#modal-root .invalid').forEach(function (e) { e.classList.remove('invalid'); });
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v('email'))) bad('email', 'Enter a valid email address.');
        if (!/^(\+27|0)[6-8]\d{8}$/.test(v('phone').replace(/[\s-]/g, '')) && !/^0\d{9}$/.test(v('phone').replace(/[\s-]/g, ''))) bad('phone', 'Enter a valid South African number.');
        if (v('org').length < 2) bad('org', 'Enter your organisation.');
        var file = document.getElementById('pf-photo').files[0];
        if (file && (file.size > 2 * 1048576 || !/image\/(jpeg|png)/.test(file.type))) bad('photo', 'Use a JPG or PNG under 2 MB.');
        if (!ok) return false;
        if (window.API && API.on()) {
          var body = { email: v('email'), phone: v('phone'), org: v('org'), address: v('address') };
          if (document.getElementById('pf-interest')) body.interest = document.getElementById('pf-interest').value;
          API.put('/me', body).then(function (u) { ME.profile = u.profile; API.session(API.token(), u); toast('Your information has been updated.', 'ok'); }).catch(API.fail);
          return;
        }
        p.email = v('email'); p.phone = v('phone'); p.org = v('org'); p.address = v('address');
        if (document.getElementById('pf-interest')) p.interest = document.getElementById('pf-interest').value;
        ME.profile = p;
        var done = function () { toast('Your information has been updated.', 'ok'); };
        if (file) { var r = new FileReader(); r.onload = function () { p.photo = r.result; var a = document.getElementById('top-avatar'); a.innerHTML = '<img src="' + r.result + '" alt="" class="size-full rounded-full object-cover">'; done(); }; r.readAsDataURL(file); } else done();
        // Send to your API here, e.g. fetch('/api/profile', { method: 'PUT', body: … })
      } }]);
  }
  var PREFS = { email: true, alloc: true, msgs: true, remind: '7' };
  function settings() {
    closeProfile();
    var tg = function (id, label, hint, on) { return '<label class="flex cursor-pointer items-center gap-3 py-2"><span class="min-w-0 flex-1"><span class="block font-medium text-slate-800">' + label + '</span><span class="block text-xs text-slate-500">' + hint + '</span></span>' +
      '<input id="st-' + id + '" type="checkbox"' + (on ? ' checked' : '') + ' class="peer sr-only"><span class="relative h-5 w-9 shrink-0 rounded-full bg-slate-300 transition peer-checked:bg-brand-700 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-500 after:absolute after:top-0.5 after:left-0.5 after:size-4 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-4"></span></label>'; };
    var pf = function (id, label, ac) { return '<div><label for="st-' + id + '" class="label">' + label + '</label><input id="st-' + id + '" type="password" class="input py-2" autocomplete="' + ac + '"><span id="st-' + id + '-err" class="err"></span></div>'; };
    modal('Settings',
      '<h4 class="mb-1 text-[13px] font-bold text-brand-900">Notifications</h4><div class="divide-y divide-slate-100 rounded-lg border border-slate-200 px-3">' +
        tg('email', 'Email me notifications', 'Copies of notifications are sent to your email.', PREFS.email) +
        tg('alloc', 'Challenge and allocation updates', 'New allocations, reviews and status changes.', PREFS.alloc) +
        tg('msgs', 'Messages', 'When someone sends you a message.', PREFS.msgs) +
        '<div class="flex items-center gap-3 py-2"><label for="st-remind" class="min-w-0 flex-1"><span class="block font-medium text-slate-800">Deadline reminders</span><span class="block text-xs text-slate-500">How early to remind you before a deadline.</span></label><select id="st-remind" class="input w-36 py-1.5">' +
          [['3', '3 days before'], ['7', '7 days before'], ['14', '14 days before'], ['0', 'Off']].map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === PREFS.remind ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></div>' +
      '</div>' +
      '<h4 class="mt-4 mb-1 text-[13px] font-bold text-brand-900">Change password <span class="font-normal text-slate-500">(optional)</span></h4>' +
      '<div class="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2"><div class="sm:col-span-2">' + pf('cur', 'Current password', 'current-password') + '</div>' + pf('pw', 'New password', 'new-password') + pf('pw2', 'Confirm new password', 'new-password') + '</div>',
      [{ label: 'Cancel' }, { label: 'Save settings', primary: true, onClick: function () {
        var v = function (id) { return document.getElementById('st-' + id).value; }, ok = true;
        var bad = function (id, m) { document.getElementById('st-' + id + '-err').textContent = m; document.getElementById('st-' + id).classList.add('invalid'); ok = false; };
        document.querySelectorAll('#modal-root .err').forEach(function (e) { e.textContent = ''; }); document.querySelectorAll('#modal-root .invalid').forEach(function (e) { e.classList.remove('invalid'); });
        var change = v('cur') || v('pw') || v('pw2');
        if (change) {
          if (!v('cur')) bad('cur', 'Enter your current password.');
          if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).{8,}$/.test(v('pw'))) bad('pw', '8+ characters with upper, lower, number and symbol.');
          else if (v('pw') !== v('pw2')) bad('pw2', 'Passwords do not match.');
          else if (v('pw') === v('cur')) bad('pw', 'Choose a different password.');
        }
        if (!ok) return false;
        PREFS = { email: document.getElementById('st-email').checked, alloc: document.getElementById('st-alloc').checked, msgs: document.getElementById('st-msgs').checked, remind: v('remind') };
        if (change && window.API && API.on()) {
          API.post('/me/password', { current: v('cur'), new: v('pw') }).then(function (r) { API.session(r.token); toast('Settings saved. Your password has been changed.', 'ok'); }).catch(API.fail);
          return;
        }
        toast('Settings saved.' + (change ? ' Your password has been changed.' : ''), 'ok');
      } }]);
  }
  document.addEventListener('click', function (e) {
    if (!ME) return;
    if (e.target.closest('#top-avatar')) { e.stopPropagation(); openProfile(); return; }
    var box = document.getElementById('profile-pop'); if (!box) return;
    var b = e.target.closest('[data-prof]');
    if (b) { closeProfile(); return b.dataset.prof === 'edit' ? editProfile() : b.dataset.prof === 'settings' ? settings() : logout(); }
    if (!box.contains(e.target)) closeProfile();
  }, true);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && document.getElementById('profile-pop')) { closeProfile(); document.getElementById('top-avatar').focus(); } });

  /* ---------- Meetings (all physical, in the DC labs) ---------- */
  var VENUES = ['Lab DC-001', 'Lab DC-002', 'Lab DC-003', 'Lab DC-004'];
  var toMin = function (hhmm) { var p = hhmm.split(':'); return +p[0] * 60 + +p[1]; };
  var hhmm = function (m) { return ('0' + Math.floor(m / 60)).slice(-2) + ':' + ('0' + m % 60).slice(-2); };
  var meetDate = function (iso) { return new Date(iso + 'T12:00').toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }); };
  var meetWhen = function (m) { return meetDate(m.date) + ' · ' + m.start + '–' + hhmm(toMin(m.start) + m.mins); };
  // A date n working days from today, as YYYY-MM-DD
  // Local calendar date as YYYY-MM-DD (not UTC, so it never slips a day)
  var isoDay = function (d) { d = d || new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); };
  var workday = function (n) { var d = new Date(); d.setHours(12, 0, 0, 0); while (n > 0) { d.setDate(d.getDate() + 1); if (d.getDay() % 6) n--; } return isoDay(d); };
  function meetingDetails(m) {
    var row = function (k, v) { return '<div class="flex gap-3 py-1.5"><dt class="w-24 shrink-0 text-slate-500">' + k + '</dt><dd class="min-w-0 font-medium text-slate-800">' + v + '</dd></div>'; };
    modal('Meeting — ' + esc(m.venue),
      '<h4 class="text-[16px] font-bold text-brand-950">' + esc(m.title) + '</h4>' + (m.challenge ? '<p class="text-[13px] text-slate-500">' + esc(m.challenge) + '</p>' : '') +
      '<dl class="mt-3 divide-y divide-slate-100 text-[13px]">' +
        row('When', esc(meetWhen(m))) +
        row('Venue', '<span class="rounded-md bg-brand-50 px-2 py-0.5 font-semibold text-brand-800 ring-1 ring-brand-200">' + esc(m.venue) + '</span> <span class="text-slate-500">· in person</span>') +
        row('Organiser', esc(m.organiser)) + row('Invited', esc(m.people.join(', '))) + (m.agenda ? row('Agenda', esc(m.agenda)) : '') +
      '</dl>', [{ label: 'Close' }]);
  }

  function toast(msg, kind) {
    var t = document.getElementById('toast');
    t.textContent = msg; t.className = t.className.replace(/bg-\S+/g, '') + ' ' + (kind === 'err' ? 'bg-red-700' : kind === 'ok' ? 'bg-green-700' : 'bg-brand-950');
    t.classList.remove('opacity-0', 'translate-y-2'); clearTimeout(toast.t);
    toast.t = setTimeout(function () { t.classList.add('opacity-0', 'translate-y-2'); }, 2800);
  }
  /* Modal: body HTML + actions [{label, primary, danger, onClick → return false to keep open}] */
  var opener = null;
  function modal(title, body, actions) {
    var root = document.getElementById('modal-root');
    if (!root.firstChild) opener = document.activeElement;   // focus returns here when the window closes
    root.innerHTML = '<div class="fixed inset-0 z-[70] flex items-center justify-center bg-brand-950/50 p-4" data-close><div role="dialog" aria-modal="true" aria-labelledby="mdl-title" class="flex max-h-[calc(100vh-24px)] w-full max-w-lg flex-col rounded-2xl bg-white shadow-2xl">' +
      '<div class="flex items-center justify-between border-b border-slate-200 px-5 py-3.5"><h3 id="mdl-title" class="text-base font-bold">' + esc(title) + '</h3><button class="cursor-pointer rounded-md p-1 text-slate-500 hover:bg-slate-100" data-close aria-label="Close">' + icon('x') + '</button></div>' +
      '<div class="min-h-0 overflow-y-auto px-5 py-4 text-sm">' + body + '</div>' +
      '<div class="flex justify-end gap-2 rounded-b-2xl border-t border-slate-200 bg-slate-50 px-5 py-3">' + actions.map(function (a, i) { return '<button data-i="' + i + '" class="btn py-2 ' + (a.primary ? 'btn-primary' : a.danger ? 'border-red-200 text-red-700 hover:bg-red-50' : '') + '">' + a.label + '</button>'; }).join('') + '</div></div></div>';
    root.onclick = function (e) {
      if (e.target.hasAttribute('data-close') || e.target.closest('button[data-close]')) return close();
      var b = e.target.closest('[data-i]'); if (!b) return;
      var a = actions[+b.dataset.i]; if (!a.onClick || a.onClick() !== false) close();
    };
    function close() { root.innerHTML = ''; restoreFocus(); }
    setTimeout(function () { var f = root.querySelector('input:not([type=hidden]):not([disabled]),textarea,select') || root.querySelector('[data-i]:last-child') || root.querySelector('button'); if (f) f.focus(); }, 30);
  }
  function restoreFocus() { setTimeout(function () { if (!document.getElementById('modal-root').firstChild && opener && document.contains(opener)) opener.focus(); }, 0); }
  document.addEventListener('keydown', function (e) {
    var root = document.getElementById('modal-root'); if (!root || !root.firstChild) return;
    if (e.key === 'Escape') { root.innerHTML = ''; restoreFocus(); return; }
    if (e.key === 'Tab') {   // keep keyboard focus inside the open window
      var f = [].filter.call(root.querySelectorAll('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])'), function (x) { return !x.disabled && x.offsetParent !== null; });
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  /* Keep lists inside their panels without scrolling: hide rows that don't fit and show "+ N more". */
  function fitLists() {
    document.querySelectorAll('.panel-b[data-fit]').forEach(function (box) {
      var rows = box.querySelectorAll(':scope > .row-item, :scope > [data-row]');
      rows.forEach(function (r) { r.hidden = false; });
      var more = box.querySelector(':scope > .more-row'); if (more) more.remove();
      var card0 = box.closest('.card2'), hm = card0 && card0.firstElementChild.querySelector(':scope > .more-row'); if (hm) hm.remove();
      var vh = card0 && card0.firstElementChild.querySelector(':scope > [data-more]'); if (vh) { vh.classList.remove('in-head'); box.appendChild(vh); }
      var vb = box.querySelector(':scope > [data-more]'); if (vb) { if (vb.dataset.extra == null) vb.dataset.extra = (vb.textContent.match(/\d+/) || [0])[0]; vb.textContent = 'View more (' + vb.dataset.extra + ')'; }
      if (box.scrollHeight <= box.clientHeight + 1) return;
      var hidden = 0, n = rows.length, vm = box.querySelector(':scope > [data-more]');
      if (vm) {
        while (n > 1 && box.scrollHeight > box.clientHeight + 1) { rows[--n].hidden = true; hidden++; }
        if (hidden) vm.textContent = 'View more (' + (hidden + (+vm.dataset.extra || 0)) + ')';
        if (box.scrollHeight > box.clientHeight + 1 && box.closest('.card2')) { vm.classList.add('in-head'); box.closest('.card2').firstElementChild.appendChild(vm); }
        return;
      }
      more = document.createElement('a'); more.href = '#'; more.className = 'more-row block py-1.5 text-xs font-semibold text-brand-700 hover:underline' + (box.closest('.card2') ? '' : ' px-4');
      more.addEventListener('click', function (e) { e.preventDefault(); toast('This opens the full list page — link it to your route.'); });
      box.appendChild(more);
      var over = function () { var b = box.getBoundingClientRect().bottom; return box.scrollHeight > box.clientHeight + 1 || [].some.call(box.children, function (x) { return !x.hidden && x.getBoundingClientRect().bottom > b + 0.5; }); };
      while (n > 1 && over()) { rows[--n].hidden = true; hidden++; more.textContent = '+ ' + hidden + ' more — view all'; }
      if (!hidden) { more.remove(); return; }
      // No room under the rows (small stacked cards): show the link in the card's title line instead
      var card = box.closest('.card2');
      if (card && over()) {
        more.className = 'more-row ml-auto shrink-0 pt-0.5 text-xs font-semibold whitespace-nowrap text-brand-700 hover:underline';
        more.textContent = '+ ' + hidden + ' more';
        card.firstElementChild.appendChild(more);
      }
    });
  }
  window.addEventListener('resize', function () { clearTimeout(fitLists.t); fitLists.t = setTimeout(fitLists, 80); });
  /* ---------- Dashboard layout pieces (shared by every role) ---------- */
  var PAL = { blue: '#2b4de0', light: '#8da2f5', teal: '#14a28c', purple: '#8b5cf6', amber: '#c2620a', track: '#eef1f6' };
  // Title bar: big title + period picker
  // Bottom action bar: actions, then the date range, then trailing buttons (e.g. Submit challenge)
  function head(welcome, title, period, actions, after) {
    var pt = document.getElementById('page-title'); if (pt) { pt.textContent = title; document.title = title + ' — Development Challenges Community'; }
    return '<div class="dash-title flex shrink-0 items-center justify-end gap-4">' +
      '<div class="flex shrink-0 items-center gap-3">' + (actions || '') + (period ? rangeHTML() : '') + (after || '') + '</div></div>';
  }
  // KPI cards: [[label, value, note, colour], …]
  // KPI cards (same look as the public dashboard): label + number on the left, tinted icon tile on the right.
  // k = [label, value, note (unused), colour, icon]
  var KICON = {
    layers: '<path d="m12 3 9 5-9 5-9-5 9-5z"/><path d="m3 13 9 5 9-5"/>',
    check: '<circle cx="12" cy="12" r="8.5"/><path d="m8.5 12.2 2.4 2.4 4.6-4.8"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    pending: '<circle cx="12" cy="12" r="8.5" stroke-dasharray="2.6 2.6"/>',
    people: '<circle cx="9" cy="8" r="3.2"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><path d="M16 5.2a3 3 0 0 1 0 5.6M18 14.2a5.5 5.5 0 0 1 2.5 4.8"/>',
    org: '<path d="M4 20V6l8-3 8 3v14"/><path d="M9 20v-5h6v5M8 9h.01M12 9h.01M16 9h.01M8 12h.01M16 12h.01"/>',
    user: '<circle cx="10" cy="8" r="3.6"/><path d="M3 20a7 7 0 0 1 12.5-4.3"/><path d="M19 14v6M16 17h6"/>',
    flag: '<path d="M5 21V4h11l-1.5 4L16 12H5"/>',
    inbox: '<path d="M4 13h4l1.5 3h5L16 13h4"/><path d="M5 5h14l1 8v6H4v-6z"/>'
  };
  function kpis(list) {
    return '<section aria-label="Summary" class="grid shrink-0 grid-cols-2 gap-4 lg:grid-cols-4">' + list.map(function (k) {
      return '<div class="kpi"><div class="min-w-0"><div class="k">' + esc(k[0]) + '</div><div class="kv"><span class="v">' + k[1] + '</span></div></div>' +
        '<span class="ki" style="background:' + k[3] + '17;color:' + k[3] + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (KICON[k[4]] || KICON.layers) + '</svg></span></div>';
    }).join('') + '</section>';
  }
  // Card: {id, title, sub, count, tone:'warn', countRight, right, body, cls}
  function card(o) {
    var chip = o.count == null ? '' : '<span class="cnt' + (o.tone === 'warn' ? ' warn' : '') + '">' + o.count + '</span>';
    return '<section class="card2 ' + (o.cls || '') + '" aria-labelledby="h-' + o.id + '"><div class="flex shrink-0 items-start justify-between gap-3"><div class="min-w-0"><div class="flex items-center gap-3"><h2 id="h-' + o.id + '">' + esc(o.title) + '</h2>' + (o.countRight ? '' : chip) + '</div>' +
      '</div>' + (o.countRight ? chip : '') + (o.right || '') + '</div>' + o.body + '</section>';
  }
  // Rail bars: [{label, value, color}] — width relative to the largest value
  function bars(items) {
    var max = Math.max.apply(null, items.map(function (i) { return i.value; }).concat([1]));
    return '<div class="bars" style="max-height:' + (items.length * 38) + 'px">' + items.map(function (i) {
      return '<div class="bar" data-tip="' + esc(i.label + ': ' + i.value) + '"><span class="l">' + esc(i.label) + '</span><span class="t"><b style="width:' + Math.max(4, i.value / max * 100) + '%;background:' + i.color + '"></b></span><b class="n">' + i.value + '</b></div>';
    }).join('') + '</div>';
  }
  // Segmented meters: [{name, value, max, label, warn, tip}] — one segment per unit (capacity) or per 10% (progress)
  function segs(items, note) {
    return '<div class="panel-b mt-2" data-fit>' + items.map(function (i) {
      var n = i.max, on = Math.round(i.value), cells = '';
      for (var k = 0; k < n; k++) cells += '<i style="background:' + (k < on ? (i.color || PAL.blue) : PAL.track) + '"></i>';
      return '<div class="seg" data-row title="' + esc(i.tip || '') + '"><div class="flex items-baseline justify-between gap-3"><span class="truncate">' + esc(i.name) + '</span><span class="v' + (i.warn ? ' warn' : '') + '">' + esc(i.label) + '</span></div><div class="cells">' + cells + '</div></div>';
    }).join('') + '</div>' + (note ? '<p class="note">' + note + '</p>' : '');
  }
  // Table: cols [[label, width]], rows [[cell html, …]]
  function table(cols, rows, empty, foot) {
    var tpl = cols.map(function (c) { return c[1]; }).join(' ');
    return '<div class="thead" style="grid-template-columns:' + tpl + '">' + cols.map(function (c) { return '<span>' + c[0] + '</span>'; }).join('') + '</div>' +
      '<div class="panel-b" data-fit>' + (rows.map(function (r) { return '<div class="trow" data-row style="grid-template-columns:' + tpl + '">' + r.map(function (x) { return '<div class="min-w-0">' + x + '</div>'; }).join('') + '</div>'; }).join('') ||
      '<p class="py-6 text-center text-sm text-slate-500">' + (empty || 'Nothing here.') + '</p>') + (foot || '') + '</div>';
  }
  // Simple list inside a card: rows of html
  function list(rows, empty, foot) {
    return '<div class="panel-b mt-2" data-fit>' + (rows.map(function (r) { return '<div class="lrow" data-row>' + r + '</div>'; }).join('') || '<p class="py-5 text-center text-sm text-slate-500">' + (empty || 'Nothing here.') + '</p>') + (foot || '') + '</div>';
  }
  // Show the first SHOW items; the rest open with a "View more" button
  var SHOW = 3;
  var viewMore = function (key, total) { return total > SHOW ? '<button data-more="' + key + '" class="view-more">View more (' + (total - SHOW) + ')</button>' : ''; };
  var cell = function (title, meta, tone) { return '<div class="truncate font-medium text-slate-900">' + esc(title) + '</div><div class="truncate text-[12px] ' + (tone === 'warn' ? 'text-amber-700' : 'text-slate-500') + '">' + meta + '</div>'; };
  var pieBox = function (id, label) { return '<div class="mt-2 min-h-0 flex-1"><div id="' + id + '" class="h-full" aria-label="' + esc(label) + '"></div></div>'; };
  // Monthly series → sum of the last n months
  var lastN = function (arr, n) { return arr.slice(-n).reduce(function (a, b) { return a + b; }, 0); };


  /* ---------- Date-range calendar (shared by the public and role dashboards) ----------
     rangeInit({ kinds:[{key,label,color}], events:fn→[{date,kind,title}], preset:'6m'|'year'|…, onChange })
     Days view marks every day that has events (one dot per kind); hover or click a day to see what happened.
     Pick a start then an end day (or month in Months view); ranges can cross months and years. */
  var MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var RG = { range: { from: null, to: null }, o: null, open: false, view: 'days', cur: null, pick: null, info: null };
  var TODAY0 = function () { var t = new Date(); t.setHours(0, 0, 0, 0); return t; };
  var sameDay = function (a, b) { return a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); };
  var dshort = function (dt, yr) { return dt.getDate() + ' ' + MON[dt.getMonth()].slice(0, 3) + (yr ? ' ' + dt.getFullYear() : ''); };
  function rangeLabel(r) {
    r = r || RG.range;
    if (!r.from) return 'All time';
    if (sameDay(r.from, r.to)) return dshort(r.from, true);
    return dshort(r.from, r.from.getFullYear() !== r.to.getFullYear()) + ' – ' + dshort(r.to, true);
  }
  function presetRange(k) {
    var T = TODAY0(), Y = T.getFullYear(), h2 = T.getMonth() >= 6;
    if (k === 'year') return { from: new Date(Y, 0, 1), to: T };
    if (k === 'sem') return { from: new Date(Y, h2 ? 6 : 0, 1), to: T };
    if (k === 'last') return h2 ? { from: new Date(Y, 0, 1), to: new Date(Y, 5, 30) } : { from: new Date(Y - 1, 6, 1), to: new Date(Y - 1, 11, 31) };
    if (k === '6m') return { from: new Date(Y, T.getMonth() - 5, 1), to: T };
    return { from: null, to: null };
  }
  var inRange = function (dt, r) { r = r || RG.range; var e = r.to && new Date(r.to.getFullYear(), r.to.getMonth(), r.to.getDate(), 23, 59, 59); return !r.from || (dt >= r.from && dt <= e); };
  // Spread monthly counts (oldest → newest, ending this month) into dated sample events
  function monthlyEvents(arr, kind, titles) {
    var T = TODAY0(), out = [], t = 0;
    arr.forEach(function (n, i) {
      var y = T.getFullYear(), m = T.getMonth() - (arr.length - 1 - i), last = new Date(y, m + 1, 0).getDate();
      if (m === T.getMonth() + 0 && y === T.getFullYear() && i === arr.length - 1) last = T.getDate();
      for (var k = 0; k < n; k++) out.push({ date: new Date(y, m, 1 + ((i * 7 + k * 11 + 3) % last)), kind: kind, title: titles[(t++) % titles.length] });
    });
    return out;
  }
  function rangeHTML() {
    return '<div id="range-wrap" class="relative shrink-0"><button id="range-btn" type="button" aria-haspopup="dialog" aria-expanded="false" aria-controls="cal" class="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13.5px] font-medium text-slate-800 shadow-xs hover:bg-slate-50 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15 focus:outline-none dark:border-[#24314f] dark:bg-[#16213a] dark:text-slate-100 dark:hover:bg-[#1a2540]">' +
      '<svg class="size-4 text-slate-600 dark:text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 10h16"/></svg>' +
      '<span class="sr-only">Date range:</span><span id="range-label" class="whitespace-nowrap tabular-nums">' + rangeLabel() + '</span>' +
      '<svg class="size-4 text-slate-600 dark:text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button>' +
      '<div id="cal" role="dialog" aria-label="Choose a date range" hidden class="absolute top-full right-0 z-50 mt-2 w-[300px] max-w-[92vw] overflow-y-auto rounded-xl border border-slate-200 bg-white p-3 text-left shadow-xl sm:w-[452px] dark:border-[#24314f] dark:bg-[#111a2e]"></div></div>';
  }
  function calDraw() {
    var el = document.getElementById('cal'); if (!el) return;
    var o = RG.o, kinds = o.kinds, ev = o.events(), cur = RG.cur, pick = RG.pick, y = cur.getFullYear(), T = TODAY0();
    var kindOf = function (k) { return kinds.filter(function (x) { return x.key === k; })[0]; };
    var BTN = 'cursor-pointer rounded-md text-[12.5px] font-medium focus-visible:outline-2 focus-visible:outline-brand-500 ';
    var dayEv = function (dt) { return ev.filter(function (e) { return sameDay(e.date, dt); }); };
    var describe = function (list, sep) { // grouped by kind, duplicate titles collapsed
      return kinds.map(function (k) {
        var t = {}; list.filter(function (e) { return e.kind === k.key; }).forEach(function (e) { t[e.title] = (t[e.title] || 0) + 1; });
        var keys = Object.keys(t); if (!keys.length) return '';
        return '<b>' + esc(k.label) + '</b>' + sep + keys.map(function (n) { return '• ' + esc(n) + (t[n] > 1 ? ' ×' + t[n] : ''); }).join(sep);
      }).filter(Boolean).join(sep);
    };
    var mid = function (s, e) { return pick.from && pick.to && s >= pick.from && e <= pick.to; };
    var body = '';
    if (RG.view === 'days') {
      var m = cur.getMonth(), lead = (new Date(y, m, 1).getDay() + 6) % 7, n = new Date(y, m + 1, 0).getDate();
      ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].forEach(function (w) { body += '<span class="py-1 text-center text-[11px] font-semibold text-slate-400">' + w + '</span>'; });
      for (var i = 0; i < lead; i++) body += '<span></span>';
      for (var dd = 1; dd <= n; dd++) {
        var dt = new Date(y, m, dd), es = dayEv(dt), end = sameDay(dt, pick.from) || sameDay(dt, pick.to), md = !end && mid(dt, dt), fut = dt > T;
        var tip = es.length ? '<b>' + dshort(dt, true) + '</b><br>' + describe(es, '<br>') : '';
        var dots = kinds.filter(function (k) { return es.some(function (e) { return e.kind === k.key; }); });
        body += '<button type="button" data-cal-day="' + y + '-' + m + '-' + dd + '"' + (tip ? ' data-tip="' + tip.replace(/"/g, '&quot;') + '"' : '') +
          ' aria-label="' + dshort(dt, true) + (es.length ? ', ' + es.length + ' event' + (es.length > 1 ? 's' : '') : '') + '" aria-pressed="' + (end || md) + '"' +
          ' class="' + BTN + 'relative flex h-[30px] items-center justify-center tabular-nums ' +
          (end ? 'bg-brand-700 text-white' : md ? 'rounded-none bg-brand-100 text-brand-900 dark:bg-brand-900/50 dark:text-brand-100' : fut ? 'text-slate-300 hover:bg-slate-100 dark:text-slate-600 dark:hover:bg-[#1a2540]' : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-[#1a2540]') +
          (sameDay(dt, T) && !end ? ' ring-1 ring-brand-400 ring-inset' : '') + '">' + dd +
          (dots.length ? '<i class="absolute bottom-0.5 flex gap-[2px]">' + dots.map(function (k) { return '<b class="size-1.5 rounded-full ring-1 ring-white dark:ring-[#111a2e]" style="background:' + (end ? '#fff' : k.color) + '"></b>'; }).join('') + '</i>' : '') + '</button>';
      }
      body = '<div class="grid grid-cols-7 gap-y-0.5">' + body + '</div>';
    } else {
      for (var mm = 0; mm < 12; mm++) {
        var s = new Date(y, mm, 1), e = new Date(y, mm + 1, 0), me = ev.filter(function (x) { return x.date.getFullYear() === y && x.date.getMonth() === mm; });
        var isEnd = (pick.from && pick.from.getFullYear() === y && pick.from.getMonth() === mm) || (pick.to && pick.to.getFullYear() === y && pick.to.getMonth() === mm);
        var counts = kinds.map(function (k) { return [k, me.filter(function (x) { return x.kind === k.key; }).length]; }).filter(function (c) { return c[1]; });
        var sub = !counts.length ? '—' : kinds.length === 1 ? counts[0][1] + ' ' + kinds[0].label.toLowerCase() : counts.map(function (c) { return '<span class="inline-flex items-center gap-0.5"><i class="size-1.5 rounded-full" style="background:' + (isEnd ? '#fff' : c[0].color) + '"></i>' + c[1] + '</span>'; }).join(' ');
        body += '<button type="button" data-cal-month="' + mm + '" aria-pressed="' + (isEnd || mid(s, e)) + '" aria-label="' + MON[mm] + ' ' + y + ', ' + me.length + ' event' + (me.length === 1 ? '' : 's') + '" class="' + BTN + 'flex h-12 flex-col items-center justify-center ' +
          (isEnd ? 'bg-brand-700 text-white' : mid(s, e) ? 'bg-brand-100 text-brand-900 dark:bg-brand-900/50 dark:text-brand-100' : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-[#1a2540]') + '">' + MON[mm].slice(0, 3) +
          '<span class="flex gap-1.5 text-[10.5px] font-normal ' + (isEnd ? 'text-blue-100' : counts.length ? 'text-slate-600 dark:text-slate-300' : 'text-slate-400') + '">' + sub + '</span></button>';
      }
      body = '<div class="grid grid-cols-3 gap-1">' + body + '</div>';
    }
    var chev = function (d) { return '<svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="' + (d < 0 ? 'm15 6-6 6 6 6' : 'm9 6 6 6-6 6') + '"/></svg>'; };
    var tab = function (v, t) { return '<button type="button" data-cal-view="' + v + '" aria-pressed="' + (RG.view === v) + '" class="' + BTN + 'flex-1 py-1 ' + (RG.view === v ? 'bg-white text-slate-900 shadow-xs dark:bg-[#24314f] dark:text-white' : 'text-slate-500 dark:text-slate-400') + '">' + t + '</button>'; };
    var preset = function (k, t) { return '<button type="button" data-cal-preset="' + k + '" class="' + BTN + 'rounded-full border border-slate-200 px-2.5 py-1 text-left text-slate-600 hover:bg-slate-100 sm:rounded-md sm:border-0 sm:px-2.5 sm:py-1.5 dark:border-[#2a3858] dark:text-slate-300 dark:hover:bg-[#1a2540]">' + t + '</button>'; };
    var unit = RG.view === 'days' ? 'day' : 'month';
    var hint = !pick.from ? 'Pick a start ' + unit : !pick.to ? 'Now pick an end ' + unit : rangeLabel(pick);
    var nav = 'class="' + BTN + 'p-1.5 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-[#1a2540]"';
    var presets = (o.presets || [['year', 'This year'], ['sem', 'This semester'], ['last', 'Last semester'], ['all', 'All time']]).map(function (p) { return preset(p[0], p[1]); }).join('');
    el.innerHTML =
      '<div class="flex flex-col-reverse gap-3 sm:flex-row">' +
        '<div class="flex flex-wrap gap-1.5 sm:w-[124px] sm:shrink-0 sm:flex-col sm:flex-nowrap sm:gap-0.5 sm:border-r sm:border-slate-200 sm:pr-2 dark:sm:border-[#1f2a44]"><span class="hidden px-2.5 pb-1 text-[11px] font-semibold tracking-wide text-slate-400 uppercase sm:block">Quick ranges</span>' + presets + '</div>' +
        '<div class="min-w-0 flex-1">' +
          '<div class="flex rounded-lg bg-slate-100 p-0.5 dark:bg-[#0f1729]">' + tab('days', 'Days') + tab('months', 'Months') + '</div>' +
          '<div class="mt-2 flex items-center justify-between"><button type="button" data-cal-nav="-1" aria-label="Previous" ' + nav + '>' + chev(-1) + '</button>' +
            '<span class="text-[14px] font-bold text-slate-900 dark:text-white" aria-live="polite">' + (RG.view === 'days' ? MON[cur.getMonth()] + ' ' : '') + y + '</span>' +
            '<button type="button" data-cal-nav="1" aria-label="Next" ' + nav + '>' + chev(1) + '</button></div>' +
          '<div class="mt-1">' + body + '</div>' +
          '<div class="mt-1.5 flex flex-wrap gap-x-3 text-[11px] text-slate-500 dark:text-slate-400">' + kinds.map(function (k) { return '<span class="inline-flex items-center gap-1"><i class="size-1.5 rounded-full" style="background:' + k.color + '"></i>' + esc(k.label) + '</span>'; }).join('') + '</div>' +
          (RG.info ? '<div class="mt-1.5 max-h-16 overflow-y-auto rounded-lg bg-slate-50 px-2.5 py-1.5 text-[11.5px] leading-snug text-slate-700 dark:bg-[#16213a] dark:text-slate-200"><b>' + dshort(RG.info, true) + '</b><br>' + describe(dayEv(RG.info), ' ') + '</div>' : '') +
        '</div></div>' +
      '<div class="mt-2.5 flex items-center justify-between gap-2 border-t border-slate-200 pt-2.5 dark:border-[#1f2a44]">' +
        '<span class="text-[12.5px] text-slate-600 dark:text-slate-300">' + hint + '</span>' +
        '<span class="flex gap-1.5"><button type="button" data-cal-act="clear" class="btn btn-sm dark:border-[#2a3858] dark:bg-[#16213a] dark:text-slate-100">Clear</button>' +
        '<button type="button" data-cal-act="apply" class="btn btn-sm btn-primary disabled:cursor-not-allowed disabled:opacity-50"' + (pick.from ? '' : ' disabled') + '>Apply</button></span></div>';
    // Open upwards when the button is in the lower half of the screen (e.g. the bottom action bar)
    var btn = document.getElementById('range-btn').getBoundingClientRect(), up = btn.top > innerHeight / 2;
    el.style.top = up ? 'auto' : ''; el.style.bottom = up ? '100%' : ''; el.style.marginTop = up ? '0' : ''; el.style.marginBottom = up ? '8px' : '';
    el.style.maxHeight = Math.max(240, up ? btn.top - 16 : innerHeight - btn.bottom - 16) + 'px';
  }
  function calClose() { RG.open = false; var c = document.getElementById('cal'), b = document.getElementById('range-btn'); if (c) c.hidden = true; if (b) b.setAttribute('aria-expanded', 'false'); }
  function calShow() {
    var r = RG.range, base = r.to || TODAY0();
    RG.open = true; RG.pick = { from: r.from, to: r.to }; RG.cur = new Date(base.getFullYear(), base.getMonth(), 1); RG.info = null;
    document.getElementById('cal').hidden = false; document.getElementById('range-btn').setAttribute('aria-expanded', 'true'); calDraw();
  }
  function calApply(r) {
    RG.range = { from: r.from, to: r.to || r.from }; calClose();
    var l = document.getElementById('range-label'); if (l) l.textContent = rangeLabel();
    if (RG.o.onChange) RG.o.onChange(RG.range);
  }
  function rangeInit(o) {
    RG.o = o; RG.range = presetRange(o.preset || 'year');
    var l = document.getElementById('range-label'); if (l) l.textContent = rangeLabel();
    document.addEventListener('click', function (e) {
      if (e.target.closest('#range-btn')) { RG.open ? calClose() : calShow(); return; }
      var cal = e.target.closest('#cal');
      if (!cal) { if (RG.open && !e.target.closest('#range-wrap')) calClose(); return; }
      var b = e.target.closest('button'); if (!b) return;
      e.stopPropagation();
      var p = RG.pick, d = b.dataset;
      var choose = function (s, en) { if (!p.from || p.to) RG.pick = { from: s, to: null, _e: en }; else if (s < p.from) RG.pick = { from: s, to: p._e || p.from }; else RG.pick = { from: p.from, to: en }; };
      if (d.calView) { RG.view = d.calView; RG.pick = { from: null, to: null }; RG.info = null; }
      else if (d.calNav) { var n = +d.calNav; RG.cur = RG.view === 'days' ? new Date(RG.cur.getFullYear(), RG.cur.getMonth() + n, 1) : new Date(RG.cur.getFullYear() + n, RG.cur.getMonth(), 1); }
      else if (d.calDay) { var q = d.calDay.split('-'), dt = new Date(+q[0], +q[1], +q[2]); choose(dt, dt); RG.info = RG.o.events().some(function (x) { return sameDay(x.date, dt); }) ? dt : null; }
      else if (d.calMonth) { var mm = +d.calMonth, yy = RG.cur.getFullYear(); choose(new Date(yy, mm, 1), new Date(yy, mm + 1, 0)); RG.info = null; }
      else if (d.calPreset) return calApply(presetRange(d.calPreset));
      else if (d.calAct === 'clear') { RG.pick = { from: null, to: null }; RG.info = null; }
      else if (d.calAct === 'apply') { if (RG.pick.from) calApply({ from: RG.pick.from, to: RG.pick.to || RG.pick._e || RG.pick.from }); return; }
      calDraw();
      var k = Object.keys(d).filter(function (x) { return x.indexOf('cal') === 0; })[0], again = k && document.querySelector('#cal [data-' + k.replace(/[A-Z]/g, function (c) { return '-' + c.toLowerCase(); }) + '="' + d[k] + '"]'); if (again) again.focus({ preventScroll: true });
    });
    document.addEventListener('keydown', function (e) { if (RG.open && e.key === 'Escape') { calClose(); var b = document.getElementById('range-btn'); if (b) b.focus(); } });
  }
  // Funding chosen by the representative when submitting: true = organisation will fund, false = no funding
  function funding(f) {
    if (f === true) return '<span class="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[12px] font-semibold text-green-800 ring-1 ring-green-200">Funded by organisation</span>';
    if (f === false) return '<span class="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[12px] font-semibold text-slate-700 ring-1 ring-slate-200">No funding</span>';
    if (f === 'none') return '<span class="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[12px] font-semibold text-slate-700 ring-1 ring-slate-200">Funding not required</span>';
    return '<span class="text-slate-400">Not stated</span>';
  }
  window.UI = { serverNotes: serverNotes, funding: funding, rangeHTML: rangeHTML, rangeInit: rangeInit, rangeLabel: rangeLabel, inRange: inRange, monthlyEvents: monthlyEvents, isoDay: isoDay, VENUES: VENUES, toMin: toMin, hhmm: hhmm, meetWhen: meetWhen, workday: workday, meetingDetails: meetingDetails, SHOW: SHOW, viewMore: viewMore, head: head, kpis: kpis, card: card, bars: bars, segs: segs, table: table, list: list, cell: cell, pieBox: pieBox, lastN: lastN, PAL: PAL, notes: notes, icon: icon, esc: esc, fmt: fmt, dayChip: dayChip, daysLeft: daysLeft, badge: badge, shell: shell, toast: toast, modal: modal, DAY: DAY, fitLists: fitLists };
})();
