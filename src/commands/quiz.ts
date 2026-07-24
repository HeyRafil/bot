import { Command } from './index.js';
import prisma from '../database/prisma.js';
import logger from '../utils/logger.js';
import { getSetting } from '../config/settings.js';
import fs from 'fs';
import * as WWebJS from 'whatsapp-web.js';

import { getSafeChat, getSerializedId } from '../utils/chatHelper.js';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';

declare let window: any;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface Question {
  id: number;
  level: string;
  question: string;
  options: string[];
  answer: string;
  explanation: string;
}

interface QuizSession {
  groupId: string;
  questions: Question[];
  currentIndex: number;
  attempts: Map<string, number>; // memberJid -> attempt count for current question
  scores: Map<string, number>; // memberJid -> points gained this session
  timeout: NodeJS.Timeout | null;
  currentMsgId?: string;
  isTransitioning?: boolean;
}

export const activeQuizzes = new Map<string, QuizSession>();

/**
 * Generates quiz questions using a keyless fallback AI (Pollinations.ai)
 */
async function generateQuizQuestionsWithFallbackAI(level: string): Promise<Question[] | null> {
  try {
    const systemPrompt = `Anda adalah AI Academic Assistant Universitas Terbuka. Tugas Anda adalah membantu mahasiswa dengan membuat 5 soal latihan kuis pilihan ganda yang bervariasi secara acak (tentang pengetahuan umum, sains, matematika, sejarah, geografi, atau teknologi) dalam Bahasa Indonesia.
Tingkat kesulitan soal harus bernilai: "${level}".
Format output harus berupa JSON object valid (tanpa penjelasan lain diluar JSON) dengan skema berikut:
{
  "questions": [
    {
      "id": 1,
      "level": "${level}",
      "question": "Pertanyaan kuis...",
      "options": ["A. Pilihan A", "B. Pilihan B", "C. Pilihan C", "D. Pilihan D"],
      "answer": "Kunci jawaban berupa huruf saja (A/B/C/D)",
      "explanation": "Pembahasan singkat mengapa kunci jawaban tersebut benar."
    }
  ]
}`;

    logger.info(`Requesting Pollinations keyless AI to generate quiz questions (Level: ${level})`);

    const response = await axios.post('https://text.pollinations.ai/', {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Hasilkan 5 kuis acak pilihan ganda level ${level}` }
      ],
      jsonMode: true
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 20000
    });

    let contentText = typeof response.data === 'string' ? response.data.trim() : JSON.stringify(response.data);
    if (contentText.startsWith('```json')) {
      contentText = contentText.substring(7, contentText.length - 3).trim();
    } else if (contentText.startsWith('```')) {
      contentText = contentText.substring(3, contentText.length - 3).trim();
    }

    const parsedData = JSON.parse(contentText);
    if (parsedData && Array.isArray(parsedData.questions)) {
      return parsedData.questions as Question[];
    }
    if (Array.isArray(parsedData) && parsedData.length > 0 && parsedData[0].question) {
      return parsedData as Question[];
    }

    return null;
  } catch (err: any) {
    logger.error(`Failed to generate fallback AI quiz questions:`, err.message);
    return null;
  }
}

/**
 * Generates quiz questions dynamically using the Gemini / OpenAI API
 */
async function generateQuizQuestionsWithAI(level: string): Promise<Question[] | null> {
  let apiKey: string = await getSetting('OPENAI_API_KEY');
  if (apiKey) {
    apiKey = apiKey.trim().replace(/[\r\n\s\t\u200b\u200c\u200d\ufeff]/g, '');
  }
  
  if (!apiKey) {
    apiKey = process.env.OPENAI_API_KEY || '';
    apiKey = apiKey.trim().replace(/[\r\n\s\t\u200b\u200c\u200d\ufeff]/g, '');
  }

  if (apiKey) {
    try {
      let apiUrl = 'https://api.openai.com/v1/chat/completions';
      let apiModel = 'gpt-4o-mini';

      if (apiKey.startsWith('AIzaSy') || apiKey.startsWith('AQ.')) {
        apiUrl = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
        apiModel = 'gemini-1.5-flash';
      } else if (apiKey.startsWith('gsk_')) {
        apiUrl = 'https://api.groq.com/openai/v1/chat/completions';
        apiModel = 'llama-3.1-8b-instant';
      }

      const systemPrompt = `Anda adalah AI Academic Assistant Universitas Terbuka. Tugas Anda adalah membantu mahasiswa dengan membuat 5 soal latihan kuis pilihan ganda yang bervariasi secara acak (tentang pengetahuan umum, sains, matematika, sejarah, geografi, atau teknologi) dalam Bahasa Indonesia.
Tingkat kesulitan soal harus bernilai: "${level}".
Format output harus berupa JSON object valid sesuai dengan skema berikut:
{
  "questions": [
    {
      "id": 1,
      "level": "${level}",
      "question": "Pertanyaan kuis...",
      "options": ["A. Pilihan A", "B. Pilihan B", "C. Pilihan C", "D. Pilihan D"],
      "answer": "Kunci jawaban berupa huruf saja (A/B/C/D)",
      "explanation": "Pembahasan singkat mengapa kunci jawaban tersebut benar."
    }
  ]
}`;

      logger.info(`Requesting AI to generate quiz questions (Level: ${level})`);

      const response = await axios.post(apiUrl, {
        model: apiModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Hasilkan 5 kuis acak pilihan ganda level ${level}` }
        ],
        response_format: { type: 'json_object' }
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        timeout: 20000
      });

      let contentText = response.data.choices[0].message.content.trim();
      
      if (contentText.startsWith('```json')) {
        contentText = contentText.substring(7, contentText.length - 3).trim();
      } else if (contentText.startsWith('```')) {
        contentText = contentText.substring(3, contentText.length - 3).trim();
      }

      const parsedData = JSON.parse(contentText);
      if (parsedData && Array.isArray(parsedData.questions)) {
        return parsedData.questions as Question[];
      }
      if (Array.isArray(parsedData) && parsedData.length > 0 && parsedData[0].question) {
        return parsedData as Question[];
      }
      return null;
    } catch (err: any) {
      logger.error(`Failed to generate primary AI quiz questions, trying fallback:`, err.message);
      return await generateQuizQuestionsWithFallbackAI(level);
    }
  } else {
    logger.info(`API Key not configured. Using keyless fallback AI for quiz.`);
    return await generateQuizQuestionsWithFallbackAI(level);
  }
}

// Load questions from storage
const questionsPath = path.resolve('storage/db/quiz_questions.json');
let quizQuestions: Question[] = [];
try {
  if (fs.existsSync(questionsPath)) {
    quizQuestions = JSON.parse(fs.readFileSync(questionsPath, 'utf8'));
  }
} catch (err) {
  logger.error('[quiz.ts] Failed to load quiz questions', err);
}

function getRandomQuestions(all: Question[], count: number): Question[] {
  const shuffled = [...all].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, Math.min(count, all.length));
}

export const quizCommand: Command = {
  name: 'quiz',
  aliases: ['kuis'],
  roleRequired: 'Member',
  description: 'Memulai kuis akademik kelompok di grup ini.',
  async execute(client, msg, chat, args, privileges) {
    if (!chat.isGroup) {
      return msg.reply('❌ Kuis akademik hanya dapat dimainkan di dalam grup WhatsApp!');
    }

    const groupId = chat.id._serialized;

    if (activeQuizzes.has(groupId)) {
      return msg.reply('⚠️ Kuis sedang berlangsung di grup ini. Silakan jawab pertanyaan yang sedang aktif.');
    }

    // Randomly select difficulty level
    const levels = ['easy', 'medium', 'hard'];
    const level = levels[Math.floor(Math.random() * levels.length)];

    let selected: Question[] = [];
    let isAiGenerated = false;

    // Load local bank questions first as baseline
    if (quizQuestions.length === 0) {
      return msg.reply('❌ Bank kuis kosong atau gagal dimuat. Silakan hubungi admin.');
    }
    const filteredQuestions = quizQuestions.filter(q => q.level === level);
    if (filteredQuestions.length === 0) {
      return msg.reply(`❌ Tidak ada pertanyaan untuk tingkat kesulitan *${level}* saat ini.`);
    }
    selected = getRandomQuestions(filteredQuestions, 5);

    // Send a message notifying that the bot is generating questions
    let generatingMsg: any = await chat.sendMessage(`🔍 Sedang merumuskan 5 soal kuis acak baru (Level: *${level.toUpperCase()}*) menggunakan AI... ⏳`);
    if (!generatingMsg) {
      try {
        await new Promise(resolve => setTimeout(resolve, 250));
        const messages = await chat.fetchMessages({ limit: 5 });
        generatingMsg = messages.reverse().find((m: any) => m.fromMe || (m.id && m.id.fromMe));
      } catch (_) {}
    }
    if (generatingMsg && generatingMsg.id && !generatingMsg.id._serialized) {
      generatingMsg.id._serialized = generatingMsg.id.$1 || getSerializedId(generatingMsg.id);
    }

    const session: QuizSession = {
      groupId,
      questions: selected,
      currentIndex: 0,
      attempts: new Map(),
      scores: new Map(),
      timeout: null
    };

    activeQuizzes.set(groupId, session);

    // Asynchronously fetch AI questions in the background
    generateQuizQuestionsWithAI(level).then((generated) => {
      if (generated && generated.length > 0) {
        session.questions = generated;
        isAiGenerated = true;
        logger.info(`[quiz.ts] Background AI quiz generation succeeded. Replaced questions for group ${groupId}`);
      }
    }).catch((err) => {
      logger.error(`[quiz.ts] Background AI quiz generation failed`, err);
    });

    let levelEmoji = '🟢';
    if (level === 'medium') levelEmoji = '🟡';
    else if (level === 'hard') levelEmoji = '🔴';

    let secondsLeft = 10;
    const getIntroText = (secs: number) => {
      const total = 10;
      const progress = total - secs;
      const progressBar = '▓'.repeat(progress) + '░'.repeat(secs);
      const label = isAiGenerated ? 'AI Generated' : 'Local Bank';
      return `🏆 *KUIS PEMBELAJARAN - LEVEL ${level.toUpperCase()} (${label})* 🏆\n\n` +
        `Kuis terpilih tingkat kesulitan: ${levelEmoji} *${level.toUpperCase()}*\n` +
        `Kuis berisi 5 soal pilihan ganda acak seputar sains & pengetahuan umum.\n` +
        `Setiap jawaban yang benar bernilai +10 poin.\n\n` +
        `⏱️ *Memulai dalam:* [${progressBar}] *${secs}s*\n_Persiapkan diri Anda!_`;
    };

    let introMsg = generatingMsg;
    let edited = false;
    if (generatingMsg) {
      edited = await safeEditMessage(client, generatingMsg, getIntroText(secondsLeft));
      if (!edited) {
        try {
          if (typeof generatingMsg.edit === 'function') {
            await generatingMsg.edit(getIntroText(secondsLeft));
            edited = true;
          }
        } catch (_) {}
      }
    }
    if (!edited) {
      introMsg = await chat.sendMessage(getIntroText(secondsLeft));
      if (!introMsg) {
        try {
          await new Promise(resolve => setTimeout(resolve, 250));
          const messages = await chat.fetchMessages({ limit: 5 });
          introMsg = messages.reverse().find((m: any) => m.fromMe || (m.id && m.id.fromMe));
        } catch (_) {}
      }
    }
    if (introMsg && introMsg.id && !introMsg.id._serialized) {
      introMsg.id._serialized = introMsg.id.$1 || getSerializedId(introMsg.id);
    }
    
    const interval = setInterval(async () => {
      secondsLeft--;
      if (secondsLeft > 0) {
        try {
          if (introMsg) {
            let tickEdited = await safeEditMessage(client, introMsg, getIntroText(secondsLeft));
            if (!tickEdited && typeof introMsg.edit === 'function') {
              await introMsg.edit(getIntroText(secondsLeft));
            }
          }
        } catch (err) {
          logger.error('[quiz.ts] Failed to edit countdown in quiz intro message', err);
        }
      } else {
        clearInterval(interval);
        try {
          const finalIntroText = `🏆 *KUIS PEMBELAJARAN - LEVEL ${level.toUpperCase()} (${isAiGenerated ? 'AI Generated' : 'Local Bank'})* 🏆\n\n` +
            `Kuis terpilih tingkat kesulitan: ${levelEmoji} *${level.toUpperCase()}*\n` +
            `Kuis berisi 5 soal pilihan ganda acak seputar sains & pengetahuan umum.\n` +
            `Setiap jawaban yang benar bernilai +10 poin.\n\n` +
            `*Kuis dimulai!*`;
          let editedFinal = false;
          if (introMsg) {
            editedFinal = await safeEditMessage(client, introMsg, finalIntroText);
            if (!editedFinal && typeof introMsg.edit === 'function') {
              await introMsg.edit(finalIntroText);
              editedFinal = true;
            }
          }
          if (!editedFinal) {
            await chat.sendMessage(finalIntroText);
          }
        } catch (err) {
          logger.error('[quiz.ts] Failed to edit final countdown in quiz intro message', err);
        }
        askQuestion(client, chat, session);
      }
    }, 1000);
  }
};

async function askQuestion(client: any, chat: any, session: QuizSession) {
  session.isTransitioning = false;
  if (session.currentIndex >= session.questions.length) {
    return endQuiz(chat, session);
  }

  const q = session.questions[session.currentIndex];
  session.attempts.clear();

  const getQuestionText = (secs: number) => {
    let qText = `📝 *PERTANYAAN ${session.currentIndex + 1}/${session.questions.length}* 📝\n\n`;
    qText += `${q.question}\n\n`;
    q.options.forEach((opt, idx) => {
      const prefixes = ['A', 'B', 'C', 'D'];
      const prefix = prefixes[idx] || 'A';
      let optText = opt.trim();
      
      const hasPrefixRegex = /^[A-D][\.\)\s-]/i;
      if (!hasPrefixRegex.test(optText)) {
        optText = `${prefix}. ${optText}`;
      } else {
        optText = optText.replace(/^[a-dA-D]/i, prefix);
      }
      
      qText += `👉 ${optText}\n`;
    });
    
    qText += `\n💡 PENTING: Balas (reply/quote) pesan ini dengan mengetik A, B, C, atau D untuk menjawab!\n`;
    if (secs > 0) {
      const totalBlocks = 15;
      const elapsedBlocks = Math.floor((45 - secs) / 3);
      const remainingBlocks = Math.max(0, totalBlocks - elapsedBlocks);
      const progressBar = '▓'.repeat(elapsedBlocks) + '░'.repeat(remainingBlocks);
      qText += `⏳ *Waktu Menjawab:* [${progressBar}] *${secs}s*`;
    } else {
      qText += `⏱️ *Waktu Habis!*`;
    }
    return qText;
  };

  let secondsLeft = 45;
  let sentMsg: any = await chat.sendMessage(getQuestionText(secondsLeft));
  if (!sentMsg) {
    try {
      await new Promise(resolve => setTimeout(resolve, 250));
      const messages = await chat.fetchMessages({ limit: 5 });
      sentMsg = messages.reverse().find((m: any) => m.fromMe || (m.id && m.id.fromMe));
    } catch (_) {}
  }
  
  if (sentMsg) {
    if (sentMsg.id && !sentMsg.id._serialized) {
      sentMsg.id._serialized = sentMsg.id.$1 || getSerializedId(sentMsg.id);
    }
    session.currentMsgId = sentMsg.id._serialized;
  }

  const currentIndexBefore = session.currentIndex;

  session.timeout = setInterval(async () => {
    if (session.isTransitioning || session.currentIndex > currentIndexBefore) {
      if (session.timeout) {
        clearInterval(session.timeout);
        session.timeout = null;
      }
      return;
    }

    secondsLeft--;
    if (secondsLeft > 0) {
      try {
        if (sentMsg) {
          let qTickEdited = await safeEditMessage(client, sentMsg, getQuestionText(secondsLeft));
          if (!qTickEdited && typeof sentMsg.edit === 'function') {
            try {
              await sentMsg.edit(getQuestionText(secondsLeft));
            } catch (editErr: any) {
              if (!editErr.message || !editErr.message.includes('serialize')) {
                throw editErr;
              }
            }
          }
        }
      } catch (err) {
        logger.error('[quiz.ts] Failed to edit question countdown', err);
      }
    } else {
      if (session.timeout) {
        clearInterval(session.timeout);
        session.timeout = null;
      }
      if (session.isTransitioning) return;
      session.isTransitioning = true;

      try {
        const finalQText = getQuestionText(0);
        if (sentMsg) {
          let qFinalEdited = await safeEditMessage(client, sentMsg, finalQText);
          if (!qFinalEdited && typeof sentMsg.edit === 'function') {
            try {
              await sentMsg.edit(finalQText);
            } catch (editErr: any) {
              if (!editErr.message || !editErr.message.includes('serialize')) {
                throw editErr;
              }
            }
          }
        }
      } catch (err) {
        logger.error('[quiz.ts] Failed to edit time-up question text', err);
      }

      const isLastQuestion = session.currentIndex === session.questions.length - 1;
      let timeoutText = `⏱️ *Waktu Habis!* Tidak ada yang menjawab dengan benar.\n\n*Jawaban Benar:* *${q.answer}*\n*Penjelasan:* ${q.explanation}\n\n`;
      if (isLastQuestion) {
        timeoutText += `_Kuis selesai! Menghitung hasil skor akhir..._`;
      } else {
        timeoutText += `_Menyiapkan soal berikutnya..._`;
      }
      await chat.sendMessage(timeoutText);
      session.currentIndex++;
      setTimeout(() => {
        askQuestion(client, chat, session);
      }, 4000);
    }
  }, 1000) as any;
}

