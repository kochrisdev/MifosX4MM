import { nanoid } from 'nanoid';
import type { KycSubmission, KycVerificationRequest, KycWebhookPayload } from '@mifos-x/shared-types';
import type { KycProvider, KycStats } from '../provider';

// In-memory store — replace with a real DB in production
const store = new Map<string, KycSubmission>();

export class StubKycProvider implements KycProvider {
  readonly name = 'stub';

  async submit(request: KycVerificationRequest): Promise<KycSubmission> {
    const submissionId = nanoid();
    const now = new Date().toISOString();

    const submission: KycSubmission = {
      submissionId,
      clientRef: request.clientRef,
      documentType: request.documentType,
      status: 'processing',
      providerRef: `stub-${submissionId}`,
      submittedAt: now,
      updatedAt: now,
    };

    store.set(submissionId, submission);

    // Auto-approve after 2 seconds in stub mode
    setTimeout(() => {
      const entry = store.get(submissionId);
      if (entry) {
        store.set(submissionId, { ...entry, status: 'approved', updatedAt: new Date().toISOString() });
      }
    }, 2000);

    return submission;
  }

  async getStatus(submissionId: string): Promise<KycSubmission> {
    const submission = store.get(submissionId);
    if (!submission) throw new Error(`Submission ${submissionId} not found`);
    return submission;
  }

  async handleWebhook(payload: unknown): Promise<KycWebhookPayload> {
    // Stub provider triggers its own webhooks internally — this is a no-op
    throw new Error('Stub provider does not receive external webhooks');
  }

  async getStats(): Promise<KycStats> {
    const counts = { pending: 0, processing: 0, approved: 0, rejected: 0, manual_review: 0, total: 0 };
    for (const s of store.values()) {
      counts[s.status] = (counts[s.status] ?? 0) + 1;
      counts.total++;
    }
    return counts;
  }
}
