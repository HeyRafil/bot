# 🚀 PANDUAN INSTALASI BOT WA UT DI VPS UBUNTU 🚀

Panduan ini menjelaskan cara mengunduh, mengonfigurasi, dan menjalankan Bot WhatsApp Universitas Terbuka (UT) pada Virtual Private Server (VPS) bersistem operasi **Ubuntu** (20.04 / 22.04 LTS) agar dapat berjalan aktif selama 24 jam non-stop menggunakan **PM2**.

---

## 📋 Prasyarat (Prerequisites)
Sebelum memulai instalasi, pastikan VPS Ubuntu Anda telah terpasang paket berikut:
1. **Node.js (v18 atau lebih baru)**
2. **NPM (Node Package Manager)**
3. **Git**
4. **PM2 (Process Manager untuk Node.js)**

---

## 🛠️ Langkah-Langkah Instalasi

### Langkah 1: Persiapan Server & Instalasi Dependensi Node.js + PM2
Hubungi VPS Anda melalui SSH, kemudian jalankan perintah pembaruan sistem dan instalasi alat yang dibutuhkan:

```bash
# 1. Update package lists
sudo apt update && sudo apt upgrade -y

# 2. Pasang Node.js v18 LTS (via NodeSource)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 3. Verifikasi instalasi Node & NPM
node -v
npm -v

# 4. Pasang PM2 secara global
sudo npm install -y pm2 -g
```

---

### Langkah 2: Instalasi Dependensi Chromium (PENTING!)
Karena bot ini menggunakan `whatsapp-web.js` yang berbasis browser headless (Puppeteer/Chromium), Anda **wajib** menginstal paket dependensi grafis Chromium di Ubuntu agar Chromium tidak mengalami crash saat inisialisasi:

```bash
sudo apt-get install -y \
  libgbm-dev \
  libnss3 \
  libatk-bridge2.0-0 \
  libgtk-3-0 \
  libasound2 \
  libxss1 \
  libxtst6 \
  libxshmfence1 \
  ca-certificates \
  fonts-liberation \
  libappindicator3-1 \
  libxdg-utils \
  gconf-service \
  libchrome-browser-helper
```

---

### Langkah 3: Clone Project dari GitHub
Unduh repositori kode bot Anda dari GitHub ke VPS:

```bash
# Ganti dengan URL Repositori GitHub Anda
git clone https://github.com/USERNAME/REPOSITORI-ANDA.git

# Masuk ke folder project
cd REPOSITORI-ANDA
```

---

### Langkah 4: Konfigurasi Environment (`.env`)
Buat berkas `.env` baru di VPS untuk mengatur kredibilitas API, port, dan kunci keamanan:

```bash
# Duplikat contoh konfigurasi env
cp .env.example .env

# Edit file env menggunakan editor nano
nano .env
```

Sesuaikan parameter berikut di dalam file `.env`:
* `PUBLIC_URL` = Atur ke `http://IP_VPS_ANDA:5000` (atau gunakan domain jika memakai reverse proxy).
* `OWNER_NUMBER` = Nomor WhatsApp Anda (format tanpa tanda +, contoh: `628123456789`).
* `OPENAI_API_KEY` = Masukkan API Key Google Gemini (`AIzaSy...`) atau OpenAI Anda.
* `PUPPETEER_HEADLESS` = Setel ke `true` (karena VPS berjalan tanpa layar/GUI).

*Catatan: Tekan `Ctrl + O` lalu `Enter` untuk menyimpan, dan `Ctrl + X` untuk keluar dari nano.*

---

### Langkah 5: Instalasi Library Node & Build Project
Jalankan instalasi pustaka dependensi Node.js, sinkronisasi database SQLite, serta kompilasi kode TypeScript:

```bash
# 1. Install library
npm install

# 2. Sinkronisasikan database SQLite lokal (dev.db)
npx prisma db push

# 3. Generate prisma client
npx prisma generate

# 4. Build project (TypeScript ke JavaScript)
npm run build
```

---

### Langkah 6: Menjalankan Bot & Dashboard menggunakan PM2
Agar aplikasi backend (port 5000) dan dashboard frontend Next.js (port 3000) berjalan terus di latar belakang meskipun sesi SSH ditutup, gunakan PM2:

