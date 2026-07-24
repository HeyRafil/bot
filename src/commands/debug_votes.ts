import { Command } from './index.js';
import logger from '../utils/logger.js';

declare let window: any;

export const debugVotesCommand: Command = {
  name: 'debug_votes',
  roleRequired: 'Member',
  description: 'Query all poll votes in browser database.',
  async execute(client, msg, chat, args, privileges) {
    try {
      if (!client.pupPage) {
        return msg.reply('❌ pupPage is not available.');
      }
      
      const dbResult = await client.pupPage.evaluate(async () => {
        try {
          const results: any = {};
          
          // 1. Query WAWebPollsVotesSchema table
          try {
            const table = window.require('WAWebPollsVotesSchema').getTable();
            const allVotes = await table.all();
            results.dbVotes = allVotes.map((item: any) => {
              const typedArray = new Uint8Array(item.selectedOptionLocalIds || []);
              const rawSender = item.sender || item.author;
              const voterJid = typeof rawSender === 'object' && rawSender ? (rawSender._serialized || rawSender.toString()) : rawSender;
              return {
                id: item.id,
                parentMsgKey: item.parentMsgKey,
                sender: voterJid,
                selectedOptionLocalIds: Array.from(typedArray),
                t: item.t
              };
            });
          } catch (e: any) {
            results.dbError = e.message || e.toString();
          }
          
          // 2. Query WAWebCollections.PollVote
          try {
            const collections = window.require('WAWebCollections');
            if (collections && collections.PollVote) {
              const models = collections.PollVote.toArray ? collections.PollVote.toArray() : [];
              results.collectionVotes = models.map((m: any) => {
                const attrs = m.attributes || {};
                const typedArray = new Uint8Array(attrs.selectedOptionLocalIds || []);
                const rawSender = attrs.sender || attrs.author;
                const voterJid = typeof rawSender === 'object' && rawSender ? (rawSender._serialized || rawSender.toString()) : rawSender;
                return {
                  id: m.id?._serialized || m.id || attrs.id,
                  parentMsgKey: attrs.parentMsgKey || attrs.pollUpdateParentKey,
                  sender: voterJid,
                  selectedOptionLocalIds: Array.from(typedArray)
                };
              });
            } else {
              results.collectionError = "PollVote collection not found";
            }
          } catch (e: any) {
            results.collectionError = e.message || e.toString();
          }
          
          return { success: true, results };
        } catch (err: any) {
          return {
            success: false,
            error: err.message || err.toString()
          };
        }
      });
      
      if (!dbResult.success) {
        return msg.reply(`❌ Failed to query votes: ${dbResult.error}`);
      }
      
      const res = dbResult.results;
      let text = `📊 *POLL VOTES DEBUG*:\n\n`;
      
      text += `*1. Database Table (${res.dbVotes ? res.dbVotes.length : 0} records)*:\n`;
      if (res.dbError) {
        text += `Error: ${res.dbError}\n`;
      } else if (res.dbVotes && res.dbVotes.length > 0) {
        text += res.dbVotes.map((r: any) => {
          return `- Parent: ${r.parentMsgKey}\n  Sender: ${r.sender}\n  Options: ${JSON.stringify(r.selectedOptionLocalIds)}`;
        }).join('\n') + '\n';
      } else {
        text += `No records found.\n`;
      }
      
      text += `\n*2. Memory Collection (${res.collectionVotes ? res.collectionVotes.length : 0} records)*:\n`;
      if (res.collectionError) {
        text += `Error: ${res.collectionError}\n`;
      } else if (res.collectionVotes && res.collectionVotes.length > 0) {
        text += res.collectionVotes.map((r: any) => {
          return `- Parent: ${r.parentMsgKey}\n  Sender: ${r.sender}\n  Options: ${JSON.stringify(r.selectedOptionLocalIds)}`;
        }).join('\n') + '\n';
      } else {
        text += `No records found.\n`;
      }
      
      return msg.reply(text.substring(0, 1900));
    } catch (err: any) {
      logger.error(`Error running debug_votes command: ${err.message}`);
      return msg.reply(`❌ Error: ${err.message}`);
    }
  }
};

export default debugVotesCommand;
