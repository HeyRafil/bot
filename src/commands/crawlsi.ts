import { Command } from './index.js';
import { crawlSiCourses } from '../crawler/siWebCrawler.js';

export const crawlsiCommand: Command = {
  name: 'crawlsi',
  aliases: ['updatesi', 'scrapesi'],
  roleRequired: 'Owner',
  description: 'Mencari (crawl) sendiri daftar mata kuliah S1 Sistem Informasi dari website resmi UT & menyimpannya ke database.',
  async execute(client, msg, chat, args, privileges) {
    await chat.sendMessage(`🔍 *Pencarian Otomatis*: Sedang menghubungkan dan men-scan kurikulum S1 Sistem Informasi di website resmi UT (si-fst.ut.ac.id & fst.ut.ac.id)...`);

    try {
      const result = await crawlSiCourses();

      if (result.added.length === 0 && result.updated.length === 0) {
        return chat.sendMessage(`✅ *Selesai*: Tidak ada penambahan mata kuliah baru. Database \`si_materials.json\` Anda saat ini sudah mutakhir.`);
      }

      let response = `✅ *Crawl Berhasil*: Database \`si_materials.json\` telah diperbarui!\n\n`;

      if (result.added.length > 0) {
        response += `*➕ Mata Kuliah Baru Ditambahkan (${result.added.length}):*\n`;
        result.added.forEach((item: string) => {
          response += `• ${item}\n`;
        });
        response += `\n`;
      }

      if (result.updated.length > 0) {
        response += `*🔄 Mata Kuliah Diperbarui (${result.updated.length}):*\n`;
        result.updated.forEach((item: string) => {
          response += `• ${item}\n`;
        });
        response += `\n`;
      }

      response += `💡 *Info*: Gunakan perintah \`.si\` untuk menelusuri dan mencari kembali data baru tersebut.`;
      
      await chat.sendMessage(response.trim());
    } catch (err: any) {
      await chat.sendMessage(`❌ Terjadi kesalahan saat menjalankan crawler kurikulum SI: ${err.message}`);
    }
  }
};

export default crawlsiCommand;
