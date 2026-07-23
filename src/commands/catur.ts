import { Command } from './index.js';
import { Chess } from 'chess.js';
import axios from 'axios';
import pkg from 'whatsapp-web.js';
const { MessageMedia } = pkg;
import type { MessageMedia as MessageMediaType } from 'whatsapp-web.js';
import logger from '../utils/logger.js';
import { getActiveTunnelUrl } from '../utils/tunnel.js';

interface ChessSession {
  groupId: string;
  chess: Chess;
  whiteJid: string;
  whiteName: string;
  blackJid: string;
  blackName: string;
  isVsAi: boolean;
  lastActive: number;
  lastMsg?: any;
}

export const activeChessGames = new Map<string, ChessSession>();

// Rate legal moves for local heuristic AI
export function getBestMoveForAi(chess: Chess): string {
  const moves = chess.moves({ verbose: true });
  if (moves.length === 0) return '';

  let bestMove = moves[0];
  let bestScore = -Infinity;

  const pieceValues: { [key: string]: number } = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };

  for (const move of moves) {
    let score = 0;

    // 1. Capture bonus
    if (move.captured) {
      score += (pieceValues[move.captured] || 0) * 10;
      // Subtract moving piece value if it is captured to avoid trade-offs unless it is good
      score -= (pieceValues[move.piece] || 0);
    }

    // 2. Promotion bonus
    if (move.promotion) {
      score += 800;
    }

    // 3. Check bonus
    const testChess = new Chess(chess.fen());
    testChess.move(move.san);
    if (testChess.inCheck()) {
      score += 50;
    }
    if (testChess.isCheckmate()) {
      score += 100000; // Checkmate is the ultimate goal
    }

    // 4. Center control bonus (d4, e4, d5, e5)
    if (['d4', 'e4', 'd5', 'e5'].includes(move.to)) {
      score += 20;
    }

    // 5. Prefer castling for safety
    if (move.san === 'O-O' || move.san === 'O-O-O') {
      score += 40;
    }

    // 6. Add small randomness to make games unique
    score += Math.random() * 15;

    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }

  return bestMove.san;
}

async function getChessBoardMedia(fen: string): Promise<MessageMediaType | null> {
  const cleanFen = fen.split(' ')[0];
  // Using public chessboardimage API
  const url = `https://chessboardimage.com/${cleanFen}.png`;
  
  try {
    const response = await axios.get(url, { 
      responseType: 'arraybuffer',
      timeout: 10000
    });
    const base64 = Buffer.from(response.data, 'binary').toString('base64');
    return new MessageMedia('image/png', base64, 'catur.png');
  } catch (err) {
    logger.error('Failed to download chess board image:', err);
    return null;
  }
}

function getChessBoardText(chess: Chess): string {
  const board = chess.board();
  let text = '  ┌───┬───┬───┬───┬───┬───┬───┬───┐\n';
  const rows = ['8', '7', '6', '5', '4', '3', '2', '1'];
  
  for (let r = 0; r < 8; r++) {
    text += `${rows[r]} │`;
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (!piece) {
        text += (r + c) % 2 === 0 ? ' ░░ ' : '    ';
      } else {
        const symbol = getPieceSymbol(piece.type, piece.color);
        text += ` ${symbol}  `;
      }
      text += '│';
    }
    text += '\n  ├───┼───┼───┼───┼───┼───┼───┼───┤\n';
  }
  // Remove last row divider
  text = text.substring(0, text.length - 38);
  text += '  └───┴───┴───┴───┴───┴───┴───┴───┘\n';
  text += '    a   b   c   d   e   f   g   h\n';
  return text;
}

function getPieceSymbol(type: string, color: string): string {
  const symbols: { [key: string]: { [key: string]: string } } = {
    p: { w: '♙', b: '♟' },
    n: { w: '♘', b: '♞' },
    b: { w: '♗', b: '♝' },
    r: { w: '♖', b: '♜' },
    q: { w: '♕', b: '♛' },
    k: { w: '♔', b: '♚' }
  };
  return symbols[type]?.[color] || '?';
}

