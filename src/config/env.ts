// import 'dotenv/config';

// import { z } from 'zod';

// const envSchema = z.object({
//   NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
//   PORT: z.coerce.number().default(8000),
//   DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
//   JWT_SECRET: z.string().optional(),
//   REFRESH_TOKEN_SECRET: z.string().optional(),
//   JWT_EXPIRES_IN: z.string().default('7d'),
//   REFRESH_TOKEN_EXPIRES_IN: z.string().default('30d'),
//   CORS_ORIGIN: z.string().default('http://localhost:3000'),
// });

// const parsed = envSchema.safeParse(process.env);

// if (!parsed.success) {
//   console.error('[env] Invalid environment variables:', parsed.error.flatten().fieldErrors);
//   // eslint-disable-next-line unicorn/no-process-exit
//   process.exit(1);
// }

// export const env = parsed.data;

import 'dotenv/config';

import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(8000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().optional(),
  REFRESH_TOKEN_SECRET: z.string().optional(),
  JWT_EXPIRES_IN: z.string().default('7d'),
  REFRESH_TOKEN_EXPIRES_IN: z.string().default('30d'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  SMTP_HOST: z.string().default('localhost'),
  SMTP_PORT: z.coerce.number().default(1025),
  SMTP_FROM: z.string().default('noreply@yourapp.local'),
  // Only needed by servers that require a login, such as Brevo.
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  // Email of an owner account anyone can enter from the login page for testing. Unset turns it off.
  DEMO_OWNER_EMAIL: z.string().optional(),
  CLIENT_URL: z.string().default('http://localhost:3000'),
  CRON_SECRET: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('[env] Invalid environment variables:', parsed.error.flatten().fieldErrors);
  // eslint-disable-next-line unicorn/no-process-exit
  process.exit(1);
}

export const env = parsed.data;
