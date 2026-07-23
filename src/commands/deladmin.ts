import { Command } from './index.js';
import prisma from '../database/prisma.js';
import logger from '../utils/logger.js';

export const delAdminCommand: Command = {
  name: 'deladmin',
  aliases: ['removeadmin', 'unregisteradmin'],
  roleRequired: 'Owner',
  description: 'Menghapus hak akses admin global seseorang.',
  async execute(client, msg, chat, args, privileges) {
    let targetJid = '';
    
    // 1. Resolve JID from quoted/replied message
    if (msg.hasQuotedMsg) {
      try {
        const quoted = await msg.getQuotedMessage();
        targetJid = quoted.author || quoted.from;
      } catch (_) {}
    }

    // 2. Resolve JID from mentions
    if (!targetJid) {
      const mentions = await msg.getMentions();
      if (mentions.length > 0) {
        targetJid = mentions[0].id._serialized;
      }
    }

    // 3. Resolve JID from phone number in arguments
    if (!targetJid && args.length > 0) {
      for (const arg of args) {
        const cleanNum = arg.replace(/[^0-9]/g, '');
        if (cleanNum.length >= 9) {
          targetJid = `${cleanNum}@c.us`;
          break;
        }
      }
    }

    if (!targetJid) {
      return msg.reply('❌ Format salah! Gunakan salah satu cara berikut:\n1. Balas (reply) chat target lalu ketik: *.deladmin*\n2. Ketik: *.deladmin @user*\n3. Ketik: *.deladmin 628xxx*');
    }

    try {
      await prisma.admin.delete({
        where: { whatsappId: targetJid }
      });

      await chat.sendMessage(`✅ Berhasil menghapus hak akses admin global untuk @${targetJid.split('@')[0]}.`, {
        mentions: [targetJid]
      });
    } catch (err: any) {
      logger.error(`Failed to delete global admin for ${targetJid}:`, err);
      await msg.reply(`❌ Gagal menghapus admin (mungkin nomor tersebut memang bukan admin global).`);
    }
  }
};

export default delAdminCommand;
