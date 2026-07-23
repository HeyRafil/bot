import fs from 'fs';

function checkWebp() {
  try {
    const buffer = fs.readFileSync('a3e14a32-0541-4e07-aa19-f353be81f5e9.webp');
    const header = buffer.toString('ascii', 0, 4);
    const format = buffer.toString('ascii', 8, 12);
    
    if (header !== 'RIFF' || format !== 'WEBP') {
      console.log("File is not a valid WebP file.");
      return;
    }

    const content = buffer.toString('ascii');
    const isAnimated = content.includes('ANIM') || content.includes('ANMF');
    console.log("=== WEBP CHECK ===");
    console.log("File size:", buffer.length, "bytes");
    console.log("Is Animated WebP:", isAnimated);
  } catch (err) {
    console.error("Error:", err.message);
  }
}

checkWebp();
