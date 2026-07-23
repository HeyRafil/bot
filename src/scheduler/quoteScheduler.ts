import moment from 'moment-timezone';
import prisma from '../database/prisma.js';
import { sendWhatsAppMessage } from '../services/whatsappClient.js';
import logger from '../utils/logger.js';

const ENCOURAGING_QUOTES = [
  "Pendidikan adalah senjata paling mematikan di dunia, karena dengan itu Anda bisa mengubah dunia. - Nelson Mandela",
  "Jangan tanyakan pada diri Anda apa yang dibutuhkan dunia. Tanyakan apa yang membuat Anda hidup, kemudian kerjakan karena dunia membutuhkan orang yang antusias.",
  "Sukses tidak diukur dari apa yang Anda capai, melainkan dari kesulitan yang Anda hadapi untuk mencapainya.",
  "Masa depan adalah milik mereka yang percaya pada keindahan mimpi mereka. - Eleanor Roosevelt",
  "Keyakinan adalah kunci. Tanpa keyakinan, hal yang mudah pun akan terasa sulit.",
  "Hanya ada satu hal yang membuat mimpi tidak mungkin dicapai: ketakutan akan kegagalan.",
  "Mulailah dari mana Anda berada. Gunakan apa yang Anda miliki. Lakukan apa yang Anda bisa. - Arthur Ashe",
  "Kegagalan adalah satu-satunya kesempatan untuk memulai lagi dengan lebih cerdas. - Henry Ford",
  "Pekerjaan hebat tidak dilakukan dengan kekuatan, melainkan dengan ketekunan. - Samuel Johnson",
  "Jangan menunggu waktu yang tepat. Ciptakan waktu itu dan jadikan ia tepat.",
  "Orang yang sukses tidak selalu orang pintar, melainkan orang yang gigih dan pantang menyerah.",
  "Pendidikan bukan persiapan untuk hidup; pendidikan adalah hidup itu sendiri. - John Dewey",
  "Setiap hari adalah kesempatan baru untuk menjadi versi terbaik dari diri Anda.",
  "Fokuslah pada proses, bukan hanya pada hasil akhir. Setiap langkah kecil sangat berharga.",
  "Kesulitan sebenarnya adalah peluang untuk tumbuh dan membuktikan kekuatan Anda.",
  "Jangan biarkan hari kemarin merampas terlalu banyak hari ini. - Will Rogers",
  "Keberhasilan adalah jumlah dari upaya kecil, yang diulangi hari demi hari. - Robert Collier",
  "Cara terbaik untuk meramalkan masa depan adalah dengan menciptakannya. - Abraham Lincoln",
  "Jangan batasi tantangan Anda, tapi tantanglah batasan Anda.",
  "Belajar memang melelahkan, namun akan lebih melelahkan jika saat ini Anda tidak belajar."
];

function getRandomQuote(): string {
  const randomIndex = Math.floor(Math.random() * ENCOURAGING_QUOTES.length);
  return ENCOURAGING_QUOTES[randomIndex];
}

async function sendDailyQuote() {
  try {
    const now = moment().tz('Asia/Jakarta');
    const dayOfWeek = now.day(); // 0 = Sunday, 6 = Saturday
    const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);

    const quote = getRandomQuote();
    let message = `✨ *MUTIARA PAGI UT* ✨\n\n`;
    message += `"${quote}"\n\n`;

    if (isWeekend) {
      message += `Selamat menikmati akhir pekan, selamat liburan, dan selamat berkumpul bersama keluarga! Semoga waktu istirahat Anda menyenangkan. 🏝️☀️`;
    } else {
      message += `Selamat beraktifitas kembali di perkuliahan dan pekerjaan Anda hari ini! Tetap semangat dan berikan yang terbaik. 💪🚀`;
    }

    // Fetch active whitelisted groups
    const activeGroups = await prisma.group.findMany({
      where: { status: true }
    });

    if (activeGroups.length === 0) {
      logger.info("Daily quote scheduler triggered, but no active whitelisted groups found.");
      return;
    }

    logger.info(`Sending daily encouragement quote to ${activeGroups.length} groups...`);

    for (const group of activeGroups) {
      try {
        await sendWhatsAppMessage(group.id, message);
        // Delay 2 seconds between sends to prevent rate limits
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (err: any) {
        logger.error(`Failed to send daily quote to group ${group.id}:`, err.message);
      }
    }
  } catch (error: any) {
    logger.error("Error in daily quote scheduler job:", error.message);
  }
}

export function startEncouragementScheduler() {
  const scheduleNextRun = () => {
    const now = moment().tz('Asia/Jakarta');
    
    // Set target time to 08:00 WIB today
    let target = moment().tz('Asia/Jakarta').hour(8).minute(0).second(0).millisecond(0);
    
    // If 08:00 WIB today has passed, schedule for tomorrow
    if (now.isAfter(target)) {
      target.add(1, 'day');
    }

    const delayMs = target.diff(now);
    logger.info(`Encouragement Quote scheduler scheduled. Next run at: ${target.format()} (in ${Math.round(delayMs / 1000 / 60)} minutes)`);

    setTimeout(async () => {
      await sendDailyQuote();
      // Schedule the next run after this one completes
      scheduleNextRun();
    }, delayMs);
  };

  scheduleNextRun();
}
