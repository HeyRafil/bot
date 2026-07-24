import pkg from 'whatsapp-web.js';
const { Client, LocalAuth, MessageMedia } = pkg;
// @ts-ignore
import qrcodeTerminal from 'qrcode-terminal';
// @ts-ignore
import QRCode from 'qrcode';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import logger from '../utils/logger.js';
import { handleMessage } from '../handlers/messageHandler.js';
import prisma from '../database/prisma.js';
import pluginManager from '../utils/pluginManager.js';
import { activePollMenus } from '../utils/pollStore.js';
import { getSerializedId } from '../utils/chatHelper.js';

const activeWelcomeSessions = new Map<string, { cancel: boolean }>();

declare let window: any;

/**
 * Safely edits a sent message by resolving it and running Puppeteer evaluations
 */
async function safeEditMessage(client: any, message: any, newText: string, mentions: string[] = []): Promise<boolean> {
  const msgId = message?.id?._serialized || message?.id?.$1 || getSerializedId(message?.id);
  if (!msgId) {
    logger.warn(`[whatsappClient.ts] safeEditMessage: invalid message object passed.`);
    return false;
  }
  try {
    if (!client.pupPage) {
      logger.warn(`[whatsappClient.ts] safeEditMessage failed: client.pupPage is undefined`);
      return false;
    }
    
    const evaluatePromise = client.pupPage.evaluate(async (targetId: string, text: string, mentionJids: string[]) => {
      const report = { success: false, step: 'start', details: '', error: '' };
      try {
        let store = (window as any).Store;
        if (!store) {
          try { store = (window as any).require('WAWebCollections'); } catch (_) {}
        }
        if (!store) {
          report.error = 'Both window.Store and WAWebCollections are undefined';
          return report;
        }
        
        let msg = null;
        if (store.Msg) {
          msg = store.Msg.get(targetId);
          if (msg) report.details += 'Found in Store.Msg. ';
        }
        
        if (!msg) {
          try {
            const collections = (window as any).require('WAWebCollections');
            if (collections && collections.Msg) {
              msg = collections.Msg.get(targetId);
              if (msg) report.details += 'Found in WAWebCollections.Msg. ';
            }
          } catch (e: any) {
            report.details += `WAWebCollections failed: ${e.message}. `;
          }
        }
        
        if (!msg) {
          report.details += 'Msg not found, starting retry loop. ';
          for (let i = 0; i < 10; i++) {
            await new Promise(resolve => setTimeout(resolve, 100));
            if (store.Msg) {
              msg = store.Msg.get(targetId);
            }
            if (!msg) {
              try {
                const collections = (window as any).require('WAWebCollections');
                if (collections && collections.Msg) {
                  msg = collections.Msg.get(targetId);
                }
              } catch (_) {}
            }
            if (msg) {
              report.details += `Found in retry loop at step ${i}. `;
              break;
            }
          }
        }
        
        if (!msg) {
          try {
            const collections = (window as any).require('WAWebCollections');
            if (collections && collections.Msg) {
              const res = await collections.Msg.getMessagesById([targetId]);
              msg = res && res.messages ? res.messages[0] : null;
              if (msg) report.details += 'Found via getMessagesById. ';
            }
          } catch (e: any) {
            report.details += `getMessagesById failed: ${e.message}. `;
          }
        }
        
        if (!msg) {
          report.error = 'Msg not found';
          report.step = 'not_found';
          return report;
        }
        
        report.step = 'found';
        
        if (typeof msg.edit === 'function') {
          await msg.edit(text);
          report.success = true;
          report.details += 'Edited via msg.edit().';
          return report;
        }
        
        if (store.EditMessage) {
          try {
            if (typeof store.EditMessage.sendMessageEdit === 'function') {
              await store.EditMessage.sendMessageEdit(msg, text);
              report.success = true;
              report.details += 'Edited via Store.EditMessage.sendMessageEdit.';
              return report;
            } else if (typeof store.EditMessage.editMessage === 'function') {
              await store.EditMessage.editMessage(msg, text);
              report.success = true;
              report.details += 'Edited via Store.EditMessage.editMessage.';
              return report;
            }
          } catch (e: any) {
            report.details += `Store.EditMessage failed: ${e.message}. `;
          }
        }
        
        for (const key in store) {
          if (store[key]) {
            try {
              if (typeof store[key].sendMessageEdit === 'function') {
                await store[key].sendMessageEdit(msg, text);
                report.success = true;
                report.details += `Edited via store[${key}].sendMessageEdit.`;
                return report;
              } else if (typeof store[key].editMessage === 'function') {
                await store[key].editMessage(msg, text);
                report.success = true;
                report.details += `Edited via store[${key}].editMessage.`;
                return report;
              }
            } catch (_) {}
          }
        }
        
        report.error = 'No edit message function succeeded';
      } catch (e: any) {
        report.error = `Outer evaluate error: ${e.message}`;
      }
      return report;
    }, msgId, newText, mentions);
    
    const timeoutPromise = new Promise<any>((_, reject) => 
      setTimeout(() => reject(new Error('Puppeteer evaluation timeout')), 5000)
    );
    
    const diag: any = await Promise.race([evaluatePromise, timeoutPromise]);
    logger.info(`[whatsappClient.ts] safeEditMessage result for ${msgId}: success = ${diag.success}, step = ${diag.step}, error = ${diag.error}`);
    return diag.success;
  } catch (err: any) {
    logger.error(`[whatsappClient.ts] safeEditMessage outer catch failed for ${msgId}: ${err.message}`);
  }
  return false;
}

