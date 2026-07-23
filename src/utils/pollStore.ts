import logger from './logger.js';

export interface ActivePollMenu {
  messageId: string;
  chatId: string;
  userId: string;
  createdAt: number;
}

export const activePollMenus: ActivePollMenu[] = [];

export function registerActivePollMenu(messageId: string, chatId: string, userId: string) {
  logger.info(`[PollStore] Registering active menu poll: messageId=${messageId}, chatId=${chatId}, userId=${userId}`);
  activePollMenus.push({
    messageId,
    chatId,
    userId,
    createdAt: Date.now()
  });
}
