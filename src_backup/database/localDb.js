import fs from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import logger from '../utils/logger.js';

dotenv.config();

const DB_DIR = path.resolve(process.env.DATABASE_DIR || './storage/db');

// Ensure db directory exists
if (!existsSync(DB_DIR)) {
  mkdirSync(DB_DIR, { recursive: true });
}

// In-memory cache to keep reads fast and minimize disk I/O
const dbCache = {};

export const localDb = {
  /**
   * Safely writes JSON content using write-temp-then-rename pattern.
   * Prevents database corruption.
   */
  async safeWriteFile(filePath, data) {
    const tempPath = `${filePath}.tmp`;
    const content = JSON.stringify(data, null, 2);
    try {
      await fs.writeFile(tempPath, content, 'utf8');
      await fs.rename(tempPath, filePath);
    } catch (error) {
      logger.warn(`Database safeWriteFile temp-rename failed for ${filePath}, falling back to direct write. Error: ${error.message}`);
      // Fallback: Write directly to target file
      await fs.writeFile(filePath, content, 'utf8');
      // Clean up temp file if it was created
      if (existsSync(tempPath)) {
        try { await fs.unlink(tempPath); } catch (_) {}
      }
    }
  },

  /**
   * Reads a collection. Returns default data if file doesn't exist.
   */
  async getCollection(name, defaultVal = []) {
    if (dbCache[name]) {
      return dbCache[name];
    }

    const filePath = path.join(DB_DIR, `${name}.json`);
    try {
      if (!existsSync(filePath)) {
        // Initialize file
        await this.safeWriteFile(filePath, defaultVal);
        dbCache[name] = defaultVal;
        return defaultVal;
      }
      const raw = await fs.readFile(filePath, 'utf8');
      const parsed = JSON.parse(raw);
      dbCache[name] = parsed;
      return parsed;
    } catch (error) {
      logger.error(`Failed to read collection: ${name}`, error);
      return defaultVal;
    }
  },

  /**
   * Saves a collection completely.
   */
  async saveCollection(name, data) {
    const filePath = path.join(DB_DIR, `${name}.json`);
    dbCache[name] = data;
    await this.safeWriteFile(filePath, data);
  },

  /**
   * Inserts an item into a collection.
   */
  async insert(name, item) {
    const collection = await this.getCollection(name);
    collection.push(item);
    await this.saveCollection(name, collection);
    return item;
  },

  /**
   * Clears a collection.
   */
  async clearCollection(name) {
    await this.saveCollection(name, []);
  },

  /**
   * Gets statistics of all collections.
   */
  async getStats() {
    const collections = ['knowledge', 'faq', 'exams', 'registration', 'schedules', 'announcements', 'groups'];
    const stats = {};
    for (const col of collections) {
      const data = await this.getCollection(col);
      stats[col] = Array.isArray(data) ? data.length : Object.keys(data).length;
    }
    return stats;
  }
};

export default localDb;
