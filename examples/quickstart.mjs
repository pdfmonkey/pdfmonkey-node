// Create a document and wait for generation to finish.
// Run: PDFMONKEY_API_KEY=... node examples/quickstart.mjs

import { PDFMonkey } from '../dist/index.js';

const client = new PDFMonkey({ apiKey: process.env.PDFMONKEY_API_KEY });

const doc = await client.documents.create({
  document_template_id: process.env.PDFMONKEY_TEMPLATE_ID,
  payload: JSON.stringify({ name: 'Alice', amount: 42 }),
  status: 'pending',
});

const completed = await client.documents.waitForGeneration(doc.id);
console.log('Download URL:', completed.download_url);
