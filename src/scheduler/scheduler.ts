import dotenv from 'dotenv';
import logger from '../utils/logger.js';
import { runCrawler, seedBaselineData } from '../crawler/academicCrawler.js';
import localDb from '../database/localDb.js';
import { startCalendarReminderScheduler } from './calendarReminderScheduler.js';
import { initGoldPriceTracker } from '../services/goldService.js';

dotenv.config();

const INTERVAL_HOURS = parseFloat(process.env.CRAWLER_INTERVAL_HOURS || '6');
const INTERVAL_MS = INTERVAL_HOURS * 60 * 60 * 1000;

export async function initScheduler(): Promise<void> {
  logger.info(`Initializing Crawler Scheduler (Running every ${INTERVAL_HOURS} hours)...`);

  // Start Gold Price Tracker (Runs check every 5 minutes and sends alerts)
  initGoldPriceTracker();

  // Start Academic Calendar Reminder Scheduler (Sends warnings at 08:30 WIB daily)
  startCalendarReminderScheduler();

  // Ensure baseline data is seeded immediately on start
  await seedBaselineData();

  // If DB is completely empty, run crawler once immediately in background
  const knowledge = await localDb.getCollection('knowledge');
  if (knowledge.length <= 15) {
    logger.info("Database appears minimal. Triggering initial web crawl job in background...");
    runCrawler().catch(err => logger.error("Startup crawler job failed", err));
  }

  // Set periodic crawler timer
  setInterval(async () => {
    logger.info("Scheduler triggered automatic crawler job...");
    try {
      const count = await runCrawler();
      logger.info(`Automatic crawler job completed. Extracted items: ${count}`);
    } catch (error) {
      logger.error("Error running automatic crawler job", error);
    }
  }, INTERVAL_MS);
}

export default initScheduler;
