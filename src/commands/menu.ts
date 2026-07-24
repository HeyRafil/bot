import { Command } from './index.js';

export const menuCommand: Command = {
  name: 'menu',
  aliases: ['help', 'pantuan'],
  roleRequired: 'Member',
  description: 'Menampilkan daftar perintah bantuan bot.',
  async execute(client, msg, chat, args, privileges) {
    const responseText = `📜 *DAFTAR PERINTAH LENGKAP BOTWAUT* 📜\n\n` +
      `*Umum (Member)*:\n` +
      `- *.menu* / *.help* : Tampilkan menu bantuan ini\n` +
      `- *.infout* : Informasi akademik UT\n` +
      `- *.registrasi* : Panduan registrasi\n` +
      `- *.panduan* : Peta jalan akademik\n` +
      `- *.prodi* : Daftar program studi\n` +
      `- *.syarat* : Berkas pendaftaran\n` +
      `- *.lpkbjj* : Orientasi wajib maba\n` +
      `- *.biaya* : Rincian SPP uang kuliah\n` +
      `- *.tbo* : Pembelian buku modul\n` +
      `- *.tuton* : Panduan Tutorial Online\n` +
      `- *.sks* : Aturan beban SKS\n` +
      `- *.nilai* : Cek nilai DNU\n` +
      `- *.kalender* : Batas tanggal penting\n` +
      `- *.salut* : Sentra Layanan UT\n` +
      `- *.kontak* : Helpdesk UT Batam\n` +
      `- *.owner* : Info pembuat bot\n` +
      `- *.saran* : Kirim masukan\n` +
      `- *.rules* : Tata tertib grup\n` +
      `- *.status* : Periksa server\n\n` +
      `*Game Arena*:\n` +
      `- *.fight* : PvP RPG 1v1\n` +
      `- *.fight leaderboard* : Peringkat PvP\n` +
      `- *.ttt* : Game Tic Tac Toe\n` +
      `- *.catur* : Game Catur AI\n` +
      `- *.ping* : Latensi bot\n\n` +
      `*Moderator & Admin*:\n` +
      `- *.warn* / *.warnings* : Sistem peringatan\n` +
      `- *.kick* : Keluarkan anggota\n` +
      `- *.promote* / *.demote* : Atur admin\n` +
      `- *.mute* / *.unmute* : Bisukan chat\n` +
      `- *.tagall* / *.hidetag* : Tag anggota`;

    await chat.sendMessage(responseText);
  }
};

export default menuCommand;
