/* FinanceLiveCraft — motion layer (GSAP).
 *
 * Runs only when a view is entered (menu switch / first load), never on
 * every re-render. Skipped entirely when the user prefers reduced motion or
 * when GSAP failed to load, so content is always visible without it.
 * Timings follow UI guidance: ~150–500ms, ease-out, short staggers.
 */
(function () {
  "use strict";

  var mq = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  function enabled() { return !!window.gsap && !(mq && mq.matches); }

  function visible(nodes) {
    return Array.prototype.filter.call(nodes, function (n) { return n.offsetParent !== null; });
  }

  // Cards and panels rise in with a short stagger.
  function enter(root) {
    if (!enabled() || !root) return;
    var items = visible(root.querySelectorAll(".summary .card, .expense-summary .card, .panel"));
    if (!items.length) return;
    gsap.fromTo(items, { autoAlpha: 0, y: 14 }, {
      autoAlpha: 1, y: 0, duration: 0.32, ease: "power2.out",
      stagger: { amount: Math.min(0.35, items.length * 0.03) },
      clearProps: "transform,opacity,visibility"
    });
  }

  // Chart marks grow from their baseline / draw in.
  function charts(root) {
    if (!enabled() || !root) return;
    var bars = visible(root.querySelectorAll(".chart-bar"));
    if (bars.length) {
      gsap.from(bars, { scaleY: 0, transformOrigin: "50% 100%", duration: 0.5, ease: "power3.out",
        stagger: { amount: 0.3 }, clearProps: "transform" });
    }
    var hbars = visible(root.querySelectorAll(".chart-hbar"));
    if (hbars.length) {
      gsap.from(hbars, { scaleX: 0, transformOrigin: "0% 50%", duration: 0.55, ease: "power3.out",
        stagger: 0.05, clearProps: "transform" });
    }
    visible(root.querySelectorAll(".chart-line")).forEach(function (path) {
      var len = path.getTotalLength ? path.getTotalLength() : 0;
      if (!len) return;
      gsap.fromTo(path, { strokeDasharray: len, strokeDashoffset: len },
        { strokeDashoffset: 0, duration: 0.8, ease: "power2.out", clearProps: "strokeDasharray,strokeDashoffset" });
    });
    var areas = visible(root.querySelectorAll(".chart-area, .chart-maxlabel"));
    if (areas.length) gsap.from(areas, { opacity: 0, duration: 0.5, delay: 0.25, clearProps: "opacity" });
    var arcs = visible(root.querySelectorAll(".chart-arc"));
    if (arcs.length) {
      gsap.from(arcs, { opacity: 0, scale: 0.88, svgOrigin: "95 95", duration: 0.45, ease: "back.out(1.4)",
        stagger: 0.05, clearProps: "transform,opacity" });
    }
  }

  // KPI numbers count up to their value. Stops if the app rewrites the text
  // meanwhile (e.g. a realtime update), so it never shows a stale number.
  var RUPIAH = /^Rp(-?)([\d.]+)$/;
  var PLAIN = /^\d+$/;
  function countUp(nodes) {
    if (!enabled() || !nodes) return;
    Array.prototype.forEach.call(nodes, function (el) {
      var text = (el.textContent || "").trim();
      var m = text.match(RUPIAH), target, fmt;
      if (m) {
        target = parseInt(m[2].replace(/\./g, ""), 10) * (m[1] ? -1 : 1);
        fmt = function (v) { return "Rp" + Math.round(v).toLocaleString("id-ID"); };
      } else if (PLAIN.test(text)) {
        target = parseInt(text, 10);
        fmt = function (v) { return String(Math.round(v)); };
      } else {
        return;
      }
      if (!target) return;
      if (el._countTween) el._countTween.kill();
      var state = { v: 0 }, last = fmt(0);
      el.textContent = last;
      el._countTween = gsap.to(state, {
        v: target, duration: 0.7, ease: "power2.out",
        onUpdate: function () {
          if (el.textContent !== last) { el._countTween.kill(); return; } // rewritten elsewhere
          last = fmt(state.v);
          el.textContent = last;
        },
        onComplete: function () { if (el.textContent === last) el.textContent = text; }
      });
    });
  }

  window.Motion = { enter: enter, charts: charts, countUp: countUp, enabled: enabled };
})();
