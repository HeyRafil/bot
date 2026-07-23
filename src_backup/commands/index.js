import moment from 'moment-timezone';
import { runCrawler } from '../crawler/academicCrawler.js';
import localDb from '../database/localDb.js';
import { queryRAG } from '../services/aiService.js';
import logger from '../utils/logger.js';
import { backupDatabase } from '../utils/backup.js';
import { getSetting, updateSettings } from '../config/settings.js';

/**
 * Main Command Router
 */
export async function executeCommand(client, msg, chat, commandName, args, privileges) {
  const { isOwner, isAdmin } = privileges;

  switch (commandName) {
    case 'menu':
    case 'help':
      await handleHelp(msg);
      break;
    
    case 'ai':
      await handleAi(msg, args);
      break;

    case 'registrasi':
      await handleRegistrasi(msg);
      break;

    case 'ujian':
      await handleUjian(msg, args);
      break;

    case 'uobm':
      await handleUjian(msg, ['uobm']);
      break;

    case 'uolp':
      await handleUjian(msg, ['uolp']);
      break;

    case 'uaop':
      await handleUjian(msg, ['uaop']);
      break;

    case 'the':
      await handleUjian(msg, ['the']);
      break;

    case 'tuton':
      await handleTuton(msg);
      break;

    case 'myut':
      await handleMyUt(msg);
      break;

    case 'materi':
      await handleMateri(msg);
      break;

    case 'faq':
      await handleFaq(msg, args);
      break;

    case 'pengumuman':
      await handlePengumuman(msg);
      break;

    case 'deadline':
    case 'jadwal':
    case 'kalender':
      await handleCalendar(msg);
      break;

    case 'owner':
      await handleOwner(msg);
      break;

    case 'rules':
      await handleRules(msg);
      break;

    case 'status':
      await handleStatus(msg);
      break;

    // Admin/Owner only commands
    case 'addgroup':
      if (!isOwner) return msg.reply("❌ Perintah ini hanya untuk Owner Bot.");
      if (!chat.isGroup) return msg.reply("❌ Perintah ini hanya dapat dilakukan di dalam Grup WhatsApp.");
      try {
        const groups = await localDb.getCollection('groups');
        if (groups.includes(chat.id._serialized)) {
          return msg.reply("ℹ️ Grup ini sudah terdaftar dalam whitelist.");
        }
        groups.push(chat.id._serialized);
        await localDb.saveCollection('groups', groups);
        await msg.reply(`✅ Grup *${chat.name}* (${chat.id._serialized}) berhasil ditambahkan ke whitelist bot.`);
      } catch (err) {
        logger.error("Failed to add group to whitelist", err);
        await msg.reply("❌ Gagal mendaftarkan grup.");
      }
      break;

    case 'delgroup':
      if (!isOwner) return msg.reply("❌ Perintah ini hanya untuk Owner Bot.");
      if (!chat.isGroup) return msg.reply("❌ Perintah ini hanya dapat dilakukan di dalam Grup WhatsApp.");
      try {
        let groups = await localDb.getCollection('groups');
        if (!groups.includes(chat.id._serialized)) {
          return msg.reply("ℹ️ Grup ini belum terdaftar dalam whitelist.");
        }
        groups = groups.filter(id => id !== chat.id._serialized);
        await localDb.saveCollection('groups', groups);
        await msg.reply(`✅ Grup *${chat.name}* berhasil dihapus dari whitelist bot.`);
      } catch (err) {
        logger.error("Failed to delete group from whitelist", err);
        await msg.reply("❌ Gagal menghapus grup.");
      }
      break;

    case 'listgroups':
      if (!isOwner) return msg.reply("❌ Perintah ini hanya untuk Owner Bot.");
      try {
        const groups = await localDb.getCollection('groups');
        if (groups.length === 0) {
          return msg.reply("ℹ️ Tidak ada grup yang terdaftar di whitelist.");
        }
        let reply = `📋 *DAFTAR GRUP WHITELIST BOT UT* 📋\n\n`;
        for (const [idx, groupId] of groups.entries()) {
          let name = "Grup Tidak Dikenal";
          try {
            const c = await client.getChatById(groupId);
            name = c.name;
          } catch (_) {}
          reply += `${idx + 1}. *${name}*\nID: \`${groupId}\`\n\n`;
        }
        await msg.reply(reply);
      } catch (err) {
        logger.error("Failed to list whitelist groups", err);
        await msg.reply("❌ Gagal mengambil daftar grup.");
      }
      break;

    case 'enable':
      if (!isOwner) return msg.reply("❌ Perintah ini hanya untuk Owner Bot.");
      if (args.length === 0 || args[0].toLowerCase() !== 'link') {
        return msg.reply("ℹ️ Format salah. Silakan ketik: *.enable link*");
      }
      try {
        await updateSettings({ ANTI_LINK_ENABLED: true });
        await msg.reply("✅ Fitur Anti-Link berhasil diaktifkan untuk grup.");
      } catch (err) {
        logger.error("Failed to enable anti-link", err);
        await msg.reply("❌ Gagal mengaktifkan fitur Anti-Link.");
      }
      break;

    case 'disable':
      if (!isOwner) return msg.reply("❌ Perintah ini hanya untuk Owner Bot.");
      if (args.length === 0 || args[0].toLowerCase() !== 'link') {
        return msg.reply("ℹ️ Format salah. Silakan ketik: *.disable link*");
      }
      try {
        await updateSettings({ ANTI_LINK_ENABLED: false });
        await msg.reply("✅ Fitur Anti-Link berhasil dinonaktifkan untuk grup.");
      } catch (err) {
        logger.error("Failed to disable anti-link", err);
        await msg.reply("❌ Gagal menonaktifkan fitur Anti-Link.");
      }
      break;

    case 'crawl':
      if (!isOwner && !isAdmin) return msg.reply("❌ Perintah ini hanya untuk Owner/Admin Bot.");
      await msg.reply("🔄 Memulai Web Crawler UT secara manual...");
      try {
        const count = await runCrawler();
        await msg.reply(`✅ Crawl selesai! Berhasil mengekstrak/memperbarui *${count}* data.`);
      } catch (err) {
        await msg.reply(`❌ Gagal merayap website: ${err.message}`);
      }
      break;

    case 'backup':
      if (!isOwner && !isAdmin) return msg.reply("❌ Perintah ini hanya untuk Owner/Admin Bot.");
      await msg.reply("📦 Sedang membuat backup database lokal...");
      try {
        const zipPath = await backupDatabase();
        await msg.reply(`✅ Backup selesai! File disimpan ke: \`${zipPath}\``);
      } catch (err) {
        await msg.reply(`❌ Gagal membuat backup: ${err.message}`);
      }
      break;

    default:
      // Unknown command: silently ignore or reply with hint
      break;
  }
}

