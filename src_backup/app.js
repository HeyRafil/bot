import './polyfill.js';
import express from 'express';
import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import dotenv from 'dotenv';
import moment from 'moment-timezone';
import logger from './utils/logger.js';
import localDb from './database/localDb.js';
import { runCrawler } from './crawler/academicCrawler.js';
import { initScheduler } from './scheduler/scheduler.js';
import { initWhatsAppClient, botState, sendWhatsAppMessage } from './services/whatsappClient.js';
import { getSetting, updateSettings, loadSettings } from './config/settings.js';

dotenv.config();

// Global Exception & Rejection Handlers to prevent crashes from third-party libraries (e.g. Puppeteer/whatsapp-web.js)
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Promise Rejection', reason);
  logger.info('Advice: Please check your internet connection, proxy settings, or DNS configuration.');
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception', err);
  logger.info('Advice: Please check your internet connection, proxy settings, or DNS configuration.');
});


const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
// Serve static assets from public directory
app.use(express.static('public'));

// Simple Basic/Password auth middleware for dashboard endpoints
async function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  const dbPassword = await getSetting('WEB_DASHBOARD_PASSWORD');
  if (authHeader === dbPassword) {
    return next();
  }
  return res.status(401).json({ error: 'Unauthorized. Invalid dashboard password.' });
}

// Uptime Formatter
function getUptimeString() {
  const uptimeSeconds = Math.floor(process.uptime());
  const hours = Math.floor(uptimeSeconds / 3600);
  const minutes = Math.floor((uptimeSeconds % 3600) / 60);
  const seconds = uptimeSeconds % 60;
  
  const parts = [];
  if (hours > 0) parts.push(`${hours}j`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${seconds}d`);
  return parts.join(' ');
}

/**
 * Endpoint: /settings (GET - Secure)
 */
app.get('/settings', authMiddleware, async (req, res) => {
  try {
    const config = await loadSettings();
    // Exclude showing the password directly or mask it for security
    const sanitized = { ...config };
    delete sanitized.WEB_DASHBOARD_PASSWORD;
    res.json(sanitized);
  } catch (err) {
    logger.error("Failed to fetch settings", err);
    res.status(500).json({ error: 'Failed to fetch settings.' });
  }
});

/**
 * Endpoint: /settings (POST - Secure)
 */
app.post('/settings', authMiddleware, async (req, res) => {
  try {
    const updated = await updateSettings(req.body);
    res.json({ success: true, settings: updated });
  } catch (err) {
    logger.error("Failed to update settings", err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Endpoint: /health
 */
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: moment().tz('Asia/Jakarta').format() });
});

/**
 * Endpoint: /status (Secure)
 */
app.get('/status', authMiddleware, async (req, res) => {
  const rssMemory = Math.round(process.memoryUsage().rss / 1024 / 1024); // in MB
  
  let dbStats = { knowledge: 0, faq: 0 };
  try {
    dbStats = await localDb.getStats();
  } catch (err) {
    logger.error("Failed to fetch database stats for status API", err);
  }

  res.json({
    connected: botState.connected,
    botUser: botState.botUser,
    qr: botState.qr,
    uptime: getUptimeString(),
    memory: {
      usage: rssMemory
    },
    dbStats
  });
});

/**
 * Endpoint: /logs (Secure)
 * Returns the last 40 lines of log output
 */
app.get('/logs', authMiddleware, async (req, res) => {
  const logFilePath = path.resolve('logs/app.log');
  try {
    if (!existsSync(logFilePath)) {
      return res.json([]);
    }
    const logData = await fs.readFile(logFilePath, 'utf8');
    const lines = logData.split('\n').filter(Boolean);
    const lastLines = lines.slice(-40); // Grab last 40 entries
    res.json(lastLines);
  } catch (err) {
    logger.error("Failed to read logs file", err);
    res.status(500).json({ error: 'Failed to read logs.' });
  }
});

/**
 * Endpoint: /crawler/run (Secure)
 */
app.post('/crawler/run', authMiddleware, async (req, res) => {
  logger.info("Manual crawler job requested from Web Dashboard.");
  try {
    const count = await runCrawler();
    res.json({ success: true, count });
  } catch (err) {
    logger.error("Manual crawler job failed", err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Endpoint: /bot/restart (Secure)
 */
app.post('/bot/restart', authMiddleware, async (req, res) => {
  logger.info("Restart requested from Web Dashboard. Exiting process in 1 second...");
  res.json({ success: true, message: 'Bot process is restarting...' });
  setTimeout(() => {
    process.exit(0);
  }, 1000);
});

/**
 * Endpoint: POST /api/send-message (Integration for webapp-supabase-order)
 * Sends a message/report dynamically. Protected by API secret key in headers.
 */
app.post('/api/send-message', async (req, res) => {
  const { to, message } = req.body;
  const apiKeyHeader = req.headers['x-api-key'];
  const expectedApiKey = process.env.API_SECRET_KEY || 'SuperSecretKeyUT2026';

  // 1. Security Check
  if (apiKeyHeader !== expectedApiKey) {
    logger.warn(`Unauthorized API call to /api/send-message from IP: ${req.ip}`);
    return res.status(401).json({ error: 'Unauthorized: Invalid API Key.' });
  }

  // 2. Validation
  if (!to || !message) {
    return res.status(400).json({ error: 'Missing "to" (phone number) or "message" content.' });
  }

  // 3. Connection Check
  if (!botState.connected) {
    return res.status(503).json({ error: 'WhatsApp client is not connected. Please scan QR first.' });
  }

  // 4. Send Message
  try {
    logger.info(`API Request: Sending WhatsApp message to: ${to}`);
    await sendWhatsAppMessage(to, message);
    res.json({ success: true, message: 'Message sent successfully.' });
  } catch (err) {
    logger.error(`Failed to send WhatsApp message via API to ${to}`, err);
    res.status(500).json({ error: `Failed to send message: ${err.message}` });
  }
});

// Start Express and Bot Service
const server = app.listen(PORT, async () => {
  logger.info("=================================================");
  logger.info("   UNIVERSITAS TERBUKA WHATSAPP AI ASSISTANT     ");
  logger.info(`   Server running on http://localhost:${PORT}      `);
  logger.info("=================================================");
  
  // 1. Initialize Scheduler and baseline seed data
  await initScheduler();
  
  // 2. Initialize WhatsApp Bot Client
  initWhatsAppClient();
});

// Handle graceful shutdowns to release WhatsApp session correctly
process.on('SIGTERM', () => {
  logger.info("SIGTERM received. Shutting down gracefully...");
  server.close(() => {
    logger.info("HTTP server closed.");
    process.exit(0);
  });
});
