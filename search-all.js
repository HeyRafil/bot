async function searchAll() {
  try {
    const appRes = await fetch('https://myut.ut.ac.id/js/app.35c0f77f.js');
    const appText = await appRes.text();
    
    // Find the chunk mapping block
    // Webpack chunk mapping looks like: {4818:"12dbbb47",...}
    // We can extract all patterns like \d+:"[a-f0-9]+"
    const regex = /(\d+):"([a-f0-9]+)"/g;
    let match;
    const chunks = [];
    while ((match = regex.exec(appText)) !== null) {
      chunks.push({ id: match[1], hash: match[2] });
    }
    
    console.log(`Found ${chunks.length} chunks mapped in app.js.`);
    
    // Search for the keyword
    const keyword = 'getInfoPengiriman';
    
    // Download and search in chunks concurrently (with concurrency limit)
    const limit = 20;
    for (let i = 0; i < chunks.length; i += limit) {
      const batch = chunks.slice(i, i + limit);
      await Promise.all(batch.map(async chunk => {
        try {
          const url = `https://myut.ut.ac.id/js/${chunk.id}.${chunk.hash}.js`;
          const res = await fetch(url);
          if (res.ok) {
            const text = await res.text();
            if (text.includes(keyword)) {
              console.log(`FOUND "${keyword}" in chunk ${chunk.id} (${chunk.hash}.js)!`);
              // Print snippet
              const idx = text.indexOf(keyword);
              console.log(text.substring(Math.max(0, idx - 100), Math.min(text.length, idx + 400)));
            }
          }
        } catch (_) {}
      }));
    }
  } catch (err) {
    console.error("Error:", err.message);
  }
}

searchAll();
