import logger from './logger.js';

export interface ActivePollMenu {
  messageId: string;
  chatId: string;
  votedUserJids: Set<string>;
  createdAt: number;
}

export const activePollMenus: ActivePollMenu[] = [];

export function registerActivePollMenu(messageId: string, chatId: string) {
  logger.info(`[PollStore] Registering active menu poll: messageId=${messageId}, chatId=${chatId}`);
  activePollMenus.push({
    messageId,
    chatId,
    votedUserJids: new Set<string>(),
    createdAt: Date.now()
  });
}
