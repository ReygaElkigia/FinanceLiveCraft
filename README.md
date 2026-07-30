# FinanceLiveCraft — Pencatatan Cashflow

Website sederhana untuk mencatat arus kas (cashflow) seperti pada spreadsheet
Livecraft: setiap transaksi memiliki **Tanggal**, **Kode**, **Keterangan**,
**Cash Out**, dan **Cash In**.

## Fitur

- **Input transaksi** dengan pilihan **Kode** lewat dropdown:
  `ADM, ADS, AST, CMS, EAT, GH, INC, INT, OEX, PLN, RMH, SHM, TRAN`
- Format **Rupiah** otomatis pada kolom uang.
- **Ringkasan** Total Cash In, Total Cash Out, Saldo, dan jumlah transaksi
  (mengikuti filter yang aktif).
- **Filter** berdasarkan bulan & kode, serta **pencarian** keterangan.
- **Edit** dan **hapus** transaksi.
- **Export CSV** untuk data yang sedang tampil.
- Data disimpan otomatis di browser (**localStorage**) — tanpa backend.

## Cara Menjalankan

Cukup buka `index.html` di browser. Tidak perlu instalasi apa pun.

Atau jalankan lewat server statis lokal:

```bash
python3 -m http.server 8000
# lalu buka http://localhost:8000
```

## Struktur

| File | Keterangan |
|------|------------|
| `index.html` | Struktur halaman |
| `styles.css` | Tampilan / tema hijau-oranye |
| `app.js` | Logika: CRUD, format Rupiah, filter, export |

## Catatan

Data tersimpan per-browser. Untuk memindahkan data, gunakan tombol
**Export CSV**.
