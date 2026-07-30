/* FinanceLiveCraft — Pencatatan Cashflow
 * Data disimpan di localStorage. Tanpa backend.
 */
(function () {
  "use strict";

  var STORAGE_KEY = "financelivecraft.transactions.v1";

  // Kode keterangan yang tersedia (dengan label untuk membantu pengguna).
  var CODES = [
    { code: "ADM",  label: "Admin / Biaya Bank" },
    { code: "ADS",  label: "Iklan / Ads" },
    { code: "AST",  label: "Aset / Perlengkapan" },
    { code: "CMS",  label: "Komisi" },
    { code: "EAT",  label: "Makan / Konsumsi" },
    { code: "GH",   label: "Gaji / Honor" },
    { code: "INC",  label: "Income / Pemasukan" },
    { code: "INT",  label: "Internet" },
    { code: "OEX",  label: "Operasional Lain" },
    { code: "PLN",  label: "Listrik / PLN" },
    { code: "RMH",  label: "Rumah / Sewa" },
    { code: "SHM",  label: "Saham / Investasi" },
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

  var MONTHS_SHORT = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Ags","Sep","Okt","Nov","Des"];

  // ---- State ----
  var transactions = load();

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
    exportExpenseBtn: document.getElementById("exportExpenseBtn")
  };

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
    var monthTotals = new Array(12).fill(0);
    var grandTotal = 0;
    Object.keys(matrix).forEach(function (code) {
      for (var m = 0; m < 12; m++) {
        monthTotals[m] += matrix[code][m];
        grandTotal += matrix[code][m];
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
  }

  function cell(value) {
    return value ? formatRupiah(value) : "";
  }

  function buildExpenseTable(matrix, monthTotals) {
    var html = '<table class="expense-table">';

    // Header
    html += "<thead><tr>";
    html += '<th class="exp-cat">Kategori Pengeluaran</th>';
    MONTHS_SHORT.forEach(function (m) { html += '<th class="col-num">' + m + "</th>"; });
    html += '<th class="col-num exp-total-col">Total</th>';
    html += "</tr></thead>";

    html += "<tbody>";
    EXPENSE_GROUPS.forEach(function (group) {
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

    // Footer: total operating expense
    var grand = monthTotals.reduce(function (a, b) { return a + b; }, 0);
    html += '<tfoot><tr class="exp-grand">';
    html += '<td class="exp-cat">TOTAL OPERATING EXPENSE</td>';
    monthTotals.forEach(function (v) { html += '<td class="col-num">' + cell(v) + "</td>"; });
    html += '<td class="col-num exp-total-col">' + formatRupiah(grand) + "</td>";
    html += "</tr></tfoot>";

    html += "</table>";
    return html;
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
    Object.keys(matrix).forEach(function (code) {
      for (var m = 0; m < 12; m++) monthTotals[m] += matrix[code][m];
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

  // ---- View switching ----
  function switchView(view) {
    var isExpense = view === "expense";
    el.viewCashflow.hidden = isExpense;
    el.viewExpense.hidden = !isExpense;
    el.navTabs.forEach(function (tab) {
      tab.classList.toggle("is-active", tab.getAttribute("data-view") === view);
    });
    if (isExpense) renderExpense();
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

  // ---- Init ----
  populateCodes();
  resetForm();
  render();
  populateYears();
})();
