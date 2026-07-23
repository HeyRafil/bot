import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { Client, Message, Chat } from 'whatsapp-web.js';
import { UserPrivileges, RoleLevel } from '../utils/rbac.js';
import logger from '../utils/logger.js';
import prisma from '../database/prisma.js';
import { getSetting } from '../config/settings.js';
import { checkAndResetWeeklyScores } from '../utils/leaderboardReset.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface Command {
  name: string;
  aliases?: string[];
  roleRequired: 'Owner' | 'Super Admin' | 'Admin' | 'Moderator' | 'Member';
  description?: string;
  execute: (
    client: Client,
    msg: Message,
    chat: Chat,
    args: string[],
    privileges: UserPrivileges
  ) => Promise<any>;
}

const commands = new Map<string, Command>();
const aliases = new Map<string, string>();

/**
 * Returns role priority level for validation
 */
function getRolePriority(role: string): number {
  switch (role) {
    case 'Owner': return RoleLevel.OWNER;
    case 'Super Admin': return RoleLevel.SUPER_ADMIN;
    case 'Admin': return RoleLevel.ADMIN;
    case 'Moderator': return RoleLevel.MODERATOR;
    case 'Member': return RoleLevel.MEMBER;
    default: return RoleLevel.MEMBER;
  }
}

/**
 * Dynamically loads all commands from the commands directory
 */
export async function loadCommands(): Promise<void> {
  commands.clear();
  aliases.clear();

  const commandFiles = fs.readdirSync(__dirname).filter(file => 
    (file.endsWith('.ts') || file.endsWith('.js')) && file !== 'index.ts' && file !== 'index.js'
  );

  logger.info(`Found ${commandFiles.length} command files. Loading...`);

  for (const file of commandFiles) {
    try {
      const filePath = path.join(__dirname, file);
      const fileUrl = pathToFileURL(filePath).href;
      
      const module = await import(fileUrl);
      const command: Command = module.default || Object.values(module)[0] as Command;
      
      if (command && command.name && typeof command.execute === 'function') {
        commands.set(command.name.toLowerCase(), command);
        logger.info(`Loaded command: .${command.name}`);
        
        if (command.aliases && Array.isArray(command.aliases)) {
          for (const alias of command.aliases) {
            aliases.set(alias.toLowerCase(), command.name.toLowerCase());
          }
        }
      } else {
        logger.warn(`Skipped invalid command file: ${file}`);
      }
    } catch (err: any) {
      logger.error(`Failed to load command file ${file}`, err);
    }
  }

  logger.info(`Total commands loaded: ${commands.size} (${aliases.size} aliases)`);
}

/**
 * Command Router / Executor
 */
export async function executeCommand(
  client: Client,
  msg: Message,
  chat: Chat,
  commandName: string,
  args: string[],
  privileges: UserPrivileges
): Promise<any> {
  // Check and run weekly quiz leaderboard reset
  await checkAndResetWeeklyScores();

  const normalizedCommandName = commandName.toLowerCase();
  
  // Resolve alias
  const targetCommandName = aliases.get(normalizedCommandName) || normalizedCommandName;
  const command = commands.get(targetCommandName);

  if (!command) {
    const prefix = await getSetting('PREFIX') || '.';
    return msg.reply(`❌ Perintah *${prefix}${commandName}* tidak ditemukan. Ketik *${prefix}menu* untuk melihat panduan.`);
  }



  // Permission validation
  const requiredLevel = getRolePriority(command.roleRequired);
  const userLevel = privileges.level;

  if (userLevel < requiredLevel) {
    return msg.reply(`❌ Perintah ini hanya dapat digunakan oleh pengguna dengan tingkatan minimum: *${command.roleRequired}*.`);
  }

  // Execute command
  try {
    // 1. Log command execution to console/file
    logger.info(`Executing command .${command.name} for user ${msg.author || msg.from} in chat ${chat.name || chat.id._serialized}`);

    // Try to react with wait emoji (async to prevent blocking)
    msg.react('⏳').catch(reactErr => {
      logger.warn(`Failed to react ⏳ to message`, reactErr);
    });

    // 2. Execute
    await command.execute(client, msg, chat, args, privileges);

    // Try to react with success emoji (async to prevent blocking)
    msg.react('✅').catch(reactErr => {
      logger.warn(`Failed to react ✅ to message`, reactErr);
    });

    // 3. Log to Prisma Database for dashboard stats
    try {
      const dbCommand = await prisma.command.upsert({
        where: { name: command.name },
        update: { useCount: { increment: 1 } },
        create: {
          name: command.name,
          description: command.description || ''
        }
      });

      await prisma.commandLog.create({
        data: {
          commandId: dbCommand.id,
          groupId: chat.isGroup ? chat.id._serialized : null,
          whatsappId: msg.author || msg.from,
          status: 'success'
        }
      });
    } catch (dbErr: any) {
      logger.warn(`Failed to log command execution to DB`, dbErr);
    }

  } catch (err: any) {
    logger.error(`Error executing command .${command.name}`, err);
    await msg.reply(`❌ Terjadi kesalahan internal saat mengeksekusi perintah .${command.name}`);
    
    // Try to react with error emoji
    try {
      await msg.react('❌');
    } catch (reactErr) {
      logger.warn(`Failed to react ❌ to message`, reactErr);
    }
    
    // Log failure to database
    try {
      const dbCommand = await prisma.command.upsert({
        where: { name: command.name },
        update: {},
        create: {
          name: command.name,
          description: command.description || ''
        }
      });

      await prisma.commandLog.create({
        data: {
          commandId: dbCommand.id,
          groupId: chat.isGroup ? chat.id._serialized : null,
          whatsappId: msg.author || msg.from,
          status: 'failed',
          errorMsg: err.message || 'Unknown error'
        }
      });
    } catch (_) {}
  }
}
