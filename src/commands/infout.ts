import { Command } from './index.js';
import { getSetting } from '../config/settings.js';

export const infoutCommand: Command = {
  name: 'infout',
  aliases: ['info', 'informasi'],
  roleRequired: 'Member',
  description: 'Menampilkan daftar informasi penting seputar Universitas Terbuka.',
  async execute(client, msg, chat, args, privileges) {
    const prefix = await getSetting('PREFIX') || '!';

    let text = `*🏢 PUSAT INFORMASI AKADEMIK UNIVERSITAS TERBUKA 🏢*\n\n`;
    
    text += `Silakan ketik perintah di bawah ini untuk mendapatkan informasi spesifik:\n\n`;
    text += `- \`${prefix}registrasi\` : Panduan pendaftaran mahasiswa baru & registrasi mata kuliah.\n`;
    text += `- \`${prefix}panduan\` : Peta jalan kuliah Semester 1 - 8.\n`;
    text += `- \`${prefix}prodi\` : Daftar Fakultas & Program Studi S1/Diploma di UT Batam.\n`;
    text += `- \`${prefix}syarat\` : Berkas persyaratan pendaftaran mahasiswa baru.\n`;
    text += `- \`${prefix}lpkbjj\` : Panduan 4 kegiatan orientasi & workshop wajib mahasiswa baru.\n`;
    text += `- \`${prefix}biaya\` : Skema uang kuliah (SPP) SIPAS vs Non-SIPAS & cara bayar.\n`;
    text += `- \`${prefix}tbo\` : Panduan beli modul kuliah & akses gratis Ruang Baca Virtual.\n`;
    text += `- \`${prefix}tuton\` : Panduan Tutorial Online (Tuton) & Tutorial Webinar (Tuweb).\n`;
    text += `- \`${prefix}sks\` : Aturan beban pengambilan SKS & batas syarat kelulusan.\n`;
    text += `- \`${prefix}si\` : Database & bahan belajar kredibel jurusan Sistem Informasi.\n`;
    text += `- \`${prefix}ujian\` : Panduan tipe ujian UAS UT (UTM, THE, UO) & cetak KTPU.\n`;
    text += `- \`${prefix}nilai\` : Panduan cek nilai DNU/LKAM & ketentuan bobot Tuton.\n`;
    text += `- \`${prefix}karil\` : Panduan pengerjaan & bimbingan Karya Ilmiah (Karil) wajib.\n`;
    text += `- \`${prefix}akreditasi\` : Status akreditasi institusi (A) & jurusan di UT.\n`;
    text += `- \`${prefix}pustaka\` : Layanan perpus digital & alur bebas pustaka untuk yudisium.\n`;
    text += `- \`${prefix}kalender\` : Kalender akademik & batas tanggal pendaftaran/registrasi.\n`;
    text += `- \`${prefix}salut\` : Daftar Sentra Layanan UT di Kepulauan Riau.\n`;
    text += `- \`${prefix}kelulusan\` : Syarat Yudisium kelulusan & info wisuda/UPI UT Batam.\n`;
    text += `- \`${prefix}kontak\` : Nomor telepon, WhatsApp, email, dan portal web resmi UT.\n\n`;
    
    text += `💡 *Tips*: Anda juga bisa langsung menanyakan pertanyaan bebas (misal: "berapa biaya jurusan hukum?") langsung ke AI bot!`;

    await chat.sendMessage(text);
  }
};

export default infoutCommand;
