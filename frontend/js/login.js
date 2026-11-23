/* Login page — client-side checks only; your server authenticates.
   Add data-submit="server" to a <form> to post it to your backend. */
(function () {
  'use strict';
  var EYE = '<svg class="size-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
  var EYE_OFF = '<svg class="size-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19M1 1l22 22"/></svg>';
  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  var MEMBER_ID = /^DCC\d{5}$/i;
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
        API.session(r.token, r.user); window.location.href = r.home;
      }).catch(function (err) { btn.disabled = false; alertMsg(err.message); });
      return;
    }
    // Demo mode (js/config.js → demo: true): open the workspace as the member's role.
    var ROLE = { DCC00001: 'admin', DCC00002: 'student', DCC00003: 'representative', DCC00011: 'supervisor' };
    try { localStorage.setItem('dcc-demo-role', ROLE[id.toUpperCase()] || 'student'); } catch (e) {}
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
