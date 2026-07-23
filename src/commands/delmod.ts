import { Command } from './index.js';
import prisma from '../database/prisma.js';
import logger from '../utils/logger.js';

export const delModCommand: Command = {
  name: 'delmod',
  aliases: ['delmoderator', 'removemoderator'],
  roleRequired: 'Admin',
  description: 'Menghapus jabatan moderator khusus untuk grup ini saja.',
  async execute(client, msg, chat, args, privileges) {
    if (!chat.isGroup) {
      return msg.reply('❌ Perintah ini hanya dapat dilakukan di dalam grup.');
    }

    const groupId = chat.id._serialized;
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
      return msg.reply('❌ Format salah! Gunakan salah satu cara berikut:\n1. Balas (reply) chat target lalu ketik: *.delmod*\n2. Ketik: *.delmod @user*\n3. Ketik: *.delmod 628xxx*');
    }

    try {
      // Set role back to member
      await prisma.groupMember.upsert({
        where: {
          groupId_whatsappId: {
            groupId,
            whatsappId: targetJid
          }
        },
        update: {
          role: 'member'
        },
        create: {
          groupId,
          whatsappId: targetJid,
          role: 'member'
        }
      });

      await chat.sendMessage(`✅ Berhasil mencopot jabatan *Moderator* khusus @${targetJid.split('@')[0]} di grup ini kembali menjadi Member biasa.`, {
        mentions: [targetJid]
      });
    } catch (err: any) {
      logger.error(`Failed to remove group moderator for ${targetJid} in group ${groupId}:`, err);
      await msg.reply(`❌ Gagal menghapus moderator grup: ${err.message}`);
    }
  }
};

export default delModCommand;
