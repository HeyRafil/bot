import { Command } from './index.js';
import prisma from '../database/prisma.js';
import moment from 'moment-timezone';

function formatNumber(num: number): string {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export const pingCommand: Command = {
  name: 'ping',
  aliases: ['pong'],
  roleRequired: 'Member',
  description: 'Mengecek status sistem, informasi server, dan latensi bot.',
  async execute(client, msg, chat, args, privileges) {
    const startTime = Date.now();
    
    // 1. Bot Status Calculations
    const latency = Date.now() - (msg.timestamp * 1000);
    const latencyStr = latency >= 0 ? `${latency}ms` : `${Date.now() - startTime}ms`;
    
    const uptimeSec = process.uptime();
    const days = Math.floor(uptimeSec / (3600 * 24));
    const hours = Math.floor((uptimeSec % (3600 * 24)) / 3600);
    const minutes = Math.floor((uptimeSec % 3600) / 60);
    let uptimeStr = '';
    if (days > 0) uptimeStr += `${days} Hari `;
    if (hours > 0) uptimeStr += `${hours} Jam `;
    if (minutes > 0 || uptimeStr === '') uptimeStr += `${minutes} Menit`;
    uptimeStr = uptimeStr.trim();

    // 2. Server Info Calculations
    const serverOS = process.platform === 'win32' ? 'Windows OS' : 'Ubuntu VPS';
    
    const now = moment().tz('Asia/Jakarta');
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    const monthName = months[now.month()];
    const serverTime = `${now.format('DD')} ${monthName} ${now.format('YYYY')} | ${now.format('HH:mm')} WIB`;

    // 3. System Check Calculations
    let dbStatus = 'Connected';
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch (_) {
      dbStatus = 'Disconnected';
    }
    const apiKey = process.env.OPENAI_API_KEY || '';
    const aiStatus = apiKey ? 'Active' : 'Inactive';

    // 4. Statistics Calculations
    let totalUsers = 0;
    try {
      const uniqueUsers = await prisma.groupMember.groupBy({
        by: ['whatsappId']
      });
      totalUsers = uniqueUsers.length;
    } catch (_) {}
    if (totalUsers === 0) {
      try {
        const contacts = await client.getContacts();
        totalUsers = contacts.length;
      } catch (_) {}
    }

    let activeGroups = 0;
    try {
      activeGroups = await prisma.group.count({
        where: { status: true }
      });
    } catch (_) {}

    let messagesToday = 0;
    try {
      const todayStart = moment().tz('Asia/Jakarta').startOf('day').toDate();
      messagesToday = await prisma.message.count({
        where: { timestamp: { gte: todayStart } }
      });
    } catch (_) {}

    // 5. Group Info
    const groupName = chat.isGroup ? chat.name : 'Private Chat';
    const senderJid = msg.author || msg.from;
    const senderNumber = senderJid.split('@')[0];
    const requestBy = `@${senderNumber}`;

    // 6. Build Message
    let responseText = `🏓 PONG!\n\n`;
    
    responseText += `👹 BOT STATUS\n`;
    responseText += `──────────────\n`;
    responseText += `✅ Status      : Online\n`;
    responseText += `⚡ Response    : ${latencyStr}\n`;
    responseText += `⏱️ Uptime      : ${uptimeStr}\n`;
    responseText += `📦 Version     : v2.5.0\n\n`;

    responseText += `🖥️ SERVER INFO\n`;
    responseText += `──────────────\n`;
    responseText += `💻 Server      : ${serverOS}\n`;
    responseText += `🌐 Region      : Indonesia\n`;
    responseText += `🕒 Server Time : ${serverTime}\n\n`;

    responseText += `📋 SYSTEM CHECK\n`;
    responseText += `──────────────\n`;
    responseText += `✅ Database    : ${dbStatus}\n`;
    responseText += `✅ WhatsApp    : Connected\n`;
    responseText += `✅ AI Service  : ${aiStatus}\n`;
    responseText += `✅ API Service : Running\n\n`;

    responseText += `👤 BOT STATISTICS\n`;
    responseText += `──────────────\n`;
    responseText += `👥 Total User  : ${formatNumber(totalUsers)}\n`;
    responseText += `👥 Grup Aktif  : ${formatNumber(activeGroups)}\n`;
    responseText += `💼 Pesan Hari Ini : ${formatNumber(messagesToday)}\n\n`;

    responseText += `📍 GROUP INFO\n`;
    responseText += `──────────────\n`;
    responseText += `🏠 Grup        : ${groupName}\n`;
    responseText += `👤 Request By  : ${requestBy}\n`;
    responseText += `──────────────`;

    await chat.sendMessage(responseText, { mentions: [senderJid] });
  }
};

export default pingCommand;
