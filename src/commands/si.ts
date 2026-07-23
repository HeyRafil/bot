import { Command } from './index.js';
import localDb from '../database/localDb.js';

export const siCommand: Command = {
  name: 'si',
  aliases: ['sisfo', 'sisteminformasi'],
  roleRequired: 'Member',
  description: 'Mencari dan memfilter bahan belajar mendalam untuk mata kuliah S1 Sistem Informasi.',
  async execute(client, msg, chat, args, privileges) {
    try {
      // Load SI materials collection using localDb
      const materials = await localDb.getCollection('si_materials', []);

      if (materials.length === 0) {
        return chat.sendMessage(`❌ Database bahan belajar Sistem Informasi saat ini sedang kosong.`);
      }

      // 1. If no query is provided, list all available courses
      if (args.length === 0) {
        let text = `*💻 PORTAL BAHAN BELAJAR MENDALAM S1 SISTEM INFORMASI UT 💻*\n\n`;
        text += `Pilih mata kuliah yang ingin Anda pelajari secara mendalam. Masukkan kode/nama mata kuliah untuk melihat deskripsi, silabus topik, tips sukses nilai A, dan materi lengkap.\n\n`;
        text += `*Cara Mencari & Memfilter:*\n`;
        text += `👉 Ketik: \`.si [kode matakuliah]\` (Contoh: \`.si MSIM4206\`)\n`;
        text += `👉 Ketik: \`.si [nama matakuliah]\` (Contoh: \`.si basis data\`)\n\n`;
        text += `*Daftar Mata Kuliah SI di Database:*\n`;
        
        materials.forEach((m: any) => {
          text += `• *${m.code}* - ${m.name} (Semester ${m.semester})\n`;
        });
        
        return chat.sendMessage(text);
      }

      // 2. Search and filter by query
      const query = args.join(' ').toLowerCase().trim();
      const matches = materials.filter((m: any) => 
        m.code.toLowerCase().includes(query) || 
        m.name.toLowerCase().includes(query)
      );

      if (matches.length === 0) {
        return chat.sendMessage(`❌ Tidak ditemukan bahan belajar untuk kata kunci *"${args.join(' ')}"*.\n\nCoba ketik \`.si\` saja untuk melihat seluruh daftar mata kuliah S1 Sistem Informasi yang tersedia.`);
      }

      // 3. Format matches with high depth and clarity
      let text = `*📚 MODUL BELAJAR MANDIRI S1 SISTEM INFORMASI UT 📚*\n`;
      text += `Hasil Pencarian: *"${args.join(' ')}"* (${matches.length} hasil ditemukan)\n\n`;

      matches.forEach((m: any) => {
        text += `*📖 [${m.code}] ${m.name}*\n`;
        text += `• *Rekomendasi Semester*: ${m.semester}\n`;
        text += `• *Deskripsi*: ${m.description}\n\n`;
        
        // Syllabus Section
        text += `*📑 Topik & Silabus Utama (Modul 1-9)*:\n`;
        m.topics.forEach((t: string, idx: number) => {
          text += `  ${idx + 1}. ${t}\n`;
        });
        text += `\n`;
        
        // Study Tips Section
        text += `*💡 Tips Sukses Kuliah & Nilai A*:\n`;
        text += `_${m.study_tips}_\n\n`;
        
        // Official Links Section
        text += `*🔗 Referensi Bahan Ajar Resmi UT*:\n`;
        if (m.rbv_link) {
          text += `• *Buku Materi Pokok (RBV)*:\n  👉 ${m.rbv_link}\n`;
        }
        if (m.repo_link) {
          text += `• *Repository UT (Soal Latihan & Jurnal)*:\n  👉 ${m.repo_link}\n`;
        }
        if (m.ocw_link) {
          text += `• *Open CourseWare (OCW) UT*:\n  👉 ${m.ocw_link}\n`;
        }
        
        // External Resources Section
        if (m.external_resources && m.external_resources.length > 0) {
          text += `\n*🌐 Referensi Belajar Eksternal Kredibel*:\n`;
          m.external_resources.forEach((ext: any) => {
            text += `• *${ext.source}* (${ext.name})\n  🔗 ${ext.url}\n`;
          });
        }
        text += `──────────────────\n\n`;
      });

      // Trim trailing spaces and lines
      text = text.trim();

      await chat.sendMessage(text);
    } catch (err: any) {
      await chat.sendMessage(`❌ Terjadi kesalahan saat membaca database bahan ajar SI.`);
    }
  }
};

export default siCommand;
