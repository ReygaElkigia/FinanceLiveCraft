# FinanceLiveCraft — Pencatatan Cashflow

Website sederhana untuk mencatat arus kas (cashflow) seperti pada spreadsheet
Livecraft: setiap transaksi memiliki **Tanggal**, **Kode**, **Keterangan**,
**Cash Out**, dan **Cash In**.

Aplikasi punya enam menu: **Cash Flow**, **Expense Log**, **Aset**,
**Investasi**, **Sales**, dan **Summary**.

## Fitur

### 1. Cash Flow
- **Dua akun/dompet**: setiap transaksi ditandai **Livecraft** atau
  **Keranjang**. Ditampilkan **Saldo per akun** (Cash In/Out masing-masing)
  plus **Total Cash In, Total Cash Out, dan Total Saldo** keseluruhan.
  Bisa difilter per akun.
- **Input transaksi** dengan pilihan **Kode** lewat dropdown:
  `ADM, ADS, AST, CMS, DP, EAT, GA, GCC, GH, GO, HMS, HTB, INT, KMS, KRS, OEX,
  PLC, PLN, RMH, SHL, SHM, SOA, TRAN`
  (pendapatan `PLC` Paket LC, `KRS` Komisi RB & SK, `KMS` Komisi Mamah Salma;
  beban `HMS` Host Mamah Salma, `SHL` Beban Sheila)
  (kode penjualan `PLC/KRS/KMS/DP/SOA/HTB` dipakai untuk menu Sales;
  kode lama `NM`→`PLC`, `NC`→`KRS`, `INC`→`KMS` otomatis dipindah;
  `GO` Gaji Owner tampil berwarna ungu di Cash Flow & Expense Log dengan label
  *tidak dihitung*, tapi **tidak** masuk Total Beban maupun Laba Bersih)
- Format **Rupiah** otomatis pada kolom uang.
- **Ringkasan** Total Cash In, Total Cash Out, Saldo, dan jumlah transaksi
  (mengikuti filter yang aktif).
- **Filter** berdasarkan bulan & kode, serta **pencarian** keterangan.
- **Edit**, **hapus**, dan **Export CSV**.
- **Saldo Awal** — tetapkan modal awal per akun (Livecraft & Keranjang).
  Total Saldo = Saldo Awal + (Cash In − Cash Out).
- **Dana Darurat** — tetapkan jumlah dana darurat & tanggal mulai; sisanya
  otomatis dikurangi total **Cash Out** sejak tanggal itu, lengkap dengan
  bilah progres (hijau/oranye/merah) dan status bila melebihi dana.
- **Split Laba Kotor** — dashboard **Sisa SHU**, **Sisa Cash**, dan **Tersisa**
  per pos lainnya (Beban operasional, Ads, Gaji), diambil dari **Est hitungan**
  di Summary (% × Total Laba kotor) dan direkap per bulan (tabel Jan–Des +
  Total, pilih tahun). Persentase ikut berubah bila diatur di Summary.

### 2. Expense Log
- **Otomatis** dihitung dari transaksi **Cash Out** di Cash Flow — tidak perlu
  input ulang. Kode pendapatan (Cash In) tidak dihitung.
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
  penjualan: `PLC, KRS, KMS, DP` (Cash Sales) dan `SOA, HTB` (Non-Sales).
  Withdraw investasi (`SHM`) tidak dihitung sebagai penjualan.
- Matriks pendapatan **per kategori × per bulan** (Jan–Des), dikelompokkan
  **Cash Sales** dan **Cash Received from Non-Sales Activities**.
- Baris **TOTAL**, total per kategori, selektor tahun, kartu ringkasan
  (Total Pendapatan, rata-rata, bulan tertinggi), dan Export CSV.

### 6. Summary
Tampilan satu lembar persis seperti spreadsheet **Hitungan LC**, dihitung
otomatis dari Cash Flow (pilih tahun + periode Setahun / per bulan):
- **Laba Rugi**
  - Income Paket LC (PLC), Income Komisi RB & SK (KRS), Income Komisi Mamah
    Salma (KMS) → **Total Laba kotor**. Kode pendapatan lain (DP, SOA, HTB)
    ikut tampil bila ada nilainya.
  - Beban Host Livecraft (GH), Host Mamah Salma (HMS), Sheila (SHL), Admin
    (GA), Editor / CC (GCC) (nominal disorot kuning seperti di spreadsheet) →
    **Total Rugi**. Kode beban lain ikut tampil bila ada nilainya; Gaji Owner
    (GO) tampil ungu dan tidak dihitung.
  - **Total Laba bersih** = Total Laba kotor − Total Rugi.
- **Est hitungan** (dari Total Laba kotor): Beban operasional 40%, Cash
  pegangan 5%, SHU 5%, Ads 35%, Gaji 15%, Total, dan **Esti gaji perorang**
  (Gaji ÷ 3). Pos, persen, dan jumlah orang bisa diubah lewat
  **Atur Est. Hitungan**.
- **Export CSV** menghasilkan lembar yang sama.

## Grafik Dashboard

Setiap menu punya grafik yang otomatis mengikuti datanya:

| Menu | Grafik |
|------|--------|
| Cash Flow | Cash In vs Cash Out per bulan (bar) + pengeluaran terbesar per kode (bar) |
| Expense Log | Total beban per bulan (bar) + beban per kategori (bar) |
| Aset | Komposisi aset per pembayaran (donut) + nilai aset per bulan (bar) |
| Investasi | Saldo berjalan (area) + setoran vs penarikan per bulan (bar) |
| Sales | Pendapatan per bulan (bar) + pendapatan per kategori (bar) |

