/* FinanceLiveCraft — mini SVG chart library (no dependencies).
 * Colors come from CSS custom properties (--ser-1..6, --ch-*) so light/dark
 * themes adapt automatically. Series palette follows the validated dataviz
 * categorical order (blue, orange, aqua, yellow, magenta, green).
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
    if (h >= 0) {
      return "M" + x + "," + (y + h) + " L" + x + "," + (y + r) + " Q" + x + "," + y + " " + (x + r) + "," + y +
        " L" + (x + w - r) + "," + y + " Q" + (x + w) + "," + y + " " + (x + w) + "," + (y + r) +
        " L" + (x + w) + "," + (y + h) + " Z";
    }
    // negative bar: rounded bottom, anchored at y (baseline), extends down by -h
    var hh = -h;
    return "M" + x + "," + y + " L" + x + "," + (y + hh - r) + " Q" + x + "," + (y + hh) + " " + (x + r) + "," + (y + hh) +
      " L" + (x + w - r) + "," + (y + hh) + " Q" + (x + w) + "," + (y + hh) + " " + (x + w) + "," + (y + hh - r) +
      " L" + (x + w) + "," + y + " Z";
  }

  function scale(values) {
    var mx = 0, mn = 0;
    values.forEach(function (v) { if (v > mx) mx = v; if (v < mn) mn = v; });
    var top = niceMax(mx), bot = mn < 0 ? -niceMax(-mn) : 0;
    if (top === 0 && bot === 0) top = 1;
    return { top: top, bot: bot, range: top - bot };
  }

  // ---- Grouped/single vertical bars (supports negatives) ----
  function bars(container, cfg) {
    clear(container);
    var all = [];
    cfg.series.forEach(function (s) { all = all.concat(s.values); });
    if (all.every(function (v) { return !v; })) { emptyMsg(container, cfg.empty); return; }

    if (cfg.series.length > 1) container.appendChild(legend(cfg.series));

    var W = Math.max(container.clientWidth || 320, 280), H = cfg.height || 240;
    var padL = 46, padR = 14, padT = 12, padB = 26;
    var plotW = W - padL - padR, plotH = H - padT - padB;
    var sc = scale(all);
    function Y(v) { return padT + plotH - (v - sc.bot) / sc.range * plotH; }

    var s = svg("svg", { width: W, height: H, viewBox: "0 0 " + W + " " + H, class: "chart-svg", role: "img" });

    var ticks = 4;
    for (var i = 0; i <= ticks; i++) {
      var val = sc.bot + (sc.range) * i / ticks;
      var y = Y(val);
      s.appendChild(svg("line", { x1: padL, y1: y, x2: W - padR, y2: y, class: "chart-grid" }));
      var t = svg("text", { x: padL - 6, y: y + 3, class: "chart-ytick", "text-anchor": "end" });
      t.textContent = compact(val); s.appendChild(t);
    }
    var zeroY = Y(0);
    s.appendChild(svg("line", { x1: padL, y1: zeroY, x2: W - padR, y2: zeroY, class: "chart-axis" }));

    var n = cfg.labels.length, ns = cfg.series.length;
    var groupW = plotW / n, innerPad = groupW * 0.16;
    var barSpace = groupW - innerPad * 2;
    var bw = Math.max(2, (barSpace - (ns - 1) * 2) / ns);

    cfg.labels.forEach(function (lab, gi) {
      var gx = padL + gi * groupW + innerPad;
      cfg.series.forEach(function (ser, si) {
        var v = ser.values[gi] || 0;
        if (!v) return;
        var yTop = Y(Math.max(v, 0)), h = v >= 0 ? (zeroY - Y(v)) : -(Y(v) - zeroY);
        var x = gx + si * (bw + 2);
        var p = svg("path", { d: roundedTop(x, v >= 0 ? Y(v) : zeroY, bw, v >= 0 ? (zeroY - Y(v)) : (Y(v) - zeroY), 4), class: "chart-bar" });
        p.style.fill = "var(" + ser.colorVar + ")";
        var tt = svg("title"); tt.textContent = (ns > 1 ? ser.name + " · " : "") + lab + ": " + rupiah(v);
        p.appendChild(tt);
        s.appendChild(p);
      });
      var xt = svg("text", { x: padL + gi * groupW + groupW / 2, y: H - 8, class: "chart-xtick", "text-anchor": "middle" });
      xt.textContent = lab; s.appendChild(xt);
    });
    container.appendChild(s);
  }

  // ---- Line/area (single series, supports negatives) ----
  function area(container, cfg) {
    clear(container);
    if (cfg.values.every(function (v) { return !v; })) { emptyMsg(container, cfg.empty); return; }
    var W = Math.max(container.clientWidth || 320, 280), H = cfg.height || 240;
    var padL = 46, padR = 14, padT = 12, padB = 26;
    var plotW = W - padL - padR, plotH = H - padT - padB;
    var sc = scale(cfg.values);
    var color = cfg.colorVar || "--ser-1";
    function X(i) { return cfg.values.length <= 1 ? padL + plotW / 2 : padL + i / (cfg.values.length - 1) * plotW; }
    function Y(v) { return padT + plotH - (v - sc.bot) / sc.range * plotH; }

    var s = svg("svg", { width: W, height: H, viewBox: "0 0 " + W + " " + H, class: "chart-svg", role: "img" });

    var ticks = 4;
    for (var i = 0; i <= ticks; i++) {
      var val = sc.bot + sc.range * i / ticks, y = Y(val);
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

    var line = "", areaP = "";
    cfg.values.forEach(function (v, i) {
      line += (i ? " L" : "M") + X(i) + "," + Y(v);
    });
    areaP = line + " L" + X(cfg.values.length - 1) + "," + zeroY + " L" + X(0) + "," + zeroY + " Z";
    var ap = svg("path", { d: areaP, class: "chart-area" }); ap.style.fill = "url(#" + gid + ")"; s.appendChild(ap);
    var lp = svg("path", { d: line, class: "chart-line" }); lp.style.stroke = "var(" + color + ")"; s.appendChild(lp);

    cfg.values.forEach(function (v, i) {
      if (v === 0 && cfg.values.length > 1) return;
      var dot = svg("circle", { cx: X(i), cy: Y(v), r: 3.5, class: "chart-dot" });
      dot.style.fill = "var(" + color + ")";
      var tt = svg("title"); tt.textContent = cfg.labels[i] + ": " + rupiah(v); dot.appendChild(tt);
      s.appendChild(dot);
    });
    cfg.labels.forEach(function (lab, i) {
      var xt = svg("text", { x: X(i), y: H - 8, class: "chart-xtick", "text-anchor": "middle" });
      xt.textContent = lab; s.appendChild(xt);
    });
    container.appendChild(s);
  }

  // ---- Horizontal ranked bars (single hue, label above) ----
  function hbars(container, cfg) {
    clear(container);
    var items = cfg.items.filter(function (i) { return i.value > 0; })
      .sort(function (a, b) { return b.value - a.value; });
    if (cfg.limit) items = items.slice(0, cfg.limit);
    if (!items.length) { emptyMsg(container, cfg.empty); return; }
    var maxV = Math.max.apply(null, items.map(function (i) { return i.value; }));
    var color = cfg.colorVar || "--ser-1";
    var W = Math.max(container.clientWidth || 320, 260);
    var rowH = 20, labelH = 18, gap = 14, padR = 4;
    var H = items.length * (rowH + labelH + gap);
    var s = svg("svg", { width: W, height: H, viewBox: "0 0 " + W + " " + H, class: "chart-svg", role: "img" });

    items.forEach(function (it, idx) {
      var top = idx * (rowH + labelH + gap);
      var lab = svg("text", { x: 0, y: top + 13, class: "chart-hlabel" });
      lab.textContent = it.label; s.appendChild(lab);
      var val = svg("text", { x: W - padR, y: top + 13, class: "chart-vlabel", "text-anchor": "end" });
      val.textContent = compact(it.value); s.appendChild(val);
      var by = top + labelH;
      s.appendChild(svg("rect", { x: 0, y: by, width: W - padR, height: rowH, rx: 6, class: "chart-track" }));
      var w = Math.max(3, it.value / maxV * (W - padR));
      var bar = svg("rect", { x: 0, y: by, width: w, height: rowH, rx: 6, class: "chart-bar" });
      bar.style.fill = "var(" + color + ")";
      var tt = svg("title"); tt.textContent = it.label + ": " + rupiah(it.value); bar.appendChild(tt);
      s.appendChild(bar);
    });
    container.appendChild(s);
  }

  // ---- Donut (part-of-whole, labeled) ----
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
    var a0 = -Math.PI / 2, gap = items.length > 1 ? 0.03 : 0;
    items.forEach(function (it) {
      var frac = it.value / total, a1 = a0 + frac * 2 * Math.PI;
      var p = svg("path", { d: arc(cx, cy, R, r, a0 + gap / 2, a1 - gap / 2), class: "chart-arc" });
      p.style.fill = "var(" + it.colorVar + ")";
      var tt = svg("title"); tt.textContent = it.label + ": " + rupiah(it.value) + " (" + Math.round(frac * 100) + "%)";
      p.appendChild(tt); s.appendChild(p);
      a0 = a1;
    });
    var ct = svg("text", { x: cx, y: cy - 2, class: "chart-donut-total", "text-anchor": "middle" });
    ct.textContent = compact(total); s.appendChild(ct);
    var cl = svg("text", { x: cx, y: cy + 14, class: "chart-donut-sub", "text-anchor": "middle" });
    cl.textContent = cfg.centerLabel || "Total"; s.appendChild(cl);
    wrap.appendChild(s);

    var leg = document.createElement("div");
    leg.className = "chart-legend chart-legend-col";
    items.forEach(function (it) {
      var row = document.createElement("span");
      row.className = "chart-legend-item";
      var sw = document.createElement("span");
      sw.className = "chart-swatch"; sw.style.background = "var(" + it.colorVar + ")";
      var txt = document.createElement("span");
      txt.className = "chart-legend-txt";
      txt.innerHTML = "<span class='chart-legend-name'>" + it.label + "</span>" +
        "<span class='chart-legend-val'>" + rupiah(it.value) + " · " + Math.round(it.value / total * 100) + "%</span>";
      row.appendChild(sw); row.appendChild(txt); leg.appendChild(row);
    });
    wrap.appendChild(leg);
    container.appendChild(wrap);
  }

  window.Charts = { bars: bars, area: area, hbars: hbars, donut: donut, rupiah: rupiah };
})();
