import { Command } from './index.js';

export const lpkbjjCommand: Command = {
  name: 'lpkbjj',
  aliases: ['workshop', 'kegiatanwajib'],
  roleRequired: 'Member',
  description: 'Menampilkan panduan 4 rangkaian kegiatan wajib LPKBJJ UT Batam.',
  async execute(client, msg, chat, args, privileges) {
    let text = `*🎓 RANGKAIAN KEGIATAN WAJIB LPKBJJ UT BATAM 🎓*\n\n`;
    
    text += `LPKBJJ (Layanan Pembelajaran dan Kegiatan Belajar Jarak Jauh) adalah pembekalan wajib bagi seluruh mahasiswa baru UT agar siap belajar mandiri secara jarak jauh. Terdiri dari 4 tahapan:\n\n`;

    text += `*1. OSMB (Orientasi Studi Mahasiswa Baru)*\n`;
    text += `• *Tujuan*: Mengenal sistem belajar jarak jauh (SBJJ), sejarah UT, tata tertib, hak & kewajiban mahasiswa.\n`;
    text += `• *Status*: Wajib diikuti (mendapatkan sertifikat OSMB sebagai syarat wisuda).\n\n`;

    text += `*2. PKBJJ (Pelatihan Keterampilan Belajar Jarak Jauh)*\n`;
    text += `• *Tujuan*: Pelatihan praktis membaca modul cepat (SQ3R), mengelola waktu belajar, kiat sukses tutorial online/tatap muka, dan penggunaan aplikasi MyUT/e-learning.\n`;
    text += `• *Status*: Wajib diikuti.\n\n`;

    text += `*3. WT (Workshop Tugas)*\n`;
    text += `• *Tujuan*: Pelatihan cara mengerjakan tugas akademik, memahami etika penulisan (anti-plagiarisme), teknik sitasi (APA/IEEE style), dan kiat sukses mengerjakan tugas Tuton/TMK.\n`;
    text += `• *Status*: Wajib diikuti.\n\n`;

    text += `*4. KU (Klinik Ujian)*\n`;
    text += `• *Tujuan*: Pembekalan strategi menghadapi Ujian Akhir Semester (UAS), memahami tipe ujian (THE, UTM, UO), dan manajemen kecemasan sebelum ujian.\n`;
    text += `• *Status*: Wajib diikuti menjelang masa ujian.\n\n`;

    text += `💡 *Penting*: Jadwal pelaksanaan LPKBJJ per wilayah Pokjar/SALUT akan diumumkan resmi melalui Media Sosial UT Batam. Mahasiswa wajib memantau pengumuman agar tidak terlewat karena sertifikat keikutsertaan diperlukan untuk kelulusan.`;

    await chat.sendMessage(text);
  }
};

export default lpkbjjCommand;
