import { semanticSearchIndex, SearchResult } from '../knowledge/semanticSearch.js';
import logger from '../utils/logger.js';
import dotenv from 'dotenv';
import axios from 'axios';
import { getSetting } from '../config/settings.js';

dotenv.config();

/**
 * Builds the offline fallback response when API is not configured or fails.
 */
function buildOfflineResponse(query: string, searchResults: SearchResult[]): string {
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
/**
 * keyless fallback AI (Pollinations.ai)
 */
async function queryFallbackAI(systemPrompt: string, userPrompt: string): Promise<string | null> {
  try {
    logger.info("Attempting to query Pollinations.ai keyless fallback...");
    const response = await axios.post('https://text.pollinations.ai/', {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });
    
    if (response.data && typeof response.data === 'string') {
      return response.data.trim();
    }
    return null;
  } catch (err: any) {
    logger.error("Pollinations.ai fallback failed:", err.message);
    return null;
  }
}

export async function queryRAG(query: string): Promise<string> {
  logger.info(`Processing query through RAG pipeline: "${query}"`);

  let matches: any[] = [];
  try {
    matches = await semanticSearchIndex.search(query, 3);
  } catch (_) {}

  // Format the context blocks for LLM
  let contextText = '';
  const sources = new Set<string>();
  
  if (matches.length > 0) {
    contextText = matches.map(m => {
      sources.add(m.source);
      return `[JUDUL]: ${m.title}\n[KONTEN]: ${m.content}\n[SUMBER]: ${m.source}`;
    }).join('\n\n---\n\n');
  }

  // Load custom AI settings or fall back to default
  const customSystemPrompt = await getSetting('AI_SYSTEM_PROMPT');
  const customModel = await getSetting('AI_MODEL');
  const customTemperature = await getSetting('AI_TEMPERATURE');
  const customMaxTokens = await getSetting('AI_MAX_TOKENS');

  const defaultSystemPrompt = `Anda adalah AI Academic Assistant khusus Universitas Terbuka (UT) Batam (UPBJJ-UT Batam) yang cerdas, sopan, dan profesional.
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
3. JANGAN melakukan halusinasi atau mengarang informasi. Jika informasi tidak ada di dalam KONTEKS atau panduan Batam, katakan secara jujur bahwa Anda tidak menemukan informasi tersebut di database resmi saat ini dan sarankan untuk menghubungi Hallo UT (1500024) atau WhatsApp UT Pusat (0811-4150-0024).`;

  const systemPrompt = `${customSystemPrompt || defaultSystemPrompt}

KONTEKS DOKUMEN AKADEMIK UMUM (CRAWLED):
${contextText || 'Tidak ada dokumen lokal yang cocok.'}`;

  const userPrompt = `Pertanyaan Mahasiswa: "${query}"`;

  let apiKey: string = await getSetting('OPENAI_API_KEY');
  if (apiKey) {
    apiKey = apiKey.trim().replace(/[\r\n\s\t\u200b\u200c\u200d\ufeff]/g, '');
  }

  // Fallback to the environment key directly (do NOT hardcode secrets in source files)
  if (!apiKey) {
    apiKey = process.env.OPENAI_API_KEY || '';
    apiKey = apiKey.trim().replace(/[\r\n\s\t\u200b\u200c\u200d\ufeff]/g, '');
  }

  let backupApiKey: string = await getSetting('OPENAI_API_KEY_BACKUP');
  if (backupApiKey) {
    backupApiKey = backupApiKey.trim().replace(/[\r\n\s\t\u200b\u200c\u200d\ufeff]/g, '');
  }
  if (!backupApiKey) {
    backupApiKey = process.env.OPENAI_API_KEY_BACKUP || '';
    backupApiKey = backupApiKey.trim().replace(/[\r\n\s\t\u200b\u200c\u200d\ufeff]/g, '');
  }

  let backupModel: string = await getSetting('OPENAI_API_MODEL_BACKUP');
  if (!backupModel) {
    backupModel = process.env.OPENAI_API_MODEL_BACKUP || 'gpt-4.1-mini';
  }

  let reply = '';
  let success = false;

  // 1. Try Primary AI API
  if (apiKey) {
    try {
      let apiUrl = 'https://api.openai.com/v1/chat/completions';
      let apiModel = 'gpt-4o-mini';

      if (apiKey.startsWith('AIzaSy') || apiKey.startsWith('AQ.')) {
        apiUrl = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
        // Force the working gemini-2.5-flash model since it is verified and highly reliable
        apiModel = customModel && customModel.includes('gemini') ? customModel : 'gemini-2.5-flash';
        logger.info(`Using Google Gemini API (${apiModel}) for RAG query.`);
      } else if (apiKey.startsWith('gsk_')) {
        apiUrl = 'https://api.groq.com/openai/v1/chat/completions';
        const isGroqModel = customModel && (customModel.includes('llama') || customModel.includes('mixtral') || customModel.includes('gemma'));
        apiModel = isGroqModel ? customModel : 'llama-3.3-70b-versatile';
        logger.info(`Using Groq API (${apiModel}) for RAG query.`);
      } else {
        apiUrl = 'https://api.openai.com/v1/chat/completions';
        apiModel = customModel || 'gpt-4o-mini';
        logger.info(`Using OpenAI API (${apiModel}) for RAG query.`);
      }

      const temperature = customTemperature !== undefined ? parseFloat(customTemperature) : 0.3;
      const max_tokens = customMaxTokens !== undefined ? parseInt(customMaxTokens, 10) : 800;

      logger.debug(`Sending request to primary AI model ${apiModel} (${apiUrl})...`);

      const response = await axios.post(apiUrl, {
        model: apiModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature,
        max_tokens
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        timeout: 15000
      });

      reply = response.data.choices[0].message.content.trim();
      success = true;
    } catch (error: any) {
      logger.error("Primary RAG pipeline query failed, attempting fallback to backup API key...", error.message);
    }
  } else {
    logger.info("Primary OpenAI API key not configured.");
  }

  // 2. Try Backup AI API if Primary failed or was not configured
  if (!success && backupApiKey) {
    try {
      let backupApiUrl = 'https://api.openai.com/v1/chat/completions';
      let resolvedBackupModel = backupModel;

      if (backupApiKey.startsWith('AIzaSy') || backupApiKey.startsWith('AQ.')) {
        backupApiUrl = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
        resolvedBackupModel = backupModel && backupModel.includes('gemini') ? backupModel : 'gemini-2.5-flash';
        logger.info(`Using Google Gemini API (${resolvedBackupModel}) for backup RAG query.`);
      } else if (backupApiKey.startsWith('gsk_')) {
        backupApiUrl = 'https://api.groq.com/openai/v1/chat/completions';
        const isGroqModel = backupModel && (backupModel.includes('llama') || backupModel.includes('mixtral') || backupModel.includes('gemma'));
        resolvedBackupModel = isGroqModel ? backupModel : 'llama-3.3-70b-versatile';
        logger.info(`Using Groq API (${resolvedBackupModel}) for backup RAG query.`);
      } else {
        backupApiUrl = 'https://api.openai.com/v1/chat/completions';
        logger.info(`Using OpenAI API (${resolvedBackupModel}) for backup RAG query.`);
      }

      const temperature = customTemperature !== undefined ? parseFloat(customTemperature) : 0.3;
      const max_tokens = customMaxTokens !== undefined ? parseInt(customMaxTokens, 10) : 800;

      logger.debug(`Sending request to backup AI model ${resolvedBackupModel} (${backupApiUrl})...`);

      const response = await axios.post(backupApiUrl, {
        model: resolvedBackupModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature,
        max_tokens
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${backupApiKey}`
        },
        timeout: 15000
      });

      reply = response.data.choices[0].message.content.trim() + `\n\n_(Respon dihasilkan oleh AI Cadangan)_`;
      success = true;
    } catch (error: any) {
      logger.error("Backup RAG pipeline query failed, attempting fallback to keyless AI...", error.message);
    }
  }

  // 3. Try Keyless Fallback AI (Pollinations.ai) if both API keys failed or were not configured
  if (!success) {
    logger.info("Attempting keyless fallback AI (Pollinations.ai)...");
    const fallbackReply = await queryFallbackAI(systemPrompt, userPrompt);
    if (fallbackReply) {
      reply = fallbackReply + `\n\n_(Respon dihasilkan oleh AI Gratis Cadangan)_`;
      success = true;
    }
  }

  // 4. Try Offline database search fallback if everything else failed
  if (!success) {
    logger.warn("All AI services failed. Falling back to offline database search.");
    return buildOfflineResponse(query, matches) + `\n\n_(Terjadi gangguan pada AI utama & cadangan, beralih ke data lokal)_`;
  }

  if (sources.size > 0) {
    reply += `\n\n*Sumber Resmi UT:*`;
    sources.forEach(src => {
      reply += `\n- ${src}`;
    });
  }

  return reply;
}

/**
 * General AI Query: OpenAI/Groq/Gemini Chat Completion without UT RAG Context
 */
export async function queryGeneralAI(query: string): Promise<string> {
  logger.info(`Processing query through General AI pipeline: "${query}"`);

  // Load custom AI settings or fall back to default
  const customModel = await getSetting('AI_MODEL');
  const customTemperature = await getSetting('AI_TEMPERATURE');
  const customMaxTokens = await getSetting('AI_MAX_TOKENS');

  const systemPrompt = `Anda adalah AI Assistant yang cerdas, ramah, dan profesional. Jawablah pertanyaan pengguna secara detail, akurat, dan langsung ke intinya dalam Bahasa Indonesia.`;
  const userPrompt = query;

  let apiKey: string = await getSetting('OPENAI_API_KEY');
  if (apiKey) {
    apiKey = apiKey.trim().replace(/[\r\n\s\t\u200b\u200c\u200d\ufeff]/g, '');
  }

  // Fallback to the environment key directly
  if (!apiKey || (!apiKey.startsWith('AIzaSy') && !apiKey.startsWith('AQ.'))) {
    apiKey = process.env.OPENAI_API_KEY || '';
    apiKey = apiKey.trim().replace(/[\r\n\s\t\u200b\u200c\u200d\ufeff]/g, '');
  }

  let backupApiKey: string = await getSetting('OPENAI_API_KEY_BACKUP');
  if (backupApiKey) {
    backupApiKey = backupApiKey.trim().replace(/[\r\n\s\t\u200b\u200c\u200d\ufeff]/g, '');
  }
  if (!backupApiKey) {
    backupApiKey = process.env.OPENAI_API_KEY_BACKUP || '';
    backupApiKey = backupApiKey.trim().replace(/[\r\n\s\t\u200b\u200c\u200d\ufeff]/g, '');
  }

  let backupModel: string = await getSetting('OPENAI_API_MODEL_BACKUP');
  if (!backupModel) {
    backupModel = process.env.OPENAI_API_MODEL_BACKUP || 'gpt-4.1-mini';
  }

  let reply = '';
  let success = false;

  // 1. Try Primary AI API
  if (apiKey) {
    try {
      let apiUrl = 'https://api.openai.com/v1/chat/completions';
      let apiModel = 'gpt-4o-mini';

      if (apiKey.startsWith('AIzaSy') || apiKey.startsWith('AQ.')) {
        apiUrl = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
        apiModel = customModel && customModel.includes('gemini') ? customModel : 'gemini-2.5-flash';
        logger.info(`Using Google Gemini API (${apiModel}) for general AI query.`);
      } else if (apiKey.startsWith('gsk_')) {
        apiUrl = 'https://api.groq.com/openai/v1/chat/completions';
        const isGroqModel = customModel && (customModel.includes('llama') || customModel.includes('mixtral') || customModel.includes('gemma'));
        apiModel = isGroqModel ? customModel : 'llama-3.3-70b-versatile';
        logger.info(`Using Groq API (${apiModel}) for general AI query.`);
      } else {
        apiUrl = 'https://api.openai.com/v1/chat/completions';
        apiModel = customModel || 'gpt-4o-mini';
        logger.info(`Using OpenAI API (${apiModel}) for general AI query.`);
      }

      const temperature = customTemperature !== undefined ? parseFloat(customTemperature) : 0.7;
      const max_tokens = customMaxTokens !== undefined ? parseInt(customMaxTokens, 10) : 1000;

      logger.debug(`Sending request to primary AI model ${apiModel} (${apiUrl})...`);

      const response = await axios.post(apiUrl, {
        model: apiModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature,
        max_tokens
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        timeout: 20000
      });

      reply = response.data.choices[0].message.content.trim();
      success = true;
    } catch (error: any) {
      logger.error("Primary general AI query failed, attempting fallback to backup API key...", error.message);
    }
  }

  // 2. Try Backup AI API if Primary failed
  if (!success && backupApiKey) {
    try {
      let backupApiUrl = 'https://api.openai.com/v1/chat/completions';
      let resolvedBackupModel = backupModel;

      if (backupApiKey.startsWith('AIzaSy') || backupApiKey.startsWith('AQ.')) {
        backupApiUrl = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
        resolvedBackupModel = backupModel && backupModel.includes('gemini') ? backupModel : 'gemini-2.5-flash';
        logger.info(`Using Google Gemini API (${resolvedBackupModel}) for backup general AI query.`);
      } else if (backupApiKey.startsWith('gsk_')) {
        backupApiUrl = 'https://api.groq.com/openai/v1/chat/completions';
        const isGroqModel = backupModel && (backupModel.includes('llama') || backupModel.includes('mixtral') || backupModel.includes('gemma'));
        resolvedBackupModel = isGroqModel ? backupModel : 'llama-3.3-70b-versatile';
        logger.info(`Using Groq API (${resolvedBackupModel}) for backup general AI query.`);
      } else {
        backupApiUrl = 'https://api.openai.com/v1/chat/completions';
        logger.info(`Using OpenAI API (${resolvedBackupModel}) for backup general AI query.`);
      }

      const temperature = customTemperature !== undefined ? parseFloat(customTemperature) : 0.7;
      const max_tokens = customMaxTokens !== undefined ? parseInt(customMaxTokens, 10) : 1000;

      logger.debug(`Sending request to backup AI model ${resolvedBackupModel} (${backupApiUrl})...`);

      const response = await axios.post(backupApiUrl, {
        model: resolvedBackupModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature,
        max_tokens
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${backupApiKey}`
        },
        timeout: 20000
      });

      reply = response.data.choices[0].message.content.trim() + `\n\n_(Respon dihasilkan oleh AI Cadangan)_`;
      success = true;
    } catch (error: any) {
      logger.error("Backup general AI query failed, attempting fallback to keyless AI...", error.message);
    }
  }

  // 3. Try Keyless Fallback AI if both API keys failed
  if (!success) {
    logger.info("Attempting keyless fallback AI (Pollinations.ai) for general query...");
    const fallbackReply = await queryFallbackAI(systemPrompt, userPrompt);
    if (fallbackReply) {
      reply = fallbackReply + `\n\n_(Respon dihasilkan oleh AI Gratis Cadangan)_`;
      success = true;
    }
  }

  if (!success) {
    throw new Error("Semua layanan AI gagal merespon.");
  }

  return reply;
}

