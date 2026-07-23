import localDb from '../database/localDb.js';
import dotenv from 'dotenv';
import logger from '../utils/logger.js';

dotenv.config();

const DEFAULT_SETTINGS = {
  OWNER_NUMBER: process.env.OWNER_NUMBER || '62895360042021',
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  COOLDOWN_MS: parseInt(process.env.COOLDOWN_MS || '3000', 10),
  WEB_DASHBOARD_PASSWORD: process.env.WEB_DASHBOARD_PASSWORD || 'AdminUT2026',
  ANTI_LINK_ENABLED: true
};

let settingsCache = null;

/**
 * Loads dynamic settings from local JSON database, falling back to .env
 */
export async function loadSettings() {
  if (settingsCache) return settingsCache;

  try {
    const saved = await localDb.getCollection('settings');
    if (!saved || saved.length === 0) {
      // Seed default settings
      await localDb.saveCollection('settings', [DEFAULT_SETTINGS]);
      settingsCache = { ...DEFAULT_SETTINGS };
    } else {
      const dbSettings = saved[0];
      let needsUpdate = false;

      // Sync updated .env variables back into the database if they changed
      if (process.env.OPENAI_API_KEY && dbSettings.OPENAI_API_KEY !== process.env.OPENAI_API_KEY) {
        dbSettings.OPENAI_API_KEY = process.env.OPENAI_API_KEY;
        needsUpdate = true;
      }
      if (process.env.OWNER_NUMBER && dbSettings.OWNER_NUMBER !== process.env.OWNER_NUMBER) {
        dbSettings.OWNER_NUMBER = process.env.OWNER_NUMBER;
        needsUpdate = true;
      }
      if (process.env.WEB_DASHBOARD_PASSWORD && dbSettings.WEB_DASHBOARD_PASSWORD !== process.env.WEB_DASHBOARD_PASSWORD) {
        dbSettings.WEB_DASHBOARD_PASSWORD = process.env.WEB_DASHBOARD_PASSWORD;
        needsUpdate = true;
      }

      if (needsUpdate) {
        await localDb.saveCollection('settings', [dbSettings]);
        logger.info("Local settings database synced with updated .env variables.");
      }

      settingsCache = { ...DEFAULT_SETTINGS, ...dbSettings };
    }
  } catch (error) {
    logger.error("Failed to load dynamic settings, using fallback defaults", error);
    settingsCache = { ...DEFAULT_SETTINGS };
  }
  return settingsCache;
}

/**
 * Gets a specific dynamic setting value
 */
export async function getSetting(key) {
  const settings = await loadSettings();
  return settings[key];
}

/**
 * Updates dynamic settings in the database and memory cache
 */
export async function updateSettings(newSettings) {
  const current = await loadSettings();
  
  // Format inputs (like cleaning Owner Number)
  if (newSettings.OWNER_NUMBER) {
    newSettings.OWNER_NUMBER = newSettings.OWNER_NUMBER.replace(/[^0-9,]/g, '');
  }
  if (newSettings.COOLDOWN_MS) {
    newSettings.COOLDOWN_MS = parseInt(newSettings.COOLDOWN_MS, 10) || 3000;
  }

  const updated = { ...current, ...newSettings };
  settingsCache = updated;
  
  await localDb.saveCollection('settings', [updated]);
  logger.info("Dynamic settings updated successfully.");
  return updated;
}
