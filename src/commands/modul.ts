import { Command } from './index.js';
import { getSetting } from '../config/settings.js';
import fs from 'fs';
import path from 'path';

export const modulCommand: Command = {
  name: 'modul',
  aliases: ['rbv', 'bukudigital', 'bmp'],
  roleRequired: 'Member',
  description: 'Mencari tautan buku materi pokok digital / Ruang Baca Virtual (RBV) UT.',
  async execute(client, msg, chat, args, privileges) {
    if (args.length === 0) {
      return msg.reply('❌ Format salah. Silakan ketik: *.modul [Kode Mata Kuliah]*\nContoh: `.modul ISIP4211` atau `.modul MKDU4110`');
    }

    const code = args[0].trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    
    // UT course code format: e.g. ISIP4211 or MKDU4110 (usually 8 chars: 4 letters + 4 digits)
    if (code.length < 5 || code.length > 9) {
      return msg.reply('❌ Kode mata kuliah tidak valid! Kode mata kuliah UT biasanya terdiri dari 4 huruf dan 4 angka.\nContoh: `MKDU4110`');
    }

    // Try to see if we have specific info in SI materials database
    let materialInfo = '';
    try {
      const siPath = path.resolve('storage/db/si_materials.json');
      if (fs.existsSync(siPath)) {
        const materials = JSON.parse(fs.readFileSync(siPath, 'utf8'));
        const matched = materials.find((m: any) => m.code.toUpperCase() === code);
        if (matched) {
          materialInfo = `\n📚 *Detail Mata Kuliah S1-SI:* \n• Nama: ${matched.name}\n• Semester: ${matched.semester}\n• Bahan Pendukung: Tersedia di modul digital\n`;
        }
      }
    } catch (_) {}

    // UT Ruang Baca Virtual (RBV) digital library URL structure is search based:
    // https://pustaka.ut.ac.id/lib/?s=CODE
    const rbvSearchUrl = `https://pustaka.ut.ac.id/lib/?s=${code}`;
    
    // Direct link pattern for UT virtual reading room is often structured under the code
    const rbvDirectUrl = `https://pustaka.ut.ac.id/lib/ruang-baca-virtual-rbv/`;

    let text = `📖 *INFORMASI BUKU MATERI POKOK (BMP) DIGITAL UT* 📖\n`;
    text += `──────────────────────\n`;
    text += `✏️ *Kode Matkul:* \`${code}\`\n`;
    if (materialInfo) {
      text += materialInfo;
    }
    text += `──────────────────────\n\n`;

    text += `Universitas Terbuka menyediakan Modul/Buku Materi Pokok (BMP) secara gratis dalam bentuk digital melalui *Ruang Baca Virtual (RBV)* UPT Perpustakaan UT.\n\n`;

    text += `🔗 *LINK AKSES DIGITAL:* \n`;
    text += `• *Pencarian Modul:* \n  ${rbvSearchUrl}\n\n`;
    text += `• *Portal Utama RBV:* \n  ${rbvDirectUrl}\n\n`;

    text += `💡 *CARA MEMBACA MODUL DI RBV:* \n`;
    text += `1. Klik link pencarian di atas untuk langsung tertuju ke modul \`${code}\`.\n`;
    text += `2. Jika diminta login, gunakan:\n`;
    text += `   - *Username:* NIM Anda\n`;
    text += `   - *Password:* tanggal lahir Anda (format: ddmmyyyy) atau password MyUT Anda.\n`;
    text += `3. Klik judul modul, lalu klik "Ruang Baca Virtual" untuk membuka pembaca e-book di layar browser Anda.\n\n`;
    
    text += `_Tips: Anda juga bisa mengunduh aplikasi "Bahan Ajar Digital UT" di Google Play Store untuk membaca modul secara offline di smartphone._`;

    await msg.reply(text);
  }
};

export default modulCommand;
