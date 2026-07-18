import app from '../src/app';
import { connectToDatabase } from '../src/config/database';

// Initialize DB on cold start (serverless) — errors are logged but won't crash the function
void (async () => {
  try {
    await connectToDatabase();
  } catch (error) {
    console.error('[api] failed to initialize database on cold start:', error);
  }
})();

export default app;
