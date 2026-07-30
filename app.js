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
    footOut: document.getElementById("footOut")
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
      tdDate.textContent = formatDate(t.tanggal);

      var tdCode = document.createElement("td");
      var badge = document.createElement("span");
      badge.className = "badge";
      badge.textContent = t.kode;
      tdCode.appendChild(badge);

      var tdDesc = document.createElement("td");
      tdDesc.textContent = t.keterangan;

      var tdOut = document.createElement("td");
      tdOut.className = "col-num neg";
      tdOut.textContent = t.cashOut ? formatRupiah(t.cashOut) : "";

      var tdIn = document.createElement("td");
      tdIn.className = "col-num pos";
      tdIn.textContent = t.cashIn ? formatRupiah(t.cashIn) : "";

      var tdAct = document.createElement("td");
      tdAct.className = "col-actions";
      var editBtn = document.createElement("button");
      editBtn.className = "icon-btn";
      editBtn.title = "Edit";
      editBtn.textContent = "✎";
      editBtn.addEventListener("click", function () { startEdit(t.id); });
      var delBtn = document.createElement("button");
      delBtn.className = "icon-btn del";
      delBtn.title = "Hapus";
      delBtn.textContent = "🗑";
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

  // ---- Init ----
  populateCodes();
  resetForm();
  render();
})();