async function endQuiz(chat: any, session: QuizSession) {
  activeQuizzes.delete(session.groupId);

  let text = `🏆 *KUIS SELESAI* 🏆\n\nTerima kasih telah berpartisipasi dalam kuis akademik UT!\n\n*Poin yang Diperoleh Sesi Ini:*\n`;
  
  if (session.scores.size === 0) {
    text += `_- Tidak ada yang menjawab benar pada sesi ini._\n`;
  } else {
    let index = 1;
    for (const [jid, points] of session.scores.entries()) {
      const number = jid.split('@')[0];
      text += `${index}. @${number} : *+${points} Poin*\n`;
      index++;
    }
  }
  
  text += `\nKetik *.leaderboard* untuk melihat skor tertinggi grup Anda!`;
  
  const mentions = Array.from(session.scores.keys());
  await chat.sendMessage(text, { mentions });
}

/**
 * Handles incoming messages to check if they are answers to an active quiz
 */
export async function handleQuizAnswer(msg: any): Promise<boolean> {
  const groupId = msg.from;
  const session = activeQuizzes.get(groupId);
  if (!session) return false;

  const senderId = msg.author || msg.from;

  if (session.isTransitioning) {
    logger.info(`Quiz is transitioning to next question, ignoring answer from ${senderId}`);
    return true; // Ignore and intercept
  }

  // Enforce quote reply check using official getQuotedMessage API with robust ID splitting
  let isQuotedCorrectly = false;
  if (msg.hasQuotedMsg) {
    // 1. Try checking the raw data quoted message body first (100% immune to Puppeteer evaluation failures!)
    if (msg._data && msg._data.quotedMsg && typeof msg._data.quotedMsg.body === 'string') {
      const quotedBody = msg._data.quotedMsg.body;
      if (quotedBody.includes('PERTANYAAN') && quotedBody.includes('Balas (reply/quote)')) {
        isQuotedCorrectly = true;
        logger.info(`Quiz Answer Quote verified via raw data body matches.`);
      }
    }

    // 2. Try raw data quotedStanzaID or quotedMsg.id comparison
    if (!isQuotedCorrectly && session.currentMsgId) {
      const sIdParts = session.currentMsgId.split('_');
      const sId = sIdParts[sIdParts.length - 1];

      // Check quotedStanzaID
      if (msg._data && msg._data.quotedStanzaID) {
        const stanzaId = msg._data.quotedStanzaID;
        if (stanzaId === sId || msg._data.quotedStanzaID === session.currentMsgId) {
          isQuotedCorrectly = true;
          logger.info(`Quiz Answer Quote verified via raw data stanza ID: ${stanzaId}`);
        }
      }

      // Check quotedMsg.id
      if (!isQuotedCorrectly && msg._data && msg._data.quotedMsg && msg._data.quotedMsg.id) {
        const qId = msg._data.quotedMsg.id;
        const qIdSerialized = typeof qId === 'object' ? qId._serialized : qId;
        const qIdId = typeof qId === 'object' ? qId.id : qId;
        if (qIdSerialized === session.currentMsgId || qIdId === sId) {
          isQuotedCorrectly = true;
          logger.info(`Quiz Answer Quote verified via raw data message ID: ${qIdId}`);
        }
      }
    }

    // 3. Fallback: call msg.getQuotedMessage() and check both ID and body content
    if (!isQuotedCorrectly) {
      try {
        const quotedMsg = await msg.getQuotedMessage();
        if (quotedMsg) {
          // Check body content
          if (typeof quotedMsg.body === 'string' && quotedMsg.body.includes('PERTANYAAN') && quotedMsg.body.includes('Balas (reply/quote)')) {
            isQuotedCorrectly = true;
            logger.info(`Quiz Answer Quote verified via fallback API body matches.`);
          }
          
          // Check ID
          if (!isQuotedCorrectly && quotedMsg.id && quotedMsg.id._serialized && session.currentMsgId) {
            const qIdParts = quotedMsg.id._serialized.split('_');
            const qId = qIdParts[qIdParts.length - 1];
            
            const sIdParts = session.currentMsgId.split('_');
            const sId = sIdParts[sIdParts.length - 1];
            
            if (qId === sId || quotedMsg.id._serialized === session.currentMsgId) {
              isQuotedCorrectly = true;
              logger.info(`Quiz Answer Quote verified via fallback API message ID: ${qId}`);
            }
          }
        }
      } catch (err: any) {
        logger.warn(`[quiz.ts] Failed to get quoted message in handleQuizAnswer fallback (non-critical): ${err.message}`);
      }
    }
  }

  if (!isQuotedCorrectly) {
    return false; // Ignored as a quiz answer if not a reply to the active question
  }

  // Normalize message text
  const ans = msg.body ? msg.body.trim().toUpperCase() : '';
  if (ans !== 'A' && ans !== 'B' && ans !== 'C' && ans !== 'D') {
    return false; // Not a quiz answer format
  }

  // Check if already attempted this question twice
  const attemptCount = session.attempts.get(senderId) || 0;
  if (attemptCount >= 2) {
    return true; // Ignore and intercept (spent all attempts)
  }

  session.attempts.set(senderId, attemptCount + 1);
  const q = session.questions[session.currentIndex];

  const correctAnswerChar = q.answer.trim().charAt(0).toUpperCase();

  if (ans === correctAnswerChar) {
    session.isTransitioning = true;
    // Correct! Cancel timeout immediately
    if (session.timeout) {
      clearInterval(session.timeout);
      session.timeout = null;
    }

    // Award score locally in session
    const currentScore = session.scores.get(senderId) || 0;
    session.scores.set(senderId, currentScore + 10);

    // Save to database using SQLite raw queries (safe fallback)
    try {
      const member = await prisma.groupMember.findUnique({
        where: {
          groupId_whatsappId: {
            groupId,
            whatsappId: senderId
          }
        }
      });

      if (member) {
        await prisma.$executeRaw`UPDATE group_members SET quizScore = quizScore + 10 WHERE id = ${member.id}`;
      } else {
        const notifyName = msg._data?.notifyName || senderId.split('@')[0];
        await prisma.groupMember.create({
          data: {
            groupId,
            whatsappId: senderId,
            role: 'member',
            name: notifyName
          }
        });
        await prisma.$executeRaw`UPDATE group_members SET quizScore = 10 WHERE groupId = ${groupId} AND whatsappId = ${senderId}`;
      }
    } catch (dbErr) {
      logger.error('[quiz.ts] Failed to update quiz score in DB', dbErr);
    }

    const isLastQuestion = session.currentIndex === session.questions.length - 1;
    const number = senderId.split('@')[0];
    let reply = `🎉 @${number} menjawab *BENAR*! (Jawaban: *${q.answer}*)\n\n`;
    reply += `*Penjelasan:* ${q.explanation}\n\n`;
    if (isLastQuestion) {
      reply += `_Kuis selesai! Menghitung hasil skor akhir..._`;
    } else {
      reply += `_Menyiapkan soal berikutnya..._`;
    }

    await msg.reply(reply, undefined, { mentions: [senderId] });
    try {
      await msg.react('✅');
    } catch (err) {
      logger.error('[quiz.ts] Failed to react to correct answer', err);
    }

    session.currentIndex++;
    setTimeout(() => {
      // Re-fetch client reference from getClient or pass it
      const client = (msg as any).client || null; 
      getSafeChat(msg, client, 'quiz').then((chat: any) => {
        askQuestion(client, chat, session);
      });
    }, 5000);

    return true;
  } else {
    // Incorrect answer
    const currentAttempts = attemptCount + 1;
    const remainingAttempts = 2 - currentAttempts;

    try {
      await msg.react('❌');
    } catch (err) {
      logger.error('[quiz.ts] Failed to react to incorrect answer', err);
    }

    if (remainingAttempts > 0) {
      const number = senderId.split('@')[0];
      await msg.reply(`⚠️ @${number}, jawaban Anda salah! Sisa kesempatan Anda pada soal ini: *${remainingAttempts}x* lagi.`, undefined, { mentions: [senderId] });
    }
    return true;
  }
}

