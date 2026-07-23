import { Command } from './index.js';

export const biayaCommand: Command = {
  name: 'biaya',
  aliases: ['spp', 'tarif'],
  roleRequired: 'Member',
  description: 'Menampilkan rincian skema biaya kuliah di Universitas Terbuka.',
  async execute(client, msg, chat, args, privileges) {
    let text = `*💰 RINCIAN BIAYA KULIAH (SPP) UNIVERSITAS TERBUKA 💰*\n\n`;
    
    text += `UT menerapkan 2 jenis skema uang kuliah per semester yang dapat dipilih oleh mahasiswa:\n\n`;

    text += `*📦 1. SKEMA SIPAS (Sistem Paket Semester)*\n`;
    text += `Sistem paket di mana mata kuliah dan modul cetak (buku materi pokok) sudah ditentukan paketnya setiap semester.\n`;
    text += `• *SIPAS Non-TTM (Tanpa Tatap Muka)*:\n`;
    text += `  - Biaya: *Rp 1.150.000 - Rp 1.300.000* per semester.\n`;
    text += `  - Layanan: Modul Cetak, Tutorial Online (Tuton), Ujian UAS.\n`;
    text += `• *SIPAS Semi-TTM (Semi Tatap Muka)*:\n`;
    text += `  - Biaya: *Rp 1.600.000 - Rp 1.750.000* per semester.\n`;
    text += `  - Layanan: Modul Cetak, Kombinasi Tuton + 2 Mata Kuliah Tatap Muka/Tuweb.\n`;
    text += `• *SIPAS Penuh (Tatap Muka)*:\n`;
    text += `  - Biaya: *Rp 2.200.000* per semester (tergantung ketersediaan Pokjar).\n\n`;

    text += `*📚 2. SKEMA NON-SIPAS (Non-Paket)*\n`;
    text += `Mahasiswa memilih mata kuliah sendiri secara eceran per semester (bebas menentukan jumlah SKS).\n`;
    text += `• *Registrasi Awal*: Rp 100.000 (sekali daftar).\n`;
    text += `• *Uang Kuliah per SKS*: *Rp 35.000 - Rp 85.000* per SKS (tergantung Program Studi).\n`;
    text += `• *Modul Cetak*: Dibeli terpisah secara mandiri melalui Toko Buku Online UT (tbo.ut.ac.id) sesuai mata kuliah yang diregistrasikan.\n\n`;

    text += `*💳 METODE PEMBAYARAN SPP (LIP)*\n`;
    text += `Gunakan nomor billing LIP SPP Anda untuk membayar melalui:\n`;
    text += `- *Bank Mitra*: BRI, Bank Mandiri, Bank BTN, Bank BNI (melalui ATM, Mobile Banking, atau Teller).\n`;
    text += `- *Gerai Ritel*: Alfamart, Alfamidi, Indomaret, Kantor Pos.\n`;
    text += `- *E-Commerce*: Tokopedia, Shopee.`;

    await chat.sendMessage(text);
  }
};

export default biayaCommand;
