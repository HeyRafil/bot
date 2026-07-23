import { Command } from './index.js';
import logger from '../utils/logger.js';
import { transcribeAudio } from '../services/aiService.js';
import { getSerializedId } from '../utils/chatHelper.js';
import pkg from 'whatsapp-web.js';

declare let window: any;

export const vntCommand: Command = {
  name: 'vnt',
  aliases: ['vntranscribe', 'transkripsi', 'vn'],
  roleRequired: 'Member',
  description: 'Mentranskripsikan pesan suara (voice note) yang dibalas.',
  async execute(client, msg, chat, args, privileges) {
    if (!msg.hasQuotedMsg) {
      return msg.reply('❌ Balas (reply/quote) sebuah rekaman suara (voice note) dengan mengetik *.vnt* untuk mentranskripsinya!');
    }

    try {
      let quotedMsg: any = null;
      try {
        quotedMsg = await msg.getQuotedMessage();
      } catch (err: any) {
        logger.warn(`[vnt.ts] getQuotedMessage failed: ${err.message}`);
      }

      if (!quotedMsg) {
        return msg.reply('❌ Gagal membaca pesan yang dibalas.');
      }

      // Verify media type
      const type = quotedMsg.type || '';
      const hasAudio = type.includes('audio') || type.includes('ptt') || type.includes('voice') || quotedMsg.hasMedia;
      
      if (!hasAudio) {
        return msg.reply('❌ Pesan yang dibalas harus berupa rekaman suara (voice note) atau audio!');
      }

      // Notify user processing has started
      let processingMsg: any = null;
      try {
        processingMsg = await msg.reply('⏳ Sedang memproses transkripsi rekaman suara... Mohon tunggu.');
      } catch (_) {}

      // Download audio data
      const media = await quotedMsg.downloadMedia();
      if (!media || !media.data) {
        if (processingMsg && typeof processingMsg.delete === 'function') {
          try { await processingMsg.delete(true); } catch (_) {}
        }
        return msg.reply('❌ Gagal mengunduh file audio dari WhatsApp.');
      }

      // Call transcription service
      const transcription = await transcribeAudio(media.data, media.mimetype);

      // Delete processing message indicator
      if (processingMsg && typeof processingMsg.delete === 'function') {
        try { await processingMsg.delete(true); } catch (_) {}
      }

      if (!transcription) {
        return msg.reply('❌ Gagal menghasilkan transkripsi audio.');
      }

      // Send the output back
      return msg.reply(transcription);

    } catch (err: any) {
      logger.error('[vnt.ts] Transcription failed:', err);
      return msg.reply(`❌ Terjadi kesalahan saat mentranskripsikan audio: ${err.message}`);
    }
  }
};

export default vntCommand;
