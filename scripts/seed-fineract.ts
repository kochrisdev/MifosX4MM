/**
 * Fineract Test Data Seeder
 * ─────────────────────────
 * Creates realistic test data in a fresh Fineract instance:
 *   1. Loan product (flat-rate, monthly, 12 months)
 *   2. 10 sample clients (Myanmar names)
 *   3. 10 loan accounts — 8 disbursed (active), 2 submitted
 *   4. Repayments on some loans (to populate collections history)
 *
 * Usage:
 *   npx tsx scripts/seed-fineract.ts
 *   # Or with custom env:
 *   FINERACT_URL=http://localhost:8080/fineract-provider/api/v1 npx tsx scripts/seed-fineract.ts
 */

import axios from 'axios';

const BASE = process.env.FINERACT_URL ?? 'http://localhost:8080/fineract-provider/api/v1';
const USERNAME = process.env.FINERACT_USERNAME ?? 'mifos';
const PASSWORD = process.env.FINERACT_PASSWORD ?? 'password';
const TENANT = process.env.FINERACT_TENANT_ID ?? 'default';

const fineract = axios.create({
  baseURL: BASE,
  headers: {
    'Fineract-Platform-TenantId': TENANT,
    'Content-Type': 'application/json',
  },
  auth: { username: USERNAME, password: PASSWORD },
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function dateStr(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return [
    String(d.getDate()).padStart(2, '0'),
    d.toLocaleString('en-US', { month: 'long' }),
    d.getFullYear(),
  ].join(' ');
}

function log(msg: string) {
  console.log(`  ${msg}`);
}

// ── Seed data ────────────────────────────────────────────────────────────────

const CLIENTS = [
  { firstname: 'Aung',    lastname: 'Kyaw',    mobile: '09251234567' },
  { firstname: 'Moe',     lastname: 'Thu',     mobile: '09261234568' },
  { firstname: 'Zaw',     lastname: 'Lin',     mobile: '09271234569' },
  { firstname: 'Htun',    lastname: 'Naing',   mobile: '09281234570' },
  { firstname: 'Nyi',     lastname: 'Nyi',     mobile: '09291234571' },
  { firstname: 'Thidar',  lastname: 'Win',     mobile: '09211234572' },
  { firstname: 'Aye',     lastname: 'Mya',     mobile: '09221234573' },
  { firstname: 'Su',      lastname: 'Khin',    mobile: '09231234574' },
  { firstname: 'Ma',      lastname: 'Lwin',    mobile: '09241234575' },
  { firstname: 'Sandar',  lastname: 'Myint',   mobile: '09201234576' },
];

// Loan amounts in MMK
const LOAN_AMOUNTS = [500_000, 1_000_000, 750_000, 2_000_000, 500_000, 300_000, 800_000, 1_500_000];

// ── Main seeder ───────────────────────────────────────────────────────────────

async function seed() {
  console.log('\n🌱  MifosX4MM — Fineract Test Data Seeder');
  console.log('   Target:', BASE, '\n');

  // ── 1. Verify connectivity ────────────────────────────────────────────────
  try {
    await fineract.get('/offices');
    log('✅  Fineract connection OK');
  } catch (err: any) {
    console.error('❌  Cannot connect to Fineract:', err.message);
    console.error('   Make sure Fineract is running and FINERACT_URL is correct.');
    process.exit(1);
  }

  // Get head office ID
  const officeRes = await fineract.get('/offices');
  const officeId: number = officeRes.data[0]?.id ?? 1;
  log(`   Using office ID: ${officeId}`);

  // ── 2. Enable MMK currency ────────────────────────────────────────────────
  console.log('\n💱  Enabling MMK currency…');
  try {
    await fineract.put('/currencies', { currencies: ['MMK'] });
    log('✅  MMK currency enabled');
  } catch (err: any) {
    log(`⚠️  Currency setup — ${err.response?.data?.defaultUserMessage ?? err.message}`);
  }

  // ── 3. Create loan product ────────────────────────────────────────────────
  console.log('\n📦  Creating loan product…');
  let productId: number;
  try {
    const productRes = await fineract.post('/loanproducts', {
      name: 'Standard Business Loan',
      shortName: 'SBL',
      description: 'Standard flat-rate business loan for small traders',
      currencyCode: 'MMK',
      digitsAfterDecimal: 0,
      inMultiplesOf: 0,
      principal: 1_000_000,
      minPrincipal: 100_000,
      maxPrincipal: 5_000_000,
      numberOfRepayments: 12,
      minNumberOfRepayments: 3,
      maxNumberOfRepayments: 24,
      repaymentEvery: 1,
      repaymentFrequencyType: 2, // Monthly
      interestRatePerPeriod: 2.5,
      interestRateFrequencyType: 2, // Monthly
      amortizationType: 1, // Equal installments
      interestType: 0, // Declining balance
      interestCalculationPeriodType: 1,
      transactionProcessingStrategyCode: 'mifos-standard-strategy',
      accountingRule: 1, // NONE (for simplicity)
      isInterestRecalculationEnabled: false,
      daysInYearType: 365,
      daysInMonthType: 30,
      locale: 'en',
    });
    productId = productRes.data.resourceId;
    log(`✅  Loan product created (ID: ${productId})`);
  } catch (err: any) {
    // Product may already exist — try to fetch it
    const existRes = await fineract.get('/loanproducts');
    const existing = existRes.data.find((p: any) => p.name === 'Standard Business Loan');
    if (existing) {
      productId = existing.id;
      log(`⚠️  Product already exists (ID: ${productId})`);
    } else {
      console.error('❌  Failed to create loan product:', err.response?.data ?? err.message);
      process.exit(1);
    }
  }

  // ── 3. Create clients ─────────────────────────────────────────────────────
  console.log('\n👥  Creating clients…');
  const clientIds: number[] = [];

  for (const c of CLIENTS) {
    try {
      const res = await fineract.post('/clients', {
        officeId,
        legalFormId: 1,
        firstname: c.firstname,
        lastname: c.lastname,
        mobileNo: c.mobile,
        active: true,
        activationDate: dateStr(-90),
        dateFormat: 'dd MMMM yyyy',
        locale: 'en',
      });
      clientIds.push(res.data.resourceId);
      log(`✅  Client: ${c.firstname} ${c.lastname} (ID: ${res.data.resourceId})`);
    } catch (err: any) {
      const detail = err.response?.data?.errors?.map((e: any) => e.defaultUserMessage).join(', ') ?? err.response?.data?.defaultUserMessage ?? err.message;
      log(`⚠️  Client ${c.firstname} ${c.lastname} — ${detail}`);
    }
  }

  if (clientIds.length === 0) {
    // Fetch existing clients
    const clientRes = await fineract.get('/clients?limit=20');
    const existing = clientRes.data?.pageItems ?? [];
    existing.slice(0, 10).forEach((cl: any) => clientIds.push(cl.id));
    log(`ℹ️  Using ${clientIds.length} existing clients`);
  }

  // ── 4. Create & disburse loans ────────────────────────────────────────────
  console.log('\n💰  Creating and disbursing loans…');
  const loanIds: number[] = [];

  for (let i = 0; i < Math.min(clientIds.length, LOAN_AMOUNTS.length); i++) {
    const clientId = clientIds[i];
    const amount   = LOAN_AMOUNTS[i];

    try {
      // Submit
      const submitRes = await fineract.post('/loans', {
        clientId,
        productId,
        loanType: 'individual',
        principal: amount,
        loanTermFrequency: 12,
        loanTermFrequencyType: 2,
        numberOfRepayments: 12,
        repaymentEvery: 1,
        repaymentFrequencyType: 2,
        interestRatePerPeriod: 2.5,
        amortizationType: 1,
        interestType: 0,
        interestCalculationPeriodType: 1,
        transactionProcessingStrategyCode: 'mifos-standard-strategy',
        submittedOnDate: dateStr(-60),
        expectedDisbursementDate: dateStr(-55),
        dateFormat: 'dd MMMM yyyy',
        locale: 'en',
      });
      const loanId: number = submitRes.data.loanId ?? submitRes.data.resourceId;
      loanIds.push(loanId);

      // Leave the last 2 as submitted (pending approval)
      if (i >= LOAN_AMOUNTS.length - 2) {
        log(`✅  Loan submitted (ID: ${loanId}) for client ${clientId} — left pending`);
        continue;
      }

      // Approve
      await fineract.post(`/loans/${loanId}?command=approve`, {
        approvedOnDate: dateStr(-55),
        approvedLoanAmount: amount,
        dateFormat: 'dd MMMM yyyy',
        locale: 'en',
      });

      // Disburse
      await fineract.post(`/loans/${loanId}?command=disburse`, {
        actualDisbursementDate: dateStr(-50),
        dateFormat: 'dd MMMM yyyy',
        locale: 'en',
        note: 'Seeded by test data script',
      });

      log(`✅  Loan disbursed (ID: ${loanId}) — ${(amount / 1000).toFixed(0)}K MMK`);
    } catch (err: any) {
      const detail = err.response?.data?.errors?.map((e: any) => e.defaultUserMessage).join(', ') ?? err.response?.data?.defaultUserMessage ?? err.message;
      log(`⚠️  Loan for client ${clientId}: ${detail}`);
    }
  }

  // ── 5. Post some repayments ───────────────────────────────────────────────
  console.log('\n💳  Posting repayments…');
  const activeLoans = loanIds.slice(0, Math.min(loanIds.length - 2, 6));

  for (const loanId of activeLoans) {
    try {
      // Post 2 monthly repayments, 40 and 10 days ago
      for (const offsetDays of [-40, -10]) {
        await fineract.post(`/loans/${loanId}/transactions?command=repayment`, {
          transactionDate: dateStr(offsetDays),
          transactionAmount: 100_000, // flat instalment proxy
          dateFormat: 'dd MMMM yyyy',
          locale: 'en',
          note: 'Seeded repayment',
        });
      }
      log(`✅  2 repayments posted for loan ${loanId}`);
    } catch (err: any) {
      log(`⚠️  Repayment for loan ${loanId}: ${err.response?.data?.defaultUserMessage ?? err.message}`);
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log(`
✨  Seeding complete!
   Clients created:  ${clientIds.length}
   Loans created:    ${loanIds.length} (${loanIds.length - 2} active, 2 pending)
   Repayments:       ${activeLoans.length * 2}

   Open http://localhost:3000 and log in to see the data.
`);
}

seed().catch((err) => {
  console.error('\n❌  Unexpected error:', err.message);
  process.exit(1);
});
