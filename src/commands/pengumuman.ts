import { Command } from './index.js';
import logger from '../utils/logger.js';

export const pengumumanCommand: Command = {
  name: 'pengumuman',
  aliases: ['announce', 'bcgrup'],
  roleRequired: 'Super Admin',
  description: 'Mengirimkan pengumuman penting khusus ke grup utama Mahasiswa UT.',
  async execute(client, msg, chat, args, privileges) {
    const targetGroupJid = '120363410088404156@g.us';

    if (args.length === 0) {
      return msg.reply('❌ Format salah! Harap masukkan isi pesan pengumuman.\nContoh: *.pengumuman Informasi penting mengenai jadwal registrasi...*');
    }

    const messageText = args.join(' ').trim();
    
    // Format announcement message beautifully
    let announcementBody = `*📢 PENGUMUMAN PENTING 📢*\n`;
    announcementBody += `──────────────────\n\n`;
    announcementBody += `${messageText}\n\n`;
    announcementBody += `──────────────────\n`;
    announcementBody += `_Dikirim oleh: @${(msg.author || msg.from).split('@')[0]}_`;

    try {
      // Send to target group
      await client.sendMessage(targetGroupJid, announcementBody, {
        mentions: [msg.author || msg.from]
      });

      // Send confirmation to the chat where the command was triggered
      await chat.sendMessage(`✅ Pengumuman berhasil dikirim ke grup utama UT.`);
    } catch (err: any) {
      logger.error(`Failed to send announcement to group ${targetGroupJid}:`, err);
      await msg.reply(`❌ Gagal mengirim pengumuman ke grup tujuan. Pastikan bot berada di grup tersebut.`);
    }
  }
};

export default pengumumanCommand;