export const caturCommand: Command = {
  name: 'catur',
  aliases: ['chess'],
  roleRequired: 'Member',
  description: 'Memulai permainan catur kelompok atau catur melawan AI.',
  async execute(client, msg, chat, args, privileges) {
    const groupId = chat.id._serialized;
    const senderJid = msg.author || msg.from;
    const senderName = (msg as any)._data?.notifyName || senderJid.split('@')[0];

    const subCommand = args[0] ? args[0].toLowerCase() : '';

    // Handle game commands
    if (subCommand === 'menyerah' || subCommand === 'surrender') {
      const session = activeChessGames.get(groupId);
      if (!session) {
        return msg.reply('❌ Tidak ada permainan catur yang sedang berlangsung di grup ini.');
      }
      if (senderJid !== session.whiteJid && senderJid !== session.blackJid) {
        return msg.reply('❌ Anda bukan pemain dalam sesi catur ini!');
      }

      const winnerName = senderJid === session.whiteJid ? session.blackName : session.whiteName;
      activeChessGames.delete(groupId);
      return chat.sendMessage(`🏳️ *PERMAINAN SELESAI* 🏳️\n\n@${senderJid.split('@')[0]} telah menyerah! Selamat kepada *${winnerName}* atas kemenangannya.`, { mentions: [senderJid] });
    }

    if (subCommand === 'papan' || subCommand === 'board') {
      const session = activeChessGames.get(groupId);
      if (!session) {
        return msg.reply('❌ Tidak ada permainan catur yang sedang berlangsung di grup ini.');
      }

      const currentTurn = session.chess.turn() === 'w' ? 'Putih' : 'Hitam';
      const currentTurnName = session.chess.turn() === 'w' ? session.whiteName : session.blackName;
      const turnJid = session.chess.turn() === 'w' ? session.whiteJid : session.blackJid;
      const tunnelUrl = getActiveTunnelUrl();

      let text = `🎮 *PERMAINAN CATUR SEDANG BERLANGSUNG* 🎮\n\n`;
      text += `⚪ *Putih:* ${session.whiteName}\n`;
      text += `⚫ *Hitam:* ${session.blackName}\n\n`;
      text += `👉 *Giliran:* *${currentTurn}* (${currentTurnName})\n\n`;
      text += getChessBoardText(session.chess);
      text += `\nKetik *.catur [langkah]* untuk memindahkan pion (misal: *.catur e4*).`;
      if (tunnelUrl) {
        text += `\n🔗 *Main via Web:* ${tunnelUrl}/catur/${groupId}`;
      }

      const media = await getChessBoardMedia(session.chess.fen());
      if (session.lastMsg) {
        try { await session.lastMsg.delete(true); } catch (_) {}
      }
      if (media) {
        session.lastMsg = await chat.sendMessage(media, { caption: text, mentions: [turnJid] });
      } else {
        session.lastMsg = await chat.sendMessage(text, { mentions: [turnJid] });
      }
      return;
    }

    // Start a new game
    if (subCommand === 'ai' || msg.mentionedIds.length > 0) {
      if (activeChessGames.has(groupId)) {
        return msg.reply('⚠️ Permainan catur sedang berlangsung. Selesaikan permainan tersebut terlebih dahulu atau ketik *.catur menyerah*.');
      }

      let isVsAi = false;
      let blackJid = '';
      let blackName = '';

      if (subCommand === 'ai') {
        isVsAi = true;
        blackJid = client.info.wid._serialized;
        blackName = 'Gemini AI';
      } else {
        blackJid = msg.mentionedIds[0];
        if (blackJid === senderJid) {
          return msg.reply('❌ Anda tidak bisa menantang diri sendiri!');
        }
        const contact = await client.getContactById(blackJid);
        blackName = contact.pushname || contact.name || blackJid.split('@')[0];
      }

      const chess = new Chess();
      const session: ChessSession = {
        groupId,
        chess,
        whiteJid: senderJid,
        whiteName: senderName,
        blackJid,
        blackName,
        isVsAi,
        lastActive: Date.now()
      };

      activeChessGames.set(groupId, session);

      const tunnelUrl = getActiveTunnelUrl();
      let text = `🏁 *TANTANGAN CATUR DIMULAI* 🏁\n\n`;
      text += `⚪ *Putih (White):* @${senderJid.split('@')[0]}\n`;
      text += `⚫ *Hitam (Black):* ${isVsAi ? 'Gemini AI' : `@${blackJid.split('@')[0]}`}\n\n`;
      text += `👉 *Giliran:* *Putih* (Ketik *.catur [langkah]*, contoh: *.catur e4*)\n`;
      if (tunnelUrl) {
        text += `🔗 *Main via Web:* ${tunnelUrl}/catur/${groupId}\n`;
      }

      const mentions = isVsAi ? [senderJid] : [senderJid, blackJid];
      const media = await getChessBoardMedia(chess.fen());
      if (media) {
        session.lastMsg = await chat.sendMessage(media, { caption: text, mentions });
      } else {
        session.lastMsg = await chat.sendMessage(text + '\n\n' + getChessBoardText(chess), { mentions });
      }
      return;
    }

    // Play a move
    const session = activeChessGames.get(groupId);
    if (!session) {
      let help = `🎮 *PANDUAN CATUR MODERN* 🎮\n\n`;
      help += `*Cara Memulai:*\n`;
      help += `👉 *.catur @tag* - Menantang anggota grup\n`;
      help += `👉 *.catur ai* - Menantang bot (AI)\n\n`;
      help += `*Cara Bermain (Setelah Bermula):*\n`;
      help += `👉 *.catur [langkah]* - Memindahkan pion (Notasi Aljabar / Koordinat)\n`;
      help += `   *Contoh:* \`.catur e4\`, \`.catur Nf3\`, \`.catur e7e5\`, \`.catur O-O\`\n`;
      help += `👉 *.catur papan* - Menampilkan papan catur saat ini\n`;
      help += `👉 *.catur menyerah* - Menyerah dari permainan\n\n`;
      help += `_Mari bermain dengan jujur dan asah kemampuan analisis strategi Anda!_`;
      return chat.sendMessage(help);
    }

    // Validate turn player
    const expectedJid = session.chess.turn() === 'w' ? session.whiteJid : session.blackJid;
    if (senderJid !== expectedJid) {
      return msg.reply(`❌ Ini bukan giliran Anda! Giliran saat ini adalah *${session.chess.turn() === 'w' ? 'Putih' : 'Hitam'}* (${session.chess.turn() === 'w' ? session.whiteName : session.blackName}).`);
    }

    const moveStr = args.join(' ').trim();
    if (!moveStr) {
      return msg.reply('❌ Harap masukkan langkah catur Anda! Contoh: *.catur e4*');
    }

    // Try executing move
    let moveResult = null;
    try {
      moveResult = session.chess.move(moveStr);
    } catch (_) {
      try {
        const from = moveStr.substring(0, 2);
        const to = moveStr.substring(2, 4);
        const promotion = moveStr.substring(4, 5) || 'q';
        moveResult = session.chess.move({ from, to, promotion });
      } catch (err) {
        return msg.reply('❌ Langkah tidak valid! Gunakan Notasi Aljabar (misal: `e4`, `Nf3`, `exd5`, `O-O`) atau Koordinat (misal: `e2e4`).');
      }
    }

    session.lastActive = Date.now();

    if (await checkGameStatus(chat, session)) return;

    // AI Turn
    let aiMoveStr = '';
    if (session.isVsAi && session.chess.turn() === 'b') {
      const aiMove = getBestMoveForAi(session.chess);
      if (aiMove) {
        try {
          session.chess.move(aiMove);
          aiMoveStr = aiMove;
          if (await checkGameStatus(chat, session, aiMove)) return;
        } catch (aiErr) {
          logger.error('AI generated invalid move:', aiErr);
        }
      }
    }

    // Send updated board
    const currentTurn = session.chess.turn() === 'w' ? 'Putih' : 'Hitam';
    const currentTurnName = session.chess.turn() === 'w' ? session.whiteName : session.blackName;
    const turnJid = session.chess.turn() === 'w' ? session.whiteJid : session.blackJid;

    const tunnelUrl = getActiveTunnelUrl();
    let text = `🎮 *PERMAINAN CATUR* 🎮\n\n`;
    if (aiMoveStr) {
      text += `🤖 *AI melangkah:* *${aiMoveStr}*\n\n`;
    }
    text += `⚪ *Putih:* ${session.whiteName}\n`;
    text += `⚫ *Hitam:* ${session.blackName}\n\n`;
    text += `👉 *Giliran:* *${currentTurn}* (${currentTurnName})\n\n`;
    text += getChessBoardText(session.chess);
    text += `\nKetik *.catur [langkah]* untuk jalan.`;
    if (tunnelUrl) {
      text += `\n🔗 *Main via Web:* ${tunnelUrl}/catur/${groupId}`;
    }

    const media = await getChessBoardMedia(session.chess.fen());
    if (session.lastMsg) {
      try { await session.lastMsg.delete(true); } catch (_) {}
    }
    if (media) {
      session.lastMsg = await chat.sendMessage(media, { caption: text, mentions: [turnJid] });
    } else {
      session.lastMsg = await chat.sendMessage(text, { mentions: [turnJid] });
    }
  }
};

