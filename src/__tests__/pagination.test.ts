import { describe, expect, it, vi } from 'vitest';
import { PDFMonkey } from '../client.js';
import { PDFMonkeyError } from '../error.js';

// ── Helpers ────────────────────────────────────────────────────────────────

function mockPages(
  ...pages: Array<{
    data: Array<{ id: string }>;
    meta: {
      current_page: number;
      total_pages: number;
      next_page: number | null;
      prev_page: number | null;
    };
  }>
): ReturnType<typeof vi.fn> {
  const fetch = vi.fn();
  for (const page of pages) {
    fetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ document_cards: page.data, meta: page.meta }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
  }
  return fetch;
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('Pagination', () => {
  it('navigates to previous page', async () => {
    const fetch = mockPages(
      {
        data: [{ id: 'card_2' }],
        meta: { current_page: 2, total_pages: 2, next_page: null, prev_page: 1 },
      },
      {
        data: [{ id: 'card_1' }],
        meta: { current_page: 1, total_pages: 2, next_page: 2, prev_page: null },
      },
    );
    const client = new PDFMonkey({ apiKey: 'sk_test', fetch });
    const page2 = await client.documentCards.list({ page: 2 });

    expect(page2.hasPreviousPage()).toBe(true);
    const page1 = await page2.getPreviousPage();
    expect(page1.data[0]?.id).toBe('card_1');
    expect(page1.currentPage).toBe(1);
    expect(page1.hasPreviousPage()).toBe(false);
  });

  it('getNextPage throws PDFMonkeyError when no next page', async () => {
    const fetch = mockPages({
      data: [{ id: 'card_1' }],
      meta: { current_page: 1, total_pages: 1, next_page: null, prev_page: null },
    });
    const client = new PDFMonkey({ apiKey: 'sk_test', fetch });
    const page = await client.documentCards.list();

    await expect(page.getNextPage()).rejects.toThrow(PDFMonkeyError);
    await expect(page.getNextPage()).rejects.toThrow('No next page available');
  });

  it('getPreviousPage throws PDFMonkeyError when no previous page', async () => {
    const fetch = mockPages({
      data: [{ id: 'card_1' }],
      meta: { current_page: 1, total_pages: 1, next_page: null, prev_page: null },
    });
    const client = new PDFMonkey({ apiKey: 'sk_test', fetch });
    const page = await client.documentCards.list();

    await expect(page.getPreviousPage()).rejects.toThrow(PDFMonkeyError);
    await expect(page.getPreviousPage()).rejects.toThrow('No previous page available');
  });

  it('getNextPage preserves original query params', async () => {
    const fetch = mockPages(
      {
        data: [{ id: 'card_1' }],
        meta: { current_page: 1, total_pages: 2, next_page: 2, prev_page: null },
      },
      {
        data: [{ id: 'card_2' }],
        meta: { current_page: 2, total_pages: 2, next_page: null, prev_page: 1 },
      },
    );
    const client = new PDFMonkey({ apiKey: 'sk_test', fetch });
    const page1 = await client.documentCards.list({ document_template_id: 'tpl_1' });
    await page1.getNextPage();

    const [url2] = fetch.mock.calls[1] as [string];
    const parsed = new URL(url2);
    expect(parsed.searchParams.get('q[document_template_id]')).toBe('tpl_1');
    expect(parsed.searchParams.get('page[number]')).toBe('2');
  });

  it('handles empty data array', async () => {
    const fetch = mockPages({
      data: [],
      meta: { current_page: 1, total_pages: 1, next_page: null, prev_page: null },
    });
    const client = new PDFMonkey({ apiKey: 'sk_test', fetch });
    const page = await client.documentCards.list();

    expect(page.data).toEqual([]);
    expect(page.totalPages).toBe(1);
    expect(page.hasNextPage()).toBe(false);
    expect(page.hasPreviousPage()).toBe(false);
  });

  it('throws on malformed response (missing data array)', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          meta: { current_page: 1, total_pages: 1, next_page: null, prev_page: null },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    const client = new PDFMonkey({ apiKey: 'sk_test', fetch });

    await expect(client.documentCards.list()).rejects.toThrow(
      'expected "document_cards" to be an array',
    );
  });

  it('throws on malformed response (missing meta)', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          document_cards: [{ id: 'card_1' }],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    const client = new PDFMonkey({ apiKey: 'sk_test', fetch });

    await expect(client.documentCards.list()).rejects.toThrow('missing or malformed "meta"');
  });
});