dotenv.config();

const SESSION_DIR = path.resolve(process.env.SESSION_PATH || './session');

export interface BotState {
  connected: boolean;
  qr: string | null;
  botUser: string | null;
}

export const botState: BotState = {
  connected: false,
  qr: null,
  botUser: null
};

let client: any = null;
let io: any = null; // Socket.IO server reference

/**
 * Sets the Socket.IO server instance for real-time broadcasts
 */
export function setSocketServer(socketServer: any) {
  io = socketServer;
}

/**
 * Helper to emit real-time status updates via Socket.IO
 */
function emitStatusUpdate() {
  if (io) {
    io.emit('bot_status', {
      connected: botState.connected,
      botUser: botState.botUser,
      qr: botState.qr
    });
  }
}

/**
 * Helper to emit a real-time event log to the dashboard
 */
export function logToDashboard(category: string, message: string, details?: any) {
  if (io) {
    io.emit('realtime_log', {
      timestamp: new Date().toISOString(),
      category,
      message,
      details
    });
  }
}

/**
 * Helper to notify the dashboard that groups/whitelist has been updated
 */
export function notifyGroupsUpdated() {
  if (io) {
    io.emit('groups_updated');
  }
}


/**
 * Initializes and launches the WhatsApp Web Client
 */
export function initWhatsAppClient() {
  logger.info("Initializing WhatsApp Web Client...");
  logToDashboard('System', 'Initializing WhatsApp Web Client...');

  // Ensure session directory exists
  if (!fs.existsSync(SESSION_DIR)) {
    fs.mkdirSync(SESSION_DIR, { recursive: true });
  }

  // Cleanup leftover Chrome lock files if previous process crashed or died abruptly
  try {
    const lockFiles = [
      path.join(SESSION_DIR, 'session', 'SingletonLock'),
      path.join(SESSION_DIR, 'session', 'SingletonSocket'),
      path.join(SESSION_DIR, 'session', 'SingletonCookie')
    ];
    for (const file of lockFiles) {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
        logger.info(`Cleaned up leftover Chrome lock file: ${file}`);
      }
    }
  } catch (_) {}

  let execPath = process.env.PUPPETEER_EXECUTABLE_PATH;
  
  if (!execPath && process.platform === 'linux') {
    if (fs.existsSync('/usr/bin/google-chrome')) {
      execPath = '/usr/bin/google-chrome';
      logger.info(`Auto-detected Google Chrome on Linux: ${execPath}`);
    } else if (fs.existsSync('/usr/bin/chromium-browser')) {
      execPath = '/usr/bin/chromium-browser';
      logger.info(`Auto-detected Chromium on Linux: ${execPath}`);
    } else if (fs.existsSync('/usr/bin/chromium')) {
      execPath = '/usr/bin/chromium';
      logger.info(`Auto-detected Chromium on Linux: ${execPath}`);
    }
  }

  const isHeadless = process.env.PUPPETEER_HEADLESS === 'true' || process.env.PUPPETEER_HEADLESS === undefined;

  const authStrategy = new LocalAuth({
    dataPath: SESSION_DIR
  });

  // Monkey-patch logout to prevent EBUSY crash on Windows during logout/disconnect
  authStrategy.logout = async function(this: any) {
    if (this.userDataDir) {
      try {
        await fs.promises.rm(this.userDataDir, { recursive: true, force: true }).catch(() => {});
      } catch (_) {}
    }
  };

  client = new Client({
    authStrategy,
    puppeteer: {
      headless: isHeadless,
      executablePath: execPath || undefined,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-client-side-phishing-detection',
        '--disable-default-apps',
        '--disable-popup-blocking',
        '--disable-extensions',
        '--single-process',
        '--disable-features=Translate,TranslateUI,IsolateOrigins,site-per-process',
        '--disable-site-isolation-trials',
        '--js-flags=--max-old-space-size=1024',
        '--disable-ipc-flooding-protection',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding'
      ]
    }
  });

  // Event: QR Code generated
  client.on('qr', async (qrCodeText: string) => {
    logger.info("WhatsApp QR Code received. Rendering...");
    qrcodeTerminal.generate(qrCodeText, { small: true });

    try {
      botState.qr = await QRCode.toDataURL(qrCodeText);
      botState.connected = false;
      emitStatusUpdate();
      logToDashboard('Login', 'QR Code generated and ready to scan.');
    } catch (err) {
      logger.error("Failed to generate QR DataURL", err);
    }
  });

  // Event: Authentication Successful
  client.on('authenticated', () => {
    logger.info("WhatsApp authentication successful!");
    logToDashboard('Login', 'WhatsApp authentication successful!');
  });

  // Event: Authentication Failure
  client.on('auth_failure', (msg: string) => {
    logger.error("WhatsApp authentication failed", msg);
    botState.connected = false;
    botState.qr = null;
    emitStatusUpdate();
    logToDashboard('Error', `WhatsApp authentication failed: ${msg}`);
  });

  // Event: Ready to use
  client.on('ready', async () => {
    botState.connected = true;
    botState.qr = null;
    botState.botUser = `${client.info.pushname} (${client.info.wid.user})`;
    
    logger.info(`=================================================`);
    logger.info(`   WhatsApp Bot is READY and connected as:        `);
    logger.info(`   ${botState.botUser}`);
    logger.info(`=================================================`);
    
    emitStatusUpdate();
    logToDashboard('Login', `WhatsApp Bot is READY as ${botState.botUser}`);

    // Background loop to poll active poll menu votes (workaround for unstable vote_update event)
    let checkCount = 0;
    setInterval(async () => {
      checkCount++;
      if (checkCount % 4 === 0) {
        logger.info(`[PollMenuCheck] Heartbeat: ${activePollMenus.length} active menu polls in memory.`);
      }
      if (activePollMenus.length === 0) return;
      
      const now = Date.now();
      // Remove polls older than 10 minutes (600,000 ms)
      const expiredIndex = activePollMenus.findIndex(p => now - p.createdAt > 600000);
      if (expiredIndex !== -1) {
        activePollMenus.splice(expiredIndex, 1);
      }

      for (const menu of activePollMenus) {
        try {
          if (!client.pupPage) continue;

          // Open chat window in background to force the browser to load and sync new poll votes
          try {
            if (client.interface && typeof client.interface.openChatWindow === 'function') {
              await client.interface.openChatWindow(menu.chatId);
            }
          } catch (_) {}

          // Clean the message ID to ensure it matches the clean format without participant JID for fromMe messages
          const parts = menu.messageId.split('_');
          const cleanMessageId = parts.slice(0, 3).join('_');

          // Debug: print current keys in WAWebPollsVotesSchema to confirm key matching format
          try {
            const pollVoteData = await client.pupPage.evaluate(async (serializedId: string, cleanId: string) => {
              try {
                const collections = (window as any).require('WAWebCollections');
                if (!collections || !collections.Msg) return { error: "No Msg collection found" };
                
                let msg = collections.Msg.get(serializedId);
                if (!msg) {
                  msg = collections.Msg.get(cleanId);
                }
                if (!msg) return { error: "Message not found" };
                
                return {
                  hasSnapshot: !!msg.pollVotesSnapshot,
                  snapshotType: typeof msg.pollVotesSnapshot,
                  snapshotKeys: msg.pollVotesSnapshot ? Object.keys(msg.pollVotesSnapshot) : null,
                  snapshotValue: msg.pollVotesSnapshot ? msg.pollVotesSnapshot : null,
                  rawSnapshot: msg.pollVotesSnapshot ? JSON.stringify(msg.pollVotesSnapshot) : null
                };
              } catch (err: any) {
                return { error: err.message || err.toString() };
              }
            }, menu.messageId, cleanMessageId);
            logger.info(`[PollMenuCheck] Debug PollVotesSnapshot: ${JSON.stringify(pollVoteData)}`);
          } catch (err: any) {
            logger.error(`[PollMenuCheck] Debug PollVotesSnapshot error: ${err.message}`);
          }

          // Directly query poll votes from Puppeteer browser database to avoid MsgKey serialization bugs in library
          const votes = await client.pupPage.evaluate(async (serializedId: string) => {
            try {
              const msgKey = window.require('WAWebMsgKey').fromString(serializedId);
              const table = window.require('WAWebPollsVotesSchema').getTable();
              const pollVotes = await table.equals(['parentMsgKey'], msgKey.toString());
              
              return {
                success: true,
                votes: pollVotes.map((item: any) => {
                  const typedArray = new Uint8Array(item.selectedOptionLocalIds);
                  const rawSender = item.sender || item.author;
                  const voterJid = typeof rawSender === 'object' && rawSender ? (rawSender._serialized || rawSender.toString()) : rawSender;
                  return {
                    voter: voterJid,
                    selectedOptionLocalIds: Array.from(typedArray)
                  };
                })
              };
            } catch (err: any) {
              return {
                success: false,
                error: err.message || err.toString()
              };
            }
          }, cleanMessageId);

          if (votes && !votes.success) {
            logger.error(`[PollMenuCheck] Browser evaluation error for poll ${menu.messageId}: ${votes.error}`);
            continue;
          }

          const voteList = votes?.votes || [];
          if (voteList.length === 0) continue;

          for (const vote of voteList) {
            const voterJid = vote.voter;
            if (!voterJid) continue;

            // Requirement: Only the user who requested the menu poll is allowed to trigger the response
            const voterNum = voterJid.split('@')[0];
            const requesterNum = menu.userId.split('@')[0];
            if (voterJid !== menu.userId && voterNum !== requesterNum) continue;

            if (vote.selectedOptionLocalIds && vote.selectedOptionLocalIds.length > 0) {
              const localId = vote.selectedOptionLocalIds[0];
              const mentionStr = `@${voterNum}`;
              let responseText = '';
              let menuName = '';

              if (localId === 0) {
                menuName = 'Info Akademik UT';
                responseText = `🏢 *INFO AKADEMIK UT*\n`;
                responseText += `┌─〔 INFO AKADEMIK UT 〕\n`;
                responseText += `│ • *.infout* : Info akademik umum\n`;
                responseText += `│ • *.registrasi* : Registrasi mata kuliah\n`;
                responseText += `│ • *.panduan* : Peta jalan smt 1-8\n`;
                responseText += `│ • *.prodi* : Daftar program studi\n`;
                responseText += `│ • *.syarat* : Persyaratan berkas\n`;
                responseText += `│ • *.biaya* : Rincian SPP uang kuliah\n`;
                responseText += `│ • *.kalender* : Kalender akademik & batas tanggal\n`;
                responseText += `│ • *.salut* : Sentra Layanan UT Riau\n`;
                responseText += `│ • *.kontak* : Kontak resmi UT\n`;
                responseText += `└──────────────`;
              } else if (localId === 1) {
                menuName = 'Tuton & Sistem Belajar';
                responseText = `💻 *TUTON & BELAJAR*\n`;
                responseText += `┌─〔 TUTON & BELAJAR 〕\n`;
                responseText += `│ • *.tuton* : Panduan Tuton & Tuweb\n`;
                responseText += `│ • *.tbo* : Pembelian modul & Ruang Baca\n`;
                responseText += `│ • *.lpkbjj* : Kegiatan orientasi wajib LPKBJJ\n`;
                responseText += `│ • *.sks* : Aturan beban SKS\n`;
                responseText += `│ • *.nilai* : Cek nilai DNU/LKAM\n`;
                responseText += `│ • *.karil* : Karya Ilmiah wajib\n`;
                responseText += `│ • *.pustaka* : Perpus digital & alur yudisium\n`;
                responseText += `└──────────────`;
              } else if (localId === 2) {
                menuName = 'Game Arena & PvP RPG';
                responseText = `🎮 *GAME ARENA*\n`;
                responseText += `┌─〔 GAME ARENA 〕\n`;
                responseText += `│ • *.fight <pemain1> <pemain2>*\n`;
                responseText += `│ • *.fight leaderboard*\n`;
                responseText += `│ • *.ttt* : Game Tic Tac Toe\n`;
                responseText += `│ • *.catur* : Game Catur AI\n`;
                responseText += `│ • *.ping* : Cek kecepatan bot\n`;
                responseText += `└──────────────`;
              } else if (localId === 3) {
                menuName = 'Admin & Moderator Grup';
                responseText = `🛡️ *MENU ADMIN*\n`;
                responseText += `┌─〔 MENU ADMIN 〕\n`;
                responseText += `│ • *.warn* : Peringatkan member\n`;
                responseText += `│ • *.kick* : Keluarkan anggota\n`;
                responseText += `│ • *.promote* / *.demote*\n`;
                responseText += `│ • *.mute* / *.unmute*\n`;
                responseText += `│ • *.tagall* : Tag semua anggota\n`;
                responseText += `│ • *.hidetag* : Tag tersembunyi\n`;
                responseText += `└──────────────`;
              } else if (localId === 4) {
                menuName = 'Tampilkan Semua Menu (Teks)';
                responseText = `📜 *DAFTAR PERINTAH LENGKAP* 📜\n\n`;
                responseText += `*Umum (Member)*:\n`;
                responseText += `- .menu : Bantuan interaktif\n`;
                responseText += `- .infout : Informasi akademik UT\n`;
                responseText += `- .registrasi : Panduan registrasi\n`;
                responseText += `- .panduan : Peta jalan akademik\n`;
                responseText += `- .prodi : Daftar program studi\n`;
                responseText += `- .syarat : Berkas pendaftaran\n`;
                responseText += `- .lpkbjj : Orientasi wajib maba\n`;
                responseText += `- .biaya : Rincian SPP uang kuliah\n`;
                responseText += `- .tbo : Pembelian buku modul\n`;
                responseText += `- .tuton : Panduan Tutorial Online\n`;
                responseText += `- .sks : Aturan beban SKS\n`;
                responseText += `- .nilai : Cek nilai DNU\n`;
                responseText += `- .kalender : Batas tanggal penting\n`;
                responseText += `- .salut : Sentra Layanan UT\n`;
                responseText += `- .kontak : Helpdesk UT Batam\n`;
                responseText += `- .owner : Info pembuat bot\n`;
                responseText += `- .saran : Kirim masukan\n`;
                responseText += `- .rules : Tata tertib grup\n`;
                responseText += `- .status : Periksa server\n\n`;
                responseText += `*Game Arena*:\n`;
                responseText += `- .fight : PvP RPG 1v1\n`;
                responseText += `- .fight leaderboard : Peringkat PvP\n`;
                responseText += `- .ttt : Game Tic Tac Toe\n`;
                responseText += `- .catur : Game Catur AI\n`;
                responseText += `- .ping : Latensi bot\n\n`;
                responseText += `*Moderator & Admin*:\n`;
                responseText += `- .warn / .warnings\n`;
                responseText += `- .kick : Keluarkan anggota\n`;
                responseText += `- .promote / .demote\n`;
                responseText += `- .mute / .unmute\n`;
                responseText += `- .tagall / .hidetag`;
              }

              if (responseText) {
                // Requirement: Log to console [NAMA_USER] memilih: [NAMA_MENU]
                let contactName = voterNum;
                try {
                  const contact = await client.getContactById(voterJid);
                  if (contact && contact.pushname) {
                    contactName = contact.pushname;
                  }
                } catch (_) {}
                logger.info(`[${contactName}] memilih: ${menuName}`);

                // Send the response message
                await client.sendMessage(menu.chatId, responseText, { mentions: [voterJid] });

                // Requirement: After response is sent, remove the user's poll session (ensure single vote response)
                const idx = activePollMenus.indexOf(menu);
                if (idx !== -1) {
                  activePollMenus.splice(idx, 1);
                }
                break; // Break the votes loop since the menu session is now closed
              }
            }
          }
        } catch (err: any) {
          logger.error(`Error checking menu poll votes: ${err.message}`);
        }
      }
    }, 1500);

    // Load plugins when client is ready
    try {
      await pluginManager.loadPlugins(client);
    } catch (pluginErr: any) {
      logger.error("Failed to load plugins on ready event:", pluginErr.message || pluginErr);
    }
  });

  // Event: Disconnected
  client.on('disconnected', (reason: string) => {
    logger.error(`WhatsApp disconnected! Reason: ${reason}`);
    botState.connected = false;
    botState.qr = null;
    botState.botUser = null;
    emitStatusUpdate();
    logToDashboard('Logout', `WhatsApp disconnected. Reason: ${reason}`);

    // Auto Reconnect
    logger.info("Attempting to reconnect in 10 seconds...");
    setTimeout(() => {
      try {
        client.destroy();
        initWhatsAppClient();
      } catch (err) {
        logger.error("Failed to re-initialize client during reconnection", err);
      }
    }, 10000);
  });

  // Event: Group Join (Welcome message)
  client.on('group_join', async (notification: any) => {
    const groupId = notification.chatId;
    logger.info(`Group Join detected in: ${groupId}`);
    logToDashboard('Security', `User joined group ${groupId}`);

    try {
      let chat: any;
      try {
        chat = await notification.getChat();
      } catch (err: any) {
        logger.warn(`Failed to get chat via notification.getChat(), using fallback: ${err.message}`);
        chat = {
          id: { _serialized: groupId },
          name: 'Grup WA',
          sendMessage: async (text: string, options?: any) => {
            return client.sendMessage(groupId, text, options);
          }
        };
        if (client.pupPage) {
          try {
            const name = await client.pupPage.evaluate(async (chatId: string) => {
              const chat = window.Store.Chat.get(chatId);
              return chat ? chat.name || chat.formattedTitle : null;
            }, groupId);
            if (name) {
              chat.name = name;
            }
          } catch (_) {}
        }
      }
      const groupSettings = await prisma.groupSetting.findUnique({
        where: { groupId }
      });

      // Default welcome text if enabled
      if (!groupSettings || groupSettings.welcomeEnabled) {
        const recipientIds = notification.recipientIds || [];
        
        // Retrieve real group title from DB if current chat.name is fallback
        let groupTitle = chat.name;
        if (!groupTitle || groupTitle === 'Grup' || groupTitle === 'Grup WA' || groupTitle === 'Grup WhatsApp') {
          const dbGroup = await prisma.group.findUnique({ where: { id: groupId } });
          if (dbGroup && dbGroup.name && dbGroup.name !== 'Grup' && dbGroup.name !== 'Grup WA' && dbGroup.name !== 'Grup WhatsApp') {
            groupTitle = dbGroup.name;
          }
        }
        if (!groupTitle || groupTitle === 'Grup' || groupTitle === 'Grup WA' || groupTitle === 'Grup WhatsApp') {
          groupTitle = 'Grup WhatsApp';
        }

        // Send welcome sticker if enabled
        if (!groupSettings || groupSettings.welcomeStickerEnabled !== false) {
          const stickerPath = path.resolve('a3e14a32-0541-4e07-aa19-f353be81f5e9.webp');
          if (fs.existsSync(stickerPath)) {
            try {
              const media = MessageMedia.fromFilePath(stickerPath);
              await chat.sendMessage(media, { sendMediaAsSticker: true });
              logger.info(`Sent welcome sticker in group: ${groupTitle}`);
            } catch (stickerErr) {
              logger.error("Failed to send welcome sticker", stickerErr);
            }
          } else {
            logger.warn(`Welcome sticker file not found at path: ${stickerPath}`);
          }
        }

        for (const id of recipientIds) {
          // Launch an independent welcome animation edit loop for each joining member
          (async () => {
            const sessionKey = `${groupId}:${id}`;
            
            // Clean up any existing welcome edit session for this member JID first to prevent duplicates
            const oldSession = activeWelcomeSessions.get(sessionKey);
            if (oldSession) {
              oldSession.cancel = true;
            }

            const currentSession = { cancel: false };
            activeWelcomeSessions.set(sessionKey, currentSession);

            const rawNumber = id.split('@')[0];
            let memberName = 'Mahasiswa';
            try {
              const contact = await client.getContactById(id);
              memberName = contact.pushname || 'Mahasiswa';
            } catch (_) {}

            const userMention = `${memberName} (@${rawNumber})`;
            const mentions = [id];

            // Define the message templates
            const pesan1 = `Selamat datang ${userMention} di *${groupTitle}*\nSelamat berdiskusi`;
            
            const pesan2 = `📚 Grup *${groupTitle}* dibuat sebagai media untuk:\n\n` +
              `• Berbagi informasi akademik\n` +
              `• Pengumuman penting\n` +
              `• Diskusi perkuliahan\n` +
              `• Berbagi pengalaman dan saling membantu sesama mahasiswa.`;

            const pesan3 = `📖 *RULES ${groupTitle}*\n\n` +
              `✅ Gunakan bahasa yang sopan.\n` +
              `✅ Hormati seluruh anggota grup.\n` +
              `✅ Dilarang spam, promosi, maupun flood.\n` +
              `✅ Fokus pada pembahasan yang berkaitan dengan Universitas Terbuka.`;

            const pesan4 = `🎉 Terima kasih telah bergabung di *${groupTitle}*.\n\n` +
              `Semoga grup ini menjadi tempat yang nyaman untuk belajar, berdiskusi, dan saling membantu.\n\n` +
              `Selamat belajar dan semoga sukses! 🎓`;

            // Sequence: pesan1 -> pesan2 -> pesan3 -> pesan4 -> back to pesan1 (and stay there)
            const messages = [pesan1, pesan2, pesan3, pesan4, pesan1];

            try {
              // Send the initial Message 1
              const sentMsg = await chat.sendMessage(pesan1, { mentions });
              logToDashboard('Broadcast', `Sent initial Welcome message for ${memberName} in group ${groupTitle}`);

              let currentStep = 0;

              for (let i = 1; i < messages.length; i++) {
                // Wait for 3 seconds
                await new Promise(resolve => setTimeout(resolve, 3000));

                // Check if session has been cancelled or cleaned up
                const check = activeWelcomeSessions.get(sessionKey);
                if (!check || check.cancel) {
                  logger.info(`[WelcomeLoop] Session ${sessionKey} has been cancelled. Stopping loop.`);
                  break;
                }

                currentStep = i;
                const nextMsgText = messages[currentStep];

                // Pass the mentions array so that when it goes back to Pesan 1, the tag is correctly green & clickable!
                const isEdited = await safeEditMessage(client, sentMsg, nextMsgText, mentions);
                if (!isEdited) {
                  logger.error(`[WelcomeLoop] Failed to edit message for ${sessionKey} using safeEditMessage. Stopping loop.`);
                  break;
                }
              }
              activeWelcomeSessions.delete(sessionKey);
            } catch (err: any) {
              logger.error(`[WelcomeLoop] Error in welcome session for ${sessionKey}: ${err.message}`, err);
              activeWelcomeSessions.delete(sessionKey);
            }
          })();
        }
      }
    } catch (err) {
      logger.error("Failed to process group join event", err);
    }
  });

  // Event: Group Leave (Goodbye message removed, logging only)
  client.on('group_leave', async (notification: any) => {
    const groupId = notification.chatId;
    logger.info(`Group Leave detected in: ${groupId}`);
    logToDashboard('Security', `User left group ${groupId}`);
  });

  // Event: Anti-Call blocking
  client.on('incoming_call', async (call: any) => {
    logger.warn(`Incoming call JID from ${call.from}. Blocking...`);
    logToDashboard('Security', `Blocked incoming call from ${call.from}`);
    try {
      await call.reject();
      // Inform caller
      await client.sendMessage(call.from, '⚠️ *Sistem Otomatis*: Bot tidak menerima panggilan suara/video. Jika Anda memerlukan bantuan akademik, silakan kirim pesan teks.');
    } catch (err) {
      logger.error("Failed to reject call", err);
    }
  });

  // Event: Incoming Message
  client.on('message_create', async (msg: any) => {
    try {
      await handleMessage(client, msg);
    } catch (err) {
      logger.error("Error in message handler", err);
    }
  });



  // Event: Error
  client.on('error', (err: any) => {
    logger.error("WhatsApp client encountered an error", err);
    logToDashboard('Error', `WhatsApp Client error: ${err.message || err}`);
  });

  // Start WhatsApp Client
  client.initialize().catch((err: any) => {
    logger.error("Client initialization failed asynchronously: " + err.message, err);
    logToDashboard('Error', `Client initialization failed: ${err.message}`);
  });
}

