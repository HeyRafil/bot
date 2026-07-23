import { Command } from './index.js';

export const syaratCommand: Command = {
  name: 'syarat',
  aliases: ['berkas', 'syaratdaftar'],
  roleRequired: 'Member',
  description: 'Menampilkan persyaratan berkas pendaftaran mahasiswa baru UT Batam.',
  async execute(client, msg, chat, args, privileges) {
    let text = `*📁 PERSYARATAN BERKAS PENDAFTARAN MAHASISWA BARU UT 📁*\n\n`;
    
    text += `Calon mahasiswa baru wajib menyiapkan berkas digital (format JPG/PDF, ukuran maks 1MB per berkas) untuk diunggah saat pendaftaran online di admisi-sia.ut.ac.id:\n\n`;

    text += `*1. Berkas Utama (Wajib)*:\n`;
    text += `• *Formulir Pasfoto*: Pasfoto terbaru ukuran 3x4 (latar belakang merah/biru, wajah menghadap lurus).\n`;
    text += `• *KTP Asli*: Scan KTP asli yang jelas dan terbaca.\n`;
    text += `• *Ijazah Asli*: Scan Ijazah SMA/SMK/MA/sederajat asli. (Bagi lulusan paket C, lampirkan rapor kelas 10-12).\n`;
    text += `• *Formulir Tanda Tangan*: Formulir isian tanda tangan mahasiswa di atas kertas putih polos (diunduh dari SIA).\n`;
    text += `• *Surat Pernyataan Keabsahan Dokumen*: Formulir bermeterai Rp 10.000 (diunduh dari SIA).\n\n`;

    text += `*2. Berkas Tambahan (Khusus)*:\n`;
    text += `• *SK Mengajar*: Khusus pendaftar FKIP PGSD/PGPAUD (minimal mengajar 1 tahun).\n`;
    text += `• *Transkrip Nilai*: Khusus bagi mahasiswa jalur alih kredit / transfer dari kampus lain.\n\n`;

    text += `💡 *Informasi*: Pengunggahan dokumen dilakukan secara mandiri di portal registrasi. Pastikan scan dokumen berwarna (bukan fotokopi hitam putih) agar tidak ditolak oleh verifikator pusat.`;

    await chat.sendMessage(text);
  }
};

export default syaratCommand;
