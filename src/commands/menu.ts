import { Command } from './index.js';
import pkg from 'whatsapp-web.js';
import { registerActivePollMenu } from '../utils/pollStore.js';

const { Poll } = pkg;

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
    if (sentMsg && sentMsg.id && sentMsg.id._serialized) {
      registerActivePollMenu(sentMsg.id._serialized, chat.id._serialized);
    }
  }
};

export default menuCommand;
