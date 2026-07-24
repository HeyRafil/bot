import { Command } from './index.js';
import logger from '../utils/logger.js';

declare let window: any;

export const debugMsgCommand: Command = {
  name: 'debug_msg',
  roleRequired: 'Member',
  description: 'Query message attributes in browser database.',
  async execute(client, msg, chat, args, privileges) {
    try {
      if (!client.pupPage) {
        return msg.reply('❌ pupPage is not available.');
      }
      
      const targetId = args[0] || 'true_120363426777400461@g.us_3EB00C029E99A25D35AB7B_144758164996106@lid';
      
      const result = await client.pupPage.evaluate(async (serializedId: string) => {
        try {
          const collections = window.require('WAWebCollections');
          if (!collections || !collections.Msg) return { error: "No Msg collection found" };
          
          const msgModel = collections.Msg.get(serializedId);
          if (!msgModel) return { error: "Message model not found" };
          
          // Get all attributes of the backbone model
          const attributes = msgModel.attributes || {};
          
          // Also let's check getPollVotes if available on the model
          let modelVotes = null;
          if (typeof msgModel.getPollVotes === 'function') {
            modelVotes = await msgModel.getPollVotes();
          }
          
          // Let's filter attributes to make it JSON serializable safely
          const cleanAttrs: any = {};
          Object.keys(attributes).forEach(k => {
            const val = attributes[k];
            if (val !== null && val !== undefined) {
              if (typeof val === 'object') {
                cleanAttrs[k] = {
                  constructor: val.constructor ? val.constructor.name : 'Object',
                  keys: Object.keys(val).slice(0, 10)
                };
                if (val.constructor && (val.constructor.name === 'Object' || val.constructor.name === 'Array')) {
                  try {
                    cleanAttrs[k].json = JSON.stringify(val);
                  } catch (_) {}
                }
              } else {
                cleanAttrs[k] = val;
              }
            }
          });
          
          return {
            success: true,
            attributes: cleanAttrs,
            hasGetPollVotes: typeof msgModel.getPollVotes === 'function',
            modelVotes
          };
        } catch (err: any) {
          return {
            success: false,
            error: err.message || err.toString()
          };
        }
      }, targetId);
      
      if (!result.success) {
        return msg.reply(`❌ Error: ${result.error}`);
      }
      
      return msg.reply(`📝 *Message Attributes*:\n\n${JSON.stringify(result.attributes, null, 2).substring(0, 1500)}\n\nGetPollVotes: ${result.hasGetPollVotes}, Votes: ${JSON.stringify(result.modelVotes)}`);
    } catch (err: any) {
      logger.error(`Error running debug_msg command: ${err.message}`);
      return msg.reply(`❌ Error: ${err.message}`);
    }
  }
};

export default debugMsgCommand;
