import { Command } from './index.js';

export const kalenderCommand: Command = {
  name: 'kalender',
  aliases: ['jadwal', 'schedule'],
  roleRequired: 'Member',
  description: 'Menampilkan kalender akademik dan batas waktu pendaftaran UT.',
  async execute(client, msg, chat, args, privileges) {
    let text = `*📆 KALENDER AKADEMIK & TANGGAL PENTING UT 2026/2027 📆*\n\n`;
    
    text += `Pastikan Anda mencatat tanggal penting berikut agar tidak terlambat melakukan registrasi atau administrasi:\n\n`;

    text += `*🆕 1. MAHASISWA BARU (ADMISI)*\n`;
    text += `• Pendaftaran Mahasiswa Baru: *Mei – Agustus*\n`;
    text += `• Batas Unggah Berkas Persyaratan: *Agustus*\n`;
    text += `• Batas Pembayaran Biaya Admisi (Rp 100rb): *Agustus*\n\n`;

    text += `*📖 2. MAHASISWA AKTIF & REGISTRASI SEMESTER*\n`;
    text += `• Registrasi Mata Kuliah (Sipas/Non-Sipas): *Juni – September*\n`;
    text += `• Batas Waktu Pembayaran Uang Kuliah (SPP/LIP): *September*\n`;
    text += `• Pendaftaran Tutorial Online (Tuton) & Pengisian Form Kesediaan: *Juni – September*\n\n`;

    text += `*✏️ 3. KEGIATAN BELAJAR MENGAJAR & TUTORIAL*\n`;
    text += `• Aktivasi Kelas Tuton & Tuweb: *Awal Oktober*\n`;
    text += `• Pelaksanaan Tuton (8 Sesi): *Oktober – Desember*\n`;
    text += `• Batas Unggah Tugas Tuton (Tugas 1, 2, 3): *Sesuai jadwal sesi 3, 5, dan 7*\n\n`;

    text += `*📝 4. JADWAL UJIAN AKHIR SEMESTER (UAS)*\n`;
    text += `• Cetak Kartu Tanda Peserta Ujian (KTPU): *November*\n`;
    text += `• Pelaksanaan Ujian Tatap Muka (UTM) & Ujian Online (UO): *Desember*\n`;
    text += `• Pengumuman Nilai Akhir Semester (LKAM): *Awal Februari*\n\n`;

    text += `_Catatan: Jadwal dapat berubah sewaktu-waktu sesuai kebijakan rektorat UT Pusat. Anda dapat mengetik *!status* atau menanyakan ke AI bot untuk kepastian tanggal terkini._`;

    await chat.sendMessage(text);
  }
};

export default kalenderCommand;
