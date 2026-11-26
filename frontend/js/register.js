/* Registration page — client-side validation (the server must validate again).
   Add data-submit="server" to the <form> to post to your backend. */
(function () {
  'use strict';
  var EYE = '<svg class="size-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
  var EYE_OFF = '<svg class="size-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19M1 1l22 22"/></svg>';
  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  var RULES = [
    ['8+ characters', function (p) { return p.length >= 8; }],
    ['uppercase', function (p) { return /[A-Z]/.test(p); }],
    ['lowercase', function (p) { return /[a-z]/.test(p); }],
    ['number', function (p) { return /\d/.test(p); }],
    ['symbol', function (p) { return /[^A-Za-z0-9]/.test(p); }]
  ];
  var $ = function (id) { return document.getElementById(id); };
  var val = function (id) { return $(id).value.trim(); };
  var form = $('reg-form');

  function phoneDetails() {
    var country = $('phone-country').value || 'ZA';
    var raw = val('phone').replace(/[\s()-]/g, '');
    var lib = window.DCCPhone;
    if (!lib || typeof lib.parsePhoneNumberFromString !== 'function') {
      var za = /^(\+?27|0)([6-8]\d{8})$/.exec(raw);
      return {
        country: country,
        number: country === 'ZA' && za ? '+27' + za[2] : raw,
        valid: country === 'ZA' && !!za
      };
    }
    var parsed = lib.parsePhoneNumberFromString(raw, country);
    return {
      country: country,
      number: parsed && parsed.number ? parsed.number : raw,
      valid: !!(parsed && typeof parsed.isValid === 'function' && parsed.isValid())
    };
  }
  var countries = [], visibleCountries = 60;

  function flagSlot(code) {
    var slot = document.createElement('span');
    slot.className = 'phone-flag';
    var img = document.createElement('img');
    img.alt = '';
    img.decoding = 'async';
    img.src = 'images/flags/' + code.toLowerCase() + '.svg';
    img.onerror = function () { slot.textContent = code.toUpperCase(); };
    slot.appendChild(img);
    return slot;
  }
  function updateCountryButton(code) {
    var item = countries.filter(function (c) { return c.code === code; })[0] || countries[0];
    if (!item) return;
    $('phone-country').value = item.code;
    var value = $('phone-country-value'), label = document.createElement('span');
    value.textContent = '';
    value.appendChild(flagSlot(item.code));
    label.className = 'phone-country-code';
    label.textContent = item.dial;
    value.appendChild(label);
    $('phone-country-button').setAttribute('aria-label', 'Country code: ' + item.name + ', ' + item.dial);
    Array.prototype.forEach.call($('phone-country-options').querySelectorAll('.phone-country-option'), function (option) {
      option.setAttribute('aria-selected', option.dataset.country === item.code ? 'true' : 'false');
    });
  }
  function renderCountryOptions(query) {
    var list = $('phone-country-options'), selected = $('phone-country').value;
    var q = (query || '').trim().toLowerCase();
    list.textContent = '';
    var matches = countries.filter(function (c) { return !q || c.search.indexOf(q) >= 0; });
    visibleCountries = 60;
    if (!matches.length) {
      var empty = document.createElement('div');
      empty.className = 'phone-country-empty';
      empty.textContent = 'No countries found';
      list.appendChild(empty);
      return [];
    }
    matches.slice(0, visibleCountries).forEach(function (c) {
      var option = document.createElement('button');
      var text = document.createElement('span');
      option.type = 'button';
      option.className = 'phone-country-option';
      option.dataset.country = c.code;
      option.setAttribute('role', 'option');
      option.setAttribute('aria-selected', c.code === selected ? 'true' : 'false');
      option.appendChild(flagSlot(c.code));
      text.textContent = c.name + ' (' + c.dial + ')';
      option.appendChild(text);
      list.appendChild(option);
    });
    if (matches.length > visibleCountries) {
      var more = document.createElement('button');
      more.type = 'button';
      more.className = 'phone-country-more';
      more.textContent = 'Show ' + Math.min(60, matches.length - visibleCountries) + ' more';
      list.appendChild(more);
    }
    return matches;
  }
  function focusCountryOption(index) {
    var options = Array.prototype.slice.call($('phone-country-options').querySelectorAll('.phone-country-option'));
    if (!options.length) return;
    options[(index + options.length) % options.length].focus();
  }
  function closeCountryMenu(focusButton) {
    $('phone-country-menu').hidden = true;
    $('phone-country-button').setAttribute('aria-expanded', 'false');
    if (focusButton) $('phone-country-button').focus();
  }
  function openCountryMenu() {
    var menu = $('phone-country-menu');
    if (!menu.hidden) return;
    menu.hidden = false;
    $('phone-country-button').setAttribute('aria-expanded', 'true');
    $('phone-country-search').value = '';
    renderCountryOptions('');
    $('phone-country-search').focus();
  }
  function chooseCountry(code, focusButton) {
    updateCountryButton(code);
    closeCountryMenu(focusButton);
    setErr('phone', '');
  }
  function fillCountries() {
    var lib = window.DCCPhone;
    var names;
    try { names = new Intl.DisplayNames(['en'], { type: 'region' }); } catch (e) { names = null; }
    if (lib && typeof lib.getCountries === 'function' && typeof lib.getCountryCallingCode === 'function') {
      countries = lib.getCountries().map(function (code) {
        var name = code, dial = '+' + lib.getCountryCallingCode(code);
        try { name = names && names.of(code) ? names.of(code) : code; } catch (e) { name = code; }
        return { code: code, name: name, dial: dial, search: (name + ' ' + code + ' ' + dial).toLowerCase() };
      }).sort(function (a, b) { return a.name.localeCompare(b.name); });
    } else {
      countries = [{ code: 'ZA', name: 'South Africa', dial: '+27', search: 'south africa za 27 +27' }];
    }
    updateCountryButton('ZA');

    var control = $('phone-country-control'), button = $('phone-country-button'), list = $('phone-country-options'), search = $('phone-country-search');
    button.addEventListener('click', function () {
      if ($('phone-country-menu').hidden) openCountryMenu(); else closeCountryMenu(false);
    });
    button.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openCountryMenu();
        if (e.key === 'ArrowDown') focusCountryOption(0);
        else if (e.key === 'ArrowUp') focusCountryOption(-1);
        else search.focus();
      }
    });
    search.addEventListener('input', function () { renderCountryOptions(search.value); });
    search.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); focusCountryOption(0); }
      else if (e.key === 'Enter') {
        e.preventDefault();
        var first = list.querySelector('.phone-country-option');
        if (first) chooseCountry(first.dataset.country, true);
      } else if (e.key === 'Escape') { e.preventDefault(); closeCountryMenu(true); }
    });
    list.addEventListener('click', function (e) {
      var option = e.target.closest('.phone-country-option');
      if (option) { chooseCountry(option.dataset.country, true); return; }
      if (e.target.closest('.phone-country-more')) {
        visibleCountries += 60;
        renderCountryOptions(search.value);
      }
    });
    list.addEventListener('keydown', function (e) {
      var options = Array.prototype.slice.call(list.querySelectorAll('.phone-country-option'));
      var current = options.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); focusCountryOption(current + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); focusCountryOption(current - 1); }
      else if (e.key === 'Home') { e.preventDefault(); focusCountryOption(0); }
      else if (e.key === 'End') { e.preventDefault(); focusCountryOption(options.length - 1); }
      else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (current >= 0) chooseCountry(options[current].dataset.country, true);
      } else if (e.key === 'Escape') { e.preventDefault(); closeCountryMenu(true); }
    });
    document.addEventListener('click', function (e) { if (!control.contains(e.target)) closeCountryMenu(false); });
  }

  function setErr(id, msg) {
    var el = $(id), e = $(id + '-err');
    if (el) { el.classList.toggle('invalid', !!msg); el.setAttribute('aria-invalid', msg ? 'true' : 'false'); el.setAttribute('aria-describedby', id + '-err'); }
    if (e) e.textContent = msg || '';
    return !msg;
  }
  function validSAID(id) {
    if (!/^\d{13}$/.test(id)) return false;
    var mm = +id.slice(2, 4), dd = +id.slice(4, 6);
    if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return false;
    var sum = 0;
    for (var i = 0; i < 13; i++) { var d = +id[12 - i]; if (i % 2) { d *= 2; if (d > 9) d -= 9; } sum += d; }
    return sum % 10 === 0;
  }

  // Password show/hide
  document.querySelectorAll('[data-toggle]').forEach(function (btn) {
    btn.innerHTML = EYE;
    btn.addEventListener('click', function () {
      var input = $(btn.dataset.toggle), show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.innerHTML = show ? EYE_OFF : EYE;
      btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
    });
  });
  $('role').addEventListener('change', function () { setErr('role', ''); });
  $('back').addEventListener('click', function () {
    window.location.href = 'membership-consent.html';
  });
  var interestBoxes = Array.prototype.slice.call(document.querySelectorAll('input[name="area_of_interest"]'));
  function updateInterestSummary() {
    var selected = interestBoxes.filter(function (item) { return item.checked; });
    $('interest-summary').textContent = selected.length
      ? selected.length + ' of 3 selected'
      : 'Select up to 3 areas';
  }
  interestBoxes.forEach(function (box) {
    box.addEventListener('change', function () {
      var selected = interestBoxes.filter(function (item) { return item.checked; });
      if (selected.length > 3) {
        box.checked = false;
        setErr('interest', 'Select no more than 3 areas of interest.');
        return;
      }
      updateInterestSummary();
      setErr('interest', '');
    });
  });
  // Photo preview
  $('photo').addEventListener('change', function () {
    var f = this.files[0], img = $('photo-preview'), icon = $('photo-icon');
    setErr('photo', '');
    if (!f) {
      img.classList.add('hidden');
      icon.classList.remove('hidden');
      return;
    }
    if (!/^image\/(png|jpeg)$/.test(f.type)) {
      this.value = '';
      img.classList.add('hidden');
      icon.classList.remove('hidden');
      return setErr('photo', 'Only JPG or PNG images are allowed.');
    }
    if (f.size > 2 * 1048576) {
      this.value = '';
      img.classList.add('hidden');
      icon.classList.remove('hidden');
      return setErr('photo', 'Photo must be 2 MB or smaller.');
    }
    if (img.src && img.src.indexOf('blob:') === 0) URL.revokeObjectURL(img.src);
    img.src = URL.createObjectURL(f);
    img.classList.remove('hidden');
    icon.classList.add('hidden');
  });
  if (sessionStorage.getItem('dccMembershipConsent') !== 'yes') {
    window.location.replace('membership-consent.html');
    return;
  }
  $('terms-val').value = 'yes';
  $('popia-val').value = 'yes';
  fillCountries();
  form.querySelectorAll('.input').forEach(function (el) { el.addEventListener('input', function () { setErr(el.id, ''); }); });
  $('phone-country').addEventListener('change', function () { setErr('phone', ''); });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    $('reg-alert').hidden = true; $('reg-ok').hidden = true;
    var ok = true, role = val('role'), pw = $('password').value;
    ok &= setErr('role', ['student', 'representative', 'supervisor'].indexOf(role) < 0 ? 'Select Student, Representative or Supervisor.' : '');
    ok &= setErr('title', !val('title') ? 'Select a title.' : '');
    ok &= setErr('gender', !val('gender') ? 'Select a gender option.' : '');
    ok &= setErr('first-name', val('first-name').length < 2 ? 'Enter your first name.' : '');
    ok &= setErr('surname', val('surname').length < 2 ? 'Enter your surname.' : '');
    ok &= setErr('id-number', !validSAID(val('id-number')) ? 'Enter a valid 13-digit SA ID number.' : '');
    var phone = phoneDetails();
    ok &= setErr('phone', !phone.valid ? 'Enter a valid phone number for the selected country.' : '');
    ok &= setErr('email', !EMAIL.test(val('email')) ? 'Enter a valid email address.' : '');
    ok &= setErr('organisation', val('organisation').length < 2 ? 'Enter your organisation.' : '');
    var selectedInterests = interestBoxes.filter(function (box) { return box.checked; });
    ok &= setErr('interest', selectedInterests.length === 0
      ? 'Select at least one area of interest.'
      : selectedInterests.length > 3 ? 'Select no more than 3 areas of interest.' : '');
    ok &= setErr('address', val('address').length < 10 ? 'Enter your full physical address.' : '');
    ok &= setErr('password', !RULES.every(function (r) { return r[1](pw); }) ? 'Use 8+ characters with upper & lower case, a number and a symbol.' : '');
    ok &= setErr('confirm', !$('confirm').value ? 'Confirm your password.' : $('confirm').value !== pw ? 'Passwords do not match.' : '');
    if (!ok) {
      $('reg-alert').textContent = 'Please correct the highlighted fields and try again.'; $('reg-alert').hidden = false;
      var first = form.querySelector('.invalid'); if (first) setTimeout(function () { first.focus({ preventScroll: true }); }, 50);
      setTimeout(function () { $('reg-alert').hidden = true; }, 5000);
      return;
    }
    if (window.API && API.on()) {
      var fd = new FormData(form), btn = form.querySelector('[type=submit]');
      fd.set('phone', phone.number);
      fd.set('phone_country', phone.country); btn.disabled = true;
      API.post('/auth/register', fd).then(function (r) {
        btn.disabled = false; form.reset(); updateCountryButton('ZA'); closeCountryMenu(false);
        updateInterestSummary(); $('interest').open = false;
        // Stays on screen: the Member ID is needed to log in. "Log in now" fills it in on the login page.
        var ok = $('reg-ok'), esc = function (t) { var d = document.createElement('div'); d.textContent = t; return d.innerHTML; };
        ok.innerHTML = '<p>' + esc(r.message) + '</p>' + (r.status === 'active'
          ? '<p class="mt-2"><a class="font-semibold text-green-900 underline" href="login.html?member=' + encodeURIComponent(r.member_no) + '">Log in now</a></p>' : '');
        ok.hidden = false; ok.scrollIntoView({ block: 'nearest' });
      }).catch(function (err) {
        btn.disabled = false;
        var map = { first_name: 'first-name', id_number: 'id-number', area_of_interest: 'interest', confirm_password: 'confirm' };
        Object.keys(err.fields || {}).forEach(function (k) { if ($(map[k] || k)) setErr(map[k] || k, err.fields[k]); });
        $('reg-alert').textContent = err.message; $('reg-alert').hidden = false; setTimeout(function () { $('reg-alert').hidden = true; }, 6000);
      });
      return;
    }
    $('reg-ok').textContent = 'Demo registration received. Nothing is saved until demo mode is switched off (js/config.js → demo: false).';
    $('reg-ok').hidden = false; setTimeout(function () { $('reg-ok').hidden = true; }, 6000);
  });
})();
