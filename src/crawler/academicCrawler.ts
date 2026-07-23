import '../polyfill.js';
import axios from 'axios';
import * as cheerio from 'cheerio';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import logger from '../utils/logger.js';
import localDb from '../database/localDb.js';

dotenv.config();

const CRAWLER_DELAY = parseInt(process.env.CRAWLER_DELAY_MS || '2000', 10);

const TARGET_URLS = [
  { url: 'https://www.ut.ac.id', category: 'general' },
  { url: 'https://myut.ut.ac.id', category: 'myut' },
  { url: 'https://elearning.ut.ac.id', category: 'tuton' },
  { url: 'https://silayar.ut.ac.id', category: 'silayar' },
  { url: 'https://praktik.ut.ac.id', category: 'praktik' },
  { url: 'https://fhisip.ut.ac.id', category: 'fhisip' },
  { url: 'https://fst.ut.ac.id', category: 'fst' },
  { url: 'https://batam.ut.ac.id', category: 'batam' },
  { url: 'https://kemahasiswaan.ut.ac.id', category: 'kemahasiswaan' }
];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function sanitizeText(text: string): string {
  if (!text) return '';
  return text
    .replace(/<[^>]*>/g, '') 
    .replace(/\s+/g, ' ')    
    .trim();
}

const BASELINE_SEED = {
  faq: [
    {
      question: "Apa itu UOBM (Ujian Online Berbasis Mata Kuliah)?",
      answer: "UOBM adalah layanan ujian online yang diselenggarakan secara tatap muka di lokasi yang ditentukan UT (seperti UPBJJ atau kantor mitra). Mahasiswa mengerjakan soal ujian secara online menggunakan perangkat PC/laptop yang disediakan di lokasi ujian. Soal bertipe objektif (pilihan ganda) atau esai.",
      source: "https://www.ut.ac.id",
      category: "ujian"
    },
    {
      question: "Apa itu UOLP (Ujian Online Luar Negeri/Lainnya)?",
      answer: "UOLP adalah ujian online yang dikhususkan bagi mahasiswa UT yang berada di luar negeri atau dengan kondisi tertentu. Pelaksanaan ujian diawasi secara online melalui kamera/Zoom.",
      source: "https://www.ut.ac.id",
      category: "ujian"
    },
    {
      question: "Apa itu THE (Take Home Exam)?",
      answer: "Take Home Exam (THE) adalah modus ujian UT di mana mahasiswa mengunduh naskah soal dari laman THE (the.ut.ac.id), mengerjakannya di rumah secara open book, dan mengunggah Buku Jawaban Ujian (BJU) dalam batas waktu yang ditentukan (biasanya 12 jam sejak naskah diunduh pada hari ujian yang terjadwal).",
      source: "https://www.ut.ac.id",
      category: "ujian"
    },
    {
      question: "Bagaimana cara registrasi mata kuliah di MyUT?",
      answer: "Registrasi mata kuliah dilakukan melalui portal MyUT (myut.ut.ac.id). Login menggunakan akun mahasiswa (NIM & Password), masuk ke menu Registrasi Mata Kuliah, pilih mata kuliah sesuai kurikulum/paket, klik simpan, lalu unduh LIP (Lembar Informasi Pembayaran) untuk melakukan pembayaran di Bank (BRI, Mandiri, BTN, BNI) atau Alfamart/Indomaret.",
      source: "https://myut.ut.ac.id",
      category: "registrasi"
    },
    {
      question: "Bagaimana cara reset password MyUT?",
      answer: "Jika lupa password MyUT, buka myut.ut.ac.id, klik tombol 'Lupa Password' di bawah form login. Masukkan NIM, tanggal lahir, dan email terdaftar. Sistem akan mengirimkan link reset password ke email Anda. Jika email tidak aktif, hubungi Hallo UT di 1500024 atau UPBJJ terdekat untuk pembaruan data email.",
      source: "https://myut.ut.ac.id",
      category: "myut"
    },
    {
      question: "Kapan Tutorial Online (Tuton) dimulai?",
      answer: "Jadwal Tutorial Online (Tuton) biasanya dimulai sekitar 1-2 bulan setelah registrasi ditutup. Tanggal pasti dapat dilihat pada Kalender Akademik UT di website resmi. Mahasiswa wajib melakukan aktivasi akun Tuton terlebih dahulu di elearning.ut.ac.id and melakukan pengisian form Kesediaan Mengikuti Tuton.",
      source: "https://elearning.ut.ac.id",
      category: "tuton"
    },
    {
      question: "Apa perbedaan Tuton dan Tuweb?",
      answer: "Tuton (Tutorial Online) dilakukan secara asinkronus melalui elearning.ut.ac.id di mana mahasiswa berdiskusi dan mengerjakan tugas secara mandiri selama 8 sesi. Tuweb (Tutorial Web) dilakukan secara sinkronus melalui aplikasi video conference (seperti Microsoft Teams atau Zoom) yang dipandu oleh tutor pada jadwal tertentu (biasanya hari Sabtu/Minggu).",
      source: "https://www.ut.ac.id",
      category: "tutorial"
    }
  ],
  exams: [
    {
      title: "Aturan dan Syarat Mengikuti Ujian Online (UO)",
      content: "Mahasiswa wajib membawa Kartu Tanda Peserta Ujian (KTPU) UO, kartu mahasiswa/KTP asli, berpakaian rapi dan sopan (kemeja, bukan kaos), datang 30 menit sebelum jadwal, dan dilarang membawa alat komunikasi ke dalam ruang ujian. Device PC disediakan oleh UPBJJ/lokasi ujian.",
      source: "https://www.ut.ac.id",
      category: "ujian"
    },
    {
      title: "Sistem Layanan Ujian (THE, UOBM, UAOP)",
      content: "UT membagi layanan ujian menjadi: 1. Ujian Tatap Muka (UTM) tertulis. 2. Ujian Online Berbasis Mata Kuliah (UOBM) di lokasi UPBJJ. 3. Ujian Asisten Online Praktik (UAOP) untuk mata kuliah praktikum. 4. Take Home Exam (THE) dikerjakan mandiri dari rumah.",
      source: "https://www.ut.ac.id",
      category: "ujian"
    }
  ],
  registration: [
    {
      title: "Panduan Pendaftaran Mahasiswa Baru UT",
      content: "Pendaftaran mahasiswa baru dilakukan secara online melalui admisi-sia.ut.ac.id atau SIA modern di MyUT. Berkas yang disiapkan: Fotokopi ijazah dilegalisir, KTP asli, pas foto 3x4, surat pernyataan keabsahan dokumen bermaterai, dan form isian mahasiswa baru.",
      source: "https://www.ut.ac.id",
      category: "registrasi"
    }
  ],
  schedules: [
    {
      title: "Kalender Akademik UT Tahun Ajaran Semester Terkini",
      content: "Registrasi Mata Kuliah: Biasanya dimulai Juni - Agustus (Semester Ganjil) & Desember - Februari (Semester Genap). Pembayaran uang kuliah ditutup beberapa hari setelah registrasi matakuliah ditutup. Aktivasi Tuton dan isi form kesediaan mengikuti Tuton ditutup sebelum Sesi 1 dimulai.",
      source: "https://www.ut.ac.id",
      category: "kalender"
    }
  ],
  announcements: [
    {
      title: "Pengumuman Layanan Wisuda dan Kelulusan UT",
      content: "Pengumuman kelulusan yudisium dirilis secara berkala melalui laman kemahasiswaan.ut.ac.id dan UPBJJ setempat. Mahasiswa yang terjaring yudisium wajib melengkapi berkas wisuda secara online.",
      source: "https://kemahasiswaan.ut.ac.id",
      category: "yudisium"
    }
  ]
};

