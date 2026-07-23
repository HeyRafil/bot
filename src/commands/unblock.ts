import { Command } from './index.js';
import prisma from '../database/prisma.js';

export const unblockCommand: Command = {
  name: 'unblock',
  aliases: ['unblacklist'],
  roleRequired: 'Owner',
  description: 'Menghapus pengguna dari daftar hitam (blacklist) bot.',
  async execute(client, msg, chat, args, privileges) {
    let targetJid = '';
    
    const mentions = await msg.getMentions();
    if (mentions.length > 0) {
      targetJid = mentions[0].id._serialized;
    } else if (args[0]) {
      targetJid = args[0].replace(/[^0-9]/g, '') + '@c.us';
    }

    if (!targetJid) {
      return msg.reply('❌ Format salah! Gunakan: *.unblock @user*');
    }

    try {
      await prisma.blacklist.delete({
        where: { whatsappId: targetJid }
      });

      await chat.sendMessage(`✅ @${targetJid.split('@')[0]} berhasil dihapus dari daftar hitam.`, {
        mentions: [targetJid]
      });
    } catch (err: any) {
      await msg.reply(`❌ Gagal menghapus blokir: ${err.message}`);
    }
  }
};

export default unblockCommand;
