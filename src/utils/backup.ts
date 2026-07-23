import fs from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import path from 'path';
import moment from 'moment-timezone';
import logger from './logger.js';
import prisma from '../database/prisma.js';

const DB_DIR = path.resolve('./storage/db');
const BACKUP_DIR = path.resolve('./storage/backup');
const SQLITE_FILE = path.resolve('./prisma/dev.db');

/**
 * Creates a timestamped backup folder and copies all local JSON databases and SQLite DB.
 */
export async function backupDatabase(): Promise<string> {
  logger.info("Initializing database backup process...");

  try {
    // Ensure backup directory exists
    if (!existsSync(BACKUP_DIR)) {
      mkdirSync(BACKUP_DIR, { recursive: true });
    }

    // Generate folder name based on current JKT timestamp
    const timestamp = moment().tz('Asia/Jakarta').format('YYYYMMDD-HHmmss');
    const destFolder = path.join(BACKUP_DIR, `db-backup-${timestamp}`);
    await fs.mkdir(destFolder, { recursive: true });

    let filesCount = 0;
    let totalSize = 0;

    // 1. Copy JSON Database Files
    if (existsSync(DB_DIR)) {
      const files = await fs.readdir(DB_DIR);
      const jsonFiles = files.filter(f => f.endsWith('.json'));

      for (const file of jsonFiles) {
        const srcPath = path.join(DB_DIR, file);
        const destPath = path.join(destFolder, file);
        const stat = await fs.stat(srcPath);
        await fs.copyFile(srcPath, destPath);
        filesCount++;
        totalSize += stat.size;
      }
    }

    // 2. Copy SQLite Database File
    if (existsSync(SQLITE_FILE)) {
      const destPath = path.join(destFolder, 'dev.db');
      const stat = await fs.stat(SQLITE_FILE);
      await fs.copyFile(SQLITE_FILE, destPath);
      filesCount++;
      totalSize += stat.size;
    }

    logger.info(`Database backup completed successfully. Saved to: ${destFolder}`);

    // Log the backup execution to Prisma Database
    try {
      await prisma.backup.create({
        data: {
          filename: path.basename(destFolder),
          type: 'db',
          size: totalSize,
          status: 'success'
        }
      });
    } catch (dbErr: any) {
      logger.warn("Failed to write backup log to database", dbErr);
    }

    return destFolder;
  } catch (error) {
    logger.error("Database backup process failed", error);
    throw error;
  }
}

// Support running backup manually if executed via CLI
if (process.argv.includes('--manual')) {
  (async () => {
    try {
      const path = await backupDatabase();
      console.log(`Backup completed manually: ${path}`);
      process.exit(0);
    } catch (_) {
      process.exit(1);
    }
  })();
}
