import { Command } from './index.js';
import prisma from '../database/prisma.js';
import logger from '../utils/logger.js';

export const addAdminCommand: Command = {
  name: 'addadmin',
  aliases: ['registeradmin'],
  roleRequired: 'Owner',
  description: 'Mendaftarkan admin global baru (Super Admin/Admin/Moderator).',
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
      return msg.reply('❌ Format salah! Gunakan salah satu cara berikut:\n1. Balas (reply) chat target lalu ketik: *.addadmin [role]*\n2. Ketik: *.addadmin @user [role]*\n3. Ketik: *.addadmin 628xxx [role]*\n\n*(Pilihan role: SuperAdmin, Admin, Moderator)*');
    }

    // 4. Resolve role dynamically from arguments text
    let role = 'Admin'; // Default role if not specified
    const argsText = args.join(' ').toLowerCase();

    if (argsText.includes('superadmin') || argsText.includes('super admin')) {
      role = 'SuperAdmin';
    } else if (argsText.includes('moderator')) {
      role = 'Moderator';
    } else if (argsText.includes('admin')) {
      role = 'Admin';
    }

    try {
      await prisma.admin.upsert({
        where: { whatsappId: targetJid },
        update: { role },
        create: {
          whatsappId: targetJid,
          role,
          name: targetJid.split('@')[0]
        }
      });

      await chat.sendMessage(`✅ Berhasil mendaftarkan @${targetJid.split('@')[0]} sebagai *${role}* global.`, {
        mentions: [targetJid]
      });
    } catch (err: any) {
      logger.error(`Failed to register global admin for ${targetJid}:`, err);
      await msg.reply(`❌ Gagal mendaftarkan admin: ${err.message}`);
    }
  }
};

export default addAdminCommand;
