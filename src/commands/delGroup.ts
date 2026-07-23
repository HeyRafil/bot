import { Command } from './index.js';
import prisma from '../database/prisma.js';
import { notifyGroupsUpdated } from '../services/whatsappClient.js';

export const delGroupCommand: Command = {
  name: 'delgroup',
  aliases: ['leavebot', 'unwhitelist'],
  roleRequired: 'Admin',
  description: 'Menonaktifkan pemantauan bot di grup ini.',
  async execute(client, msg, chat, args, privileges) {
    if (!chat.isGroup) {
      return msg.reply('❌ Perintah ini hanya dapat dijalankan di dalam grup!');
    }

    const groupId = chat.id._serialized;

    try {
      await prisma.group.update({
        where: { id: groupId },
        data: { status: false }
      });

      // Notify frontend dashboard
      notifyGroupsUpdated();

      await chat.sendMessage(`❌ *Bot Dinonaktifkan!* Grup ini telah dinonaktifkan dari whitelist. Bot tidak akan merespons pesan atau perintah apa pun di grup ini lagi.`);
    } catch (err: any) {
      await msg.reply(`❌ Gagal menonaktifkan grup: ${err.message}`);
    }
  }
};

export default delGroupCommand;
