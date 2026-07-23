import { Command } from './index.js';
import { getSetting } from '../config/settings.js';

export const karilCommand: Command = {
  name: 'karil',
  aliases: ['karyailmiah', 'artikel'],
  roleRequired: 'Member',
  description: 'Menampilkan panduan mata kuliah wajib Karya Ilmiah (Karil) UT.',
  async execute(client, msg, chat, args, privileges) {
    const prefix = await getSetting('PREFIX') || '!';
    let text = `*✍️ PANDUAN MATA KULIAH KARYA ILMIAH (KARIL) UT ✍️*\n\n`;

    text += `Karya Ilmiah (Karil) adalah salah satu syarat mutlak kelulusan (Yudisium) bagi seluruh mahasiswa program Diploma IV dan Sarjana (S1) di UT. Berikut rincian ketentuannya:\n\n`;

    text += `*📌 1. Karakteristik Mata Kuliah Karil*\n`;
    text += `• Mata kuliah Karil memiliki beban *0 SKS* (tidak mempengaruhi IPK), namun bersifat *wajib lulus*.\n`;
    text += `• Registrasi Karil biasanya dilakukan bersamaan dengan mata kuliah TAP (Tugas Akhir Program) pada semester akhir.\n\n`;

    text += `*💻 2. Proses Bimbingan Karil*\n`;
    text += `• Bimbingan dilakukan secara daring (online) melalui portal e-learning (https://elearning.ut.ac.id) selama 8 sesi.\n`;
    text += `• Mahasiswa akan dibimbing oleh tutor pembimbing untuk menentukan topik penelitian, membuat draf artikel, hingga cek plagiasi.\n`;
    text += `• Ada juga kegiatan bimbingan tatap muka virtual (Webinar) terjadwal dalam sesi bimbingan tersebut.\n\n`;

    text += `*⚠️ 3. Aturan Bebas Plagiasi (Turnitin)*\n`;
    text += `• Sebelum diunggah ke portal Karil, artikel mahasiswa wajib melalui pengecekan plagiasi (Turnitin) oleh tutor.\n`;
    text += `• Batas toleransi plagiasi maksimal adalah *30% similarity*.\n\n`;

    text += `*📤 4. Pengunggahan Artikel Akhir*\n`;
    text += `• Draf artikel ilmiah final yang sudah disetujui tutor wajib diunggah ke aplikasi Karil sebelum batas waktu semester berjalan.\n`;
    text += `• Artikel yang diunggah akan masuk ke repository UT dan diindeks secara nasional.\n\n`;

    text += `💡 *Tips*: Ketik *${prefix}kelulusan* untuk informasi seputar persyaratan yudisium kelulusan secara lengkap.`;

    await chat.sendMessage(text);
  }
};

export default karilCommand;
