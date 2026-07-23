# WhatsApp Enterprise Bot & Dashboard Control Panel (Universitas Terbuka)

Platform bot WhatsApp kelas enterprise berbasis Node.js & TypeScript dengan Dashboard Administrasi real-time menggunakan Next.js + Socket.IO. Bot ini dilengkapi dengan AI (RAG Pipeline) untuk asisten akademik Universitas Terbuka, filter keamanan grup (Anti-Link, Anti-Toxic, Anti-Virtex, dll.), serta manajemen whitelist grup dinamis.

---

## 🛠️ Persyaratan Awal (Prerequisites)

Sebelum instalasi, pastikan perangkat Anda (Windows atau VPS Ubuntu) telah terpasang:
1. **Node.js versi 20+ (LTS)**
2. **Git** (untuk clone repositori)
3. **Web Browser** (Google Chrome / Chromium) untuk driver Puppeteer.

---

## ⚙️ Pengaturan Environment (`.env`)

Buat berkas `.env` pada direktori utama proyek (`BotWAUT`) dengan menyalin `.env.example`:
```env
# Server Settings
NODE_ENV=production
PORT=3000
PUBLIC_URL=http://<IP_VPS_ATAU_LOCALHOST>:5000

# WhatsApp Bot Settings
OWNER_NUMBER=62895360042021
COOLDOWN_MS=3000

# OpenAI API Settings
OPENAI_API_KEY=AQ.Ab8RN6Lmb9IHb2RF8LsfsLYy-VVMsWdB8EVu6YYhyrGY-5ahHw

# Crawler Settings
CRAWLER_INTERVAL_HOURS=6
CRAWLER_DELAY_MS=2000

# Web Dashboard Security
WEB_DASHBOARD_PASSWORD=AdminUT2026

# Path Settings
SESSION_PATH=./session
DATABASE_DIR=./storage/db
KNOWLEDGE_DIR=./storage/knowledge

# Security Settings
JWT_SECRET="super-secret-jwt-key-for-enterprise-bot"
JWT_REFRESH_SECRET="super-secret-jwt-refresh-key-for-enterprise-bot"
```

---

## 💻 Metode A: Panduan Instalasi di OS Windows

### Langkah 1: Buka Command Prompt / PowerShell
Buka terminal dan masuk ke folder proyek tempat kode berada:
```cmd
cd C:\Users\PB-0761-USER\Desktop\BotWAUT
```

### Langkah 2: Install Dependensi
Jalankan perintah berikut untuk mengunduh seluruh package pendukung:
```cmd
npm install
cd frontend && npm install && cd ..
```
*Catatan: Jika ada pemblokiran kebijakan skrip di PowerShell, gunakan CMD biasa.*

### Langkah 3: Sinkronisasi Database
Buat database SQLite dan buat tabel yang dibutuhkan:
```cmd
npx prisma db push
```

### Langkah 4: Jalankan Aplikasi (Mode Development)
* **Terminal 1 (Backend & Bot Core):**
  ```cmd
  npm run dev
  ```
* **Terminal 2 (Frontend Dashboard):**
  ```cmd
  cd frontend
  npm run dev
  ```
Buka browser Anda dan akses `http://localhost:3000` untuk membuka control panel.

---

## ☁️ Metode B: Panduan Instalasi di VPS Ubuntu (Linux)

Untuk menjalankan bot secara terus-menerus (24/7) di VPS Linux Ubuntu, ikuti panduan berikut:

### Langkah 1: Install Node.js 20+ & Git di VPS
Jalankan perintah berikut pada terminal VPS Anda:
```bash
sudo apt update
sudo apt install -y curl git
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

### Langkah 2: Install Library Pendukung Puppeteer (Headless Browser)
Puppeteer membutuhkan Chromium untuk memindai QR code di latar belakang VPS. Jalankan perintah ini untuk memasang seluruh library sistem yang dibutuhkan:
```bash
sudo apt-get install -y ca-certificates fonts-liberation libasound2 libatk-bridge2.0-0 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgbm1 libgcc1 libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 libnss3 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 lsb-release xdg-utils wget
```

### Langkah 3: Clone Project & Install Dependensi
Unduh kode proyek ke VPS Anda:
```bash
git clone <URL_REPOSITORI_ANDA> /var/www/bot
cd /var/www/bot
npm install
cd frontend && npm install && cd ..
```

### Langkah 4: Build Aplikasi & Sinkronisasi Database
Kompilasi kode TypeScript backend, halaman Next.js frontend, dan siapkan database SQLite:
```bash
# 1. Compile Backend
npm run build

# 2. Build Frontend Dashboard
cd frontend
npm run build
cd ..

# 3. Sinkronisasikan tabel database SQLite
npx prisma db push
```

### Langkah 5: Jalankan Layanan menggunakan PM2
PM2 akan mengelola proses aplikasi Anda di background agar terus berjalan 24/7 dan otomatis restart jika terjadi crash.

```bash
# 1. Install PM2 secara global
sudo npm install -g pm2

# 2. Start Backend & Frontend menggunakan ecosystem config
pm2 start ecosystem.config.cjs

# 3. Simpan daftar proses agar otomatis berjalan saat VPS reboot
pm2 save
pm2 startup
```

### Perintah Penting PM2 untuk Maintenance VPS:
* **Melihat Status Layanan:**
  ```bash
  pm2 status
  ```
* **Melihat Log Realtime (Sangat berguna untuk debug):**
  ```bash
  pm2 logs
  # atau log khusus backend saja
  pm2 logs bot-backend
  ```
* **Restart Layanan:**
  ```bash
  pm2 restart bot-backend
  pm2 restart bot-frontend
  ```
* **Stop Layanan:**
  ```bash
  pm2 stop all
  ```

---

## 👥 Pengaturan Whitelist Grup WhatsApp

Secara default, bot **tidak akan merespon** pesan di grup WhatsApp mana pun sebelum diizinkan (*whitelisted*) oleh owner demi mencegah bot menyepam grup yang tidak diinginkan.

1. Masuk ke grup WhatsApp yang ingin Anda aktifkan bot-nya.
2. Menggunakan nomor WhatsApp Owner (yang didaftarkan di `OWNER_NUMBER`), kirim pesan:
   ```text
   .addgroup
   ```
3. Bot akan membalas: `✅ Grup [Nama Grup] berhasil ditambahkan ke whitelist bot.`
4. Untuk menonaktifkan bot dari grup tersebut, ketik:
   ```text
   .delgroup
   ```
5. Untuk melihat daftar grup yang aktif di-whitelist, kirim pesan:
   ```text
   .listgroups
   ```

---

## 🔍 Mengatasi Masalah (Troubleshooting)

### 1. Error: `table main.registered_users does not exist`
* **Penyebab:** Database SQLite belum terbuat/sinkron dengan skema data Prisma yang baru.
* **Solusi:** Jalankan `npx prisma db push` di folder utama proyek VPS/Windows Anda, lalu jalankan `pm2 restart bot-backend` (untuk VPS) atau restart terminal dev Anda.

### 2. Error: `Failed to launch the browser process!`
* **Penyebab:** Puppeteer gagal menemukan browser Google Chrome atau Chromium pada sistem.
* **Solusi:**
  1. Cari path executable Chrome di perangkat Anda.
  2. Tambahkan variabel berikut pada bagian paling bawah file `.env`:
     ```text
     PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome  # Contoh untuk Linux
     # Atau di Windows: C:\Program Files\Google\Chrome\Application\chrome.exe
     ```
  3. Restart bot Anda.
