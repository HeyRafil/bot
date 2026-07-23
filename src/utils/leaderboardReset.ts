import prisma from '../database/prisma.js';
import logger from './logger.js';
import moment from 'moment-timezone';

/**
 * Checks if a calendar month has changed since the last reset,
 * and resets all group member quiz scores to 0 if so.
 */
export async function checkAndResetWeeklyScores(): Promise<void> {
  try {
    const key = 'last_monthly_reset';
    const now = moment().tz('Asia/Jakarta'); // Using Western Indonesia Time (WIB)

    const record = await prisma.statistics.findUnique({
      where: { key }
    });

    if (!record) {
      // First time initialization
      await prisma.statistics.create({
        data: {
          key,
          value: now.toISOString()
        }
      });
      logger.info('Monthly quiz leaderboard reset initialized.');
      return;
    }

    const lastReset = moment(record.value).tz('Asia/Jakarta');

    // Check if the calendar month has changed (different month or different year),
    // or if more than 31 days have elapsed since the last reset.
    const isNewMonth = 
      now.month() !== lastReset.month() || 
      now.year() !== lastReset.year() || 
      now.diff(lastReset, 'days') >= 31;

    if (isNewMonth) {
      logger.info('Starting monthly quiz leaderboard reset...');

      // Reset all quiz scores in the database
      const count = await prisma.$executeRaw`UPDATE group_members SET quizScore = 0`;

      // Update the reset timestamp in DB
      await prisma.statistics.update({
        where: { key },
        data: { value: now.toISOString() }
      });

      logger.info(`Monthly quiz leaderboard reset completed successfully. Reset ${count} members.`);
    }
  } catch (err) {
    logger.error('Failed to run monthly quiz leaderboard reset check:', err);
  }
}
