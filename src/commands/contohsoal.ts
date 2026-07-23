import { Command } from './index.js';
import axios from 'axios';
import { getSetting } from '../config/settings.js';
import logger from '../utils/logger.js';

interface Question {
  number: number;
  question: string;
  options?: string[];
  answer: string;
  explanation: string;
}

interface SubjectData {
  code: string;
  name: string;
  questions: Question[];
}

const subjects: Record<string, SubjectData> = {
  msim4101: {
    code: 'MSIM4101',
    name: 'Pengantar Teknologi Informasi',
    questions: [
      {
        number: 1,
        question: 'Di bawah ini yang merupakan perangkat keras keluaran (output device) adalah...',
        options: ['A. Keyboard', 'B. Scanner', 'C. Monitor', 'D. Mouse'],
        answer: 'C',
        explanation: 'Monitor berfungsi untuk menampilkan data grafis atau tampilan antarmuka kepada pengguna, sehingga termasuk output device. Keyboard, scanner, dan mouse adalah input device.'
      },
      {
        number: 2,
        question: 'Memori komputer yang bersifat volatile (datanya hilang saat komputer dimatikan) adalah...',
        options: ['A. ROM', 'B. RAM', 'C. Harddisk', 'D. Flashdisk'],
        answer: 'B',
        explanation: 'RAM (Random Access Memory) bersifat volatile karena hanya menyimpan data sementara saat komputer menyala. ROM, Harddisk, dan Flashdisk bersifat non-volatile.'
      }
    ]
  },
  mkwu4108: {
    code: 'MKWU4108',
    name: 'Bahasa Indonesia',
    questions: [
      {
        number: 1,
        question: 'Manakah kalimat di bawah ini yang menggunakan ejaan Bahasa Indonesia (EBI) dengan benar?',
        options: [
          'A. Ibu membeli apel, jeruk dan mangga di pasar.',
          'B. Ibu membeli apel, jeruk, dan mangga di pasar.',
          'C. Ibu membeli apel jeruk dan mangga di pasar.',
          'D. Ibu, membeli apel, jeruk dan mangga di pasar.'
        ],
        answer: 'B',
        explanation: 'Penggunaan tanda koma sebelum kata hubung "dan" wajib digunakan untuk kalimat perincian yang memiliki lebih dari dua item.'
      },
      {
        number: 2,
        question: 'Teknik membaca cepat untuk menemukan informasi spesifik secara langsung tanpa membaca bagian lain disebut...',
        options: ['A. Skimming', 'B. Scanning', 'C. Reading aloud', 'D. Intensive reading'],
        answer: 'B',
        explanation: 'Scanning (membaca memindai) adalah teknik membaca cepat untuk mencari fakta atau informasi khusus. Skimming (membaca sekilas) untuk mencari gagasan pokok.'
      }
    ]
  },
  isip4110: {
    code: 'ISIP4110',
    name: 'Pengantar Sosiologi',
    questions: [
      {
        number: 1,
        question: 'Proses belajar yang dilakukan oleh individu untuk mempelajari nilai, norma, dan peran sosial dalam masyarakat disebut...',
        options: ['A. Sosialisasi', 'B. Interaksi sosial', 'C. Asimilasi', 'D. Akulturasi'],
        answer: 'A',
        explanation: 'Sosialisasi adalah proses penanaman atau transfer kebiasaan, nilai, dan aturan dari satu generasi ke generasi berikutnya dalam suatu kelompok.'
      },
      {
        number: 2,
        question: 'Bentuk interaksi sosial asosiatif yang berupa usaha bersama antara orang perorangan atau kelompok untuk mencapai tujuan bersama disebut...',
        options: ['A. Akomodasi', 'B. Kerja sama', 'C. Asimilasi', 'D. Akulturasi'],
        answer: 'B',
        explanation: 'Kerja sama (cooperation) adalah usaha bersama untuk mencapai kepentingan atau tujuan bersama. Akomodasi adalah penyelesaian konflik.'
      }
    ]
  },
  mkdk4001: {
    code: 'MKDK4001',
    name: 'Pengantar Pendidikan',
    questions: [
      {
        number: 1,
        question: 'Pendidikan yang diselenggarakan di sekolah secara teratur, sistematis, mempunyai jenjang, dan kurikulum yang jelas disebut pendidikan...',
        options: ['A. Informal', 'B. Nonformal', 'C. Formal', 'D. Semi-formal'],
        answer: 'C',
        explanation: 'Pendidikan formal adalah jalur pendidikan yang terstruktur dan berjenjang yang terdiri atas pendidikan dasar, pendidikan menengah, dan pendidikan tinggi.'
      },
      {
        number: 2,
        question: 'Siapakah tokoh pendidikan nasional Indonesia yang terkenal dengan semboyan "Ing ngarsa sung tuladha, ing madya mangun karsa, tut wuri handayani"?',
        options: ['A. Raden Ajeng Kartini', 'B. Ki Hajar Dewantara', 'C. Mohammad Hatta', 'D. K.H. Ahmad Dahlan'],
        answer: 'B',
        explanation: 'Semboyan Ki Hajar Dewantara tersebut bermakna: di depan memberi teladan, di tengah membangun semangat/ide, di belakang memberi dorongan.'
      }
    ]
  }
};

