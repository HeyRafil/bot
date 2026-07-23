const fs = require('fs');
const path = require('path');

const logPath = path.join(__dirname, 'logs', 'app.log');
const content = fs.readFileSync(logPath, 'utf8');
const lines = content.split('\n');
const matches = lines.filter(line => line.includes('Failed to get chat'));

console.log(`Found ${matches.length} matches:`);
matches.slice(-20).forEach(line => console.log(line));
