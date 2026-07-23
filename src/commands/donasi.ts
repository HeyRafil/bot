import { Command } from './index.js';

export const donasiCommand: Command = {
  name: 'donasi',
  aliases: ['donate', 'sociabuzz', 'support'],
  roleRequired: 'Member',
  description: 'Dukung pengembangan bot melalui SociaBuzz.',
  async execute(client, msg, chat, args, privileges) {
    let text = `☕ *DUKUNG / DONASI DEVELOPER* ☕\n\n`;
    text += `Halo @${(msg.author || msg.from).split('@')[0]}!\n`;
    text += `Jika Anda merasa bot ini bermanfaat dan ingin mendukung pengembangan serta biaya server operasional bot WhatsApp UT ini, Anda dapat berdonasi secara sukarela melalui tautan resmi SociaBuzz berikut:\n\n`;
    text += `🔗 *Link SociaBuzz:* https://sociabuzz.com/rafildev\n\n`;
    text += `Dukungan Anda sangat berarti bagi kelangsungan sistem asisten akademik modern ini. Terima kasih banyak atas apresiasi dan kebaikan Anda! 🙏✨`;

    await chat.sendMessage(text, {
      mentions: [msg.author || msg.from]
    });
  }
};

export default donasiCommand;