// ----------------------------------------------------
// COMMAND HANDLERS
// ----------------------------------------------------

async function handleHelp(msg) {
  const helpText = `🎓 *AI WHATSAPP ACADEMIC ASSISTANT UT* 🎓
Asisten Akademik Otomatis Universitas Terbuka Modern

*📚 Kategori Informasi Akademik:*
• *.registrasi* - Panduan registrasi mata kuliah & mahasiswa baru.
• *.ujian* - Panduan lengkap sistem ujian UT (THE, UOBM, UOLP, UTM).
• *.tuton* - Panduan Tutorial Online (Tuton) & Tutorial Web (Tuweb).
• *.myut* - Cara login & reset password MyUT.
• *.materi* - Info akses modul digital (RBV) & cetak (TBO).
• *.kalender* / *.jadwal* / *.deadline* - Kalender akademik terkini.
• *.faq* - Pertanyaan yang sering diajukan seputar UT.
• *.pengumuman* - Informasi & yudisium terbaru UT.

*🤖 Konsultasi AI (RAG):*
• *.ai [pertanyaan]* - Bertanya dengan kecerdasan buatan.
• Atau cukup tag bot *@mention [pertanyaan]* di grup.

*⚙️ Informasi Bot:*
• *.status* - Performa & uptime server VPS.
• *.rules* - Aturan penggunaan bot di dalam grup.
• *.owner* - Informasi kontak owner bot.

_Ketik perintah di atas tanpa tanda kurung. Gunakan titik (.) di awal._`;
  await msg.reply(helpText);
}

