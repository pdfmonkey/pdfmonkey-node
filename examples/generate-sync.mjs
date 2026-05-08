// Generate a PDF in a single blocking call.
// Run: PDFMONKEY_API_KEY=... node examples/generate-sync.mjs

import { PDFMonkey } from '../dist/index.js';

const client = new PDFMonkey({ apiKey: process.env.PDFMONKEY_API_KEY });

const card = await client.documents.generateSync({
  document_template_id: process.env.PDFMONKEY_TEMPLATE_ID,
  payload: JSON.stringify({ invoice_number: 1234 }),
});

console.log('Status:', card.status);
console.log('Download URL:', card.download_url);
