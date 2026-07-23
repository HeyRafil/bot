import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import moment from 'moment-timezone';

// Force chalk colors to be enabled in PM2 / non-TTY environments
chalk.level = 1;

const LOG_DIR = path.resolve('logs');

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

const paths = {
  app: path.join(LOG_DIR, 'app.log'),
  error: path.join(LOG_DIR, 'error.log'),
  crawler: path.join(LOG_DIR, 'crawler.log')
};

// Helper to write to file
function appendToFile(filePath: string, text: string) {
  try {
    fs.appendFileSync(filePath, text + '\n', 'utf8');
  } catch (err) {
    console.error(`Failed to write to log file: ${filePath}`, err);
  }
}

function getTimestamp() {
  return moment().tz('Asia/Jakarta').format('YYYY-MM-DD HH:mm:ss');
}

export const logger = {
  info(message: string, error: any = null) {
    const timestamp = getTimestamp();
    const errMsg = error ? ` - Details: ${error.message || error}` : '';
    const consoleMsg = `${chalk.gray(`[${timestamp}]`)} ${chalk.blue('[INFO]')} ${message}${errMsg}`;
    const fileMsg = `[${timestamp}] [INFO] ${message}${errMsg}`;
    console.log(consoleMsg);
    appendToFile(paths.app, fileMsg);
  },

  warn(message: string, error: any = null) {
    const timestamp = getTimestamp();
    const errMsg = error ? ` - Details: ${error.message || error}` : '';
    const consoleMsg = `${chalk.gray(`[${timestamp}]`)} ${chalk.yellow(`[WARN] ${message}${errMsg}`)}`;
    const fileMsg = `[${timestamp}] [WARN] ${message}${errMsg}`;
    console.log(consoleMsg);
    appendToFile(paths.app, fileMsg);
  },

  error(message: string, error: any = null) {
    const timestamp = getTimestamp();
    let errMsg = error ? ` - Error: ${error.message || error}` : '';
    if (error && error.stack) {
      errMsg += `\nStack: ${error.stack}`;
    }
    const consoleMsg = `${chalk.gray(`[${timestamp}]`)} ${chalk.red('[ERROR]')} ${message}${errMsg}`;
    const fileMsg = `[${timestamp}] [ERROR] ${message}${errMsg}`;
    console.error(consoleMsg);
    appendToFile(paths.app, fileMsg);
    appendToFile(paths.error, fileMsg);
  },

  debug(message: string, error: any = null) {
    if (process.env.NODE_ENV !== 'production') {
      const timestamp = getTimestamp();
      const errMsg = error ? ` - Details: ${error.message || error}` : '';
      const consoleMsg = `${chalk.gray(`[${timestamp}]`)} ${chalk.magenta('[DEBUG]')} ${message}${errMsg}`;
      const fileMsg = `[${timestamp}] [DEBUG] ${message}${errMsg}`;
      console.log(consoleMsg);
      appendToFile(paths.app, fileMsg);
    }
  },

  crawl(message: string, isError: boolean = false) {
    const timestamp = getTimestamp();
    const prefix = isError ? '[CRAWL_ERROR]' : '[CRAWL]';
    const consoleColor = isError ? chalk.red : chalk.cyan;
    
    const consoleMsg = `${chalk.gray(`[${timestamp}]`)} ${consoleColor(prefix)} ${message}`;
    const fileMsg = `[${timestamp}] ${prefix} ${message}`;
    
    console.log(consoleMsg);
    appendToFile(paths.app, fileMsg);
    appendToFile(paths.crawler, fileMsg);
    if (isError) {
      appendToFile(paths.error, fileMsg);
    }
  }
};

export default logger;
