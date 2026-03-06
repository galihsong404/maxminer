-- Jalankan ini di Supabase SQL Editor untuk memberikan akses Super Admin ke akun Anda
UPDATE "User" 
SET role = 'SUPER_ADMIN' 
WHERE id = '742625427';

-- Jalankan ini untuk verifikasi hasilnya
SELECT id, "telegramUsername", role 
FROM "User" 
WHERE id = '742625427';
