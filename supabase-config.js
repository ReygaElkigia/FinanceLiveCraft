/* Konfigurasi Supabase.
 *
 * Isi dua nilai di bawah dengan kredensial project Supabase Anda:
 *   Supabase Dashboard → Project Settings → API
 *     - Project URL      → SUPABASE_URL
 *     - Project API keys → anon public → SUPABASE_ANON_KEY
 *
 * Setelah diisi (dan tabel dibuat via supabase-setup.sql), aplikasi otomatis
 * beralih ke penyimpanan cloud + memerlukan login. Selama masih berisi
 * "YOUR_...", aplikasi tetap memakai penyimpanan lokal (localStorage).
 */
window.SUPABASE_URL = "YOUR_SUPABASE_URL";
window.SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY";
