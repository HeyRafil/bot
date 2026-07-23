import { Command } from './index.js';

export const nilaiCommand: Command = {
  name: 'nilai',
  aliases: ['lkam', 'ipk'],
  roleRequired: 'Member',
  description: 'Menampilkan informasi cara cek nilai UAS, LKAM, dan pembobotan nilai.',
  async execute(client, msg, chat, args, privileges) {
    let text = `*📊 PANDUAN NILAI UAS & LKAM UNIVERSITAS TERBUKA 📊*\n\n`;
    
    text += `Berikut adalah informasi cara memeriksa nilai kuliah dan memahami sistem penilaian di UT:\n\n`;

    text += `*1. Cara Cek Nilai Akhir Semester*:\n`;
    text += `• Nilai UAS diumumkan sekitar 1 bulan setelah ujian berakhir.\n`;
    text += `• Anda dapat mengecek nilai di portal MyUT (myut.ut.ac.id) -> masuk ke menu *Akademik* -> *Daftar Nilai Ujian (DNU)* atau *LKAM (Lembar Kemajuan Akademik Mahasiswa)*.\n\n`;

    text += `*2. Pembobotan Nilai Akhir (Nilai Tuton vs UAS)*:\n`;
    text += `Nilai akhir mata kuliah merupakan gabungan dari Nilai Tutorial (Tuton/Tuweb) dan Nilai UAS dengan ketentuan:\n`;
    text += `• *Kontribusi Tuton*: Berkontribusi sebesar **30%** terhadap nilai akhir.\n`;
    text += `• *Kontribusi Tuweb*: Berkontribusi sebesar **50%** terhadap nilai akhir.\n`;
    text += `• *Syarat Wajib*: Nilai UAS Anda **wajib minimal 30** (menjawab benar minimal 30% soal). Jika nilai UAS di bawah 30, maka nilai Tuton/Tuweb **tidak akan berkontribusi** (otomatis nilai murni diambil dari hasil UAS saja).\n\n`;

    text += `*3. Ketentuan Perbaikan Nilai (Nilai D / E)*:\n`;
    text += `• Jika mendapatkan nilai *D* atau *E*, Anda disarankan untuk mengulang mata kuliah tersebut pada semester berikutnya dengan meregistrasikannya kembali, atau mengikuti *Ujian Online (UO) Remedial* jika kuota tersedia.`;

    await chat.sendMessage(text);
  }
};

export default nilaiCommand;
