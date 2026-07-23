async function findApi() {
  try {
    // Let's first search in chunk 98803 or check app.js since it contains many api definitions
    const res = await fetch('https://myut.ut.ac.id/js/app.35c0f77f.js');
    const text = await res.text();
    console.log("Searching app.js...");
    const keywords = ['getInfoPengiriman', 'getDetailInfoPengiriman', 'trackingBahanAjar', 'cekStatusOrder'];
    keywords.forEach(kw => {
      let idx = text.indexOf(kw);
      if (idx !== -1) {
        console.log(`Found "${kw}" in app.js at index ${idx}: ...${text.substring(idx - 50, idx + 200)}...`);
      }
    });
  } catch (err) {
    console.error("Error:", err.message);
  }
}

findApi();
