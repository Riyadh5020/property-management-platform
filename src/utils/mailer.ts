import nodemailer from 'nodemailer';

import { env } from '../config/env';

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: false,
});

export const sendVerificationEmail = async (to: string, code: string): Promise<void> => {
  await transporter.sendMail({
    from: env.SMTP_FROM,
    to,
    subject: 'Verify your email',
    html: `
      <p>Your verification code is:</p>
      <h2 style="letter-spacing: 4px;">${code}</h2>
      <p>This code expires in 24 hours.</p>
    `,
  });
};

export const sendPasswordResetEmail = async (to: string, code: string): Promise<void> => {
  await transporter.sendMail({
    from: env.SMTP_FROM,
    to,
    subject: 'Reset your password',
    html: `
      <p>Your password reset code is:</p>
      <h2 style="letter-spacing: 4px;">${code}</h2>
      <p>This code expires in 1 hour.</p>
    `,
  });
};
