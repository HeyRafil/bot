async function testGraphql() {
  try {
    const query = `
      query {
        dataPemesanan(payload: { noPembayaran: "1254894521652032151" }) {
          nomorPembayaran
          nomorDo
          nomorResi
        }
      }
    `;
    
    console.log("Sending query...");
    const res = await fetch('https://api-sia.ut.ac.id/backend-sia/api/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query })
    });
    
    console.log("Status:", res.status);
    const data = await res.json();
    console.log("Response:", JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Error:", err.message);
  }
}

testGraphql();
