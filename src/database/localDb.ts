import fs from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import logger from '../utils/logger.js';
import prisma from './prisma.js';

dotenv.config();

const DB_DIR = path.resolve(process.env.DATABASE_DIR || './storage/db');

// Ensure db directory exists
if (!existsSync(DB_DIR)) {
  mkdirSync(DB_DIR, { recursive: true });
}

// In-memory cache to keep reads fast and minimize disk I/O
const dbCache: Record<string, any> = {};

export const localDb = {
  /**
   * Safely writes JSON content using write-temp-then-rename pattern.
   * Prevents database corruption.
   */
  async safeWriteFile(filePath: string, data: any) {
    const tempPath = `${filePath}.tmp`;
    const content = JSON.stringify(data, null, 2);
    try {
      await fs.writeFile(tempPath, content, 'utf8');
      await fs.rename(tempPath, filePath);
    } catch (error: any) {
      logger.warn(`Database safeWriteFile temp-rename failed for ${filePath}, falling back to direct write. Error: ${error.message}`);
      await fs.writeFile(filePath, content, 'utf8');
      if (existsSync(tempPath)) {
        try { await fs.unlink(tempPath); } catch (_) {}
      }
    }
  },

  /**
   * Reads a collection. Returns default data if file doesn't exist.
   * Special case: 'groups' collection uses Prisma instead of JSON file.
   */
  async getCollection(name: string, defaultVal: any = []): Promise<any> {
    if (name === 'groups') {
      try {
        const groups = await prisma.group.findMany({
          where: { status: true }
        });
        return groups.map(g => g.id);
      } catch (err: any) {
        logger.error("Failed to fetch whitelisted groups from Prisma", err);
        return [];
      }
    }

    if (dbCache[name]) {
      return dbCache[name];
    }

    const filePath = path.join(DB_DIR, `${name}.json`);
    try {
      if (!existsSync(filePath)) {
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
   * Special case: 'groups' syncs to Prisma.
   */
  async saveCollection(name: string, data: any) {
    if (name === 'groups') {
      try {
        const whitelistIds: string[] = Array.isArray(data) ? data : [];
        
        // 1. Disable status for all groups not in the whitelist JID list
        await prisma.group.updateMany({
          where: {
            id: { notIn: whitelistIds }
          },
          data: { status: false }
        });

        // 2. Enable status for all whitelisted groups
        for (const id of whitelistIds) {
          await prisma.group.upsert({
            where: { id },
            update: { status: true },
            create: {
              id,
              name: 'Grup WhatsApp',
              status: true
            }
          });
        }
        return;
      } catch (err: any) {
        logger.error("Failed to sync whitelisted groups to Prisma", err);
        return;
      }
    }

    const filePath = path.join(DB_DIR, `${name}.json`);
    dbCache[name] = data;
    await this.safeWriteFile(filePath, data);
  },

  /**
   * Inserts an item into a collection.
   */
  async insert(name: string, item: any) {
    if (name === 'groups') {
      const id = typeof item === 'string' ? item : item.id;
      try {
        await prisma.group.upsert({
          where: { id },
          update: { status: true },
          create: {
            id,
            name: 'Grup WhatsApp',
            status: true
          }
        });
      } catch (err: any) {
        logger.error(`Failed to insert group ${id} into Prisma`, err);
      }
      return item;
    }

    const collection = await this.getCollection(name);
    collection.push(item);
    await this.saveCollection(name, collection);
    return item;
  },

  /**
   * Clears a collection.
   */
  async clearCollection(name: string) {
    await this.saveCollection(name, []);
  },

  /**
   * Gets statistics of all collections.
   */
  async getStats() {
    const collections = ['knowledge', 'faq', 'exams', 'registration', 'schedules', 'announcements'];
    const stats: Record<string, number> = {};
    for (const col of collections) {
      const data = await this.getCollection(col);
      stats[col] = Array.isArray(data) ? data.length : Object.keys(data).length;
    }
    
    // Add groups statistic from Prisma
    try {
      stats['groups'] = await prisma.group.count({
        where: { status: true }
      });
    } catch (_) {
      stats['groups'] = 0;
    }
    
    return stats;
  }
};

export default localDb;
