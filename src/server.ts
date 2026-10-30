import { app } from './app';
import { connectToDatabase } from './config/database';
import { env } from './config/env';
import { runDailyJobs } from './services/scheduled-job.service';

const PORT = env.PORT;
const SIX_HOURS = 6 * 60 * 60 * 1000;

const runJobs = (): void => {
  runDailyJobs().catch((error: unknown) => {
    console.error('[jobs] daily run failed:', error);
  });
};

const startServer = async (): Promise<void> => {
  try {
    await connectToDatabase();

    app.listen(PORT, () => {
      console.info(`[server] running on http://localhost:${PORT} in ${env.NODE_ENV} mode`);
      // On a long-running server the daily work runs here; on Vercel, Cron calls /jobs/daily.
      runJobs();
      setInterval(runJobs, SIX_HOURS);
    });
  } catch (error) {
    console.error('[server] failed to start:', error);
    throw new Error(String(error));
  }
};

void startServer();
