import fs from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import path from 'path';
import moment from 'moment-timezone';
import logger from './logger.js';

const DB_DIR = path.resolve('./storage/db');
const BACKUP_DIR = path.resolve('./storage/backup');

/**
 * Creates a timestamped backup folder and copies all local JSON databases.
 * Runs fully self-contained without external ZIP dependencies to optimize VPS memory.
 */
export async function backupDatabase() {
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

    // Read all files in the database directory
    if (!existsSync(DB_DIR)) {
      throw new Error(`Database directory ${DB_DIR} does not exist. Nothing to backup.`);
    }

    const files = await fs.readdir(DB_DIR);
    const jsonFiles = files.filter(f => f.endsWith('.json'));

    if (jsonFiles.length === 0) {
      logger.warn("No JSON database files found to backup.");
      return destFolder;
    }

    // Copy each JSON database file to the backup folder
    for (const file of jsonFiles) {
      const srcPath = path.join(DB_DIR, file);
      const destPath = path.join(destFolder, file);
      await fs.copyFile(srcPath, destPath);
    }

    logger.info(`Database backup completed successfully. Files saved to: ${destFolder}`);
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