describe('Page[Symbol.iterator]', () => {
  it('iterates over items in a single page', async () => {
    const fetch = mockPages({
      data: [{ id: 'card_1' }, { id: 'card_2' }, { id: 'card_3' }],
      meta: { current_page: 1, total_pages: 1, next_page: null, prev_page: null },
    });
    const client = new PDFMonkey({ apiKey: 'sk_test', fetch });
    const page = await client.documentCards.list();

    const ids: string[] = [];
    for (const item of page) {
      ids.push(item.id);
    }
    expect(ids).toEqual(['card_1', 'card_2', 'card_3']);
  });

  it('works with Array.from', async () => {
    const fetch = mockPages({
      data: [{ id: 'card_1' }],
      meta: { current_page: 1, total_pages: 1, next_page: null, prev_page: null },
    });
    const client = new PDFMonkey({ apiKey: 'sk_test', fetch });
    const page = await client.documentCards.list();

    expect(Array.from(page)).toEqual([{ id: 'card_1' }]);
  });
});

describe('Page.getPage', () => {
  it('jumps to a specific page number', async () => {
    const fetch = mockPages(
      {
        data: [{ id: 'card_1' }],
        meta: { current_page: 1, total_pages: 5, next_page: 2, prev_page: null },
      },
      {
        data: [{ id: 'card_3' }],
        meta: { current_page: 3, total_pages: 5, next_page: 4, prev_page: 2 },
      },
    );
    const client = new PDFMonkey({ apiKey: 'sk_test', fetch });
    const page1 = await client.documentCards.list();

    const page3 = await page1.getPage(3);
    expect(page3.currentPage).toBe(3);

    const [url] = fetch.mock.calls[1] as [string];
    expect(new URL(url).searchParams.get('page[number]')).toBe('3');
  });

  it('rejects out-of-range page numbers', async () => {
    const fetch = mockPages({
      data: [{ id: 'card_1' }],
      meta: { current_page: 1, total_pages: 2, next_page: 2, prev_page: null },
    });
    const client = new PDFMonkey({ apiKey: 'sk_test', fetch });
    const page = await client.documentCards.list();

    await expect(page.getPage(0)).rejects.toThrow('Invalid page number');
    await expect(page.getPage(99)).rejects.toThrow('out of range');
    await expect(page.getPage(1.5)).rejects.toThrow('Invalid page number');
  });
});

describe('Page.pages', () => {
  it('iterates page-by-page across the result set', async () => {
    const fetch = mockPages(
      {
        data: [{ id: 'card_1' }],
        meta: { current_page: 1, total_pages: 3, next_page: 2, prev_page: null },
      },
      {
        data: [{ id: 'card_2' }],
        meta: { current_page: 2, total_pages: 3, next_page: 3, prev_page: 1 },
      },
      {
        data: [{ id: 'card_3' }],
        meta: { current_page: 3, total_pages: 3, next_page: null, prev_page: 2 },
      },
    );
    const client = new PDFMonkey({ apiKey: 'sk_test', fetch });
    const firstPage = await client.documentCards.list();

    const seen: number[] = [];
    for await (const page of firstPage.pages()) {
      seen.push(page.currentPage);
    }
    expect(seen).toEqual([1, 2, 3]);
  });
});

describe('Page[Symbol.asyncIterator]', () => {
  it('iterates across all pages automatically', async () => {
    const fetch = mockPages(
      {
        data: [{ id: 'card_1' }, { id: 'card_2' }],
        meta: { current_page: 1, total_pages: 3, next_page: 2, prev_page: null },
      },
      {
        data: [{ id: 'card_3' }],
        meta: { current_page: 2, total_pages: 3, next_page: 3, prev_page: 1 },
      },
      {
        data: [{ id: 'card_4' }],
        meta: { current_page: 3, total_pages: 3, next_page: null, prev_page: 2 },
      },
    );
    const client = new PDFMonkey({ apiKey: 'sk_test', fetch });
    const page = await client.documentCards.list();

    const ids: string[] = [];
    for await (const item of page) {
      ids.push(item.id);
    }
    expect(ids).toEqual(['card_1', 'card_2', 'card_3', 'card_4']);
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('handles single page', async () => {
    const fetch = mockPages({
      data: [{ id: 'card_1' }],
      meta: { current_page: 1, total_pages: 1, next_page: null, prev_page: null },
    });
    const client = new PDFMonkey({ apiKey: 'sk_test', fetch });
    const page = await client.documentCards.list();

    const ids: string[] = [];
    for await (const item of page) {
      ids.push(item.id);
    }
    expect(ids).toEqual(['card_1']);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('handles empty page', async () => {
    const fetch = mockPages({
      data: [],
      meta: { current_page: 1, total_pages: 1, next_page: null, prev_page: null },
    });
    const client = new PDFMonkey({ apiKey: 'sk_test', fetch });
    const page = await client.documentCards.list();

    const ids: string[] = [];
    for await (const item of page) {
      ids.push(item.id);
    }
    expect(ids).toEqual([]);
  });
});
