# 🖥️ WINDOWS VS LINUX: Critical Deployment Differences

Jika kamu menjalankan backend ini di **Windows Server** (bukan Linux/Ubuntu), perhatikan poin-poin berikut untuk menghindari error.

---

## 1. Perintah Terminal (Shell Syntax)
- **Linux (Bash)**: Menggunakan `&&` untuk menggabung perintah dan `rm -rf` untuk hapus folder.
- **Windows (PowerShell)**: Menggunakan `;` (atau `&&` di versi baru). Perintah `rm -rf` tidak ada secara bawaan (gunakan `Remove-Item -Recurse -Force`).
- **💡 Solusi**: Gunakan script yang sesuai dengan sistem operasi masing-masing atau jalankan perintah satu per satu.

## 2. Environment Variables
- **Linux**: Bisa set variable langsung sebelum perintah: `PORT=3000 npm start`.
- **Windows (PS)**: Harus menggunakan `$env`: `$env:PORT=3000; npm start`.
- **💡 Solusi**: Selalu gunakan file `.env` saja agar lintas platform (cross-platform).

## 3. Prisma Engine Binary (Sangat Penting!)
Prisma mendownload engine yang berbeda untuk OS yang berbeda.
- **Masalah**: Jika folder `node_modules` di-copy langsung dari Linux ke Windows (atau sebaliknya), Prisma akan error "Client could not find its engine binary".
- **💡 Solusi**: Selalu hapus `node_modules` dan jalankan `npm install` + `npx prisma generate` ulang setiap kali pindah Sistem Operasi.

## 4. Case Sensitivity (Sensitivitas Huruf)
- **Windows**: `Controllers/User` dan `controllers/user` dianggap sama.
- **Linux**: Keduanya dianggap berbeda.
- **⚠️ Resiko**: Jika kamu menulis kode di Windows dengan huruf yang tidak konsisten (misal: import dari folder yang salah huruf besarnya), kode akan jalan di Windows tapi **CRASH** saat diupload ke Linux VPS.

## 5. Line Endings (CRLF vs LF)
- **Windows**: Menggunakan `CRLF` (hidden characters di akhir baris).
- **Linux**: Menggunakan `LF`.
- **⚠️ Resiko**: Script shell (`.sh`) yang dibuat di Windows seringkali error di Linux karena karakter `\r` (CRLF) tidak dikenali oleh Bash.

## 6. PM2 Startup
- **Linux**: `pm2 startup` otomatis setting background service.
- **Windows**: Kamu harus menginstal library tambahan seperti `pm2-windows-service` agar backend otomatis nyala saat Windows Server reboot.

---

### Ringkasan Pindah OS (Migrasi Windows <-> Linux)
Setiap kali pindah OS, lakukan 3 langkah wajib ini:
1. `rm -rf node_modules` (Hapus folder modul)
2. `npm install --legacy-peer-deps` (Instal ulang)
3. `npx prisma generate` (Generate client untuk OS baru)
