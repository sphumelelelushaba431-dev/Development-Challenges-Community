/* Lightweight SVG charts for the dashboards (no library).
   Each chart sizes itself to its container and redraws on resize.
   Marks: rounded rail bars, donut with total, bullet graphs with rounded track, hover tooltips. */
(function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg', registry = [], uid = 0;
  var TXT = '#475569', MUTED = '#94a3b8', GRID = '#e2e8f0';
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };

  // Tooltip shared by all charts
  var tip = document.createElement('div');
  tip.className = 'pointer-events-none fixed z-[90] max-w-xs rounded-lg bg-slate-900 px-3 py-2 text-[12.5px] leading-snug text-white opacity-0 shadow-xl ring-1 ring-white/10 transition-opacity';
  tip.setAttribute('role', 'tooltip');
  document.addEventListener('DOMContentLoaded', function () { document.body.appendChild(tip); });
  document.addEventListener('mousemove', function (e) {
    var t = e.target.closest && e.target.closest('[data-tip]');
    if (!t) { tip.style.opacity = 0; return; }
    if (!tip.parentNode) document.body.appendChild(tip);
    tip.innerHTML = t.getAttribute('data-tip'); tip.style.opacity = 1;
    tip.style.left = Math.min(e.clientX + 12, innerWidth - tip.offsetWidth - 8) + 'px'; tip.style.top = (e.clientY + 14) + 'px';
  });

  function svg(el) { var w = Math.max(120, el.clientWidth), h = Math.max(60, el.clientHeight); return { w: w, h: h, open: '<svg width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="' + esc(el.getAttribute('aria-label') || 'chart') + '" style="display:block;font-family:Inter,system-ui,sans-serif">' }; }
  // Clean tick values: 0, step, 2·step … max (step = 1, 2, 2.5, 5 × 10^n)
  function ticks(max) { var steps = [1, 2, 2.5, 5, 10, 20, 25, 50, 100], st = steps.filter(function (x) { return max / x <= 5; })[0] || max / 5, out = []; for (var v = 0; v <= max + 1e-9; v += st) out.push(Math.round(v * 10) / 10); return out; }
  function niceMax(v) { if (v <= 5) return 5; var p = Math.pow(10, Math.floor(Math.log10(v))), n = v / p; return (n <= 2 ? 2 : n <= 5 ? 5 : 10) * p; }
  // Rectangle bar with 4px rounded data-end, square at the baseline
  function barPath(x, y, w, h, dir) {
    var r = Math.min(4, dir === 'h' ? h / 2 : w / 2, dir === 'h' ? w : h);
    if (dir === 'h') return 'M' + x + ',' + y + 'h' + (w - r) + 'a' + r + ',' + r + ' 0 0 1 ' + r + ',' + r + 'v' + (h - 2 * r) + 'a' + r + ',' + r + ' 0 0 1 -' + r + ',' + r + 'h-' + (w - r) + 'z';
    return 'M' + x + ',' + (y + h) + 'v-' + (h - r) + 'a' + r + ',' + r + ' 0 0 1 ' + r + ',-' + r + 'h' + (w - 2 * r) + 'a' + r + ',' + r + ' 0 0 1 ' + r + ',' + r + 'v' + (h - r) + 'z';
  }
  function legend(series) {
    return '<div class="mt-1 flex flex-wrap gap-x-4 gap-y-1 px-1 text-[11.5px] text-slate-600">' + series.map(function (s) { return '<span class="inline-flex items-center gap-1.5"><i class="inline-block size-2.5 rounded-sm" style="background:' + s.color + '"></i>' + esc(s.name) + '</span>'; }).join('') + '</div>';
  }

  /* Horizontal bars: items [{label, value, color, max?, tip?}], opts {max, fmt, marker (capacity line)} */
  function hbars(el, items, opts) {
    opts = opts || {}; var s = svg(el), fmt = opts.fmt || function (v) { return v; };
    var labelW = Math.min(150, Math.max(80, s.w * 0.36)), valW = 40, n = items.length || 1;
    var band = s.h / n, bh = Math.min(16, band * 0.6), max = opts.max || Math.max.apply(null, items.map(function (i) { return i.max || i.value; }).concat([1]));
    var plotW = s.w - labelW - valW - (stack ? 2 : 8), out = s.open;
    items.forEach(function (it, i) {
      var y = i * band + (band - bh) / 2, w = Math.max(2, (it.value / max) * plotW), x = labelW;
      var maxCh = Math.floor(((stack ? s.w - 50 : labelW) - 10) / (stack ? 6.6 : 6.4)), label = it.label.length > maxCh ? it.label.slice(0, maxCh - 1).trim() + '…' : it.label;
      if (stack) out += '<text x="0" y="' + (y - 6) + '" font-size="12.5" fill="#1e293b">' + esc(label) + '</text>';
      else out += '<text x="' + (labelW - 8) + '" y="' + (y + bh / 2 + 4) + '" text-anchor="end" font-size="11.5" fill="' + TXT + '">' + esc(label) + '</text>';
      out += '<rect x="' + x + '" y="' + y + '" width="' + plotW + '" height="' + bh + '" rx="3" fill="#f1f5f9"/>';
      if (it.value > 0) out += '<path d="' + barPath(x, y, w, bh, 'h') + '" fill="' + (it.color || '#1d4ed8') + '"/>';
      if (it.max) { var mx = x + (it.max / max) * plotW; out += '<line x1="' + mx + '" x2="' + mx + '" y1="' + (y - 3) + '" y2="' + (y + bh + 3) + '" stroke="#0f172a" stroke-width="1.5"/>'; }
      out += '<rect x="0" y="' + (i * band) + '" width="' + s.w + '" height="' + band + '" fill="transparent" data-tip="' + esc(it.tip || (it.label + ': ' + fmt(it.value))) + '"/>';
      out += '<text x="' + (s.w - 2) + '" y="' + (y + bh / 2 + 4) + '" text-anchor="end" font-size="11.5" font-weight="700" fill="#0f172a">' + esc(fmt(it.value)) + '</text>';
    });
    el.innerHTML = out + '</svg>';
  }

  /* Grouped columns: data {labels:[], series:[{name,color,values[]}]} */
  function columns(el, data) {
    var holder = el; holder.innerHTML = '<div class="chart-plot" style="height:calc(100% - 22px)"></div>' + legend(data.series);
    var plot = holder.firstChild, s = svg(plot), padL = 26, padB = 18, padT = 14;
    var max = niceMax(Math.max.apply(null, [].concat.apply([], data.series.map(function (x) { return x.values; })).concat([1])));
    var iw = s.w - padL - 4, ih = s.h - padB - padT, n = data.labels.length, k = data.series.length;
    var slot = iw / n, bw = Math.min(18, (slot * 0.7) / k), out = s.open;
    var tk = ticks(max); tk.forEach(function (v) { var y = padT + ih - (v / max) * ih; out += '<line x1="' + padL + '" x2="' + s.w + '" y1="' + y + '" y2="' + y + '" stroke="' + GRID + '"/><text x="' + (padL - 6) + '" y="' + (y + 3.5) + '" text-anchor="end" font-size="10" fill="' + MUTED + '">' + v + '</text>'; });
    data.labels.forEach(function (lab, i) {
      var gx = padL + i * slot + (slot - bw * k - 2 * (k - 1)) / 2;
      data.series.forEach(function (se, j) {
        var v = se.values[i], h = Math.max(1, (v / max) * ih), x = gx + j * (bw + 2), y = padT + ih - h;
        out += '<path d="' + barPath(x, y, bw, h, 'v') + '" fill="' + se.color + '" data-tip="' + esc(lab + ' · ' + se.name + ': ' + v) + '"/>';
      });
      out += '<text x="' + (padL + i * slot + slot / 2) + '" y="' + (s.h - 4) + '" text-anchor="middle" font-size="10.5" fill="' + TXT + '">' + esc(lab) + '</text>';
    });
    plot.innerHTML = out + '</svg>';
  }

  /* Line with area wash: data {labels:[], values:[], color, max?, fmt?} */
  function line(el, d) {
    var s = svg(el), padL = 38, padB = 18, padT = 14, padR = 16, max = d.max || niceMax(Math.max.apply(null, d.values.concat([1])));
    var iw = s.w - padL - padR, ih = s.h - padB - padT, n = d.values.length, fmt = d.fmt || function (v) { return v; };
    var X = function (i) { return padL + (n === 1 ? iw / 2 : i * iw / (n - 1)); }, Y = function (v) { return padT + ih - (v / max) * ih; };
    var out = s.open;
    ticks(max).forEach(function (v) { out += '<line x1="' + padL + '" x2="' + (s.w - padR) + '" y1="' + Y(v) + '" y2="' + Y(v) + '" stroke="' + GRID + '"/><text x="' + (padL - 6) + '" y="' + (Y(v) + 3.5) + '" text-anchor="end" font-size="10" fill="' + MUTED + '">' + fmt(v) + '</text>'; });
    var pts = d.values.map(function (v, i) { return X(i) + ',' + Y(v); }).join(' ');
    out += '<polygon points="' + X(0) + ',' + Y(0) + ' ' + pts + ' ' + X(n - 1) + ',' + Y(0) + '" fill="' + d.color + '" opacity="0.1"/>';
    out += '<polyline points="' + pts + '" fill="none" stroke="' + d.color + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>';
    d.values.forEach(function (v, i) {
      out += '<circle cx="' + X(i) + '" cy="' + Y(v) + '" r="4" fill="' + d.color + '" stroke="#fff" stroke-width="2" data-tip="' + esc(d.labels[i] + ': ' + fmt(v)) + '"/>';
      if (n <= 8 || i % Math.ceil(n / 6) === 0 || i === n - 1) out += '<text x="' + X(i) + '" y="' + (s.h - 4) + '" text-anchor="' + (i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle') + '" font-size="10.5" fill="' + TXT + '">' + esc(d.labels[i]) + '</text>';
    });
    out += '<text x="' + X(n - 1) + '" y="' + (Y(d.values[n - 1]) - 9) + '" text-anchor="end" font-size="11" font-weight="700" fill="#0f172a">' + esc(fmt(d.values[n - 1])) + '</text>';
    el.innerHTML = out + '</svg>';
  }

  /* One 100% stacked bar with legend: items [{label, value, color}] */
  function stack(el, items) {
    var total = items.reduce(function (a, b) { return a + b.value; }, 0) || 1;
    el.innerHTML = '<div class="flex h-5 gap-0.5 overflow-hidden rounded-md bg-slate-100">' + items.filter(function (i) { return i.value; }).map(function (i) {
      return '<span style="width:' + (i.value / total * 100) + '%;background:' + i.color + '" data-tip="' + esc(i.label + ': ' + i.value + ' (' + Math.round(i.value / total * 100) + '%)') + '"></span>';
    }).join('') + '</div>' + '<div class="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11.5px] text-slate-600">' + items.map(function (i) { return '<span class="inline-flex items-center gap-1.5"><i class="inline-block size-2.5 shrink-0 rounded-sm" style="background:' + i.color + '"></i>' + esc(i.label) + ' <b class="ml-auto text-slate-900 tabular-nums">' + i.value + '</b></span>'; }).join('') + '</div>';
  }

  /* Radial progress ring: pct 0–100 */
  function ring(el, pct, color, label) {
    var s = Math.min(el.clientWidth, el.clientHeight) || 96, r = s / 2 - 7, c = 2 * Math.PI * r;
    el.innerHTML = '<svg width="' + s + '" height="' + s + '" role="img" aria-label="' + esc(label + ' ' + pct + '%') + '"><circle cx="' + s / 2 + '" cy="' + s / 2 + '" r="' + r + '" fill="none" stroke="#e2e8f0" stroke-width="8"/>' +
      '<circle cx="' + s / 2 + '" cy="' + s / 2 + '" r="' + r + '" fill="none" stroke="' + color + '" stroke-width="8" stroke-linecap="round" stroke-dasharray="' + (c * pct / 100) + ' ' + c + '" transform="rotate(-90 ' + s / 2 + ' ' + s / 2 + ')"/>' +
      '<text x="50%" y="50%" dy="5" text-anchor="middle" font-size="' + Math.round(s / 5) + '" font-weight="800" fill="#0b1a3d">' + pct + '%</text></svg>';
  }

  /* Pie chart with legend: items [{label, value, color}] — slices separated by a 2px white gap */
  /* Donut chart: items [{label, value, color}], opts {centerLabel}.
     2px white gaps between slices, the total in the middle, legend with value and share.
     Hovering a slice or its legend row fades the others. */
  function pie(el, items, opts) {
    opts = opts || {};
    var all = items;   // opts.legendAll: legend lists zero items too (the ring only draws values above 0)
    items = items.filter(function (i) { return i.value > 0; });
    var total = items.reduce(function (a, b) { return a + b.value; }, 0);
    var W = Math.max(120, el.clientWidth), H = Math.max(60, el.clientHeight);
    var side = opts.layout === 'stack' ? false : W >= 300, rows = Math.ceil((opts.legendAll ? all : items).length / 2), legW = 84 + 7 * Math.max.apply(null, items.map(function (i) { return i.label.length; }).concat([4]));
    var size = Math.max(70, Math.min(side ? W - legW - 28 : W * 0.6, side ? H : H - 21 * rows - 10) - 4), r = size / 2, ri = r * 0.62, cx = r + 1, cy = r + 1;
    var pt = function (rad, a) { return (cx + rad * Math.cos(a)).toFixed(2) + ',' + (cy + rad * Math.sin(a)).toFixed(2); };
    var a0 = -Math.PI / 2, out = '<svg class="donut" width="' + (size + 2) + '" height="' + (size + 2) + '" role="img" aria-label="' + esc((el.getAttribute('aria-label') || 'Donut chart') + ': ' + items.map(function (i) { return i.label + ' ' + i.value; }).join(', ')) + '" style="display:block;flex-shrink:0">';
    if (!total) out += '<circle cx="' + cx + '" cy="' + cy + '" r="' + ((r + ri) / 2) + '" fill="none" stroke="#eef1f6" stroke-width="' + (r - ri) + '"/>';
    items.forEach(function (it, k) {
      var frac = it.value / total, a1 = a0 + frac * 2 * Math.PI, big = frac > 0.5 ? 1 : 0, tipT = esc(it.label + ': <b>' + it.value + '</b> (' + Math.round(frac * 100) + '%)');
      if (frac >= 0.9999) out += '<circle data-k="' + k + '" cx="' + cx + '" cy="' + cy + '" r="' + ((r + ri) / 2) + '" fill="none" stroke="' + it.color + '" stroke-width="' + (r - ri) + '" data-tip="' + tipT + '"/>';
      else out += '<path data-k="' + k + '" d="M' + pt(r, a0) + 'A' + r + ',' + r + ' 0 ' + big + ' 1 ' + pt(r, a1) + 'L' + pt(ri, a1) + 'A' + ri + ',' + ri + ' 0 ' + big + ' 0 ' + pt(ri, a0) + 'Z" fill="' + it.color + '" stroke="#fff" stroke-width="2" stroke-linejoin="round" data-tip="' + tipT + '"/>';
      a0 = a1;
    });
    // total in the middle
    var fs = Math.max(16, Math.min(30, ri * 0.62));
    out += '<text x="' + cx + '" y="' + (cy - fs * 0.12) + '" text-anchor="middle" dominant-baseline="central" font-size="' + fs.toFixed(0) + '" font-weight="700" fill="#0b1a3d" style="font-variant-numeric:tabular-nums;pointer-events:none">' + total + '</text>';
    var cl = opts.centerLabel || 'total';
    if (ri * 1.7 > cl.length * 6.2 + 8) out += '<text x="' + cx + '" y="' + (cy + fs * 0.62) + '" text-anchor="middle" dominant-baseline="central" font-size="11" fill="#64748b" style="pointer-events:none">' + esc(cl) + '</text>';
    out += '</svg>';
    var legItems = opts.legendAll ? all : items, pct = opts.showPct !== false;
    var leg = '<ul class="donut-legend grid min-w-0 ' + (side ? 'w-max shrink-0 grid-cols-1 content-center gap-y-2.5 text-[12.5px]' : 'w-full grid-cols-2 gap-x-3 gap-y-0 text-[11.5px]') + ' text-slate-700">' + legItems.map(function (i) {
      var k = items.indexOf(i);
      return '<li' + (k > -1 ? ' data-k="' + k + '"' : '') + ' class="flex min-w-0 items-center gap-1.5 rounded-md px-1 py-0.5' + (i.value ? '' : ' opacity-60') + '" data-tip="' + esc(i.label + ': <b>' + i.value + '</b>') + '"><i class="inline-block size-2.5 shrink-0 rounded-full" style="background:' + i.color + '"></i><span class="truncate">' + esc(i.label) + '</span><b class="ml-auto pl-2 text-slate-900 tabular-nums">' + i.value + '</b>' + (pct ? '<span class="w-10 text-right text-slate-500 tabular-nums">' + Math.round(i.value / (total || 1) * 100) + '%</span>' : '') + '</li>';
    }).join('') + '</ul>';
    el.innerHTML = '<div class="donut-wrap flex h-full ' + (side ? 'flex-row items-center justify-center gap-6 px-1' : 'flex-col items-center justify-center gap-3') + '">' + out + leg + '</div>';
    // link slices and legend rows: hovering one highlights its pair
    var wrap = el.firstChild;
    wrap.addEventListener('mouseover', function (e) { var h = e.target.closest('[data-k]'); wrap.dataset.hot = h ? h.dataset.k : ''; wrap.classList.toggle('hot', !!h); [].forEach.call(wrap.querySelectorAll('[data-k]'), function (x) { x.classList.toggle('on', h && x.dataset.k === h.dataset.k); }); });
    wrap.addEventListener('mouseleave', function () { wrap.classList.remove('hot'); });
  }

  /* Bullet graph: items [{label, value, target, max, color, tip}], opts {fmt, bands:[b1,b2] as fractions of max (default .5,.8)}.
     Grey bands = poor / fair / good ranges, thin bar = actual, black tick = target. */
  function bullet(el, items, opts) {
    opts = opts || {}; var s = svg(el), fmt = opts.fmt || function (v) { return v; }, n = items.length || 1;
    // Narrow cards: name and value on a line above each bar, bar uses the full width
    var stack = opts.stack != null ? opts.stack : s.w < 600;
    var labelW = stack ? 0 : Math.min(150, Math.max(80, s.w * 0.36)), valW = stack ? 0 : 44, band = Math.min(s.h / n, stack ? 62 : 44), bh = stack ? Math.min(16, Math.max(8, band - 26)) : Math.min(20, band * 0.66);
    var plotW = s.w - labelW - valW - (stack ? 2 : 8), out = s.open, B = ['#f1f5f9', '#e2e8f0', '#cbd5e1'];
    items.forEach(function (it, i) {
      var max = it.max || opts.max || Math.max(it.value, it.target || 0, 1), x = labelW, y = stack ? i * band + Math.max(18, (band - bh) / 2 + 9) : i * band + (band - bh) / 2;
      var bands = it.bands || opts.bands || [0.5, 0.8], X = function (v) { return x + Math.min(1, v / max) * plotW; };
      var maxCh = Math.floor(((stack ? s.w - 50 : labelW) - 10) / (stack ? 6.6 : 6.4)), label = it.label.length > maxCh ? it.label.slice(0, maxCh - 1).trim() + '…' : it.label;
      if (stack) out += '<text x="0" y="' + (y - 6) + '" font-size="12.5" fill="#1e293b">' + esc(label) + '</text>';
      else out += '<text x="' + (labelW - 8) + '" y="' + (y + bh / 2 + 4) + '" text-anchor="end" font-size="11.5" fill="' + TXT + '">' + esc(label) + '</text>';
      var cid = 'bc' + (++uid);   // rounded track: the three bands are clipped to it
      out += '<clipPath id="' + cid + '"><rect x="' + x + '" y="' + y + '" width="' + plotW + '" height="' + bh + '" rx="' + Math.min(5, bh / 2) + '"/></clipPath><g clip-path="url(#' + cid + ')">' +
        '<rect x="' + x + '" y="' + y + '" width="' + plotW + '" height="' + bh + '" fill="' + B[0] + '"/>' +
        '<rect x="' + x + '" y="' + y + '" width="' + (bands[1] * plotW) + '" height="' + bh + '" fill="' + B[1] + '"/>' +
        '<rect x="' + x + '" y="' + y + '" width="' + (bands[0] * plotW) + '" height="' + bh + '" fill="' + B[2] + '"/></g>';
      var mh = Math.max(4, bh * 0.42); if (it.value > 0) out += '<rect class="bullet-bar" x="' + x + '" y="' + (y + (bh - mh) / 2) + '" width="' + Math.max(mh, X(it.value) - x) + '" height="' + mh + '" rx="' + (mh / 2) + '" fill="' + (it.color || '#1d4ed8') + '"/>';
      if (it.target != null) out += '<rect x="' + (X(it.target) - 1.5) + '" y="' + (y + 1) + '" width="3" height="' + (bh - 2) + '" rx="1.5" fill="#0b1a3d"/>';
      out += '<rect x="0" y="' + (i * band) + '" width="' + s.w + '" height="' + band + '" fill="transparent" data-tip="' + esc(it.tip || (it.label + ': ' + fmt(it.value) + (it.target != null ? ' · target ' + fmt(it.target) : ''))) + '"/>';
      out += '<text x="' + (s.w - 2) + '" y="' + (stack ? y - 6 : y + bh / 2 + 4) + '" text-anchor="end" font-size="' + (stack ? 12.5 : 11.5) + '" font-weight="700" fill="#0f172a">' + esc(it.valueLabel || fmt(it.value)) + '</text>';
    });
    el.innerHTML = out + '</svg>';
  }

  // Register charts so they redraw when the window resizes
  function draw(id, fn) { var el = document.getElementById(id); if (!el) return; var f = function () { fn(el); }; registry.push(f); f(); }
  function reset() { registry = []; }
  window.addEventListener('resize', function () { clearTimeout(draw.t); draw.t = setTimeout(function () { registry.forEach(function (f) { f(); }); }, 100); });
  window.Charts = { hbars: hbars, pie: pie, bullet: bullet, columns: columns, line: line, stack: stack, ring: ring, draw: draw, reset: reset };
})();
