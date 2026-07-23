import { Command } from './index.js';
import pkg from 'whatsapp-web.js';
import { registerActivePollMenu } from '../utils/pollStore.js';
import logger from '../utils/logger.js';

const { Poll } = pkg;

declare let window: any;

async function getLastSentMessage(client: any, chatId: string): Promise<string | null> {
  try {
    if (client.pupPage) {
      const rawId = await client.pupPage.evaluate(async (chatId: string) => {
        const collections = (window as any).require('WAWebCollections');
        if (collections && collections.Msg) {
          const msgs = collections.Msg.toArray();
          const myMsgs = msgs.filter((m: any) => {
            if (!m.id) return false;
            const remote = m.id.remote;
            const remoteStr = typeof remote === 'string' ? remote : (remote && (remote._serialized || remote.toString()));
            return remoteStr === chatId && m.id.fromMe === true && m.type === 'poll_creation';
          });
          if (myMsgs.length > 0) {
            myMsgs.sort((a: any, b: any) => (a.t || 0) - (b.t || 0));
            const lastMsg = myMsgs[myMsgs.length - 1];
            return lastMsg.id ? (lastMsg.id._serialized || lastMsg.id.$1 || null) : null;
          }
        }
        return null;
      }, chatId);
      return rawId;
    }
  } catch (err: any) {
    logger.error(`[getLastSentMessage] Failed to evaluate last sent message: ${err.message}`);
  }
  return null;
}

export const menuCommand: Command = {
  name: 'menu',
  aliases: ['help', 'pantuan'],
  roleRequired: 'Member',
  description: 'Menampilkan menu bantuan interaktif berbasis polling.',
  async execute(client, msg, chat, args, privileges) {
    const poll = new Poll(
      '📊 *PANDUAN INTERAKTIF MENU BOTWAUT* 📊\n\nSilakan pilih kategori menu yang Anda butuhkan melalui opsi polling di bawah ini:',
      [
        '🏢 Info Akademik UT',
        '💻 Tuton & Sistem Belajar',
        '🎮 Game Arena & PvP RPG',
        '🛡️ Admin & Moderator Grup',
        '📜 Tampilkan Semua Menu (Teks)'
      ]
    );

    const sentMsg = await chat.sendMessage(poll);
    let messageId: string | null = null;

    if (sentMsg && sentMsg.id && sentMsg.id._serialized) {
      messageId = sentMsg.id._serialized;
    } else {
      // Fallback: wait a brief moment for browser to register message, then query it from Store
      await new Promise(resolve => setTimeout(resolve, 500));
      messageId = await getLastSentMessage(client, chat.id._serialized);
    }

    if (messageId) {
      registerActivePollMenu(messageId, chat.id._serialized, msg.author || msg.from);
    } else {
      logger.error(`[MenuCommand] Failed to retrieve sent message ID for menu poll.`);
    }
  }
};

export default menuCommand;
