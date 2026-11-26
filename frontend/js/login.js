/* Login page — client-side checks only; your server authenticates.
   Add data-submit="server" to a <form> to post it to your backend. */
(function () {
  'use strict';
  var EYE = '<svg class="size-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
  var EYE_OFF = '<svg class="size-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19M1 1l22 22"/></svg>';
  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  var MEMBER_ID = /^DCC\d{5}$/i;
  // Demo mode only: the seeded accounts and the role saved on each one. Live mode reads the role from /api/auth/login.
  var DEMO = {
    DCC00001: 'supervisor', DCC00002: 'student', DCC00003: 'representative', DCC00004: 'student',
    DCC00005: 'student', DCC00006: 'student', DCC00007: 'student', DCC00008: 'representative',
    DCC00009: 'representative', DCC00010: 'representative', DCC00011: 'supervisor', DCC00012: 'supervisor',
    DCC00013: 'supervisor', DCC00014: 'supervisor', DCC00015: 'supervisor', DCC00016: 'supervisor'
  };
  var DEMO_EMAILS = {
    'admin@devchallenges.community': 'supervisor', 'amahle.mthembu@unizulu.ac.za': 'student', 'sbongokuhle@betmedia.co.za': 'representative',
    'lwazi.dube@unizulu.ac.za': 'student', 'thando.khumalo@unizulu.ac.za': 'student', 'ayanda.zulu@mut.ac.za': 'student',
    'nosipho.cele@unizulu.ac.za': 'student', 'sizwe@umhlathuze.gov.za': 'representative', 'palesa@rbct.org.za': 'representative',
    'kagiso@unizulu.ac.za': 'representative', 's.ndlovu@unizulu.ac.za': 'supervisor', 'a.pillay@unizulu.ac.za': 'supervisor',
    'l.mabaso@unizulu.ac.za': 'supervisor', 't.shezi@mut.ac.za': 'supervisor', 'k.naidoo@unizulu.ac.za': 'supervisor', 'bongani@betmedia.co.za': 'supervisor'
  };
  var $ = function (id) { return document.getElementById(id); };

  function setErr(id, msg) {
    var el = $(id);
    el.classList.toggle('invalid', !!msg); el.setAttribute('aria-invalid', msg ? 'true' : 'false'); el.setAttribute('aria-describedby', id + '-err');
    $(id + '-err').textContent = msg || '';
    return !msg;
  }
  function alertMsg(msg) { var a = $('login-alert'); a.textContent = msg; a.hidden = !msg; if (msg) setTimeout(function () { a.hidden = true; }, 5000); }

  // Show / hide password
  var tg = $('toggle-pw'); tg.innerHTML = EYE;
  tg.addEventListener('click', function () {
    var i = $('password'), show = i.type === 'password';
    i.type = show ? 'text' : 'password'; tg.innerHTML = show ? EYE_OFF : EYE;
    tg.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
  });
  // Coming from registration: login.html?member=DCC00023 fills in the new Member ID
  try {
    var fromReg = new URLSearchParams(location.search).get('member');
    if (fromReg && MEMBER_ID.test(fromReg)) { $('member-id').value = fromReg.toUpperCase(); setTimeout(function () { $('password').focus(); }, 0); }
  } catch (e) {}
  ['member-id', 'password', 'reset-email'].forEach(function (id) { $(id).addEventListener('input', function () { setErr(id, ''); }); });

  // Login
  $('login-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var id = $('member-id').value.trim(), ok = true;
    ok &= setErr('member-id', !id ? 'Enter your Member ID or email.' : (!MEMBER_ID.test(id) && !EMAIL.test(id)) ? 'Use a Member ID (e.g. DCC00002) or a valid email.' : '');
    ok &= setErr('password', !$('password').value ? 'Enter your password.' : '');
    if (!ok) { alertMsg('Please check the highlighted fields.'); var f = this.querySelector('.invalid'); if (f) f.focus(); return; }
    if (window.API && API.on()) {
      var btn = this.querySelector('[type=submit]'); btn.disabled = true;
      API.post('/auth/login', { member_id: id, password: $('password').value }).then(function (r) {
        API.session(r.token, r.user); window.location.href = r.home || 'workspace.html';
      }).catch(function (err) { btn.disabled = false; alertMsg(err.message); });
      return;
    }
    // Demo mode: check the seeded credentials, then save the role that came with that account.
    var key = id.toUpperCase(), role = DEMO[key] || DEMO_EMAILS[id.toLowerCase()];
    if (!role || $('password').value !== 'Demo@1234') {
      alertMsg('The Member ID or password is incorrect.'); return;
    }
    try {
      localStorage.setItem('dcc-demo-role', role);
      localStorage.removeItem('dcc-demo-token');
    } catch (e) {}
    window.location.href = 'workspace.html';
  });

  // Forgotten password
  function view(reset) { $('login-view').hidden = reset; $('reset-view').hidden = !reset; $(reset ? 'reset-email' : 'member-id').focus(); }
  $('show-reset').addEventListener('click', function () { $('reset-ok').hidden = true; view(true); });
  $('back-login').addEventListener('click', function () { view(false); });
  $('reset-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var v = $('reset-email').value.trim();
    if (!setErr('reset-email', !EMAIL.test(v) ? 'Enter a valid email address.' : '')) return $('reset-email').focus();
    if (window.API && API.on()) {
      API.post('/auth/forgot-password', { email: v }).then(function (r) { $('reset-ok').textContent = r.message; $('reset-ok').hidden = false; }).catch(function (err) { alertMsg(err.message); });
      return;
    }
    $('reset-ok').textContent = 'If an account exists for ' + v + ', a reset link has been sent. It expires in 30 minutes.';
    $('reset-ok').hidden = false;
  });
})();
