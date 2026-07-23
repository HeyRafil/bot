import dotenv from 'dotenv';
import logger from '../utils/logger.js';
import { executeCommand } from '../commands/index.js';
import { queryRAG } from '../services/aiService.js';
import localDb from '../database/localDb.js';
import { getSetting } from '../config/settings.js';

dotenv.config();

// Cooldown storage: chatOrUser -> timestamp
const cooldowns = new Map();

/**
 * Checks if sender is the bot owner
 */
export async function isOwner(msg) {
  const ownerConfig = await getSetting('OWNER_NUMBER');
  const senderId = msg.author || msg.from;
  const rawId = senderId.replace(/[^0-9]/g, '');
  let cleanId = rawId;

  // Handle WhatsApp new LID (Linked Identity) JIDs which start with 255
  if (senderId.endsWith('@lid') || cleanId.startsWith('255')) {
    try {
      const contact = await msg.getContact();
      if (contact && contact.number) {
        cleanId = contact.number.replace(/[^0-9]/g, '');
        logger.debug(`Resolved LID sender to phone number: ${cleanId}`);
      }
    } catch (e) {
      logger.error("Failed to resolve contact number for LID", e);
    }
  }

  // Support comma-separated owner list (both phone number and/or LID JID)
  const ownerList = ownerConfig.split(',').map(n => n.trim()).filter(n => n.length > 0);
  const match = ownerList.includes(cleanId) || ownerList.includes(rawId);
  
  logger.info(`[isOwner Check] Raw Sender: "${rawId}" | Resolved ID: "${cleanId}" | Allowed Owners: ${JSON.stringify(ownerList)} | Match: ${match}`);
  return match;
}

/**
 * Checks if sender is a group admin
 */
async function isAdmin(chat, senderId) {
  if (!chat.isGroup) return false;
  if (!chat.participants || !Array.isArray(chat.participants)) {
    return false;
  }
  const participant = chat.participants.find(p => p.id && p.id._serialized === senderId);
  return !!(participant && (participant.isAdmin || participant.isSuperAdmin));
}

/**
 * Entry point for processing all incoming WhatsApp messages
 */
