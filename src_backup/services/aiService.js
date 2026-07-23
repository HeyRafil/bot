import { semanticSearchIndex } from '../knowledge/semanticSearch.js';
import logger from '../utils/logger.js';
import dotenv from 'dotenv';
import axios from 'axios';
import { getSetting } from '../config/settings.js';

dotenv.config();

/**
 * Builds the offline fallback response when OpenAI API is not configured or fails.
 */
function buildOfflineResponse(query, searchResults) {
  if (searchResults.length === 0) {
    return `Maaf, saya tidak menemukan informasi spesifik terkait "${query}" di database lokal Universitas Terbuka.\n\n` +
           `Silakan kunjungi situs resmi UT:\n` +
           `- Portal Utama: https://www.ut.ac.id\n` +
           `- Layanan Mahasiswa: https://myut.ut.ac.id\n` +
           `- Layanan Hallo UT: 1500024`;
  }

  let response = `*Informasi Akademik UT (Offline Mode)*\n`;
  response += `Berikut adalah informasi relevan yang ditemukan di database lokal:\n\n`;

  searchResults.forEach((doc, idx) => {
    response += `${idx + 1}. *${doc.title}*\n`;
    response += `${doc.content}\n`;
    response += `Sumber: ${doc.source}\n\n`;
  });

  response += `_Catatan: Respon ini dihasilkan secara otomatis dari indeks data lokal._`;
  return response;
}

/**
 * RAG Query: Semantic Search + OpenAI Chat Completion
 */
export async function queryRAG(query) {
  logger.info(`Processing query through RAG pipeline: "${query}"`);

  try {
    // 1. Perform local semantic search
    const matches = await semanticSearchIndex.search(query, 3);
    
    // 2. Check if OpenAI API Key is configured. If not, use local database fallback.
    const apiKey = await getSetting('OPENAI_API_KEY');
    if (!apiKey) {
      logger.info("OpenAI API key not configured. Using local TF-IDF search fallback.");
      return buildOfflineResponse(query, matches);
    }

    // 3. Format the context blocks for OpenAI
    let contextText = '';
    const sources = new Set();
    
    if (matches.length > 0) {
      contextText = matches.map(m => {
        sources.add(m.source);
        return `[JUDUL]: ${m.title}\n[KONTEN]: ${m.content}\n[SUMBER]: ${m.source}`;
      }).join('\n\n---\n\n');
    }

    const systemPrompt = `Anda adalah AI Academic Assistant khusus Universitas Terbuka (UT) Batam (UPBJJ-UT Batam) yang cerdas, sopan, dan profesional.
Tugas utama Anda adalah membantu mahasiswa UT Batam memahami sistem akademik modern UT (seperti registrasi, ujian UOBM/THE/UOLP, Tuton, Tuweb, dll).

PANDUAN LOKASI UT BATAM (UTAMA):
1. Jika mahasiswa bertanya tentang alamat kantor, lokasi fisik, pendaftaran wilayah, atau nomor kontak khusus, berikan informasi resmi UT Batam:
   - Alamat Kantor: Jl. Dr. Sutomo No. 3, Sekupang, Batam 29422.
   - Telepon: 0778-323478 | Faks: 0778-323479
   - Email: ut-batam@ecampus.ut.ac.id
   - Website Resmi: https://batam.ut.ac.id
2. Untuk lokasi ujian, sampaikan bahwa UT Batam menyelenggarakan ujian secara fleksibel (tulis tatap muka, UO di lab mitra, atau AOP online diawasi). Ingatkan mahasiswa untuk selalu mengecek lokasi spesifik mereka pada Kartu Tanda Peserta Ujian (KTPU) di akun MyUT masing-masing.

PANDUAN JAWABAN UMUM:
1. Jawablah secara natural, ramah, edukatif, dan to-the-point dalam Bahasa Indonesia.
2. Gunakan KONTEKS di bawah ini untuk menjawab pertanyaan akademik yang bersifat umum (seperti aturan THE, Tuton, kelulusan, registrasi matakuliah). Web crawler bertugas mencari data akademik umum ini.
3. JANGAN melakukan halusinasi atau mengarang informasi. Jika informasi tidak ada di dalam KONTEKS atau panduan Batam, katakan secara jujur bahwa Anda tidak menemukan informasi tersebut di database resmi saat ini dan sarankan untuk menghubungi Hallo UT (1500024) atau WhatsApp UT Pusat (0811-4150-0024).

KONTEKS DOKUMEN AKADEMIK UMUM (CRAWLED):
${contextText || 'Tidak ada dokumen lokal yang cocok.'}`;

    const userPrompt = `Pertanyaan Mahasiswa: "${query}"`;

    let apiUrl = 'https://api.openai.com/v1/chat/completions';
    let apiModel = 'gpt-4o-mini';

    if (apiKey.startsWith('AIzaSy') || apiKey.startsWith('AQ.')) {
      apiUrl = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
      apiModel = 'gemini-2.5-flash';
      logger.info("Using Google Gemini API (gemini-2.5-flash) for RAG query.");
    } else if (apiKey.startsWith('gsk_')) {
      apiUrl = 'https://api.groq.com/openai/v1/chat/completions';
      apiModel = 'llama3-8b-8192';
      logger.info("Using Groq API (llama3-8b-8192) for RAG query.");
    } else {
      logger.info("Using OpenAI API (gpt-4o-mini) for RAG query.");
    }

    logger.debug(`Sending request to ${apiModel} (${apiUrl})...`);

    const response = await axios.post(apiUrl, {
      model: apiModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.3,
      max_tokens: 800
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      timeout: 15000
    });

    const data = response.data;
    let reply = data.choices[0].message.content.trim();

    // 4. Append sources to the response
    if (sources.size > 0) {
      reply += `\n\n*Sumber Resmi UT:*`;
      sources.forEach(src => {
        reply += `\n- ${src}`;
      });
    }

    return reply;
  } catch (error) {
    logger.error("RAG pipeline query failed", error);
    // Fallback to offline matching on failure
    try {
      const matches = await semanticSearchIndex.search(query, 3);
      return buildOfflineResponse(query, matches) + `\n\n_(Terjadi gangguan pada AI, beralih ke data lokal)_`;
    } catch (_) {
      return "Mohon maaf, terjadi kesalahan teknis pada sistem pencarian kami. Silakan coba beberapa saat lagi.";
    }
  }
}

export default queryRAG;
