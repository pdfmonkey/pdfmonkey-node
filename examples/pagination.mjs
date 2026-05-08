// Iterate over every document card across all pages.
// Run: PDFMONKEY_API_KEY=... node examples/pagination.mjs

import { PDFMonkey } from '../dist/index.js';

const client = new PDFMonkey({ apiKey: process.env.PDFMONKEY_API_KEY });

const firstPage = await client.documentCards.list({ status: 'success' });

let count = 0;
for await (const card of firstPage) {
  count++;
  console.log(count, card.id, card.filename ?? '(no filename)');
}

console.log(`Iterated ${count} cards across ${firstPage.totalPages} page(s).`);
