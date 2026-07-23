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
    let groupName = chat.name;

    // Deep-resolve real group name from all available sources
    if (!groupName || groupName === 'Grup WA' || groupName === 'Grup') {
      // 1. Check raw message data
      const rawMsg = msg as any;
      if (rawMsg._data?.chat?.name) {
        groupName = rawMsg._data.chat.name;
      }

      // 2. Try client.getChatById
      if ((!groupName || groupName === 'Grup WA' || groupName === 'Grup') && client) {
        try {
          const realChat = await client.getChatById(groupId);
          if (realChat && realChat.name && realChat.name !== 'Grup WA' && realChat.name !== 'Grup') {
            groupName = realChat.name;
          }
        } catch (_) {}
      }

      // 3. Deep search in Puppeteer Store with WidFactory & GroupMetadata
      if ((!groupName || groupName === 'Grup WA' || groupName === 'Grup') && client && client.pupPage) {
        try {
          const fetchedName = await client.pupPage.evaluate(async (gid: string) => {
            try {
              const store = (globalThis as any).window?.Store || (window as any).Store;
              if (!store) return null;

              let wid = null;
              if (store.WidFactory && typeof store.WidFactory.createWid === 'function') {
                try { wid = store.WidFactory.createWid(gid); } catch (_) {}
              }

              // Chat Store
              if (store.Chat) {
                let c = store.Chat.get(gid) || (wid ? store.Chat.get(wid) : null);
                if (!c && typeof store.Chat.find === 'function') {
                  try { c = await store.Chat.find(wid || gid); } catch (_) {}
                }
                if (c) {
                  const n = c.name || c.formattedTitle || (c.groupMetadata ? c.groupMetadata.subject : null);
                  if (n && n !== 'Grup WA' && n !== 'Grup') return n;
                }
              }

              // GroupMetadata Store
              if (store.GroupMetadata) {
                let gMeta = store.GroupMetadata.get(gid) || (wid ? store.GroupMetadata.get(wid) : null);
                if (!gMeta && typeof store.GroupMetadata.find === 'function') {
                  try { gMeta = await store.GroupMetadata.find(wid || gid); } catch (_) {}
                }
                if (gMeta && gMeta.subject) return gMeta.subject;
              }
            } catch (_) {}
            return null;
          }, groupId);

          if (fetchedName) groupName = fetchedName;
        } catch (_) {}
      }
    }

    if (!groupName || groupName === 'Grup WA' || groupName === 'Grup') {
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
