# FinanceLiveCraft — Pencatatan Cashflow

Website sederhana untuk mencatat arus kas (cashflow) seperti pada spreadsheet
Livecraft: setiap transaksi memiliki **Tanggal**, **Kode**, **Keterangan**,
**Cash Out**, dan **Cash In**.

Aplikasi punya lima menu: **Cash Flow**, **Expense Log**, **Aset**, **Investasi**,
dan **Sales**.

## Fitur

### 1. Cash Flow
- **Input transaksi** dengan pilihan **Kode** lewat dropdown:
  `ADM, ADS, AST, CMS, DP, EAT, GH, HTB, INC, INT, NC, NM, OEX, PLN, RMH,
  SHM, SOA, TRAN`
  (kode penjualan `DP/NM/NC/SOA/HTB` dipakai untuk menu Sales)
- Format **Rupiah** otomatis pada kolom uang.
- **Ringkasan** Total Cash In, Total Cash Out, Saldo, dan jumlah transaksi
  (mengikuti filter yang aktif).
- **Filter** berdasarkan bulan & kode, serta **pencarian** keterangan.
- **Edit**, **hapus**, dan **Export CSV**.

### 2. Expense Log
- **Otomatis** dihitung dari transaksi **Cash Out** di Cash Flow — tidak perlu
  input ulang. Income (`INC`) tidak dihitung.
- Matriks pengeluaran **per kode × per bulan** (Jan–Des) untuk tahun terpilih,
  dikelompokkan: Salary & Wages, Marketing, General & Administrative, Other.
- Baris **TOTAL OPERATING EXPENSE**, total per kategori, selektor tahun,
  kartu ringkasan, dan Export CSV.

### 3. Aset
- **Input aset**: Nama Barang, Harga Satuan, Qty, **Total** (otomatis =
  Harga × Qty, bisa diisi manual bila harga kosong), **Pembayaran**
  (Hutang/Cash/Transfer/Debit/Kartu Kredit), dan **Bulan**.
- Kartu ringkasan: **Total Aset**, Jumlah Item, dan **Total Hutang**.
- Filter bulan & pembayaran, pencarian, edit/hapus, dan Export CSV.

### 4. Investasi
- **Otomatis** diambil dari transaksi berkode **`SHM`** (Saham/Investasi) di
  Cash Flow — **Setoran** = Cash Out, **Penarikan** = Cash In.
- Ledger transaksi dengan **Saldo Berjalan** (modal tertanam kumulatif).
- Kartu ringkasan: **Total Setoran**, **Total Penarikan**, dan
  **Modal Tertanam (Bersih)**.
- Selektor tahun dan Export CSV.

### 5. Sales
- **Otomatis** dihitung dari transaksi **Cash In** di Cash Flow untuk kode
  penjualan: `DP, NM, NC, INC` (Cash Sales) dan `SOA, HTB` (Non-Sales).
  Withdraw investasi (`SHM`) tidak dihitung sebagai penjualan.
- Matriks pendapatan **per kategori × per bulan** (Jan–Des), dikelompokkan
  **Cash Sales** dan **Cash Received from Non-Sales Activities**.
- Baris **TOTAL**, total per kategori, selektor tahun, kartu ringkasan
  (Total Pendapatan, rata-rata, bulan tertinggi), dan Export CSV.

Semua data disimpan otomatis di browser (**localStorage**) — tanpa backend.

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
| `index.html` | Struktur halaman & tiga menu (Cash Flow, Expense Log, Aset) |
| `styles.css` | Tampilan / tema hijau-oranye, responsif & dark mode |
| `app.js` | Logika: CRUD, format Rupiah, filter, agregasi expense, export |

## Catatan

Data tersimpan per-browser. Untuk memindahkan data, gunakan tombol
**Export CSV**.
