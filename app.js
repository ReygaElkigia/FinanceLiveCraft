/* FinanceLiveCraft — Pencatatan Cashflow
 * Data disimpan di localStorage. Tanpa backend.
 */
(function () {
  "use strict";

  var STORAGE_KEY = "financelivecraft.transactions.v1";
  var ASSET_KEY = "financelivecraft.assets.v1";
  var EMERGENCY_KEY = "financelivecraft.emergency.v1";
  var OPENING_KEY = "financelivecraft.opening.v1";

  var MONTHS_FULL = ["Januari","Februari","Maret","April","Mei","Juni","Juli",
    "Agustus","September","Oktober","November","Desember"];

  // Kode keterangan yang tersedia (dengan label untuk membantu pengguna).
  var CODES = [
    { code: "ADM",  label: "Admin / Biaya Bank" },
    { code: "ADS",  label: "Iklan / Ads" },
    { code: "AST",  label: "Aset / Perlengkapan" },
    { code: "CMS",  label: "Komisi" },
    { code: "DP",   label: "INTHEBOX DP (Penjualan)" },
    { code: "EAT",  label: "Makan / Konsumsi" },
    { code: "GA",   label: "Gaji Admin & Co Host" },
    { code: "GCC",  label: "Gaji Editor / Content Creator" },
    { code: "GH",   label: "Gaji Host Livecraft" },
    { code: "HMS",  label: "Gaji Host Mamah Salma" },
    { code: "GO",   label: "Gaji Owner" },
    { code: "HTB",  label: "Hutang Bank / Pinjaman" },
    { code: "INT",  label: "Internet" },
    { code: "KMS",  label: "Komisi Mamah Salma (Pendapatan)" },
    { code: "KRS",  label: "Komisi RB & SK (Pendapatan)" },
    { code: "OEX",  label: "Operasional Lain" },
    { code: "PLC",  label: "Income Paket LC (Pendapatan)" },
    { code: "PLN",  label: "Listrik / PLN" },
    { code: "RMH",  label: "Rumah / Sewa" },
    { code: "SHL",  label: "Beban Sheila" },
    { code: "SHM",  label: "Saham / Investasi" },
    { code: "SOA",  label: "Sale of Asset (Penjualan Aset)" },
    { code: "TRAN", label: "Transportasi" }
  ];

  // Kode lama yang sudah diganti. Transaksi lama otomatis dipindah ke kode baru
  // saat data dimuat (lokal maupun cloud), lalu disimpan kembali.
  var CODE_RENAMES = { NM: "PLC", NC: "KRS", INC: "KMS" };
  function migrateCodes(list) {
    var changed = 0;
    (list || []).forEach(function (t) {
      if (t && CODE_RENAMES[t.kode]) { t.kode = CODE_RENAMES[t.kode]; changed++; }
    });
    return changed;
  }

  var CODE_LABEL = {};
  CODES.forEach(function (c) { CODE_LABEL[c.code] = c.label; });

  // Struktur Expense Log (mengikuti spreadsheet EXPENSE CALCULATION).
  // Setiap baris memakai kode dari menu Cash Flow; kode INC (income) tidak
  // termasuk karena bukan pengeluaran. Nilai diambil otomatis dari Cash Out.
  var EXPENSE_GROUPS = [
    {
      title: "Salary & Wages Expense",
      rows: [
        { code: "GH",  label: "Host Livecraft (Live Streamer)" },
        { code: "HMS", label: "Host Mamah Salma" },
        { code: "SHL", label: "Beban Sheila" },
        { code: "GA",  label: "Gaji Admin & Co Host" },
        { code: "GCC", label: "Editor / Content Creator" },
        { code: "GO",  label: "Gaji Owner", excluded: true },
        { code: "SHM", label: "Investasi" }
      ]
    },
    {
      title: "Marketing Expense",
      rows: [
        { code: "ADS", label: "Iklan / Ads" }
      ]
    },
    {
      title: "General & Administrative Expense",
      rows: [
        { code: "ADM",  label: "Admin / Biaya Bank" },
        { code: "TRAN", label: "Transportasi" },
        { code: "AST",  label: "Belanja Perlengkapan" },
        { code: "EAT",  label: "Biaya Makan" },
        { code: "PLN",  label: "Listrik / Air" },
        { code: "INT",  label: "Internet" },
        { code: "CMS",  label: "Komisi" },
        { code: "OEX",  label: "Other Expense" }
      ]
    },
    {
      title: "Other Expense",
      rows: [
        { code: "RMH", label: "Apartemen / Rumah" }
      ]
    }
  ];

  // Struktur Sales Log (mengikuti spreadsheet SALES LOG). Nilai diambil
  // otomatis dari transaksi Cash In pada kode-kode penjualan di bawah.
  var SALES_GROUPS = [
    {
      title: "Cash Sales",
      rows: [
        { code: "PLC", label: "Income Paket LC" },
        { code: "KRS", label: "Komisi RB & SK" },
        { code: "KMS", label: "Komisi Mamah Salma" },
        { code: "DP",  label: "INTHEBOX DP" }
      ]
    },
    {
      title: "Cash Received from Non-Sales Activities",
      rows: [
        { code: "SOA", label: "Sale of Asset" },
        { code: "HTB", label: "Pengajuan Hutang ke Bank" }
      ]
    }
  ];

  // Kumpulan kode per menu (agar total baris & total kolom selalu konsisten).
  function flattenCodes(groups) {
    var out = [];
    // Baris "excluded" (mis. GO) tetap ditampilkan tapi tidak ikut dijumlahkan.
    groups.forEach(function (g) { g.rows.forEach(function (r) { if (!r.excluded) out.push(r.code); }); });
    return out;
  }
  var EXPENSE_CODES = flattenCodes(EXPENSE_GROUPS);
  var EXCLUDED_EXPENSE_CODES = [];
  EXPENSE_GROUPS.forEach(function (g) {
    g.rows.forEach(function (r) { if (r.excluded) EXCLUDED_EXPENSE_CODES.push(r.code); });
  });
  var SALES_CODES = flattenCodes(SALES_GROUPS);

  // Saldo awal (modal awal) per akun.
  function normalizeOpening(d) {
    d = d || {};
    return { Livecraft: Number(d.Livecraft) || 0, Keranjang: Number(d.Keranjang) || 0 };
  }
  function loadOpening() {
    try {
      var raw = localStorage.getItem(OPENING_KEY);
      return normalizeOpening(raw ? JSON.parse(raw) : null);
    } catch (e) { return normalizeOpening(null); }
  }
  function saveOpening() {
    if (useCloud) { window.Cloud.saveDoc("opening", openingBalance).catch(cloudError); return; }
    try { localStorage.setItem(OPENING_KEY, JSON.stringify(openingBalance)); }
    catch (e) { alert("Gagal menyimpan saldo awal."); }
  }
  var openingBalance = loadOpening();

  // Estimasi alokasi Laba Kotor (dari "Hitungan LC"): pos + persen, dan
  // jumlah orang untuk membagi pos "Gaji".
  var ALLOC_KEY = "financelivecraft.allocation.v1";
  var DEFAULT_ALLOC = {
    persons: 3,
    items: [
      { name: "Beban operasional", pct: 0.40 },
      { name: "Cash pegangan",     pct: 0.05 },
      { name: "SHU",               pct: 0.05 },
      { name: "Ads",               pct: 0.35 },
      { name: "Gaji",              pct: 0.15 }
    ]
  };
  function normalizeAlloc(d) {
    if (!d || !Array.isArray(d.items) || !d.items.length) return JSON.parse(JSON.stringify(DEFAULT_ALLOC));
    return {
      persons: Math.max(1, parseInt(d.persons, 10) || DEFAULT_ALLOC.persons),
      items: d.items.map(function (i) { return { name: String(i.name || ""), pct: Number(i.pct) || 0 }; })
    };
  }
  function loadAlloc() {
    try {
      var raw = localStorage.getItem(ALLOC_KEY);
      return normalizeAlloc(raw ? JSON.parse(raw) : null);
    } catch (e) { return normalizeAlloc(null); }
  }
  function saveAlloc() {
    if (useCloud) { window.Cloud.saveDoc("allocation", allocation).catch(cloudError); return; }
    try { localStorage.setItem(ALLOC_KEY, JSON.stringify(allocation)); }
    catch (e) { alert("Gagal menyimpan alokasi."); }
  }
  var allocation = loadAlloc();

  var MONTHS_SHORT = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Ags","Sep","Okt","Nov","Des"];

  // Colgroup dengan lebar tetap agar kolom bulan tidak bergeser saat ada nilai.
  var MATRIX_COLGROUP = "<colgroup><col class='ec-cat'/>" +
    new Array(12).fill("<col class='ec-month'/>").join("") +
    "<col class='ec-total'/></colgroup>";

  // ---- State ----
  var transactions = load();
  var assets = loadAssets();

  // ---- Elements ----
  var el = {
    form: document.getElementById("entryForm"),
    editId: document.getElementById("editId"),
    tanggal: document.getElementById("tanggal"),
    akun: document.getElementById("akun"),
    kode: document.getElementById("kode"),
    keterangan: document.getElementById("keterangan"),
    cashOut: document.getElementById("cashOut"),
    cashIn: document.getElementById("cashIn"),
    submitBtn: document.getElementById("submitBtn"),
    cancelEdit: document.getElementById("cancelEdit"),
    formTitle: document.getElementById("formTitle"),
    txBody: document.getElementById("txBody"),
    emptyState: document.getElementById("emptyState"),
    search: document.getElementById("search"),
    filterAkun: document.getElementById("filterAkun"),
    filterKode: document.getElementById("filterKode"),
    filterMonth: document.getElementById("filterMonth"),
    exportBtn: document.getElementById("exportBtn"),
    totalIn: document.getElementById("totalIn"),
    totalOut: document.getElementById("totalOut"),
    balance: document.getElementById("balance"),
    txCount: document.getElementById("txCount"),
    liveSaldo: document.getElementById("liveSaldo"),
    liveIn: document.getElementById("liveIn"),
    liveOut: document.getElementById("liveOut"),
    keranjangSaldo: document.getElementById("keranjangSaldo"),
    keranjangIn: document.getElementById("keranjangIn"),
    keranjangOut: document.getElementById("keranjangOut"),
    footIn: document.getElementById("footIn"),
    footOut: document.getElementById("footOut"),
    // Dana Darurat
    emgToggle: document.getElementById("emgToggle"),
    emgForm: document.getElementById("emgForm"),
    emgAmount: document.getElementById("emgAmount"),
    emgDate: document.getElementById("emgDate"),
    emgCancel: document.getElementById("emgCancel"),
    emgReset: document.getElementById("emgReset"),
    emgDisplay: document.getElementById("emgDisplay"),
    // Saldo Awal
    openingToggle: document.getElementById("openingToggle"),
    openingForm: document.getElementById("openingForm"),
    openingLive: document.getElementById("openingLive"),
    openingKeranjang: document.getElementById("openingKeranjang"),
    openingCancel: document.getElementById("openingCancel"),
    openingNote: document.getElementById("openingNote"),
    // Expense Log
    navTabs: document.querySelectorAll(".nav-tab"),
    viewCashflow: document.getElementById("view-cashflow"),
    viewExpense: document.getElementById("view-expense"),
    expenseYear: document.getElementById("expenseYear"),
    expenseWrap: document.getElementById("expenseWrap"),
    expenseEmpty: document.getElementById("expenseEmpty"),
    expenseSummary: document.getElementById("expenseSummary"),
    exportExpenseBtn: document.getElementById("exportExpenseBtn"),
    // Asset
    viewAsset: document.getElementById("view-asset"),
    assetForm: document.getElementById("assetForm"),
    assetEditId: document.getElementById("assetEditId"),
    assetNama: document.getElementById("assetNama"),
    assetHarga: document.getElementById("assetHarga"),
    assetQty: document.getElementById("assetQty"),
    assetTotalInput: document.getElementById("assetTotalInput"),
    assetPembayaran: document.getElementById("assetPembayaran"),
    assetBulan: document.getElementById("assetBulan"),
    assetSubmitBtn: document.getElementById("assetSubmitBtn"),
    assetCancelEdit: document.getElementById("assetCancelEdit"),
    assetFormTitle: document.getElementById("assetFormTitle"),
    assetBody: document.getElementById("assetBody"),
    assetEmpty: document.getElementById("assetEmpty"),
    assetSearch: document.getElementById("assetSearch"),
    assetFilterBulan: document.getElementById("assetFilterBulan"),
    assetFilterPembayaran: document.getElementById("assetFilterPembayaran"),
    exportAssetBtn: document.getElementById("exportAssetBtn"),
    assetImportBtn: document.getElementById("assetImportBtn"),
    assetImport: document.getElementById("assetImport"),
    assetImportText: document.getElementById("assetImportText"),
    assetImportRun: document.getElementById("assetImportRun"),
    assetImportCancel: document.getElementById("assetImportCancel"),
    assetImportInfo: document.getElementById("assetImportInfo"),
    assetTotal: document.getElementById("assetTotal"),
    assetCount: document.getElementById("assetCount"),
    assetDebt: document.getElementById("assetDebt"),
    assetFootTotal: document.getElementById("assetFootTotal"),
    // Investment
    viewInvest: document.getElementById("view-invest"),
    investYear: document.getElementById("investYear"),
    investBody: document.getElementById("investBody"),
    investEmpty: document.getElementById("investEmpty"),
    investIn: document.getElementById("investIn"),
    investOut: document.getElementById("investOut"),
    investNet: document.getElementById("investNet"),
    investFootIn: document.getElementById("investFootIn"),
    investFootOut: document.getElementById("investFootOut"),
    investFootNet: document.getElementById("investFootNet"),
    exportInvestBtn: document.getElementById("exportInvestBtn"),
    // Sales
    viewSales: document.getElementById("view-sales"),
    salesYear: document.getElementById("salesYear"),
    salesWrap: document.getElementById("salesWrap"),
    salesEmpty: document.getElementById("salesEmpty"),
    salesSummary: document.getElementById("salesSummary"),
    exportSalesBtn: document.getElementById("exportSalesBtn"),
    // Summary
    viewSummary: document.getElementById("view-summary"),
    summaryYear: document.getElementById("summaryYear"),
    // Pembagian laba
    // Laba Rugi + Alokasi
    summaryPeriod: document.getElementById("summaryPeriod"),
    lcSheet: document.getElementById("lcSheet"),
    splitYear: document.getElementById("splitYear"),
    splitCards: document.getElementById("splitCards"),
    splitTable: document.getElementById("splitTable"),
    exportSheetBtn: document.getElementById("exportSheetBtn"),
    allocEditBtn: document.getElementById("allocEditBtn"),
    allocEditor: document.getElementById("allocEditor"),
    allocRows: document.getElementById("allocRows"),
    allocAdd: document.getElementById("allocAdd"),
    allocPersons: document.getElementById("allocPersons"),
    allocTotal: document.getElementById("allocTotal"),
    allocSave: document.getElementById("allocSave"),
    allocCancel: document.getElementById("allocCancel"),
    allocReset: document.getElementById("allocReset"),
    // Auth / cloud
    userBox: document.getElementById("userBox"),
    userEmail: document.getElementById("userEmail"),
    logoutBtn: document.getElementById("logoutBtn"),
    authGate: document.getElementById("authGate"),
    authLoading: document.getElementById("authLoading"),
    authForm: document.getElementById("authForm"),
    authTitle: document.getElementById("authTitle"),
    authSub: document.getElementById("authSub"),
    authEmail: document.getElementById("authEmail"),
    authPassword: document.getElementById("authPassword"),
    authError: document.getElementById("authError"),
    authSubmit: document.getElementById("authSubmit"),
    authToggle: document.getElementById("authToggle"),
    authToggleWrap: document.getElementById("authToggleWrap"),
    authNotConfigured: document.getElementById("authNotConfigured")
  };

  var useCloud = !!(window.Cloud && window.Cloud.isConfigured());
  function cloudError(e) {
    console.error(e);
    alert("Gagal menyimpan ke cloud: " + (e && e.message ? e.message : e));
  }

  var INVEST_CODE = "SHM"; // kode investasi di Cash Flow

  // ---- Formatting helpers ----
  function formatRupiah(n) {
    var value = Math.round(Number(n) || 0);
    return "Rp" + value.toLocaleString("id-ID");
  }

  // Parse "Rp1.234.567" / "1.234.567" / "1234567" -> number
  function parseMoney(str) {
    if (typeof str === "number") return str;
    var digits = String(str).replace(/[^\d]/g, "");
    return digits ? parseInt(digits, 10) : 0;
  }

  function formatDate(iso) {
    if (!iso) return "";
    var parts = iso.split("-"); // yyyy-mm-dd
    if (parts.length !== 3) return iso;
    return parts[2] + "/" + parts[1] + "/" + parts[0];
  }

  function monthKey(iso) {
    return iso ? iso.slice(0, 7) : ""; // yyyy-mm
  }

  function monthLabel(key) {
    var names = ["Januari","Februari","Maret","April","Mei","Juni","Juli",
      "Agustus","September","Oktober","November","Desember"];
    var p = key.split("-");
    return names[parseInt(p[1], 10) - 1] + " " + p[0];
  }

  // ---- Storage ----
  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function save() {
    if (useCloud) { window.Cloud.saveDoc("transactions", transactions).catch(cloudError); return; }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
    } catch (e) {
      alert("Gagal menyimpan data ke browser.");
    }
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function loadAssets() {
    try {
      var raw = localStorage.getItem(ASSET_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveAssets() {
    if (useCloud) { window.Cloud.saveDoc("assets", assets).catch(cloudError); return; }
    try {
      localStorage.setItem(ASSET_KEY, JSON.stringify(assets));
    } catch (e) {
      alert("Gagal menyimpan data aset ke browser.");
    }
  }

  // ---- Populate dropdowns ----
  function populateCodes() {
    CODES.forEach(function (c) {
      var o1 = document.createElement("option");
      o1.value = c.code;
      o1.textContent = c.code + " — " + c.label;
      el.kode.appendChild(o1);

      var o2 = document.createElement("option");
      o2.value = c.code;
      o2.textContent = c.code + " — " + c.label;
      el.filterKode.appendChild(o2);
    });
  }

  function populateMonths() {
    var current = el.filterMonth.value;
    var keys = {};
    transactions.forEach(function (t) { keys[monthKey(t.tanggal)] = true; });
    var sorted = Object.keys(keys).filter(Boolean).sort().reverse();

    el.filterMonth.innerHTML = "";
    var allOpt = document.createElement("option");
    allOpt.value = "";
    allOpt.textContent = "Semua Bulan";
    el.filterMonth.appendChild(allOpt);

    sorted.forEach(function (k) {
      var o = document.createElement("option");
      o.value = k;
      o.textContent = monthLabel(k);
      el.filterMonth.appendChild(o);
    });
    // restore selection if still valid
    if (current && sorted.indexOf(current) !== -1) el.filterMonth.value = current;
  }

  // ---- Filtering ----
  function getFiltered() {
    var q = el.search.value.trim().toLowerCase();
    var kode = el.filterKode.value;
    var month = el.filterMonth.value;
    var akun = el.filterAkun.value;

    return transactions.filter(function (t) {
      if (kode && t.kode !== kode) return false;
      if (month && monthKey(t.tanggal) !== month) return false;
      if (akun && (t.akun || "Livecraft") !== akun) return false;
      if (q && t.keterangan.toLowerCase().indexOf(q) === -1) return false;
      return true;
    }).sort(function (a, b) {
      // by date ascending, then by insertion order (id time)
      if (a.tanggal !== b.tanggal) return a.tanggal < b.tanggal ? -1 : 1;
      return a.id < b.id ? -1 : 1;
    });
  }

  // ---- Rendering ----
  function render() {
    populateMonths();
    var rows = getFiltered();

    el.txBody.innerHTML = "";
    var totalIn = 0, totalOut = 0;
    var liveIn = 0, liveOut = 0, kerIn = 0, kerOut = 0;

    rows.forEach(function (t) {
      totalIn += t.cashIn;
      totalOut += t.cashOut;
      var akun = t.akun || "Livecraft";
      if (akun === "Keranjang") { kerIn += t.cashIn; kerOut += t.cashOut; }
      else { liveIn += t.cashIn; liveOut += t.cashOut; }

      var tr = document.createElement("tr");

      var tdDate = document.createElement("td");
      tdDate.className = "col-date";
      tdDate.setAttribute("data-label", "Tanggal");
      tdDate.textContent = formatDate(t.tanggal);

      var tdAkun = document.createElement("td");
      tdAkun.setAttribute("data-label", "Akun");
      var akunBadge = document.createElement("span");
      akunBadge.className = "wallet-badge " + (akun === "Keranjang" ? "wallet-keranjang" : "wallet-live");
      akunBadge.textContent = akun;
      tdAkun.appendChild(akunBadge);

      var tdCode = document.createElement("td");
      tdCode.setAttribute("data-label", "Kode");
      var badge = document.createElement("span");
      var isExcluded = EXCLUDED_EXPENSE_CODES.indexOf(t.kode) !== -1;
      badge.className = "badge" + (isExcluded ? " badge-excluded" : "");
      if (isExcluded) {
        tr.classList.add("tx-excluded");
        tr.title = "Gaji Owner — tercatat di Cash Flow, tidak dihitung sebagai beban";
      }
      badge.textContent = t.kode;
      tdCode.appendChild(badge);

      var tdDesc = document.createElement("td");
      tdDesc.className = "col-desc";
      tdDesc.setAttribute("data-label", "Keterangan");
      tdDesc.textContent = t.keterangan;

      var tdOut = document.createElement("td");
      tdOut.className = "col-num neg";
      tdOut.setAttribute("data-label", "Cash Out");
      tdOut.textContent = t.cashOut ? formatRupiah(t.cashOut) : "";

      var tdIn = document.createElement("td");
      tdIn.className = "col-num pos";
      tdIn.setAttribute("data-label", "Cash In");
      tdIn.textContent = t.cashIn ? formatRupiah(t.cashIn) : "";

      var tdAct = document.createElement("td");
      tdAct.className = "col-actions";
      var editBtn = document.createElement("button");
      editBtn.className = "icon-btn";
      editBtn.type = "button";
      editBtn.title = "Edit";
      editBtn.setAttribute("aria-label", "Edit transaksi");
      editBtn.innerHTML = window.Icons ? Icons.svg("pencil") : "Edit";
      editBtn.addEventListener("click", function () { startEdit(t.id); });
      var delBtn = document.createElement("button");
      delBtn.className = "icon-btn del";
      delBtn.type = "button";
      delBtn.title = "Hapus";
      delBtn.setAttribute("aria-label", "Hapus transaksi");
      delBtn.innerHTML = window.Icons ? Icons.svg("trash") : "Hapus";
      delBtn.addEventListener("click", function () { removeTx(t.id); });
      tdAct.appendChild(editBtn);
      tdAct.appendChild(delBtn);

      tr.appendChild(tdDate);
      tr.appendChild(tdAkun);
      tr.appendChild(tdCode);
      tr.appendChild(tdDesc);
      tr.appendChild(tdOut);
      tr.appendChild(tdIn);
      tr.appendChild(tdAct);
      el.txBody.appendChild(tr);
    });

    el.emptyState.hidden = rows.length !== 0;

    el.footIn.textContent = formatRupiah(totalIn);
    el.footOut.textContent = formatRupiah(totalOut);

    // Summary reflects the current filter for clarity
    el.totalIn.textContent = formatRupiah(totalIn);
    el.totalOut.textContent = formatRupiah(totalOut);
    el.balance.textContent = formatRupiah(totalIn - totalOut);
    el.txCount.textContent = String(rows.length);

    // Saldo per akun (termasuk saldo awal / modal awal)
    var openLive = openingBalance.Livecraft || 0;
    var openKer = openingBalance.Keranjang || 0;
    el.liveIn.textContent = formatRupiah(liveIn);
    el.liveOut.textContent = formatRupiah(liveOut);
    el.liveSaldo.textContent = formatRupiah(openLive + liveIn - liveOut);
    el.keranjangIn.textContent = formatRupiah(kerIn);
    el.keranjangOut.textContent = formatRupiah(kerOut);
    el.keranjangSaldo.textContent = formatRupiah(openKer + kerIn - kerOut);

    // Total saldo = saldo awal + (total cash in - total cash out)
    el.balance.textContent = formatRupiah(openLive + openKer + totalIn - totalOut);

    renderOpeningNote();
    renderEmergency();
    renderSplit();
  }

  // ---- CRUD ----
  function addOrUpdate(data) {
    var id = el.editId.value;
    if (id) {
      var idx = transactions.findIndex(function (t) { return t.id === id; });
      if (idx !== -1) {
        transactions[idx] = Object.assign({}, transactions[idx], data);
      }
    } else {
      data.id = uid();
      transactions.push(data);
    }
    save();
    render();
    if (window.Charts) renderCashflowCharts();
  }

  function startEdit(id) {
    var t = transactions.find(function (x) { return x.id === id; });
    if (!t) return;
    el.editId.value = t.id;
    el.tanggal.value = t.tanggal;
    el.akun.value = t.akun || "Livecraft";
    el.kode.value = t.kode;
    el.keterangan.value = t.keterangan;
    el.cashOut.value = t.cashOut ? formatRupiah(t.cashOut) : "";
    el.cashIn.value = t.cashIn ? formatRupiah(t.cashIn) : "";
    el.formTitle.textContent = "Edit Transaksi";
    el.submitBtn.textContent = "Perbarui";
    el.cancelEdit.hidden = false;
    el.tanggal.focus();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetForm() {
    el.form.reset();
    el.editId.value = "";
    el.formTitle.textContent = "Tambah Transaksi";
    el.submitBtn.textContent = "Simpan";
    el.cancelEdit.hidden = true;
    el.tanggal.value = new Date().toISOString().slice(0, 10);
  }

  function removeTx(id) {
    var t = transactions.find(function (x) { return x.id === id; });
    var label = t ? (formatDate(t.tanggal) + " · " + t.keterangan) : "transaksi ini";
    if (!confirm("Hapus " + label + "?")) return;
    transactions = transactions.filter(function (x) { return x.id !== id; });
    save();
    render();
    if (window.Charts) renderCashflowCharts();
  }

  // ---- Export CSV ----
  function exportCSV() {
    var rows = getFiltered();
    if (!rows.length) { alert("Tidak ada data untuk diekspor."); return; }
    var header = ["Tanggal", "Akun", "Kode", "Keterangan", "Cash Out", "Cash In"];
    var lines = [header.join(",")];
    rows.forEach(function (t) {
      var cells = [
        t.tanggal,
        t.akun || "Livecraft",
        t.kode,
        '"' + String(t.keterangan).replace(/"/g, '""') + '"',
        t.cashOut,
        t.cashIn
      ];
      lines.push(cells.join(","));
    });
    var blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "cashflow-" + new Date().toISOString().slice(0, 10) + ".csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ================= SALDO AWAL (Opening Balance) =================
  function renderOpeningNote() {
    var l = openingBalance.Livecraft || 0, k = openingBalance.Keranjang || 0;
    if (l || k) {
      el.openingNote.innerHTML = "Saldo awal — Livecraft <b>" + formatRupiah(l) +
        "</b> · Keranjang <b>" + formatRupiah(k) + "</b>. Total Saldo = Saldo Awal + (Cash In − Cash Out).";
    } else {
      el.openingNote.textContent = "Modal awal sebelum transaksi. Total Saldo = Saldo Awal + (Cash In − Cash Out). Klik Atur untuk mengisi.";
    }
  }
  function openOpeningForm() {
    el.openingLive.value = openingBalance.Livecraft ? formatRupiah(openingBalance.Livecraft) : "";
    el.openingKeranjang.value = openingBalance.Keranjang ? formatRupiah(openingBalance.Keranjang) : "";
    el.openingForm.hidden = false;
    el.openingToggle.hidden = true;
    el.openingLive.focus();
  }
  function closeOpeningForm() {
    el.openingForm.hidden = true;
    el.openingToggle.hidden = false;
  }

  // ================= DANA DARURAT (Emergency Fund) =================

  function loadEmergency() {
    try {
      var raw = localStorage.getItem(EMERGENCY_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }
  function saveEmergency(v) {
    if (useCloud) { window.Cloud.saveDoc("emergency", v).catch(cloudError); return; }
    try { localStorage.setItem(EMERGENCY_KEY, JSON.stringify(v)); }
    catch (e) { alert("Gagal menyimpan dana darurat."); }
  }

  var emergency = loadEmergency();

  // Total Cash Out sejak tanggal mulai (inklusif).
  function emergencyUsed(startDate) {
    var used = 0;
    transactions.forEach(function (t) {
      if (!t.tanggal || t.tanggal < startDate) return;
      used += t.cashOut || 0;
    });
    return used;
  }

  function renderEmergency() {
    if (!emergency || !emergency.amount) {
      el.emgDisplay.innerHTML =
        '<p class="emg-empty">Belum diatur. Klik <strong>Atur</strong> untuk menetapkan dana darurat; sisanya akan otomatis dikurangi Cash Out sejak tanggal yang dipilih.</p>';
      return;
    }
    var amount = emergency.amount;
    var start = emergency.startDate;
    var used = emergencyUsed(start);
    var sisa = amount - used;
    var pct = amount > 0 ? Math.max(0, Math.min(1, sisa / amount)) : 0;

    var state = sisa <= 0 ? "danger" : (sisa / amount < 0.3 ? "warn" : "ok");

    el.emgDisplay.innerHTML =
      '<div class="emg-top">' +
        '<div class="emg-remaining">' +
          '<span class="card-label">Sisa Dana Darurat</span>' +
          '<span class="emg-value emg-' + state + '">' + formatRupiah(sisa) + "</span>" +
        "</div>" +
        '<div class="emg-figs">' +
          '<div><span class="emg-fig-label">Dana Awal</span><span class="emg-fig-val">' + formatRupiah(amount) + "</span></div>" +
          '<div><span class="emg-fig-label">Terpakai (Cash Out)</span><span class="emg-fig-val emg-used">' + formatRupiah(used) + "</span></div>" +
        "</div>" +
      "</div>" +
      '<div class="emg-bar"><div class="emg-bar-fill emg-' + state + '" style="width:' + (pct * 100).toFixed(1) + '%"></div></div>' +
      '<p class="emg-meta">Dihitung dari Cash Out sejak <strong>' + formatDate(start) + "</strong>" +
        (sisa < 0 ? ' · <span class="emg-danger">melebihi dana darurat ' + formatRupiah(-sisa) + "</span>" : "") +
      "</p>";
  }

  function openEmergencyForm() {
    if (emergency) {
      el.emgAmount.value = emergency.amount ? formatRupiah(emergency.amount) : "";
      el.emgDate.value = emergency.startDate || "";
    }
    if (!el.emgDate.value) el.emgDate.value = new Date().toISOString().slice(0, 10);
    el.emgForm.hidden = false;
    el.emgToggle.hidden = true;
    el.emgAmount.focus();
  }
  function closeEmergencyForm() {
    el.emgForm.hidden = true;
    el.emgToggle.hidden = false;
  }

  // ================= EXPENSE LOG =================

  // Semua tahun yang ada di data (untuk dropdown tahun).
  function availableYears() {
    var set = {};
    transactions.forEach(function (t) {
      if (t.cashOut > 0 && t.tanggal) set[t.tanggal.slice(0, 4)] = true;
    });
    var years = Object.keys(set);
    var nowY = String(new Date().getFullYear());
    if (years.indexOf(nowY) === -1) years.push(nowY);
    return years.sort().reverse();
  }

  function populateYears() {
    var years = availableYears();
    var current = el.expenseYear.value;
    el.expenseYear.innerHTML = "";
    years.forEach(function (y) {
      var o = document.createElement("option");
      o.value = y;
      o.textContent = y;
      el.expenseYear.appendChild(o);
    });
    if (current && years.indexOf(current) !== -1) {
      el.expenseYear.value = current;
    } else if (years.indexOf(String(new Date().getFullYear())) !== -1) {
      el.expenseYear.value = String(new Date().getFullYear());
    }
  }

  // Hitung matrix pengeluaran: matrix[code][0..11] = total cash out per bulan.
  function computeExpenseMatrix(year) {
    var matrix = {};
    CODES.forEach(function (c) { matrix[c.code] = new Array(12).fill(0); });
    transactions.forEach(function (t) {
      if (!t.cashOut || t.cashOut <= 0) return;
      if (!t.tanggal || t.tanggal.slice(0, 4) !== year) return;
      var m = parseInt(t.tanggal.slice(5, 7), 10) - 1;
      if (m < 0 || m > 11) return;
      if (!matrix[t.kode]) matrix[t.kode] = new Array(12).fill(0);
      matrix[t.kode][m] += t.cashOut;
    });
    return matrix;
  }

  function renderExpense() {
    populateYears();
    var year = el.expenseYear.value || String(new Date().getFullYear());
    var matrix = computeExpenseMatrix(year);

    // Total per bulan (baris TOTAL OPERATING EXPENSE) & grand total.
    // Hanya kode pengeluaran yang dihitung agar total = jumlah baris tampil.
    var monthTotals = new Array(12).fill(0);
    var grandTotal = 0;
    EXPENSE_CODES.forEach(function (code) {
      var vals = matrix[code] || [];
      for (var m = 0; m < 12; m++) {
        monthTotals[m] += vals[m] || 0;
        grandTotal += vals[m] || 0;
      }
    });

    if (grandTotal === 0) {
      el.expenseWrap.innerHTML = "";
      el.expenseEmpty.hidden = false;
    } else {
      el.expenseEmpty.hidden = true;
      el.expenseWrap.innerHTML = buildExpenseTable(matrix, monthTotals);
    }

    renderExpenseSummary(matrix, monthTotals, grandTotal);
    if (window.Charts) renderExpenseCharts(year, matrix);
  }

  function cell(value) {
    return value ? formatRupiah(value) : "";
  }

  // Pembangun tabel matrix generik (dipakai Expense Log & Sales Log).
  function buildMatrixTable(groups, matrix, monthTotals, opts) {
    var html = '<table class="expense-table ' + (opts.tableClass || "") + '">';
    html += MATRIX_COLGROUP;

    html += "<thead><tr>";
    html += '<th class="exp-cat">' + escapeHtml(opts.catLabel) + "</th>";
    MONTHS_SHORT.forEach(function (m) { html += '<th class="col-num">' + m + "</th>"; });
    html += '<th class="col-num exp-total-col">Total</th>';
    html += "</tr></thead>";

    html += "<tbody>";
    groups.forEach(function (group) {
      html += '<tr class="exp-group"><td colspan="14"><span class="exp-group-title">' + group.title + "</span></td></tr>";
      group.rows.forEach(function (row) {
        var vals = matrix[row.code] || new Array(12).fill(0);
        var rowTotal = vals.reduce(function (a, b) { return a + b; }, 0);
        html += row.excluded ? '<tr class="exp-excluded" title="Dicatat saja — tidak dihitung dalam total">' : "<tr>";
        html += '<td class="exp-cat"><span class="badge' + (row.excluded ? " badge-excluded" : "") + '">' + row.code + "</span> " +
          escapeHtml(row.label) + (row.excluded ? ' <span class="exp-tag">tidak dihitung</span>' : "") + "</td>";
        for (var m = 0; m < 12; m++) {
          html += '<td class="col-num">' + cell(vals[m]) + "</td>";
        }
        html += '<td class="col-num exp-total-col">' + cell(rowTotal) + "</td>";
        html += "</tr>";
      });
    });
    html += "</tbody>";

    var grand = monthTotals.reduce(function (a, b) { return a + b; }, 0);
    html += '<tfoot><tr class="exp-grand ' + (opts.grandClass || "") + '">';
    html += '<td class="exp-cat">' + escapeHtml(opts.totalLabel) + "</td>";
    monthTotals.forEach(function (v) { html += '<td class="col-num">' + cell(v) + "</td>"; });
    html += '<td class="col-num exp-total-col">' + formatRupiah(grand) + "</td>";
    html += "</tr></tfoot>";

    html += "</table>";
    return html;
  }

  function buildExpenseTable(matrix, monthTotals) {
    return buildMatrixTable(EXPENSE_GROUPS, matrix, monthTotals, {
      catLabel: "Kategori Pengeluaran",
      totalLabel: "TOTAL OPERATING EXPENSE"
    });
  }

  function renderExpenseSummary(matrix, monthTotals, grandTotal) {
    // Bulan dengan pengeluaran tertinggi & rata-rata bulan yang ada isinya.
    var activeMonths = monthTotals.filter(function (v) { return v > 0; }).length;
    var avg = activeMonths ? grandTotal / activeMonths : 0;
    var maxIdx = -1, maxVal = 0;
    monthTotals.forEach(function (v, i) { if (v > maxVal) { maxVal = v; maxIdx = i; } });

    var cards = [
      { label: "Total Pengeluaran (Tahun)", value: formatRupiah(grandTotal), cls: "card-out" },
      { label: "Rata-rata / Bulan Aktif", value: formatRupiah(avg), cls: "card-balance" },
      {
        label: "Bulan Tertinggi",
        value: maxIdx >= 0 ? (MONTHS_SHORT[maxIdx] + " · " + formatRupiah(maxVal)) : "-",
        cls: "card-count"
      }
    ];

    el.expenseSummary.innerHTML = cards.map(function (c) {
      return '<div class="card ' + c.cls + '"><div class="card-body">' +
        '<span class="card-label">' + c.label + "</span>" +
        '<span class="card-value">' + c.value + "</span></div></div>";
    }).join("");
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  function exportExpenseCSV() {
    var year = el.expenseYear.value || String(new Date().getFullYear());
    var matrix = computeExpenseMatrix(year);
    var monthTotals = new Array(12).fill(0);
    EXPENSE_CODES.forEach(function (code) {
      var vals = matrix[code] || [];
      for (var m = 0; m < 12; m++) monthTotals[m] += vals[m] || 0;
    });
    if (monthTotals.reduce(function (a, b) { return a + b; }, 0) === 0) {
      alert("Tidak ada pengeluaran untuk diekspor pada tahun " + year + ".");
      return;
    }

    var lines = [];
    lines.push(["Kategori", "Kode"].concat(MONTHS_SHORT).concat(["Total"]).join(","));
    EXPENSE_GROUPS.forEach(function (group) {
      lines.push('"' + group.title + '"');
      group.rows.forEach(function (row) {
        var vals = matrix[row.code] || new Array(12).fill(0);
        var rowTotal = vals.reduce(function (a, b) { return a + b; }, 0);
        lines.push(['"' + row.label + (row.excluded ? " (tidak dihitung)" : "") + '"', row.code].concat(vals).concat([rowTotal]).join(","));
      });
    });
    var grand = monthTotals.reduce(function (a, b) { return a + b; }, 0);
    lines.push(["TOTAL OPERATING EXPENSE", ""].concat(monthTotals).concat([grand]).join(","));

    var blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "expense-log-" + year + ".csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ================= ASSET (Aset Masuk) =================

  function populateAssetSelectors() {
    // Bulan dropdown pada form
    MONTHS_FULL.forEach(function (m) {
      var o = document.createElement("option");
      o.value = m;
      o.textContent = m;
      el.assetBulan.appendChild(o);
    });
    // Default bulan = bulan sekarang
    el.assetBulan.value = MONTHS_FULL[new Date().getMonth()];
  }

  function refreshAssetFilters() {
    // Filter bulan berdasarkan data yang ada, urut sesuai kalender.
    var used = {};
    assets.forEach(function (a) { used[a.bulan] = true; });
    var months = MONTHS_FULL.filter(function (m) { return used[m]; });

    var curBulan = el.assetFilterBulan.value;
    el.assetFilterBulan.innerHTML = '<option value="">Semua Bulan</option>';
    months.forEach(function (m) {
      var o = document.createElement("option");
      o.value = m; o.textContent = m;
      el.assetFilterBulan.appendChild(o);
    });
    if (curBulan && months.indexOf(curBulan) !== -1) el.assetFilterBulan.value = curBulan;
  }

  function assetTotalOf(a) {
    // Total tersimpan; jika kosong, hitung dari harga x qty.
    if (a.total) return a.total;
    return (a.harga || 0) * (a.qty || 0);
  }

  function getFilteredAssets() {
    var q = el.assetSearch.value.trim().toLowerCase();
    var bulan = el.assetFilterBulan.value;
    var bayar = el.assetFilterPembayaran.value;
    return assets.filter(function (a) {
      if (bulan && a.bulan !== bulan) return false;
      if (bayar && a.pembayaran !== bayar) return false;
      if (q && a.nama.toLowerCase().indexOf(q) === -1) return false;
      return true;
    }).sort(function (x, y) {
      var mx = MONTHS_FULL.indexOf(x.bulan), my = MONTHS_FULL.indexOf(y.bulan);
      if (mx !== my) return mx - my;
      return x.id < y.id ? -1 : 1;
    });
  }

  function paymentClass(p) {
    return "pay-" + String(p).toLowerCase().replace(/[^a-z]/g, "");
  }

  function renderAssets() {
    refreshAssetFilters();
    var rows = getFilteredAssets();

    el.assetBody.innerHTML = "";
    var total = 0, debt = 0;

    rows.forEach(function (a) {
      var rowTotal = assetTotalOf(a);
      total += rowTotal;
      if (a.pembayaran === "Hutang") debt += rowTotal;

      var tr = document.createElement("tr");

      var tdNama = document.createElement("td");
      tdNama.className = "col-desc";
      tdNama.setAttribute("data-label", "Nama Barang");
      tdNama.textContent = a.nama;

      var tdHarga = document.createElement("td");
      tdHarga.className = "col-num";
      tdHarga.setAttribute("data-label", "Harga Satuan");
      tdHarga.textContent = a.harga ? formatRupiah(a.harga) : "";

      var tdQty = document.createElement("td");
      tdQty.className = "col-num col-qty";
      tdQty.setAttribute("data-label", "Qty");
      tdQty.textContent = a.qty;

      var tdTotal = document.createElement("td");
      tdTotal.className = "col-num";
      tdTotal.setAttribute("data-label", "Total");
      tdTotal.textContent = formatRupiah(rowTotal);

      var tdBayar = document.createElement("td");
      tdBayar.setAttribute("data-label", "Pembayaran");
      var payBadge = document.createElement("span");
      payBadge.className = "pay-badge " + paymentClass(a.pembayaran);
      payBadge.textContent = a.pembayaran;
      tdBayar.appendChild(payBadge);

      var tdBulan = document.createElement("td");
      tdBulan.setAttribute("data-label", "Bulan");
      tdBulan.textContent = a.bulan;

      var tdAct = document.createElement("td");
      tdAct.className = "col-actions";
      var editBtn = document.createElement("button");
      editBtn.className = "icon-btn";
      editBtn.type = "button";
      editBtn.title = "Edit";
      editBtn.setAttribute("aria-label", "Edit aset");
      editBtn.innerHTML = window.Icons ? Icons.svg("pencil") : "Edit";
      editBtn.addEventListener("click", function () { startEditAsset(a.id); });
      var delBtn = document.createElement("button");
      delBtn.className = "icon-btn del";
      delBtn.type = "button";
      delBtn.title = "Hapus";
      delBtn.setAttribute("aria-label", "Hapus aset");
      delBtn.innerHTML = window.Icons ? Icons.svg("trash") : "Hapus";
      delBtn.addEventListener("click", function () { removeAsset(a.id); });
      tdAct.appendChild(editBtn);
      tdAct.appendChild(delBtn);

      tr.appendChild(tdNama);
      tr.appendChild(tdHarga);
      tr.appendChild(tdQty);
      tr.appendChild(tdTotal);
      tr.appendChild(tdBayar);
      tr.appendChild(tdBulan);
      tr.appendChild(tdAct);
      el.assetBody.appendChild(tr);
    });

    el.assetEmpty.hidden = rows.length !== 0;
    el.assetFootTotal.textContent = formatRupiah(total);
    el.assetTotal.textContent = formatRupiah(total);
    el.assetCount.textContent = String(rows.length);
    el.assetDebt.textContent = formatRupiah(debt);
    if (window.Charts) renderAssetCharts();
  }

  function computeFormTotal() {
    var harga = parseMoney(el.assetHarga.value);
    var qty = parseInt(el.assetQty.value, 10) || 0;
    if (harga) {
      el.assetTotalInput.value = formatRupiah(harga * qty);
    }
  }

  function addOrUpdateAsset(data) {
    var id = el.assetEditId.value;
    if (id) {
      var idx = assets.findIndex(function (a) { return a.id === id; });
      if (idx !== -1) assets[idx] = Object.assign({}, assets[idx], data);
    } else {
      data.id = uid();
      assets.push(data);
    }
    saveAssets();
    renderAssets();
  }

  function startEditAsset(id) {
    var a = assets.find(function (x) { return x.id === id; });
    if (!a) return;
    el.assetEditId.value = a.id;
    el.assetNama.value = a.nama;
    el.assetHarga.value = a.harga ? formatRupiah(a.harga) : "";
    el.assetQty.value = a.qty;
    el.assetTotalInput.value = formatRupiah(assetTotalOf(a));
    el.assetPembayaran.value = a.pembayaran;
    el.assetBulan.value = a.bulan;
    el.assetFormTitle.textContent = "Edit Aset";
    el.assetSubmitBtn.textContent = "Perbarui";
    el.assetCancelEdit.hidden = false;
    el.assetNama.focus();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetAssetForm() {
    el.assetForm.reset();
    el.assetEditId.value = "";
    el.assetQty.value = 1;
    el.assetPembayaran.value = "Hutang";
    el.assetBulan.value = MONTHS_FULL[new Date().getMonth()];
    el.assetFormTitle.textContent = "Tambah Aset";
    el.assetSubmitBtn.textContent = "Simpan";
    el.assetCancelEdit.hidden = true;
  }

  function removeAsset(id) {
    var a = assets.find(function (x) { return x.id === id; });
    if (!confirm("Hapus aset " + (a ? a.nama : "ini") + "?")) return;
    assets = assets.filter(function (x) { return x.id !== id; });
    saveAssets();
    renderAssets();
  }

  // ---- Import aset (tempel TSV dari spreadsheet) ----
  function normalizeBulan(s) {
    s = (s || "").trim();
    if (!s) return "";
    var low = s.toLowerCase();
    for (var i = 0; i < MONTHS_FULL.length; i++) {
      if (low.indexOf(MONTHS_FULL[i].toLowerCase()) === 0) return MONTHS_FULL[i];
    }
    return s;
  }
  function parseAssetsPaste(text) {
    var out = [];
    text.split(/\r?\n/).forEach(function (line) {
      if (!line.trim()) return;
      var c = line.split("\t");
      var nama = (c[0] || "").trim();
      if (!nama) return;
      var harga = parseMoney(c[1] || "");
      var qty = parseInt(String(c[2] || "").replace(/[^\d]/g, ""), 10) || 1;
      var total = parseMoney(c[3] || "");
      if (!total) total = harga * qty;
      var pembayaran = (c[4] || "").trim() || "Hutang";
      var bulan = normalizeBulan(c[5] || "");
      out.push({ id: uid(), nama: nama, harga: harga, qty: qty, total: total, pembayaran: pembayaran, bulan: bulan });
    });
    return out;
  }
  function openAssetImport() {
    el.assetImport.hidden = false;
    el.assetImportBtn.classList.add("is-active-toggle");
    el.assetImportInfo.textContent = "";
    el.assetImportText.focus();
  }
  function closeAssetImport() {
    el.assetImport.hidden = true;
    el.assetImportBtn.classList.remove("is-active-toggle");
  }
  function runAssetImport() {
    var parsed = parseAssetsPaste(el.assetImportText.value);
    if (!parsed.length) {
      alert("Tidak ada data terbaca. Pastikan disalin dari spreadsheet (kolom dipisah TAB).");
      return;
    }
    var totalNilai = parsed.reduce(function (a, b) { return a + assetTotalOf(b); }, 0);
    if (!confirm("Tambahkan " + parsed.length + " aset (total " + formatRupiah(totalNilai) + ")?")) return;
    assets = assets.concat(parsed);
    saveAssets();
    renderAssets();
    el.assetImportInfo.textContent = parsed.length + " aset ditambahkan (" + formatRupiah(totalNilai) + ").";
    el.assetImportText.value = "";
  }

  function exportAssetCSV() {
    var rows = getFilteredAssets();
    if (!rows.length) { alert("Tidak ada aset untuk diekspor."); return; }
    var header = ["Nama Barang", "Harga Satuan", "Qty", "Total", "Pembayaran", "Bulan"];
    var lines = [header.join(",")];
    rows.forEach(function (a) {
      lines.push([
        '"' + String(a.nama).replace(/"/g, '""') + '"',
        a.harga || 0,
        a.qty,
        assetTotalOf(a),
        a.pembayaran,
        a.bulan
      ].join(","));
    });
    var blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = "aset-" + new Date().toISOString().slice(0, 10) + ".csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // ================= INVESTMENT (Investasi) =================

  // Semua transaksi berkode SHM, urut tanggal menaik.
  function getInvestTx() {
    var year = el.investYear.value;
    return transactions.filter(function (t) {
      if (t.kode !== INVEST_CODE) return false;
      if (year && (!t.tanggal || t.tanggal.slice(0, 4) !== year)) return false;
      return true;
    }).sort(function (a, b) {
      if (a.tanggal !== b.tanggal) return a.tanggal < b.tanggal ? -1 : 1;
      return a.id < b.id ? -1 : 1;
    });
  }

  function populateInvestYears() {
    var set = {};
    transactions.forEach(function (t) {
      if (t.kode === INVEST_CODE && t.tanggal) set[t.tanggal.slice(0, 4)] = true;
    });
    var years = Object.keys(set).sort().reverse();
    var current = el.investYear.value;
    el.investYear.innerHTML = '<option value="">Semua Tahun</option>';
    years.forEach(function (y) {
      var o = document.createElement("option");
      o.value = y; o.textContent = y;
      el.investYear.appendChild(o);
    });
    if (current && years.indexOf(current) !== -1) el.investYear.value = current;
  }

  function renderInvest() {
    populateInvestYears();
    var rows = getInvestTx();

    el.investBody.innerHTML = "";
    var totalIn = 0, totalOut = 0, running = 0;

    rows.forEach(function (t) {
      // Setoran = Cash Out (uang masuk investasi); Penarikan = Cash In.
      var setoran = t.cashOut || 0;
      var penarikan = t.cashIn || 0;
      totalIn += setoran;
      totalOut += penarikan;
      running += setoran - penarikan;

      var tr = document.createElement("tr");

      var tdDate = document.createElement("td");
      tdDate.className = "col-date";
      tdDate.setAttribute("data-label", "Tanggal");
      tdDate.textContent = formatDate(t.tanggal);

      var tdDesc = document.createElement("td");
      tdDesc.className = "col-desc";
      tdDesc.setAttribute("data-label", "Keterangan");
      tdDesc.textContent = t.keterangan;

      var tdSet = document.createElement("td");
      tdSet.className = "col-num pos";
      tdSet.setAttribute("data-label", "Setoran");
      tdSet.textContent = setoran ? formatRupiah(setoran) : "";

      var tdTarik = document.createElement("td");
      tdTarik.className = "col-num neg";
      tdTarik.setAttribute("data-label", "Penarikan");
      tdTarik.textContent = penarikan ? formatRupiah(penarikan) : "";

      var tdSaldo = document.createElement("td");
      tdSaldo.className = "col-num invest-saldo";
      tdSaldo.setAttribute("data-label", "Saldo Berjalan");
      tdSaldo.textContent = formatRupiah(running);

      tr.appendChild(tdDate);
      tr.appendChild(tdDesc);
      tr.appendChild(tdSet);
      tr.appendChild(tdTarik);
      tr.appendChild(tdSaldo);
      el.investBody.appendChild(tr);
    });

    el.investEmpty.hidden = rows.length !== 0;

    el.investIn.textContent = formatRupiah(totalIn);
    el.investOut.textContent = formatRupiah(totalOut);
    el.investNet.textContent = formatRupiah(totalIn - totalOut);
    el.investFootIn.textContent = formatRupiah(totalIn);
    el.investFootOut.textContent = formatRupiah(totalOut);
    el.investFootNet.textContent = formatRupiah(totalIn - totalOut);
    if (window.Charts) renderInvestCharts();
  }

  function exportInvestCSV() {
    var rows = getInvestTx();
    if (!rows.length) { alert("Tidak ada transaksi investasi untuk diekspor."); return; }
    var lines = [["Tanggal", "Keterangan", "Setoran", "Penarikan", "Saldo Berjalan"].join(",")];
    var running = 0;
    rows.forEach(function (t) {
      running += (t.cashOut || 0) - (t.cashIn || 0);
      lines.push([
        t.tanggal,
        '"' + String(t.keterangan).replace(/"/g, '""') + '"',
        t.cashOut || 0,
        t.cashIn || 0,
        running
      ].join(","));
    });
    var blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = "investasi-" + new Date().toISOString().slice(0, 10) + ".csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // ================= SALES LOG (Log Pendapatan) =================

  function salesYears() {
    var set = {};
    transactions.forEach(function (t) {
      if (t.cashIn > 0 && SALES_CODES.indexOf(t.kode) !== -1 && t.tanggal) {
        set[t.tanggal.slice(0, 4)] = true;
      }
    });
    var years = Object.keys(set);
    var nowY = String(new Date().getFullYear());
    if (years.indexOf(nowY) === -1) years.push(nowY);
    return years.sort().reverse();
  }

  function populateSalesYears() {
    var years = salesYears();
    var current = el.salesYear.value;
    el.salesYear.innerHTML = "";
    years.forEach(function (y) {
      var o = document.createElement("option");
      o.value = y; o.textContent = y;
      el.salesYear.appendChild(o);
    });
    if (current && years.indexOf(current) !== -1) {
      el.salesYear.value = current;
    } else if (years.indexOf(String(new Date().getFullYear())) !== -1) {
      el.salesYear.value = String(new Date().getFullYear());
    }
  }

  // Matrix pendapatan: cash in per kode penjualan per bulan.
  function computeSalesMatrix(year) {
    var matrix = {};
    SALES_CODES.forEach(function (c) { matrix[c] = new Array(12).fill(0); });
    transactions.forEach(function (t) {
      if (!t.cashIn || t.cashIn <= 0) return;
      if (!t.tanggal || t.tanggal.slice(0, 4) !== year) return;
      if (!matrix[t.kode]) return; // hanya kode penjualan
      var m = parseInt(t.tanggal.slice(5, 7), 10) - 1;
      if (m < 0 || m > 11) return;
      matrix[t.kode][m] += t.cashIn;
    });
    return matrix;
  }

  function renderSales() {
    populateSalesYears();
    var year = el.salesYear.value || String(new Date().getFullYear());
    var matrix = computeSalesMatrix(year);

    var monthTotals = new Array(12).fill(0);
    var grandTotal = 0;
    SALES_CODES.forEach(function (code) {
      var vals = matrix[code] || [];
      for (var m = 0; m < 12; m++) {
        monthTotals[m] += vals[m] || 0;
        grandTotal += vals[m] || 0;
      }
    });

    if (grandTotal === 0) {
      el.salesWrap.innerHTML = "";
      el.salesEmpty.hidden = false;
    } else {
      el.salesEmpty.hidden = true;
      el.salesWrap.innerHTML = buildMatrixTable(SALES_GROUPS, matrix, monthTotals, {
        catLabel: "Kategori Pendapatan",
        totalLabel: "TOTAL",
        tableClass: "sales-table",
        grandClass: "sales-grand"
      });
    }

    renderSalesSummary(monthTotals, grandTotal);
    if (window.Charts) renderSalesCharts(year, matrix);
  }

  function renderSalesSummary(monthTotals, grandTotal) {
    var activeMonths = monthTotals.filter(function (v) { return v > 0; }).length;
    var avg = activeMonths ? grandTotal / activeMonths : 0;
    var maxIdx = -1, maxVal = 0;
    monthTotals.forEach(function (v, i) { if (v > maxVal) { maxVal = v; maxIdx = i; } });

    var cards = [
      { label: "Total Pendapatan (Tahun)", value: formatRupiah(grandTotal), cls: "card-in" },
      { label: "Rata-rata / Bulan Aktif", value: formatRupiah(avg), cls: "card-balance" },
      {
        label: "Bulan Tertinggi",
        value: maxIdx >= 0 ? (MONTHS_SHORT[maxIdx] + " · " + formatRupiah(maxVal)) : "-",
        cls: "card-count"
      }
    ];
    el.salesSummary.innerHTML = cards.map(function (c) {
      return '<div class="card ' + c.cls + '"><div class="card-body">' +
        '<span class="card-label">' + c.label + "</span>" +
        '<span class="card-value">' + c.value + "</span></div></div>";
    }).join("");
  }

  function exportSalesCSV() {
    var year = el.salesYear.value || String(new Date().getFullYear());
    var matrix = computeSalesMatrix(year);
    var monthTotals = new Array(12).fill(0);
    SALES_CODES.forEach(function (code) {
      var vals = matrix[code] || [];
      for (var m = 0; m < 12; m++) monthTotals[m] += vals[m] || 0;
    });
    if (monthTotals.reduce(function (a, b) { return a + b; }, 0) === 0) {
      alert("Tidak ada pendapatan untuk diekspor pada tahun " + year + ".");
      return;
    }

    var lines = [];
    lines.push(["Kategori", "Kode"].concat(MONTHS_SHORT).concat(["Total"]).join(","));
    SALES_GROUPS.forEach(function (group) {
      lines.push('"' + group.title + '"');
      group.rows.forEach(function (row) {
        var vals = matrix[row.code] || new Array(12).fill(0);
        var rowTotal = vals.reduce(function (a, b) { return a + b; }, 0);
        lines.push(['"' + row.label + (row.excluded ? " (tidak dihitung)" : "") + '"', row.code].concat(vals).concat([rowTotal]).join(","));
      });
    });
    var grand = monthTotals.reduce(function (a, b) { return a + b; }, 0);
    lines.push(["TOTAL", ""].concat(monthTotals).concat([grand]).join(","));

    var blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = "sales-log-" + year + ".csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // ================= SUMMARY =================

  // Jumlahkan matrix (per kode) menjadi total per bulan.
  function monthTotalsOf(matrix, codes) {
    var totals = new Array(12).fill(0);
    codes.forEach(function (code) {
      var vals = matrix[code] || [];
      for (var m = 0; m < 12; m++) totals[m] += vals[m] || 0;
    });
    return totals;
  }

  function summaryYears() {
    var set = {};
    transactions.forEach(function (t) {
      if (!t.tanggal) return;
      var isSale = t.cashIn > 0 && SALES_CODES.indexOf(t.kode) !== -1;
      var isExp = t.cashOut > 0 && EXPENSE_CODES.indexOf(t.kode) !== -1;
      if (isSale || isExp) set[t.tanggal.slice(0, 4)] = true;
    });
    var years = Object.keys(set);
    var nowY = String(new Date().getFullYear());
    if (years.indexOf(nowY) === -1) years.push(nowY);
    return years.sort().reverse();
  }

  function populateSummaryYears() {
    var years = summaryYears();
    var current = el.summaryYear.value;
    el.summaryYear.innerHTML = "";
    years.forEach(function (y) {
      var o = document.createElement("option");
      o.value = y; o.textContent = y;
      el.summaryYear.appendChild(o);
    });
    if (current && years.indexOf(current) !== -1) {
      el.summaryYear.value = current;
    } else if (years.indexOf(String(new Date().getFullYear())) !== -1) {
      el.summaryYear.value = String(new Date().getFullYear());
    }
  }

  function renderSummary() {
    populateSummaryYears();
    var year = el.summaryYear.value || String(new Date().getFullYear());
    renderSheet(year);
  }

  // ---- Lembar "Hitungan LC" (Laba Rugi + Est hitungan) ----
  // Baris tetap mengikuti spreadsheet Hitungan LC; kode lain hanya muncul
  // bila ada nilainya pada periode terpilih.
  var SHEET_INCOME = [
    { code: "PLC", label: "Income Paket LC" },
    { code: "KRS", label: "Income Komisi RB & SK" },
    { code: "KMS", label: "Income Komisi Mamah Salma" }
  ];
  var SHEET_BEBAN = [
    { code: "GH",  label: "Beban Host Livecraft" },
    { code: "HMS", label: "Beban Host Mamah Salma" },
    { code: "SHL", label: "Beban Sheila" },
    { code: "GA",  label: "Beban Admin" },
    { code: "GCC", label: "Beban Editor / CC" }
  ];

  function populatePeriods() {
    if (el.summaryPeriod.options.length) return;
    var o = document.createElement("option");
    o.value = ""; o.textContent = "Setahun";
    el.summaryPeriod.appendChild(o);
    MONTHS_FULL.forEach(function (m, i) {
      var opt = document.createElement("option");
      opt.value = String(i); opt.textContent = m;
      el.summaryPeriod.appendChild(opt);
    });
  }
  function periodSums(year, month) {
    var inc = {}, out = {};
    transactions.forEach(function (t) {
      if (!t.tanggal || t.tanggal.slice(0, 4) !== year) return;
      if (month >= 0 && parseInt(t.tanggal.slice(5, 7), 10) - 1 !== month) return;
      if (t.cashIn) inc[t.kode] = (inc[t.kode] || 0) + t.cashIn;
      if (t.cashOut) out[t.kode] = (out[t.kode] || 0) + t.cashOut;
    });
    return { inc: inc, out: out };
  }
  function pctLabel(p) {
    return String(Math.round(p * 1000) / 10).replace(".", ",") + "%";
  }

  function computeSheet(year) {
    populatePeriods();
    var month = el.summaryPeriod.value === "" ? -1 : parseInt(el.summaryPeriod.value, 10);
    var ps = periodSums(year, month);
    var fixedIn = SHEET_INCOME.map(function (r) { return r.code; });
    var fixedOut = SHEET_BEBAN.map(function (r) { return r.code; });

    var income = SHEET_INCOME.map(function (r) { return { code: r.code, label: r.label, v: ps.inc[r.code] || 0 }; });
    SALES_GROUPS.forEach(function (g) {
      var nonOp = g.title.indexOf("Non-Sales") !== -1;
      g.rows.forEach(function (r) {
        if (fixedIn.indexOf(r.code) !== -1 || !ps.inc[r.code]) return;
        income.push({ code: r.code, label: "Income " + r.label, v: ps.inc[r.code], tag: nonOp ? "non-usaha" : "" });
      });
    });

    var beban = SHEET_BEBAN.map(function (r) { return { code: r.code, label: r.label, v: ps.out[r.code] || 0 }; });
    var notes = [];
    EXPENSE_GROUPS.forEach(function (g) {
      g.rows.forEach(function (r) {
        if (fixedOut.indexOf(r.code) !== -1 || !ps.out[r.code]) return;
        var label = /^beban/i.test(r.label) ? r.label : "Beban " + r.label;
        (r.excluded ? notes : beban).push({ code: r.code, label: label, v: ps.out[r.code] });
      });
    });

    var kotor = income.reduce(function (a, r) { return a + r.v; }, 0);
    var rugi = beban.reduce(function (a, r) { return a + r.v; }, 0);
    var est = allocation.items.map(function (it) { return { name: it.name, pct: it.pct, v: kotor * it.pct }; });
    var estPct = est.reduce(function (a, e) { return a + e.pct; }, 0);
    var gaji = null;
    est.forEach(function (e) { if (gaji === null && /gaji/i.test(e.name)) gaji = e.v; });
    return {
      periodLabel: (month >= 0 ? MONTHS_FULL[month] + " " : "Tahun ") + year,
      income: income, beban: beban, notes: notes,
      kotor: kotor, rugi: rugi, bersih: kotor - rugi,
      est: est, estPct: estPct, estTotal: kotor * estPct,
      gaji: gaji, persons: allocation.persons,
      empty: !Object.keys(ps.inc).length && !Object.keys(ps.out).length
    };
  }

  function renderSheet(year) {
    var d = computeSheet(year);
    function label(r) {
      return '<td class="lc-label">' + escapeHtml(r.label) +
        (r.code ? ' <span class="lc-code">' + r.code + "</span>" : "") +
        (r.tag ? ' <span class="exp-tag">' + r.tag + "</span>" : "") + "</td>";
    }
    function money(v, cls) { return '<td class="lc-num' + (cls ? " " + cls : "") + '">' + formatRupiah(v) + "</td>"; }
    var gap = '<tr class="lc-gap"><td colspan="3"></td></tr>';

    var h = '<table class="lc-table">' +
      '<colgroup><col class="lc-c-label" /><col class="lc-c-mid" /><col class="lc-c-tot" /></colgroup><tbody>';
    h += '<tr class="lc-title"><th colspan="3" scope="colgroup">Laba Rugi' +
      '<span class="lc-period">' + escapeHtml(d.periodLabel) + "</span></th></tr>";
    if (d.empty) h += '<tr class="lc-hint"><td colspan="3">Belum ada transaksi pada periode ini.</td></tr>';
    d.income.forEach(function (r) { h += "<tr>" + label(r) + money(r.v) + "<td></td></tr>"; });
    h += '<tr class="lc-total"><td class="lc-label">Total Laba kotor</td><td></td>' + money(d.kotor) + "</tr>";
    h += gap;
    d.beban.forEach(function (r) { h += "<tr>" + label(r) + money(r.v, "lc-hl") + "<td></td></tr>"; });
    d.notes.forEach(function (r) {
      h += '<tr class="lc-excl">' + label({ code: r.code, label: r.label, tag: "tidak dihitung" }) +
        money(r.v) + "<td></td></tr>";
    });
    h += '<tr class="lc-total"><td class="lc-label">Total Rugi</td><td></td>' + money(d.rugi) + "</tr>";
    h += gap;
    h += '<tr class="lc-total lc-net ' + (d.bersih >= 0 ? "good" : "bad") + '"><td class="lc-label">Total Laba bersih</td><td></td>' +
      money(d.bersih) + "</tr>";

    h += '<tr class="lc-gap lc-gap-lg"><td colspan="3"></td></tr>';
    h += '<tr class="lc-title"><th colspan="3" scope="colgroup">Est hitungan' +
      '<span class="lc-period">dari Total Laba kotor</span></th></tr>';
    d.est.forEach(function (e) {
      h += '<tr><td class="lc-label">' + escapeHtml(e.name) + '</td><td class="lc-num lc-pct">' + pctLabel(e.pct) + "</td>" +
        money(e.v) + "</tr>";
    });
    var ok = Math.abs(d.estPct - 1) < 0.0005;
    h += '<tr class="lc-total"><td class="lc-label">Total</td><td class="lc-num lc-pct' + (ok ? "" : " warn") + '">' +
      pctLabel(d.estPct) + "</td>" + money(d.estTotal) + "</tr>";
    if (!ok) h += '<tr class="lc-hint warn"><td colspan="3">Total persentase belum 100%.</td></tr>';
    if (d.gaji !== null) {
      h += gap;
      h += '<tr class="lc-person"><td class="lc-label">Esti gaji perorang' +
        '<span class="lc-sub">Gaji ÷ ' + d.persons + " orang</span></td><td></td>" + money(d.gaji / d.persons) + "</tr>";
    }
    h += "</tbody></table>";
    el.lcSheet.innerHTML = '<div class="lc-scroll">' + h + "</div>";
  }

  function exportSheetCSV() {
    var year = el.summaryYear.value || String(new Date().getFullYear());
    var d = computeSheet(year);
    var q = function (x) { return '"' + String(x).replace(/"/g, '""') + '"'; };
    var lines = [q("Hitungan LC - " + d.periodLabel), "", q("Laba Rugi") + ",Nominal,Total"];
    d.income.forEach(function (r) { lines.push(q(r.label + " (" + r.code + ")") + "," + Math.round(r.v) + ","); });
    lines.push(q("Total Laba kotor") + ",," + Math.round(d.kotor));
    lines.push("");
    d.beban.forEach(function (r) { lines.push(q(r.label + " (" + r.code + ")") + "," + Math.round(r.v) + ","); });
    d.notes.forEach(function (r) { lines.push(q(r.label + " (" + r.code + ", tidak dihitung)") + "," + Math.round(r.v) + ","); });
    lines.push(q("Total Rugi") + ",," + Math.round(d.rugi));
    lines.push("");
    lines.push(q("Total Laba bersih") + ",," + Math.round(d.bersih));
    lines.push("", "");
    lines.push(q("Est hitungan") + ",%,Nominal");
    d.est.forEach(function (e) { lines.push(q(e.name) + "," + q(pctLabel(e.pct)) + "," + Math.round(e.v)); });
    lines.push(q("Total") + "," + q(pctLabel(d.estPct)) + "," + Math.round(d.estTotal));
    if (d.gaji !== null) { lines.push(""); lines.push(q("Esti gaji perorang (Gaji / " + d.persons + ")") + ",," + Math.round(d.gaji / d.persons)); }

    var blob = new Blob(["\ufeff" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = "hitungan-lc-" + d.periodLabel.toLowerCase().replace(/\s+/g, "-") + ".csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // ---- Split Laba Kotor di Cash Flow (Est hitungan direkap per bulan) ----
  function splitLabel(name) {
    if (/shu/i.test(name)) return "Sisa SHU";
    if (/cash/i.test(name)) return "Sisa Cash";
    return "Tersisa " + name;
  }
  function renderSplit() {
    var years = summaryYears();
    var cur = el.splitYear.value;
    el.splitYear.innerHTML = years.map(function (y) { return '<option value="' + y + '">' + y + "</option>"; }).join("");
    var pick = (cur && years.indexOf(cur) !== -1) ? cur : latestYear();
    el.splitYear.value = years.indexOf(pick) !== -1 ? pick : years[0];
    var year = el.splitYear.value;

    // Laba kotor per bulan = total Cash In semua kode penjualan (sama dengan Summary).
    var kotor = monthTotalsOf(computeSalesMatrix(year), SALES_CODES);
    var lastM = -1;
    kotor.forEach(function (v, i) { if (v) lastM = i; });

    // SHU & Cash pegangan tampil lebih dulu, lalu pos lainnya.
    var items = allocation.items.map(function (it, i) {
      return { name: it.name, pct: it.pct, color: PALETTE[i % PALETTE.length],
        values: kotor.map(function (v) { return v * it.pct; }) };
    });
    function rank(it) { return /shu/i.test(it.name) ? 0 : (/cash/i.test(it.name) ? 1 : 2); }
    items.sort(function (a, b) { return rank(a) - rank(b); });

    el.splitCards.innerHTML = items.map(function (it) {
      var sub = pctLabel(it.pct) + " dari Laba kotor" +
        (lastM >= 0 ? " · " + MONTHS_SHORT[lastM] + ": <b>" + formatRupiah(it.values[lastM]) + "</b>" : "");
      return '<div class="card split-card" style="--split-c:var(' + it.color + ')"><div class="card-body">' +
        '<span class="card-label">' + escapeHtml(splitLabel(it.name)) + "</span>" +
        '<span class="card-value">' + formatRupiah(sumArr(it.values)) + "</span>" +
        '<span class="wallet-sub">' + sub + "</span></div></div>";
    }).join("");

    var h = '<table class="expense-table split-matrix">' + MATRIX_COLGROUP + "<thead><tr>" +
      '<th class="exp-cat">Split per Bulan ' + year + "</th>";
    MONTHS_SHORT.forEach(function (m) { h += '<th class="col-num">' + m + "</th>"; });
    h += '<th class="col-num exp-total-col">Total</th></tr></thead><tbody>';
    function row(label, values, cls, color) {
      var r = '<tr class="' + (cls || "") + '"><td class="exp-cat">' +
        (color ? '<span class="chart-swatch" style="background:var(' + color + ')"></span>' : "") + escapeHtml(label) + "</td>";
      values.forEach(function (v) { r += '<td class="col-num">' + cell(v) + "</td>"; });
      return r + '<td class="col-num exp-total-col">' + cell(sumArr(values)) + "</td></tr>";
    }
    h += row("Total Laba kotor", kotor, "split-base");
    items.forEach(function (it) { h += row(splitLabel(it.name) + " (" + pctLabel(it.pct) + ")", it.values, "", it.color); });
    h += "</tbody></table>";
    el.splitTable.innerHTML = h;
    // Geser tabel agar bulan terakhir yang berisi data langsung terlihat.
    if (lastM >= 0) {
      var th = el.splitTable.querySelectorAll("thead th")[lastM + 1];
      if (th && el.splitTable.clientWidth) {
        el.splitTable.scrollLeft = 0;
        var box = el.splitTable.getBoundingClientRect(), r = th.getBoundingClientRect();
        el.splitTable.scrollLeft = Math.max(0, r.right - box.right + 8);
      }
    }
  }

  // Editor alokasi
  function allocRow(name, pctNum) {
    var row = document.createElement("div");
    row.className = "shares-row";
    var ni = document.createElement("input");
    ni.type = "text"; ni.className = "share-name alloc-name"; ni.value = name || ""; ni.placeholder = "Nama pos";
    ni.setAttribute("aria-label", "Nama pos alokasi");
    var wrap = document.createElement("div");
    wrap.className = "share-pct-wrap";
    var pi = document.createElement("input");
    pi.type = "number"; pi.className = "share-pct alloc-pct"; pi.min = "0"; pi.max = "100"; pi.step = "0.1";
    pi.value = (pctNum != null ? pctNum : "");
    pi.setAttribute("aria-label", "Persen alokasi");
    pi.addEventListener("input", updateAllocTotal);
    var sign = document.createElement("span");
    sign.className = "share-pct-sign"; sign.textContent = "%";
    wrap.appendChild(pi); wrap.appendChild(sign);
    var rm = document.createElement("button");
    rm.type = "button"; rm.className = "icon-btn del"; rm.title = "Hapus";
    rm.setAttribute("aria-label", "Hapus pos");
    rm.innerHTML = window.Icons ? Icons.svg("trash") : "Hapus";
    rm.addEventListener("click", function () { row.remove(); updateAllocTotal(); });
    row.appendChild(ni); row.appendChild(wrap); row.appendChild(rm);
    return row;
  }
  function renderAllocRows(a) {
    el.allocRows.innerHTML = "";
    a.items.forEach(function (it) { el.allocRows.appendChild(allocRow(it.name, Math.round(it.pct * 1000) / 10)); });
    el.allocPersons.value = a.persons;
    updateAllocTotal();
  }
  function updateAllocTotal() {
    var total = 0;
    el.allocRows.querySelectorAll(".alloc-pct").forEach(function (i) { total += parseFloat(i.value) || 0; });
    var rounded = Math.round(total * 10) / 10, ok = Math.abs(rounded - 100) < 0.05;
    el.allocTotal.textContent = "Total: " + String(rounded).replace(".", ",") + "%" + (ok ? "" : " (harus 100%)");
    el.allocTotal.classList.toggle("shares-ok", ok);
    el.allocTotal.classList.toggle("shares-bad", !ok);
  }
  function openAllocEditor() {
    renderAllocRows(allocation);
    el.allocEditor.hidden = false;
    el.allocEditBtn.classList.add("is-active-toggle");
  }
  function closeAllocEditor() {
    el.allocEditor.hidden = true;
    el.allocEditBtn.classList.remove("is-active-toggle");
  }
  function commitAlloc() {
    var items = [];
    el.allocRows.querySelectorAll(".shares-row").forEach(function (r) {
      var name = r.querySelector(".alloc-name").value.trim();
      var pct = parseFloat(r.querySelector(".alloc-pct").value) || 0;
      if (name) items.push({ name: name, pct: pct / 100 });
    });
    if (!items.length) { alert("Tambahkan minimal satu pos alokasi."); return; }
    var total = items.reduce(function (a, b) { return a + b.pct; }, 0);
    if (Math.abs(total - 1) > 0.0005 &&
        !confirm("Total alokasi " + String(Math.round(total * 1000) / 10).replace(".", ",") + "%, bukan 100%. Tetap simpan?")) return;
    allocation = { persons: Math.max(1, parseInt(el.allocPersons.value, 10) || 1), items: items };
    saveAlloc();
    closeAllocEditor();
    renderSheet(el.summaryYear.value || String(new Date().getFullYear()));
    renderSplit();
  }

  // ================= CHARTS =================
  var PALETTE = ["--ser-1", "--ser-2", "--ser-3", "--ser-4", "--ser-5", "--ser-6"];
  function $(id) { return document.getElementById(id); }
  function sumArr(a) { return a.reduce(function (x, y) { return x + y; }, 0); }
  function truncate(s, n) { return s.length > n ? s.slice(0, n - 1) + "…" : s; }

  function latestYear(filter) {
    var latest = "";
    transactions.forEach(function (t) {
      if (!t.tanggal) return;
      if (filter && !filter(t)) return;
      var y = t.tanggal.slice(0, 4);
      if (y > latest) latest = y;
    });
    return latest || String(new Date().getFullYear());
  }

  // ---- Detail helpers (baris rincian di atas tiap grafik) ----
  function setStats(chartId, items) {
    var body = $(chartId);
    if (!body) return;
    var card = body.parentNode;
    var box = card.querySelector(".chart-stats");
    if (!box) {
      box = document.createElement("div");
      box.className = "chart-stats";
      card.insertBefore(box, body);
    }
    box.innerHTML = items.map(function (it) {
      return '<div class="cs"><span class="cs-l">' + escapeHtml(it.l) + '</span><span class="cs-v' +
        (it.tone ? " " + it.tone : "") + '">' + escapeHtml(it.v) + "</span></div>";
    }).join("");
  }
  function peakOf(arr) {
    var idx = -1, v = 0;
    arr.forEach(function (x, k) { if (x > v) { v = x; idx = k; } });
    return { i: idx, v: v };
  }
  function avgActive(arr) {
    var n = arr.filter(function (x) { return x > 0; }).length;
    return n ? sumArr(arr) / n : 0;
  }
  function fullMonths(year) { return MONTHS_FULL.map(function (m) { return m + " " + year; }); }
  function topShare(items) {
    var s = items.filter(function (i) { return i.value > 0; }).sort(function (a, b) { return b.value - a.value; });
    var tot = sumArr(s.map(function (i) { return i.value; }));
    return s.length ? { name: s[0].short || s[0].label, pct: Math.round(s[0].value / tot * 100), n: s.length, tot: tot } : null;
  }
  function codeItems(codes, valueOf) {
    return codes.map(function (code) {
      return { label: truncate(code + " · " + (CODE_LABEL[code] || code), 22),
        full: code + " · " + (CODE_LABEL[code] || code), short: code, value: valueOf(code) };
    });
  }
  function peakText(pk) { return pk.i >= 0 ? MONTHS_SHORT[pk.i] + " · " + formatRupiah(pk.v) : "-"; }

  // ---- Ringkasan bulan terakhir vs bulan sebelumnya (Cash Flow) ----
  function prevMonthKey(key) {
    var y = parseInt(key.slice(0, 4), 10), m = parseInt(key.slice(5, 7), 10) - 1;
    if (m === 0) { y -= 1; m = 12; }
    return y + "-" + (m < 10 ? "0" : "") + m;
  }
  function deltaHtml(cur, prev, upIsGood, prevLabel) {
    if (!prev) return '<span class="ins-d neutral">Belum ada data ' + escapeHtml(prevLabel) + "</span>";
    var d = (cur - prev) / Math.abs(prev) * 100;
    var up = d >= 0;
    var tone = d === 0 ? "neutral" : ((up === upIsGood) ? "good" : "bad");
    var ico = window.Icons ? Icons.svg(d === 0 ? "minus" : (up ? "trending-up" : "trending-down")) : "";
    var txt = (up ? "+" : "") + d.toFixed(1).replace(".", ",") + "% vs " + prevLabel;
    return '<span class="ins-d ' + tone + '">' + ico + '<span>' + escapeHtml(txt) + "</span></span>";
  }
  function renderInsight() {
    var box = $("cfInsight");
    if (!box) return;
    var byMonth = {};
    transactions.forEach(function (t) {
      if (!t.tanggal) return;
      var k = t.tanggal.slice(0, 7);
      var o = byMonth[k] || (byMonth[k] = { inn: 0, out: 0, n: 0 });
      o.inn += t.cashIn || 0; o.out += t.cashOut || 0; o.n += 1;
    });
    var keys = Object.keys(byMonth).sort();
    if (!keys.length) { box.hidden = true; return; }
    box.hidden = false;
    var cur = keys[keys.length - 1], prevK = prevMonthKey(cur);
    var c = byMonth[cur], p = byMonth[prevK];
    var prevLabel = monthLabel(prevK);
    var net = c.inn - c.out, pNet = p ? p.inn - p.out : 0;
    function item(label, value, delta, tone) {
      return '<div class="ins"><span class="cs-l">' + label + '</span><span class="ins-v' + (tone ? " " + tone : "") + '">' +
        value + "</span>" + delta + "</div>";
    }
    box.innerHTML =
      '<div class="insight-head"><h2 class="panel-title">Ringkasan ' + escapeHtml(monthLabel(cur)) + "</h2>" +
      '<span class="insight-sub">Bulan transaksi terakhir, dibanding ' + escapeHtml(prevLabel) + "</span></div>" +
      '<div class="insight-grid">' +
        item("Cash In", formatRupiah(c.inn), deltaHtml(c.inn, p && p.inn, true, prevLabel)) +
        item("Cash Out", formatRupiah(c.out), deltaHtml(c.out, p && p.out, false, prevLabel)) +
        item("Arus Bersih (In − Out)", formatRupiah(net), p ? deltaHtml(net, pNet, true, prevLabel) :
          '<span class="ins-d neutral">Belum ada data ' + escapeHtml(prevLabel) + "</span>", net >= 0 ? "good" : "bad") +
        item("Jumlah Transaksi", String(c.n), deltaHtml(c.n, p && p.n, true, prevLabel)) +
      "</div>";
  }

  // ---- Cash Flow charts ----
  function renderCashflowCharts() {
    renderInsight();
    var year = latestYear();
    var inA = new Array(12).fill(0), outA = new Array(12).fill(0);
    transactions.forEach(function (t) {
      if (!t.tanggal || t.tanggal.slice(0, 4) !== year) return;
      var m = parseInt(t.tanggal.slice(5, 7), 10) - 1;
      if (m < 0 || m > 11) return;
      inA[m] += t.cashIn || 0; outA[m] += t.cashOut || 0;
    });
    var tIn = sumArr(inA), tOut = sumArr(outA), net = tIn - tOut;
    setStats("chartCashflow", [
      { l: "Cash In " + year, v: formatRupiah(tIn) },
      { l: "Cash Out " + year, v: formatRupiah(tOut) },
      { l: "Arus Bersih", v: formatRupiah(net), tone: net >= 0 ? "good" : "bad" }
    ]);
    Charts.bars($("chartCashflow"), {
      labels: MONTHS_SHORT, fullLabels: fullMonths(year),
      series: [
        { name: "Cash In", colorVar: "--ser-1", values: inA },
        { name: "Cash Out", colorVar: "--ser-2", values: outA }
      ],
      ariaLabel: "Cash In dan Cash Out per bulan " + year,
      empty: "Belum ada transaksi."
    });

    var exp = computeExpenseMatrix(year);
    var items = codeItems(EXPENSE_CODES, function (code) { return sumArr(exp[code] || []); });
    var top = topShare(items);
    setStats("chartCashflowTop", top ? [
      { l: "Total Pengeluaran", v: formatRupiah(top.tot) },
      { l: "Terbesar", v: top.name + " · " + top.pct + "%" },
      { l: "Kode Terpakai", v: String(top.n) }
    ] : []);
    Charts.hbars($("chartCashflowTop"), { items: items, colorVar: "--ser-2", limit: 6,
      ariaLabel: "Pengeluaran terbesar per kode " + year, empty: "Belum ada pengeluaran." });
  }

  // ---- Expense charts ----
  function renderExpenseCharts(year, matrix) {
    var monthly = new Array(12).fill(0);
    EXPENSE_CODES.forEach(function (code) {
      var vals = matrix[code] || [];
      for (var m = 0; m < 12; m++) monthly[m] += vals[m] || 0;
    });
    setStats("chartExpenseTrend", [
      { l: "Total " + year, v: formatRupiah(sumArr(monthly)) },
      { l: "Rata-rata / Bulan Aktif", v: formatRupiah(avgActive(monthly)) },
      { l: "Tertinggi", v: peakText(peakOf(monthly)) }
    ]);
    Charts.bars($("chartExpenseTrend"), {
      labels: MONTHS_SHORT, fullLabels: fullMonths(year),
      series: [{ name: "Beban", colorVar: "--ser-2", values: monthly }],
      ariaLabel: "Total beban per bulan " + year, empty: "Belum ada beban."
    });
    var items = codeItems(EXPENSE_CODES, function (code) { return sumArr(matrix[code] || []); });
    var top = topShare(items);
    setStats("chartExpenseCat", top ? [
      { l: "Kategori Terbesar", v: top.name + " · " + top.pct + "%" },
      { l: "Kategori Terpakai", v: top.n + " dari " + EXPENSE_CODES.length }
    ] : []);
    Charts.hbars($("chartExpenseCat"), { items: items, colorVar: "--ser-2", limit: 8,
      ariaLabel: "Beban per kategori " + year, empty: "Belum ada beban." });
  }

  // ---- Asset charts ----
  function renderAssetCharts() {
    var byPay = {}, byMonth = {}, total = 0;
    MONTHS_FULL.forEach(function (m) { byMonth[m] = 0; });
    assets.forEach(function (a) {
      var tot = assetTotalOf(a);
      total += tot;
      byPay[a.pembayaran] = (byPay[a.pembayaran] || 0) + tot;
      byMonth[a.bulan] = (byMonth[a.bulan] || 0) + tot;
    });
    var payItems = Object.keys(byPay).map(function (k, i) {
      return { label: k, value: byPay[k], colorVar: PALETTE[i % PALETTE.length] };
    });
    var debt = byPay.Hutang || 0;
    setStats("chartAssetPay", total ? [
      { l: "Total Aset", v: formatRupiah(total) },
      { l: "Porsi Hutang", v: Math.round(debt / total * 100) + "%", tone: debt ? "bad" : "good" },
      { l: "Metode", v: String(payItems.length) }
    ] : []);
    Charts.donut($("chartAssetPay"), { items: payItems, centerLabel: "Total Aset",
      ariaLabel: "Komposisi aset per metode pembayaran", empty: "Belum ada aset." });

    var monthVals = MONTHS_FULL.map(function (m) { return byMonth[m] || 0; });
    var noMonth = assets.filter(function (a) { return !a.bulan; }).length;
    setStats("chartAssetMonth", total ? [
      { l: "Bulan Tertinggi", v: peakText(peakOf(monthVals)) },
      { l: "Jumlah Item", v: String(assets.length) },
      { l: "Tanpa Bulan", v: noMonth + " item" }
    ] : []);
    Charts.bars($("chartAssetMonth"), {
      labels: MONTHS_SHORT, fullLabels: MONTHS_FULL,
      series: [{ name: "Aset", colorVar: "--ser-1", values: monthVals }],
      ariaLabel: "Nilai aset per bulan", empty: "Belum ada aset."
    });
  }

  // ---- Investment charts ----
  function renderInvestCharts() {
    var year = el.investYear.value || latestYear(function (t) { return t.kode === INVEST_CODE; });
    var setor = new Array(12).fill(0), tarik = new Array(12).fill(0);
    transactions.forEach(function (t) {
      if (t.kode !== INVEST_CODE || !t.tanggal || t.tanggal.slice(0, 4) !== year) return;
      var m = parseInt(t.tanggal.slice(5, 7), 10) - 1;
      if (m < 0 || m > 11) return;
      setor[m] += t.cashOut || 0; tarik[m] += t.cashIn || 0;
    });
    var saldo = [], run = 0;
    for (var m = 0; m < 12; m++) { run += setor[m] - tarik[m]; saldo.push(run); }
    setStats("chartInvestSaldo", [
      { l: "Saldo Akhir " + year, v: formatRupiah(run), tone: run >= 0 ? "good" : "bad" },
      { l: "Puncak", v: peakText(peakOf(saldo)) }
    ]);
    Charts.area($("chartInvestSaldo"), { labels: MONTHS_SHORT, fullLabels: fullMonths(year), values: saldo,
      seriesName: "Saldo", colorVar: "--ser-1", ariaLabel: "Saldo investasi berjalan " + year, empty: "Belum ada investasi." });
    setStats("chartInvestFlow", [
      { l: "Total Setoran", v: formatRupiah(sumArr(setor)) },
      { l: "Total Penarikan", v: formatRupiah(sumArr(tarik)) }
    ]);
    Charts.bars($("chartInvestFlow"), {
      labels: MONTHS_SHORT, fullLabels: fullMonths(year),
      series: [
        { name: "Setoran", colorVar: "--ser-1", values: setor },
        { name: "Penarikan", colorVar: "--ser-2", values: tarik }
      ],
      ariaLabel: "Setoran dan penarikan investasi per bulan " + year, empty: "Belum ada investasi."
    });
  }

  // ---- Sales charts ----
  function renderSalesCharts(year, matrix) {
    var monthly = new Array(12).fill(0);
    SALES_CODES.forEach(function (code) {
      var vals = matrix[code] || [];
      for (var m = 0; m < 12; m++) monthly[m] += vals[m] || 0;
    });
    setStats("chartSalesTrend", [
      { l: "Total " + year, v: formatRupiah(sumArr(monthly)) },
      { l: "Rata-rata / Bulan Aktif", v: formatRupiah(avgActive(monthly)) },
      { l: "Tertinggi", v: peakText(peakOf(monthly)) }
    ]);
    Charts.bars($("chartSalesTrend"), {
      labels: MONTHS_SHORT, fullLabels: fullMonths(year),
      series: [{ name: "Pendapatan", colorVar: "--ser-1", values: monthly }],
      ariaLabel: "Pendapatan per bulan " + year, empty: "Belum ada pendapatan."
    });
    var items = codeItems(SALES_CODES, function (code) { return sumArr(matrix[code] || []); });
    var top = topShare(items);
    setStats("chartSalesCat", top ? [
      { l: "Sumber Terbesar", v: top.name + " · " + top.pct + "%" },
      { l: "Sumber Aktif", v: top.n + " dari " + SALES_CODES.length }
    ] : []);
    Charts.hbars($("chartSalesCat"), { items: items, colorVar: "--ser-1", limit: 8,
      ariaLabel: "Pendapatan per kategori " + year, empty: "Belum ada pendapatan." });
  }

  function renderChartsFor(view) {
    if (!window.Charts) return;
    if (view === "cashflow") renderCashflowCharts();
    else if (view === "expense") renderExpense();
    else if (view === "asset") renderAssets();
    else if (view === "invest") renderInvest();
    else if (view === "sales") renderSales();
    else if (view === "summary") renderSummary();
  }

  // ---- View switching ----
  var currentView = "cashflow";
  function switchView(view) {
    currentView = view;
    el.viewCashflow.hidden = view !== "cashflow";
    el.viewExpense.hidden = view !== "expense";
    el.viewAsset.hidden = view !== "asset";
    el.viewInvest.hidden = view !== "invest";
    el.viewSales.hidden = view !== "sales";
    el.viewSummary.hidden = view !== "summary";
    el.navTabs.forEach(function (tab) {
      tab.classList.toggle("is-active", tab.getAttribute("data-view") === view);
    });
    if (view === "cashflow") { renderCashflowCharts(); renderSplit(); }
    if (view === "expense") renderExpense();
    if (view === "asset") renderAssets();
    if (view === "invest") renderInvest();
    if (view === "sales") renderSales();
    if (view === "summary") renderSummary();
    animateView(view);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ---- Money input live formatting ----
  function attachMoneyFormat(input) {
    input.addEventListener("input", function () {
      var num = parseMoney(input.value);
      input.value = num ? formatRupiah(num) : "";
    });
  }

  // ---- Events ----
  el.form.addEventListener("submit", function (e) {
    e.preventDefault();
    var cashOut = parseMoney(el.cashOut.value);
    var cashIn = parseMoney(el.cashIn.value);

    if (!cashOut && !cashIn) {
      alert("Isi minimal salah satu: Cash Out atau Cash In.");
      return;
    }

    addOrUpdate({
      tanggal: el.tanggal.value,
      akun: el.akun.value,
      kode: el.kode.value,
      keterangan: el.keterangan.value.trim(),
      cashOut: cashOut,
      cashIn: cashIn
    });
    resetForm();
  });

  el.cancelEdit.addEventListener("click", resetForm);
  el.search.addEventListener("input", render);
  el.filterAkun.addEventListener("change", render);
  el.filterKode.addEventListener("change", render);
  el.filterMonth.addEventListener("change", render);
  el.exportBtn.addEventListener("click", exportCSV);
  attachMoneyFormat(el.cashOut);
  attachMoneyFormat(el.cashIn);

  // Saldo Awal events
  el.openingToggle.addEventListener("click", openOpeningForm);
  el.openingCancel.addEventListener("click", closeOpeningForm);
  attachMoneyFormat(el.openingLive);
  attachMoneyFormat(el.openingKeranjang);
  el.openingForm.addEventListener("submit", function (e) {
    e.preventDefault();
    openingBalance = {
      Livecraft: parseMoney(el.openingLive.value),
      Keranjang: parseMoney(el.openingKeranjang.value)
    };
    saveOpening();
    closeOpeningForm();
    render();
  });

  // Dana Darurat events
  el.emgToggle.addEventListener("click", openEmergencyForm);
  el.emgCancel.addEventListener("click", closeEmergencyForm);
  attachMoneyFormat(el.emgAmount);
  el.emgForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var amount = parseMoney(el.emgAmount.value);
    var start = el.emgDate.value;
    if (!amount) { alert("Isi jumlah dana darurat."); return; }
    if (!start) { alert("Pilih tanggal mulai perhitungan."); return; }
    emergency = { amount: amount, startDate: start };
    saveEmergency(emergency);
    closeEmergencyForm();
    renderEmergency();
  });
  el.emgReset.addEventListener("click", function () {
    if (!confirm("Hapus pengaturan dana darurat?")) return;
    emergency = null;
    if (useCloud) { window.Cloud.saveDoc("emergency", null).catch(cloudError); }
    else { try { localStorage.removeItem(EMERGENCY_KEY); } catch (e) {} }
    closeEmergencyForm();
    renderEmergency();
  });

  // Expense Log events
  el.navTabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      switchView(tab.getAttribute("data-view"));
    });
  });
  el.expenseYear.addEventListener("change", renderExpense);
  el.exportExpenseBtn.addEventListener("click", exportExpenseCSV);

  // Asset events
  el.assetForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var harga = parseMoney(el.assetHarga.value);
    var qty = parseInt(el.assetQty.value, 10) || 0;
    var total = parseMoney(el.assetTotalInput.value);
    if (harga && qty) total = harga * qty; // harga x qty selalu menang bila ada
    if (!total) {
      alert("Isi Harga Satuan + Qty, atau isi Total secara manual.");
      return;
    }
    addOrUpdateAsset({
      nama: el.assetNama.value.trim(),
      harga: harga,
      qty: qty || 1,
      total: total,
      pembayaran: el.assetPembayaran.value,
      bulan: el.assetBulan.value
    });
    resetAssetForm();
  });
  el.assetCancelEdit.addEventListener("click", resetAssetForm);
  el.assetSearch.addEventListener("input", renderAssets);
  el.assetFilterBulan.addEventListener("change", renderAssets);
  el.assetFilterPembayaran.addEventListener("change", renderAssets);
  el.exportAssetBtn.addEventListener("click", exportAssetCSV);
  el.assetImportBtn.addEventListener("click", function () {
    if (el.assetImport.hidden) openAssetImport(); else closeAssetImport();
  });
  el.assetImportRun.addEventListener("click", runAssetImport);
  el.assetImportCancel.addEventListener("click", closeAssetImport);
  el.assetHarga.addEventListener("input", computeFormTotal);
  el.assetQty.addEventListener("input", computeFormTotal);
  attachMoneyFormat(el.assetHarga);
  attachMoneyFormat(el.assetTotalInput);

  // Investment events
  el.investYear.addEventListener("change", renderInvest);
  el.exportInvestBtn.addEventListener("click", exportInvestCSV);

  // Sales events
  el.salesYear.addEventListener("change", renderSales);
  el.exportSalesBtn.addEventListener("click", exportSalesCSV);

  // Summary events
  el.summaryYear.addEventListener("change", renderSummary);
  el.summaryPeriod.addEventListener("change", function () {
    renderSheet(el.summaryYear.value || String(new Date().getFullYear()));
  });
  el.exportSheetBtn.addEventListener("click", exportSheetCSV);
  el.splitYear.addEventListener("change", renderSplit);

  el.allocEditBtn.addEventListener("click", function () {
    if (el.allocEditor.hidden) openAllocEditor(); else closeAllocEditor();
  });
  el.allocAdd.addEventListener("click", function () { el.allocRows.appendChild(allocRow("", "")); updateAllocTotal(); });
  el.allocSave.addEventListener("click", commitAlloc);
  el.allocCancel.addEventListener("click", closeAllocEditor);
  el.allocReset.addEventListener("click", function () { renderAllocRows(normalizeAlloc(null)); });

  // Re-render the active view's charts on resize (debounced) so SVG widths
  // track the container.
  var resizeTimer = null;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () { renderChartsFor(currentView); }, 180);
  });

  // ================= AUTH / CLOUD INIT =================
  var signupMode = false;

  function renderInitial() {
    render();
    populateYears();
    if (window.Charts) renderCashflowCharts();
    animateView(currentView);
  }

  // Entrance motion for a freshly shown view (GSAP; no-op without it).
  function animateView(view) {
    if (!window.Motion) return;
    var root = document.getElementById("view-" + view);
    Motion.enter(root);
    Motion.charts(root);
    Motion.countUp(root.querySelectorAll(".card-value, .ins-v, .emg-value"));
  }

  function showGate(mode) {
    // mode: "loading" | "login" | "notconfigured" | "none"
    el.authGate.hidden = (mode === "none");
    el.authLoading.hidden = (mode !== "loading");
    el.authForm.hidden = (mode !== "login");
    el.authNotConfigured.hidden = (mode !== "notconfigured");
    if (window.AuthBg) {
      if (mode === "none") AuthBg.stop(); else AuthBg.start(el.authGate);
    }
  }

  function applyCloudDoc(key, data) {
    if (key === "transactions") { transactions = Array.isArray(data) ? data : []; migrateCodes(transactions); }
    else if (key === "assets") assets = Array.isArray(data) ? data : [];
    else if (key === "emergency") emergency = data || null;
    else if (key === "opening") openingBalance = normalizeOpening(data);
    else if (key === "allocation") allocation = normalizeAlloc(data);
  }

  function enterApp(session) {
    el.userEmail.textContent = (session && session.user && session.user.email) || "";
    el.userBox.hidden = false;
    showGate("loading");
    window.Cloud.loadAll().then(function (d) {
      var needsMigration = Array.isArray(d.transactions) &&
        d.transactions.some(function (t) { return t && CODE_RENAMES[t.kode]; });
      applyCloudDoc("transactions", d.transactions); // migrates in memory
      applyCloudDoc("assets", d.assets);
      applyCloudDoc("emergency", d.emergency);
      applyCloudDoc("opening", d.opening);
      applyCloudDoc("allocation", d.allocation);
      if (needsMigration) save(); // persist the renamed codes to the cloud once
      showGate("none");
      resetForm();
      resetAssetForm();
      renderInitial();
      window.Cloud.subscribe(function (key, data) {
        applyCloudDoc(key, data);
        render();
        if (currentView === "cashflow") { if (window.Charts) renderCashflowCharts(); }
        else renderChartsFor(currentView);
      });
    }).catch(function (e) {
      showGate("login");
      showAuthError("Gagal memuat data: " + (e && e.message ? e.message : e));
    });
  }

  function showAuthError(msg) {
    el.authError.textContent = msg;
    el.authError.hidden = !msg;
  }

  function setAuthMode(signup) {
    signupMode = signup;
    el.authTitle.textContent = signup ? "Daftar" : "Masuk";
    el.authSubmit.textContent = signup ? "Daftar" : "Masuk";
    el.authSub.textContent = signup
      ? "Buat akun untuk mengakses data keuangan bersama."
      : "Masuk untuk mengakses data keuangan bersama.";
    el.authToggle.textContent = signup ? "Masuk" : "Daftar";
    el.authToggleWrap.childNodes[0].nodeValue = signup ? "Sudah punya akun? " : "Belum punya akun? ";
    el.authPassword.setAttribute("autocomplete", signup ? "new-password" : "current-password");
    showAuthError("");
  }

  function initCloud() {
    setAuthMode(false);
    el.authToggle.addEventListener("click", function () { setAuthMode(!signupMode); });
    el.logoutBtn.addEventListener("click", function () {
      window.Cloud.signOut().then(function () {
        transactions = []; assets = []; emergency = null;
        openingBalance = normalizeOpening(null);
        allocation = normalizeAlloc(null);
        el.userBox.hidden = true;
        el.authEmail.value = ""; el.authPassword.value = "";
        setAuthMode(false);
        showGate("login");
      });
    });
    el.authForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var email = el.authEmail.value.trim();
      var pass = el.authPassword.value;
      if (!email || !pass) return;
      showAuthError("");
      el.authSubmit.disabled = true;
      var op = signupMode ? window.Cloud.signUp(email, pass) : window.Cloud.signIn(email, pass);
      op.then(function (data) {
        el.authSubmit.disabled = false;
        if (data && data.session) {
          enterApp(data.session);
        } else {
          // signUp tanpa sesi = perlu konfirmasi email
          setAuthMode(false);
          showAuthError("Akun dibuat. Cek email untuk konfirmasi, lalu masuk.");
        }
      }).catch(function (err) {
        el.authSubmit.disabled = false;
        showAuthError(err && err.message ? err.message : "Gagal masuk.");
      });
    });

    window.Cloud.getSession().then(function (session) {
      if (session) enterApp(session);
      else showGate("login");
    }).catch(function () { showGate("login"); });
  }

  // ---- Init ----
  if (window.Icons) Icons.hydrate();
  populateCodes();
  populateAssetSelectors();
  resetForm();
  resetAssetForm();

  if (useCloud) {
    initCloud();
  } else {
    if (migrateCodes(transactions)) save(); // local data: rename old codes once
    if (window.Cloud) {
      // SDK ada tapi belum dikonfigurasi → jalan lokal (gerbang tetap tersembunyi)
    }
    renderInitial();
  }
})();