export async function seedBaselineData() {
  logger.info("Initializing local database collections with baseline UT seeds...");
  
  const currentFaq = await localDb.getCollection('faq');
  if (currentFaq.length === 0) {
    await localDb.saveCollection('faq', BASELINE_SEED.faq);
  }

  const currentExams = await localDb.getCollection('exams');
  if (currentExams.length === 0) {
    await localDb.saveCollection('exams', BASELINE_SEED.exams);
  }

  const currentReg = await localDb.getCollection('registration');
  if (currentReg.length === 0) {
    await localDb.saveCollection('registration', BASELINE_SEED.registration);
  }

  const currentSchedules = await localDb.getCollection('schedules');
  if (currentSchedules.length === 0) {
    await localDb.saveCollection('schedules', BASELINE_SEED.schedules);
  }

  const currentAnnouncements = await localDb.getCollection('announcements');
  if (currentAnnouncements.length === 0) {
    await localDb.saveCollection('announcements', BASELINE_SEED.announcements);
  }

  const currentKnowledge = await localDb.getCollection('knowledge');
  if (currentKnowledge.length === 0) {
    const defaultKnowledge = [
      ...BASELINE_SEED.exams.map(e => ({ title: e.title, content: e.content, source: e.source, category: 'exams' })),
      ...BASELINE_SEED.registration.map(r => ({ title: r.title, content: r.content, source: r.source, category: 'registration' })),
      ...BASELINE_SEED.schedules.map(s => ({ title: s.title, content: s.content, source: s.source, category: 'schedules' })),
      ...BASELINE_SEED.announcements.map(a => ({ title: a.title, content: a.content, source: a.source, category: 'announcements' }))
    ];
    await localDb.saveCollection('knowledge', defaultKnowledge);
  }

  const currentGroups = await localDb.getCollection('groups');
  if (currentGroups.length === 0) {
    await localDb.saveCollection('groups', []);
  }

  logger.info("Local database initialized successfully with seed data.");
}