export async function handleMessage(client, msg) {
  // Ignore messages sent by the bot itself to prevent loops
  if (msg.fromMe) return;

  const senderId = msg.author || msg.from;
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

  const chat = await msg.getChat();
  const isPrivate = !chat.isGroup;
  
  // Clean message text
  const bodyText = msg.body ? msg.body.trim() : '';
  if (!bodyText) return;

  logger.info(`[Incoming] Msg from ${senderId} in ${chat.isGroup ? 'Group: ' + (chat.name || 'Group') : 'Private'}: "${bodyText}"`);

  // Group Whitelist restriction
  if (chat.isGroup) {
    const whitelistedGroups = await localDb.getCollection('groups');
    const isWhitelisted = whitelistedGroups.includes(chat.id._serialized);
    const senderIsOwner = await isOwner(msg);
    
    const lowerBody = bodyText.toLowerCase();
    const isAddGroupCommand = lowerBody.startsWith('.addgroup') || lowerBody.startsWith('/addgroup');

    if (isAddGroupCommand && !senderIsOwner) {
      logger.warn(`Owner command '.addgroup' ignored in group "${chat.name}" - Sender "${senderId}" is not recognized as owner. Check OWNER_NUMBER in dashboard.`);
    }

    if (!isWhitelisted && !(isAddGroupCommand && senderIsOwner)) {
      // Ignore messages from non-whitelisted groups
      return;
    }
  }

  // 1. Basic Content Filtering (Anti-Link and Spam Protection in groups)
  const senderIsOwnerCheck = await isOwner(msg);
  const isAntiLinkEnabled = await getSetting('ANTI_LINK_ENABLED') !== false;
  if (chat.isGroup && !senderIsOwnerCheck && isAntiLinkEnabled) {
    const isSenderAdmin = await isAdmin(chat, senderId);
    
    if (!isSenderAdmin) {
      const linkRegex = /(https?:\/\/[^\s]+|www\.[^\s]+|wa\.me\/[0-9]+|t\.me\/[a-zA-Z0-9_]+)/gi;
      if (linkRegex.test(bodyText)) {
        logger.warn(`Anti-Link triggered: Group ${chat.name} | User ${senderId} sent link.`);
        try {
          const botParticipant = chat.groupMetadata && chat.groupMetadata.participants
            ? chat.groupMetadata.participants.find(p => p.id._serialized === client.info.wid._serialized)
            : null;
          const botIsAdmin = botParticipant ? botParticipant.isAdmin : false;

          if (botIsAdmin) {
            await msg.delete(true);
            await chat.sendMessage(`⚠️ @${senderId.split('@')[0]} Dilarang mengirimkan link di grup ini! (Pesan dihapus otomatis)`, {
              mentions: [senderId]
            });
          } else {
            await msg.reply(`⚠️ Dilarang mengirimkan link di grup ini! (Mohon admin hapus pesan ini)`);
          }
        } catch (e) {
          logger.error("Failed to delete link message", e);
        }
        return; // stop processing
      }
    }
  }

  // 2. Cooldown check (Rate Limiting per chat/user)
  const identifier = chat.id._serialized;
  const now = Date.now();
  const lastActive = cooldowns.get(identifier) || 0;
  const cooldownMs = await getSetting('COOLDOWN_MS');
  const isOwnerStatus = await isOwner(msg);
  
  if (now - lastActive < cooldownMs && !isOwnerStatus) {
    // User is spamming
    logger.debug(`Cooldown triggered for chat: ${identifier}`);
    return; // Silently ignore requests inside cooldown window
  }
  cooldowns.set(identifier, now);

  // 3. Command Router (starts with '.' or '/')
  if (bodyText.startsWith('.') || bodyText.startsWith('/')) {
    const parts = bodyText.slice(1).split(/\s+/);
    const commandName = parts[0].toLowerCase();
    const args = parts.slice(1);

    logger.info(`Command triggered: .${commandName} [args: ${args.join(', ')}] in ${chat.name || 'Private Chat'}`);
    
    const senderIsOwner = await isOwner(msg);
    const senderIsAdmin = chat.isGroup ? await isAdmin(chat, senderId) : false;

    try {
      await executeCommand(client, msg, chat, commandName, args, { isOwner: senderIsOwner, isAdmin: senderIsAdmin });
    } catch (err) {
      logger.error(`Error executing command .${commandName}`, err);
      await msg.reply("Maaf, terjadi kesalahan saat mengeksekusi perintah tersebut.");
    }
    return;
  }

  // 4. Natural Language / AI Assistant Queries
  // Trigger AI if:
  // - Private chat (always responds)
  // - Mentioned in a group chat (e.g. '@bot')
  const myMention = `@${client.info.wid.user}`;
  const isMentioned = bodyText.includes(myMention);

  if (isPrivate || isMentioned) {
    let cleanQuery = bodyText;
    if (isMentioned) {
      // Remove bot mention from query text
      cleanQuery = bodyText.replace(new RegExp(myMention, 'g'), '').trim();
    }

    if (cleanQuery.length < 3) {
      if (isPrivate) {
        await msg.reply("Hai! Saya adalah Asisten Akademik UT. Silakan ketik pertanyaan Anda (misal: Kapan pendaftaran ditutup?) atau ketik *.menu* untuk panduan lengkap.");
      }
      return;
    }

    logger.info(`AI Inquiry from ${senderId} in ${chat.name || 'Private'}: "${cleanQuery}"`);
    
    // Send indicator that bot is typing (whatsapp UI feature)
    try {
      if (chat && typeof chat.sendStateTyping === 'function') {
        try { await chat.sendStateTyping(); } catch (_) {}
      }
      const reply = await queryRAG(cleanQuery);
      await msg.reply(reply);
    } catch (err) {
      logger.error("Error processing AI response", err);
      await msg.reply("Maaf, sistem AI sedang sibuk. Silakan ketik pertanyaan Anda beberapa saat lagi.");
    } finally {
      // Clear typing indicator
      if (chat && typeof chat.clearState === 'function') {
        try { await chat.clearState(); } catch (_) {}
      }
    }
  }
}