async function handleAi(msg, args) {
  if (args.length === 0) {
    return msg.reply("❌ Format salah. Silakan ketik: *.ai [pertanyaan Anda]*\nContoh: `.ai apa bedanya THE dan UOBM?`");
  }
  const query = args.join(' ');
  const chat = await msg.getChat();
  
  try {
    await chat.sendStateTyping();
    const response = await queryRAG(query);
    await msg.reply(response);
  } catch (err) {
    logger.error("AI command failed", err);
    await msg.reply("Maaf, terjadi kesalahan saat menghubungi AI.");
  } finally {
    try { await chat.clearState(); } catch (_) {}
  }
}

async function handleRegistrasi(msg) {
  const text = `📝 *PANDUAN REGISTRASI UNIVERSITAS TERBUKA* 📝

1. *Registrasi Akun Baru (Admisi)*
   • Buka portal admisi-sia.ut.ac.id.
   • Buat akun menggunakan email aktif dan isi form data diri secara lengkap.
   • Unggah berkas wajib (Ijazah legalisir, KTP asli, pas foto, dll).

2. *Registrasi Mata Kuliah*
   • Login ke portal *MyUT* (myut.ut.ac.id).
   • Masuk ke menu *Akademik* -> *Registrasi Mata Kuliah*.
   • Pilih mata kuliah sesuai dengan kurikulum/paket semester Anda.
   • Klik *Simpan* dan klik *Cetak LIP* (Lembar Informasi Pembayaran).

3. *Metode Pembayaran (LIP)*
   • Pembayaran harus dilakukan sebelum batas waktu penutupan LIP.
   • Pembayaran dapat dilakukan via Teller/ATM/Mobile Banking: *BRI, Mandiri, BTN, BNI*.
   • Serta melalui gerai ritel resmi: *Alfamart, Indomaret, Tokopedia*.

_Gunakan perintah *.kalender* untuk mengecek batas waktu registrasi semester ini._`;
  await msg.reply(text);
}

async function handleUjian(msg, args) {
  const mode = args.length > 0 ? args[0].toLowerCase() : '';

  if (mode === 'uobm') {
    const text = `🖥️ *UOBM (Ujian Online Berbasis Mata Kuliah)*
Ujian online yang dilaksanakan secara tatap muka di lokasi yang ditentukan UT.

• *Cara Kerja:* Mahasiswa datang ke lokasi ujian (UPBJJ/Sekolah mitra), mengerjakan soal secara digital pada PC/Laptop yang disediakan panitia.
• *Tipe Soal:* Pilihan Ganda (Objektif) atau Esai (tergantung mata kuliah).
• *Syarat Device:* Tidak perlu membawa device sendiri, PC disediakan penuh di lokasi.
• *Aturan Ujian:* Wajib membawa KTPU (Kartu Tanda Peserta Ujian) UOBM, kartu mahasiswa/KTP asli, berpakaian sopan (kemeja/berkerah), dan datang 30 menit sebelum jadwal.`;
    return msg.reply(text);
  }

  if (mode === 'the') {
    const text = `🏠 *THE (Take Home Exam)*
Ujian akhir semester yang dikerjakan secara mandiri di rumah secara open book.

• *Cara Kerja:* Buka laman *the.ut.ac.id* pada hari ujian Anda. Unduh naskah soal dan BJU (Buku Jawaban Ujian). Kerjakan di rumah secara mandiri.
• *Batas Waktu:* Durasi pengerjaan maksimal *12 jam* sejak naskah soal diunduh. Harus diunggah kembali ke laman THE sebelum waktu habis pada hari yang sama.
• *Tipe Soal:* Esai analisis/studi kasus.
• *Ketentuan:* BJU diunggah dalam format PDF. Pastikan jaringan internet stabil saat mengunggah. Jangan sampai terlambat karena sistem mengunci otomatis.`;
    return msg.reply(text);
  }

  if (mode === 'uolp') {
    const text = `🌐 *UOLP (Ujian Online Luar Negeri/Lainnya)*
Layanan ujian online khusus bagi mahasiswa UT yang berada di luar negeri atau kondisi khusus tertentu.

• *Cara Kerja:* Mahasiswa mengerjakan dari lokasi masing-masing menggunakan PC/Laptop pribadi.
• *Pengawasan:* Diawasi secara ketat dan real-time oleh pengawas UT menggunakan kamera Zoom/Teams.
• *Syarat Device:* Laptop/PC dengan web camera aktif, koneksi internet stabil minimal 5 Mbps, dan aplikasi Zoom terinstall.`;
    return msg.reply(text);
  }

  if (mode === 'uaop') {
    const text = `🔬 *UAOP (Ujian Asisten Online Praktik)*
Ujian online yang dikhususkan bagi mata kuliah praktik atau praktikum (seperti laboratorium/komputer).

• *Cara Kerja:* Mahasiswa mempraktikkan materi ujian secara langsung dipandu asisten/tutor online.
• *Lokasi:* Umumnya di lokasi UPBJJ atau lab yang ditunjuk, dengan panduan sistem asisten online.
• *Syarat:* Menyiapkan laporan praktik dan mempresentasikannya secara virtual.`;
    return msg.reply(text);
  }

  // Default / general info
  const text = `✏️ *SISTEM UJIAN UNIVERSITAS TERBUKA* ✏️

UT menyediakan beberapa metode ujian modern. Pilih perintah di bawah untuk detail lengkap:

1. *.uobm* - Ujian Online Berbasis Mata Kuliah (di lokasi UPBJJ)
2. *.the* - Take Home Exam (Ujian Esai Mandiri dari Rumah)
3. *.uolp* - Ujian Online Pengawasan Mandiri (Luar Negeri)
4. *.uaop* - Ujian Asisten Online Praktik (Praktikum)

• *Cetak KTPU (Kartu Ujian):* Cetak KTPU Anda secara mandiri di portal *MyUT* (myut.ut.ac.id) menjelang masa ujian untuk mengetahui jadwal dan tipe ujian masing-masing mata kuliah Anda.`;
  await msg.reply(text);
}

