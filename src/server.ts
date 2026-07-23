import './polyfill.js';
import './utils/whatsappPatches.js';
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import moment from 'moment-timezone';
import os from 'os';

import logger from './utils/logger.js';
import prisma from './database/prisma.js';
import { initScheduler } from './scheduler/scheduler.js';
import { 
  initWhatsAppClient, 
  botState, 
  sendWhatsAppMessage, 
  setSocketServer,
  logToDashboard,
  getClient
} from './services/whatsappClient.js';
import { loadSettings, updateSettings } from './config/settings.js';
import { loadCommands } from './commands/index.js';
import pluginManager from './utils/pluginManager.js';
import { backupDatabase } from './utils/backup.js';

import { startCloudflareTunnel, getActiveTunnelUrl } from './utils/tunnel.js';
import { activeChessGames, getBestMoveForAi } from './commands/catur.js';
import pkgWhatsapp from 'whatsapp-web.js';
const { MessageMedia } = pkgWhatsapp;
import axios from 'axios';

declare let window: any;

dotenv.config();

// Tic Tac Toe Game State
export interface TttGame {
  roomId: string;
  groupId: string;
  players: {
    id: string;
    symbol: 'X' | 'O';
    name: string;
  }[];
  board: ('X' | 'O' | null)[];
  currentTurn: 'X' | 'O';
  status: 'waiting' | 'playing' | 'finished';
  winner: 'X' | 'O' | 'Draw' | null;
}

export const tttGames = new Map<string, TttGame>();
export const activeGroupGames = new Map<string, string>(); // groupId -> roomId

const app = express();
const server = http.createServer(app);

// Initialize Socket.IO Server
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  pingTimeout: 60000,
  pingInterval: 25000
});

setSocketServer(io);

const PORT = process.env.BACKEND_PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-jwt-secret-key-12345';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'fallback-jwt-refresh-secret-12345';

// Middlewares
app.use(helmet({
  contentSecurityPolicy: false // Allow dynamic scripts in dev
}));
app.use(cors());
app.use(express.json());

// API Auth Middleware
interface AuthRequest extends express.Request {
  user?: {
    id: string;
    username: string;
    role: string;
  };
}

const authMiddleware = (req: AuthRequest, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  jwt.verify(token, JWT_SECRET, (err: any, decoded: any) => {
    if (err) {
      return res.status(403).json({ error: 'Forbidden: Invalid token' });
    }
    req.user = decoded;
    next();
  });
};

// Seed default administrator if users table is empty
async function seedAdminUser() {
  try {
    const userCount = await prisma.user.count();
    if (userCount === 0) {
      // Create role Owner
      let ownerRole = await prisma.role.findUnique({ where: { name: 'Owner' } });
      if (!ownerRole) {
        ownerRole = await prisma.role.create({
          data: { name: 'Owner' }
        });
      }

      // Default password hash for 'admin' password
      const passwordHash = await bcrypt.hash('AdminUT2026', 10);
      await prisma.user.create({
        data: {
          username: 'admin',
          passwordHash,
          roleId: ownerRole.id
        }
      });
      logger.info("Successfully seeded default administrator user: 'admin' / 'AdminUT2026'");
    }
  } catch (err) {
    logger.error("Failed to seed admin user", err);
  }
}

// ==========================================
// REST API ENDPOINTS
// ==========================================

/**
 * Endpoint: POST /api/auth/login
 */
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { username },
      include: { role: true }
    });

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const payload = { id: user.id, username: user.username, role: user.role.name };
    const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' });
    const refreshToken = jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: '7d' });

    // Store session
    await prisma.session.create({
      data: {
        userId: user.id,
        token: accessToken,
        refreshToken: refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      }
    });

    res.json({ accessToken, refreshToken, role: user.role.name });
  } catch (err: any) {
    logger.error("Login failed", err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * Endpoint: GET /health
 */
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: moment().tz('Asia/Jakarta').format() });
});

/**
 * Endpoint: GET /game/ttt/:roomId
 */
