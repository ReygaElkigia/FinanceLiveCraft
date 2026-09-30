/* FinanceLiveCraft — latar 3D halus untuk layar login (three.js).
 *
 * three.js hanya dimuat saat layar login tampil (tidak membebani dashboard),
 * dihentikan & dibersihkan setelah login, berhenti saat tab tersembunyi,
 * dan dilewati bila pengguna memilih "kurangi gerakan" atau WebGL gagal.
 */
(function () {
  "use strict";

  var THREE_URL = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
  var mq = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  var loading = false, running = false;
  var host, canvas, renderer, scene, camera, knot, points, raf;

  function load(cb) {
    if (window.THREE) return cb();
    if (loading) return;
    loading = true;
    var s = document.createElement("script");
    s.src = THREE_URL;
    s.async = true;
    s.onload = function () { loading = false; cb(); };
    s.onerror = function () { loading = false; };
    document.head.appendChild(s);
  }

  function resize() {
    if (!renderer || !host) return;
    var w = host.clientWidth || window.innerWidth, h = host.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    // Keep the shape clear of the centred login card on narrow screens
    knot.position.x = w < 700 ? 0 : 3.6;
    knot.position.y = w < 700 ? 2.6 : 0.3;
  }

  function loop() {
    if (!running) return;
    raf = requestAnimationFrame(loop);
    if (document.hidden) return;
    knot.rotation.x += 0.0018;
    knot.rotation.y += 0.0026;
    points.rotation.y += 0.0005;
    points.rotation.x += 0.0002;
    renderer.render(scene, camera);
  }

  function init() {
    if (running || !host || host.hidden) return;
    try {
      canvas = document.createElement("canvas");
      canvas.className = "auth-bg";
      canvas.setAttribute("aria-hidden", "true");
      host.insertBefore(canvas, host.firstChild);
      renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    } catch (e) {
      if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
      canvas = null; renderer = null;
      return; // No WebGL: the gradient background stays as-is.
    }
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
    camera.position.z = 10;

    knot = new THREE.Mesh(
      new THREE.TorusKnotGeometry(2.1, 0.55, 140, 14),
      new THREE.MeshBasicMaterial({ color: 0x23b37f, wireframe: true, transparent: true, opacity: 0.22 })
    );
    scene.add(knot);

    var n = 480, pos = new Float32Array(n * 3);
    for (var i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 24;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 14;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 8;
    }
    var pg = new THREE.BufferGeometry();
    pg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    points = new THREE.Points(pg, new THREE.PointsMaterial({ color: 0xf5a623, size: 0.05, transparent: true, opacity: 0.7 }));
    scene.add(points);

    running = true;
    resize();
    window.addEventListener("resize", resize);
    loop();
  }

  function start(container) {
    if (mq && mq.matches) return;
    host = container;
    load(init);
  }

  function stop() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    window.removeEventListener("resize", resize);
    if (knot) { knot.geometry.dispose(); knot.material.dispose(); }
    if (points) { points.geometry.dispose(); points.material.dispose(); }
    if (renderer) renderer.dispose();
    if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
    canvas = renderer = scene = camera = knot = points = null;
  }

  window.AuthBg = { start: start, stop: stop };
})();
