import { Command } from './index.js';
import logger from '../utils/logger.js';

export const screenshotCommand: Command = {
  name: 'screenshot',
  roleRequired: 'Member',
  description: 'Take a screenshot of the browser page.',
  async execute(client, msg, chat, args, privileges) {
    try {
      if (!client.pupPage) {
        return msg.reply('❌ pupPage is not available.');
      }
      
      const screenshotPath = 'C:\\Users\\PB-0761-USER\\.gemini\\antigravity\\brain\\d7c91a72-6abc-4a08-af61-e96e2f4faaff\\browser.png';
      await client.pupPage.screenshot({ path: screenshotPath });
      
      logger.info(`Screenshot saved to: ${screenshotPath}`);
      return msg.reply(`✅ Screenshot captured and saved to brain!`);
    } catch (err: any) {
      logger.error(`Error taking screenshot: ${err.message}`);
      return msg.reply(`❌ Error taking screenshot: ${err.message}`);
    }
  }
};

export default screenshotCommand;
