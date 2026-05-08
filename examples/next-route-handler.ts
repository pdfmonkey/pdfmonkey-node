// Verify a webhook in a Next.js App Router route handler.
// Place this at app/api/pdfmonkey-webhook/route.ts.

import { verifyWebhook } from 'pdfmonkey';

export const runtime = 'nodejs'; // also works on 'edge'

export async function POST(request: Request): Promise<Response> {
  const rawBody = await request.text();

  try {
    const event = await verifyWebhook(
      rawBody,
      {
        'svix-id': request.headers.get('svix-id') ?? '',
        'svix-timestamp': request.headers.get('svix-timestamp') ?? '',
        'svix-signature': request.headers.get('svix-signature') ?? '',
      },
      process.env.WEBHOOK_SECRET ?? '',
    );

    if (event.type === 'document.done') {
      // ... persist or notify
    }

    return new Response(null, { status: 204 });
  } catch {
    return new Response('Invalid signature', { status: 400 });
  }
}
