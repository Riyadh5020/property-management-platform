import nodemailer from 'nodemailer';

import { env } from '../config/env';

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: false,
});

export const sendVerificationEmail = async (to: string, token: string): Promise<void> => {
  const verifyUrl = `${env.CLIENT_URL}/verify-email?token=${token}`;

  await transporter.sendMail({
    from: env.SMTP_FROM,
    to,
    subject: 'Verify your email',
    html: `<p>Click below to verify your account:</p><a href="${verifyUrl}">${verifyUrl}</a>`,
  });
};

export const sendPasswordResetEmail = async (to: string, token: string): Promise<void> => {
  const resetUrl = `${env.CLIENT_URL}/reset-password?token=${token}`;

  await transporter.sendMail({
    from: env.SMTP_FROM,
    to,
    subject: 'Reset your password',
    html: `<p>Click below to reset your password:</p><a href="${resetUrl}">${resetUrl}</a>`,
  });
};