Grafik digambar sebagai **SVG murni** (`charts.js`, tanpa library eksternal),
warnanya mengikuti palet kategorikal yang sudah divalidasi aman untuk buta warna,
dan menyesuaikan tema terang/gelap.

Semua data disimpan otomatis di browser (**localStorage**) — tanpa backend.

## UI, Animasi & Aksesibilitas

- **Ikon SVG** konsisten (tanpa emoji), tombol ikon dengan area sentuh 44px,
  cincin fokus keyboard yang terlihat.
- **Rincian di tiap grafik**: total, rata-rata, bulan tertinggi, porsi %;
  tooltip yang menampilkan semua seri per bulan; label nilai tertinggi.
- **Ringkasan bulan terakhir** di Cash Flow: Cash In/Out/Arus Bersih/jumlah
  transaksi dibanding bulan sebelumnya (naik/turun %).
- **GSAP** (`motion.js`): animasi masuk bertahap, grafik tumbuh, angka KPI
  menghitung naik — hanya saat pindah menu.
- **three.js** (`authbg.js`): latar 3D halus khusus layar login, dimuat hanya
  saat dibutuhkan.
- Semua animasi otomatis **nonaktif** bila perangkat memakai pengaturan
  *kurangi gerakan*, dan web tetap berfungsi normal bila CDN gagal dimuat.

## Penyimpanan Cloud (Supabase) — data bersama + login

Secara default aplikasi menyimpan data di browser (localStorage). Untuk
**berbagi data antar-orang** dengan **login**, aktifkan Supabase:

1. **Buat project** gratis di [supabase.com](https://supabase.com).
2. **Buat tabel & keamanan**: buka **SQL Editor** → tempel isi
   `supabase-setup.sql` → **Run**.
3. **Isi kredensial**: buka **Project Settings → API**, salin **Project URL**
   dan **anon public key** ke `supabase-config.js`:
   ```js
   window.SUPABASE_URL = "https://xxxx.supabase.co";
   window.SUPABASE_ANON_KEY = "eyJ...";
   ```
4. **Buat pengguna**: **Authentication → Users → Add user** (email + password,
   centang *Auto Confirm User*). Ulangi untuk tiap orang yang boleh akses.
   Untuk menutup pendaftaran mandiri: **Authentication → Providers → Email**,
   matikan *Enable Signups*.
5. **Set Site URL Supabase**: **Authentication → URL Configuration → Site URL**
   isi dengan domain Anda (mis. `https://financelivecraft.id`).
6. **Host web-nya** (lihat bagian Hostinger di bawah) lalu bagikan alamatnya.
   Setelah dikonfigurasi, aplikasi menampilkan **layar login** dan semua yang
   masuk melihat **data yang sama**, sinkron otomatis (realtime).

> Catatan: semua pengguna yang login berbagi satu workspace. Penyimpanan
> memakai model *last-write-wins* per dataset — cocok untuk tim kecil yang
> saling percaya. Selama `supabase-config.js` masih berisi `YOUR_...`,
> aplikasi tetap berjalan dengan penyimpanan lokal seperti biasa.

## Hosting (Hostinger)

Situs ini statis (HTML/CSS/JS) — cukup diletakkan di folder `public_html`.
File yang **wajib** diunggah: `index.html`, `styles.css`, `app.js`,
`charts.js`, `cloud.js`, `supabase-config.js`, `icons.js`, `motion.js`,
`authbg.js`. (README & `.sql` opsional,
tidak dipakai saat berjalan.)

**Cara A — File Manager (paling mudah):**

1. Isi dulu `supabase-config.js` dengan kredensial Supabase Anda.
2. hPanel → **File → File Manager → Buka**.
3. Masuk ke folder **`public_html`**. Hapus file bawaan (mis. `default.php`
   / `index.html` contoh) bila ada.
4. Klik **Upload**, pilih ke-9 file di atas. Pastikan `index.html` berada
   **langsung di dalam `public_html`** (bukan di subfolder).
5. Buka domain Anda (mis. `https://financelivecraft.id`) — layar login muncul.

> Untuk memperbarui web nanti, cukup unggah ulang file yang berubah lalu
> **Hapus cache** di hPanel (Dashboard → Fitur dasar → Cache).

**Cara B — Git (auto-deploy):** hPanel → **Tingkat lanjut → GIT** → tambahkan
repository (URL repo, branch, install path `public_html`) → **Deploy**. Ulangi
**Deploy** setiap ada perubahan.

**Penting:**
- Pastikan **SSL aktif** (hPanel → Keamanan → SSL) — Supabase/login butuh
  `https`. Domain baru bisa perlu waktu sampai SSL & DNS selesai.
- `anon key` Supabase memang untuk sisi klien (publik) — keamanan dijaga
  Row Level Security + login. **Jangan** menaruh *service_role key* di sini.

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
| `index.html` | Struktur halaman & enam menu |
| `styles.css` | Tampilan / tema hijau-oranye, responsif & dark mode |
| `app.js` | Logika: CRUD, format Rupiah, filter, agregasi, dashboard, export |
| `charts.js` | Library grafik SVG mini (bar, area, donut) + tooltip |
| `icons.js` | Set ikon SVG |
| `motion.js` | Animasi GSAP (masuk, grafik, count-up) |
| `authbg.js` | Latar 3D three.js untuk layar login |
| `cloud.js` | Lapisan penyimpanan cloud + login (Supabase) |
| `supabase-config.js` | Kredensial Supabase (diisi pengguna) |
| `supabase-setup.sql` | Skrip pembuatan tabel & keamanan di Supabase |

## Catatan

Data tersimpan per-browser. Untuk memindahkan data, gunakan tombol
**Export CSV**.
