/* API client for the Flask backend (JSON over HTTP, Bearer token).
   API.on() is false in demo mode (js/config.js → demo: true): pages then use their sample data. */
(function () {
  'use strict';
  var C = window.DCC_CONFIG || {}, base = String(C.apiBase || '').replace(/\/$/, '');
  var HOME = { student: 'student.html', supervisor: 'supervisor.html', representative: 'representative.html', admin: 'admin.html' };
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) {} }
  };
  var on = function () { return !C.demo && !!base; };
  var token = function () { return store.get('dcc-token'); };
  var user = function () { try { return JSON.parse(store.get('dcc-user') || 'null'); } catch (e) { return null; } };
  function session(t, u) { store.set('dcc-token', t); if (u) store.set('dcc-user', JSON.stringify(u)); }
  function clear() { store.del('dcc-token'); store.del('dcc-user'); }

  function request(method, path, body) {
    var opts = { method: method, headers: {} }, t = token();
    if (t) opts.headers.Authorization = 'Bearer ' + t;
    if (body instanceof FormData) opts.body = body;
    else if (body !== undefined) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    return fetch(base + path, opts).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) {
          var e = new Error(j.error || 'Request failed (' + r.status + ').'); e.status = r.status; e.fields = j.fields || {};
          if (r.status === 401 && path.indexOf('/auth/') !== 0) { clear(); location.href = 'login.html'; }
          throw e;
        }
        return j;
      });
    }, function () { var e = new Error('Cannot reach the server. Check that the backend is running.'); e.status = 0; e.fields = {}; throw e; });
  }

  // Dates: "YYYY-MM-DD" (deadlines → 17:00 local) or "YYYY-MM-DD HH:MM:SS" (UTC timestamps)
  function date(s) {
    if (!s || s instanceof Date) return s;
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(s + 'T17:00');
    return new Date(String(s).replace(' ', 'T') + (/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? '' : 'Z'));
  }
  function dates(list, fields) { (list || []).forEach(function (o) { fields.forEach(function (f) { if (o[f]) o[f] = date(o[f]); }); }); return list; }

  // Dashboard pages: make sure the right member is signed in, then load the page data
  function boot(role) {
    if (!on()) return Promise.resolve(null);
    var u = user();
    if (!token() || !u) { location.href = 'login.html'; return new Promise(function () {}); }
    if (u.role !== role) { location.href = HOME[u.role] || 'login.html'; return new Promise(function () {}); }
    return request('GET', '/dashboard/' + role).then(function (d) {
      if (d.events) dates(d.events, ['date']);
      if (d.me) session(token(), d.me);
      return d;
    });
  }
  function fail(e) { if (window.UI) UI.toast(e.message || 'Something went wrong.', 'err'); else alert(e.message); }
  // Show field errors from the server inside an open form: fields {name: message} → #<prefix><name>-err
  function fieldErrors(e, map) {
    Object.keys(e.fields || {}).forEach(function (k) { var id = (map && map[k]) || k, el = document.getElementById(id + '-err'); if (el) el.textContent = e.fields[k]; });
  }
  function logout() { clear(); location.href = 'login.html'; }

  window.API = {
    on: on, base: base, HOME: HOME, token: token, user: user, session: session, clear: clear, logout: logout,
    get: function (p) { return request('GET', p); }, post: function (p, b) { return request('POST', p, b === undefined ? {} : b); },
    put: function (p, b) { return request('PUT', p, b); }, del: function (p) { return request('DELETE', p); },
    date: date, dates: dates, boot: boot, fail: fail, fieldErrors: fieldErrors
  };
})();
