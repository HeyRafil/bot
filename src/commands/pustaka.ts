import { Command } from './index.js';

export const pustakaCommand: Command = {
  name: 'pustaka',
  aliases: ['perpus', 'bebaspustaka'],
  roleRequired: 'Member',
  description: 'Menampilkan informasi Perpustakaan Digital UT dan bebas pustaka.',
  async execute(client, msg, chat, args, privileges) {
    let text = `*📚 PERPUSTAKAAN DIGITAL & BEBAS PUSTAKA UT 📚*\n\n`;
    
    text += `Layanan perpustakaan UT dapat diakses secara digital untuk mendukung referensi tugas dan karya ilmiah Anda:\n\n`;

    text += `*1. Layanan Perpustakaan Digital (Digital Library)*:\n`;
    text += `• *Portal Resmi*: http://www.pustaka.ut.ac.id\n`;
    text += `• *Layanan yang Tersedia*:\n`;
    text += `  - *Ruang Baca Virtual (RBV)*: Membaca modul kuliah lengkap secara gratis.\n`;
    text += `  - *Repository UT*: Akses karya ilmiah, tesis, disertasi, dan jurnal penelitian dosen/mahasiswa.\n`;
    text += `  - *E-Resources*: Akses jurnal ilmiah internasional yang dilanggan oleh UT secara gratis.\n\n`;

    text += `*2. Surat Keterangan Bebas Pustaka (SKBP)*:\n`;
    text += `• SKBP adalah surat pernyataan bahwa mahasiswa tidak memiliki pinjaman buku fisik di perpustakaan UT Pusat maupun UPBJJ UT Batam.\n`;
    text += `• Surat ini merupakan **syarat wajib untuk mendaftar Yudisium Kelulusan**.\n`;
    text += `• *Cara Mengurus*: Pengajuan dilakukan secara online melalui portal Hallo UT (hallo-ut.ut.ac.id) dengan membuat tiket pengajuan bebas pustaka melampirkan KTM dan screenshot profil SIA Anda.`;

    await chat.sendMessage(text);
  }
};

export default pustakaCommand;
