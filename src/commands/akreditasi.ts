import { Command } from './index.js';

export const akreditasiCommand: Command = {
  name: 'akreditasi',
  aliases: ['ijazah-ut', 'status-ut'],
  roleRequired: 'Member',
  description: 'Menampilkan status akreditasi Universitas Terbuka.',
  async execute(client, msg, chat, args, privileges) {
    let text = `*🏆 STATUS AKREDITASI UNIVERSITAS TERBUKA 🏆*\n\n`;
    
    text += `Universitas Terbuka (UT) adalah Perguruan Tinggi Negeri (PTN) ke-45 di Indonesia yang telah terakreditasi secara resmi oleh BAN-PT:\n\n`;

    text += `• *Akreditasi Institusi*: UT Terakreditasi *A* secara Nasional oleh Badan Akreditasi Nasional Perguruan Tinggi (BAN-PT).\n`;
    text += `• *Kualitas Internasional*: UT telah mendapatkan sertifikasi kualitas dari ICDE (International Council for Open and Distance Education) dan sertifikasi ISO 9001 untuk seluruh layanan manajemen akademik.\n\n`;

    text += `*Program Studi Unggulan Terakreditasi A (S1)*:\n`;
    text += `- S1 Ilmu Hukum\n`;
    text += `- S1 Manajemen\n`;
    text += `- S1 Akuntansi\n`;
    text += `- S1 Administrasi Negara\n`;
    text += `- S1 Administrasi Bisnis\n`;
    text += `- S1 Ilmu Komunikasi\n`;
    text += `- S1 Ekonomi Pembangunan\n\n`;

    text += `💡 *Penting*: Ijazah lulusan UT diakui secara sah dan memiliki legalitas penuh untuk mendaftar CPNS, PPPK, melanjutkan studi ke jenjang S2 di dalam/luar negeri, serta melamar pekerjaan di perusahaan swasta nasional & BUMN.`;

    await chat.sendMessage(text);
  }
};

export default akreditasiCommand;
