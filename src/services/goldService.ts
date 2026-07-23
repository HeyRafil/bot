import axios from 'axios';
import { getSetting } from '../config/settings.js';
import { sendWhatsAppMessage } from './whatsappClient.js';
import logger from '../utils/logger.js';

export interface GoldData {
  price: number;
  prevClose: number;
  high: number;
  low: number;
  pivot: number;
  r1: number;
  s1: number;
  r2: number;
  s2: number; 
}

// State of the MetaTrader 5 Bridge
export interface BridgeStatus {
  lastActive: number;
  connected: boolean;
  account: string;
  server: string;
  error: string | null;
}

export const bridgeStatus: BridgeStatus = {
  lastActive: 0,
  connected: false,
  account: '',
  server: '',
  error: null
};

// In-memory alert state to prevent spamming
const lastAlertedTimes: Record<string, number> = {};
const COOLDOWN_MS = 60 * 60 * 1000; // 1 hour cooldown per alert type


export async function fetchGoldData(): Promise<GoldData | null> {
  try {
    const url = 'https://query1.finance.yahoo.com/v8/finance/chart/GC=F?interval=5m&range=1d';
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 10000
    });

    const result = response?.data?.chart?.result?.[0];
    if (!result) return null;

    const meta = result.meta;
    const price = meta.regularMarketPrice;
    const prevClose = meta.chartPreviousClose;
    
    const quote = result.indicators.quote[0];
    const highs = (quote.high || []).filter((h: any) => h !== null && h !== undefined);
    const lows = (quote.low || []).filter((l: any) => l !== null && l !== undefined);
    const closes = (quote.close || []).filter((c: any) => c !== null && c !== undefined);

    if (highs.length === 0 || lows.length === 0) return null;

    const currentHigh = Math.max(...highs);
    const currentLow = Math.min(...lows);
    const lastClose = closes[closes.length - 1] || price;

    // Calculate Pivot Points (Standard)
    const P = (currentHigh + currentLow + lastClose) / 3;
    const R1 = (2 * P) - currentLow;
    const S1 = (2 * P) - currentHigh;
    const R2 = P + (currentHigh - currentLow);
    const S2 = P - (currentHigh - currentLow);

    return {
      price,
      prevClose,
      high: currentHigh,
      low: currentLow,
      pivot: P,
      r1: R1,
      s1: S1,
      r2: R2,
      s2: S2
    };
  } catch (error: any) {
    logger.error("Failed to fetch gold data: " + error.message);
    return null;
  }
}

