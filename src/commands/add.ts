import { Command } from './index.js';
import logger from '../utils/logger.js';

export const addCommand: Command = {
  name: 'add',
  aliases: ['tambah', 'undang'],
  roleRequired: 'Admin',
  description: 'Menambahkan anggota baru ke dalam grup.',
  async execute(client, msg, chat, args, privileges) {
    if (!chat.isGroup) {
      return msg.reply('❌ Perintah ini hanya dapat dilakukan di dalam grup.');
    }

    const groupChat = chat as any;
    const botId = client.info.wid._serialized;
    const botParticipant = groupChat.participants.find((p: any) => p.id._serialized === botId);
    
    if (!botParticipant || (!botParticipant.isAdmin && !botParticipant.isSuperAdmin)) {
      return msg.reply('❌ Bot harus menjadi Admin grup terlebih dahulu untuk menambahkan anggota.');
    }

    if (args.length === 0) {
      return msg.reply('❌ Format salah. Tulis nomor telepon yang ingin ditambahkan.\nContoh: `.add 62812345678`');
    }

    const cleanNum = args[0].replace(/[^0-9]/g, '');
    if (cleanNum.length < 9) {
      return msg.reply('❌ Nomor telepon tidak valid.');
    }
    const targetId = `${cleanNum}@c.us`;

    try {
      await groupChat.addParticipants([targetId]);
      await msg.reply('✅ Anggota berhasil ditambahkan.');
    } catch (err: any) {
      logger.error('Failed to add member', err);
      await msg.reply('❌ Gagal menambahkan anggota. (Beberapa nomor tidak dapat ditambahkan langsung karena pengaturan privasi mereka; jika gagal, silakan gunakan link undangan).');
    }
  }
};

export default addCommand;