function extractInternalLinks($: cheerio.CheerioAPI, baseUrl: string): string[] {
  const links = new Set<string>();
  try {
    const parsedBase = new URL(baseUrl);
    $('a').each((_, el) => {
      const href = $(el).attr('href');
      if (!href) return;
      try {
        const absoluteUrl = new URL(href, baseUrl).href;
        const parsedUrl = new URL(absoluteUrl);
        if (parsedUrl.hostname === parsedBase.hostname) {
          if (
            !parsedUrl.pathname.match(/\.(pdf|jpg|jpeg|png|gif|zip|docx|xlsx|mp4|pptx|rar|gz|tgz)$/i) &&
            !parsedUrl.hash &&
            !parsedUrl.pathname.includes('login') &&
            !parsedUrl.pathname.includes('logout') &&
            !parsedUrl.pathname.includes('wp-admin')
          ) {
            links.add(absoluteUrl.replace(/\/$/, ''));
          }
        }
      } catch (_) {}
    });
  } catch (err) {
    logger.error("Failed to parse base URL for link extraction", err);
  }
  return Array.from(links);
}

async function scrapeSingleUrl(url: string, category: string) {
  logger.crawl(`Scraping page: ${url}`);
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 UT-Academic-Bot/1.0',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
      },
      timeout: 10000,
      validateStatus: (status) => status === 200
    });

    const $ = cheerio.load(response.data);
    $('script, style, iframe, nav, footer, header, .sidebar, #footer, #header, .menu, .ads, noscript').remove();

    const crawledItems: any[] = [];
    const articles = $('article, .post, .entry-content, .content, main, #content, .td-post-content');
    
    if (articles.length > 0) {
      articles.each((_, element) => {
        const title = sanitizeText($(element).find('h1, h2, h3, .entry-title, .title').first().text()) || $('title').text().trim();
        let paragraphs: string[] = [];
        $(element).find('p, li, table').each((_, p) => {
          const text = sanitizeText($(p).text());
          if (text.length > 20) {
            paragraphs.push(text);
          }
        });

        const content = paragraphs.join('\n');
        if (content.length > 120) {
          crawledItems.push({
            title: sanitizeText(title),
            content,
            source: url,
            category
          });
        }
      });
    }

    const faqBlocks = $('.accordion-item, .toggle, .faq-item, .vc_toggle, details');
    if (faqBlocks.length > 0) {
      faqBlocks.each((_, el) => {
        const question = sanitizeText($(el).find('.accordion-header, .toggle-title, .faq-question, summary, h3, h4').text());
        const answer = sanitizeText($(el).find('.accordion-body, .toggle-content, .faq-answer, p').text());

        if (question.length > 10 && answer.length > 20) {
          crawledItems.push({
            question,
            answer,
            source: url,
            category: 'faq',
            isFaq: true
          });
        }
      });
    }

    if (crawledItems.length === 0) {
      const pageTitle = sanitizeText($('title').text()) || url;
      let paragraphs: string[] = [];
      $('p, li').each((_, el) => {
        const text = sanitizeText($(el).text());
        if (text.length > 30) {
          paragraphs.push(text);
        }
      });
      const content = paragraphs.slice(0, 15).join('\n');
      if (content.length > 120) {
        crawledItems.push({
          title: pageTitle,
          content,
          source: url,
          category
        });
      }
    }

    return { crawledItems, $ };
  } catch (error: any) {
    logger.crawl(`Error scraping ${url}: ${error.message}`, true);
    return { crawledItems: [], $: null };
  }
}

