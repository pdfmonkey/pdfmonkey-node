import type { PDFMonkey } from './client.js';

export abstract class APIResource {
  protected readonly _client: PDFMonkey;

  constructor(client: PDFMonkey) {
    this._client = client;
  }
}
