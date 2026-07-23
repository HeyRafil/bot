import { Command } from './index.js';

export const tboCommand: Command = {
  name: 'tbo',
  aliases: ['modul', 'buku', 'rbv'],
  roleRequired: 'Member',
  description: 'Menampilkan panduan pembelian modul fisik (TBO) dan akses buku digital (RBV).',
  async execute(client, msg, chat, args, privileges) {
    let text = `*📚 PANDUAN BAHAN AJAR / BUKU MATERI POKOK (BMP) UT 📚*\n\n`;
    
    text += `Buku Materi Pokok (Modul) adalah bahan ajar utama kuliah di UT. Berikut panduan aksesnya:\n\n`;

    text += `*🛍️ 1. Pembelian Modul Fisik (Toko Buku Online)*\n`;
    text += `• Bagi mahasiswa *Non-SIPAS* (atau Sipas yang ingin menambah buku), pembelian dilakukan secara online di:\n`;
    text += `  👉 https://tbo.ut.ac.id\n`;
    text += `• *Cara Belanja*: Cari kode/judul mata kuliah, masukkan keranjang, isi alamat pengiriman lengkap, dan lakukan pembayaran billing TBO.\n`;
    text += `• Modul fisik akan dikirimkan langsung ke alamat rumah Anda melalui kurir rekanan UT.\n\n`;

    text += `*📱 2. Membaca Buku Digital Gratis (Ruang Baca Virtual - RBV)*\n`;
    text += `Seluruh mahasiswa UT yang aktif memiliki akses gratis membaca modul secara digital (full text):\n`;
    text += `• *Akses Web*: https://pustaka.ut.ac.id/lib/ruang-baca-virtual-rbv/\n`;
    text += `• *Akses Mobile*: Unduh aplikasi *BA Digital UT* di Google Play Store.\n`;
    text += `• *Cara Login*: Gunakan NIM Anda sebagai username dan password standar akun MyUT/Elearning Anda.\n\n`;

    text += `💡 *Info*: Bagi mahasiswa jalur *SIPAS*, biaya modul cetak sudah sepaket dengan SPP semesteran Anda. Modul akan otomatis dikirimkan ke alamat Anda atau didistribusikan melalui SALUT/Pokjar daerah masing-masing.`;

    await chat.sendMessage(text);
  }
};

export default tboCommand;