export function getClient() {
  return client;
}

/**
 * Helper to send a WhatsApp message
 */
export async function sendWhatsAppMessage(to: string, message: string) {
  if (!client || !botState.connected) {
    throw new Error("WhatsApp client is not ready or connected.");
  }
  let target = to.trim();
  if (!target.endsWith('@c.us') && !target.endsWith('@g.us')) {
    const cleaned = target.replace(/[^0-9]/g, '');
    target = `${cleaned}@c.us`;
  }
  try {
    return await client.sendMessage(target, message);
  } catch (err: any) {
    const errMsg = err.message || '';
    logger.error(`Failed to send message to ${target}:`, errMsg);

    // Detect browser page crash or detached frame
    if (
      errMsg.includes('detached Frame') ||
      errMsg.includes('Protocol error') ||
      errMsg.includes('Session closed') ||
      errMsg.includes('Target closed')
    ) {
      logger.error("Detected Puppeteer crash/detached frame during message send. Triggering auto-restart...");
      restartWhatsAppClient().catch(restartErr => {
        logger.error("Failed to trigger restart:", restartErr);
      });
    }

    throw err;
  }
}

let isRestarting = false;

/**
 * Destroys and restarts the WhatsApp Web client in case of crash or detached frame
 */
export async function restartWhatsAppClient() {
  if (isRestarting) {
    logger.warn("WhatsApp Client restart is already in progress, skipping...");
    return;
  }
  isRestarting = true;

  try {
    logger.warn("Initiating WhatsApp Client restart...");
    botState.connected = false;
    botState.qr = null;
    botState.botUser = null;
    emitStatusUpdate();
    logToDashboard('Error', 'WhatsApp Client crashed/detached. Restarting...');

    if (client) {
      try {
        await client.destroy();
      } catch (destroyErr: any) {
        logger.error("Error destroying client:", destroyErr.message || destroyErr);
      }
    }

    client = null;
    initWhatsAppClient();
  } catch (err: any) {
    logger.error("Error restarting WhatsApp Client:", err.message || err);
  } finally {
    isRestarting = false;
  }
}

// Heartbeat check every 5 minutes to detect detached frames or browser crashes
setInterval(async () => {
  if (client && botState.connected) {
    try {
      const state = await client.getState();
      if (!state) {
        throw new Error("Client state is empty/null");
      }
      logger.info(`WhatsApp client heartbeat check passed. State: ${state}`);
    } catch (err: any) {
      logger.error("WhatsApp client heartbeat check failed! Browser page may have crashed or detached.", err.message || err);
      restartWhatsAppClient().catch(restartErr => {
        logger.error("Failed to run heartbeat restart:", restartErr);
      });
    }
  }
}, 5 * 60 * 1000);
