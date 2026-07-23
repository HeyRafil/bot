import { Command } from './index.js';
import logger from '../utils/logger.js';

export const restartCommand: Command = {
  name: 'restart',
  roleRequired: 'Owner',
  description: 'Memulai ulang sistem bot (PM2 otomatis merestart).',
  async execute(client, msg, chat, args, privileges) {
    await msg.reply('🔄 *Memulai ulang sistem...* Bot akan offline selama beberapa detik.');
    logger.info(`System restart initiated by Owner: ${msg.author || msg.from}`);
    
    setTimeout(() => {
      process.exit(0);
    }, 1000);
  }
};

export default restartCommand;
