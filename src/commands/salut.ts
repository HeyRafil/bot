import { Command } from './index.js';

export const salutCommand: Command = {
  name: 'salut',
  aliases: ['pokjar', 'lokasi'],
  roleRequired: 'Member',
  description: 'Menampilkan daftar Sentra Layanan UT (SALUT) di Kepulauan Riau.',
  async execute(client, msg, chat, args, privileges) {
    let text = `*📍 SENTRA LAYANAN UNIVERSITAS TERBUKA (SALUT) - KEPULAUAN RIAU 📍*\n\n`;
    
    text += `SALUT adalah fasilitas layanan UT di kabupaten/kota untuk membantu mempermudah akses mahasiswa dalam pendaftaran, registrasi, ujian, dan bimbingan belajar.\n\n`;

    text += `*1. SALUT Batam (Kota Batam)*\n`;
    text += `• *Lokasi*: Ruko Plamo Garden Blok C No. 5-6, Batam Center, Kota Batam\n`;
    text += `• *Layanan*: Admisi, Informasi Akademik, Cetak Modul, Pelatihan IT.\n\n`;

    text += `*2. SALUT Tanjungpinang (Kota Tanjungpinang)*\n`;
    text += `• *Lokasi*: Jl. Raja Ali Haji No. 21, Tanjungpinang, Kepulauan Riau\n`;
    text += `• *Layanan*: Pusat Bimbingan Belajar, Fasilitas Komputer Ujian.\n\n`;

    text += `*3. SALUT Karimun (Kabupaten Karimun)*\n`;
    text += `• *Lokasi*: Jl. Jenderal Sudirman, Poros, Karimun\n`;
    text += `• *Layanan*: Konsultasi Belajar, Layanan Registrasi Kelompok.\n\n`;

    text += `*4. SALUT Bintan (Kabupaten Bintan)*\n`;
    text += `• *Lokasi*: Kijang Kota, Bintan Timur\n\n`;

    text += `*🏢 Kelompok Belajar (Pokjar) Lainnya*:\n`;
    text += `Untuk daerah terluar seperti *Natuna*, *Anambas*, dan *Lingga*, UT menyediakan Pokjar perwakilan wilayah yang dikoordinir oleh pengurus lokal UT Batam. Anda bisa menghubungi WhatsApp Resmi UT Batam (*0811-753-4001*) untuk detail kontak koordinator Pokjar wilayah Anda.`;

    await chat.sendMessage(text);
  }
};

export default salutCommand;
