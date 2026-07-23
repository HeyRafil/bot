import pkg from 'whatsapp-web.js';
import logger from './logger.js';
import { getSerializedId } from './chatHelper.js';

const { Message, Client, PrivateChat, GroupChat, Channel } = pkg as any;


declare let window: any;

if (Message && Message.prototype) {
  logger.info('[whatsappPatches] Applying global monkey patches to whatsapp-web.js Message prototype...');
  
  // 1. Patch getQuotedMessage
  const originalGetQuotedMessage = Message.prototype.getQuotedMessage;
  Message.prototype.getQuotedMessage = async function(this: any) {
    try {
      const quotedMsg = await originalGetQuotedMessage.apply(this);
      if (quotedMsg) {
        if (quotedMsg.id && !quotedMsg.id._serialized) {
          quotedMsg.id._serialized = quotedMsg.id.$1 || getSerializedId(quotedMsg.id);
        }
        return quotedMsg;
      }
    } catch (err: any) {
      logger.warn(`[whatsappPatches] getQuotedMessage failed, trying fallback: ${err.message}`);
    }

    const rawMsg = this as any;
    const targetId = rawMsg.quotedMsgId?._serialized || rawMsg.quotedMsgId?.$1 || getSerializedId(rawMsg.quotedMsgId) || rawMsg._data?.quotedMsg?.id?._serialized || getSerializedId(rawMsg._data?.quotedMsg?.id);
    
    if (targetId && this.client && this.client.pupPage) {
      try {
        const rawMsgData = await this.client.pupPage.evaluate(async (msgId: string) => {
          try {
            const collections = (window as any).require('WAWebCollections');
            if (collections && collections.Msg) {
              const m = collections.Msg.get(msgId);
              return m ? m.serialize() : null;
            }
          } catch (_) {}
          try {
            const store = (window as any).Store;
            if (store && store.Msg) {
              const m = store.Msg.get(msgId);
              return m ? m.serialize() : null;
            }
          } catch (_) {}
          return null;
        }, targetId);

        if (rawMsgData) {
          const quotedMsg = new Message(this.client, rawMsgData);
          if (quotedMsg.id && !quotedMsg.id._serialized) {
            quotedMsg.id._serialized = quotedMsg.id.$1 || getSerializedId(quotedMsg.id);
          }
          return quotedMsg;
        }
      } catch (err: any) {
        logger.warn(`[whatsappPatches] Fallback 1 message lookup failed: ${err.message}`);
      }
    }

    if (rawMsg._data?.quotedMsg) {
      logger.info(`[whatsappPatches] Fallback 2: Reconstructing quoted message from raw message _data.quotedMsg`);
      const quotedMsg = new Message(this.client, rawMsg._data.quotedMsg);
      if (quotedMsg.id && !quotedMsg.id._serialized) {
        quotedMsg.id._serialized = quotedMsg.id.$1 || getSerializedId(quotedMsg.id);
      }
      return quotedMsg;
    }

    return undefined;
  };

  // 2. Patch downloadMedia
  const originalDownloadMedia = Message.prototype.downloadMedia;
  Message.prototype.downloadMedia = async function(this: any) {
    try {
      const media = await originalDownloadMedia.apply(this);
      if (media && media.data) {
        return media;
      }
    } catch (err: any) {
      logger.warn(`[whatsappPatches] downloadMedia failed, trying decrypted fallback: ${err.message}`);
    }

    if (this.hasMedia && this.client && this.client.pupPage) {
      const rawData = this._data || {};
      const mediaOpts = {
        directPath: rawData.directPath || this.directPath,
        encFilehash: rawData.encFilehash || this.encFilehash,
        filehash: rawData.filehash || this.filehash,
        mediaKey: rawData.mediaKey || this.mediaKey,
        mediaKeyTimestamp: rawData.mediaKeyTimestamp || this.mediaKeyTimestamp,
        type: rawData.type || this.type,
        mimetype: rawData.mimetype || this.mimetype,
        filename: rawData.filename || this.filename
      };

      if (!mediaOpts.directPath || !mediaOpts.filehash || !mediaOpts.mediaKey) {
        logger.warn('[whatsappPatches] Fallback decryption missing crucial details:', {
          hasDirectPath: !!mediaOpts.directPath,
          hasFilehash: !!mediaOpts.filehash,
          hasMediaKey: !!mediaOpts.mediaKey
        });
        return undefined;
      }

      try {
        const result = await this.client.pupPage.evaluate(async (opts: any) => {
          try {
            const mockQpl = {
              addAnnotations: function () { return this; },
              addPoint: function () { return this; },
            };

            const downloadManagerModule = window.require('WAWebDownloadManager');
            const downloadManager = downloadManagerModule?.downloadManager || downloadManagerModule;
            
            if (!downloadManager || typeof downloadManager.downloadAndMaybeDecrypt !== 'function') {
              throw new Error('WAWebDownloadManager not found or invalid');
            }

            const decryptedMedia = await downloadManager.downloadAndMaybeDecrypt({
              directPath: opts.directPath,
              encFilehash: opts.encFilehash,
              filehash: opts.filehash,
              mediaKey: opts.mediaKey,
              mediaKeyTimestamp: opts.mediaKeyTimestamp,
              type: opts.type,
              signal: new AbortController().signal,
              downloadQpl: mockQpl,
            });

            const data = window.WWebJS.arrayBufferToBase64(decryptedMedia);
            return {
              mimetype: opts.mimetype,
              data: data,
              filename: opts.filename,
            };
          } catch (err: any) {
            throw new Error(err.message || err.toString() || 'Decryption failed');
          }
        }, mediaOpts);

        return result;
      } catch (err: any) {
        logger.error(`[whatsappPatches] Fallback downloadMedia decryption failed:`, err);
      }
    }

    return undefined;
  };
} else {
  logger.error('[whatsappPatches] Message prototype not found! Monkey patching failed.');
}