async function handleTuton(msg) {
  const text = `💻 *TUTORIAL ONLINE (TUTON) & TUTORIAL WEB (TUWEB)* 💻

1. *Tutorial Online (Tuton)*
   • Dilaksanakan secara asinkronus selama *8 Sesi (8 Minggu)* di portal *elearning.ut.ac.id*.
   • Mahasiswa wajib melakukan *Aktivasi Akun* dan mengisi form *Kesediaan Mengikuti Tuton* di awal semester.
   • Setiap sesi memiliki materi inisiasi, forum diskusi (Sesi 1-8), dan *Tugas Wajib* pada Sesi 3, 5, dan 7.
   • Kontribusi nilai Tuton terhadap nilai akhir matakuliah mencapai *30-50%* (jika nilai ujian UAS minimal 30).

2. *Tutorial Web (Tuweb)*
   • Dilaksanakan secara sinkronus (real-time virtual) menggunakan Microsoft Teams / Zoom.
   • Jadwal diatur oleh UPBJJ masing-masing (biasanya hari Sabtu/Minggu).
   • Menuntut kehadiran aktif mahasiswa secara virtual.

_Tips: Jangan tunda pengerjaan diskusi dan tugas. Batas waktu pengerjaan diskusi/tugas di Tuton adalah 2 minggu sejak sesi dibuka._`;
  await msg.reply(text);
}

async function handleMyUt(msg) {
  const text = `🔐 *SISTEM PORTAL MyUT MODERN* 🔐
Portal integrasi utama mahasiswa UT (myut.ut.ac.id).

• *Fitur Utama:*
  - Registrasi mata kuliah & Cetak LIP.
  - Cetak KTPU (Jadwal Ujian).
  - Cek nilai IPK & Transkrip nilai sementara.
  - Pengumuman kelulusan/yudisium.

• *Panduan Reset Password:*
  1. Buka laman *myut.ut.ac.id*.
  2. Klik link *Lupa Password* di bagian bawah.
  3. Masukkan NIM, tanggal lahir (format: DD-MM-YYYY), dan email terdaftar.
  4. Buka email Anda, klik link konfirmasi untuk membuat password baru.
  5. Jika email terdaftar sudah tidak aktif, segera ajukan perubahan data email ke UPBJJ setempat atau hubungi Hallo UT di 1500024.`;
  await msg.reply(text);
}

