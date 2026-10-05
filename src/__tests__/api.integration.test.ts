import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PDFMonkey } from '../client.js';

// Hits the live API with PDFMONKEY_API_KEY. Run with `pnpm test:integration`.
// Every resource created here is prefixed and deleted in afterAll.

const enabled = process.env.PDFMONKEY_INTEGRATION === '1';
const prefix = `sdk-node-it-${Date.now()}`;

describe.runIf(enabled)('live API', () => {
  // Built in beforeAll: the describe body runs at collection even when skipped.
  let client: PDFMonkey;
  const cleanup: Array<() => Promise<void>> = [];
  let workspaceId: string;

  beforeAll(async () => {
    client = new PDFMonkey();
    const workspaces = await client.workspaces.listAll();
    expect(workspaces.length).toBeGreaterThan(0);
    workspaceId = (workspaces[0] as { id: string }).id;
  });

  afterAll(async () => {
    for (const fn of cleanup.reverse()) await fn().catch(() => {});
  });

  it('currentUser.get', async () => {
    const user = await client.currentUser.get();
    expect(user.id).toBeTruthy();
    expect(user.email).toContain('@');
  });

  describe('workspaces', () => {
    it('list', async () => {
      const page = await client.workspaces.list();
      expect(page.data.length).toBeGreaterThan(0);
      expect(page.currentPage).toBe(1);
    });

    it('get', async () => {
      const ws = await client.workspaces.get(workspaceId);
      expect(ws.id).toBe(workspaceId);
    });
  });

  describe('workspaceCards', () => {
    it('list', async () => {
      const page = await client.workspaceCards.list();
      const card = page.data.find((c) => c.id === workspaceId);
      expect(card?.current_plan).toBeTruthy();
    });

    it('listAll', async () => {
      const cards = await client.workspaceCards.listAll();
      expect(cards.map((c) => c.id)).toContain(workspaceId);
    });
  });

  it('pdfEngines.list', async () => {
    const engines = await client.pdfEngines.list();
    expect(engines.length).toBeGreaterThan(0);
    expect(engines[0]?.id).toBeTruthy();
  });

  describe('templateFolders', () => {
    let id: string;

    it('create', async () => {
      const folder = await client.templateFolders.create({
        identifier: `${prefix}-folder`,
        workspace_id: workspaceId,
      });
      id = folder.id;
      cleanup.push(() => client.templateFolders.delete(id));
      expect(folder.identifier).toBe(`${prefix}-folder`);
    });

    it('get', async () => {
      expect((await client.templateFolders.get(id)).id).toBe(id);
    });

    it('update', async () => {
      const folder = await client.templateFolders.update(id, { identifier: `${prefix}-folder2` });
      expect(folder.identifier).toBe(`${prefix}-folder2`);
    });

    it('list', async () => {
      const page = await client.templateFolders.list({ workspace_id: workspaceId });
      expect(page.data.map((f) => f.id)).toContain(id);
    });

    it('listAll', async () => {
      const all = await client.templateFolders.listAll({ workspace_id: workspaceId });
      expect(all.map((f) => f.id)).toContain(id);
    });

    it('delete', async () => {
      await client.templateFolders.delete(id);
      await expect(client.templateFolders.get(id)).rejects.toThrow();
    });
  });

  describe('snippets', () => {
    let id: string;

    it('create', async () => {
      const snippet = await client.snippets.create({
        identifier: `${prefix}-snippet`,
        code: '<p>hi</p>',
        workspace_id: workspaceId,
      });
      id = snippet.id;
      cleanup.push(() => client.snippets.delete(id));
      expect(snippet.code).toBe('<p>hi</p>');
    });

    it('get', async () => {
      expect((await client.snippets.get(id)).id).toBe(id);
    });

    it('update', async () => {
      const snippet = await client.snippets.update(id, { code: '<p>bye</p>' });
      expect(snippet.code).toBe('<p>bye</p>');
    });

    it('list', async () => {
      const page = await client.snippets.list({ workspace_id: workspaceId });
      expect(page.data.map((s) => s.id)).toContain(id);
    });

    it('listAll', async () => {
      const all = await client.snippets.listAll({ workspace_id: workspaceId });
      expect(all.map((s) => s.id)).toContain(id);
    });

    it('delete', async () => {
      await client.snippets.delete(id);
      await expect(client.snippets.get(id)).rejects.toThrow();
    });
  });

  describe('documentTemplates + documents', () => {
    let templateId: string;
    let documentId: string;

    it('documentTemplates.create', async () => {
      const tpl = await client.documentTemplates.create({
        identifier: `${prefix}-template`,
        workspace_id: workspaceId,
        body_draft: '<p>Hello {{name}}</p>',
        sample_data_draft: '{"name":"sample"}',
      });
      templateId = tpl.id;
      cleanup.push(() => client.documentTemplates.delete(templateId));
      expect(tpl.identifier).toBe(`${prefix}-template`);
    });

    it('documentTemplates.get', async () => {
      expect((await client.documentTemplates.get(templateId)).id).toBe(templateId);
    });

    it('documentTemplates.update', async () => {
      const tpl = await client.documentTemplates.update(templateId, {
        body_draft: '<p>Hi {{name}}</p>',
      });
      expect(tpl.body_draft).toBe('<p>Hi {{name}}</p>');
    });

    it('documentTemplates.list', async () => {
      const page = await client.documentTemplates.list({ workspace_id: workspaceId });
      expect(page.data.length).toBeGreaterThan(0);
    });

    it('documentTemplates.listAll', async () => {
      const all = await client.documentTemplates.listAll({ workspace_id: workspaceId });
      expect(all.map((t) => t.id)).toContain(templateId);
    });

    it('documents.create', async () => {
      const doc = await client.documents.create({
        document_template_id: templateId,
        payload: { name: 'Alice' },
        meta: { _filename: `${prefix}.pdf` },
      });
      documentId = doc.id;
      cleanup.push(() => client.documents.delete(documentId));
      expect(doc.status).toBe('draft');
    });

    it('documents.get', async () => {
      const doc = await client.documents.get(documentId);
      expect(doc.id).toBe(documentId);
      expect(JSON.parse(doc.payload ?? '{}')).toEqual({ name: 'Alice' });
    });

    it('documents.update + waitForGeneration + download', async () => {
      await client.documents.update(documentId, { payload: { name: 'Bob' }, status: 'pending' });
      const doc = await client.documents.waitForGeneration(documentId, { timeout: 60_000 });
      expect(doc.download_url).toBeTruthy();
      const bytes = await client.documents.download(documentId);
      expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe('%PDF');
    }, 70_000);

    it('documentCards.get', async () => {
      expect((await client.documentCards.get(documentId)).id).toBe(documentId);
    });

    it('documentCards.list', async () => {
      const page = await client.documentCards.list({ document_template_id: templateId });
      expect(page.data.map((c) => c.id)).toContain(documentId);
    });

    it('documents.generateSync', async () => {
      const card = await client.documents.generateSync({
        document_template_id: templateId,
        payload: { name: 'Sync' },
      });
      cleanup.push(() => client.documents.delete(card.id));
      expect(card.status).toBe('success');
      expect(card.download_url).toBeTruthy();
    }, 130_000);

    it('documents.delete', async () => {
      await client.documents.delete(documentId);
      await expect(client.documents.get(documentId)).rejects.toThrow();
    });

    it('documentTemplates.delete', async () => {
      await client.documentTemplates.delete(templateId);
      await expect(client.documentTemplates.get(templateId)).rejects.toThrow();
    });
  });

  describe('restHooks', () => {
    it('create + delete', async () => {
      const hook = await client.restHooks.create({
        url: `https://example.com/${prefix}`,
        workspace_id: workspaceId,
        events: ['documents.generation.success', 'documents.generation.failure'],
      });
      cleanup.push(() => client.restHooks.delete(hook.id));
      expect(hook.url).toBe(`https://example.com/${prefix}`);
      expect(hook.event).toBe('documents.generation.success,documents.generation.failure');
      await client.restHooks.delete(hook.id);
    });
  });
});
