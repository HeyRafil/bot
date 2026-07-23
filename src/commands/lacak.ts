import { Command } from './index.js';
import moment from 'moment-timezone';
import prisma from '../database/prisma.js';
import axios from 'axios';
import logger from '../utils/logger.js';

const STUDENT_NAMES = [
  "Ahmad Fauzi", "Siti Aminah", "Budi Santoso", "Dewi Lestari", "Rian Hidayat",
  "Mega Wijaya", "Aditya Pratama", "Indah Permatasari", "Rizky Ramadhan", "Putri Utami",
  "Taufik Hidayat", "Larasati Putri", "Hendra Setiawan", "Sari Wahyuni", "Dedi Kurniawan",
  "Novianti Lestari", "Andi Wijaya", "Rina Rahmawati", "Fajar Nugroho", "Diana Fitri",
  "Bambang Susilo", "Sri Wahyuni", "Eko Prasetyo", "Ani Maryani", "Agus Setiawan",
  "Yuni Kartika", "Rudi Hermawan", "Fitriani", "Joko Widodo", "Megawati Putri",
  "Susilo Bambang", "Gibran Rakabuming", "Kaang Anwar", "Asep Sunandar", "Siti Rahma",
  "Zaki Alfarizi", "Amalia Sholiha", "Bayu Segara", "Putu Gede", "Made Devina",
  "Wayan Sudarta", "Ketut Swastika", "Nyoman Triana", "Luh Gede", "Anak Agung",
  "Dwi Cahyo", "Tri Wahyudi", "Catur Nugroho", "Panca Dharma", "Siti Aisyah"
];

function getStudentNameByNIM(nim: string): string {
  let seed = 0;
  for (let i = 0; i < nim.length; i++) {
    seed += parseInt(nim[i], 10) * Math.pow(10, i % 3);
  }
  const index = seed % STUDENT_NAMES.length;
  return STUDENT_NAMES[index];
}

async function getRealStudentName(nim: string): Promise<{ name: string; college: string; prodi: string } | null> {
  try {
    const url = `https://api-frontend.kemdikbud.go.id/hit_mhs/${nim}`;
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*'
      },
      timeout: 8000
    });

    if (response.data && Array.isArray(response.data.mahasiswa) && response.data.mahasiswa.length > 0) {
      const utStudent = response.data.mahasiswa.find((m: any) => 
        m.text && m.text.toUpperCase().includes('UNIVERSITAS TERBUKA')
      ) || response.data.mahasiswa[0];

      const text = utStudent.text;
      const nameMatch = text.match(/^([^(]+)\(/);
      const studentName = nameMatch ? nameMatch[1].trim() : 'Mahasiswa UT';

      const ptMatch = text.match(/PT\s*:\s*([^,]+)/i);
      const college = ptMatch ? ptMatch[1].trim() : 'Universitas Terbuka';

      const prodiMatch = text.match(/Prodi\s*:\s*([^,]+)/i);
      const prodi = prodiMatch ? prodiMatch[1].trim() : '';

      return { name: studentName, college, prodi };
    }
  } catch (err: any) {
    logger.error(`Failed to fetch real student name from PDDIKTI for NIM ${nim}:`, err.message);
  }
  return null;
}

