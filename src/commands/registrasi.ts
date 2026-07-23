import { Command } from './index.js';
import { getSetting } from '../config/settings.js';

export const registrasiCommand: Command = {
  name: 'registrasi',
  aliases: ['reg', 'panduandaftar'],
  roleRequired: 'Member',
  description: 'Menampilkan panduan pendaftaran mahasiswa baru dan registrasi mata kuliah UT.',
  async execute(client, msg, chat, args, privileges) {
    const prefix = await getSetting('PREFIX') || '!';
    let text = `*📝 PANDUAN REGISTRASI & PENDAFTARAN UNIVERSITAS TERBUKA 📝*\n\n`;

    text += `Proses pendaftaran di UT dilakukan secara online. Berikut adalah langkah-langkahnya:\n\n`;

    text += `*1️⃣ Pendaftaran Mahasiswa Baru (Admisi)*\n`;
    text += `• Akses portal admisi resmi di: https://myut.ut.ac.id atau https://admisi-sia.ut.ac.id\n`;
    text += `• Buat akun menggunakan email aktif dan isi data diri sesuai KTP.\n`;
    text += `• Unggah berkas persyaratan (Ijazah dilegalisir, KTP asli, Pas Foto, Surat Pernyataan Keabsahan Dokumen bermaterai).\n`;
    text += `• Lakukan pembayaran Billing Admisi sebesar *Rp 100.000* melalui bank mitra (Mandiri, BRI, BNI, BTN) atau Alfamart/Indomaret.\n\n`;

    text += `*2️⃣ Registrasi Mata Kuliah (Tiap Semester)*\n`;
    text += `• Setelah berkas divalidasi dan mendapatkan NIM (Nomor Induk Mahasiswa), masuk ke portal MyUT Anda.\n`;
    text += `• Masuk ke menu *Akademik* -> *Registrasi Mata Kuliah*.\n`;
    text += `• Pilih skema layanan Anda (SIPAS Paket atau Non-SIPAS eceran).\n`;
    text += `• Klik ajukan dan cetak lembar Billing SPP Uang Kuliah Anda.\n\n`;

    text += `*3️⃣ Pembayaran Uang Kuliah (SPP)*\n`;
    text += `• Bayar sesuai nominal pada Billing SPP sebelum batas waktu kalender akademik berakhir.\n`;
    text += `• Pembayaran dapat dilakukan via teller, ATM, Mobile Banking (Virtual Account), Alfamart, Indomaret, Tokopedia, PosPay, atau BSI.\n\n`;

    text += `💡 *Tips*: Ketik *${prefix}syarat* untuk berkas persyaratan maba, dan *${prefix}kalender* untuk mengecek tenggat waktu registrasi semester ini.`;

    await chat.sendMessage(text);
  }
};

export default registrasiCommand;
