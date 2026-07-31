/* FinanceLiveCraft — lapisan penyimpanan cloud (Supabase).
 *
 * Menyimpan tiap dataset sebagai satu baris JSON di tabel `app_data`
 * (key = "transactions" | "assets" | "emergency" | "profitshares").
 * Data dibagikan ke semua pengguna yang login (satu workspace bersama).
 *
 * Bila Supabase belum dikonfigurasi atau SDK gagal dimuat, isConfigured()
 * mengembalikan false dan aplikasi memakai localStorage seperti biasa.
 */
(function () {
  "use strict";

  var URL = window.SUPABASE_URL;
  var KEY = window.SUPABASE_ANON_KEY;
  var hasCreds = URL && KEY &&
    URL.indexOf("YOUR_") === -1 && KEY.indexOf("YOUR_") === -1;
  var sdk = window.supabase && typeof window.supabase.createClient === "function";
  var client = (hasCreds && sdk) ? window.supabase.createClient(URL, KEY) : null;

  function isConfigured() { return !!client; }

  // ---- Auth ----
  function getSession() {
    return client.auth.getSession().then(function (r) {
      return r.data ? r.data.session : null;
    });
  }
  function signIn(email, password) {
    return client.auth.signInWithPassword({ email: email, password: password })
      .then(function (r) { if (r.error) throw r.error; return r.data; });
  }
  function signUp(email, password) {
    return client.auth.signUp({ email: email, password: password })
      .then(function (r) { if (r.error) throw r.error; return r.data; });
  }
  function signOut() { return client.auth.signOut(); }
  function onAuth(cb) {
    client.auth.onAuthStateChange(function (_event, session) { cb(session); });
  }

  // ---- Data (satu dokumen JSON per key) ----
  function loadAll() {
    return client.from("app_data").select("key,data").then(function (res) {
      if (res.error) throw res.error;
      var out = {};
      (res.data || []).forEach(function (row) { out[row.key] = row.data; });
      return out;
    });
  }
  function saveDoc(key, value) {
    return client.from("app_data")
      .upsert({ key: key, data: value, updated_at: new Date().toISOString() })
      .then(function (res) { if (res.error) throw res.error; });
  }

  // ---- Realtime (perubahan dari pengguna lain) ----
  function subscribe(onDoc) {
    try {
      return client.channel("app_data_changes")
        .on("postgres_changes",
          { event: "*", schema: "public", table: "app_data" },
          function (payload) {
            var row = payload.new;
            if (row && row.key) onDoc(row.key, row.data);
          })
        .subscribe();
    } catch (e) { return null; }
  }

  window.Cloud = {
    isConfigured: isConfigured,
    getSession: getSession,
    signIn: signIn,
    signUp: signUp,
    signOut: signOut,
    onAuth: onAuth,
    loadAll: loadAll,
    saveDoc: saveDoc,
    subscribe: subscribe
  };
})();
