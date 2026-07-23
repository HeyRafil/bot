import { Command } from './index.js';
import { getSetting } from '../config/settings.js';

export const tutonCommand: Command = {
  name: 'tuton',
  aliases: ['elearning', 'tuweb'],
  roleRequired: 'Member',
  description: 'Menampilkan panduan Tutorial Online (Tuton) dan Tutorial Webinar (Tuweb) UT.',
  async execute(client, msg, chat, args, privileges) {
    const prefix = await getSetting('PREFIX') || '!';
    let text = `*💻 PANDUAN TUTORIAL ONLINE (TUTON) & TUTORIAL WEBINAR (TUWEB) 💻*\n\n`;

    text += `UT menerapkan pembelajaran jarak jauh dengan bantuan tutorial digital. Berikut panduannya:\n\n`;

    text += `*1️⃣ Tutorial Online (Tuton)*\n`;
    text += `• *Portal Akses*: https://elearning.ut.ac.id\n`;
    text += `• *Durasi*: Berlangsung selama 8 minggu (8 sesi) setiap semester.\n`;
    text += `• *Beban Nilai*: Tuton berkontribusi sebesar *30% s.d 40%* terhadap nilai akhir mata kuliah (dengan syarat nilai UAS Anda minimal 30).\n`;
    text += `• *Tugas Wajib*: Diberikan pada *Sesi 3, 5, dan 7*. Wajib dikerjakan dan diunggah tepat waktu.\n`;
    text += `• *Keaktifan Sesi*: Mahasiswa wajib mengisi kehadiran di setiap sesi diskusi (Sesi 1 - 8) dan aktif menjawab di forum diskusi.\n\n`;

    text += `*2️⃣ Tutorial Webinar (Tuweb)*\n`;
    text += `• Tuweb adalah pengganti kuliah tatap muka secara virtual menggunakan aplikasi Microsoft Teams.\n`;
    text += `• Jadwal kelas, link Teams, dan password dapat diakses melalui portal MyUT atau koordinasi dengan SALUT/Pokjar daerah Anda.\n`;
    text += `• Kontribusi nilai Tuweb bisa mencapai *50%* terhadap nilai akhir kuliah.\n\n`;

    text += `*3️⃣ Aktivasi Tuton (Penting untuk Maba)*\n`;
    text += `• Mahasiswa baru wajib melakukan aktivasi akun di portal elearning sebelum tutorial dimulai.\n`;
    text += `• Setelah aktivasi, jangan lupa mengisi form *Kesediaan Mengikuti Tuton (Ratifikasi)* agar kelas Anda muncul.\n\n`;

    text += `💡 *Tips*: Ketik *${prefix}nilai* untuk rincian pembobotan nilai Tuton terhadap nilai UAS Anda.`;

    await chat.sendMessage(text);
  }
};

export default tutonCommand;
