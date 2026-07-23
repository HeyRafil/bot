import dotenv from 'dotenv';
import logger from '../utils/logger.js';
import { runCrawler, seedBaselineData } from '../crawler/academicCrawler.js';
import localDb from '../database/localDb.js';

dotenv.config();

const INTERVAL_HOURS = parseFloat(process.env.CRAWLER_INTERVAL_HOURS || '6');
const INTERVAL_MS = INTERVAL_HOURS * 60 * 60 * 1000;

export async function initScheduler() {
  logger.info(`Initializing Crawler Scheduler (Running every ${INTERVAL_HOURS} hours)...`);

  // Ensure baseline data is seeded immediately on start
  await seedBaselineData();

  // If DB is completely empty (except seeds, check if we need to run crawler once immediately)
  const knowledge = await localDb.getCollection('knowledge');
  if (knowledge.length <= 15) { // baseline seeds amount is small
    logger.info("Database appears minimal. Triggering initial web crawl job in background...");
    // Run asynchronously to not block server startup
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
