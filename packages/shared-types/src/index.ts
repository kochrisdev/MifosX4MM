// ─── Fineract Core Entities ───────────────────────────────────────────────────

export interface FineractClient {
  id: number;
  accountNo: string;
  externalId?: string;
  firstname: string;
  lastname: string;
  displayName: string;
  mobileNo?: string;
  emailAddress?: string;
  dateOfBirth?: string; // yyyy-MM-dd
  active: boolean;
  officeId: number;
  officeName: string;
  status: { id: number; code: string; value: string };
}

export interface FineractLoanAccount {
  id: number;
  accountNo: string;
  externalId?: string;
  clientId: number;
  clientName: string;
  loanProductId: number;
  loanProductName: string;
  status: { id: number; code: string; value: string };
  principal: number;
  approvedPrincipal: number;
  currency: { code: string; name: string; decimalPlaces: number };
  numberOfRepayments: number;
  repaymentEvery: number;
  repaymentFrequencyType: { id: number; value: string };
  interestRatePerPeriod: number;
  annualInterestRate: number;
  timeline: {
    submittedOnDate?: string;
    approvedOnDate?: string;
    expectedDisbursementDate?: string;
    actualDisbursementDate?: string;
    expectedMaturityDate?: string;
  };
  summary: {
    principalDisbursed: number;
    principalOutstanding: number;
    interestCharged: number;
    interestOutstanding: number;
    totalOutstanding: number;
    totalOverdue: number;
  };
}

export interface FineractSavingsAccount {
  id: number;
  accountNo: string;
  clientId: number;
  clientName: string;
  savingsProductId: number;
  savingsProductName: string;
  status: { id: number; code: string; value: string };
  currency: { code: string; name: string; decimalPlaces: number };
  accountBalance: number;
  availableBalance: number;
}

export interface FineractLoanRepayment {
  loanId: number;
  dateFormat: string;
  locale: string;
  transactionDate: string;
  transactionAmount: number;
  paymentTypeId?: number;
  note?: string;
  externalId?: string;
}

// ─── KBZ Pay ──────────────────────────────────────────────────────────────────

export type KbzPayStatus = 'pending' | 'success' | 'failed' | 'expired';

export interface KbzPayOrderParams {
  orderId: string;
  amount: number; // in MMK, smallest unit (pyas)
  currency: 'MMK';
  description: string;
  customerName: string;
  customerPhone: string;
  callbackUrl: string;
  returnUrl?: string;
}

export interface KbzPayPrepayResponse {
  prepayId: string;
  orderId: string;
  expireTime: number; // unix timestamp
}

export interface KbzPayCallbackPayload {
  appId: string;
  orderId: string;
  prepayId: string;
  transactionId: string;
  status: '0' | '1' | '2'; // 0=success, 1=pending, 2=failed
  amount: string;
  currency: string;
  sign: string;
  timestamp: string;
}

export interface KbzPayStatusResponse {
  orderId: string;
  transactionId?: string;
  status: KbzPayStatus;
  amount: number;
  paidAt?: string;
}

// ─── KYC ──────────────────────────────────────────────────────────────────────

export type KycStatus = 'pending' | 'processing' | 'approved' | 'rejected' | 'manual_review';

export type KycDocumentType =
  | 'national_id'
  | 'passport'
  | 'driving_license'
  | 'nrc'; // Myanmar NRC card

export interface KycSubmission {
  submissionId: string;
  clientRef: string; // maps to Fineract client externalId
  documentType: KycDocumentType;
  status: KycStatus;
  providerRef?: string; // provider's own reference ID
  submittedAt: string;
  updatedAt: string;
  rejectionReason?: string;
}

export interface KycVerificationRequest {
  clientRef: string;
  documentType: KycDocumentType;
  firstName: string;
  lastName: string;
  dateOfBirth: string; // yyyy-MM-dd
  documentNumber: string;
  frontImageBase64: string;
  backImageBase64?: string;
  selfieBase64?: string;
}

export interface KycWebhookPayload {
  submissionId: string;
  providerRef: string;
  status: KycStatus;
  rejectionReason?: string;
  verifiedAt?: string;
}

// ─── API Response Wrappers ────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: Record<string, unknown>;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

export interface DashboardStats {
  activeClients: number;
  activeLoans: number;
  /** PAR30 — used as the headline PAR figure */
  parRatio: number;
  par0: number;
  par30: number;
  par90: number;
  totalOutstanding: number;
  totalOverdue: number;
  collectionsToday: number;
  collectionRate: number;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export type UserRole = 'super_admin' | 'branch_manager' | 'loan_officer' | 'teller' | 'customer';

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  roles: UserRole[];
  officeId?: number;
  officeName?: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}
