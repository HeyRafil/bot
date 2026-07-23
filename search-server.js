import fs from 'fs';

const code = fs.readFileSync('src/server.ts', 'utf8');
const lines = code.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('/logs') || line.includes('logs')) {
    console.log(`${idx + 1}: ${line.trim()}`);
  }
});
