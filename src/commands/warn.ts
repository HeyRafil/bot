import { Command } from './index.js';
import prisma from '../database/prisma.js';
import logger from '../utils/logger.js';

async function getOrCreateMember(groupId: string, whatsappId: string) {
  let member = await prisma.groupMember.findUnique({
    where: {
      groupId_whatsappId: {
        groupId,
        whatsappId
      }
    }
  });

  if (!member) {
    member = await prisma.groupMember.create({
      data: {
        groupId,
        whatsappId
      }
    });
  }
  return member;
}

// Get Date object representing exactly 14 days (2 weeks) ago
function getActiveThresholdDate(): Date {
  const date = new Date();
  date.setDate(date.getDate() - 14);
  return date;
}

export const warnCommand: Command = {
  name: 'warn',
  aliases: ['peringatan', 'warning'],
  roleRequired: 'Moderator',
  description: 'Sistem peringatan (warning) untuk anggota grup yang kedaluwarsa setelah 2 minggu.',
  async execute(client, msg, chat, args, privileges) {
    if (!chat.isGroup) {
      return msg.reply('❌ Perintah ini hanya dapat dilakukan di dalam grup.');
    }

    const groupChat = chat as any;
    const groupId = chat.id._serialized;
    const thresholdDate = getActiveThresholdDate();

    // 1. Handle `.warn list` (Only show members with active/non-expired warnings)
    if (args.length > 0 && args[0].toLowerCase() === 'list') {
      const warnedMembers = await prisma.groupMember.findMany({
        where: {
          groupId,
          warnings: {
            some: {
              timestamp: { gte: thresholdDate }
            }
          }
        },
        include: {
          warnings: {
            where: {
              timestamp: { gte: thresholdDate }
            }
          }
        }
      });

      if (warnedMembers.length === 0) {
        return msg.reply('✅ Tidak ada anggota grup yang memiliki peringatan aktif (dalam 2 minggu terakhir).');
      }

      let text = `*📋 DAFTAR PERINGATAN AKTIF DI GRUP INI (2 Minggu Terakhir) 📋*\n\n`;
      warnedMembers.forEach((member, index) => {
        text += `${index + 1}. @${member.whatsappId.split('@')[0]} - *${member.warnings.length}/3* Peringatan Aktif\n`;
      });
      
      const mentions = warnedMembers.map(m => m.whatsappId);
      await chat.sendMessage(text, { mentions });
      return;
    }

    // 2. Identify target user
    let targetId = '';
    let reasonArgs = [...args];

    // Check quoted message
    if (msg.hasQuotedMsg) {
      const quoted = await msg.getQuotedMessage();
      targetId = quoted.author || quoted.from;
    } else {
      // Check mentions
      const mentions = await msg.getMentions();
      if (mentions.length > 0) {
        targetId = mentions[0].id._serialized;
        // Remove target mention from arguments
        const targetMention = `@${targetId.split('@')[0]}`;
        reasonArgs = reasonArgs.filter(arg => arg !== targetMention && !arg.includes(targetId.split('@')[0]));
      } else if (args.length > 0) {
        // Check if first arg is a subcommand like clear/reset/status
        const sub = args[0].toLowerCase();
        if (sub === 'reset' || sub === 'clear' || sub === 'status') {
          // Subcommand with target next
          if (args.length > 1) {
            const cleanNum = args[1].replace(/[^0-9]/g, '');
            if (cleanNum.length >= 9) {
              targetId = `${cleanNum}@c.us`;
            }
          }
        } else {
          // Direct number target
          const cleanNum = args[0].replace(/[^0-9]/g, '');
          if (cleanNum.length >= 9) {
            targetId = `${cleanNum}@c.us`;
            reasonArgs.shift();
          }
        }
      }
    }

    // Handle subcommands target with mention fallback
    if (!targetId && args.length > 1) {
      const mentions = await msg.getMentions();
      if (mentions.length > 0) {
        targetId = mentions[0].id._serialized;
      }
    }

    if (!targetId) {
      let helpText = `*⚠️ FORMAT PERINTAH WARN ⚠️*\n\n`;
      helpText += `• *Beri Peringatan*:\n`;
      helpText += `  Tulis *.warn [alasan]* (sambil reply pesan pelanggar)\n`;
      helpText += `  atau *.warn @user [alasan]*\n\n`;
      helpText += `• *Cek Status Peringatan*:\n`;
      helpText += `  *.warn status @user*\n\n`;
      helpText += `• *Hapus Peringatan Manusiawi*:\n`;
      helpText += `  *.warn reset @user* atau *.warn clear @user*\n\n`;
      helpText += `• *Daftar Seluruh Peringatan*:\n`;
      helpText += `  *.warn list*\n\n`;
      helpText += `💡 *Info*: Setiap peringatan akan *otomatis hangus/reset* setelah *2 minggu* (14 hari) sejak tanggal dibuat.`;
      return msg.reply(helpText);
    }

    const botId = client.info.wid._serialized;
    if (targetId === botId) {
      return msg.reply('❌ Bot tidak bisa memberi peringatan pada dirinya sendiri.');
    }

    const member = await getOrCreateMember(groupId, targetId);

    // 3. Handle `.warn reset` or `.warn clear` (Delete all warnings including history)
    if (args.length > 0 && (args[0].toLowerCase() === 'reset' || args[0].toLowerCase() === 'clear')) {
      await prisma.warning.deleteMany({
        where: {
          groupId,
          memberId: member.id
        }
      });
      return chat.sendMessage(`✅ Peringatan untuk @${targetId.split('@')[0]} telah berhasil di-reset menjadi *0/3*.`, { mentions: [targetId] });
    }

    // 4. Handle `.warn status` (Shows active vs expired warnings)
    if (args.length > 0 && args[0].toLowerCase() === 'status') {
      const allWarnings = await prisma.warning.findMany({
        where: {
          groupId,
          memberId: member.id
        },
        orderBy: { timestamp: 'desc' }
      });

      const activeWarnings = allWarnings.filter(w => new Date(w.timestamp) >= thresholdDate);
      const expiredWarnings = allWarnings.filter(w => new Date(w.timestamp) < thresholdDate);

      let statusText = `ℹ️ *STATUS PERINGATAN* ℹ️\n\n`;
      statusText += `Pengguna: @${targetId.split('@')[0]}\n`;
      statusText += `Peringatan Aktif: *${activeWarnings.length}/3*\n`;
      statusText += `Peringatan Hangus: *${expiredWarnings.length}*\n\n`;
      
      if (activeWarnings.length > 0) {
        statusText += `*⚠️ Riwayat Peringatan Aktif (Dalam 2 Minggu)*:\n`;
        activeWarnings.forEach((warn, index) => {
          statusText += `${index + 1}. [${new Date(warn.timestamp).toLocaleDateString('id-ID')}] ${warn.reason}\n`;
        });
      } else {
        statusText += `_Anggota tidak memiliki peringatan aktif._\n`;
      }

      if (expiredWarnings.length > 0) {
        statusText += `\n*⏱️ Riwayat Peringatan Hangus (> 2 Minggu)*:\n`;
        expiredWarnings.forEach((warn, index) => {
          statusText += `${index + 1}. [${new Date(warn.timestamp).toLocaleDateString('id-ID')}] ${warn.reason} (Hangus)\n`;
        });
      }

      return chat.sendMessage(statusText, { mentions: [targetId] });
    }

    // 5. Default: Warn the target
    let reason = reasonArgs.join(' ').trim();
    if (!reason || reason === 'reset' || reason === 'clear' || reason === 'status') {
      reason = 'Melanggar aturan grup';
    }

    // Create Warning in DB
    await prisma.warning.create({
      data: {
        groupId,
        memberId: member.id,
        reason
      }
    });

    // Count only active warnings (less than 14 days old)
    const activeWarningsCount = await prisma.warning.count({
      where: {
        groupId,
        memberId: member.id,
        timestamp: { gte: thresholdDate }
      }
    });

    let text = `⚠️ *PERINGATAN DIBERIKAN* ⚠️\n\n`;
    text += `Pengguna: @${targetId.split('@')[0]}\n`;
    text += `Alasan: *${reason}*\n`;
    text += `Peringatan Aktif: *${activeWarningsCount}/3*\n`;
    text += `_(Akan hangus otomatis dalam 14 hari)_\n\n`;

    if (activeWarningsCount >= 3) {
      text += `❌ Batas peringatan aktif telah habis. @${targetId.split('@')[0]} akan dikeluarkan otomatis dari grup.`;
      await chat.sendMessage(text, { mentions: [targetId] });

      // Perform Kick
      const botParticipant = groupChat.participants.find((p: any) => p.id._serialized === botId);
      if (botParticipant && (botParticipant.isAdmin || botParticipant.isSuperAdmin)) {
        try {
          await groupChat.removeParticipants([targetId]);
        } catch (kickErr: any) {
          logger.error('Failed to kick warned member', kickErr);
          await chat.sendMessage(`❌ Gagal mengeluarkan anggota secara otomatis. Pastikan bot adalah Admin grup.`);
        }
      } else {
        await chat.sendMessage(`❌ Gagal mengeluarkan anggota secara otomatis karena bot bukan Admin.`);
      }
    } else {
      text += `_Harap patuhi aturan grup untuk menghindari pengeluaran otomatis._`;
      await chat.sendMessage(text, { mentions: [targetId] });
    }
  }
};

export default warnCommand;
