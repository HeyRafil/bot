import { Command } from './index.js';
import prisma from '../database/prisma.js';
import logger from '../utils/logger.js';

interface LeaderboardRow {
  id: string;
  groupId: string;
  whatsappId: string;
  name: string | null;
  quizScore: number;
}

export const leaderboardCommand: Command = {
  name: 'leaderboard',
  aliases: ['top', 'papanperingkat', 'scores'],
  roleRequired: 'Member',
  description: 'Menampilkan papan peringkat (top 10) skor kuis grup ini.',
  async execute(client, msg, chat, args, privileges) {
    if (!chat.isGroup) {
      return msg.reply('❌ Papan peringkat kuis hanya tersedia untuk obrolan grup!');
    }

    const groupId = chat.id._serialized;

    try {
      // Query raw to fetch members with quizScore > 0 sorted desc
      const rawRows = await prisma.$queryRaw`
        SELECT id, groupId, whatsappId, name, quizScore 
        FROM group_members 
        WHERE groupId = ${groupId} AND quizScore > 0 
        ORDER BY quizScore DESC 
        LIMIT 10
      ` as LeaderboardRow[];

      if (!rawRows || rawRows.length === 0) {
        return msg.reply('⚠️ Belum ada mahasiswa di grup ini yang memiliki skor kuis. Ketik *.quiz* untuk memulai kuis baru!');
      }

      let text = `🏆 *PAPAN PERINGKAT KUIS AKADEMIK GRUP* 🏆\n`;
      text += `_Grup: ${chat.name}_\n\n`;

      const mentions: string[] = [];

      rawRows.forEach((row, index) => {
        const number = row.whatsappId.split('@')[0];
        const displayName = row.name || number;
        let medal = '👤';
        if (index === 0) medal = '🥇';
        else if (index === 1) medal = '🥈';
        else if (index === 2) medal = '🥉';

        text += `${medal} *#${index + 1}* - @${number} (*${displayName}*)\n`;
        text += `   └─ Skor: *${row.quizScore} Poin*\n\n`;
        mentions.push(row.whatsappId);
      });

      text += `Ayo terus asah pengetahuan akademik UT Anda! Ketik *.quiz* untuk bertanding lagi.`;
      
      await chat.sendMessage(text, { mentions });
    } catch (err: any) {
      logger.error('Failed to fetch leaderboard from database', err);
      await msg.reply('❌ Gagal mengambil papan peringkat kuis saat ini.');
    }
  }
};

export default leaderboardCommand;
