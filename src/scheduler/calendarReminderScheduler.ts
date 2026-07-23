import moment from 'moment-timezone';
import prisma from '../database/prisma.js';
import { sendWhatsAppMessage } from '../services/whatsappClient.js';
import logger from '../utils/logger.js';

interface AcademicEvent {
  event: string;
  date: string; // YYYY-MM-DD
  description: string;
}

const ACADEMIC_CALENDAR_EVENTS: AcademicEvent[] = [
  {
    event: "Pendaftaran Mahasiswa Baru (Admisi) UT",
    date: "2026-08-19",
    description: "Batas akhir pendaftaran berkas dan admisi mahasiswa baru UT Jalur Non-Diploma / Sarjana."
  },
  {
    event: "Registrasi Mata Kuliah Semester Ganjil",
    date: "2026-09-02",
    description: "Batas akhir melakukan registrasi mata kuliah untuk semester berjalan di portal MyUT."
  },
  {
    event: "Pembayaran Uang Kuliah (SPP / LIP)",
    date: "2026-09-09",
    description: "Batas akhir pembayaran billing SPP melalui Bank Mitra (Mandiri, BRI, BTN, BNI), Tokopedia, atau gerai retail."
  },
  {
    event: "Aktivasi & Pengisian Form Kesediaan Tuton",
    date: "2026-09-14",
    description: "Batas akhir aktivasi akun elearning dan pengisian Form Kesediaan Mengikuti Tutorial Online di elearning.ut.ac.id."
  },
  {
    event: "Tutorial Online (Tuton) Sesi 1 Mulai Aktif",
    date: "2026-10-05",
    description: "Pertama kali dibukanya materi dan forum diskusi Tuton Sesi 1 bagi seluruh mahasiswa aktif."
  }
];

async function checkAndSendReminders() {
  try {
    const todayStr = moment().tz('Asia/Jakarta').format('YYYY-MM-DD');
    const today = moment().tz('Asia/Jakarta').startOf('day');

    let message = '';
    
    for (const item of ACADEMIC_CALENDAR_EVENTS) {
      const eventDate = moment.tz(item.date, 'YYYY-MM-DD', 'Asia/Jakarta').startOf('day');
      const diffDays = eventDate.diff(today, 'days');

      if (diffDays === 7) {
        message = `⚠️ *PENGINGAT KALENDER AKADEMIK UT: H-7* ⚠️\n\n`;
        message += `🔔 *Acara:* ${item.event}\n`;
        message += `📅 *Batas Tanggal:* ${moment(item.date).format('DD-MM-YYYY')}\n`;
        message += `📝 *Keterangan:* ${item.description}\n\n`;
        message += `_Waktu tinggal 7 hari lagi. Jangan menunda-nunda pekerjaan Anda! 📚_`;
      } else if (diffDays === 3) {
        message = `⚠️ *PENGINGAT KALENDER AKADEMIK UT: H-3* ⚠️\n\n`;
        message += `🔔 *Acara:* ${item.event}\n`;
        message += `📅 *Batas Tanggal:* ${moment(item.date).format('DD-MM-YYYY')}\n`;
        message += `📝 *Keterangan:* ${item.description}\n\n`;
        message += `_Batas waktu tinggal 3 hari lagi. Pastikan semua berkas dan pembayaran Anda sudah tuntas! ⏰_`;
      } else if (diffDays === 1) {
        message = `🚨 *PENGINGAT AKADEMIK UT: H-1 (BESOK)* 🚨\n\n`;
        message += `🔔 *Acara:* ${item.event}\n`;
        message += `📅 *Batas Tanggal:* *BESOK (${moment(item.date).format('DD-MM-YYYY')})*\n`;
        message += `📝 *Keterangan:* ${item.description}\n\n`;
        message += `_Batas akhir adalah *BESOK*. Segera selesaikan hari ini juga agar terhindar dari server padat! ⏳_`;
      } else if (diffDays === 0) {
        message = `🚨 *HARI INI: BATAS AKHIR AKADEMIK UT* 🚨\n\n`;
        message += `🔔 *Acara:* ${item.event}\n`;
        message += `📅 *Batas Tanggal:* *HARI INI (${moment(item.date).format('DD-MM-YYYY')})*\n`;
        message += `📝 *Keterangan:* ${item.description}\n\n`;
        message += `_*PENTING:* Hari ini adalah batas waktu terakhir! Segera selesaikan sebelum jam penutupan sistem di MyUT/Elearning. 🔔_`;
      }

      if (message) {
        // Fetch active whitelisted groups
        const activeGroups = await prisma.group.findMany({
          where: { status: true }
        });

        if (activeGroups.length === 0) {
          logger.info(`Academic calendar scheduler triggered for ${item.event}, but no active whitelisted groups found.`);
          continue;
        }

        logger.info(`Sending academic calendar reminder for ${item.event} to ${activeGroups.length} groups...`);

        for (const group of activeGroups) {
          try {
            await sendWhatsAppMessage(group.id, message);
            // Delay 2 seconds to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 2000));
          } catch (err: any) {
            logger.error(`Failed to send calendar reminder to group ${group.id}:`, err.message);
          }
        }
      }
    }
  } catch (error: any) {
    logger.error("Error in academic calendar reminder job:", error.message);
  }
}

export function startCalendarReminderScheduler() {
  const scheduleNextRun = () => {
    const now = moment().tz('Asia/Jakarta');
    
    // Set target time to 08:30 WIB today
    let target = moment().tz('Asia/Jakarta').hour(8).minute(30).second(0).millisecond(0);
    
    // If 08:30 WIB today has passed, schedule for tomorrow
    if (now.isAfter(target)) {
      target.add(1, 'day');
    }

    const delayMs = target.diff(now);
    logger.info(`Academic Calendar reminder scheduler scheduled. Next run at: ${target.format()} (in ${Math.round(delayMs / 1000 / 60)} minutes)`);

    setTimeout(async () => {
      await checkAndSendReminders();
      // Schedule the next run after this one completes
      scheduleNextRun();
    }, delayMs);
  };

  scheduleNextRun();
}
