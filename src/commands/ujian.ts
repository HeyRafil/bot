import { Command } from './index.js';

export const ujianCommand: Command = {
  name: 'ujian',
  aliases: ['uas', 'ktpu'],
  roleRequired: 'Member',
  description: 'Menampilkan informasi sistem ujian (UAS) di Universitas Terbuka.',
  async execute(client, msg, chat, args, privileges) {
    let text = `*📝 PANDUAN UJIAN AKHIR SEMESTER (UAS) UNIVERSITAS TERBUKA 📝*\n\n`;
    
    text += `UT menyelenggarakan Ujian Akhir Semester (UAS) dengan 3 sistem utama:\n\n`;

    text += `*1. UTM (Ujian Tatap Muka)*\n`;
    text += `• *Bentuk*: Ujian tertulis secara langsung menggunakan Lembar Jawaban Ujian (LJU) kertas.\n`;
    text += `• *Lokasi*: Sekolah atau kampus mitra yang ditunjuk oleh UT Batam di wilayah domisili Anda.\n\n`;

    text += `*2. THE (Take Home Exam)*\n`;
    text += `• *Bentuk*: Ujian esai terbuka (open book) secara daring di rumah/tempat masing-masing.\n`;
    text += `• *Akses*: Diunduh dan diunggah kembali di portal https://the.ut.ac.id sesuai jadwal tanggal ujian.\n`;
    text += `• *Durasi*: Umumnya diberikan waktu 12 jam dari saat mengunduh naskah soal.\n\n`;

    text += `*3. UO (Ujian Online)*\n`;
    text += `• *Bentuk*: Ujian berbasis komputer (Computer Based Test) langsung di lokasi ujian.\n`;
    text += `• *Jenis UO*: Terbagi menjadi *UO Mata Kuliah* (bagi yang jadwal ujiannya bentrok) dan *UO TAP* (Tugas Akhir Program).\n`;
    text += `• *Lokasi*: Kantor UT Batam (Sekupang) atau Lab Komputer SALUT mitra di daerah.\n\n`;

    text += `*📇 KTPU (Kartu Tanda Peserta Ujian)*\n`;
    text += `• Menjelang masa ujian, Anda wajib mencetak KTPU di akun MyUT masing-masing.\n`;
    text += `• KTPU berisi informasi **lokasi ujian fisik**, pembagian mata kuliah UTM/THE/UO, serta tanggal dan sesi waktu ujian Anda.`;

    await chat.sendMessage(text);
  }
};

export default ujianCommand;
