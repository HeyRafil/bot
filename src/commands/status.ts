import { Command } from './index.js';
import localDb from '../database/localDb.js';
import { getSetting } from '../config/settings.js';

export const statusCommand: Command = {
  name: 'status',
  aliases: ['runtime', 'info', 'stats'],
  roleRequired: 'Moderator',
  description: 'Menampilkan informasi status server VPS, kinerja RAM, dan status database.',
  async execute(client, msg, chat, args, privileges) {
    const rssMemory = Math.round(process.memoryUsage().rss / 1024 / 1024);
    const uptimeSeconds = Math.floor(process.uptime());
    const hours = Math.floor(uptimeSeconds / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
    
    const isAntiLinkEnabled = await getSetting('ANTI_LINK_ENABLED') !== false;
    const prefix = await getSetting('PREFIX') || '!';
    const apiKey = await getSetting('OPENAI_API_KEY');

    let aiSystemStatus = '⚠️ Offline Keyword Indexer';
    if (apiKey) {
      if (apiKey.startsWith('AIzaSy') || apiKey.startsWith('AQ.')) {
        aiSystemStatus = '✅ Google Gemini (RAG Active)';
      } else if (apiKey.startsWith('gsk_')) {
        aiSystemStatus = '✅ Groq Llama (RAG Active)';
      } else {
        aiSystemStatus = '✅ OpenAI GPT (RAG Active)';
      }
    }

    const dbStats = await localDb.getStats();

    const text = `🤖 *STATUS & KINERJA BOT ENTERPRISE VPS* 🤖

• *Uptime Bot:* ${hours} jam, ${minutes} menit
• *Penggunaan RAM:* ${rssMemory} MB / 512 MB (Limit Host)
• *Platform Server:* Node.js (TypeScript ESM)
• *Database Status (Prisma SQLite):*
  - Artikel Pengetahuan: ${dbStats.knowledge} item
  - FAQ Akademik: ${dbStats.faq} item
  - Whitelisted Groups: ${dbStats.groups} grup
• *Sistem AI RAG:* ${aiSystemStatus}
• *Anti-Link Filter:* ${isAntiLinkEnabled ? '✅ Aktif' : '❌ Nonaktif'}
• *Prefix Perintah:* \`${prefix}\``;

    await msg.reply(text);
  }
};

export default statusCommand;
