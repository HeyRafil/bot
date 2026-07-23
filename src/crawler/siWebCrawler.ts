import axios from 'axios';
import * as cheerio from 'cheerio';
import logger from '../utils/logger.js';
import localDb from '../database/localDb.js';

/**
 * Automatically crawls official UT curriculum sites to extract S1 Sistem Informasi courses
 * and saves new entries directly to the local si_materials.json database.
 */
export async function crawlSiCourses(): Promise<{ added: string[]; updated: string[] }> {
  const added: string[] = [];
  const updated: string[] = [];
  
  // Official UT pages that document curriculum structure or program details
  const targetUrls = [
    'https://si-fst.ut.ac.id/kurikulum/',
    'https://fst.ut.ac.id/s1-sistem-informasi/'
  ];

  // Regex matches standard UT 8-character course codes (e.g., MSIM4206, STSI4401, ADPU4442)
  const courseRegex = /\b([A-Z]{4}[0-9]{4})\b/;

  // Load current SI materials database
  let materials = await localDb.getCollection('si_materials', []);

  for (const url of targetUrls) {
    try {
      logger.info(`Crawling S1 Sistem Informasi course lists from: ${url}`);
      
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        timeout: 10000
      });

      const $ = cheerio.load(response.data);
      
      // Select table rows, list items, and paragraph texts to parse
      $('table tr, li, p').each((_, element) => {
        const text = $(element).text().trim();
        const codeMatch = text.match(courseRegex);
        
        if (codeMatch && codeMatch.length > 0) {
          const code = codeMatch[0]; // E.g., "MSIM4206"
          
          // Clean the rest of the text to obtain the course name
          let name = text
            .replace(code, '')
            .replace(/[-–:|]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
          
          // Clean up standard SKS numbers or comments if appended (e.g. "Basis Data 3 SKS")
          name = name.replace(/\b[0-9]\s*(SKS|sks)\b/gi, '').trim();

          // Reject matches that are too short, too long, or purely numbers
          if (name.length < 3 || name.length > 60 || /^[0-9\s]+$/.test(name)) {
            return;
          }

          // Check if the course already exists in the database
          const existingIdx = materials.findIndex((m: any) => m.code === code);
          
          if (existingIdx === -1) {
            // Course is new! Insert it with default layout
            const newCourse = {
              code,
              name,
              semester: 1, // Default semester mapping
              description: `Mata kuliah kurikulum S1 Sistem Informasi UT: ${name}.`,
              topics: [
                "Pengenalan & Teori Dasar Matakuliah",
                "Pemahaman Kasus Terapan & Modul BMP",
                "Persiapan UAS & Evaluasi Akhir"
              ],
              study_tips: "Pelajari Buku Materi Pokok (BMP) resmi UT dan kerjakan soal latihan di e-learning.",
              rbv_link: `https://pustaka.ut.ac.id/lib/${code.toLowerCase()}-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}/`,
              repo_link: `http://repository.ut.ac.id/view/subjects/${code}.html`,
              ocw_link: `http://www.ocw.ut.ac.id/course/${code.toLowerCase()}`,
              external_resources: []
            };

            materials.push(newCourse);
            added.push(`${code} - ${name}`);
          } else if (materials[existingIdx].name !== name) {
            // Update name if different
            materials[existingIdx].name = name;
            updated.push(`${code} - ${name}`);
          }
        }
      });
    } catch (err: any) {
      logger.error(`Error scraping curriculum page ${url}:`, err.message);
    }
  }

  // Save database if changes occurred
  if (added.length > 0 || updated.length > 0) {
    await localDb.saveCollection('si_materials', materials);
    logger.info(`Sistem Informasi curriculum crawl complete. Added: ${added.length}, Updated: ${updated.length}`);
  }

  return { added, updated };
}
