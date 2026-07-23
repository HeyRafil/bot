async function readChunk() {
  try {
    const res = await fetch('https://myut.ut.ac.id/js/3706.b11e9940.js');
    const text = await res.text();
    
    // Find all matches of query { ... }
    const regex = /query\s*\{[^}]+\}/g;
    // Actually, since queries can have nested brackets, let's just find the index of "query" and print 500 characters after it.
    let idx = 0;
    while ((idx = text.indexOf('query', idx)) !== -1) {
      console.log("=== FOUND QUERY ===");
      console.log(text.substring(idx, idx + 400));
      console.log("===================\n");
      idx += 5;
    }
  } catch (err) {
    console.error("Error:", err.message);
  }
}

readChunk();
