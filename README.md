# Meow & Butterfly Loyalty Club
Stack: HTML/CSS/JS statis + Netlify Function (`/.netlify/functions/api`) + Supabase Postgres.

## Setup
1. Supabase → New project → SQL Editor → jalankan `supabase/schema.sql`.
2. Settings → API → salin Project URL dan **service_role** key (rahasia, hanya di env server).
3. Push folder ini ke GitHub → Netlify "Import from Git" (build command kosong, publish `public`).
4. Netlify → Site settings → Environment variables: isi seperti `.env.example` (SUPABASE_URL, SUPABASE_SERVICE_KEY, JWT_SECRET, ADMIN_PASSWORD).
5. Deploy. Customer: `/`  ·  Admin: `/admin.html`
6. Admin → "+ customer" → isi nama, member ID, klik "acak" untuk kode → simpan, kirim kode ke customer.

Lokal: `npm i -g netlify-cli && npm i && netlify dev` (buat `.env` dari `.env.example`).

## Keamanan
- Kode akses disimpan sebagai bcrypt hash; login & semua otorisasi diverifikasi di server (JWT), customer hanya bisa membaca datanya sendiri (id dari token).
- RLS aktif di semua tabel tanpa policy → anon key tidak bisa akses data; hanya function dengan service_role.
- Stamp hanya lewat admin: nota "selesai" memanggil `complete_order()` (atomik, unik per nota). Pada 10 stamp: voucher 10% maks Rp15.000 terbit, stamp reset 0.
- Vercel: pindahkan `api.js` ke `/api/api.js` dengan handler `(req,res)` dan ubah URL fetch di `app.js`.
