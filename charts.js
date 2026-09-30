/* FinanceLiveCraft — mini SVG chart library (no dependencies).
 * Colors come from CSS custom properties (--ser-1..6, --ch-*) so light/dark
 * themes adapt automatically. Series palette follows the validated dataviz
 * categorical order (blue, orange, aqua, yellow, magenta, green).
 *
 * Every chart ships a hover layer: a styled tooltip with exact Rupiah values
 * on hit areas larger than the marks (a whole month column for bars/lines).
 */
(function () {
  "use strict";
  var NS = "http://www.w3.org/2000/svg";

  function svg(tag, attrs) {
    var e = document.createElementNS(NS, tag);
    if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }
  function clear(c) { c.innerHTML = ""; }
  function rupiah(n) { return "Rp" + Math.round(n).toLocaleString("id-ID"); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }
  function trim(x) {
    var v = Math.round(x * 10) / 10;
    return (Number.isInteger(v) ? v : v.toFixed(1)).toString().replace(".", ",");
  }
  function compact(n) {
    var s = n < 0 ? "-" : "", a = Math.abs(n);
    if (a >= 1e9) return s + trim(a / 1e9) + "M";
    if (a >= 1e6) return s + trim(a / 1e6) + "jt";
    if (a >= 1e3) return s + Math.round(a / 1e3) + "rb";
    return s + Math.round(a);
  }
  function niceMax(v) {
    if (v <= 0) return 1;
    var exp = Math.floor(Math.log10(v)), base = Math.pow(10, exp), f = v / base;
    var nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
    return nice * base;
  }
  function emptyMsg(c, msg) {
    clear(c);
    var d = document.createElement("div");
    d.className = "chart-empty";
    d.textContent = msg || "Tidak ada data untuk ditampilkan";
    c.appendChild(d);
  }
  function legend(series) {
    var d = document.createElement("div");
    d.className = "chart-legend";
    series.forEach(function (s) {
      var it = document.createElement("span");
      it.className = "chart-legend-item";
      var sw = document.createElement("span");
      sw.className = "chart-swatch";
      sw.style.background = "var(" + s.colorVar + ")";
      it.appendChild(sw);
      it.appendChild(document.createTextNode(s.name));
      d.appendChild(it);
    });
    return d;
  }
  function roundedTop(x, y, w, h, r) {
    r = Math.min(r, w / 2, Math.abs(h));
    return "M" + x + "," + (y + h) + " L" + x + "," + (y + r) + " Q" + x + "," + y + " " + (x + r) + "," + y +
      " L" + (x + w - r) + "," + y + " Q" + (x + w) + "," + y + " " + (x + w) + "," + (y + r) +
      " L" + (x + w) + "," + (y + h) + " Z";
  }
  function roundedBottom(x, y, w, h, r) {
    r = Math.min(r, w / 2, h);
    return "M" + x + "," + y + " L" + x + "," + (y + h - r) + " Q" + x + "," + (y + h) + " " + (x + r) + "," + (y + h) +
      " L" + (x + w - r) + "," + (y + h) + " Q" + (x + w) + "," + (y + h) + " " + (x + w) + "," + (y + h - r) +
      " L" + (x + w) + "," + y + " Z";
  }
  function scale(values) {
    var mx = 0, mn = 0;
    values.forEach(function (v) { if (v > mx) mx = v; if (v < mn) mn = v; });
    var top = niceMax(mx), bot = mn < 0 ? -niceMax(-mn) : 0;
    if (top === 0 && bot === 0) top = 1;
    return { top: top, bot: bot, range: top - bot };
  }

  // ---------- Shared tooltip ----------
  var tip = null;
  function ensureTip() {
    if (!tip) {
      tip = document.createElement("div");
      tip.className = "chart-tip";
      tip.setAttribute("role", "tooltip");
      document.body.appendChild(tip);
      document.addEventListener("scroll", hideTip, true);
    }
    return tip;
  }
  function tipRows(title, rows) {
    var h = '<div class="tt-title">' + esc(title) + "</div>";
    rows.forEach(function (r) {
      h += '<div class="tt-row">' +
        (r.colorVar ? '<span class="tt-sw" style="background:var(' + r.colorVar + ')"></span>' : "") +
        '<span class="tt-name">' + esc(r.name) + '</span><b class="tt-val">' + esc(r.value) + "</b></div>";
    });
    return h;
  }
  function moveTip(e) {
    if (!tip) return;
    var r = tip.getBoundingClientRect();
    var x = e.clientX + 14, y = e.clientY + 14;
    if (x + r.width > window.innerWidth - 8) x = e.clientX - r.width - 14;
    if (y + r.height > window.innerHeight - 8) y = e.clientY - r.height - 14;
    tip.style.transform = "translate(" + Math.max(8, x) + "px," + Math.max(8, y) + "px)";
  }
  function showTip(html, e) {
    var t = ensureTip();
    t.innerHTML = html;
    t.classList.add("is-on");
    moveTip(e);
  }
  function hideTip() { if (tip) tip.classList.remove("is-on"); }
  // Bind pointer events (mouse + touch) on a hit element.
  function bindHover(el, html, onEnter, onLeave) {
    el.addEventListener("pointerenter", function (e) { showTip(html, e); if (onEnter) onEnter(); });
    el.addEventListener("pointermove", moveTip);
    el.addEventListener("pointerdown", function (e) { showTip(html, e); if (onEnter) onEnter(); });
    el.addEventListener("pointerleave", function () { hideTip(); if (onLeave) onLeave(); });
  }

  // ---------- Grouped/single vertical bars (supports negatives) ----------
  function bars(container, cfg) {
    clear(container);
    var all = [];
    cfg.series.forEach(function (s) { all = all.concat(s.values); });
    if (all.every(function (v) { return !v; })) { emptyMsg(container, cfg.empty); return; }

    if (cfg.series.length > 1) container.appendChild(legend(cfg.series));

    var W = Math.max(container.clientWidth || 320, 280), H = cfg.height || 240;
    var padL = 46, padR = 14, padT = 20, padB = 26;
    var plotW = W - padL - padR, plotH = H - padT - padB;
    var sc = scale(all);
    function Y(v) { return padT + plotH - (v - sc.bot) / sc.range * plotH; }

    var s = svg("svg", { width: W, height: H, viewBox: "0 0 " + W + " " + H, class: "chart-svg", role: "img" });
    if (cfg.ariaLabel) s.setAttribute("aria-label", cfg.ariaLabel);

    var ticks = 4;
    for (var i = 0; i <= ticks; i++) {
      var val = sc.bot + sc.range * i / ticks, y = Y(val);
      s.appendChild(svg("line", { x1: padL, y1: y, x2: W - padR, y2: y, class: "chart-grid" }));
      var t = svg("text", { x: padL - 6, y: y + 3, class: "chart-ytick", "text-anchor": "end" });
      t.textContent = compact(val); s.appendChild(t);
    }

    var n = cfg.labels.length, ns = cfg.series.length;
    var groupW = plotW / n, innerPad = groupW * 0.16;
    var barSpace = groupW - innerPad * 2;
    var bw = Math.max(2, (barSpace - (ns - 1) * 2) / ns);
    var zeroY = Y(0);

    // Hover band layer sits under the bars
    var bandLayer = svg("g", { class: "chart-bands" });
    s.appendChild(bandLayer);

    // Track the single highest bar for a selective direct label
    var maxV = -Infinity, maxX = 0, maxY = 0;

    cfg.labels.forEach(function (lab, gi) {
      var gx = padL + gi * groupW + innerPad;
      cfg.series.forEach(function (ser, si) {
        var v = ser.values[gi] || 0;
        if (!v) return;
        var x = gx + si * (bw + 2);
        var d = v >= 0 ? roundedTop(x, Y(v), bw, zeroY - Y(v), 4) : roundedBottom(x, zeroY, bw, Y(v) - zeroY, 4);
        var p = svg("path", { d: d, class: "chart-bar" });
        p.style.fill = "var(" + ser.colorVar + ")";
        s.appendChild(p);
        if (v > maxV) { maxV = v; maxX = x + bw / 2; maxY = Y(v); }
      });
      var xt = svg("text", { x: padL + gi * groupW + groupW / 2, y: H - 8, class: "chart-xtick", "text-anchor": "middle" });
      xt.textContent = lab; s.appendChild(xt);
    });

    s.appendChild(svg("line", { x1: padL, y1: zeroY, x2: W - padR, y2: zeroY, class: "chart-axis" }));

    if (maxV > 0) {
      var ml = svg("text", { x: maxX, y: maxY - 6, class: "chart-maxlabel", "text-anchor": "middle" });
      ml.textContent = compact(maxV);
      s.appendChild(ml);
    }

    // Hit areas: one full-height column per month showing every series
    cfg.labels.forEach(function (lab, gi) {
      var hasAny = cfg.series.some(function (ser) { return ser.values[gi]; });
      if (!hasAny) return;
      var x0 = padL + gi * groupW;
      var band = svg("rect", { x: x0, y: padT, width: groupW, height: plotH, class: "chart-band" });
      bandLayer.appendChild(band);
      var rows = cfg.series.map(function (ser) {
        return { name: ser.name, colorVar: ser.colorVar, value: rupiah(ser.values[gi] || 0) };
      });
      var hit = svg("rect", { x: x0, y: padT, width: groupW, height: plotH + padB, class: "chart-hit" });
      bindHover(hit, tipRows(cfg.fullLabels ? cfg.fullLabels[gi] : lab, rows),
        function () { band.classList.add("is-on"); },
        function () { band.classList.remove("is-on"); });
      s.appendChild(hit);
    });

    container.appendChild(s);
  }

  // ---------- Line/area (single series, supports negatives) ----------
  function area(container, cfg) {
    clear(container);
    if (cfg.values.every(function (v) { return !v; })) { emptyMsg(container, cfg.empty); return; }
    var W = Math.max(container.clientWidth || 320, 280), H = cfg.height || 240;
    var padL = 46, padR = 14, padT = 14, padB = 26;
    var plotW = W - padL - padR, plotH = H - padT - padB;
    var sc = scale(cfg.values);
    var color = cfg.colorVar || "--ser-1";
    var len = cfg.values.length;
    function X(i) { return len <= 1 ? padL + plotW / 2 : padL + i / (len - 1) * plotW; }
    function Y(v) { return padT + plotH - (v - sc.bot) / sc.range * plotH; }

    var s = svg("svg", { width: W, height: H, viewBox: "0 0 " + W + " " + H, class: "chart-svg", role: "img" });
    if (cfg.ariaLabel) s.setAttribute("aria-label", cfg.ariaLabel);

    for (var i = 0; i <= 4; i++) {
      var val = sc.bot + sc.range * i / 4, y = Y(val);
      s.appendChild(svg("line", { x1: padL, y1: y, x2: W - padR, y2: y, class: "chart-grid" }));
      var t = svg("text", { x: padL - 6, y: y + 3, class: "chart-ytick", "text-anchor": "end" });
      t.textContent = compact(val); s.appendChild(t);
    }
    var zeroY = Y(0);
    s.appendChild(svg("line", { x1: padL, y1: zeroY, x2: W - padR, y2: zeroY, class: "chart-axis" }));

    var gid = "grad" + Math.random().toString(36).slice(2, 7);
    var defs = svg("defs");
    var lg = svg("linearGradient", { id: gid, x1: 0, y1: 0, x2: 0, y2: 1 });
    var st1 = svg("stop", { offset: "0%" }); st1.style.stopColor = "var(" + color + ")"; st1.style.stopOpacity = "0.28";
    var st2 = svg("stop", { offset: "100%" }); st2.style.stopColor = "var(" + color + ")"; st2.style.stopOpacity = "0.02";
    lg.appendChild(st1); lg.appendChild(st2); defs.appendChild(lg); s.appendChild(defs);

    var line = "";
    cfg.values.forEach(function (v, i) { line += (i ? " L" : "M") + X(i) + "," + Y(v); });
    var areaP = line + " L" + X(len - 1) + "," + zeroY + " L" + X(0) + "," + zeroY + " Z";
    var ap = svg("path", { d: areaP, class: "chart-area" }); ap.style.fill = "url(#" + gid + ")"; s.appendChild(ap);
    var lp = svg("path", { d: line, class: "chart-line" }); lp.style.stroke = "var(" + color + ")"; s.appendChild(lp);

    var guide = svg("line", { x1: 0, y1: padT, x2: 0, y2: padT + plotH, class: "chart-guide" });
    s.appendChild(guide);

    var dots = [];
    cfg.values.forEach(function (v, i) {
      var dot = svg("circle", { cx: X(i), cy: Y(v), r: 3.5, class: "chart-dot" });
      dot.style.fill = "var(" + color + ")";
      s.appendChild(dot);
      dots.push(dot);
    });
    cfg.labels.forEach(function (lab, i) {
      var xt = svg("text", { x: X(i), y: H - 8, class: "chart-xtick", "text-anchor": "middle" });
      xt.textContent = lab; s.appendChild(xt);
    });

    // Hit columns centred on each point: crosshair + tooltip
    var colW = len <= 1 ? plotW : plotW / (len - 1);
    cfg.values.forEach(function (v, i) {
      var hx = Math.max(padL, X(i) - colW / 2);
      var hw = Math.min(W - padR, X(i) + colW / 2) - hx;
      var hit = svg("rect", { x: hx, y: padT, width: hw, height: plotH + padB, class: "chart-hit" });
      var prev = i > 0 ? cfg.values[i - 1] : null;
      var rows = [{ name: cfg.seriesName || "Nilai", colorVar: color, value: rupiah(v) }];
      if (prev !== null) rows.push({ name: "Perubahan", value: (v - prev >= 0 ? "+" : "") + rupiah(v - prev) });
      bindHover(hit, tipRows(cfg.fullLabels ? cfg.fullLabels[i] : cfg.labels[i], rows),
        function () {
          guide.setAttribute("x1", X(i)); guide.setAttribute("x2", X(i));
          guide.classList.add("is-on"); dots[i].classList.add("is-on");
        },
        function () { guide.classList.remove("is-on"); dots[i].classList.remove("is-on"); });
      s.appendChild(hit);
    });
    container.appendChild(s);
  }

  // ---------- Horizontal ranked bars (single hue, label above, share %) ----------
  function hbars(container, cfg) {
    clear(container);
    var all = cfg.items.filter(function (i) { return i.value > 0; })
      .sort(function (a, b) { return b.value - a.value; });
    if (!all.length) { emptyMsg(container, cfg.empty); return; }
    var sum = all.reduce(function (a, b) { return a + b.value; }, 0);
    var items = cfg.limit ? all.slice(0, cfg.limit) : all;
    var maxV = items[0].value;
    var color = cfg.colorVar || "--ser-1";
    var W = Math.max(container.clientWidth || 320, 260);
    var rowH = 20, labelH = 18, gap = 14, padR = 4;
    var H = items.length * (rowH + labelH + gap);
    var s = svg("svg", { width: W, height: H, viewBox: "0 0 " + W + " " + H, class: "chart-svg", role: "img" });
    if (cfg.ariaLabel) s.setAttribute("aria-label", cfg.ariaLabel);

    items.forEach(function (it, idx) {
      var top = idx * (rowH + labelH + gap);
      var pct = sum ? Math.round(it.value / sum * 100) : 0;
      var lab = svg("text", { x: 0, y: top + 13, class: "chart-hlabel" });
      lab.textContent = it.label; s.appendChild(lab);
      var val = svg("text", { x: W - padR, y: top + 13, class: "chart-vlabel", "text-anchor": "end" });
      val.textContent = compact(it.value) + " · " + pct + "%"; s.appendChild(val);
      var by = top + labelH;
      s.appendChild(svg("rect", { x: 0, y: by, width: W - padR, height: rowH, rx: 6, class: "chart-track" }));
      var w = Math.max(3, it.value / maxV * (W - padR));
      var bar = svg("rect", { x: 0, y: by, width: w, height: rowH, rx: 6, class: "chart-hbar" });
      bar.style.fill = "var(" + color + ")";
      s.appendChild(bar);
      var hit = svg("rect", { x: 0, y: top, width: W, height: rowH + labelH + gap / 2, class: "chart-hit" });
      bindHover(hit, tipRows(it.full || it.label, [
        { name: "Nilai", colorVar: color, value: rupiah(it.value) },
        { name: "Porsi", value: pct + "% dari total" },
        { name: "Peringkat", value: "#" + (idx + 1) + " dari " + all.length }
      ]), function () { bar.classList.add("is-on"); }, function () { bar.classList.remove("is-on"); });
      s.appendChild(hit);
    });
    container.appendChild(s);
  }

  // ---------- Donut (part-of-whole, labeled) ----------
  function arc(cx, cy, R, r, a0, a1) {
    var x0 = cx + R * Math.cos(a0), y0 = cy + R * Math.sin(a0);
    var x1 = cx + R * Math.cos(a1), y1 = cy + R * Math.sin(a1);
    var xi1 = cx + r * Math.cos(a1), yi1 = cy + r * Math.sin(a1);
    var xi0 = cx + r * Math.cos(a0), yi0 = cy + r * Math.sin(a0);
    var large = (a1 - a0) > Math.PI ? 1 : 0;
    return "M" + x0 + "," + y0 + " A" + R + "," + R + " 0 " + large + " 1 " + x1 + "," + y1 +
      " L" + xi1 + "," + yi1 + " A" + r + "," + r + " 0 " + large + " 0 " + xi0 + "," + yi0 + " Z";
  }
  function donut(container, cfg) {
    clear(container);
    var items = cfg.items.filter(function (i) { return i.value > 0; });
    var total = items.reduce(function (a, b) { return a + b.value; }, 0);
    if (total === 0) { emptyMsg(container, cfg.empty); return; }

    var wrap = document.createElement("div");
    wrap.className = "chart-donut";
    var size = 190, cx = size / 2, cy = size / 2, R = size / 2 - 4, r = R * 0.62;
    var s = svg("svg", { width: size, height: size, viewBox: "0 0 " + size + " " + size, class: "chart-donut-svg", role: "img" });
    if (cfg.ariaLabel) s.setAttribute("aria-label", cfg.ariaLabel);

    var ct = svg("text", { x: cx, y: cy - 2, class: "chart-donut-total", "text-anchor": "middle" });
    var cl = svg("text", { x: cx, y: cy + 14, class: "chart-donut-sub", "text-anchor": "middle" });
    function resetCenter() { ct.textContent = compact(total); cl.textContent = cfg.centerLabel || "Total"; }

    var a0 = -Math.PI / 2, gap = items.length > 1 ? 0.03 : 0;
    var rows = [];
    items.forEach(function (it) {
      var frac = it.value / total, a1 = a0 + frac * 2 * Math.PI;
      var p = svg("path", { d: arc(cx, cy, R, r, a0 + gap / 2, a1 - gap / 2), class: "chart-arc" });
      p.style.fill = "var(" + it.colorVar + ")";
      var pct = Math.round(frac * 100);
      bindHover(p, tipRows(it.label, [
        { name: "Nilai", colorVar: it.colorVar, value: rupiah(it.value) },
        { name: "Porsi", value: pct + "%" }
      ]), function () {
        p.classList.add("is-on");
        ct.textContent = pct + "%";
        cl.textContent = it.label.length > 16 ? it.label.slice(0, 15) + "…" : it.label;
      }, function () { p.classList.remove("is-on"); resetCenter(); });
      s.appendChild(p);
      rows.push({ it: it, path: p, pct: pct });
      a0 = a1;
    });
    resetCenter();
    s.appendChild(ct); s.appendChild(cl);
    wrap.appendChild(s);

    var leg = document.createElement("div");
    leg.className = "chart-legend chart-legend-col";
    rows.forEach(function (row) {
      var el = document.createElement("span");
      el.className = "chart-legend-item";
      var sw = document.createElement("span");
      sw.className = "chart-swatch"; sw.style.background = "var(" + row.it.colorVar + ")";
      var txt = document.createElement("span");
      txt.className = "chart-legend-txt";
      txt.innerHTML = "<span class='chart-legend-name'>" + esc(row.it.label) + "</span>" +
        "<span class='chart-legend-val'>" + rupiah(row.it.value) + " · " + row.pct + "%</span>";
      el.appendChild(sw); el.appendChild(txt);
      // Hovering a legend row highlights its slice too
      el.addEventListener("pointerenter", function () { row.path.classList.add("is-on"); });
      el.addEventListener("pointerleave", function () { row.path.classList.remove("is-on"); });
      leg.appendChild(el);
    });
    wrap.appendChild(leg);
    container.appendChild(wrap);
  }

  window.Charts = { bars: bars, area: area, hbars: hbars, donut: donut, rupiah: rupiah, compact: compact };
})();