async function checkGameStatus(chat: any, session: ChessSession, lastMoveSan: string = ''): Promise<boolean> {
  const chess = session.chess;
  let gameOverText = '';
  let isGameOver = false;

  const lastPlayerName = chess.turn() === 'w' ? session.blackName : session.whiteName;

  if (chess.isCheckmate()) {
    isGameOver = true;
    gameOverText = `🎉 *SKAKMAT (CHECKMATE)!* 🎉\n\nSelamat kepada *${lastPlayerName}* atas kemenangannya! Permainan catur selesai.`;
  } else if (chess.isDraw()) {
    isGameOver = true;
    let reason = 'Kesepakatan';
    if (chess.isStalemate()) reason = 'Remis (Stalemate)';
    else if (chess.isThreefoldRepetition()) reason = 'Repetisi 3 Kali';
    else if (chess.isInsufficientMaterial()) reason = 'Kekurangan Material Catur';
    
    gameOverText = `🤝 *PERMAINAN SERI (DRAW)* 🤝\n\nPermainan selesai dengan hasil seri. Alasan: *${reason}*.`;
  }

  if (isGameOver) {
    activeChessGames.delete(session.groupId);
    
    let text = `${lastMoveSan ? `🤖 AI melangkah: *${lastMoveSan}*\n\n` : ''}${gameOverText}\n\n`;
    text += getChessBoardText(chess);

    const media = await getChessBoardMedia(chess.fen());
    if (session.lastMsg) {
      try { await session.lastMsg.delete(true); } catch (_) {}
    }
    if (media) {
      await chat.sendMessage(media, { caption: text });
    } else {
      await chat.sendMessage(text);
    }
    return true;
  }

  // Display warning if currently in check
  if (chess.inCheck()) {
    const checkedPlayerName = chess.turn() === 'w' ? session.whiteName : session.blackName;
    const checkedPlayerJid = chess.turn() === 'w' ? session.whiteJid : session.blackJid;
    await chat.sendMessage(`⚠️ *SKAK (CHECK)!* @${checkedPlayerJid.split('@')[0]}, Raja Anda sedang diserang oleh *${lastPlayerName}*! Lindungi Raja Anda!`, { mentions: [checkedPlayerJid] });
  }

  return false;
}

export default caturCommand;
