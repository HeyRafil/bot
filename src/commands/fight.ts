import { Command } from './index.js';
import localDb from '../database/localDb.js';
import logger from '../utils/logger.js';
import { getSerializedId } from '../utils/chatHelper.js';

declare let window: any;

// Cooldown map: senderId -> timestamp
const fightCooldowns = new Map<string, number>();

interface Skill {
  name: string;
  minDmg: number;
  maxDmg: number;
  mana: number;
}

const SKILLS: Skill[] = [
  { name: '🔥 Dragon Flame', minDmg: 15, maxDmg: 25, mana: 10 },
  { name: '⚡ Petir Naga Langit', minDmg: 20, maxDmg: 30, mana: 15 },
  { name: '🌪️ Tornado Kick', minDmg: 10, maxDmg: 20, mana: 8 },
  { name: '💀 Shadow Assassin', minDmg: 18, maxDmg: 28, mana: 12 },
  { name: '☄️ Meteor Strike', minDmg: 25, maxDmg: 35, mana: 20 },
  { name: '🌊 Tsunami Slash', minDmg: 15, maxDmg: 25, mana: 10 },
  { name: '❄️ Ice Prison', minDmg: 12, maxDmg: 22, mana: 8 },
  { name: '🌋 Volcano Burst', minDmg: 22, maxDmg: 32, mana: 18 }
];

interface PlayerStats {
  name: string;
  wins: number;
  losses: number;
  totalDamage: number;
}