async function handleMateri(msg) {
  const text = `📖 *BAHAN AJAR & MATERI PEMBELAJARAN UT* 📖

Universitas Terbuka menyediakan bahan ajar dalam bentuk cetak maupun digital:

1. *Bahan Ajar Cetak (Modul)*
   • Dikirim ke alamat mahasiswa (jikit bayar paket SIPAS) atau dipesan mandiri di *Toko Buku Online (TBO)* di laman *tbo.ut.ac.id*.

2. *Ruang Baca Virtual (RBV) - Digital*
   • Mahasiswa dapat membaca seluruh modul UT secara gratis melalui laptop/PC.
   • Buka *pustaka.ut.ac.id* -> Pilih *Ruang Baca Virtual*.
   • Gunakan akun MyUT Anda untuk login membaca modul lengkap.

3. *Aplikasi BA Digital UT*
   • Unduh aplikasi *Bahan Ajar Digital UT* di Google Play Store untuk membaca modul secara offline via HP Android.`;
  await msg.reply(text);
}

async function handleFaq(msg, args) {
  try {
    const faqs = await localDb.getCollection('faq');
    if (faqs.length === 0) {
      return msg.reply("Maaf, database FAQ saat ini masih kosong. Silakan jalankan crawler.");
    }
    
    // Pick random FAQ if no query is provided
    if (args.length === 0) {
      const randomFaq = faqs[Math.floor(Math.random() * faqs.length)];
      return msg.reply(`❓ *FAQ UT: ${randomFaq.question}*\n\n💡 *Jawaban:*\n${randomFaq.answer}\n\n_Sumber: ${randomFaq.source}_`);
    }

    // Search matches
    const query = args.join(' ').toLowerCase();
    const matches = faqs.filter(f => f.question.toLowerCase().includes(query) || f.answer.toLowerCase().includes(query)).slice(0, 3);
    
    if (matches.length === 0) {
      return msg.reply(`Maaf, tidak ada FAQ yang cocok dengan kata kunci "${args.join(' ')}". Cobalah kata kunci lain.`);
    }

    let reply = `🔍 *Hasil Pencarian FAQ UT:* \n\n`;
    matches.forEach((f, idx) => {
      reply += `${idx + 1}. *Q: ${f.question}*\n*A:* ${f.answer}\n_Sumber: ${f.source}_\n\n`;
    });
    await msg.reply(reply);
  } catch (err) {
    logger.error("FAQ command failed", err);
    await msg.reply("Gagal mengambil FAQ.");
  }
}

async function handlePengumuman(msg) {
  try {
    const announcements = await localDb.getCollection('announcements');
    if (announcements.length === 0) {
      return msg.reply("📢 *Pengumuman UT* 📢\nBelum ada pengumuman terbaru di database lokal.");
    }

    let text = `📢 *PENGUMUMAN TERBARU UNIVERSITAS TERBUKA* 📢\n\n`;
    announcements.slice(0, 3).forEach((a, idx) => {
      text += `*${idx + 1}. ${a.title}*\n${a.content.substring(0, 250)}...\nSumber: ${a.source}\n\n`;
    });
    
    text += `_Silakan akses informasi lengkap di kemahasiswaan.ut.ac.id_`;
    await msg.reply(text);
  } catch (err) {
    logger.error("Announcement command failed", err);
    await msg.reply("Gagal memuat pengumuman.");
  }
}

async function handleCalendar(msg) {
  try {
    const schedules = await localDb.getCollection('schedules');
    if (schedules.length === 0) {
      // Default placeholder calendar
      const text = `🗓️ *KALENDER AKADEMIK UT (UMUM)* 🗓️

• *Semester Berjalan (Semester Terkini):*
  - Admisi Mahasiswa Baru: Juni - Agustus
  - Registrasi Mata Kuliah: Juni - Agustus
  - Batas Pembayaran LIP: Agustus akhir
  - Aktivasi & Kesediaan Tuton: September awal
  - Pelaksanaan Tuton: Oktober - November
  - Pelaksanaan Ujian (THE/UOBM): Desember awal

_Gunakan perintah *.ai kapan tanggal [kegiatan]?* untuk info detail dari website._`;
      return msg.reply(text);
    }

    let reply = `🗓️ *JADWAL & KALENDER AKADEMIK UT* 🗓️\n\n`;
    schedules.slice(0, 3).forEach((s) => {
      reply += `• *${s.title}*\n${s.content}\n_Sumber: ${s.source}_\n\n`;
    });
    await msg.reply(reply);
  } catch (err) {
    logger.error("Calendar command failed", err);
    await msg.reply("Gagal memuat kalender.");
  }
}