export async function checkGoldAlerts(): Promise<void> {
  const data = await fetchGoldData();
  if (!data) return;

  const { price, s1, s2, r1, r2, pivot } = data;
  const ownerNumber = await getSetting('OWNER_NUMBER');
  if (!ownerNumber) {
    logger.warn("Gold Tracker: OWNER_NUMBER not configured. Skipping alert check.");
    return;
  }

  const now = Date.now();
  let alertType: string | null = null;
  let conditionText = '';
  let entryRecommendation = '';

  // Proximity threshold (e.g. within 2.0 USD of S/R level)
  const PROXIMITY_USD = 2.0;

  if (Math.abs(price - r2) <= PROXIMITY_USD) {
    alertType = 'R2_HIT';
    conditionText = `⚠️ *Harga Mendekati Resistance 2 (R2)* ⚠️\n• Level R2: *$${r2.toFixed(2)}*`;
    entryRecommendation = `🔴 *SELL ZONE (Dekat Resistance)*\n` +
                          `👉 *Aksi:* Cari konfirmasi pembalikan arah turun (bearish rejection).\n` +
                          `🎯 *Target TP:* $${pivot.toFixed(2)} (Pivot) / $${s1.toFixed(2)} (S1)\n` +
                          `🛑 *Stop Loss:* $${(r2 + 3.0).toFixed(2)} (di atas R2)`;
  } else if (Math.abs(price - r1) <= PROXIMITY_USD) {
    alertType = 'R1_HIT';
    conditionText = `⚠️ *Harga Mendekati Resistance 1 (R1)* ⚠️\n• Level R1: *$${r1.toFixed(2)}*`;
    entryRecommendation = `🔴 *SELL ZONE (Dekat Resistance)*\n` +
                          `👉 *Aksi:* Cari konfirmasi pembalikan arah turun (bearish rejection).\n` +
                          `🎯 *Target TP:* $${pivot.toFixed(2)} (Pivot) / $${s1.toFixed(2)} (S1)\n` +
                          `🛑 *Stop Loss:* $${(r2 + 3.0).toFixed(2)} (di atas R2)`;
  } else if (Math.abs(price - s1) <= PROXIMITY_USD) {
    alertType = 'S1_HIT';
    conditionText = `⚠️ *Harga Mendekati Support 1 (S1)* ⚠️\n• Level S1: *$${s1.toFixed(2)}*`;
    entryRecommendation = `🟢 *BUY ZONE (Dekat Support)*\n` +
                          `👉 *Aksi:* Cari konfirmasi pembalikan arah naik (bullish rejection).\n` +
                          `🎯 *Target TP:* $${pivot.toFixed(2)} (Pivot) / $${r1.toFixed(2)} (R1)\n` +
                          `🛑 *Stop Loss:* $${(s2 - 3.0).toFixed(2)} (di bawah S2)`;
  } else if (Math.abs(price - s2) <= PROXIMITY_USD) {
    alertType = 'S2_HIT';
    conditionText = `⚠️ *Harga Mendekati Support 2 (S2)* ⚠️\n• Level S2: *$${s2.toFixed(2)}*`;
    entryRecommendation = `🟢 *BUY ZONE (Dekat Support)*\n` +
                          `👉 *Aksi:* Cari konfirmasi pembalikan arah naik (bullish rejection).\n` +
                          `🎯 *Target TP:* $${pivot.toFixed(2)} (Pivot) / $${r1.toFixed(2)} (R1)\n` +
                          `🛑 *Stop Loss:* $${(s2 - 3.0).toFixed(2)} (di bawah S2)`;
  }

  if (alertType && conditionText && entryRecommendation) {
    const lastSent = lastAlertedTimes[alertType] || 0;
    if (now - lastSent > COOLDOWN_MS) {
      logger.info(`Triggering gold alert: ${alertType} (Price: $${price.toFixed(2)})`);
      lastAlertedTimes[alertType] = now;
      
      let fullMessage = `🔔 *SINYAL MONITOR XAU/USD (GOLD)* 🔔\n`;
      fullMessage += `━━━━━━━━━━━━━━━━━━━━━\n\n`;
      fullMessage += `📊 *KONDISI PASAR:*\n`;
      fullMessage += `• Harga Saat Ini: *$$${price.toFixed(2)}*\n`;
      fullMessage += `${conditionText}\n\n`;
      fullMessage += `⚡ *REKOMENDASI ENTRY:*\n`;
      fullMessage += `${entryRecommendation}\n\n`;
      fullMessage += `━━━━━━━━━━━━━━━━━━━━━\n`;
      fullMessage += `_Sinyal otomatis dikirim oleh pemantau pasar emas._`;

      try {
        await sendWhatsAppMessage(ownerNumber, fullMessage);
      } catch (err: any) {
        logger.error(`Failed to send gold alert to owner: ` + err.message);
      }
    }


  }
}

export function initGoldPriceTracker(): void {
  logger.info("Initializing Gold Price Tracker (Checking every 5 minutes)...");
  
  // Run check 10 seconds after start
  setTimeout(() => {
    logger.info("Running initial gold price check on startup...");
    checkGoldAlerts().catch(err => logger.error("Initial gold check failed: " + err.message));
  }, 10000);

  // Set periodic checker (every 5 minutes)
  setInterval(() => {
    logger.info("Running scheduled gold price check...");
    checkGoldAlerts().catch(err => logger.error("Scheduled gold check failed: " + err.message));
  }, 5 * 60 * 1000);
}
