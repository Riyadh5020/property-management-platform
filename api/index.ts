import { type IncomingMessage, type ServerResponse } from 'node:http';

import app from '../dist/app.js';
import { connectToDatabase } from '../dist/config/database.js';

let ready: Promise<void> | null = null;

// Serverless functions can freeze as soon as a response is sent, so the schema setup has to finish
// before the first request is handled. A failed attempt is tried again by the next request.
const ensureDatabase = (): Promise<void> => {
  ready ??= connectToDatabase().catch((error: unknown) => {
    ready = null;
    throw error;
  });
  return ready;
};

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    await ensureDatabase();
  } catch (error) {
    // Most of the API still works on the existing schema, so carry on and log it.
    console.error('[api] failed to initialize database:', error);
  }
  app(req as never, res as never);
}
