/* FinanceLiveCraft — Pencatatan Cashflow
 * Data disimpan di localStorage. Tanpa backend.
 */
(function () {
  "use strict";

  var STORAGE_KEY = "financelivecraft.transactions.v1";
  var ASSET_KEY = "financelivecraft.assets.v1";

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
    { code: "GH",   label: "Gaji / Honor" },
    { code: "HTB",  label: "Hutang Bank / Pinjaman" },
    { code: "INC",  label: "Income / Pemasukan" },
    { code: "INT",  label: "Internet" },
    { code: "NC",   label: "INTHEBOX Komisi (Penjualan)" },
    { code: "NM",   label: "INTHEBOX Bulanan (Penjualan)" },
    { code: "OEX",  label: "Operasional Lain" },
    { code: "PLN",  label: "Listrik / PLN" },
    { code: "RMH",  label: "Rumah / Sewa" },
    { code: "SHM",  label: "Saham / Investasi" },
    { code: "SOA",  label: "Sale of Asset (Penjualan Aset)" },
    { code: "TRAN", label: "Transportasi" }
  ];

  var CODE_LABEL = {};
  CODES.forEach(function (c) { CODE_LABEL[c.code] = c.label; });

  // Struktur Expense Log (mengikuti spreadsheet EXPENSE CALCULATION).
  // Setiap baris memakai kode dari menu Cash Flow; kode INC (income) tidak
  // termasuk karena bukan pengeluaran. Nilai diambil otomatis dari Cash Out.
  var EXPENSE_GROUPS = [
    {
      title: "Salary & Wages Expense",
      rows: [
        { code: "GH",  label: "Gaji / Honor Live Streamer" },
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
        { code: "DP",  label: "INTHEBOX DP" },
        { code: "NM",  label: "INTHEBOX (Monthly)" },
        { code: "NC",  label: "INTHEBOX (Commission)" },
        { code: "INC", label: "Income Lainnya" }
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
    groups.forEach(function (g) { g.rows.forEach(function (r) { out.push(r.code); }); });
    return out;
  }
  var EXPENSE_CODES = flattenCodes(EXPENSE_GROUPS);
  var SALES_CODES = flattenCodes(SALES_GROUPS);

  // Pembagian laba bersih (Profit Log Person) — total harus 100%.
  var PROFIT_SHARES = [
    { name: "Wiliam",     pct: 0.20 },
    { name: "Reyga",      pct: 0.20 },
    { name: "Kevin",      pct: 0.20 },
    { name: "Investment", pct: 0.30 },
    { name: "Ads",        pct: 0.10 }
  ];

  var MONTHS_SHORT = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Ags","Sep","Okt","Nov","Des"];

  // ---- State ----
  var transactions = load();
  var assets = loadAssets();

  // ---- Elements ----
  var el = {
    form: document.getElementById("entryForm"),
    editId: document.getElementById("editId"),
    tanggal: document.getElementById("tanggal"),
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
    filterKode: document.getElementById("filterKode"),
    filterMonth: document.getElementById("filterMonth"),
    exportBtn: document.getElementById("exportBtn"),
    totalIn: document.getElementById("totalIn"),
    totalOut: document.getElementById("totalOut"),
    balance: document.getElementById("balance"),
    txCount: document.getElementById("txCount"),
    footIn: document.getElementById("footIn"),
    footOut: document.getElementById("footOut"),
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
    summaryWrap: document.getElementById("summaryWrap"),
    summaryCards: document.getElementById("summaryCards"),
    summaryEmpty: document.getElementById("summaryEmpty"),
    exportSummaryBtn: document.getElementById("exportSummaryBtn")
  };

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

    return transactions.filter(function (t) {
      if (kode && t.kode !== kode) return false;
      if (month && monthKey(t.tanggal) !== month) return false;
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

    rows.forEach(function (t) {
      totalIn += t.cashIn;
      totalOut += t.cashOut;

      var tr = document.createElement("tr");

      var tdDate = document.createElement("td");
      tdDate.className = "col-date";
      tdDate.setAttribute("data-label", "Tanggal");
      tdDate.textContent = formatDate(t.tanggal);

      var tdCode = document.createElement("td");
      tdCode.setAttribute("data-label", "Kode");
      var badge = document.createElement("span");
      badge.className = "badge";
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
      editBtn.innerHTML = '<span aria-hidden="true">✎</span>';
      editBtn.addEventListener("click", function () { startEdit(t.id); });
      var delBtn = document.createElement("button");
      delBtn.className = "icon-btn del";
      delBtn.type = "button";
      delBtn.title = "Hapus";
      delBtn.setAttribute("aria-label", "Hapus transaksi");
      delBtn.innerHTML = '<span aria-hidden="true">🗑</span>';
      delBtn.addEventListener("click", function () { removeTx(t.id); });
      tdAct.appendChild(editBtn);
      tdAct.appendChild(delBtn);

      tr.appendChild(tdDate);
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
    var header = ["Tanggal", "Kode", "Keterangan", "Cash Out", "Cash In"];
    var lines = [header.join(",")];
    rows.forEach(function (t) {
      var cells = [
        t.tanggal,
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

    html += "<thead><tr>";
    html += '<th class="exp-cat">' + escapeHtml(opts.catLabel) + "</th>";
    MONTHS_SHORT.forEach(function (m) { html += '<th class="col-num">' + m + "</th>"; });
    html += '<th class="col-num exp-total-col">Total</th>';
    html += "</tr></thead>";

    html += "<tbody>";
    groups.forEach(function (group) {
      html += '<tr class="exp-group"><td colspan="14">' + group.title + "</td></tr>";
      group.rows.forEach(function (row) {
        var vals = matrix[row.code] || new Array(12).fill(0);
        var rowTotal = vals.reduce(function (a, b) { return a + b; }, 0);
        html += "<tr>";
        html += '<td class="exp-cat"><span class="badge">' + row.code + "</span> " + escapeHtml(row.label) + "</td>";
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
        lines.push(['"' + row.label + '"', row.code].concat(vals).concat([rowTotal]).join(","));
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
      editBtn.innerHTML = '<span aria-hidden="true">✎</span>';
      editBtn.addEventListener("click", function () { startEditAsset(a.id); });
      var delBtn = document.createElement("button");
      delBtn.className = "icon-btn del";
      delBtn.type = "button";
      delBtn.title = "Hapus";
      delBtn.setAttribute("aria-label", "Hapus aset");
      delBtn.innerHTML = '<span aria-hidden="true">🗑</span>';
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
        lines.push(['"' + row.label + '"', row.code].concat(vals).concat([rowTotal]).join(","));
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

  // Satu tabel ringkasan: baris berlabel, kolom bulan + total.
  function buildSummaryTable(headerClass, title, rows) {
    var html = '<table class="expense-table summary-table">';
    html += '<thead><tr class="' + headerClass + '">';
    html += '<th class="exp-cat">' + escapeHtml(title) + "</th>";
    MONTHS_SHORT.forEach(function (m) { html += '<th class="col-num">' + m + "</th>"; });
    html += '<th class="col-num exp-total-col">Total</th>';
    html += "</tr></thead><tbody>";
    rows.forEach(function (r) {
      var rowTotal = r.values.reduce(function (a, b) { return a + b; }, 0);
      html += "<tr>";
      html += '<td class="exp-cat">' + escapeHtml(r.label) + "</td>";
      for (var m = 0; m < 12; m++) html += '<td class="col-num">' + cell(r.values[m]) + "</td>";
      html += '<td class="col-num exp-total-col">' + cell(rowTotal) + "</td>";
      html += "</tr>";
    });
    html += "</tbody></table>";
    return '<section class="panel table-panel sum-panel"><div class="table-wrap">' + html + "</div></section>";
  }

  function computeSummary(year) {
    var sales = monthTotalsOf(computeSalesMatrix(year), SALES_CODES);
    var expense = monthTotalsOf(computeExpenseMatrix(year), EXPENSE_CODES);
    var profit = sales.map(function (s, i) { return s - expense[i]; });
    return { sales: sales, expense: expense, profit: profit };
  }

  function renderSummary() {
    populateSummaryYears();
    var year = el.summaryYear.value || String(new Date().getFullYear());
    var s = computeSummary(year);

    var sum = function (a) { return a.reduce(function (x, y) { return x + y; }, 0); };
    var grandSales = sum(s.sales), grandExp = sum(s.expense), grandProfit = grandSales - grandExp;

    if (grandSales === 0 && grandExp === 0) {
      el.summaryWrap.innerHTML = "";
      el.summaryEmpty.hidden = false;
      el.summaryCards.innerHTML = "";
      if (window.Charts) renderSummaryCharts(s, grandProfit);
      return;
    }
    el.summaryEmpty.hidden = true;

    var personRows = PROFIT_SHARES.map(function (p) {
      return {
        label: p.name + " (" + Math.round(p.pct * 100) + "%)",
        values: s.profit.map(function (v) { return v * p.pct; })
      };
    });

    el.summaryWrap.innerHTML =
      buildSummaryTable("sum-head-sales", "Sales Log ( Laba kotor )", [{ label: "INTHEBOX", values: s.sales }]) +
      buildSummaryTable("sum-head-expense", "Expense Log ( Beban )", [{ label: "INTHEBOX Expense", values: s.expense }]) +
      buildSummaryTable("sum-head-profit", "Profit Log ( Laba bersih )", [{ label: "INTHEBOX", values: s.profit }]) +
      buildSummaryTable("sum-head-profit", "Profit Log Person", personRows);

    var cards = [
      { label: "Total Pendapatan (Tahun)", value: formatRupiah(grandSales), cls: "card-in" },
      { label: "Total Beban (Tahun)", value: formatRupiah(grandExp), cls: "card-out" },
      { label: "Laba Bersih (Tahun)", value: formatRupiah(grandProfit), cls: "card-balance" }
    ];
    el.summaryCards.innerHTML = cards.map(function (c) {
      return '<div class="card ' + c.cls + '"><div class="card-body">' +
        '<span class="card-label">' + c.label + "</span>" +
        '<span class="card-value">' + c.value + "</span></div></div>";
    }).join("");

    if (window.Charts) renderSummaryCharts(s, grandProfit);
  }

  function exportSummaryCSV() {
    var year = el.summaryYear.value || String(new Date().getFullYear());
    var s = computeSummary(year);
    var sum = function (a) { return a.reduce(function (x, y) { return x + y; }, 0); };
    if (sum(s.sales) === 0 && sum(s.expense) === 0) {
      alert("Tidak ada data untuk diekspor pada tahun " + year + ".");
      return;
    }

    var lines = [["Bagian", "Item"].concat(MONTHS_SHORT).concat(["Total"]).join(",")];
    function pushRow(section, label, values) {
      lines.push(['"' + section + '"', '"' + label + '"'].concat(values.map(function (v) { return Math.round(v); })).concat([Math.round(sum(values))]).join(","));
    }
    pushRow("Sales Log (Laba kotor)", "INTHEBOX", s.sales);
    pushRow("Expense Log (Beban)", "INTHEBOX Expense", s.expense);
    pushRow("Profit Log (Laba bersih)", "INTHEBOX", s.profit);
    PROFIT_SHARES.forEach(function (p) {
      pushRow("Profit Log Person", p.name + " (" + Math.round(p.pct * 100) + "%)", s.profit.map(function (v) { return v * p.pct; }));
    });

    var blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = "summary-" + year + ".csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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

  // ---- Cash Flow charts ----
  function renderCashflowCharts() {
    var year = latestYear();
    var inA = new Array(12).fill(0), outA = new Array(12).fill(0);
    transactions.forEach(function (t) {
      if (!t.tanggal || t.tanggal.slice(0, 4) !== year) return;
      var m = parseInt(t.tanggal.slice(5, 7), 10) - 1;
      if (m < 0 || m > 11) return;
      inA[m] += t.cashIn || 0; outA[m] += t.cashOut || 0;
    });
    Charts.bars($("chartCashflow"), {
      labels: MONTHS_SHORT,
      series: [
        { name: "Cash In (" + year + ")", colorVar: "--ser-1", values: inA },
        { name: "Cash Out", colorVar: "--ser-2", values: outA }
      ],
      empty: "Belum ada transaksi."
    });

    var exp = computeExpenseMatrix(year);
    var items = EXPENSE_CODES.map(function (code) {
      return { label: truncate(code + " · " + (CODE_LABEL[code] || code), 22), value: sumArr(exp[code] || []) };
    });
    Charts.hbars($("chartCashflowTop"), { items: items, colorVar: "--ser-2", limit: 6, empty: "Belum ada pengeluaran." });
  }

  // ---- Expense charts ----
  function renderExpenseCharts(year, matrix) {
    var monthly = new Array(12).fill(0);
    EXPENSE_CODES.forEach(function (code) {
      var vals = matrix[code] || [];
      for (var m = 0; m < 12; m++) monthly[m] += vals[m] || 0;
    });
    Charts.bars($("chartExpenseTrend"), {
      labels: MONTHS_SHORT,
      series: [{ name: "Beban", colorVar: "--ser-2", values: monthly }],
      empty: "Belum ada beban."
    });
    var items = EXPENSE_CODES.map(function (code) {
      return { label: truncate(code + " · " + (CODE_LABEL[code] || code), 22), value: sumArr(matrix[code] || []) };
    });
    Charts.hbars($("chartExpenseCat"), { items: items, colorVar: "--ser-2", limit: 8, empty: "Belum ada beban." });
  }

  // ---- Asset charts ----
  function renderAssetCharts() {
    var byPay = {}, byMonth = {};
    MONTHS_FULL.forEach(function (m) { byMonth[m] = 0; });
    assets.forEach(function (a) {
      var tot = assetTotalOf(a);
      byPay[a.pembayaran] = (byPay[a.pembayaran] || 0) + tot;
      byMonth[a.bulan] = (byMonth[a.bulan] || 0) + tot;
    });
    var payItems = Object.keys(byPay).map(function (k, i) {
      return { label: k, value: byPay[k], colorVar: PALETTE[i % PALETTE.length] };
    });
    Charts.donut($("chartAssetPay"), { items: payItems, centerLabel: "Total Aset", empty: "Belum ada aset." });

    Charts.bars($("chartAssetMonth"), {
      labels: MONTHS_SHORT,
      series: [{ name: "Aset", colorVar: "--ser-1", values: MONTHS_FULL.map(function (m) { return byMonth[m] || 0; }) }],
      empty: "Belum ada aset."
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
    Charts.area($("chartInvestSaldo"), { labels: MONTHS_SHORT, values: saldo, colorVar: "--ser-1", empty: "Belum ada investasi." });
    Charts.bars($("chartInvestFlow"), {
      labels: MONTHS_SHORT,
      series: [
        { name: "Setoran (" + year + ")", colorVar: "--ser-1", values: setor },
        { name: "Penarikan", colorVar: "--ser-2", values: tarik }
      ],
      empty: "Belum ada investasi."
    });
  }

  // ---- Sales charts ----
  function renderSalesCharts(year, matrix) {
    var monthly = new Array(12).fill(0);
    SALES_CODES.forEach(function (code) {
      var vals = matrix[code] || [];
      for (var m = 0; m < 12; m++) monthly[m] += vals[m] || 0;
    });
    Charts.bars($("chartSalesTrend"), {
      labels: MONTHS_SHORT,
      series: [{ name: "Pendapatan", colorVar: "--ser-1", values: monthly }],
      empty: "Belum ada pendapatan."
    });
    var items = SALES_CODES.map(function (code) {
      return { label: truncate(code + " · " + (CODE_LABEL[code] || code), 22), value: sumArr(matrix[code] || []) };
    });
    Charts.hbars($("chartSalesCat"), { items: items, colorVar: "--ser-1", limit: 8, empty: "Belum ada pendapatan." });
  }

  // ---- Summary charts ----
  function renderSummaryCharts(s, grandProfit) {
    Charts.bars($("chartSummaryCombo"), {
      labels: MONTHS_SHORT,
      series: [
        { name: "Pendapatan", colorVar: "--ser-1", values: s.sales },
        { name: "Beban", colorVar: "--ser-2", values: s.expense },
        { name: "Laba Bersih", colorVar: "--ser-3", values: s.profit }
      ],
      empty: "Belum ada data.",
      height: 260
    });
    var splitItems = PROFIT_SHARES.map(function (p, i) {
      return { label: p.name + " (" + Math.round(p.pct * 100) + "%)", value: Math.max(0, grandProfit) * p.pct, colorVar: PALETTE[i % PALETTE.length] };
    });
    Charts.donut($("chartProfitSplit"), { items: splitItems, centerLabel: "Laba Bersih", empty: "Belum ada laba." });
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
    if (view === "cashflow") renderCashflowCharts();
    if (view === "expense") renderExpense();
    if (view === "asset") renderAssets();
    if (view === "invest") renderInvest();
    if (view === "sales") renderSales();
    if (view === "summary") renderSummary();
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
      kode: el.kode.value,
      keterangan: el.keterangan.value.trim(),
      cashOut: cashOut,
      cashIn: cashIn
    });
    resetForm();
  });

  el.cancelEdit.addEventListener("click", resetForm);
  el.search.addEventListener("input", render);
  el.filterKode.addEventListener("change", render);
  el.filterMonth.addEventListener("change", render);
  el.exportBtn.addEventListener("click", exportCSV);
  attachMoneyFormat(el.cashOut);
  attachMoneyFormat(el.cashIn);

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
  el.exportSummaryBtn.addEventListener("click", exportSummaryCSV);

  // Re-render the active view's charts on resize (debounced) so SVG widths
  // track the container.
  var resizeTimer = null;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () { renderChartsFor(currentView); }, 180);
  });

  // ---- Init ----
  populateCodes();
  resetForm();
  render();
  populateYears();
  populateAssetSelectors();
  resetAssetForm();
  if (window.Charts) renderCashflowCharts();
})();
