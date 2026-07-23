import { Command } from './index.js';

export const kickCommand: Command = {
  name: 'kick',
  aliases: ['remove', 'keluarkan'],
  roleRequired: 'Moderator',
  description: 'Mengeluarkan anggota dari grup.',
  async execute(client, msg, chat, args, privileges) {
    if (!chat.isGroup) {
      return msg.reply('❌ Perintah ini hanya dapat dilakukan di dalam grup.');
    }

    // Check if the bot itself is admin in the group to perform kicks
    const groupChat = chat as any;
    const botId = client.info.wid._serialized;
    const botParticipant = groupChat.participants.find((p: any) => p.id._serialized === botId);
    
    if (!botParticipant || (!botParticipant.isAdmin && !botParticipant.isSuperAdmin)) {
      return msg.reply('❌ Bot harus menjadi Admin grup terlebih dahulu untuk mengeluarkan anggota.');
    }

    // Get the target user JID (either from mention or arguments)
    let targetId = '';
    const mentions = await msg.getMentions();
    
    if (mentions.length > 0) {
      targetId = mentions[0].id._serialized;
    } else if (args.length > 0) {
      const cleanNum = args[0].replace(/[^0-9]/g, '');
      if (cleanNum.length >= 9) {
        targetId = `${cleanNum}@c.us`;
      }
    }

    if (!targetId) {
      return msg.reply('❌ Format salah. Tag anggota yang ingin dikeluarkan atau tulis nomor teleponnya.\nContoh: `.kick @nama` atau `.kick 62812345678`');
    }

    if (targetId === botId) {
      return msg.reply('❌ Bot tidak bisa mengeluarkan dirinya sendiri.');
    }

    try {
      await groupChat.removeParticipants([targetId]);
      await msg.reply('✅ Anggota berhasil dikeluarkan.');
    } catch (err: any) {
      logger.error('Failed to kick member', err);
      await msg.reply('❌ Gagal mengeluarkan anggota. Pastikan nomor benar dan bot memiliki hak akses.');
    }
  }
};

import logger from '../utils/logger.js';
export default kickCommand;