export async function queryVisionRAG(base64Image: string, mimeType: string, prompt: string): Promise<string> {
  let apiKey: string = await getSetting('OPENAI_API_KEY');
  if (apiKey) {
    apiKey = apiKey.trim().replace(/[\r\n\s\t\u200b\u200c\u200d\ufeff]/g, '');
  }

  if (!apiKey || (!apiKey.startsWith('AIzaSy') && !apiKey.startsWith('AQ.'))) {
    apiKey = process.env.OPENAI_API_KEY || '';
    apiKey = apiKey.trim().replace(/[\r\n\s\t\u200b\u200c\u200d\ufeff]/g, '');
  }

  if (!apiKey) {
    throw new Error("API Key tidak dikonfigurasi untuk Vision.");
  }

  let apiUrl = 'https://api.openai.com/v1/chat/completions';
  let apiModel = 'gpt-4o-mini';

  if (apiKey.startsWith('AIzaSy') || apiKey.startsWith('AQ.')) {
    apiUrl = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
    apiModel = 'gemini-2.5-flash';
  } else if (apiKey.startsWith('gsk_')) {
    apiUrl = 'https://api.groq.com/openai/v1/chat/completions';
    apiModel = 'llama-3.2-11b-vision-preview';
  }

  logger.info(`Sending multimodal vision request using model ${apiModel}...`);

  const response = await axios.post(apiUrl, {
    model: apiModel,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          {
            type: 'image_url',
            image_url: {
              url: `data:${mimeType};base64,${base64Image}`
            }
          }
        ]
      }
    ],
    max_tokens: 1000
  }, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    timeout: 30000
  });

  return response.data.choices[0].message.content.trim();
}

