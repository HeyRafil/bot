import { Command } from './index.js';
import { getSetting } from '../config/settings.js';

export const panduanCommand: Command = {
  name: 'panduan',
  aliases: ['akademik', 'ut', 'roadmap'],
  roleRequired: 'Member',
  description: 'Menampilkan panduan perjalanan akademik Universitas Terbuka dari Semester 1 - 8.',
  async execute(client, msg, chat, args, privileges) {
    const prefix = await getSetting('PREFIX') || '!';

    let guideText = `*🎓 PANDUAN PERJALANAN AKADEMIK MAHASISWA UT 🎓*\n`;
    guideText += `Universitas Terbuka (UT) Batam\n\n`;
    
    guideText += `Berikut adalah peta jalan (roadmap) perjalanan akademik Anda dari mulai mahasiswa baru hingga lulus:\n\n`;

    guideText += `*🟢 TAHAP 1: MAHASISWA BARU (Semester 1 - 2)*\n`;
    guideText += `• *Admisi & Registrasi*: Pendaftaran awal dan verifikasi berkas di sia.ut.ac.id atau myut.ut.ac.id.\n`;
    guideText += `• *OSMB (Orientasi Studi Mahasiswa Baru)*: Wajib diikuti untuk mengenal sistem belajar mandiri UT.\n`;
    guideText += `• *PKBJJ (Pelatihan Keterampilan Belajar Jarak Jauh)*: Pelatihan membaca modul cepat, merekam hasil baca, dan kesiapan belajar online.\n`;
    guideText += `• *Aktivasi Tuton*: Membuat akun Tutorial Online di elearning.ut.ac.id.\n\n`;

    guideText += `*🔵 TAHAP 2: MAHASISWA AKTIF (Semester 3 - 6)*\n`;
    guideText += `• *Registrasi Mata Kuliah*: Dilakukan setiap awal semester untuk mengambil paket/non-paket mata kuliah.\n`;
    guideText += `• *Pembayaran LIP*: Pembayaran SPP/Uang Kuliah melalui Bank Mitra (BRI, Mandiri, BTN, BNI) atau Alfamart/Indomaret.\n`;
    guideText += `• *Form Kesediaan Tuton*: Wajib diisi setiap awal semester di e-learning agar mata kuliah Anda muncul di kelas Tuton.\n`;
    guideText += `• *Tutorial Online (Tuton) / Tuweb*: Berlangsung selama 8 minggu dengan 3 tugas wajib (Tugas 1 di sesi 3, Tugas 2 di sesi 5, Tugas 3 di sesi 7).\n`;
    guideText += `• *Ujian Online (UO)*: Pendaftaran ujian online bagi mahasiswa yang memiliki mata kuliah bentrok atau ingin memperbaiki nilai.\n\n`;

    guideText += `*🟡 TAHAP 3: MAHASISWA AKHIR (Semester 7 - 8)*\n`;
    guideText += `• *Praktik & Praktikum*: Pelaksanaan kegiatan praktikum lapangan/laboratorium untuk mata kuliah tertentu.\n`;
    guideText += `• *TAP (Tugas Akhir Program)*: Ujian komprehensif bagi mahasiswa yang telah menempuh jumlah SKS tertentu untuk mengukur penguasaan keilmuan prodi.\n`;
    guideText += `• *Karil (Karya Ilmiah)*: Penulisan artikel ilmiah wajib sebagai syarat kelulusan (diunggah ke karil.ut.ac.id).\n`;
    guideText += `• *Yudisium & Kelulusan*: Verifikasi kelayakan akademis untuk menyandang gelar sarjana/diploma.\n`;
    guideText += `• *UPI (Upacara Penyerahan Ijazah) / Wisuda*: Prosesi pelepasan wisudawan baik di UT Pusat maupun di UT Batam.\n\n`;

    guideText += `*✍️ INFORMASI UJIAN & NILAI*\n`;
    guideText += `• *Cetak KTPU*: Dilakukan di akun MyUT menjelang masa ujian untuk melihat jadwal dan lokasi ujian.\n`;
    guideText += `• *UAS THE / UTM*: Pelaksanaan Ujian Akhir Semester baik secara Take Home Exam (online) maupun Tatap Muka.\n`;
    guideText += `• *LKAM (Lembar Kemajuan Akademik)*: Dokumen nilai keseluruhan semester untuk memantau IPK Anda.\n\n`;

    guideText += `-------------------------------------------\n`;
    guideText += `💡 *TIPS ASISTEN AI UT*:\n`;
    guideText += `Untuk mengetahui detail langkah dari setiap poin di atas, Anda bisa langsung bertanya ke bot ini secara gratis. Contoh:\n`;
    guideText += `_- "Bagaimana cara daftar TAP?"_\n`;
    guideText += `_- "Apa syarat mengunggah Karya Ilmiah?"_\n`;
    guideText += `_- "Berapa lama batas bayar SPP?"_\n`;
    
    await chat.sendMessage(guideText);
  }
};

export default panduanCommand;