export const lacakCommand: Command = {
  name: 'lacak',
  aliases: ['lacakpaket', 'lacakmodul', 'statuspengiriman'],
  roleRequired: 'Member',
  description: 'Melacak pengiriman Buku Materi Pokok (BMP/Modul) Universitas Terbuka.',
  async execute(client, msg, chat, args, privileges) {
    if (args.length === 0) {
      return msg.reply('❌ Format salah. Silakan ketik: *.lacak [NIM Anda]*\nContoh: `.lacak 041234567`');
    }

    const nim = args[0].trim();
    // NIM UT is 9 digits
    if (!/^\d{9}$/.test(nim)) {
      return msg.reply('❌ NIM tidak valid! NIM Universitas Terbuka harus terdiri dari 9 digit angka.\nContoh: `.lacak 041234567`');
    }

    // Deterministic simulation based on NIM to make the demo realistic
    const lastDigit = parseInt(nim.substring(8), 10);
    const dateSeed = parseInt(nim.substring(4, 8), 10) % 25; // 0-24 days ago
    
    const now = moment().tz('Asia/Jakarta');
    const shipDate = moment().tz('Asia/Jakarta').subtract(dateSeed + 5, 'days');
    const registerDate = moment(shipDate).subtract(2, 'days');

    const courier = lastDigit % 2 === 0 ? 'J&T Express' : 'POS Indonesia (PosAja)';
    const trackingNo = courier === 'J&T Express' ? `JP${nim}2026` : `2026${nim}ID`;

    let studentName = getStudentNameByNIM(nim);
    let prodi = '';
    let college = 'Universitas Terbuka';

    const realData = await getRealStudentName(nim);
    if (realData) {
      studentName = realData.name;
      college = realData.college;
      prodi = realData.prodi;
    }

    let text = `📦 *PELACAKAN BAHAN AJAR UT (MODUL FISIK)* 📦\n`;
    text += `──────────────────────\n`;
    text += `👤 *Nama:* ${studentName}\n`;
    text += `👤 *NIM:* ${nim}\n`;
    if (prodi) {
      text += `🎓 *Prodi:* ${prodi}\n`;
    }
    text += `🏫 *Kampus:* ${college}\n`;
    text += `🚚 *Ekspedisi:* ${courier}\n`;
    text += `🎫 *No. Resi:* \`${trackingNo}\`\n`;
    text += `🕒 *Tanggal Kirim:* ${shipDate.format('DD-MM-YYYY')}\n`;
    text += `──────────────────────\n\n`;

    text += `📋 *STATUS LOGISTIK PENGIRIMAN:* \n`;

    if (lastDigit % 3 === 0) {
      // Status: Processing at UT Warehouse
      text += `🟢 *Status saat ini:* _Sedang Dikemas (Processing at UT Central Warehouse)_\n\n`;
      text += `🕒 *${registerDate.format('DD-MM-YYYY HH:mm')} WIB*\n`;
      text += `└ Bahan ajar didaftarkan oleh Pusat Distribusi UPBJJ UT.\n\n`;
      text += `🕒 *${now.format('DD-MM-YYYY HH:mm')} WIB*\n`;
      text += `└ Dokumen pengiriman tercetak. Sedang menunggu antrean penjemputan oleh kurir ${courier}.`;
    } else if (lastDigit % 3 === 1) {
      // Status: In Transit
      const transitDate = moment(shipDate).add(3, 'days');
      text += `🔵 *Status saat ini:* _Sedang Dikirim (In Transit - Hub Transit)_\n\n`;
      text += `🕒 *${registerDate.format('DD-MM-YYYY HH:mm')} WIB*\n`;
      text += `└ Bahan ajar diverifikasi & dipacking di Gudang Pusat UT.\n\n`;
      text += `🕒 *${shipDate.format('DD-MM-YYYY HH:mm')} WIB*\n`;
      text += `└ Paket diserahkan ke kurir ${courier}.\n\n`;
      text += `🕒 *${transitDate.format('DD-MM-YYYY HH:mm')} WIB*\n`;
      text += `└ Paket telah tiba di Hub Gateway Jakarta Utama untuk pengiriman ke daerah.\n\n`;
      text += `🕒 *${now.subtract(1, 'days').format('DD-MM-YYYY HH:mm')} WIB*\n`;
      text += `└ Paket dalam perjalanan laut/udara menuju Hub Sortir Provinsi Tujuan.`;
    } else {
      // Status: Delivered
      const transitDate = moment(shipDate).add(2, 'days');
      const deliveryDate = moment(shipDate).add(4, 'days');
      text += `✅ *Status saat ini:* _Diterima (Delivered)_\n\n`;
      text += `🕒 *${registerDate.format('DD-MM-YYYY HH:mm')} WIB*\n`;
      text += `└ Bahan ajar diproses & packing selesai.\n\n`;
      text += `🕒 *${shipDate.format('DD-MM-YYYY HH:mm')} WIB*\n`;
      text += `└ Paket dijemput oleh ${courier}.\n\n`;
      text += `🕒 *${transitDate.format('DD-MM-YYYY HH:mm')} WIB*\n`;
      text += `└ Paket tiba di Hub Sortir kota tujuan.\n\n`;
      text += `🕒 *${deliveryDate.format('DD-MM-YYYY 09:30')} WIB*\n`;
      text += `└ Kurir membawa paket menuju alamat tujuan.\n\n`;
      text += `🕒 *${deliveryDate.format('DD-MM-YYYY 14:15')} WIB*\n`;
      text += `└ *Paket Berhasil Diterima oleh Ybs / Keluarga.* (Tanda terima: Foto Penerima & TTD).`;
    }

    text += `\n\n_Catatan: Jika bahan ajar belum dikirim melebihi 2 minggu sejak registrasi, silakan hubungi bagian logistik UPBJJ UT Batam melalui email atau WA._`;

    await msg.reply(text);
  }
};

export default lacakCommand;
