// Verify an incoming webhook in an Express app.
// Requires `express` to be installed. Capture the raw body via
// express.raw() so the signature check sees the unmodified payload.
//
// Run: WEBHOOK_SECRET=whsec_... node examples/webhook-express.mjs

import express from 'express';
import { verifyWebhook } from '../dist/index.js';

const app = express();

app.post(
  '/pdfmonkey-webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    try {
      const event = await verifyWebhook(
        req.body.toString('utf8'),
        {
          'svix-id': req.header('svix-id') ?? '',
          'svix-timestamp': req.header('svix-timestamp') ?? '',
          'svix-signature': req.header('svix-signature') ?? '',
        },
        process.env.WEBHOOK_SECRET ?? '',
      );

      console.log('Received event:', event.type, event.data);
      res.status(204).end();
    } catch (error) {
      console.error('Webhook verification failed:', error.message);
      res.status(400).send('Invalid signature');
    }
  },
);

app.listen(3000, () => console.log('Listening on :3000'));
