import { Command } from './index.js';

export const kontakCommand: Command = {
  name: 'kontak',
  aliases: ['phone', 'hubungi'],
  roleRequired: 'Member',
  description: 'Menampilkan kontak penting dan layanan bantuan Universitas Terbuka.',
  async execute(client, msg, chat, args, privileges) {
    let text = `*📞 KONTAK & LAYANAN BANTUAN UNIVERSITAS TERBUKA 📞*\n\n`;
    
    text += `*🏢 UT Batam (Unit Program Belajar Jarak Jauh)*\n`;
    text += `• *Alamat*: Jl. Dr. Sutomo No. 3, Sekupang, Batam, Kepulauan Riau 29422\n`;
    text += `• *Telepon*: 0778-323478\n`;
    text += `• *Faks*: 0778-323479\n`;
    text += `• *Email*: ut-batam@ecampus.ut.ac.id\n`;
    text += `• *Website*: https://batam.ut.ac.id\n\n`;

    text += `*💬 Layanan WhatsApp Pengurus UT Batam*\n`;
    text += `• *Layanan Umum & Informasi*: 0811-753-4001\n`;
    text += `• *Registrasi & Admisi*: 0811-753-4002\n\n`;

    text += `*🏢 UT Pusat (Hallo UT)*\n`;
    text += `• *Call Center*: 1500024 (Layanan 24 Jam)\n`;
    text += `• *WhatsApp Hallo UT*: 0811-4150-0024\n`;
    text += `• *Website Layanan*: https://hallo-ut.ut.ac.id\n\n`;

    text += `*🌐 Tautan Portal Penting UT*\n`;
    text += `• *Portal Mahasiswa MyUT*: https://myut.ut.ac.id\n`;
    text += `• *E-learning / Tuton*: https://elearning.ut.ac.id\n`;
    text += `• *Bahan Ajar Digital (Pustaka UT)*: https://pustaka.ut.ac.id\n`;
    text += `• *Registrasi & Admisi (SIA)*: https://sia.ut.ac.id\n`;

    await chat.sendMessage(text);
  }
};

export default kontakCommand;