/**
 * Generates practice questions using a keyless fallback AI (Pollinations.ai)
 */
async function generateQuestionsWithFallbackAI(subjectCode: string): Promise<SubjectData | null> {
  try {
    const systemPrompt = `Anda adalah AI Academic Assistant Universitas Terbuka. Tugas Anda adalah membantu mahasiswa dengan membuat soal latihan ujian.
Hasilkan tepat 2 soal latihan pilihan ganda dalam bahasa Indonesia untuk kode mata kuliah yang diberikan.
Format output harus berupa JSON valid (tanpa penjelasan lain diluar JSON) sesuai dengan skema berikut:
{
  "code": "Kode Mata Kuliah (misal: MKWU4108)",
  "name": "Nama Lengkap Mata Kuliah",
  "questions": [
    {
      "number": 1,
      "question": "Pertanyaan soal...",
      "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
      "answer": "Kunci jawaban berupa huruf saja (A/B/C/D)",
      "explanation": "Pembahasan singkat mengapa kunci jawaban tersebut benar."
    }
  ]
}`;

    logger.info(`Requesting Pollinations keyless AI to generate questions for: ${subjectCode}`);

    const response = await axios.post('https://text.pollinations.ai/', {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Buatkan soal latihan untuk kode mata kuliah: ${subjectCode}` }
      ],
      jsonMode: true
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });

    let contentText = response.data.trim();
    if (contentText.startsWith('```json')) {
      contentText = contentText.substring(7, contentText.length - 3).trim();
    } else if (contentText.startsWith('```')) {
      contentText = contentText.substring(3, contentText.length - 3).trim();
    }

    const parsedData = JSON.parse(contentText);
    if (parsedData && parsedData.code && parsedData.name && Array.isArray(parsedData.questions)) {
      return parsedData as SubjectData;
    }

    return null;
  } catch (err: any) {
    logger.error(`Failed to generate fallback AI questions for ${subjectCode}:`, err.message);
    return null;
  }
}

/**
 * Generates practice questions dynamically using the Gemini / OpenAI API
 */
async function generateQuestionsWithAI(subjectCode: string): Promise<SubjectData | null> {
  let apiKey: string = await getSetting('OPENAI_API_KEY');
  if (apiKey) {
    apiKey = apiKey.trim().replace(/[\r\n\s\t\u200b\u200c\u200d\ufeff]/g, '');
  }

  if (apiKey) {
    try {
      let apiUrl = 'https://api.openai.com/v1/chat/completions';
      let apiModel = 'gpt-4o-mini';

      if (apiKey.startsWith('AIzaSy') || apiKey.startsWith('AQ.')) {
        apiUrl = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
        apiModel = 'gemini-1.5-flash';
      }

      const systemPrompt = `Anda adalah AI Academic Assistant Universitas Terbuka. Tugas Anda adalah membantu mahasiswa dengan membuat soal latihan ujian.
Hasilkan tepat 2 soal latihan pilihan ganda dalam bahasa Indonesia untuk kode mata kuliah yang diberikan.
Format output harus berupa JSON valid sesuai dengan skema berikut:
{
  "code": "Kode Mata Kuliah (misal: MKWU4108)",
  "name": "Nama Lengkap Mata Kuliah",
  "questions": [
    {
      "number": 1,
      "question": "Pertanyaan soal...",
      "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
      "answer": "Kunci jawaban berupa huruf saja (A/B/C/D)",
      "explanation": "Pembahasan singkat mengapa kunci jawaban tersebut benar."
    }
  ]
}`;

      logger.info(`Requesting AI to generate practice questions for: ${subjectCode}`);

      const response = await axios.post(apiUrl, {
        model: apiModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Buatkan soal latihan untuk kode mata kuliah: ${subjectCode}` }
        ],
        response_format: { type: 'json_object' }
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        timeout: 15000
      });

      let contentText = response.data.choices[0].message.content.trim();
      
      if (contentText.startsWith('```json')) {
        contentText = contentText.substring(7, contentText.length - 3).trim();
      } else if (contentText.startsWith('```')) {
        contentText = contentText.substring(3, contentText.length - 3).trim();
      }

      const parsedData = JSON.parse(contentText);
      if (parsedData && parsedData.code && parsedData.name && Array.isArray(parsedData.questions)) {
        return parsedData as SubjectData;
      }
      return null;
    } catch (err: any) {
      logger.error(`Failed to generate primary AI questions for ${subjectCode}, trying fallback:`, err.message);
      return await generateQuestionsWithFallbackAI(subjectCode);
    }
  } else {
    logger.info(`API Key not configured. Using keyless fallback AI for: ${subjectCode}`);
    return await generateQuestionsWithFallbackAI(subjectCode);
  }
}

export const contohSoalCommand: Command = {
  name: 'contohsoal',
  aliases: ['soalut', 'latihansoal'],
  roleRequired: 'Member',
  description: 'Menampilkan contoh soal ujian Universitas Terbuka untuk mata kuliah tertentu.',
  async execute(client, msg, chat, args, privileges) {
    if (args.length === 0) {
      let menuText = `*📝 CONTOH SOAL UNIVERSITAS TERBUKA 📝*\n\n`;
      menuText += `Silakan pilih mata kuliah dengan mengetik:\n`;
      menuText += `*.contohsoal [kode_mapel]*\n\n`;
      menuText += `*Daftar Kode Mapel Tersedia*:\n`;
      
      for (const key of Object.keys(subjects)) {
        const sub = subjects[key];
        menuText += `• *${sub.code}* - ${sub.name}\n`;
      }
      
      menuText += `\n_Contoh: .contohsoal MSIM4101_`;
      await chat.sendMessage(menuText);
      return;
    }

    const subKey = args[0].toLowerCase();
    let subject = subjects[subKey];

    // If subject is not in local database, attempt to generate using Gemini AI / Fallback AI
    if (!subject) {
      await chat.sendMessage(`🔍 Kode mata kuliah *${args[0].toUpperCase()}* tidak ditemukan di database lokal. Sedang membuat soal latihan menggunakan AI di background... ⏳`);
      
      const generatedSubject = await generateQuestionsWithAI(args[0].toUpperCase());
      if (generatedSubject) {
        subject = generatedSubject;
      }
    }

    // Fallback if AI generation failed or wasn't configured
    if (!subject) {
      let errorText = `❌ Gagal memuat soal untuk kode *${args[0].toUpperCase()}*.\n\n`;
      errorText += `*Mata kuliah yang tersedia di database lokal saat ini*:\n`;
      for (const key of Object.keys(subjects)) {
        const sub = subjects[key];
        errorText += `• *${sub.code}* - ${sub.name}\n`;
      }
      await chat.sendMessage(errorText);
      return;
    }

    let responseText = `*📚 CONTOH SOAL ${subject.code} - ${subject.name.toUpperCase()} (AI Generated) 📚*\n\n`;
    if (subjects[subKey]) {
      // Local database marker
      responseText = `*📚 CONTOH SOAL ${subject.code} - ${subject.name.toUpperCase()} 📚*\n\n`;
    }

    subject.questions.forEach((q) => {
      responseText += `*Soal ${q.number}*:\n${q.question}\n`;
      if (q.options) {
        q.options.forEach((opt) => {
          responseText += `${opt}\n`;
        });
      }
      responseText += `\n*Kunci Jawaban*: *${q.answer}*\n`;
      responseText += `*Pembahasan*: ${q.explanation}\n`;
      responseText += `-------------------------------------------\n\n`;
    });

    responseText += `💡 _Ketik .contohsoal untuk melihat mapel lainnya._`;
    await chat.sendMessage(responseText);
  }
};

export default contohSoalCommand;
