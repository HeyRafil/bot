import { Command } from './index.js';
import prisma from '../database/prisma.js';

export const blockCommand: Command = {
  name: 'block',
  aliases: ['blacklist'],
  roleRequired: 'Owner',
  description: 'Memasukkan pengguna ke daftar hitam (blacklist) bot.',
  async execute(client, msg, chat, args, privileges) {
    let targetJid = '';
    
    const mentions = await msg.getMentions();
    if (mentions.length > 0) {
      targetJid = mentions[0].id._serialized;
    } else if (args[0]) {
      targetJid = args[0].replace(/[^0-9]/g, '') + '@c.us';
    }

    if (!targetJid) {
      return msg.reply('❌ Format salah! Gunakan: *.block @user [alasan]*');
    }

    const reason = args.slice(1).join(' ') || 'Melanggar aturan bot';

    try {
      await prisma.blacklist.upsert({
        where: { whatsappId: targetJid },
        update: { reason },
        create: {
          whatsappId: targetJid,
          reason
        }
      });

      await chat.sendMessage(`🚫 @${targetJid.split('@')[0]} berhasil diblokir dari sistem bot. Alasan: ${reason}`, {
        mentions: [targetJid]
      });
    } catch (err: any) {
      await msg.reply(`❌ Gagal memblokir: ${err.message}`);
    }
  }
};

export default blockCommand;