app.get('/game/ttt/:roomId', (req, res) => {
  const { roomId } = req.params;
  const game = tttGames.get(roomId);
  if (!game) {
    return res.status(404).send('<h1>Room Tidak Ditemukan</h1><p>Ruang game Tic Tac Toe ini tidak valid atau sudah kedaluwarsa.</p>');
  }
  
  res.send(`<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>UT Tic Tac Toe - Room ${roomId}</title>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #0b0c10;
      --card-bg: rgba(255, 255, 255, 0.03);
      --border: rgba(255, 255, 255, 0.08);
      --primary: #8a2be2;
      --accent-x: #ff007f;
      --accent-o: #00f0ff;
      --text: #f0f0f5;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: 'Outfit', sans-serif;
    }
    body {
      background-color: var(--bg);
      color: var(--text);
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      padding: 10px;
    }
    .container {
      width: 100%;
      max-width: 400px;
      padding: 20px;
      text-align: center;
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 24px;
      backdrop-filter: blur(10px);
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
    }
    h1 {
      font-size: 1.8rem;
      font-weight: 800;
      margin-bottom: 5px;
      background: linear-gradient(135deg, var(--accent-x), var(--accent-o));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .room-info {
      font-size: 0.85rem;
      color: #888;
      margin-bottom: 20px;
    }
    .players {
      display: flex;
      justify-content: space-between;
      margin-bottom: 20px;
      background: rgba(255,255,255,0.02);
      border-radius: 16px;
      padding: 10px 15px;
      border: 1px solid var(--border);
    }
    .player-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      width: 45%;
      padding-bottom: 5px;
    }
    .player-card.active {
      border-bottom: 2px solid var(--primary);
    }
    .player-name {
      font-size: 0.9rem;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 120px;
    }
    .player-symbol {
      font-size: 1.5rem;
      font-weight: 800;
      margin-top: 5px;
    }
    .player-symbol.x { color: var(--accent-x); text-shadow: 0 0 10px rgba(255, 0, 127, 0.5); }
    .player-symbol.o { color: var(--accent-o); text-shadow: 0 0 10px rgba(0, 240, 255, 0.5); }
    .versus {
      display: flex;
      align-items: center;
      font-size: 0.8rem;
      color: #555;
      font-weight: bold;
    }
    .status-msg {
      margin-bottom: 20px;
      font-weight: 600;
      font-size: 1.1rem;
      min-height: 27px;
    }
    .board {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin-bottom: 20px;
    }
    .cell {
      aspect-ratio: 1;
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid var(--border);
      border-radius: 16px;
      font-size: 2.5rem;
      font-weight: 800;
      display: flex;
      justify-content: center;
      align-items: center;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .cell:hover {
      background: rgba(255, 255, 255, 0.05);
      border-color: rgba(255, 255, 255, 0.2);
    }
    .cell.x {
      color: var(--accent-x);
      text-shadow: 0 0 15px rgba(255, 0, 127, 0.6);
      animation: pop 0.2s ease-out;
    }
    .cell.o {
      color: var(--accent-o);
      text-shadow: 0 0 15px rgba(0, 240, 255, 0.6);
      animation: pop 0.2s ease-out;
    }
    @keyframes pop {
      0% { transform: scale(0.8); opacity: 0; }
      100% { transform: scale(1); opacity: 1; }
    }
    /* Modal */
    .modal-overlay {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(10, 11, 15, 0.95);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 100;
      transition: opacity 0.3s ease;
    }
    .modal {
      background: #14151f;
      border: 1px solid var(--border);
      padding: 30px;
      border-radius: 24px;
      width: 90%;
      max-width: 350px;
      text-align: center;
      box-shadow: 0 10px 30px rgba(0,0,0,0.5);
    }
    .modal h2 {
      font-size: 1.4rem;
      margin-bottom: 15px;
    }
    .modal input {
      width: 100%;
      padding: 12px;
      border-radius: 12px;
      border: 1px solid var(--border);
      background: rgba(255, 255, 255, 0.03);
      color: var(--text);
      font-size: 1rem;
      margin-bottom: 20px;
      outline: none;
      text-align: center;
    }
    .modal input:focus {
      border-color: var(--primary);
    }
    .modal button {
      width: 100%;
      padding: 12px;
      background: linear-gradient(135deg, #7928ca, #ff0080);
      border: none;
      border-radius: 12px;
      color: white;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 0.2s;
    }
    .modal button:hover {
      opacity: 0.9;
    }
    .error-msg {
      color: #ff3366;
      margin-bottom: 15px;
      font-size: 0.9rem;
      display: none;
    }
  </style>
</head>
<body>
  <div class="modal-overlay" id="nameModal">
    <div class="modal">
      <h2>Mulai Bermain TTT</h2>
      <p style="color: #888; font-size: 0.85rem; margin-bottom: 15px;">Masukkan nama Anda untuk masuk ke arena game.</p>
      <div class="error-msg" id="modalError"></div>
      <input type="text" id="usernameInput" placeholder="Nama Anda" maxlength="15" required>
      <button id="joinBtn">Masuk Game</button>
    </div>
  </div>

  <div class="container">
    <h1>TIC TAC TOE</h1>
    <div class="room-info">Room ID: <span id="roomVal">${roomId}</span></div>
    
    <div class="players">
      <div class="player-card" id="cardX">
        <span class="player-name" id="nameX">Menunggu...</span>
        <span class="player-symbol x">X</span>
      </div>
      <div class="versus">VS</div>
      <div class="player-card" id="cardO">
        <span class="player-name" id="nameO">Menunggu...</span>
        <span class="player-symbol o">O</span>
      </div>
    </div>

    <div class="status-msg" id="statusText">Menghubungkan ke server...</div>

    <div class="board" id="boardGrid">
      <div class="cell" data-idx="0"></div>
      <div class="cell" data-idx="1"></div>
      <div class="cell" data-idx="2"></div>
      <div class="cell" data-idx="3"></div>
      <div class="cell" data-idx="4"></div>
      <div class="cell" data-idx="5"></div>
      <div class="cell" data-idx="6"></div>
      <div class="cell" data-idx="7"></div>
      <div class="cell" data-idx="8"></div>
    </div>
  </div>

  <script src="/socket.io/socket.io.js"></script>
  <script>
    const socket = io({
      transports: ['websocket', 'polling']
    });
    const roomId = "${roomId}";
    const initialGame = ${JSON.stringify({
      status: game.status,
      board: game.board,
      players: game.players.map(p => ({ symbol: p.symbol, name: p.name })),
      winner: game.winner
    })};
    let mySymbol = null;
    let currentTurn = 'X';
    let gameStatus = initialGame.status;

    const nameModal = document.getElementById('nameModal');
    const usernameInput = document.getElementById('usernameInput');
    const joinBtn = document.getElementById('joinBtn');
    const modalError = document.getElementById('modalError');
    const statusText = document.getElementById('statusText');
    const cells = document.querySelectorAll('.cell');
    const cardX = document.getElementById('cardX');
    const cardO = document.getElementById('cardO');

    // Handle initial finished state
    if (gameStatus === 'finished') {
      nameModal.style.display = 'none';
      updateUIPlayers(initialGame.players);
      updateUIBoard(initialGame.board);
      
      if (initialGame.winner === 'Draw') {
        statusText.innerHTML = "🤝 Permainan Seri (Draw)!";
        statusText.style.color = '#fff';
      } else {
        const winnerName = initialGame.players.find(p => p.symbol === initialGame.winner)?.name || initialGame.winner;
        statusText.innerHTML = '🏆 Pemenang: <b>' + winnerName + '</b>!';
        statusText.style.color = '#00f0ff';
      }
    } else {
      // Normal flow
      joinBtn.addEventListener('click', () => {
        const name = usernameInput.value.trim();
        if (!name) return;
        joinBtn.disabled = true;
        socket.emit('ttt_join', { roomId, name });
      });
    }

    socket.on('ttt_init', (data) => {
      mySymbol = data.symbol;
      gameStatus = data.status;
      currentTurn = data.currentTurn;
      nameModal.style.display = 'none';
      updateUIPlayers(data.players);
      updateUIBoard(data.board);
      updateStatus();
    });

    socket.on('ttt_players_update', (players) => {
      updateUIPlayers(players);
      updateStatus();
    });

    socket.on('ttt_start', (data) => {
      gameStatus = 'playing';
      currentTurn = data.currentTurn;
      updateStatus();
    });

    socket.on('ttt_update', (data) => {
      gameStatus = data.status;
      currentTurn = data.currentTurn;
      updateUIBoard(data.board);
      updateStatus();
      
      if (data.status === 'finished') {
        if (data.winner === 'Draw') {
          statusText.innerHTML = "🤝 Permainan Seri (Draw)!";
          statusText.style.color = '#fff';
        } else {
          statusText.innerHTML = data.winner === mySymbol ? "🏆 Anda Menang!" : "💀 Anda Kalah!";
          statusText.style.color = data.winner === mySymbol ? '#00f0ff' : '#ff007f';
        }
      }
      if (data.message) {
        alert(data.message);
      }
    });

    socket.on('ttt_error', (msg) => {
      modalError.innerText = msg;
      modalError.style.display = 'block';
      joinBtn.disabled = false;
    });

    cells.forEach(cell => {
      cell.addEventListener('click', () => {
        if (gameStatus !== 'playing') return;
        if (currentTurn !== mySymbol) return;
        const index = parseInt(cell.getAttribute('data-idx'));
        socket.emit('ttt_move', { roomId, index });
      });
    });

    function updateUIPlayers(players) {
      const playerX = players.find(p => p.symbol === 'X');
      const playerO = players.find(p => p.symbol === 'O');
      
      document.getElementById('nameX').innerText = playerX ? playerX.name : 'Menunggu...';
      document.getElementById('nameO').innerText = playerO ? playerO.name : 'Menunggu...';
    }

    function updateUIBoard(board) {
      board.forEach((val, idx) => {
        const cell = cells[idx];
        cell.innerText = val || '';
        cell.className = 'cell' + (val ? ' ' + val.toLowerCase() : '');
      });
    }

    function updateStatus() {
      if (gameStatus === 'waiting') {
        statusText.innerText = "⏳ Menunggu lawan bergabung...";
        statusText.style.color = '#888';
        cardX.classList.remove('active');
        cardO.classList.remove('active');
      } else if (gameStatus === 'playing') {
        if (currentTurn === 'X') {
          cardX.classList.add('active');
          cardO.classList.remove('active');
        } else {
          cardO.classList.add('active');
          cardX.classList.remove('active');
        }
        
        if (currentTurn === mySymbol) {
          statusText.innerHTML = "👉 Giliran Anda!";
          statusText.style.color = '#00f0ff';
        } else {
          statusText.innerHTML = "⏳ Giliran Lawan...";
          statusText.style.color = '#ff007f';
        }
      } else if (gameStatus === 'finished') {
        cardX.classList.remove('active');
        cardO.classList.remove('active');
      }
    }
  </script>
</body>
</html>`);
});

