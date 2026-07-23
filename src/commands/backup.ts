import { Command } from './index.js';
import { backupDatabase } from '../utils/backup.js';

export const backupCommand: Command = {
  name: 'backup',
  aliases: ['cadangkan'],
  roleRequired: 'Admin',
  description: 'Membuat salinan cadangan (backup) database bot.',
  async execute(client, msg, chat, args, privileges) {
    await msg.reply('📦 Sedang membuat backup database lokal...');
    try {
      const backupPath = await backupDatabase();
      await msg.reply(`✅ Backup selesai! File disimpan di: \`${backupPath}\``);
    } catch (err: any) {
      await msg.reply(`❌ Gagal membuat backup: ${err.message}`);
    }
  }
};

export default backupCommand;
