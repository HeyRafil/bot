import { Command } from './index.js';

export const prodiCommand: Command = {
  name: 'prodi',
  aliases: ['jurusan', 'fakultas'],
  roleRequired: 'Member',
  description: 'Menampilkan daftar Program Studi (Prodi) yang tersedia di UT Batam.',
  async execute(client, msg, chat, args, privileges) {
    let text = `*🎓 PROGRAM STUDI & FAKULTAS DI UT BATAM 🎓*\n\n`;
    
    text += `UT Batam menyelenggarakan program Diploma, Sarjana (S1), dan Pascasarjana (S2/S3) yang terbagi dalam 4 Fakultas Utama:\n\n`;

    text += `*1. FEB (Fakultas Ekonomi & Bisnis)*\n`;
    text += `• S1 Manajemen\n`;
    text += `• S1 Akuntansi\n`;
    text += `• S1 Akuntansi Keuangan Publik\n`;
    text += `• S1 Ekonomi Pembangunan\n`;
    text += `• S1 Pariwisata\n\n`;

    text += `*2. FHISIP (Fakultas Hukum, Ilmu Sosial & Ilmu Politik)*\n`;
    text += `• S1 Ilmu Hukum (Akreditasi A)\n`;
    text += `• S1 Ilmu Administrasi Negara\n`;
    text += `• S1 Ilmu Administrasi Bisnis\n`;
    text += `• S1 Ilmu Komunikasi\n`;
    text += `• S1 Ilmu Perpustakaan\n`;
    text += `• S1 Sosiologi\n`;
    text += `• S1 Sastra Inggris (Penerjemahan)\n\n`;

    text += `*3. FST (Fakultas Sains & Teknologi)*\n`;
    text += `• S1 Sistem Informasi\n`;
    text += `• S1 Teknik Lingkungan\n`;
    text += `• S1 Matematika / Statistika\n`;
    text += `• S1 Agribisnis\n`;
    text += `• S1 Teknologi Pangan\n\n`;

    text += `*4. FKIP (Fakultas Keguruan & Ilmu Pendidikan)*\n`;
    text += `• S1 PGSD (Pendidikan Guru Sekolah Dasar)\n`;
    text += `• S1 PGPAUD\n`;
    text += `• S1 Pendidikan Bahasa Inggris / Indonesia / Matematika\n\n`;

    text += `💡 *Tips*: Semua Program Studi di atas diselenggarakan secara jarak jauh dengan biaya terjangkau. Ketik *!biaya* untuk melihat skema SPP per semester.`;

    await chat.sendMessage(text);
  }
};

export default prodiCommand;
