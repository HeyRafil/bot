import { Command } from './index.js';

export const kelulusanCommand: Command = {
  name: 'kelulusan',
  aliases: ['yudisium', 'wisuda', 'upi'],
  roleRequired: 'Member',
  description: 'Menampilkan informasi syarat kelulusan, yudisium, dan wisuda.',
  async execute(client, msg, chat, args, privileges) {
    let text = `*🎓 PANDUAN KELULUSAN, YUDISIUM, & WISUDA UT BATAM 🎓*\n\n`;
    
    text += `Bagi mahasiswa yang berada di semester akhir (Semester 8 ke atas), berikut adalah alur proses kelulusan:\n\n`;

    text += `*1. Syarat Kelulusan (Kelayakan Akademik)*:\n`;
    text += `• Telah menempuh seluruh SKS wajib sesuai kurikulum prodi (IPK minimal 2.00, tidak ada nilai E).\n`;
    text += `• Lulus mata kuliah *Tugas Akhir Program (TAP)*.\n`;
    text += `• Lulus dan mengunggah *Karya Ilmiah (Karil)* di karil.ut.ac.id.\n`;
    text += `• Bebas tunggakan administrasi dan perpustakaan.\n\n`;

    text += `*2. Yudisium (Penetapan Kelulusan)*:\n`;
    text += `• Mahasiswa mendaftarkan diri secara mandiri untuk proses yudisium atau dicek otomatis oleh kelulusan.ut.ac.id.\n`;
    text += `• Setelah nama Anda tertera pada SK Rektor tentang Kelulusan, Anda resmi berhak menyandang gelar akademik.\n\n`;

    text += `*3. Prosesi Wisuda / Pelepasan*:\n`;
    text += `• *Wisuda UT Pusat*: Diselenggarakan di Kampus UT Pusat (Pondok Cabe, Tangerang Selatan) bagi kuota terbatas per UPBJJ.\n`;
    text += `• *UPI (Upacara Penyerahan Ijazah)*: Diselenggarakan oleh kantor UT Batam di hotel/gedung pertemuan di Batam bagi seluruh lulusan wilayah Kepri.\n\n`;

    text += `💡 *Informasi*: Pemantauan kelulusan dapat diakses di portal: https://kelulusan.ut.ac.id. Pastikan Anda melengkapi berkas pasfoto ijazah di SIA sebelum masa yudisium ditutup!`;

    await chat.sendMessage(text);
  }
};

export default kelulusanCommand;
