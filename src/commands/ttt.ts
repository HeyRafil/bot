import { Command } from './index.js';
import { activeGroupGames, tttGames, TttGame } from '../server.js';
import { getActiveTunnelUrl } from '../utils/tunnel.js';
import os from 'os';

export const tttCommand: Command = {
  name: 'ttt',
  aliases: ['tictactoe', 'game-ttt'],
  roleRequired: 'Member',
  description: 'Memulai permainan interaktif Tic Tac Toe 1 vs 1 menggunakan link VPS.',
  async execute(client, msg, chat, args, privileges) {
    if (!chat.isGroup) {
      return msg.reply('❌ Perintah ini hanya dapat dilakukan di dalam grup untuk bermain bersama anggota lain.');
    }

    const groupId = chat.id._serialized;

    // 1. Check if there is already an active game in this group
    const activeRoomId = activeGroupGames.get(groupId);
    if (activeRoomId) {
      const game = tttGames.get(activeRoomId);
      if (game && game.status !== 'finished') {
        const port = process.env.BACKEND_PORT || 5000;
        
        // Find local/external IP
        const networkInterfaces = os.networkInterfaces();
        let localIp = 'localhost';
        for (const devName in networkInterfaces) {
          const iface = networkInterfaces[devName];
          if (iface) {
            for (const alias of iface) {
              if (alias.family === 'IPv4' && !alias.internal) {
                localIp = alias.address;
                break;
              }
            }
          }
        }
        const tunnelUrl = getActiveTunnelUrl();
        const hostUrl = tunnelUrl || process.env.PUBLIC_URL || `http://${localIp}:${port}`;
        
        return msg.reply(`❌ *Game sedang dimulai!* Silakan selesaikan permainan yang sedang berjalan terlebih dahulu.\n\n🔗 *Link Permainan:* ${hostUrl}/game/ttt/${activeRoomId}`);
      }
    }

    // 2. Generate a unique Room ID
    const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();

    // 3. Create TTT Game Room
    const newGame: TttGame = {
      roomId,
      groupId,
      players: [],
      board: Array(9).fill(null),
      currentTurn: 'X',
      status: 'waiting',
      winner: null
    };

    tttGames.set(roomId, newGame);
    activeGroupGames.set(groupId, roomId);

    // 4. Resolve VPS IP Address dynamically
    const networkInterfaces = os.networkInterfaces();
    let ipAddress = 'localhost';
    for (const devName in networkInterfaces) {
      const iface = networkInterfaces[devName];
      if (iface) {
        for (const alias of iface) {
          if (alias.family === 'IPv4' && !alias.internal) {
            ipAddress = alias.address;
            break;
          }
        }
      }
    }

    const port = process.env.BACKEND_PORT || 5000;
    const tunnelUrl = getActiveTunnelUrl();
    const hostUrl = tunnelUrl || process.env.PUBLIC_URL || `http://${ipAddress}:${port}`;
    const playUrl = `${hostUrl}/game/ttt/${roomId}`;

    // 5. Send Invite Message to Group
    let response = `🎮 *ARENA GAME: TIC TAC TOE* 🎮\n`;
    response += `──────────────────\n\n`;
    response += `Sebuah ruang game 1 VS 1 baru saja dibuat untuk grup ini!\n\n`;
    response += `👉 *Link Bermain:*\n${playUrl}\n\n`;
    response += `Silakan masuk ke tautan di atas untuk bermain. Orang pertama yang masuk akan mendapatkan simbol *X* (jalan duluan), dan orang kedua mendapatkan simbol *O*.\n\n`;
    response += `📢 *Info:* Hasil akhir pertandingan akan langsung dikirimkan ke grup ini saat permainan selesai!`;

    await chat.sendMessage(response);
  }
};

export default tttCommand;
