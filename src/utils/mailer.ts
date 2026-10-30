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

const escapeHtml = (value: string): string =>
  value.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c,
  );

export const sendRequestDecisionEmail = async (
  to: string,
  input: { decision: 'approved' | 'denied'; subject: string; reason?: string | null },
): Promise<void> => {
  const approved = input.decision === 'approved';
  await transporter.sendMail({
    from: env.SMTP_FROM,
    to,
    subject: `Your request was ${approved ? 'approved' : 'rejected'}: ${input.subject}`,
    html: `
      <p>Your request <strong>${escapeHtml(input.subject)}</strong> was
      <strong>${approved ? 'approved' : 'rejected'}</strong>.</p>
      ${!approved && input.reason ? `<p>Reason: ${escapeHtml(input.reason)}</p>` : ''}
      <p>Sign in to see the details.</p>
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

export const sendSubscriptionReminderEmail = async (
  to: string,
  input: { propertyTitle: string; daysLeft: number; endsOn: string },
): Promise<void> => {
  const dayWord = input.daysLeft === 1 ? 'day' : 'days';
  await transporter.sendMail({
    from: env.SMTP_FROM,
    to,
    subject: `Subscription ending in ${input.daysLeft} ${dayWord}: ${input.propertyTitle}`,
    text: `The subscription for ${input.propertyTitle} ends on ${input.endsOn}. Please renew it to keep using EstateOps without interruption.`,
  });
};
