import { quizCommand } from './dist/commands/quiz.js';
import fs from 'fs';
import path from 'path';

console.log('Quiz command imported successfully.');
const questionsPath = path.resolve('storage/db/quiz_questions.json');
console.log('Resolved path:', questionsPath);
console.log('Path exists:', fs.existsSync(questionsPath));
if (fs.existsSync(questionsPath)) {
  const content = fs.readFileSync(questionsPath, 'utf8');
  console.log('File size:', content.length, 'bytes');
  try {
    const parsed = JSON.parse(content);
    console.log('Parsed questions count:', parsed.length);
  } catch (err) {
    console.error('Parse error:', err);
  }
}
