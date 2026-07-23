import { Command } from './index.js';
import { queryGeneralAI } from '../services/aiService.js';
import logger from '../utils/logger.js';

export const aiCommand: Command = {
  name: 'ai',
  aliases: ['tanya', 'ask'],
  roleRequired: 'Member',
  description: 'Bertanya langsung kepada AI Assistant umum.',
  async execute(client, msg, chat, args, privileges) {
    if (args.length === 0) {
      return msg.reply('❌ Format salah. Silakan ketik: *.ai [pertanyaan Anda]*\nContoh: `.ai apa penemu lampu bohlam?`');
    }

    const query = args.join(' ');
    
    try {
      if (typeof (chat as any).sendStateTyping === 'function') {
        try { await (chat as any).sendStateTyping(); } catch (_) {}
      }
      
      const response = await queryGeneralAI(query);
      await msg.reply(response);
    } catch (err: any) {
      logger.error('AI command failed', err);
      await msg.reply('❌ Maaf, terjadi kesalahan saat menghubungi AI.');
    } finally {
      if (typeof (chat as any).clearState === 'function') {
        try { await (chat as any).clearState(); } catch (_) {}
      }
    }
  }
};

export default aiCommand;