/**
 * Endpoint: GET /status (Secure)
 */
app.get('/status', authMiddleware, async (req, res) => {
  const rssMemory = Math.round(process.memoryUsage().rss / 1024 / 1024); // in MB
  const totalMemory = Math.round(os.totalmem() / 1024 / 1024);
  const freeMemory = Math.round(os.freemem() / 1024 / 1024);
  const cpuLoad = os.loadavg()[0];

  let dbStats = { knowledge: 0, faq: 0, groups: 0 };
  try {
    const knowledgeCount = await prisma.statistics.findUnique({ where: { key: 'knowledge_count' } });
    dbStats.knowledge = knowledgeCount ? parseInt(knowledgeCount.value) : 0;
    dbStats.faq = await prisma.autoReply.count();
    dbStats.groups = await prisma.group.count();
  } catch (err) {
    logger.error("Failed to fetch database stats for status API", err);
  }

  res.json({
    connected: botState.connected,
    botUser: botState.botUser,
    qr: botState.qr,
    uptime: Math.floor(process.uptime()),
    memory: {
      usage: rssMemory,
      total: totalMemory,
      free: freeMemory
    },
    cpu: {
      load: cpuLoad,
      cores: os.cpus().length
    },
    dbStats
  });
});

/**
 * Endpoint: GET /logs (Public)
 */
app.get('/logs', async (req, res) => {
  const logFilePath = path.resolve('logs/app.log');
  try {
    if (!existsSync(logFilePath)) {
      return res.json([]);
    }
    const logData = await fs.readFile(logFilePath, 'utf8');
    const lines = logData.split('\n').filter(Boolean);
    const lastLines = lines.slice(-100); 
    res.json(lastLines);
  } catch (err) {
    logger.error("Failed to read logs file", err);
    res.status(500).json({ error: 'Failed to read logs.' });
  }
});

/**
 * Endpoint: GET /api/auto-replies (Secure)
 */