#### A. Menjalankan Backend Bot:
Jalankan backend server menggunakan konfigurasi PM2 yang sudah ada (`ecosystem.config.cjs`):
```bash
pm2 start ecosystem.config.cjs
```
*(Atau jika ingin menjalankan secara manual: `pm2 start dist/server.js --name bot-backend`)*

#### B. Menjalankan Dashboard Frontend (Next.js):
Masuk ke folder frontend, instal dependensi, build, dan jalankan di PM2:
```bash
# Masuk ke folder frontend
cd frontend

# Install & Build
npm install
npm run build

# Jalankan Next.js di port 3000
pm2 start npm --name "bot-frontend" -- start
```

#### C. Menyimpan Konfigurasi PM2 agar Auto-start saat VPS Reboot:
```bash
pm2 save
pm2 startup
```
*(Ikuti petunjuk perintah perintah `sudo env PATH=...` yang muncul di terminal Anda setelah mengetik `pm2 startup` untuk mengaktifkan autostart sistem).*

---

## 📱 Cara Scan QR Code di VPS
Setelah bot backend dijalankan dengan PM2, bot akan memunculkan QR Code secara otomatis di log PM2.

Untuk memindai QR Code:
1. Jalankan perintah log di terminal VPS Anda:
   ```bash
   pm2 logs bot-backend
   ```
2. Terminal akan menampilkan kode QR berbentuk ASCII.
3. Buka WhatsApp di HP Anda -> **Perangkat Tertaut** -> **Tautkan Perangkat**, lalu arahkan kamera HP ke kode QR di layar terminal SSH Anda.
4. Setelah terhubung, log PM2 akan menunjukkan status `[INFO] WhatsApp Client is ready!`.

---

## 🧠 Optimasi Memory untuk VPS Kecil (1-Core / 2GB RAM)
Menjalankan browser (Chromium) dan server Next.js di VPS berukuran 2GB RAM seringkali menyebabkan masalah kehabisan memori (*Out Of Memory*). Kami telah melakukan optimasi internal:
*   Membatasi memori proses Node.js backend & Next.js masing-masing maksimal **192MB** menggunakan parameter PM2.
*   Mengaktifkan mode `--single-process` di Chromium dan membatasi ukuran heap JS browser maksimal **256MB** untuk menghemat RAM hingga 300MB.

### 🛠️ Langkah Wajib: Mengaktifkan SWAP Space di VPS Ubuntu
Sangat disarankan (wajib untuk VPS 2GB RAM) untuk mengaktifkan Swap Space minimal **2GB** agar proses kompilasi (*build*) Next.js dan Puppeteer berjalan lancar tanpa mengalami crash:

```bash
# 1. Periksa apakah sudah ada swap yang aktif
sudo swapon --show

# 2. Buat file swap berukuran 2 Gigabyte
sudo fallocate -l 2G /swapfile

# 3. Amankan izin akses file swap
sudo chmod 600 /swapfile

# 4. Atur file tersebut sebagai area swap
sudo mkswap /swapfile

# 5. Aktifkan swap
sudo swapon /swapfile

# 6. Buat swap permanen agar tetap aktif setelah VPS restart
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# 7. Optimalkan nilai swappiness (opsional - direkomendasikan 10)
sudo sysctl vm.swappiness=10
echo 'vm.swappiness=10' | sudo tee -a /etc/sysctl.conf

# 8. Verifikasi bahwa swap sudah aktif (terlihat swap size 2.0G)
free -h
```

---

## 🔄 Pemeliharaan & Update Kode Baru (Maintenance)
Jika di kemudian hari Anda melakukan pembaruan kode di komputer lokal, Anda hanya perlu melakukan langkah berikut di VPS:

```bash
# Masuk ke folder project
cd REPOSITORI-ANDA

# Pull kode terbaru dari Github
git pull

# Jalankan skrip pemulihan/pembaruan otomatis yang sudah disediakan
chmod +x fix-vps.sh
./fix-vps.sh
```
Skrip `./fix-vps.sh` akan otomatis mematikan PM2 sementara, menyinkronkan database prisma, membuild ulang TypeScript, dan menghidupkan kembali bot.
