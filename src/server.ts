import { app } from './app';
import { connectToDatabase } from './config/database';
import { env } from './config/env';

const PORT = env.PORT;

const startServer = async (): Promise<void> => {
  try {
    await connectToDatabase();

    app.listen(PORT, () => {
      console.info(`[server] running on http://localhost:${PORT} in ${env.NODE_ENV} mode`);
    });
  } catch (error) {
    console.error('[server] failed to start:', error);
    throw new Error(String(error));
  }
};

void startServer();
