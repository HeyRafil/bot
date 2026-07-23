import { Command } from './index.js';
import { fetchGoldData } from '../services/goldService.js';
import logger from '../utils/logger.js';

export const xauCommand: Command = {
  name: 'xau',
  aliases: ['emas', 'gold', 'xauusd'],
  roleRequired: 'Member',
  description: 'Mengecek harga emas (XAU/USD) live beserta level Support & Resistance harian.',
  async execute(client, msg, chat, args, privileges) {
    try {
      if (typeof (chat as any).sendStateTyping === 'function') {
        try { await (chat as any).sendStateTyping(); } catch (_) {}
      }

      const data = await fetchGoldData();
      if (!data) {
        return msg.reply('❌ Gagal mengambil data harga XAU/USD. Silakan coba beberapa saat lagi.');
      }

      const { price, prevClose, high, low, pivot, r1, s1, r2, s2 } = data;
      const change = price - prevClose;
      const changePercent = (change / prevClose) * 100;
      const changeSign = change >= 0 ? '🟢 +' : '🔴 ';

      let response = `📈 *INFORMASI HARGA XAU/USD (GOLD)* 📈\n`;
      response += `━━━━━━━━━━━━━━━━━━━━━\n\n`;
      response += `📊 *DATA PASAR:*\n`;
      response += `• Harga Saat Ini: *$${price.toFixed(2)}*\n`;
      response += `• Perubahan Harian: *${changeSign}${change.toFixed(2)} (${changePercent.toFixed(2)}%)*\n`;
      response += `• Harian Tertinggi: *$${high.toFixed(2)}*\n`;
      response += `• Harian Terendah: *$${low.toFixed(2)}*\n\n`;
      
      response += `⚖️ *LEVEL PIVOT (SUPPORT / RESISTANCE):*\n`;
      response += `🔴 Resistance 2 (R2): *$${r2.toFixed(2)}*\n`;
      response += `🔴 Resistance 1 (R1): *$${r1.toFixed(2)}*\n`;
      response += `⚪ Pivot Point (P): *$${pivot.toFixed(2)}*\n`;
      response += `🟢 Support 1 (S1): *$${s1.toFixed(2)}*\n`;
      response += `🟢 Support 2 (S2): *$${s2.toFixed(2)}*\n\n`;

      // Calculate Recommendation
      let entryRecommendation = '';
      let slVal = 0;
      let tpVal1 = 0;
      let tpVal2 = 0;

      if (price <= s1 && price >= s2) {
        slVal = s2 - 3.0;
        tpVal1 = pivot;
        tpVal2 = r1;
        entryRecommendation = `🟢 *BUY ZONE (Area Beli)*\n` +
                              `👉 *Rekomendasi:* Cari konfirmasi pembalikan arah naik (bullish rejection).\n` +
                              `🎯 *Target TP 1:* $${tpVal1.toFixed(2)}\n` +
                              `🎯 *Target TP 2:* $${tpVal2.toFixed(2)}\n` +
                              `🛑 *Stop Loss:* $${slVal.toFixed(2)} (di bawah S2)`;
      } else if (price >= r1 && price <= r2) {
        slVal = r2 + 3.0;
        tpVal1 = pivot;
        tpVal2 = s1;
        entryRecommendation = `🔴 *SELL ZONE (Area Jual)*\n` +
                              `👉 *Rekomendasi:* Cari konfirmasi pembalikan arah turun (bearish rejection).\n` +
                              `🎯 *Target TP 1:* $${tpVal1.toFixed(2)}\n` +
                              `🎯 *Target TP 2:* $${tpVal2.toFixed(2)}\n` +
                              `🛑 *Stop Loss:* $${slVal.toFixed(2)} (di atas R2)`;
      } else if (price < s2) {
        slVal = s2 - 5.0;
        tpVal1 = s1;
        entryRecommendation = `⚠️ *OVERSOLD (Sangat Murah)*\n` +
                              `👉 *Rekomendasi:* Harga berada di bawah S2. Waspadai kelanjutan tren turun kuat (breakout) atau bersiap spekulasi Buy jika ada pola lilin pembalikan arah naik.\n` +
                              `🎯 *Target TP:* $${tpVal1.toFixed(2)}\n` +
                              `🛑 *Stop Loss:* $${slVal.toFixed(2)}`;
      } else if (price > r2) {
        slVal = r2 + 5.0;
        tpVal1 = r1;
        entryRecommendation = `⚠️ *OVERBOUGHT (Sangat Mahal)*\n` +
                              `👉 *Rekomendasi:* Harga berada di atas R2. Waspadai kelanjutan tren naik kuat (breakout) atau bersiap spekulasi Sell jika ada pola lilin pembalikan arah turun.\n` +
                              `🎯 *Target TP:* $${tpVal1.toFixed(2)}\n` +
                              `🛑 *Stop Loss:* $${slVal.toFixed(2)}`;
      } else {
        // Between s1 and r1 (around pivot)
        entryRecommendation = `⚪ *NEUTRAL / WAIT (Area Tunggu)*\n` +
                              `👉 *Rekomendasi:* Harga berada di area tengah dekat Pivot Point.\n` +
                              `💡 *Saran:* Tunggu harga mendekati area *Support 1 ($${s1.toFixed(2)})* untuk opsi *BUY* atau mendekati *Resistance 1 ($${r1.toFixed(2)})* untuk opsi *SELL* agar mendapatkan rasio Risk-to-Reward terbaik.`;
      }

      response += `⚡ *ANALISIS & REKOMENDASI ENTRY:*\n`;
      response += `${entryRecommendation}\n\n`;
      response += `━━━━━━━━━━━━━━━━━━━━━\n`;
      response += `_Catatan: Analisis Pivot Point bersifat teknikal. Gunakan manajemen resiko yang ketat._`;

      await msg.reply(response);
    } catch (err: any) {
      logger.error('XAU command failed: ' + err.message);
      await msg.reply('❌ Terjadi kesalahan saat memproses data harga emas.');
    } finally {
      if (typeof (chat as any).clearState === 'function') {
        try { await (chat as any).clearState(); } catch (_) {}
      }
    }
  }
};

export default xauCommand;
