import { Command } from './index.js';
import localDb from '../database/localDb.js';

export const bukasaranCommand: Command = {
  name: 'bukasaran',
  aliases: ['listsaran', 'bukaSaran'],
  roleRequired: 'Owner',
  description: 'Membuka dan membaca seluruh saran masuk dari database (Khusus Owner).',
  async execute(client, msg, chat, args, privileges) {
    // Optional parameter to clear all suggestions
    if (args[0] === 'clear' || args[0] === 'hapus' || args[0] === 'bersihkan') {
      try {
        await localDb.clearCollection('suggestions');
        return chat.sendMessage(`✅ *Kotak Saran*: Semua saran di database berhasil dikosongkan.`);
      } catch (err) {
        return chat.sendMessage(`❌ Gagal membersihkan kotak saran.`);
      }
    }

    try {
      const suggestions = await localDb.getCollection('suggestions', []);

      if (suggestions.length === 0) {
        return chat.sendMessage(`📪 *Kotak Saran*: Saat ini tidak ada saran masuk di database.`);
      }

      let text = `*📪 DAFTAR SARAN MASUK (Total: ${suggestions.length}) 📪*\n\n`;
      
      // Show suggestions (up to 15 latest entries)
      const latestSuggestions = [...suggestions].reverse().slice(0, 15);

      latestSuggestions.forEach((s: any, idx: number) => {
        const senderNum = s.sender.split('@')[0];
        text += `*${idx + 1}. Pengirim:* ${s.name} (@${senderNum})\n`;
        text += `• *Grup/Lokasi:* ${s.group || 'Private Chat'}\n`;
        text += `• *Waktu:* ${s.date}\n`;
        text += `• *Isi Saran:* "${s.text}"\n\n`;
      });

      if (suggestions.length > 15) {
        text += `_Menampilkan 15 saran terbaru dari total ${suggestions.length} saran._\n\n`;
      }

      text += `💡 *Tips*: Ketik \`.bukasaran clear\` untuk mengosongkan seluruh database saran.`;

      // Mentions JID list
      const mentions = latestSuggestions.map((s: any) => s.sender).filter(jid => jid);

      await chat.sendMessage(text, { mentions });
    } catch (err: any) {
      await chat.sendMessage(`❌ Gagal membuka database saran: ${err.message}`);
    }
  }
};

export default bukasaranCommand;
