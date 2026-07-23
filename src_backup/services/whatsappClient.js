import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcodeTerminal from 'qrcode-terminal';
import QRCode from 'qrcode';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import logger from '../utils/logger.js';
import { handleMessage } from '../handlers/messageHandler.js';

dotenv.config();

const SESSION_DIR = path.resolve(process.env.SESSION_PATH || './session');

// Shared bot status object
export const botState = {
  connected: false,
  qr: null,
  botUser: null
};

let client = null;

/**
 * Initializes and launches the WhatsApp Web Client with memory optimizations
 */
export function initWhatsAppClient() {
  logger.info("Initializing WhatsApp Web Client...");

  // Ensure session directory exists
  if (!fs.existsSync(SESSION_DIR)) {
    fs.mkdirSync(SESSION_DIR, { recursive: true });
  }

  let execPath = process.env.PUPPETEER_EXECUTABLE_PATH;
  
  // Auto-detect Linux VPS Google Chrome if no custom path is set in env
  if (!execPath && process.platform === 'linux') {
    if (fs.existsSync('/usr/bin/google-chrome')) {
      execPath = '/usr/bin/google-chrome';
      logger.info(`Auto-detected Google Chrome on Linux: ${execPath}`);
    } else if (fs.existsSync('/usr/bin/chromium-browser')) {
      execPath = '/usr/bin/chromium-browser';
      logger.info(`Auto-detected Chromium on Linux: ${execPath}`);
    }
  }

  // Create Client
  client = new Client({
    authStrategy: new LocalAuth({
      dataPath: SESSION_DIR
    }),
    webVersionCache: {
      type: 'local',
      path: path.join(SESSION_DIR, '.wwebjs_cache'),
      strict: false
    },
    puppeteer: {
      headless: true,
      executablePath: execPath || undefined,
      // Chromium flags customized for low RAM usage and VPS stability
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
        '--disable-extensions'
      ]
    }
  });

  // Event: QR Code generated
  client.on('qr', async (qrCodeText) => {
    logger.info("WhatsApp QR Code received. Rendering...");
    
    // 1. Output QR code to terminal console
    qrcodeTerminal.generate(qrCodeText, { small: true });

    // 2. Generate Data URL image of QR code for Web Dashboard
    try {
      botState.qr = await QRCode.toDataURL(qrCodeText);
      botState.connected = false;
      logger.info("QR Code successfully rendered for Web Dashboard.");
    } catch (err) {
      logger.error("Failed to generate QR DataURL", err);
    }
  });

  // Event: Authentication Successful
  client.on('authenticated', () => {
    logger.info("WhatsApp authentication successful!");
  });

  // Event: Authentication Failure
  client.on('auth_failure', (msg) => {
    logger.error("WhatsApp authentication failed", msg);
    botState.connected = false;
    botState.qr = null;
    
    // Recovery: Delete session directory to force log out and re-pair if needed
    logger.warn("Attempting authentication recovery: clearing session lock files...");
  });

  // Event: Ready to use
  client.on('ready', () => {
    botState.connected = true;
    botState.qr = null;
    botState.botUser = `${client.info.pushname} (${client.info.wid.user})`;
    logger.info(`=================================================`);
    logger.info(`   WhatsApp Bot is READY and connected as:        `);
    logger.info(`   ${botState.botUser}`);
    logger.info(`=================================================`);
  });

  // Event: Error
  client.on('error', (err) => {
    logger.error("WhatsApp client encountered an error", err);
    logger.info("Advice: Please check your internet connection, proxy settings, or DNS configuration.");
  });

  // Event: Disconnected
  client.on('disconnected', (reason) => {
    logger.error(`WhatsApp disconnected! Reason: ${reason}`);
    botState.connected = false;
    botState.qr = null;
    botState.botUser = null;

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

  // Event: Group Join / Welcome message
  client.on('group_join', async (notification) => {
    logger.info(`Group Join detected in: ${notification.chatId}`);
    try {
      const chat = await notification.getChat();
      const recipientIds = notification.recipientIds || [];
      const welcomeTargets = [];
      const mentions = [];

      for (const id of recipientIds) {
        const rawNumber = id.split('@')[0];
        try {
          const contact = await client.getContactById(id);
          if (contact.pushname) {
            welcomeTargets.push(`${contact.pushname} (@${rawNumber})`);
          } else {
            welcomeTargets.push(`@${rawNumber}`);
          }
          mentions.push(id);
        } catch (_) {
          welcomeTargets.push(`@${rawNumber}`);
          mentions.push(id);
        }
      }

      const targetStr = welcomeTargets.length > 0 ? welcomeTargets.join(', ') : 'Rekan Mahasiswa Baru';

      await chat.sendMessage(
        `Selamat Datang ${targetStr} di grup *${chat.name}*! 👋📚`,
        { mentions }
      );
    } catch (err) {
      logger.error("Failed to process group join event", err);
    }
  });

  // Event: Incoming Message
  client.on('message_create', async (msg) => {
    try {
      await handleMessage(client, msg);
    } catch (err) {
      logger.error("Error in message handler", err);
    }
  });

  // Start WhatsApp Client
  client.initialize().catch((err) => {
    logger.error("Client initialization failed asynchronously: " + err.message, err);
    logger.info("Advice: Please check your internet connection and DNS settings on your host machine/VPS.");
  });
}

export function getClient() {
  return client;
}

/**
 * Helper to send a WhatsApp message to a specific number or group JID
 */
export async function sendWhatsAppMessage(to, message) {
  if (!client) {
    throw new Error("WhatsApp client is not initialized.");
  }
  let formattedNumber = to.replace(/[^0-9]/g, '');
  if (!formattedNumber.endsWith('@c.us') && !formattedNumber.endsWith('@g.us')) {
    formattedNumber += '@c.us';
  }
  return await client.sendMessage(formattedNumber, message);
}
