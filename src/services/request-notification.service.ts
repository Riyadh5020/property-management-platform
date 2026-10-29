import { findAdminById } from '../repositories/admin.repository';
import { sendRequestDecisionEmail } from '../utils/mailer';

const NOTIFY_TIMEOUT_MS = 5000;

// Tells the owner their request was approved or denied. Best effort: a mail problem must never
// undo or block the review, so failures and slow SMTP servers are only logged.
const notifyOwnerOfRequestDecision = async (input: {
  ownerId: string;
  decision: 'approved' | 'denied';
  subject: string;
  reason?: string | null;
}): Promise<void> => {
  try {
    const owner = await findAdminById(input.ownerId);
    if (!owner?.email) {
      return;
    }
    await Promise.race([
      sendRequestDecisionEmail(owner.email, input),
      new Promise((_resolve, reject) =>
        setTimeout(() => reject(new Error('timed out')), NOTIFY_TIMEOUT_MS),
      ),
    ]);
  } catch (error) {
    console.warn('[notify] could not email request decision:', (error as Error).message);
  }
};

export { notifyOwnerOfRequestDecision };