export default quizCommand;

async function safeEditMessage(client: any, message: any, newText: string): Promise<boolean> {
  const msgId = message?.id?._serialized || message?.id?.$1 || getSerializedId(message?.id);
  if (!msgId) {
    logger.warn(`[quiz.ts] safeEditMessage: invalid message object passed. Type: ${typeof message}, keys: ${Object.keys(message || {})}, id: ${JSON.stringify(message?.id)}`);
    return false;
  }
  try {
    if (!client.pupPage) {
      logger.warn(`[quiz.ts] safeEditMessage failed: client.pupPage is undefined`);
      return false;
    }
    
    const evaluatePromise = client.pupPage.evaluate(async (targetId: string, text: string) => {
      const report = { success: false, step: 'start', details: '', error: '' };
      try {
        let store = (window as any).Store;
        if (!store) {
          try { store = (window as any).require('WAWebCollections'); } catch (_) {}
        }
        if (!store) {
          report.error = 'Both window.Store and WAWebCollections are undefined';
          return report;
        }
        
        let msg = null;
        // 1. Get from Store.Msg
        if (store.Msg) {
          msg = store.Msg.get(targetId);
          if (msg) report.details += 'Found in Store.Msg. ';
        }
        
        // 2. Get from WAWebCollections
        if (!msg) {
          try {
            const collections = (window as any).require('WAWebCollections');
            if (collections && collections.Msg) {
              msg = collections.Msg.get(targetId);
              if (msg) report.details += 'Found in WAWebCollections.Msg. ';
            }
          } catch (e: any) {
            report.details += `WAWebCollections failed: ${e.message}. `;
          }
        }
        
        // 3. Retry loop if not found (wait up to 1 second)
        if (!msg) {
          report.details += 'Msg not found, starting retry loop. ';
          for (let i = 0; i < 10; i++) {
            await new Promise(resolve => setTimeout(resolve, 100));
            if (store.Msg) {
              msg = store.Msg.get(targetId);
            }
            if (!msg) {
              try {
                const collections = (window as any).require('WAWebCollections');
                if (collections && collections.Msg) {
                  msg = collections.Msg.get(targetId);
                }
              } catch (_) {}
            }
            if (msg) {
              report.details += `Found in retry loop at step ${i}. `;
              break;
            }
          }
        }
        
        // 4. Try getMessagesById
        if (!msg) {
          try {
            const collections = (window as any).require('WAWebCollections');
            if (collections && collections.Msg) {
              const res = await collections.Msg.getMessagesById([targetId]);
              msg = res && res.messages ? res.messages[0] : null;
              if (msg) report.details += 'Found via getMessagesById. ';
            }
          } catch (e: any) {
            report.details += `getMessagesById failed: ${e.message}. `;
          }
        }
        
        if (!msg) {
          report.error = 'Message not found in any store/database after all retries';
          return report;
        }
        
        // 5. Try WWebJS.editMessage
        report.step = 'edit_execution';
        if ((window as any).WWebJS && typeof (window as any).WWebJS.editMessage === 'function') {
          try {
            await (window as any).WWebJS.editMessage(msg, text);
            report.success = true;
            report.details += 'Edited via WWebJS.editMessage successfully.';
            return report;
          } catch (e: any) {
            report.details += `WWebJS.editMessage failed: ${e.message}. `;
          }
        }
        
        // 6. Try WAWebSendMessageEditAction
        try {
          const editAction = (window as any).require('WAWebSendMessageEditAction');
          if (editAction && typeof editAction.sendMessageEdit === 'function') {
            await editAction.sendMessageEdit(msg, text);
            report.success = true;
            report.details += 'Edited via WAWebSendMessageEditAction successfully.';
            return report;
          }
        } catch (e: any) {
          report.details += `WAWebSendMessageEditAction failed: ${e.message}. `;
        }
        
        // 7. Try Store.EditMessage
        if (store.EditMessage) {
          try {
            if (typeof store.EditMessage.sendMessageEdit === 'function') {
              await store.EditMessage.sendMessageEdit(msg, text);
              report.success = true;
              report.details += 'Edited via Store.EditMessage.sendMessageEdit.';
              return report;
            } else if (typeof store.EditMessage.editMessage === 'function') {
              await store.EditMessage.editMessage(msg, text);
              report.success = true;
              report.details += 'Edited via Store.EditMessage.editMessage.';
              return report;
            }
          } catch (e: any) {
            report.details += `Store.EditMessage failed: ${e.message}. `;
          }
        }
        
        // 8. Try iterating store keys
        for (const key in store) {
          if (store[key]) {
            try {
              if (typeof store[key].sendMessageEdit === 'function') {
                await store[key].sendMessageEdit(msg, text);
                report.success = true;
                report.details += `Edited via store[${key}].sendMessageEdit.`;
                return report;
              } else if (typeof store[key].editMessage === 'function') {
                await store[key].editMessage(msg, text);
                report.success = true;
                report.details += `Edited via store[${key}].editMessage.`;
                return report;
              }
            } catch (_) {}
          }
        }
        
        report.error = 'No edit message function succeeded';
      } catch (e: any) {
        report.error = `Outer evaluate error: ${e.message}`;
      }
      return report;
    }, msgId, newText);
    
    const timeoutPromise = new Promise<any>((_, reject) => 
      setTimeout(() => reject(new Error('Puppeteer evaluation timeout')), 5000)
    );
    
    const diag: any = await Promise.race([evaluatePromise, timeoutPromise]);
    
    logger.info(`[quiz.ts] safeEditMessage result for ${msgId}: success = ${diag.success}, step = ${diag.step}, details = ${diag.details}, error = ${diag.error}`);
    return diag.success;
  } catch (err: any) {
    logger.error(`[quiz.ts] safeEditMessage outer catch failed for ${msgId}: ${err.message}`);
  }
  return false;
}


