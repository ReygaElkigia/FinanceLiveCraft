-- FinanceLiveCraft — setup database Supabase
-- Jalankan di: Supabase Dashboard → SQL Editor → New query → Run
--
-- Membuat satu tabel `app_data` yang menyimpan tiap dataset sebagai JSON,
-- dan mengunci akses hanya untuk pengguna yang sudah login (authenticated).

create table if not exists public.app_data (
  key        text primary key,
  data       jsonb,
  updated_at timestamptz not null default now()
);

alter table public.app_data enable row level security;

-- Semua pengguna yang login berbagi data yang sama (satu workspace).
drop policy if exists "authenticated read"   on public.app_data;
drop policy if exists "authenticated write"  on public.app_data;
drop policy if exists "authenticated update" on public.app_data;

create policy "authenticated read"
  on public.app_data for select
  to authenticated using (true);

create policy "authenticated write"
  on public.app_data for insert
  to authenticated with check (true);

create policy "authenticated update"
  on public.app_data for update
  to authenticated using (true) with check (true);

-- Aktifkan realtime agar perubahan tampil langsung di perangkat lain.
alter publication supabase_realtime add table public.app_data;

-- Membuat pengguna:
--   Dashboard → Authentication → Users → Add user (email + password),
--   centang "Auto Confirm User" agar bisa langsung login.
-- Untuk mematikan pendaftaran mandiri:
--   Dashboard → Authentication → Providers → Email → nonaktifkan "Enable Signups".
