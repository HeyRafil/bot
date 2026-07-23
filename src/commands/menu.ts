import { Command } from './index.js';
import prisma from '../database/prisma.js';
import { getSetting } from '../config/settings.js';

export const menuCommand: Command = {
  name: 'menu',
  aliases: ['help', 'pantuan'],
  roleRequired: 'Member',
  description: 'Menampilkan daftar perintah bot dan fitur keamanan.',
  async execute(client, msg, chat, args, privileges) {
    const prefix = await getSetting('PREFIX') || '.';
    
    let menuText = `*📚 UT ACADEMIC AI ASSISTANT MENU* 📚\n`;
    menuText += `Halo @${(msg.author || msg.from).split('@')[0]}! Berikut adalah panduan perintah bot yang dapat Anda gunakan berdasarkan tingkatan akses Anda.\n\n`;

    menuText += `*🤖 FITUR UTAMA AI RAG*\n`;
    menuText += `Cukup kirim pesan teks secara langsung di private chat atau tag bot di grup (misal: @bot bagaimana cara registrasi?) untuk menanyakan informasi akademik Universitas Terbuka.\n\n`;

    menuText += `*👤 PERINTAH MEMBER (UMUM)*\n`;
    menuText += `- \`${prefix}menu\` : Menampilkan menu bantuan ini.\n`;
    menuText += `- \`${prefix}infout\` : Menampilkan menu informasi akademik Universitas Terbuka.\n`;
    menuText += `- \`${prefix}registrasi\` : Menampilkan panduan pendaftaran maba & registrasi mata kuliah.\n`;
    menuText += `- \`${prefix}panduan\` : Menampilkan peta jalan akademik UT (Smt 1 - 8).\n`;
    menuText += `- \`${prefix}prodi\` : Menampilkan daftar Program Studi S1/Diploma di UT Batam.\n`;
    menuText += `- \`${prefix}syarat\` : Menampilkan berkas syarat daftar mahasiswa baru.\n`;
    menuText += `- \`${prefix}lpkbjj\` : Menampilkan panduan 4 kegiatan wajib LPKBJJ maba.\n`;
    menuText += `- \`${prefix}biaya\` : Menampilkan rincian SPP kuliah & metode bayar.\n`;
    menuText += `- \`${prefix}tbo\` : Menampilkan panduan beli modul (buku) & baca digital.\n`;
    menuText += `- \`${prefix}tuton\` : Menampilkan panduan Tutorial Online (Tuton) & Tuweb.\n`;
    menuText += `- \`${prefix}sks\` : Menampilkan aturan beban SKS & total syarat kelulusan.\n`;
    menuText += `- \`${prefix}si\` : Cari & filter bahan belajar kredibel Sistem Informasi.\n`;
    menuText += `- \`${prefix}ujian\` : Menampilkan panduan tipe ujian UAS (UTM, THE, UO) & KTPU.\n`;
    menuText += `- \`${prefix}nilai\` : Menampilkan panduan cek nilai DNU/LKAM & bobot Tuton.\n`;
    menuText += `- \`${prefix}karil\` : Menampilkan panduan bimbingan Karya Ilmiah (Karil) wajib.\n`;
    menuText += `- \`${prefix}akreditasi\` : Menampilkan status akreditasi institusi & prodi UT.\n`;
    menuText += `- \`${prefix}pustaka\` : Menampilkan layanan perpus digital & bebas pustaka.\n`;
    menuText += `- \`${prefix}kalender\` : Menampilkan kalender akademik & batas tanggal penting.\n`;
    menuText += `- \`${prefix}salut\` : Menampilkan daftar Sentra Layanan UT (SALUT) di Kepri.\n`;
    menuText += `- \`${prefix}kelulusan\` : Menampilkan syarat yudisium kelulusan & info wisuda.\n`;
    menuText += `- \`${prefix}kontak\` : Menampilkan kontak penting resmi UT Batam & Pusat.\n`;
    menuText += `- \`${prefix}owner\` : Menampilkan informasi owner/pembuat bot.\n`;
    menuText += `- \`${prefix}saran\` : Mengirimkan saran/masukan untuk pengembangan bot.\n`;
    menuText += `- \`${prefix}ping\` : Memeriksa latensi respon bot.\n`;
    menuText += `- \`${prefix}ttt\` : Memulai game Tic Tac Toe interaktif 1 vs 1.\n`;
    menuText += `- \`${prefix}catur\` : Bermain catur modern kelompok atau melawan AI (Web/Chat).\n`;
    menuText += `- \`${prefix}donasi\` : Dukung/donasi pengembangan bot (SociaBuzz).\n`;
    menuText += `- \`${prefix}rules\` : Menampilkan tata tertib grup kuliah.\n`;
    menuText += `- \`${prefix}status\` : Memeriksa status koneksi & server bot.\n\n`;

    if (privileges.level >= 1) { // Moderator and above
      menuText += `*🛡️ PERINTAH MODERATOR*\n`;
      menuText += `- \`${prefix}warn @user\` : Memberikan peringatan ke member.\n`;
      menuText += `- \`${prefix}warnings @user\` : Cek jumlah peringatan member.\n`;
      menuText += `- \`${prefix}clearwarn @user\` : Menghapus semua peringatan member.\n\n`;
    }

    if (privileges.level >= 2) { // Admin and above
      menuText += `*⚙️ PERINTAH ADMIN GRUP*\n`;
      menuText += `- \`${prefix}addgroup\` : Mendaftarkan grup ini ke whitelist bot.\n`;
      menuText += `- \`${prefix}delgroup\` : Menghapus grup ini dari whitelist bot.\n`;
      menuText += `- \`${prefix}kick @user\` : Mengeluarkan member dari grup.\n`;
      menuText += `- \`${prefix}add 628xxx\` : Menambahkan nomor ke dalam grup.\n`;
      menuText += `- \`${prefix}promote @user\` : Menaikkan peran member menjadi admin.\n`;
      menuText += `- \`${prefix}demote @user\` : Menurunkan peran admin menjadi member.\n`;
      menuText += `- \`${prefix}mute\` / \`${prefix}unmute\` : Membisukan grup (hanya admin yang bisa chat).\n`;
      menuText += `- \`${prefix}addmod @user\` : Menambahkan moderator khusus grup ini.\n`;
      menuText += `- \`${prefix}delmod @user\` : Menghapus moderator khusus grup ini.\n\n`;
    }

    if (privileges.level >= 3) { // Super Admin and above
      menuText += `*👑 PERINTAH SUPER ADMIN*\n`;
      menuText += `- \`${prefix}lock\` / \`${prefix}unlock\` : Mengunci setelan edit info grup.\n`;
      menuText += `- \`${prefix}tagall\` : Mengirim pesan ke seluruh member grup.\n`;
      menuText += `- \`${prefix}hidetag [pesan]\` : Mengirim pesan tag tersembunyi.\n`;
      menuText += `- \`${prefix}pengumuman [pesan]\` : Kirim pengumuman penting khusus ke grup utama.\n\n`;
    }

    if (privileges.isOwner) { // Owner only
      menuText += `*🔴 PERINTAH KHUSUS OWNER*\n`;
      menuText += `- \`${prefix}backup\` : Melakukan backup SQLite database & file lokal.\n`;
      menuText += `- \`${prefix}restart\` : Muat ulang sistem bot & koneksi.\n`;
      menuText += `- \`${prefix}bukasaran\` : Membuka/membaca seluruh daftar saran masuk dari database.\n`;
      menuText += `- \`${prefix}crawlsi\` : Crawl kurikulum SI terbaru dari web UT ke database.\n`;
      menuText += `- \`${prefix}addadmin @user [role]\` : Daftarkan admin global baru.\n`;
      menuText += `- \`${prefix}deladmin @user\` : Hapus hak admin global seseorang.\n`;
      menuText += `- \`${prefix}listadmin\` : Tampilkan seluruh daftar admin global.\n`;
      menuText += `- \`${prefix}block @user [alasan]\` : Mem-blacklist pengguna dari bot.\n`;
      menuText += `- \`${prefix}unblock @user\` : Menghapus pengguna dari blacklist.\n\n`;
    }

    menuText += `*🛡️ FITUR KEAMANAN GRUP (ANTI-X)*\n`;
    menuText += `Fitur berikut dapat diaktifkan per grup via Web Dashboard Control Panel:\n`;
    menuText += `- *Anti-Link* (Mencegah pengiriman link group/tautan)\n`;
    menuText += `- *Anti-Toxic* (Menghapus pesan kotor/profanitas)\n`;
    menuText += `- *Anti-Virtex* (Mencegah spam overload karakter)\n`;
    menuText += `- *Anti-Fake-Number* (Mencegah nomor asing masuk)\n`;
    menuText += `- *Anti-Bot* (Keluarkan bot luar)\n\n`;

    menuText += `_Tingkatan Peran Anda saat ini: *${privileges.role}*_`;

    await chat.sendMessage(menuText, {
      mentions: [msg.author || msg.from]
    });
  }
};

export default menuCommand;
