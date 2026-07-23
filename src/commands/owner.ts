import { Command } from './index.js';
import prisma from '../database/prisma.js';
import { getSetting } from '../config/settings.js';

export const ownerCommand: Command = {
  name: 'owner',
  aliases: ['pembuat', 'creator'],
  roleRequired: 'Member',
  description: 'Menampilkan informasi owner/pembuat bot.',
  async execute(client, msg, chat, args, privileges) {
    try {
      // 1. Get owner list from database
      const dbAdmins = await prisma.admin.findMany();
      const dbOwners = dbAdmins.filter(admin => {
        const roles = admin.role.split(',').map(r => r.trim().toLowerCase());
        return roles.includes('owner');
      });

      // 2. Get owner number from config settings
      const configOwner = await getSetting('OWNER_NUMBER') || '';
      const configOwnersList = configOwner
        .split(',')
        .map((n: string) => n.trim())
        .filter((n: string) => n.length > 0);

      // Combine owners into a unique map based on WhatsApp JID (number@c.us)
      const uniqueOwners = new Map<string, { whatsappId: string; name?: string | null }>();

      // Add config owners first
      configOwnersList.forEach((num: string) => {
        const jid = num.includes('@') ? num : `${num}@c.us`;
        uniqueOwners.set(jid, { whatsappId: jid, name: 'Sistem Owner' });
      });

      // Add database owners (overwrites with DB details if matched)
      dbOwners.forEach(owner => {
        const jid = owner.whatsappId.includes('@') ? owner.whatsappId : `${owner.whatsappId}@c.us`;
        uniqueOwners.set(jid, { whatsappId: jid, name: owner.name || 'Owner' });
      });

      let text = `*👑 OWNER / PEMBUAT BOT 👑*\n\n`;
      text += `Berikut adalah kontak owner/pembuat bot yang dapat dihubungi:\n`;

      const ownersArray = Array.from(uniqueOwners.values());
      const mentions: string[] = [];

      if (ownersArray.length > 0) {
        ownersArray.forEach((owner, idx) => {
          const number = owner.whatsappId.split('@')[0];
          text += `\n📍 *Owner ${idx + 1}:*\n`;
          text += `• *Nama/Info*: ${owner.name || 'Pembuat Bot'}\n`;
          text += `• *Nomor*: @${number}\n`;
          text += `• *Chat Langsung*: https://wa.me/${number}\n`;
          mentions.push(owner.whatsappId);
        });
      } else {
        text += `\n⚠️ _Belum ada owner yang dikonfigurasi di sistem._\n`;
      }

      text += `\n☕ *Dukung Developer (SociaBuzz):* https://sociabuzz.com/rafildev\n`;

      await chat.sendMessage(text, { mentions });
    } catch (err: any) {
      await msg.reply(`❌ Gagal mengambil informasi owner: ${err.message}`);
    }
  }
};

export default ownerCommand;
