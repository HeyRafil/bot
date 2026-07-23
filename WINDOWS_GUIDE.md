# Panduan Instalasi & Menjalankan BotWAUT di OS Windows

Panduan ini menjelaskan langkah-langkah untuk memasang, mengonfigurasi, dan menjalankan **AI WhatsApp Academic Assistant Universitas Terbuka** langsung di sistem operasi Windows (Windows 10/11) Anda menggunakan Node.js.

---

## 🛠️ Persyaratan Awal (Prerequisites)

Sebelum memulai, pastikan perangkat Windows Anda sudah memiliki software berikut:

1. **Node.js (LTS Version - v20 atau lebih baru)**
   * Unduh installer dari situs resmi: [https://nodejs.org](https://nodejs.org/) (Pilih versi LTS).
   * Jalankan file `.msi` hasil download dan ikuti proses instalasi sampai selesai.
2. **Git for Windows (Opsional, untuk clone)**
   * Unduh dari: [https://git-scm.com](https://git-scm.com/).
3. **Web Browser (Google Chrome atau Microsoft Edge)**
   * Dibutuhkan untuk memindai QR Code dan akses monitoring panel.

---

## ⚙️ Langkah Instalasi

### Langkah 1: Buka Command Prompt atau PowerShell
Buka folder tempat kode proyek ini berada (`C:\Users\PB-0761-USER\Desktop\BotWAUT`) menggunakan terminal Windows:
* Cara cepat: Masuk ke folder `BotWAUT` di File Explorer, klik kolom *Address Bar* di bagian atas, ketik `cmd`, lalu tekan **Enter**.

### Langkah 2: Install Dependensi Node.js
Di jendela Command Prompt yang terbuka, ketik perintah berikut untuk mendownload seluruh package/library yang dibutuhkan:
```cmd
npm install
```
*Tunggu hingga proses selesai. npm secara otomatis akan mengunduh browser Chromium pendukung untuk Puppeteer.*

### Langkah 3: Konfigurasi File Environment (.env)
1. Di folder proyek, buat salinan dari file `.env.example` lalu ubah namanya menjadi `.env`.
   * Atau lewat terminal cmd dengan mengetik:
     ```cmd
     copy .env.example .env
     ```
2. Klik kanan file `.env` -> **Open With** -> pilih **Notepad** (atau gunakan VS Code).
3. Konfigurasikan variabel berikut:
   * `OWNER_NUMBER`: Nomor WhatsApp Anda sendiri tanpa tanda `+` (misal: `628123456789`).
   * `OPENAI_API_KEY`: Kunci API OpenAI Anda (jika ingin fitur tanya jawab AI aktif). Jika dikosongkan, bot berjalan secara offline mencocokkan kata kunci database lokal.
   * `WEB_DASHBOARD_PASSWORD`: Tentukan password untuk mengakses web monitoring (bebas sesuai keinginan).

---

## 🚀 Menjalankan Bot di Windows

Terdapat beberapa metode untuk menjalankan bot ini:

### 1. Mode Pengembangan (Development)
Menggunakan fitur *hot-reload* (aplikasi otomatis memuat ulang jika ada file kode yang diubah):
```cmd
npm run dev
```
*Catatan: Jika Anda mendapatkan error kebijakan eksekusi skrip (Execution Policy) di PowerShell, silakan buka Command Prompt (cmd) biasa untuk menjalankannya.*

### 2. Mode Standar (Production)
Menjalankan bot secara langsung tanpa restart otomatis:
```cmd
npm start
```

### 3. Merayap Website Secara Manual (Manual Crawl)
Untuk memaksa bot merayap dan memperbarui data dari situs Universitas Terbuka sekarang juga:
```cmd
npm run crawl
```

---

## 🔗 Cara Menautkan WhatsApp
1. Setelah Anda menjalankan `npm start` atau `npm run dev`, pastikan terminal tidak menampilkan error.
2. Buka browser (Chrome/Edge) dan akses url:
   ```text
   http://localhost:3000
   ```
3. Masukkan password dashboard yang sudah Anda set di file `.env`.
4. Pindai (scan) QR Code yang muncul di layar dashboard menggunakan aplikasi WhatsApp di smartphone Anda (**Perangkat Tertaut -> Tautkan Perangkat**).
5. Jika berhasil, dashboard akan berubah status menjadi **Connected** dan bot siap merespon pesan di WhatsApp.

---

## 👥 Pengaturan Whitelist Grup WhatsApp
Secara default, bot **tidak akan merespon** pesan di grup mana pun sebelum diizinkan (*whitelisted*) oleh owner. Ini mencegah bot menyepam grup yang tidak dikehendaki.

* **Cara Mengizinkan Grup (.addgroup)**:
  * Masuk ke grup WhatsApp yang ingin Anda izinkan.
  * Sebagai Owner Bot (menggunakan nomor WA yang didaftarkan di `OWNER_NUMBER`), ketik pesan:
    ```text
    .addgroup
    ```
  * Bot akan merespon: `✅ Grup [Nama Grup] berhasil ditambahkan ke whitelist bot.` dan mulai merespon seluruh perintah akademik di grup tersebut.
* **Cara Menghapus Izin Grup (.delgroup)**:
  * Di dalam grup yang ingin dihapus, ketik:
    ```text
    .delgroup
    ```
* **Melihat Daftar Grup yang Diizinkan (.listgroups)**:
  * Kirim pesan ke bot (bisa di jalur pribadi):
    ```text
    .listgroups
    ```

---

## 🔍 Mengatasi Masalah di Windows (Troubleshooting)

### 1. Error: `nodemon is not recognized...`
* **Penyebab**: Script dev menggunakan nodemon secara lokal dan kemungkinan path global npm belum terdaftar di environment variable Windows.
* **Solusi**: Jalankan perintah `npm start` sebagai alternatif, atau instal nodemon secara global dengan perintah: `npm install -g nodemon`.

### 2. Error: `Failed to launch the browser process!`
* **Penyebab**: Puppeteer gagal membuka Chromium bawaan karena diblokir oleh antivirus Windows Defender atau hak akses Windows.
* **Solusi**: Anda bisa mengarahkan Puppeteer menggunakan browser Google Chrome resmi yang sudah terpasang di Windows Anda.
  1. Cari lokasi file `chrome.exe` Anda (biasanya di `C:\Program Files\Google\Chrome\Application\chrome.exe`).
  2. Buka berkas `.env` Anda.
  3. Tambahkan baris konfigurasi berikut di bagian paling bawah:
     ```text
     PUPPETEER_EXECUTABLE_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe
     ```
  4. Restart aplikasi bot Anda.

### 3. Cara Mematikan Bot dengan Aman
Di jendela Command Prompt tempat bot berjalan, cukup tekan tombol **Ctrl + C** di keyboard, lalu ketik `Y` dan tekan **Enter** untuk menutup koneksi WhatsApp secara bersih.
