import type { KycSubmission, KycVerificationRequest, KycWebhookPayload } from '@mifos-x/shared-types';

export interface KycStats {
  pending: number;
  processing: number;
  approved: number;
  rejected: number;
  manual_review: number;
  total: number;
}

export interface KycProvider {
  readonly name: string;
  submit(request: KycVerificationRequest): Promise<KycSubmission>;
  getStatus(submissionId: string): Promise<KycSubmission>;
  handleWebhook(payload: unknown): Promise<KycWebhookPayload>;
  getStats(): Promise<KycStats>;
}