app.get('/api/auto-replies', authMiddleware, async (req, res) => {
  try {
    const replies = await prisma.autoReply.findMany();
    res.json(replies);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Endpoint: POST /api/auto-replies (Secure)
 */
app.post('/api/auto-replies', authMiddleware, async (req, res) => {
  const { keyword, response, status } = req.body;
  if (!keyword || !response) {
    return res.status(400).json({ error: 'Keyword and Response are required' });
  }
  try {
    const reply = await prisma.autoReply.create({
      data: { keyword, response, status: status ?? true }
    });
    logToDashboard('Auto Reply', `Created auto reply rule for "${keyword}"`);
    res.json(reply);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Endpoint: DELETE /api/auto-replies/:id (Secure)
 */
app.delete('/api/auto-replies/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.autoReply.delete({ where: { id } });
    logToDashboard('Auto Reply', `Deleted auto reply rule ID ${id}`);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Helper to force-fetch real group name from WhatsApp Web Client & Store
 */
async function fetchRealGroupName(gid: string): Promise<string | null> {
  const client = getClient();
  if (!client || !botState.connected) return null;

  // 1. Try standard whatsapp-web.js getChatById
  try {
    const chat = await client.getChatById(gid);
    if (chat && chat.name && chat.name !== 'Grup WA' && chat.name !== 'Grup') {
      return chat.name;
    }
  } catch (_) {}

  // 2. Force lookup in Puppeteer window.Store with WidFactory, Chat.find & GroupMetadata.find
  if (client.pupPage) {
    try {
      const waName = await client.pupPage.evaluate(async (targetJid: string) => {
        try {
          const store = (window as any).Store;
          if (!store) return null;

          let wid = null;
          if (store.WidFactory && typeof store.WidFactory.createWid === 'function') {
            try {
              wid = store.WidFactory.createWid(targetJid);
            } catch (_) {}
          }

          // Search Chat store
          if (store.Chat) {
            let c = store.Chat.get(targetJid) || (wid ? store.Chat.get(wid) : null);
            if (!c && typeof store.Chat.find === 'function') {
              try {
                c = await store.Chat.find(wid || targetJid);
              } catch (_) {}
            }
            if (!c && typeof store.Chat.find === 'function') {
              try {
                c = await store.Chat.find({ id: wid || targetJid });
              } catch (_) {}
            }
            if (c) {
              const name = c.name || c.formattedTitle || (c.groupMetadata ? c.groupMetadata.subject : null);
              if (name && name !== 'Grup WA' && name !== 'Grup') return name;
            }
          }

          // Search GroupMetadata store directly
          if (store.GroupMetadata) {
            let gMeta = store.GroupMetadata.get(targetJid) || (wid ? store.GroupMetadata.get(wid) : null);
            if (!gMeta && typeof store.GroupMetadata.find === 'function') {
              try {
                gMeta = await store.GroupMetadata.find(wid || targetJid);
              } catch (_) {}
            }
            if (gMeta && gMeta.subject) return gMeta.subject;
          }
        } catch (_) {}
        return null;
      }, gid);

      if (waName && waName !== 'Grup WA' && waName !== 'Grup') {
        return waName;
      }
    } catch (_) {}
  }

  return null;
}

/**
 * Endpoint: GET /api/groups (Secure)
 */
app.get('/api/groups', authMiddleware, async (req, res) => {
  try {
    const groups = await prisma.group.findMany({
      include: { settings: true }
    });

    if (botState.connected) {
      // Auto-resolve real group names for any groups holding generic fallback names
      for (const g of groups) {
        if (g.name === 'Grup WA' || g.name === 'Grup' || !g.name) {
          try {
            const realName = await fetchRealGroupName(g.id);
            if (realName) {
              g.name = realName;
              await prisma.group.update({
                where: { id: g.id },
                data: { name: realName }
              }).catch(() => {});
            }
          } catch (_) {}
        }
      }
    }

    res.json(groups);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Endpoint: POST /api/groups/:id/settings (Secure)
 */
app.post('/api/groups/:id/settings', authMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    const settings = await prisma.groupSetting.upsert({
      where: { groupId: id },
      update: req.body,
      create: { groupId: id, ...req.body }
    });
    logToDashboard('Security', `Updated settings for group JID ${id}`);
    res.json({ success: true, settings });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Endpoint: POST /api/groups/:id/sync-name (Secure)
 */
app.post('/api/groups/:id/sync-name', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const client = getClient();
  if (!client || !botState.connected) {
    return res.status(400).json({ error: 'WhatsApp client belum terhubung. Pastikan bot sudah bereksitasi & scan QR.' });
  }

  try {
    const waName = await fetchRealGroupName(id);

    if (!waName) {
      return res.status(404).json({ error: 'Nama grup tidak dapat di-sync otomatis karena belum ada riwayat aktif di browser WA. Silakan gunakan ikon Pensil ✏️ di samping tulisan "Grup WA" untuk mengubah nama secara manual.' });
    }

    const updated = await prisma.group.update({
      where: { id },
      data: { name: waName }
    });

    logToDashboard('Security', `Synced real group name for ${id}: "${waName}"`);

    // Broadcast update via Socket.IO
    const updatedGroups = await prisma.group.findMany({ include: { settings: true } });
    io.emit('groups_update', updatedGroups);

    res.json({ success: true, name: waName, group: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Endpoint: POST /api/groups (Secure)
 */
app.post('/api/groups', authMiddleware, async (req, res) => {
  let { id, name, status } = req.body;
  if (!id) return res.status(400).json({ error: 'Group ID is required' });

  let formattedId = id.trim();
  if (!formattedId.includes('@')) {
    formattedId = `${formattedId.replace(/[^0-9]/g, '')}@g.us`;
  }

  let resolvedName = name ? name.trim() : '';

  // Try auto-fetching real group name from WhatsApp if empty or generic default
  if (!resolvedName || resolvedName === 'Grup WA' || resolvedName === 'Grup') {
    try {
      const waName = await fetchRealGroupName(formattedId);
      if (waName) {
        resolvedName = waName;
      }
    } catch (_) {}
  }

  if (!resolvedName) {
    resolvedName = 'Grup WA';
  }

  try {
    const group = await prisma.group.upsert({
      where: { id: formattedId },
      update: { name: resolvedName, status: status !== undefined ? status : true },
      create: { id: formattedId, name: resolvedName, status: status !== undefined ? status : true }
    });
    
    await prisma.groupSetting.upsert({
      where: { groupId: formattedId },
      update: {},
      create: { groupId: formattedId }
    });

    logToDashboard('Security', `Group JID ${formattedId} (${resolvedName}) whitelisted/updated via web panel`);

    // Broadcast update via Socket.IO
    const updatedGroups = await prisma.group.findMany({ include: { settings: true } });
    io.emit('groups_update', updatedGroups);

    res.json(group);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Endpoint: DELETE /api/groups/:id (Secure)
 */
app.delete('/api/groups/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.group.delete({ where: { id } });
    logToDashboard('Security', `Group JID ${id} removed from whitelist via web panel`);

    // Broadcast update via Socket.IO
    const io = (req as any).io;
    if (io) {
      const updatedGroups = await prisma.group.findMany({ include: { settings: true } });
      io.emit('groups_update', updatedGroups);
    }

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Endpoint: GET /api/settings (Secure)
 */
app.get('/api/settings', authMiddleware, async (req, res) => {
  try {
    const settings = await loadSettings();
    const { WEB_DASHBOARD_PASSWORD, ...safeSettings } = settings;
    res.json(safeSettings);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Endpoint: POST /api/settings (Secure)
 */
app.post('/api/settings', authMiddleware, async (req, res) => {
  try {
    const updated = await updateSettings(req.body);
    const { WEB_DASHBOARD_PASSWORD, ...safeSettings } = updated;
    res.json(safeSettings);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Endpoint: POST /api/broadcast (Secure)
 */
app.post('/api/broadcast', authMiddleware, async (req, res) => {
  const { message, targetType } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message content is required' });
  }

  try {
    // 1. Resolve target JIDs
    let targets: string[] = [];
    
    if (targetType === 'all_groups') {
      const activeGroups = await prisma.group.findMany({
        where: { status: true }
      });
      targets = activeGroups.map(g => g.id);
    } else if (targetType === 'all_admins') {
      const admins = await prisma.admin.findMany();
      targets = admins.map(a => a.whatsappId);
    } else {
      return res.status(400).json({ error: 'Invalid targetType' });
    }

    if (targets.length === 0) {
      return res.json({ success: true, message: 'No targets found to send broadcast.' });
    }

    // 2. Create parent Broadcast record in DB
    const broadcastRecord = await prisma.broadcast.create({
      data: {
        message,
        targetType,
        targetGroups: JSON.stringify(targets),
        status: 'sending'
      }
    });

    // 3. Process dispatching in the background (Non-blocking response)
    (async () => {
      let successCount = 0;
      let failCount = 0;

      for (const targetJid of targets) {
        try {
          // Delay to prevent WA spam detection (1.5 seconds)
          await new Promise(resolve => setTimeout(resolve, 1500));
          
          await sendWhatsAppMessage(targetJid, message);
          
          await prisma.broadcastLog.create({
            data: {
              broadcastId: broadcastRecord.id,
              targetId: targetJid,
              status: 'success'
            }
          });
          successCount++;
        } catch (err: any) {
          logger.error(`Broadcast failed to target: ${targetJid}`, err);
          await prisma.broadcastLog.create({
            data: {
              broadcastId: broadcastRecord.id,
              targetId: targetJid,
              status: 'failed',
              errorMsg: err.message || String(err)
            }
          });
          failCount++;
        }
      }

      // Update final status
      await prisma.broadcast.update({
        where: { id: broadcastRecord.id },
        data: {
          status: failCount === 0 ? 'sent' : (successCount > 0 ? 'partial' : 'failed')
        }
      });
      
      logToDashboard('Broadcast', `Completed broadcast dispatch. Success: ${successCount}, Failed: ${failCount}`);
      logger.info(`Broadcast job ${broadcastRecord.id} completed. Success: ${successCount}, Failed: ${failCount}`);
    })().catch(err => {
      logger.error("Async broadcast handler failed", err);
    });

    res.json({ success: true, message: `Broadcast queued for ${targets.length} targets.` });
  } catch (err: any) {
    logger.error("Failed to queue broadcast", err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Endpoint: POST /api/backups (Secure)
 */
app.post('/api/backups', authMiddleware, async (req, res) => {
  try {
    const backupPath = await backupDatabase();
    res.json({ success: true, path: backupPath });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Endpoint: POST /api/system/restart (Secure)
 */
app.post('/api/system/restart', authMiddleware, async (req, res) => {
  try {
    logToDashboard('System', 'System restart initiated from Web Dashboard.');
    res.json({ success: true, message: 'Bot system is restarting...' });
    setTimeout(() => {
      process.exit(0);
    }, 1000);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Endpoint: POST /api/system/clear-logs (Secure)
 */
app.post('/api/system/clear-logs', authMiddleware, async (req, res) => {
  const logFilePath = path.resolve('logs/app.log');
  try {
    await fs.writeFile(logFilePath, '', 'utf8');
    logToDashboard('System', 'System logs cleared from Web Dashboard.');
    res.json({ success: true, message: 'Logs cleared.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Endpoint: GET /api/blacklist (Secure)
 */
app.get('/api/blacklist', authMiddleware, async (req, res) => {
  try {
    const list = await prisma.blacklist.findMany();
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Endpoint: POST /api/blacklist (Secure)
 */
app.post('/api/blacklist', authMiddleware, async (req, res) => {
  const { whatsappId, reason } = req.body;
  if (!whatsappId) return res.status(400).json({ error: 'WhatsApp ID is required' });
  try {
    const entry = await prisma.blacklist.upsert({
      where: { whatsappId },
      update: { reason: reason || 'Melanggar aturan' },
      create: { whatsappId, reason: reason || 'Melanggar aturan' }
    });
    logToDashboard('Security', `Blacklisted user ${whatsappId}`);
    res.json(entry);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Endpoint: DELETE /api/blacklist/:whatsappId (Secure)
 */
app.delete('/api/blacklist/:whatsappId', authMiddleware, async (req, res) => {
  const { whatsappId } = req.params;
  try {
    await prisma.blacklist.delete({ where: { whatsappId } });
    logToDashboard('Security', `Removed blacklist for user ${whatsappId}`);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Endpoint: GET /api/admins (Secure)
 */
app.get('/api/admins', authMiddleware, async (req, res) => {
  try {
    const list = await prisma.admin.findMany();
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Endpoint: POST /api/admins (Secure)
 */
app.post('/api/admins', authMiddleware, async (req, res) => {
  const { whatsappId, role, name } = req.body;
  if (!whatsappId) return res.status(400).json({ error: 'WhatsApp ID is required' });
  try {
    const entry = await prisma.admin.upsert({
      where: { whatsappId },
      update: { role: role || 'Admin', name: name || whatsappId.split('@')[0] },
      create: { whatsappId, role: role || 'Admin', name: name || whatsappId.split('@')[0] }
    });
    logToDashboard('Security', `Registered global admin ${whatsappId} with role ${role}`);
    res.json(entry);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Endpoint: DELETE /api/admins/:whatsappId (Secure)
 */
app.delete('/api/admins/:whatsappId', authMiddleware, async (req, res) => {
  const { whatsappId } = req.params;
  try {
    await prisma.admin.delete({ where: { whatsappId } });
    logToDashboard('Security', `Removed global admin rights for user ${whatsappId}`);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Endpoint: GET /api/registered-users (Secure)
 */
app.get('/api/registered-users', authMiddleware, async (req, res) => {
  try {
    const list = await prisma.registeredUser.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Endpoint: POST /api/registered-users (Secure)
 */
app.post('/api/registered-users', authMiddleware, async (req, res) => {
  const { id, whatsappId, name, upbjj } = req.body;
  if (!whatsappId || !name || !upbjj) {
    return res.status(400).json({ error: 'WhatsApp ID, Name, and UPBJJ are required' });
  }

  let formattedJid = whatsappId.trim();
  if (!formattedJid.includes('@')) {
    formattedJid = `${formattedJid.replace(/[^0-9]/g, '')}@c.us`;
  }

  try {
    let entry;
    if (id) {
      entry = await prisma.registeredUser.update({
        where: { id },
        data: { whatsappId: formattedJid, name, upbjj }
      });
      logToDashboard('System', `Updated registered user ${formattedJid} in dashboard`);
    } else {
      entry = await prisma.registeredUser.upsert({
        where: { whatsappId: formattedJid },
        update: { name, upbjj },
        create: { whatsappId: formattedJid, name, upbjj }
      });
      logToDashboard('System', `Registered user ${formattedJid} in dashboard`);
    }
    res.json(entry);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Endpoint: DELETE /api/registered-users/:id (Secure)
 */
app.delete('/api/registered-users/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    const deleted = await prisma.registeredUser.delete({ where: { id } });
    logToDashboard('System', `Deleted registered user ${deleted.whatsappId} from dashboard`);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Route: GET /catur/:groupId
 * Exposes a beautiful, modern interactive 2D chessboard UI via TryCloudflare
 */
app.get('/catur/:groupId', (req, res) => {
  const { groupId } = req.params;
  const session = activeChessGames.get(groupId);
  if (!session) {
    return res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Catur Modern - Tidak Ditemukan</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <script src="https://cdn.tailwindcss.com"></script>
      </head>
      <body class="bg-slate-950 text-slate-100 flex flex-col items-center justify-center min-h-screen p-6">
        <div class="max-w-md w-full text-center space-y-4">
          <h1 class="text-3xl font-extrabold text-red-500">❌ Game Tidak Ditemukan</h1>
          <p class="text-slate-400">Tidak ada sesi permainan catur yang aktif untuk grup ini.</p>
          <p class="text-sm text-slate-500">Silakan ketik <code class="bg-slate-900 px-2 py-1 rounded text-indigo-400">.catur @tag</code> atau <code class="bg-slate-900 px-2 py-1 rounded text-indigo-400">.catur ai</code> di grup WhatsApp Anda terlebih dahulu.</p>
        </div>
      </body>
      </html>
    `);
  }

  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Catur Modern - UT Assistant</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <script src="https://cdn.tailwindcss.com"></script>
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/chessboard-js/1.0.0/chessboard-1.0.0.min.css">
      <script src="https://code.jquery.com/jquery-3.5.1.min.js"></script>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/chess.js/0.10.3/chess.min.js"></script>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/chessboard-js/1.0.0/chessboard-1.0.0.min.js"></script>
      <script src="/socket.io/socket.io.js"></script>
      <style>
        .board-b72b1 { border: 4px solid #1e293b !important; border-radius: 12px; box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.5); }
        .white-1e1d7 { background-color: #f1f5f9 !important; }
        .black-3c85d { background-color: #475569 !important; }
      </style>
    </head>
    <body class="bg-[#05070c] text-slate-100 min-h-screen flex flex-col items-center justify-center p-4">
      <div class="max-w-xl w-full flex flex-col items-center gap-6">
        <div class="text-center">
          <h1 class="text-2xl font-extrabold bg-gradient-to-r from-indigo-500 to-purple-500 bg-clip-text text-transparent">🎮 UT CHESS ASSISTANT</h1>
          <p class="text-xs text-slate-400 mt-1">Real-time sync dengan grup WhatsApp</p>
        </div>

        <div class="bg-slate-950/80 border border-slate-900/60 rounded-2xl p-6 w-full flex flex-col gap-4 shadow-2xl">
          <div class="flex justify-between items-center text-sm font-semibold border-b border-slate-900/60 pb-3">
            <div class="flex items-center gap-2">
              <span class="w-3 h-3 rounded-full bg-slate-100"></span>
              <span class="text-slate-300">${session.whiteName}</span>
            </div>
            <div class="text-indigo-400 font-bold" id="turn-indicator">Giliran: Putih</div>
            <div class="flex items-center gap-2">
              <span class="w-3 h-3 rounded-full bg-slate-800"></span>
              <span class="text-slate-300">${session.blackName}</span>
            </div>
          </div>

          <div class="w-full flex justify-center py-2">
            <div id="board" class="w-[320px] sm:w-[400px]"></div>
          </div>

          <div class="flex flex-col gap-2">
            <div class="text-xs text-slate-500 text-center">Tarik dan lepas bidak untuk melangkah</div>
            <div class="flex justify-between gap-3 mt-2">
              <button onclick="surrender()" class="flex-1 py-2.5 bg-red-950/40 hover:bg-red-900/60 border border-red-900/40 text-red-200 text-sm font-semibold rounded-xl transition cursor-pointer">🏳️ Menyerah</button>
              <button onclick="refreshBoard()" class="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-sm font-semibold rounded-xl transition cursor-pointer">🔄 Segarkan</button>
            </div>
          </div>
        </div>
      </div>

      <script>
        const groupId = "${groupId}";
        const socket = io();
        const game = new Chess("${session.chess.fen()}");
        let board = null;

        function initBoard() {
          const config = {
            draggable: true,
            position: game.fen(),
            onDragStart: onDragStart,
            onDrop: onDrop,
            onSnapEnd: onSnapEnd,
            pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png'
          };
          board = Chessboard('board', config);
          updateStatus();
        }

        function updateStatus() {
          let statusText = "";
          const turn = game.turn();
          const turnName = turn === 'w' ? "${session.whiteName}" : "${session.blackName}";
          
          if (game.in_checkmate()) {
            statusText = "Skakmat! Game Selesai.";
            document.getElementById('turn-indicator').innerText = statusText;
            document.getElementById('turn-indicator').className = 'text-red-500 font-bold';
          } else if (game.in_draw()) {
            statusText = "Remis/Seri!";
            document.getElementById('turn-indicator').innerText = statusText;
            document.getElementById('turn-indicator').className = 'text-yellow-500 font-bold';
          } else {
            statusText = "Giliran: " + turnName + (turn === 'w' ? ' (Putih)' : ' (Hitam)');
            document.getElementById('turn-indicator').innerText = statusText;
            document.getElementById('turn-indicator').className = 'text-indigo-400 font-bold';
          }
        }

        function onDragStart(source, piece, position, orientation) {
          if (game.game_over()) return false;
          
          const turn = game.turn();
          // Allow player moves
        }

        function onDrop(source, target) {
          const move = game.move({
            from: source,
            to: target,
            promotion: 'q'
          });

          if (move === null) return 'snapback';

          socket.emit('catur_move_web', {
            groupId: groupId,
            move: move.san
          });
        }

        function onSnapEnd() {
          board.position(game.fen());
          updateStatus();
        }

        function surrender() {
          if (confirm("Apakah Anda yakin ingin menyerah?")) {
            socket.emit('catur_surrender_web', { groupId });
          }
        }

        function refreshBoard() {
          window.location.reload();
        }

        socket.emit('join_catur', groupId);

        socket.on('catur_update', (fen) => {
          game.load(fen);
          board.position(fen);
          updateStatus();
        });

        socket.on('catur_finished', (msg) => {
          alert(msg);
          window.location.reload();
        });

        $(document).ready(initBoard);
        $(window).resize(() => { if(board) board.resize(); });
      </script>
    </body>
    </html>
  `);
});

// ==========================================
// SOCKET.IO REALTIME BROADCASTERS
// ==========================================
io.on('connection', (socket) => {
  logger.info(`Client connected via Socket.IO: ${socket.id}`);
  
  // Send immediate status
  socket.emit('bot_status', {
    connected: botState.connected,
    botUser: botState.botUser,
    qr: botState.qr
  });

  // --- CHESS (CATUR) SOCKET EVENT HANDLERS ---
  socket.on('join_catur', (groupId) => {
    socket.join(`catur_${groupId}`);
    logger.info(`Client joined chess room catur_${groupId}`);
  });

  socket.on('catur_move_web', async ({ groupId, move }) => {
    const session = activeChessGames.get(groupId) as any;
    if (!session) return;
    const client = getClient();

    try {
      const moveResult = session.chess.move(move);
      if (!moveResult) return;

      io.to(`catur_${groupId}`).emit('catur_update', session.chess.fen());

      let isGameOver = false;
      let gameOverText = '';
      if (session.chess.isCheckmate()) {
        isGameOver = true;
        gameOverText = `🎉 *SKAKMAT (CHECKMATE)!* 🎉\n\nSelamat atas kemenangan game catur ini!`;
      } else if (session.chess.isDraw()) {
        isGameOver = true;
        gameOverText = `🤝 *PERMAINAN SERI (DRAW)* 🤝`;
      }

      if (isGameOver) {
        activeChessGames.delete(groupId);
        io.to(`catur_${groupId}`).emit('catur_finished', gameOverText);
      }

      if (!isGameOver && session.isVsAi && session.chess.turn() === 'b') {
        setTimeout(async () => {
          const aiMove = getBestMoveForAi(session.chess);
          if (aiMove) {
            try {
              session.chess.move(aiMove);
              io.to(`catur_${groupId}`).emit('catur_update', session.chess.fen());

              let aiGameOver = false;
              let aiGameOverText = '';
              if (session.chess.isCheckmate()) {
                aiGameOver = true;
                aiGameOverText = `🎉 *SKAKMAT (CHECKMATE)!* 🎉\n\nSelamat atas kemenangan game catur ini!`;
              } else if (session.chess.isDraw()) {
                aiGameOver = true;
                aiGameOverText = `🤝 *PERMAINAN SERI (DRAW)* 🤝`;
              }

              if (aiGameOver) {
                activeChessGames.delete(groupId);
                io.to(`catur_${groupId}`).emit('catur_finished', aiGameOverText);
              }
            } catch (err) {
              logger.error('Failed to execute AI move from Web trigger', err);
            }
          }
        }, 1500);
      }
    } catch (err) {
      logger.error('Failed to make chess move from web:', err);
    }
  });

  socket.on('catur_surrender_web', async ({ groupId }) => {
    const session = activeChessGames.get(groupId);
    if (!session) return;
    
    activeChessGames.delete(groupId);
    io.to(`catur_${groupId}`).emit('catur_finished', 'Permainan selesai karena ada yang menyerah.');

    const client = getClient();
    if (client) {
      await client.sendMessage(groupId, `🏳️ *PERMAINAN SELESAI* 🏳️\n\nPermainan catur selesai karena pemain menyerah via Web.`);
    }
  });

  // --- TIC TAC TOE SOCKET EVENT HANDLERS ---
  socket.on('ttt_join', ({ roomId, name }) => {
    const game = tttGames.get(roomId);
    if (!game) {
      return socket.emit('ttt_error', 'Ruang game tidak ditemukan.');
    }
    if (game.status === 'finished') {
      return socket.emit('ttt_error', 'Permainan sudah selesai.');
    }
    if (game.players.length >= 2) {
      return socket.emit('ttt_error', 'Ruang game sudah penuh (Maksimal 1 vs 1).');
    }

    const cleanName = name.trim();
    if (game.players.some(p => p.name.trim().toLowerCase() === cleanName.toLowerCase())) {
      return socket.emit('ttt_error', 'Nama ini sudah digunakan oleh Player 1. Silakan gunakan nama lain.');
    }

    const symbol = game.players.length === 0 ? 'X' : 'O';
    game.players.push({ id: socket.id, symbol, name: cleanName });
    socket.join(`ttt_${roomId}`);

    socket.emit('ttt_init', { symbol, board: game.board, players: game.players, currentTurn: game.currentTurn, status: game.status });
    io.to(`ttt_${roomId}`).emit('ttt_players_update', game.players);

    if (game.players.length === 2) {
      game.status = 'playing';
      io.to(`ttt_${roomId}`).emit('ttt_start', { currentTurn: game.currentTurn });
    }
  });

  socket.on('ttt_move', ({ roomId, index }) => {
    const game = tttGames.get(roomId);
    if (!game || game.status !== 'playing') return;

    const player = game.players.find(p => p.id === socket.id);
    if (!player || player.symbol !== game.currentTurn) return;

    if (game.board[index] !== null) return;

    game.board[index] = player.symbol;

    // Check winner
    const winPatterns = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8],
      [0, 3, 6], [1, 4, 7], [2, 5, 8],
      [0, 4, 8], [2, 4, 6]
    ];

    let hasWinner = false;
    for (const pattern of winPatterns) {
      const [a, b, c] = pattern;
      if (game.board[a] && game.board[a] === game.board[b] && game.board[a] === game.board[c]) {
        hasWinner = true;
        break;
      }
    }

    if (hasWinner) {
      game.status = 'finished';
      game.winner = player.symbol;
    } else if (game.board.every(cell => cell !== null)) {
      game.status = 'finished';
      game.winner = 'Draw';
    } else {
      game.currentTurn = game.currentTurn === 'X' ? 'O' : 'X';
    }

    io.to(`ttt_${roomId}`).emit('ttt_update', {
      board: game.board,
      currentTurn: game.currentTurn,
      status: game.status,
      winner: game.winner
    });

    if (game.status === 'finished') {
      (async () => {
        let resultText = `🎮 *GAME SELESAI: TIC TAC TOE* 🎮\n`;
        resultText += `──────────────────\n\n`;
        if (game.winner === 'Draw') {
          resultText += `🤝 *Hasil akhir: SERI (Draw)!*\n`;
        } else {
          const winnerPlayer = game.players.find(p => p.symbol === game.winner);
          const loserPlayer = game.players.find(p => p.symbol !== game.winner);
          resultText += `🏆 *Pemenang:* ${winnerPlayer ? winnerPlayer.name : game.winner}\n`;
          resultText += `💀 *Kalah:* ${loserPlayer ? loserPlayer.name : 'Lawan'}\n`;
        }
        resultText += `\nTerima kasih telah bermain! Room ID: \`${roomId}\``;
        
        try {
          await sendWhatsAppMessage(game.groupId, resultText);
        } catch (err) {
          logger.error("Failed to send TTT results to WA:", err);
        }
        
        activeGroupGames.delete(game.groupId);
      })();
    }
  });

  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
    
    // Check if player in active TTT games
    for (const [roomId, game] of tttGames.entries()) {
      const playerIdx = game.players.findIndex(p => p.id === socket.id);
      if (playerIdx !== -1) {
        const leavingPlayer = game.players[playerIdx];
        game.players.splice(playerIdx, 1);
        
        if (game.status === 'playing') {
          game.status = 'finished';
          const remainingPlayer = game.players[0];
          game.winner = remainingPlayer ? remainingPlayer.symbol : null;
          
          io.to(`ttt_${roomId}`).emit('ttt_update', {
            board: game.board,
            currentTurn: game.currentTurn,
            status: game.status,
            winner: game.winner,
            message: `Lawan (${leavingPlayer.name}) terputus dari permainan.`
          });
          
          (async () => {
            let resultText = `🎮 *GAME SELESAI: TIC TAC TOE* 🎮\n`;
            resultText += `──────────────────\n\n`;
            resultText += `⚠️ Lawan (${leavingPlayer.name}) keluar/terputus dari permainan.\n`;
            if (remainingPlayer) {
              resultText += `🏆 Pemenang: *${remainingPlayer.name}* (Forfeit)\n`;
            }
            resultText += `\nRoom ID: \`${roomId}\``;
            
            try {
              await sendWhatsAppMessage(game.groupId, resultText);
            } catch (err) {
              logger.error("Failed to send TTT forfeit results to WA:", err);
            }
            activeGroupGames.delete(game.groupId);
          })();
        } else if (game.status === 'waiting') {
          io.to(`ttt_${roomId}`).emit('ttt_players_update', game.players);
        }
      }
    }
  });

  socket.on('disconnect_dashboard', () => {
    logger.info(`Dashboard Client disconnected: ${socket.id}`);
  });
});

// Real-time Metrics Broadcaster (Every 3 seconds)
setInterval(async () => {
  if (io.sockets.sockets.size > 0) {
    const rssMemory = Math.round(process.memoryUsage().rss / 1024 / 1024);
    const freeMemory = Math.round(os.freemem() / 1024 / 1024);
    const cpuLoad = os.loadavg()[0];

    io.emit('server_metrics', {
      memory: rssMemory,
      freeMemory,
      cpu: cpuLoad,
      uptime: Math.floor(process.uptime())
    });
  }
}, 3000);



// Start Express, Bot Service, Scheduler and dynamic command loading
server.listen(PORT, async () => {
  logger.info("=================================================");
  logger.info("   UNIVERSITAS TERBUKA WHATSAPP AI ASSISTANT     ");
  logger.info(`   Server running on http://localhost:${PORT}      `);
  logger.info("=================================================");
  
  // 1. Seed default credentials if database is empty
  await seedAdminUser();

  // 2. Load commands dynamically
  await loadCommands();

  // 3. Initialize Scheduler and baseline seeds
  await initScheduler();
  
  // 4. Initialize WhatsApp Bot Client
  initWhatsAppClient();

  // 5. Load dynamic plugins (now handled automatically in ready event in whatsappClient.ts)

  // 6. Start TryCloudflare Tunnel
  try {
    startCloudflareTunnel(Number(PORT));
  } catch (tunnelErr) {
    logger.warn('Failed to start Cloudflare tunnel:', tunnelErr);
  }
});

// Graceful shutdowns
process.on('SIGTERM', () => {
  logger.info("SIGTERM received. Shutting down gracefully...");
  server.close(() => {
    logger.info("HTTP server closed.");
    process.exit(0);
  });
});
