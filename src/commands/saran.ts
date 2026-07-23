import { Command } from './index.js';
import localDb from '../database/localDb.js';

export const saranCommand: Command = {
  name: 'saran',
  aliases: ['feedback', 'suggest'],
  roleRequired: 'Member',
  description: 'Mengirimkan saran atau kritik tentang bot ke database owner.',
  async execute(client, msg, chat, args, privileges) {
    if (args.length === 0) {
      return chat.sendMessage(`❌ *Error*: Harap masukkan isi saran Anda.\nContoh: \`.saran perbaiki respon AI ujian\``);
    }

    const suggestionText = args.join(' ');
    const senderJid = msg.author || msg.from;
    const senderNum = senderJid.split('@')[0];
    
    let senderName = 'Anonim';
    try {
      const contact = await msg.getContact();
      senderName = contact.pushname || contact.name || 'Anonim';
    } catch (_) {}

    const suggestionItem = {
      id: new Date().getTime().toString(),
      sender: senderJid,
      name: senderName,
      group: chat.isGroup ? chat.name : 'Private Chat',
      text: suggestionText,
      date: new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })
    };

    try {
      await localDb.insert('suggestions', suggestionItem);
      
      // Reply to user
      let response = `✅ *Saran Diterima*\n\n`;
      response += `Terima kasih *${senderName}* atas masukannya! Saran Anda telah disimpan ke database owner bot untuk ditinjau lebih lanjut.`;
      
      await chat.sendMessage(response);
    } catch (err: any) {
      await chat.sendMessage(`❌ Gagal menyimpan saran ke database. Silakan coba beberapa saat lagi.`);
    }
  }
};

export default saranCommand;
