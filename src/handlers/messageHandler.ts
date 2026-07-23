import dotenv from 'dotenv';
import logger from '../utils/logger.js';
import { executeCommand } from '../commands/index.js';
import { queryRAG } from '../services/aiService.js';
import prisma from '../database/prisma.js';
import { getSetting } from '../config/settings.js';
import { getSenderPrivileges, RoleLevel } from '../utils/rbac.js';
import { logToDashboard } from '../services/whatsappClient.js';
import { Message, Chat } from 'whatsapp-web.js';
import { handleQuizAnswer } from '../commands/quiz.js';
import { getSafeChat, getSerializedId } from '../utils/chatHelper.js';

declare let window: any;

dotenv.config();

// Cooldown storage: chatOrUser -> timestamp
const cooldowns = new Map<string, number>();

// Basic Bad Word List for Indonesian Anti-Toxic/Bad-Word filter
const TOXIC_WORDS = ['anjing', 'bangsat', 'babi', 'kontol', 'memek', 'jembut', 'goblok', 'tolol', 'pantek', 'asu'];

/**
 * Main entry point for processing all incoming WhatsApp messages
 */
export async function handleMessage(client: any, msg: Message) {
  // Populate missing _serialized property on msg.id and msg.quotedMsgId due to minified JID
  const rawMsg = msg as any;
  if (rawMsg.id && !rawMsg.id._serialized) {
    rawMsg.id._serialized = rawMsg.id.$1 || getSerializedId(rawMsg.id);
  }
  const quotedMsgId = rawMsg.quotedMsgId || rawMsg._data?.quotedMsg?.id;
  if (quotedMsgId) {
    if (!quotedMsgId._serialized) {
      quotedMsgId._serialized = quotedMsgId.$1 || getSerializedId(quotedMsgId);
    }
    rawMsg.quotedMsgId = quotedMsgId;
  }

  // Ignore messages sent by the bot itself to prevent loops
  if (msg.fromMe) return;

  const senderId = msg.author || msg.from;
  
  // 0. Global Blacklist Check
  try {
    const isBlacklisted = await prisma.blacklist.findUnique({
      where: { whatsappId: senderId }
    });
    if (isBlacklisted) return; // Silent ignore
  } catch (_) {}
  
  // Ignore status, broadcast lists, and newsletter updates to prevent AI loops and API spam
  if (
    senderId.endsWith('@newsletter') || 
    senderId.endsWith('@status') || 
    senderId.endsWith('@broadcast') ||
    msg.from.endsWith('@newsletter') || 
    msg.from.endsWith('@status') || 
    msg.from.endsWith('@broadcast')
  ) {
    return;
  }

  const chat = await getSafeChat(msg, client);
  const isPrivate = !chat.isGroup;
  const groupId = chat.isGroup ? chat.id._serialized : undefined;

  // Clean message text
  const bodyText = msg.body ? msg.body.trim() : '';
  if (!bodyText) return;

  // Log incoming message to console and database
  logger.info(`[Incoming] Msg from ${senderId} in ${chat.isGroup ? 'Group: ' + (chat.name || 'Group') : 'Private'}: "${bodyText.substring(0, 100)}..."`);
  
  // Realtime Log to Dashboard
  logToDashboard(
    chat.isGroup ? 'Group Chat' : 'Private Chat',
    `Message from ${senderId.split('@')[0]} in ${chat.name || 'Private'}: "${bodyText.substring(0, 50)}${bodyText.length > 50 ? '...' : ''}"`
  );

  // 1. Log message to Prisma Database
  try {
    if (chat.isGroup) {
      const existingGroup = await prisma.group.findUnique({ where: { id: chat.id._serialized } });
      let groupName = chat.name;

      if (!groupName || groupName === 'Grup WA' || groupName === 'Grup') {
        if (existingGroup && existingGroup.name && existingGroup.name !== 'Grup WA' && existingGroup.name !== 'Grup') {
          groupName = existingGroup.name;
        } else if (client && client.pupPage) {
          try {
            const realName = await client.pupPage.evaluate(async (gid: string) => {
              try {
                const store = (window as any).Store;
                if (store && store.Chat) {
                  const c = store.Chat.get(gid);
                  if (c) return c.name || c.formattedTitle || null;
                }
              } catch (_) {}
              return null;
            }, chat.id._serialized);
            if (realName) groupName = realName;
          } catch (_) {}
        }
      }

      await prisma.group.upsert({
        where: { id: chat.id._serialized },
        update: { name: groupName || 'Grup WA' },
        create: {
          id: chat.id._serialized,
          name: groupName || 'Grup WA',
          status: true
        }
      });
    }

    await prisma.message.create({
      data: {
        whatsappId: msg.id.id,
        groupId: chat.isGroup ? chat.id._serialized : null,
        senderId,
        senderName: (msg as any)._data?.notifyName || null,
        body: bodyText,
        mediaType: msg.hasMedia ? msg.type : 'text'
      }
    });

    // Track stats
    await prisma.statistics.upsert({
      where: { key: 'total_messages_today' },
      update: { value: { increment: 1 } as any },
      create: { key: 'total_messages_today', value: '1' }
    });
  } catch (dbErr) {
    // Fail silently in database logging to not block bot execution
  }

  // 2. Fetch User Privileges (RBAC)
  const privileges = await getSenderPrivileges(msg, client, groupId);

  // 2.5. Group Whitelist Check (Ignore unwhitelisted groups unless activating)
  if (chat.isGroup && groupId) {
    const groupRecord = await prisma.group.findUnique({
      where: { id: groupId }
    });

    const defaultPrefix = await getSetting('PREFIX') || '.';
    const isAddGroupCommand = bodyText.startsWith(defaultPrefix) && 
                              bodyText.slice(defaultPrefix.length).trim().split(/\s+/)[0]?.toLowerCase() === 'addgroup';

    const isWhitelisted = groupRecord && groupRecord.status;

    if (!isWhitelisted && !isAddGroupCommand) {
      return; // Ignore completely
    }
  }

  // 2.7. Check if there is an active kuis in this group and if this message is a kuis answer
  if (chat.isGroup && await handleQuizAnswer(msg)) {
    return;
  }

  // 3. Group Security Filters (Skip for Owner / Admins)
  if (chat.isGroup && groupId && privileges.level < RoleLevel.ADMIN) {
    try {
      const groupSettings = await prisma.groupSetting.findUnique({
        where: { groupId }
      });

      if (groupSettings) {
        // --- 3.1. Anti-Link ---
        if (groupSettings.antiLink) {
          const linkRegex = /(https?:\/\/[^\s]+|www\.[^\s]+|wa\.me\/[0-9]+|t\.me\/[a-zA-Z0-9_]+)/gi;
          if (linkRegex.test(bodyText)) {
            logger.warn(`Anti-Link triggered in group "${chat.name}" by user "${senderId}"`);
            logToDashboard('Security', `Anti-Link triggered in group ${chat.name} by ${senderId.split('@')[0]}`);
            try {
              await msg.delete(true);
              return chat.sendMessage(`⚠️ *Anti-Link*: @${senderId.split('@')[0]} dilarang mengirim tautan di grup ini.`, {
                mentions: [senderId]
              });
            } catch (_) {}
          }
        }

        // --- 3.2. Anti-Toxic / Bad-Word ---
        if (groupSettings.antiToxic || groupSettings.antiBadWord) {
          const lowerBody = bodyText.toLowerCase();
          const containsToxic = TOXIC_WORDS.some(word => lowerBody.includes(word));
          if (containsToxic) {
            logger.warn(`Anti-Toxic triggered in group "${chat.name}" by user "${senderId}"`);
            logToDashboard('Security', `Anti-Toxic triggered in group ${chat.name} by ${senderId.split('@')[0]}`);
            try {
              await msg.delete(true);
              return chat.sendMessage(`⚠️ *Anti-Toxic*: @${senderId.split('@')[0]} tolong gunakan bahasa yang sopan.`, {
                mentions: [senderId]
              });
            } catch (_) {}
          }
        }

        // --- 3.3. Anti-Virtex (Detect unusually long text/spam crashes) ---
        if (groupSettings.antiVirtex && (bodyText.length > 8000 || bodyText.split('\n').length > 50)) {
          logger.warn(`Anti-Virtex triggered in group "${chat.name}" by user "${senderId}". Kicking...`);
          logToDashboard('Security', `Anti-Virtex triggered in group ${chat.name} by ${senderId.split('@')[0]}. Kicking...`);
          try {
            await msg.delete(true);
            const groupChat = chat as any;
            await groupChat.removeParticipants([senderId]);
            return chat.sendMessage(`🚫 *Anti-Virtex*: @${senderId.split('@')[0]} dikeluarkan karena terdeteksi mengirim pesan mencurigakan (Virtex).`, {
              mentions: [senderId]
            });
          } catch (_) {}
        }

        // --- 3.4. Anti-Fake-Number (Kick non-Indonesian/foreign numbers) ---
        if (groupSettings.antiFakeNumber) {
          const isIndonesian = senderId.startsWith('62');
          if (!isIndonesian) {
            logger.warn(`Anti-Fake-Number triggered: Kicking foreign number ${senderId} from group "${chat.name}"`);
            logToDashboard('Security', `Anti-Fake-Number triggered: Kicking foreign number ${senderId.split('@')[0]}`);
            try {
              const groupChat = chat as any;
              await groupChat.removeParticipants([senderId]);
              return chat.sendMessage(`🚫 *Anti-Fake-Number*: Nomor asing tidak diizinkan di grup ini.`);
            } catch (_) {}
          }
        }

        // --- 3.5. Anti-Bot (Detect if message sent by external WA bots) ---
        if (groupSettings.antiBot && (msg.id.id.startsWith('3EB0') || msg.id.id.length > 25)) {
          logger.warn(`Anti-Bot triggered: Kicking bot user ${senderId} from group "${chat.name}"`);
          logToDashboard('Security', `Anti-Bot triggered: bot user detected ${senderId.split('@')[0]}`);
          try {
            const groupChat = chat as any;
            await groupChat.removeParticipants([senderId]);
            return chat.sendMessage(`🚫 *Anti-Bot*: Bot tidak diizinkan bergabung.`);
          } catch (_) {}
        }
      }
    } catch (err) {
      logger.error("[messageHandler.ts] Error in group security filters", err);
    }
  }

  // 4. Command Router
  const allowedPrefixes = ['!', '.', '$', '#'];
  const customPrefix = await getSetting('PREFIX') || '.';
  if (!allowedPrefixes.includes(customPrefix)) {
    allowedPrefixes.push(customPrefix);
  }

  const matchedPrefix = allowedPrefixes.find(p => bodyText.startsWith(p));

  if (matchedPrefix) {
    // Check cooldown to prevent flooding/spamming (Skip for Owner)
    if (!privileges.isOwner) {
      const cooldownMs = await getSetting('COOLDOWN_MS') || 3000;
      const lastRun = cooldowns.get(senderId) || 0;
      if (Date.now() - lastRun < cooldownMs) {
        return; // Silent cooldown ignore
      }
      cooldowns.set(senderId, Date.now());
    }

    const commandParts = bodyText.slice(matchedPrefix.length).trim().split(/\s+/);
    const commandName = commandParts.shift();
    const args = commandParts;

    if (commandName) {
      try {
        await executeCommand(client, msg, chat, commandName, args, privileges);
      } catch (err) {
        logger.error(`[messageHandler.ts] Error executing command ${matchedPrefix}${commandName}`, err);
      }
      return;
    }
  }

  // 5. Auto Reply based on Keyword (CRUD Managed from Dashboard)
  try {
    const autoReplies = await prisma.autoReply.findMany({
      where: { status: true }
    });
    
    const lowerBody = bodyText.toLowerCase();
    const matchingReply = autoReplies.find(r => lowerBody.includes(r.keyword.toLowerCase()));
    
    if (matchingReply) {
      logToDashboard('Auto Reply', `Auto-replied to keyword "${matchingReply.keyword}"`);
      return msg.reply(matchingReply.response);
    }
  } catch (err) {
    logger.error("[messageHandler.ts] Failed to query auto-replies", err);
  }

  // 6. Natural Language / AI Assistant Queries
  // Trigger AI if:
  // - Private chat (always responds)
  // - Mentioned in a group chat (e.g. '@bot' or reply to bot message)
  const botJid = client.info.wid.user;
  const botSerialized = client.info.wid._serialized;
  
  // Check if bot is mentioned in mentionedIds array
  const isMentionedInArray = Array.isArray(msg.mentionedIds) && (
    msg.mentionedIds.includes(botSerialized) ||
    msg.mentionedIds.includes(`${botJid}@c.us`) ||
    msg.mentionedIds.includes(`${botJid}@s.whatsapp.net`)
  );

  // Check if body text has the mention string
  const myMentionPattern = `@${botJid}`;
  const isMentionedInText = bodyText.includes(myMentionPattern) || 
                            bodyText.includes(`@${botSerialized.split('@')[0]}`);

  const isMentioned = isMentionedInArray || isMentionedInText;

  if (isPrivate || isMentioned) {
    let cleanQuery = bodyText;
    
    // Clean all possible bot mentions from the query text
    cleanQuery = cleanQuery.replace(new RegExp(myMentionPattern, 'g'), '');
    cleanQuery = cleanQuery.replace(new RegExp(`@${botSerialized.split('@')[0]}`, 'g'), '');
    
    // Also clean standard mentions from the array if they appear in text
    if (Array.isArray(msg.mentionedIds)) {
      for (const mentionJid of msg.mentionedIds) {
        const mentionNum = mentionJid.split('@')[0];
        cleanQuery = cleanQuery.replace(new RegExp(`@${mentionNum}`, 'g'), '');
      }
    }
    
    cleanQuery = cleanQuery.trim();

    if (cleanQuery.length < 3) {
      if (isPrivate) {
        await msg.reply("Hai! Saya adalah Asisten Akademik UT. Silakan ketik pertanyaan Anda (misal: Kapan pendaftaran ditutup?) atau ketik *.menu* untuk panduan lengkap.");
      }
      return;
    }

    // Cooldown check for AI queries to prevent API exhaustion
    if (!privileges.isOwner) {
      const lastRun = cooldowns.get(senderId) || 0;
      if (Date.now() - lastRun < 5000) {
        return msg.reply("⚠️ Mohon tunggu beberapa detik sebelum mengirim pertanyaan berikutnya.");
      }
      cooldowns.set(senderId, Date.now());
    }

    // Check if group has AI enabled
    if (chat.isGroup && groupId) {
      try {
        const groupSettings = await prisma.groupSetting.findUnique({
          where: { groupId }
        });
        if (groupSettings && !groupSettings.aiEnabled) {
          return; // AI is disabled in this group
        }
      } catch (_) {}
    }

    logger.info(`AI Inquiry from ${senderId} in ${chat.name || 'Private'}: "${cleanQuery}"`);
    
    try {
      if (chat && typeof (chat as any).sendStateTyping === 'function') {
        try { await (chat as any).sendStateTyping(); } catch (_) {}
      }
      
      const reply = await queryRAG(cleanQuery);
      await msg.reply(reply);
      
      // Store AI conversation history to DB
      try {
        await prisma.aiHistory.create({
          data: {
            whatsappId: senderId,
            groupId: chat.isGroup ? chat.id._serialized : null,
            prompt: cleanQuery,
            response: reply
          }
        });
      } catch (_) {}
    } catch (err) {
      logger.error("[messageHandler.ts] Error processing AI response", err);
      await msg.reply("Maaf, sistem AI sedang sibuk. Silakan ketik pertanyaan Anda beberapa saat lagi.");
    } finally {
      if (chat && typeof (chat as any).clearState === 'function') {
        try { await (chat as any).clearState(); } catch (_) {}
      }
    }
  }
}