async function handleOwner(msg) {
  const ownerText = `👤 *KONTAK OWNER BOT* 👤

Jika Anda memiliki pertanyaan lebih lanjut, mengalami bug sistem bot, atau ingin melaporkan penyalahgunaan, silakan hubungi developer bot ini:

• *WhatsApp:* wa.me/${process.env.OWNER_NUMBER || '628123456789'}
• *Peran:* Administrator & System Engineer UT Bot

Terima kasih atas partisipasi Anda! 🎓`;
  await msg.reply(ownerText);
}

async function handleRules(msg) {
  const isAntiLinkEnabled = await getSetting('ANTI_LINK_ENABLED') !== false;
  const antiLinkStatus = isAntiLinkEnabled ? 'Aktif' : 'Nonaktif';
  
  const text = `📜 *ATURAN PENGGUNAAN BOT WA UT* 📜

1. *Dilarang Spamting:* Jeda/cooldown respon bot adalah 3 detik per ruang obrolan. Harap bersabar menunggu balasan bot.
2. *Gunakan Bahasa Sopan:* Bot tidak akan merespon kata-kata kotor, toxic, kasar, atau keluar dari konteks UT.
3. *Dilarang Mengirim Link Promosi:* Sistem bot di grup mendeteksi link promosi/scam otomatis dan akan menghapusnya demi keamanan rekan mahasiswa. (Status: *${antiLinkStatus}*)
4. *Admin Only Commands:* Beberapa perintah administratif hanya dapat diakses oleh owner bot dan admin grup resmi.

Mari jaga grup tutorial dan kelas tetap kondusif dan fokus pada pembelajaran! 📚🎓`;
  await msg.reply(text);
}

async function handleStatus(msg) {
  const rssMemory = Math.round(process.memoryUsage().rss / 1024 / 1024);
  const uptimeSeconds = Math.floor(process.uptime());
  const hours = Math.floor(uptimeSeconds / 3600);
  const minutes = Math.floor((uptimeSeconds % 3600) / 60);
  const isAntiLinkEnabled = await getSetting('ANTI_LINK_ENABLED') !== false;
  const apiKey = await getSetting('OPENAI_API_KEY');

  let aiSystemStatus = '⚠️ Offline Keyword Indexer';
  if (apiKey) {
    if (apiKey.startsWith('AIzaSy') || apiKey.startsWith('AQ.')) {
      aiSystemStatus = '✅ Google Gemini (RAG Active)';
    } else if (apiKey.startsWith('gsk_')) {
      aiSystemStatus = '✅ Groq Llama (RAG Active)';
    } else {
      aiSystemStatus = '✅ OpenAI GPT (RAG Active)';
    }
  }

  let dbStats = { knowledge: 0, faq: 0 };
  try {
    dbStats = await localDb.getStats();
  } catch (_) {}

  const text = `🤖 *STATUS & KINERJA BOT VPS* 🤖

• *Uptime:* ${hours} jam, ${minutes} menit
• *RAM Usage:* ${rssMemory} MB / 450 MB (Limit Restart)
• *Platform:* Node.js (ES Module)
• *Database Status:*
  - Artikel Pengetahuan: ${dbStats.knowledge} item
  - FAQ Akademik: ${dbStats.faq} item
• *Crawler Scheduler:* Aktif (setiap ${process.env.CRAWLER_INTERVAL_HOURS || 6} jam)
• *Sistem AI:* ${aiSystemStatus}
• *Anti-Link Filter:* ${isAntiLinkEnabled ? '✅ Aktif' : '❌ Nonaktif'}`;

  await msg.reply(text);
}
