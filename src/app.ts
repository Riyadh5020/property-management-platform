import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';

import { env } from './config/env';
import { errorHandler } from './middlewares/error-handler';
import { notFoundHandler } from './middlewares/not-found-handler';
import { adminRouter } from './routes/admin.route';
import { swaggerRouter } from './routes/swagger.route';
import { userRouter } from './routes/user.route';
import { API_PREFIX } from './shared/constants';

const app = express();

// ── Security & parsing ──
app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Logging ──
if (env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// ── Routes ──
app.use(`${API_PREFIX}/admins`, adminRouter);
app.use(`${API_PREFIX}/users`, userRouter);
// Swagger UI
app.use(`${API_PREFIX}/swagger`, swaggerRouter);

// ── Error handling ──
// Root and simple health endpoints (also keep existing /api/v1/health route)
app.get('/', (_req, res) => {
  res.status(200).json({ success: true, message: 'Perfume ecommerce API is running' });
});

app.get('/health', (_req, res) => {
  res.status(200).json({ success: true, status: 'healthy' });
});

app.use(notFoundHandler);
app.use(errorHandler);

// Named export kept for local `src/server.ts` to import
export { app };

// Default export for Vercel serverless entrypoint (and other consumers)
export default app;
