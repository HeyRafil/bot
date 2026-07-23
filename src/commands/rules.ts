import { Command } from './index.js';
import { getSetting } from '../config/settings.js';

export const rulesCommand: Command = {
  name: 'rules',
  aliases: ['aturan', 'rule'],
  roleRequired: 'Member',
  description: 'Menampilkan aturan penggunaan bot di dalam grup.',
  async execute(client, msg, chat, args, privileges) {
    const isAntiLinkEnabled = await getSetting('ANTI_LINK_ENABLED') !== false;
    const antiLinkStatus = isAntiLinkEnabled ? 'Aktif' : 'Nonaktif';
    
    const text = `📜 *ATURAN PENGGUNAAN BOT WA UT* 📜

1. *Dilarang Spam:* Cooldown respon bot adalah 3 detik per ruang obrolan. Harap bersabar menunggu balasan bot.
2. *Gunakan Bahasa Sopan:* Bot tidak akan merespon kata-kata kasar atau toxic yang tidak sopan.
3. *Dilarang Mengirim Link Iklan/Promosi:* Sistem bot di grup mendeteksi link otomatis dan akan menghapusnya demi kenyamanan bersama. (Status Anti-Link: *${antiLinkStatus}*)
4. *Perintah Administratif:* Beberapa perintah moderasi/pengaturan hanya dapat diakses oleh owner, admin, dan moderator bot.

Mari jaga lingkungan tutorial kelas tetap kondusif dan fokus pada akademik! 📚🎓`;

    await msg.reply(text);
  }
};

export default rulesCommand;