/**
 * Transcribes audio (base64 encoded) using Gemini API or OpenAI Whisper API
 */
export async function transcribeAudio(base64Data: string, mimeType: string): Promise<string> {
  let apiKey: string = await getSetting('OPENAI_API_KEY');
  if (apiKey) {
    apiKey = apiKey.trim().replace(/[\r\n\s\t\u200b\u200c\u200d\ufeff]/g, '');
  }
  if (!apiKey || (!apiKey.startsWith('AIzaSy') && !apiKey.startsWith('AQ.'))) {
    apiKey = process.env.OPENAI_API_KEY || '';
    apiKey = apiKey.trim().replace(/[\r\n\s\t\u200b\u200c\u200d\ufeff]/g, '');
  }

  const prompt = "Transkripsikan rekaman audio voice note ini. Pertahankan makna asli, rapikan tanda baca dan kapitalisasi, jangan menambahkan informasi, dan gunakan \"[tidak terdengar]\" jika ada bagian audio yang tidak jelas. Balas hanya dengan hasil transkripsi.";

  if (apiKey && (apiKey.startsWith('AIzaSy') || apiKey.startsWith('AQ.'))) {
    try {
      logger.info("Transcribing audio using Google Gemini multimodal API...");
      const normalizedMime = mimeType.split(';')[0].trim();

      const response = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        contents: [
          {
            parts: [
              {
                inlineData: {
                  mimeType: normalizedMime,
                  data: base64Data
                }
              },
              {
                text: prompt
              }
            ]
          }
        ]
      }, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 25000
      });

      if (response.data && response.data.candidates && response.data.candidates[0]?.content?.parts[0]?.text) {
        return response.data.candidates[0].content.parts[0].text.trim();
      }
      throw new Error("Invalid response format from Gemini API");
    } catch (err: any) {
      logger.error("Gemini audio transcription failed: " + (err.response?.data ? JSON.stringify(err.response.data) : err.message));
    }
  }

  logger.info("Transcribing audio using OpenAI Whisper API...");
  const fs = await import('fs');
  const path = await import('path');

  let ext = 'ogg';
  if (mimeType.includes('mp3')) ext = 'mp3';
  else if (mimeType.includes('wav')) ext = 'wav';
  else if (mimeType.includes('m4a')) ext = 'm4a';
  else if (mimeType.includes('mp4')) ext = 'mp4';

  const tempDir = path.resolve('temp_audio');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  const tempFile = path.join(tempDir, `vnt_${Date.now()}.${ext}`);
  fs.writeFileSync(tempFile, Buffer.from(base64Data, 'base64'));

  try {
    const fileBuffer = fs.readFileSync(tempFile);
    const fileBlob = new Blob([fileBuffer], { type: mimeType });
    const formData = new FormData();
    formData.append('file', fileBlob, `vnt.${ext}`);
    formData.append('model', 'whisper-1');
    formData.append('prompt', prompt);

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      },
      body: formData
    });

    const result: any = await response.json();
    if (result && result.text) {
      return result.text.trim();
    }
    throw new Error(result.error?.message || "Invalid response format from Whisper API");
  } catch (err: any) {
    logger.error("Whisper transcription failed: " + err.message);
    throw err;
  } finally {
    try {
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
    } catch (_) {}
  }
}

export default queryRAG;
