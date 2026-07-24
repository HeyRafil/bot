import { Command } from './index.js';
import prisma from '../database/prisma.js';
import { notifyGroupsUpdated } from '../services/whatsappClient.js';

declare let window: any;

export const addGroupCommand: Command = {
  name: 'addgroup',
  aliases: ['joinbot', 'whitelist'],
  roleRequired: 'Admin',
  description: 'Mengaktifkan pemantauan bot di grup ini.',
  async execute(client, msg, chat, args, privileges) {
    if (!chat.isGroup) {
      return msg.reply('❌ Perintah ini hanya dapat dijalankan di dalam grup!');
    }

    const groupId = chat.id._serialized;
    let groupName = null;

    // 1. Try standard getChatById first to fetch fresh name from client
    if (client) {
      try {
        const realChat = await client.getChatById(groupId);
        if (realChat && realChat.name && realChat.name !== 'Grup WA' && realChat.name !== 'Grup' && realChat.name !== 'Grup WhatsApp') {
          groupName = realChat.name;
        }
      } catch (_) {}
    }

    // 2. Try raw message data
    if (!groupName || groupName === 'Grup WA' || groupName === 'Grup' || groupName === 'Grup WhatsApp') {
      const rawMsg = msg as any;
      if (rawMsg._data?.chat?.name) {
        const n = rawMsg._data.chat.name;
        if (n && n !== 'Grup WA' && n !== 'Grup' && n !== 'Grup WhatsApp') {
          groupName = n;
        }
      }
    }

    // 3. Deep search in Puppeteer Store with WidFactory & GroupMetadata
    if ((!groupName || groupName === 'Grup WA' || groupName === 'Grup' || groupName === 'Grup WhatsApp') && client && client.pupPage) {
      try {
        const fetchedName = await client.pupPage.evaluate(async (gid: string) => {
          try {
            const collections = (window as any).require('WAWebCollections');
            const widFactory = (window as any).require('WAWebWidFactory');
            if (!collections) return null;

            let wid = null;
            if (widFactory && typeof widFactory.createWid === 'function') {
              try { wid = widFactory.createWid(gid); } catch (_) {}
            }

            // Chat Store
            if (collections.Chat) {
              let c = collections.Chat.get(gid) || (wid ? collections.Chat.get(wid) : null);
              if (!c && typeof collections.Chat.find === 'function') {
                try { c = await collections.Chat.find(wid || gid); } catch (_) {}
              }
              if (c) {
                const n = c.name || c.formattedTitle || (c.groupMetadata ? c.groupMetadata.subject : null);
                if (n && n !== 'Grup WA' && n !== 'Grup' && n !== 'Grup WhatsApp') return n;
              }
            }

            // GroupMetadata Store
            if (collections.GroupMetadata) {
              let gMeta = collections.GroupMetadata.get(gid) || (wid ? collections.GroupMetadata.get(wid) : null);
              if (!gMeta && typeof collections.GroupMetadata.find === 'function') {
                try { gMeta = await collections.GroupMetadata.find(wid || gid); } catch (_) {}
              }
              if (gMeta && gMeta.subject) return gMeta.subject;
            }
          } catch (_) {}
          return null;
        }, groupId);

        if (fetchedName) groupName = fetchedName;
      } catch (_) {}
    }

    // 4. Try the cached chat.name as fallback
    if (!groupName || groupName === 'Grup WA' || groupName === 'Grup' || groupName === 'Grup WhatsApp') {
      if (chat.name && chat.name !== 'Grup WA' && chat.name !== 'Grup' && chat.name !== 'Grup WhatsApp') {
        groupName = chat.name;
      }
    }

    // 5. Ultimate fallback
    if (!groupName || groupName === 'Grup WA' || groupName === 'Grup' || groupName === 'Grup WhatsApp') {
      groupName = 'Grup WhatsApp';
    }
    
    try {
      // Upsert group record
      await prisma.group.upsert({
        where: { id: groupId },
        update: { status: true, name: groupName },
        create: {
          id: groupId,
          name: groupName,
          status: true
        }
      });

      // Ensure GroupSetting exists
      await prisma.groupSetting.upsert({
        where: { groupId },
        update: {},
        create: {
          groupId,
          welcomeEnabled: true,
          aiEnabled: true
        }
      });

      // Notify frontend dashboard
      notifyGroupsUpdated();

      await chat.sendMessage(`✅ *Bot Berhasil Diaktifkan!*\n\nGrup *${groupName}* telah masuk dalam whitelist sistem. Seluruh fitur keamanan (Anti-Link, Anti-Toxic) dan Asisten AI sekarang dapat digunakan.`);
    } catch (err: any) {
      await msg.reply(`❌ Gagal mengaktifkan grup: ${err.message}`);
    }
  }
};

export default addGroupCommand;
