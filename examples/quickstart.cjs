// CommonJS variant of quickstart.mjs.
// Run: PDFMONKEY_API_KEY=... node examples/quickstart.cjs

const { PDFMonkey } = require('../dist/index.cjs');

const client = new PDFMonkey({ apiKey: process.env.PDFMONKEY_API_KEY });

(async () => {
  const doc = await client.documents.create({
    document_template_id: process.env.PDFMONKEY_TEMPLATE_ID,
    payload: JSON.stringify({ name: 'Alice', amount: 42 }),
    status: 'pending',
  });

  const completed = await client.documents.waitForGeneration(doc.id);
  console.log('Download URL:', completed.download_url);
})();