function cleanName(name: string): string {
  // Clean special markdown formatting chars and spaces
  return name.replace(/[@*_\`~]/g, '').trim().substring(0, 15);
}

function formatNumber(num: number): string {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

async function safeEditMessage(client: any, message: any, newText: string): Promise<boolean> {
  const msgId = message?.id?._serialized || message?.id?.$1 || getSerializedId(message?.id);
  if (!msgId) {
    logger.warn(`[fight.ts] safeEditMessage: invalid message object passed.`);
    return false;
  }
  try {
    if (!client.pupPage) {
      logger.warn(`[fight.ts] safeEditMessage failed: client.pupPage is undefined`);
      return false;
    }
    
    const evaluatePromise = client.pupPage.evaluate(async (targetId: string, text: string) => {
      const report = { success: false, step: 'start', details: '', error: '' };
      try {
        const store = (window as any).Store;
        if (!store) {
          report.error = 'window.Store is undefined';
          return report;
        }
        
        let msg = null;
        if (store.Msg) {
          msg = store.Msg.get(targetId);
          if (msg) report.details += 'Found in Store.Msg. ';
        }
        
        if (!msg) {
          try {
            const collections = (window as any).require('WAWebCollections');
            if (collections && collections.Msg) {
              msg = collections.Msg.get(targetId);
              if (msg) report.details += 'Found in WAWebCollections.Msg. ';
            }
          } catch (e: any) {
            report.details += `WAWebCollections failed: ${e.message}. `;
          }
        }
        
        if (!msg) {
          report.details += 'Msg not found, starting retry loop. ';
          for (let i = 0; i < 10; i++) {
            await new Promise(resolve => setTimeout(resolve, 100));
            if (store.Msg) {
              msg = store.Msg.get(targetId);
            }
            if (!msg) {
              try {
                const collections = (window as any).require('WAWebCollections');
                if (collections && collections.Msg) {
                  msg = collections.Msg.get(targetId);
                }
              } catch (_) {}
            }
            if (msg) {
              report.details += `Found in retry loop at step ${i}. `;
              break;
            }
          }
        }
        
        if (!msg) {
          try {
            const collections = (window as any).require('WAWebCollections');
            if (collections && collections.Msg) {
              const res = await collections.Msg.getMessagesById([targetId]);
              msg = res && res.messages ? res.messages[0] : null;
              if (msg) report.details += 'Found via getMessagesById. ';
            }
          } catch (e: any) {
            report.details += `getMessagesById failed: ${e.message}. `;
          }
        }
        
        if (!msg) {
          report.error = 'Message not found in any store/database after all retries';
          return report;
        }
        
        report.step = 'edit_execution';
        if ((window as any).WWebJS && typeof (window as any).WWebJS.editMessage === 'function') {
          try {
            await (window as any).WWebJS.editMessage(msg, text);
            report.success = true;
            report.details += 'Edited via WWebJS.editMessage successfully.';
            return report;
          } catch (e: any) {
            report.details += `WWebJS.editMessage failed: ${e.message}. `;
          }
        }
        
        try {
          const editAction = (window as any).require('WAWebSendMessageEditAction');
          if (editAction && typeof editAction.sendMessageEdit === 'function') {
            await editAction.sendMessageEdit(msg, text);
            report.success = true;
            report.details += 'Edited via WAWebSendMessageEditAction successfully.';
            return report;
          }
        } catch (e: any) {
          report.details += `WAWebSendMessageEditAction failed: ${e.message}. `;
        }
        
        if (store.EditMessage) {
          try {
            if (typeof store.EditMessage.sendMessageEdit === 'function') {
              await store.EditMessage.sendMessageEdit(msg, text);
              report.success = true;
              report.details += 'Edited via Store.EditMessage.sendMessageEdit.';
              return report;
            } else if (typeof store.EditMessage.editMessage === 'function') {
              await store.EditMessage.editMessage(msg, text);
              report.success = true;
              report.details += 'Edited via Store.EditMessage.editMessage.';
              return report;
            }
          } catch (e: any) {
            report.details += `Store.EditMessage failed: ${e.message}. `;
          }
        }
        
        for (const key in store) {
          if (store[key]) {
            try {
              if (typeof store[key].sendMessageEdit === 'function') {
                await store[key].sendMessageEdit(msg, text);
                report.success = true;
                report.details += `Edited via store[${key}].sendMessageEdit.`;
                return report;
              } else if (typeof store[key].editMessage === 'function') {
                await store[key].editMessage(msg, text);
                report.success = true;
                report.details += `Edited via store[${key}].editMessage.`;
                return report;
              }
            } catch (_) {}
          }
        }
        
        report.error = 'No edit message function succeeded';
      } catch (e: any) {
        report.error = `Outer evaluate error: ${e.message}`;
      }
      return report;
    }, msgId, newText);
    
    const timeoutPromise = new Promise<any>((_, reject) => 
      setTimeout(() => reject(new Error('Puppeteer evaluation timeout')), 5000)
    );
    
    const diag: any = await Promise.race([evaluatePromise, timeoutPromise]);
    logger.info(`[fight.ts] safeEditMessage result for ${msgId}: success = ${diag.success}, error = ${diag.error}`);
    return diag.success;
  } catch (err: any) {
    logger.error(`[fight.ts] safeEditMessage outer catch failed for ${msgId}: ${err.message}`);
  }
  return false;
}

async function saveFightResult(
  winner: string,
  loser: string,
  p1Name: string,
  p2Name: string,
  p1Dmg: number,
  p2Dmg: number
) {
  try {
    const players = await localDb.getCollection('fight_players', []);
    
    const getOrInitPlayer = (name: string): PlayerStats => {
      let p = players.find((x: any) => x.name.toLowerCase() === name.toLowerCase());
      if (!p) {
        p = { name, wins: 0, losses: 0, totalDamage: 0 };
        players.push(p);
      }
      return p;
    };
    
    const wObj = getOrInitPlayer(winner);
    wObj.wins += 1;
    
    const lObj = getOrInitPlayer(loser);
    lObj.losses += 1;
    
    const p1Obj = getOrInitPlayer(p1Name);
    p1Obj.totalDamage += p1Dmg;
    
    const p2Obj = getOrInitPlayer(p2Name);
    p2Obj.totalDamage += p2Dmg;
    
    await localDb.saveCollection('fight_players', players);
    logger.info(`[fight.ts] Fight stats saved successfully for ${p1Name} and ${p2Name}`);
  } catch (err: any) {
    logger.error(`[fight.ts] Failed to save fight stats: ${err.message}`);
  }
}

export const fightCommand: Command = {
  name: 'fight',
  aliases: ['tarung'],
  roleRequired: 'Member',
  description: 'Memulai pertarungan RPG PvP interaktif antara 2 pemain.',
  async execute(client, msg, chat, args, privileges) {
    const senderId = msg.author || msg.from;
    
    // 1. Cooldown Check (30 seconds per user, bypass for Owner)
    if (!privileges.isOwner) {
      const lastFight = fightCooldowns.get(senderId) || 0;
      const cooldownMs = 30000;
      if (Date.now() - lastFight < cooldownMs) {
        const remainingSec = Math.ceil((cooldownMs - (Date.now() - lastFight)) / 1000);
        return msg.reply(`⚠️ Perintah cooldown! Harap tunggu *${remainingSec}* detik sebelum memulai pertarungan baru.`);
      }
      fightCooldowns.set(senderId, Date.now());
    }

    // 2. Leaderboard Check
    if (args[0]?.toLowerCase() === 'leaderboard' || args[0]?.toLowerCase() === 'leader') {
      try {
        const players = await localDb.getCollection('fight_players', []);
        if (!players || players.length === 0) {
          return msg.reply(`🏆 *LEADERBOARD FIGHT ARENA* 🏆\n\nBelum ada statistik pertarungan tercatat.`);
        }
        
        // Sort: Wins desc, then TotalDamage desc
        const sorted = [...players].sort((a: PlayerStats, b: PlayerStats) => {
          if (b.wins !== a.wins) return b.wins - a.wins;
          return b.totalDamage - a.totalDamage;
        });

        let lbText = `🏆 *LEADERBOARD FIGHT ARENA* 🏆\n\n`;
        sorted.slice(0, 10).forEach((p: PlayerStats, idx: number) => {
          lbText += `${idx + 1}. *${p.name}* - 🏆 ${p.wins} Menang | 💀 ${p.losses} Kalah | 💥 ${formatNumber(p.totalDamage)} DMG\n`;
        });
        
        return msg.reply(lbText);
      } catch (err: any) {
        logger.error(`[fight.ts] Leaderboard retrieval failed: ${err.message}`);
        return msg.reply(`❌ Terjadi kesalahan saat memuat leaderboard.`);
      }
    }

    // 3. Command Argument validation
    if (args.length < 2) {
      return msg.reply(`⚠️ Format salah! Gunakan:\n*contoh:* \`.fight Andi Budi\`\n*atau:* \`.fight leaderboard\` untuk papan peringkat.`);
    }

    const player1Name = cleanName(args[0]) || 'Player 1';
    const player2Name = cleanName(args[1]) || 'Player 2';

    if (player1Name.toLowerCase() === player2Name.toLowerCase()) {
      return msg.reply(`⚠️ Pemain tidak boleh bertarung dengan dirinya sendiri!`);
    }

    // 4. Initial Stats
    let p1Hp = 100;
    let p2Hp = 100;
    let p1Mana = 50;
    let p2Mana = 50;
    let round = 1;
    let p1DmgDealt = 0;
    let p2DmgDealt = 0;
    const logs: string[] = ['* Pertarungan dimulai!'];

    // Send first message
    let battleText = `⚔️ *FIGHT ARENA* ⚔️\n\n`;
    battleText += `🥷 *${player1Name}*\n❤️ HP: ${p1Hp}/100\n💙 Mana: ${p1Mana}/50\n\n`;
    battleText += `VS\n\n`;
    battleText += `🥷 *${player2Name}*\n❤️ HP: ${p2Hp}/100\n💙 Mana: ${p2Mana}/50\n\n`;
    battleText += `━━━━━━━━━━\n\n`;
    battleText += `*Status:* Pertarungan Dimulai!\n`;

    let sentMsg: any;
    try {
      sentMsg = await chat.sendMessage(battleText);
      if (!sentMsg) {
        // Fallback: fetch last messages to find the one we just sent
        await new Promise(resolve => setTimeout(resolve, 200));
        const messages = await chat.fetchMessages({ limit: 10 });
        sentMsg = messages.reverse().find((m: any) => m.fromMe || (m.id && m.id.fromMe));
      }
      
      if (sentMsg) {
        if (sentMsg.id && !sentMsg.id._serialized) {
          sentMsg.id._serialized = sentMsg.id.$1 || getSerializedId(sentMsg.id);
        }
      }
    } catch (err: any) {
      logger.error(`[fight.ts] Failed to send initial fight message: ${err.message}`);
      return msg.reply(`❌ Gagal memulai arena pertarungan.`);
    }

    if (!sentMsg || !sentMsg.id || (!sentMsg.id._serialized && !sentMsg.id.$1)) {
      logger.error(`[fight.ts] Could not find or serialize the sent message.`);
      return msg.reply(`❌ Gagal menindaklanjuti pesan pertarungan.`);
    }

    // 5. Game Loop
    let currentAttacker = Math.random() < 0.5 ? 1 : 2; // Random starter

    const runGame = async () => {
      while (p1Hp > 0 && p2Hp > 0) {
        await new Promise(resolve => setTimeout(resolve, 1500)); // 1.5 second delay per round

        const attackerName = currentAttacker === 1 ? player1Name : player2Name;
        const defenderName = currentAttacker === 1 ? player2Name : player1Name;
        const attackerMana = currentAttacker === 1 ? p1Mana : p2Mana;

        // Select skill
        const usableSkills = SKILLS.filter(s => s.mana <= attackerMana);
        let skillName = 'Serangan Biasa';
        let damage = Math.floor(Math.random() * (10 - 5 + 1)) + 5; // 5-10 DMG
        let usedMana = 0;

        // 80% chance to use skill if mana is available
        if (usableSkills.length > 0 && Math.random() < 0.8) {
          const selectedSkill = usableSkills[Math.floor(Math.random() * usableSkills.length)];
          skillName = selectedSkill.name;
          damage = Math.floor(Math.random() * (selectedSkill.maxDmg - selectedSkill.minDmg + 1)) + selectedSkill.minDmg;
          usedMana = selectedSkill.mana;

          // Deduct mana
          if (currentAttacker === 1) {
            p1Mana -= usedMana;
          } else {
            p2Mana -= usedMana;
          }
        }

        // Critical Hit logic (15% chance, damage x2)
        let isCritical = false;
        if (damage > 0 && Math.random() < 0.15) {
          isCritical = true;
          damage *= 2;
        }

        // Dodge logic (10% chance, damage = 0)
        let isDodged = false;
        if (damage > 0 && Math.random() < 0.10) {
          isDodged = true;
          damage = 0;
        }

        // Apply damage & track total damage dealt
        if (currentAttacker === 1) {
          p2Hp = Math.max(0, p2Hp - damage);
          p1DmgDealt += damage;
        } else {
          p1Hp = Math.max(0, p1Hp - damage);
          p2DmgDealt += damage;
        }

        // Log entry styling
        let logEntry = '';
        if (isDodged) {
          logEntry = `* ${attackerName} menggunakan ${skillName}, tetapi 🌀 *SERANGAN DIHINDARI!*`;
        } else if (isCritical) {
          logEntry = `* ${attackerName} menggunakan ${skillName} dan memberikan 💥 *CRITICAL HIT!* (${damage} DMG)`;
        } else {
          logEntry = `* ${attackerName} menyerang ${defenderName} menggunakan ${skillName} (${damage} DMG)`;
        }

        logs.push(logEntry);
        if (logs.length > 2) {
          logs.shift(); // Keep only last 2 logs like the specification example
        }

        // Construct updated fight status text
        let arenaText = `⚔️ *FIGHT ARENA* ⚔️\n\n`;
        arenaText += `🥷 *${player1Name}*\n❤️ HP: ${p1Hp}/100\n💙 Mana: ${p1Mana}/50\n\n`;
        arenaText += `VS\n\n`;
        arenaText += `🥷 *${player2Name}*\n❤️ HP: ${p2Hp}/100\n💙 Mana: ${p2Mana}/50\n\n`;
        arenaText += `━━━━━━━━━━\n\n`;
        arenaText += `*ROUND ${round}*\n\n`;
        arenaText += `${currentAttacker === 1 ? '⚡' : '🔥'} *${attackerName}* menggunakan:\n`;
        arenaText += `_${skillName}_\n\n`;
        if (isDodged) {
          arenaText += `🌀 *SERANGAN DIHINDARI!*\n\n`;
        } else if (isCritical) {
          arenaText += `💥 *Damage:* ${damage} (CRITICAL HIT!)\n\n`;
        } else {
          arenaText += `💥 *Damage:* ${damage}\n\n`;
        }
        arenaText += `📜 *Log:* \n${logs.join('\n')}\n`;
        arenaText += `━━━━━━━━━━`;

        const isEdited = await safeEditMessage(client, sentMsg, arenaText);
        if (!isEdited && typeof sentMsg.edit === 'function') {
          try {
            await sentMsg.edit(arenaText);
          } catch (editErr: any) {
            if (!editErr.message || !editErr.message.includes('serialize')) {
              logger.error(`[fight.ts] Both safeEditMessage and sentMsg.edit failed: ${editErr.message}`);
            }
          }
        }

        // Switch turn
        currentAttacker = currentAttacker === 1 ? 2 : 1;
        round++;
      }

      // 6. Game Over Screen
      const winnerName = p1Hp > 0 ? player1Name : player2Name;
      const loserName = p1Hp > 0 ? player2Name : player1Name;

      let resultText = `🏆 *HASIL PERTARUNGAN* 🏆\n\n`;
      resultText += `🥷 *${player1Name}*\n❤️ HP: ${p1Hp}/100\n\n`;
      resultText += `🥷 *${player2Name}*\n❤️ HP: ${p2Hp}/100\n\n`;
      resultText += `💀 *${loserName} tumbang!*\n\n`;
      resultText += `👑 *PEMENANG:* \n*${winnerName.toUpperCase()}*\n\n`;
      resultText += `💰 *Reward:* 500 Gold\n`;
      resultText += `⭐ *EXP:* +150`;

      const isFinalEdited = await safeEditMessage(client, sentMsg, resultText);
      if (!isFinalEdited && typeof sentMsg.edit === 'function') {
        try {
          await sentMsg.edit(resultText);
        } catch (editErr: any) {
          if (!editErr.message || !editErr.message.includes('serialize')) {
            logger.error(`[fight.ts] Both safeEditMessage and sentMsg.edit final failed: ${editErr.message}`);
          }
        }
      }

      // Save statistics to DB
      await saveFightResult(winnerName, loserName, player1Name, player2Name, p1DmgDealt, p2DmgDealt);
    };

    // Run game in background so execution finishes quickly for command router
    runGame().catch(err => {
      logger.error(`[fight.ts] Game loop error: ${err.message}`);
    });
  }
};

export default fightCommand;