async function scrapeUrl(urlInfo: { url: string; category: string }): Promise<any[]> {
  const { url, category } = urlInfo;
  const allItems: any[] = [];
  logger.info(`Starting deep crawl (depth = 1) for target: ${url}`);
  
  const { crawledItems, $ } = await scrapeSingleUrl(url, category);
  if (crawledItems.length > 0) {
    allItems.push(...crawledItems);
  }

  if ($) {
    const internalLinks = extractInternalLinks($, url);
    logger.info(`Found ${internalLinks.length} internal links on ${url}`);

    const maxSubpages = 5;
    const linksToCrawl = internalLinks
      .filter(link => link !== url) 
      .slice(0, maxSubpages);

    logger.info(`Crawling top ${linksToCrawl.length} subpages for ${url}...`);

    for (const subLink of linksToCrawl) {
      await sleep(1500); 
      const { crawledItems: subItems } = await scrapeSingleUrl(subLink, category);
      if (subItems.length > 0) {
        allItems.push(...subItems);
      }
    }
  }

  return allItems;
}

export async function runCrawler(): Promise<number> {
  logger.info("Starting UT Academic Crawler Job...");
  
  await seedBaselineData();

  let totalCrawled = 0;
  const newKnowledge: any[] = [];
  const newFaq: any[] = [];

  for (const target of TARGET_URLS) {
    const items = await scrapeUrl(target);
    if (items.length > 0) {
      items.forEach(item => {
        if (item.isFaq) {
          newFaq.push({
            question: item.question,
            answer: item.answer,
            source: item.source,
            category: target.category
          });
        } else {
          newKnowledge.push({
            title: item.title,
            content: item.content,
            source: item.source,
            category: target.category
          });
        }
      });
      totalCrawled += items.length;
    }
    await sleep(CRAWLER_DELAY);
  }

  if (totalCrawled > 0) {
    logger.info(`Crawler extracted ${totalCrawled} total articles/faq items.`);
    
    const existingKnowledge = await localDb.getCollection('knowledge');
    const existingFaq = await localDb.getCollection('faq');

    const combinedKnowledge = [...existingKnowledge];
    newKnowledge.forEach(item => {
      if (!combinedKnowledge.some((x: any) => x.title.toLowerCase() === item.title.toLowerCase())) {
        combinedKnowledge.push(item);
      }
    });

    const combinedFaq = [...existingFaq];
    newFaq.forEach(item => {
      if (!combinedFaq.some((x: any) => x.question.toLowerCase() === item.question.toLowerCase())) {
        combinedFaq.push(item);
      }
    });

    await localDb.saveCollection('knowledge', combinedKnowledge);
    await localDb.saveCollection('faq', combinedFaq);
    
    logger.info("Local database updated with fresh crawled data.");
  } else {
    logger.warn("Crawler job finished, but zero new content was extracted.");
  }
  
  return totalCrawled;
}

if (process.argv.includes('--manual')) {
  (async () => {
    try {
      await runCrawler();
      console.log('Manual crawl complete.');
      process.exit(0);
    } catch (e) {
      console.error(e);
      process.exit(1);
    }
  })();
}
