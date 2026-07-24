import pkg from 'whatsapp-web.js';
import type { Message } from 'whatsapp-web.js';
import logger from './logger.js';

const MessageConstructor = (pkg as any).Message;

export function getSerializedId(idObj: any): string | null {
  if (!idObj) return null;
  if (idObj._serialized) return idObj._serialized;
  if (idObj.$1) return idObj.$1;
  
  const fromMe = idObj.fromMe;
  const remote = typeof idObj.remote === 'object' && idObj.remote ? (idObj.remote._serialized || idObj.remote.toString()) : idObj.remote;
  const id = idObj.id;
  const participant = idObj.participant ? (typeof idObj.participant === 'object' && idObj.participant ? (idObj.participant._serialized || idObj.participant.toString()) : idObj.participant) : '';
  
  return `${fromMe}_${remote}_${id}${participant ? '_' + participant : ''}`;
}

declare let window: any;

const lastWarningTime = new Map<string, number>();
const WARNING_COOLDOWN_MS = 300000; // 5 minutes cooldown per context to keep logs clean

/**
 * Safely fetches the Chat object for a message. If it fails due to internal library 
 * or Puppeteer synchronization issues, it constructs a robust fallback chat object 
 * that proxies key WhatsApp operations directly via client.pupPage evaluation.
 */
export async function getSafeChat(msg: Message, client: any, context: string = 'messageHandler'): Promise<any> {
  try {
    const chat = await msg.getChat();
    return chat;
  } catch (err: any) {
    const now = Date.now();
    const lastTime = lastWarningTime.get(context) || 0;
    if (now - lastTime > WARNING_COOLDOWN_MS) {
      logger.warn(`Failed to get chat via msg.getChat() in ${context}, using fallback: ${err.message}`);
      lastWarningTime.set(context, now);
    }
    const isGroup = msg.from.endsWith('@g.us');
    
    const fallbackChat: any = {
      id: { _serialized: msg.from },
      isGroup,
      name: isGroup ? 'Grup WA' : ((msg as any)._data?.notifyName || 'User'),
      sendMessage: async (text: string, options?: any) => {
        const sent = await client.sendMessage(msg.from, text, options);
        if (sent) return sent;
        
        // Fallback: if client.sendMessage returns undefined/null (due to serialization issues), fetch it from the store
        try {
          if (client.pupPage) {
            await new Promise(resolve => setTimeout(resolve, 200));
            const rawMsg = await client.pupPage.evaluate(async (chatId: string) => {
              const collections = (window as any).require('WAWebCollections');
              if (collections && collections.Msg) {
                const msgs = collections.Msg.toArray();
                const myMsgs = msgs.filter((m: any) => {
                  if (!m.id) return false;
                  const remote = m.id.remote;
                  const remoteStr = typeof remote === 'string' ? remote : (remote && (remote._serialized || remote.toString()));
                  return remoteStr === chatId && m.id.fromMe === true;
                });
                if (myMsgs.length > 0) {
                  // Sort by timestamp to get the absolute last message sent by me
                  myMsgs.sort((a: any, b: any) => (a.t || 0) - (b.t || 0));
                  return myMsgs[myMsgs.length - 1].serialize();
                }
              }
              return null;
            }, msg.from);
            
            if (rawMsg) {
              const msgObj = new MessageConstructor(client, rawMsg);
              if (msgObj.id && !msgObj.id._serialized) {
                msgObj.id._serialized = msgObj.id.$1 || getSerializedId(msgObj.id);
              }
              return msgObj;
            }
          }
        } catch (_) {}
        return null;
      },
      fetchMessages: async (options?: any) => {
        try {
          if (client.pupPage) {
            const limit = options?.limit || 50;
            const rawMsgs = await client.pupPage.evaluate(async (chatId: string, limit: number) => {
              const collections = (window as any).require('WAWebCollections');
              if (collections && collections.Msg) {
                const msgs = collections.Msg.toArray().filter((m: any) => {
                  if (!m.id) return false;
                  const remote = m.id.remote;
                  const remoteStr = typeof remote === 'string' ? remote : (remote && (remote._serialized || remote.toString()));
                  return remoteStr === chatId;
                });
                // Sort by timestamp
                msgs.sort((a: any, b: any) => (a.t || 0) - (b.t || 0));
                return msgs.slice(-limit).map((m: any) => m.serialize());
              }
              return [];
            }, msg.from, limit);
            
            return rawMsgs.map((m: any) => {
              const msgObj = new MessageConstructor(client, m);
              if (msgObj.id && !msgObj.id._serialized) {
                msgObj.id._serialized = msgObj.id.$1 || getSerializedId(msgObj.id);
              }
              return msgObj;
            });
          }
        } catch (err: any) {
          logger.error(`Fallback fetchMessages failed: ${err.message}`);
        }
        return [];
      },
      sendStateTyping: async () => {
        try {
          if (client.pupPage) {
            await client.pupPage.evaluate(async (chatId: string) => {
              const collections = (window as any).require('WAWebCollections');
              const chat = collections && collections.Chat ? collections.Chat.get(chatId) : null;
              if (chat) await chat.sendStateTyping();
            }, msg.from);
          }
        } catch (_) {}
      },
      clearState: async () => {
        try {
          if (client.pupPage) {
            await client.pupPage.evaluate(async (chatId: string) => {
              const collections = (window as any).require('WAWebCollections');
              const chat = collections && collections.Chat ? collections.Chat.get(chatId) : null;
              if (chat) await chat.clearState();
            }, msg.from);
          }
        } catch (_) {}
      },
      removeParticipants: async (participants: string[]) => {
        try {
          if (client.pupPage) {
            await client.pupPage.evaluate(async (chatId: string, participants: string[]) => {
              const collections = (window as any).require('WAWebCollections');
              const chat = collections && collections.Chat ? collections.Chat.get(chatId) : null;
              if (chat && chat.groupMetadata) {
                await chat.groupMetadata.removeParticipants(participants);
              }
            }, msg.from, participants);
          }
        } catch (err: any) {
          logger.error(`Fallback removeParticipants failed: ${err.message}`);
          throw err;
        }
      }
    };

    // Attempt to fetch group metadata (participants) using puppeteer page directly
    if (isGroup && client.pupPage) {
      try {
        const groupData = await client.pupPage.evaluate(async (chatId: string) => {
          const collections = (window as any).require('WAWebCollections');
          const chat = collections && collections.Chat ? collections.Chat.get(chatId) : null;
          if (chat && chat.groupMetadata) {
            return {
              name: chat.name || chat.formattedTitle,
              participants: chat.groupMetadata.participants.map((p: any) => ({
                id: p.id,
                isAdmin: p.isAdmin,
                isSuperAdmin: p.isSuperAdmin
              }))
            };
          }
          return null;
        }, msg.from);
        
        if (groupData) {
          if (groupData.name) {
            fallbackChat.name = groupData.name;
          }
          if (groupData.participants) {
            fallbackChat.participants = groupData.participants;
          }
        }
      } catch (_) {}
    }

    return fallbackChat;
  }
}