// 3. Patch getChatById & getContactById to prevent "Failed to get chat/contact" warnings & errors on uncached or @lid JIDs
if (Client && Client.prototype) {
  logger.info('[whatsappPatches] Applying global monkey patch to whatsapp-web.js Client.prototype.getChatById & getContactById...');
  
  const originalGetChatById = Client.prototype.getChatById;
  Client.prototype.getChatById = async function(this: any, chatId: any) {
    const targetJid = typeof chatId === 'object' && chatId ? (chatId._serialized || chatId.toString()) : String(chatId || '');
    if (!targetJid) return null;
    
    try {
      return await originalGetChatById.call(this, targetJid);
    } catch (err: any) {
      // Silently attempt in-browser store lookup before resorting to fallback
      if (this.pupPage) {
        try {
          const chatData = await this.pupPage.evaluate(async (jid: string) => {
            try {
              const store = (window as any).Store;
              if (store) {
                let chatInstance = store.Chat ? store.Chat.get(jid) : null;
                if (!chatInstance && store.Chat && typeof store.Chat.find === 'function') {
                  try {
                    chatInstance = await store.Chat.find(jid);
                  } catch (_) {}
                }
                if (!chatInstance && store.Chat && typeof store.Chat.find === 'function') {
                  try {
                    chatInstance = await store.Chat.find({ id: jid });
                  } catch (_) {}
                }
                // Try LID lookup if target is @lid
                if (!chatInstance && store.LidUtils && jid.endsWith('@lid')) {
                  try {
                    const pnJid = typeof store.LidUtils.getCurrentLid === 'function' ? store.LidUtils.getCurrentLid(jid) : null;
                    if (pnJid && store.Chat) chatInstance = store.Chat.get(pnJid);
                  } catch (_) {}
                }
                if (chatInstance && (window as any).WWebJS) {
                  return (window as any).WWebJS.getChatModel(chatInstance);
                }
              }
            } catch (_) {}
            return null;
          }, targetJid);

          if (chatData) {
            if (chatData.isGroup) {
              return new GroupChat(this, chatData);
            }
            if (chatData.isChannel) {
              return new Channel(this, chatData);
            }
            return new PrivateChat(this, chatData);
          }
        } catch (_) {}
      }

      // Construct a clean, working fallback Chat object instead of throwing
      const isGroup = targetJid.endsWith('@g.us');
      const fallbackData = {
        id: { _serialized: targetJid },
        name: isGroup ? 'Grup WA' : targetJid.split('@')[0],
        isGroup,
        isReadOnly: false,
        unreadCount: 0,
        timestamp: Math.floor(Date.now() / 1000)
      };

      if (isGroup) {
        return new GroupChat(this, fallbackData);
      }
      return new PrivateChat(this, fallbackData);
    }
  };

  const originalGetContactById = Client.prototype.getContactById;
  Client.prototype.getContactById = async function(this: any, contactId: any) {
    const targetJid = typeof contactId === 'object' && contactId ? (contactId._serialized || contactId.toString()) : String(contactId || '');
    if (!targetJid) return null;

    try {
      if (originalGetContactById) {
        return await originalGetContactById.call(this, targetJid);
      }
    } catch (_) {}

    // Fallback for @lid or uncached contacts
    const cleanNumber = targetJid.split('@')[0];
    return {
      id: { _serialized: targetJid },
      number: cleanNumber,
      name: cleanNumber,
      pushname: cleanNumber,
      isUser: true,
      isGroup: false,
      isWAContact: true,
      getProfilePicUrl: async () => null
    };
  };
}


