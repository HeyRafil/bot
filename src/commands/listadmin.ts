import { Command } from './index.js';
import prisma from '../database/prisma.js';

export const listAdminCommand: Command = {
  name: 'listadmin',
  roleRequired: 'Owner',
  description: 'Menampilkan daftar admin global.',
  async execute(client, msg, chat, args, privileges) {
    try {
      const admins = await prisma.admin.findMany();
      if (admins.length === 0) {
        return msg.reply('ℹ️ Belum ada admin global yang terdaftar.');
      }

      let text = `*👥 DAFTAR ADMIN GLOBAL BOT 👥*\n\n`;
      admins.forEach((admin, idx) => {
        text += `${idx + 1}. @${admin.whatsappId.split('@')[0]} - Peran: *${admin.role}*\n`;
      });

      await chat.sendMessage(text, {
        mentions: admins.map(a => a.whatsappId)
      });
    } catch (err: any) {
      await msg.reply(`❌ Gagal mengambil daftar admin: ${err.message}`);
    }
  }
};

export default listAdminCommand;
