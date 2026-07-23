import { Command } from './index.js';
import { queryVisionRAG } from '../services/aiService.js';
import logger from '../utils/logger.js';

export const ocrCommand: Command = {
  name: 'ocr',
  aliases: ['analisis', 'bacanilai', 'readktpu'],
  roleRequired: 'Member',
  description: 'Menganalisis gambar transkrip nilai DNU atau KTPU mahasiswa UT.',
  async execute(client, msg, chat, args, privileges) {
    let mediaMessage = msg;

    // Check if user replied to an image instead of sending it directly with the caption
    if (!msg.hasMedia && msg.hasQuotedMsg) {
      try {
        const quotedMsg = await msg.getQuotedMessage();
        if (quotedMsg.hasMedia) {
          mediaMessage = quotedMsg;
        }
      } catch (err) {
        logger.error('Failed to get quoted message in OCR command', err);
      }
    }

    if (!mediaMessage.hasMedia) {
      return msg.reply('❌ *Format Salah!* Kirim gambar DNU/KTPU Anda dengan teks/caption *.ocr*, atau balas (*reply*) gambar tersebut dengan mengetik *.ocr*.');
    }

    const mime = mediaMessage.type || '';
    // Limit to image types only
    if (mediaMessage.type !== 'image') {
      return msg.reply('❌ Bot hanya mendukung pembacaan format gambar (JPG/PNG/WEBP).');
    }

    try {
      if (typeof (chat as any).sendStateTyping === 'function') {
        try { await (chat as any).sendStateTyping(); } catch (_) {}
      }

      await msg.reply('⏳ *Menganalisis berkas DNU/KTPU Anda...* Proses ini membutuhkan waktu sekitar 10-15 detik melalui AI Vision.');

      const media = await mediaMessage.downloadMedia();
      if (!media || !media.data) {
        return msg.reply('❌ Gagal mendownload berkas gambar dari WhatsApp. Pastikan media terunduh dengan sempurna di HP Anda.');
      }

      const prompt = `Anda adalah AI Analis Akademik Universitas Terbuka Batam yang sangat detail dan profesional.
Tugas Anda adalah membaca berkas gambar Daftar Nilai Ujian (DNU) atau Kartu Tanda Peserta Ujian (KTPU) Universitas Terbuka yang dilampirkan oleh mahasiswa.

Tolong berikan keluaran dengan struktur berikut:
1. 📋 *IDENTIFIKASI DOKUMEN*:
   - Tentukan jenis dokumen (Daftar Nilai Ujian / Transkrip Nilai / Kartu Ujian KTPU).
   - Ekstrak NIM & Nama Mahasiswa jika tertera di gambar.

2. 📊 *HASIL EKSTRAKSI DATA*:
   - Jika ini DNU/Transkrip Nilai: List kode mata kuliah, nama mata kuliah, sks, dan nilai huruf (A, B, C, D, E). Hitung perkiraan IPK sementara (gunakan bobot standar: A=4, B=3, C=2, D=1, E=0).
   - Jika ini KTPU/Kartu Ujian: List mata kuliah, tanggal/hari ujian, jam/sesi ujian, lokasi ruang ujian, dan tipe ujian (THE / UO / UTM).

3. 💡 *ANALISIS & REKOMENDASI*:
   - Jika DNU: Soroti mata kuliah yang mendapatkan nilai D atau E (tidak lulus). Berikan saran tegas untuk mengulang mata kuliah tersebut di semester depan guna menaikkan IPK.
   - Jika KTPU: Berikan pengingat mengenai jadwal ujian terdekat dan hal penting yang harus dipersiapkan (kartu identitas, pensil/bolpoin, cetak fisik KTPU).

Gunakan format teks tebal (bold), bullet point, dan emoji yang rapi serta sopan dalam Bahasa Indonesia.`;

      const analysisResult = await queryVisionRAG(media.data, media.mimetype, prompt);
      
      await msg.reply(analysisResult);
    } catch (err: any) {
      logger.error('OCR command failed', err);
      await msg.reply('❌ Maaf, terjadi kegagalan sistem saat menganalisis gambar Anda. Pastikan API key AI Vision valid dan gambar memiliki teks yang cukup jelas.');
    } finally {
      if (typeof (chat as any).clearState === 'function') {
        try { await (chat as any).clearState(); } catch (_) {}
      }
    }
  }
};

export default ocrCommand;
