import { Command } from './index.js';
import prisma from '../database/prisma.js';
import logger from '../utils/logger.js';

export const addModCommand: Command = {
  name: 'addmod',
  aliases: ['addmoderator'],
  roleRequired: 'Admin',
  description: 'Mendaftarkan moderator baru khusus untuk grup ini saja.',
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
      return msg.reply('❌ Format salah! Gunakan salah satu cara berikut:\n1. Balas (reply) chat target lalu ketik: *.addmod*\n2. Ketik: *.addmod @user*\n3. Ketik: *.addmod 628xxx*');
    }

    const botId = client.info.wid._serialized;
    if (targetJid === botId) {
      return msg.reply('❌ Bot tidak bisa diangkat menjadi moderator.');
    }

    try {
      // Upsert group member role
      await prisma.groupMember.upsert({
        where: {
          groupId_whatsappId: {
            groupId,
            whatsappId: targetJid
          }
        },
        update: {
          role: 'moderator'
        },
        create: {
          groupId,
          whatsappId: targetJid,
          role: 'moderator'
        }
      });

      await chat.sendMessage(`✅ Berhasil mendaftarkan @${targetJid.split('@')[0]} sebagai *Moderator* khusus untuk grup ini.`, {
        mentions: [targetJid]
      });
    } catch (err: any) {
      logger.error(`Failed to register group moderator for ${targetJid} in group ${groupId}:`, err);
      await msg.reply(`❌ Gagal mendaftarkan moderator grup: ${err.message}`);
    }
  }
};

export default addModCommand;
