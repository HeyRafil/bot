import { Command } from './index.js';

export const sksCommand: Command = {
  name: 'sks',
  aliases: ['bebansks', 'kredit'],
  roleRequired: 'Member',
  description: 'Menampilkan informasi aturan beban SKS dan total SKS kelulusan di UT.',
  async execute(client, msg, chat, args, privileges) {
    let text = `*📚 ATURAN SATUAN KREDIT SEMESTER (SKS) UNIVERSITAS TERBUKA 📚*\n\n`;
    
    text += `SKS adalah ukuran beban studi mahasiswa. Berikut adalah aturan pengambilan dan beban SKS di UT:\n\n`;

    text += `*1. Skema Pengambilan SKS*:\n`;
    text += `• *SIPAS (Paket)*: Beban SKS Anda sudah otomatis ditentukan oleh UT setiap semesternya (berkisar *19 s.d 24 SKS*). Anda tinggal membayar paket LIP SPP tanpa perlu memilih mata kuliah sendiri.\n`;
    text += `• *Non-SIPAS (Non-Paket)*: Anda bebas memilih mata kuliah sendiri secara eceran per semester (membayar tarif per SKS, berkisar *Rp 35.000 s.d Rp 85.000* per SKS).\n\n`;

    text += `*2. Batas Maksimal SKS per Semester (Non-SIPAS)*:\n`;
    text += `Jumlah maksimal SKS yang dapat diregistrasikan per semester ditentukan oleh IPK semester sebelumnya:\n`;
    text += `• IPK *≥ 3.00*: Maksimal mengambil *24 SKS*.\n`;
    text += `• IPK *2.00 - 2.99*: Maksimal mengambil *21 SKS*.\n`;
    text += `• IPK *< 2.00*: Maksimal mengambil *18 SKS*.\n\n`;

    text += `*3. Total SKS Syarat Kelulusan (Yudisium)*:\n`;
    text += `Untuk menyelesaikan studi dan menyandang gelar sarjana/diploma, total beban SKS yang wajib ditempuh adalah:\n`;
    text += `• *Program Sarjana (S1)*: Wajib menyelesaikan total *144 - 146 SKS* (sesuai kurikulum program studi Anda).\n`;
    text += `• *Program Diploma (D3)*: Wajib menyelesaikan total *110 - 120 SKS*.\n\n`;

    text += `💡 *Tips*: 1 SKS di UT setara dengan waktu belajar mandiri kurang lebih 2 jam per minggu. Pastikan Anda mengatur waktu belajar dengan baik jika mengambil beban penuh 24 SKS!`;

    await chat.sendMessage(text);
  }
};

export default sksCommand;
