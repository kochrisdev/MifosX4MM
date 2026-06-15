# API Reference

All API Gateway routes are prefixed `/api/v1` and served on port **3001**.  
Protected routes require `Authorization: Bearer <accessToken>` unless marked **Public**.

---

## Auth

### `POST /api/v1/auth/login` — Public

Exchange credentials for tokens.

**Request**
```json
{ "username": "loan.officer", "password": "Officer@1234" }
```

**Response 200**
```json
{
  "success": true,
  "data": {
    "accessToken":  "<JWT>",
    "refreshToken": "<token>",
    "expiresIn":    900
  }
}
```

**Error 401**
```json
{ "success": false, "error": "401 Unauthorized" }
```

---

### `POST /api/v1/auth/refresh` — Public

Exchange a refresh token for a new token pair.

**Request**
```json
{ "refreshToken": "<token>" }
```

**Response 200** — same shape as `/auth/login`

---

### `POST /api/v1/auth/logout` — Public

Revoke the refresh token on Keycloak.

**Request**
```json
{ "refreshToken": "<token>" }
```

**Response 200**
```json
{ "success": true }
```

---

### `GET /api/v1/auth/me` — Protected

Return the authenticated user's profile.

**Response 200**
```json
{
  "success": true,
  "data": {
    "id":       "keycloak-uuid",
    "username": "loan.officer",
    "email":    "loan.officer@mifos.local",
    "roles":    ["loan_officer"]
  }
}
```

---

## Dashboard

### `GET /api/v1/dashboard/stats` — Protected

Aggregate portfolio and collections statistics. Fans out to the reporting service.

**Response 200**
```json
{
  "success": true,
  "data": {
    "activeClients":    142,
    "activeLoans":      98,
    "parRatio":         3.21,
    "par0":             5.10,
    "par30":            3.21,
    "par90":            1.04,
    "totalOutstanding": 45200000.00,
    "totalOverdue":     1452000.00,
    "collectionsToday": 3800000.00,
    "collectionRate":   87.5
  }
}
```

| Field | Description |
|---|---|
| `parRatio` | Alias for `par30` — headline PAR figure shown on dashboards |
| `par0` | % of portfolio outstanding where any installment is overdue |
| `par30` | % outstanding where oldest overdue installment is ≥ 30 days |
| `par90` | % outstanding where oldest overdue installment is ≥ 90 days |
| `collectionRate` | `collectionsToday / scheduledToday × 100` |

---

## Clients

### `GET /api/v1/clients` — Protected

**Query params**

| Param | Type | Default | Description |
|---|---|---|---|
| `page` | integer | 0 | Zero-based page number |
| `pageSize` | integer | 20 | Items per page (max 200) |
| `search` | string | — | Filter by display name |

**Response 200**
```json
{
  "success": true,
  "data": {
    "items": [{ "id": 1, "accountNo": "000000001", "displayName": "Ma Aye Myat", ... }],
    "total": 142,
    "page": 0,
    "pageSize": 20
  }
}
```

---

### `GET /api/v1/clients/:clientId` — Protected

**Response 200**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "accountNo": "000000001",
    "firstname": "Aye",
    "lastname": "Myat",
    "displayName": "Ma Aye Myat",
    "mobileNo": "+959xxxxxxx",
    "dateOfBirth": "1990-05-12",
    "active": true,
    "officeId": 1,
    "officeName": "Head Office",
    "status": { "id": 300, "code": "clientStatusType.active", "value": "Active" }
  }
}
```

---

### `POST /api/v1/clients` — Protected

Create a new Fineract client. Body mirrors the [Fineract client creation payload](https://demo.fineract.dev/fineract-provider/swagger-ui/index.html#/Client/create_1).

**Response 201**
```json
{ "success": true, "data": { "clientId": 42, "resourceId": 42 } }
```

---

### `PUT /api/v1/clients/:clientId` — Protected

Update client details. Partial update supported.

---

## Loans

### `GET /api/v1/clients/:clientId/loans` — Protected

Returns all loan accounts for a client.

**Response 200**
```json
{
  "success": true,
  "data": [
    {
      "id": 10,
      "accountNo": "000000010",
      "loanProductName": "Group Loan 12M",
      "status": { "id": 300, "value": "Active" },
      "principal": 500000,
      "approvedPrincipal": 500000,
      "currency": { "code": "MMK", "name": "Myanmar Kyat" },
      "summary": {
        "totalOutstanding": 320000,
        "totalOverdue": 0
      }
    }
  ]
}
```

---

### `GET /api/v1/loans/:loanId` — Protected

Full loan detail including repayment schedule and transactions.

**Query params**: none (always fetches `associations=repaymentSchedule,transactions`)

---

### `POST /api/v1/loans/:loanId/repayments` — Protected

Post a manual (cash) repayment.

**Request**
```json
{
  "dateFormat":        "yyyy/MM/dd",
  "locale":            "en",
  "transactionDate":   "2026/05/12",
  "transactionAmount": 50000,
  "note":              "Cash collected at branch"
}
```

**Response 201**
```json
{ "success": true, "data": { "loanId": 10, "resourceId": 99 } }
```

---

### `POST /api/v1/loans/:loanId/actions` — Protected (`branch_manager`, `super_admin`)

Lifecycle commands: approve, disburse, or reject a loan.

**Request**
```json
{ "command": "approve", "note": "Credit committee approved" }
```

| `command` | Description |
|---|---|
| `approve` | Move loan from Pending to Approved |
| `disburse` | Disburse an Approved loan |
| `reject` | Reject a Pending loan |

---

## Payments (KBZ Pay)

### `POST /api/v1/payments/initiate` — Protected

Initiate a KBZ Pay loan repayment.

**Request**
```json
{
  "loanId":       10,
  "amount":       50000,
  "customerName": "Ma Aye Myat",
  "customerPhone": "+959xxxxxxx"
}
```

**Response 200**
```json
{
  "success": true,
  "data": {
    "prepayId":   "kbz_prepay_abc123",
    "orderId":    "loan-10-xK3m9pQr",
    "expireTime": 1747141200
  }
}
```

After receiving `prepayId`, the mobile client opens: `kbzpay://pay?prepay_id=<prepayId>&merch_order_id=<orderId>`

---

### `GET /api/v1/payments/status/:orderId` — Protected

Check KBZ Pay payment status. If status is `success`, automatically posts the repayment to Fineract.

**Query params**

| Param | Type | Required | Description |
|---|---|---|---|
| `loanId` | integer | Yes | Fineract loan ID to post repayment to |

**Response 200**
```json
{
  "success": true,
  "data": {
    "orderId":       "loan-10-xK3m9pQr",
    "transactionId": "kbz_tx_xyz789",
    "status":        "success",
    "amount":        50000,
    "paidAt":        "2026-05-12T09:30:00Z"
  }
}
```

| `status` | Meaning |
|---|---|
| `pending` | Payment not yet completed |
| `success` | Payment confirmed — repayment posted to Fineract |
| `failed` | Payment failed or cancelled |
| `expired` | Payment window expired (30 min) |

---

## Reporting Service (port 3005)

The reporting service is called by the API gateway. Frontends should not call it directly in production.

---

### `GET /reports/portfolio/summary`

Full portfolio snapshot.

**Response 200**
```json
{
  "activeLoans":      98,
  "activeClients":    142,
  "totalDisbursed":   62000000.00,
  "totalOutstanding": 45200000.00,
  "totalOverdue":     1452000.00,
  "par0":             5.10,
  "par30":            3.21,
  "par90":            1.04,
  "currency":         "MMK"
}
```

---

### `GET /reports/portfolio/by-product`

**Response 200**
```json
[
  {
    "productName": "Individual Loan 6M",
    "loanCount":   45,
    "outstanding": 22000000.00,
    "overdue":     400000.00,
    "parRatio":    1.82
  }
]
```

---

### `GET /reports/portfolio/disbursements`

**Query params**

| Param | Type | Default | Description |
|---|---|---|---|
| `from` | date (ISO) | 12 months ago | Start date |
| `to` | date (ISO) | today | End date |
| `granularity` | `day` \| `week` \| `month` | `month` | Aggregation period |

**Response 200**
```json
[
  { "period": "2026-04-01", "loanCount": 12, "amount": 6000000.00 },
  { "period": "2026-05-01", "loanCount":  8, "amount": 4200000.00 }
]
```

---

### `GET /reports/collections/today`

**Response 200**
```json
{
  "scheduled":      4342000.00,
  "collected":      3800000.00,
  "collectionRate": 87.5
}
```

---

### `GET /reports/collections/overdue`

**Query params**

| Param | Type | Default | Description |
|---|---|---|---|
| `days_overdue` | integer | 1 | Minimum days past due |
| `branch_id` | integer | — | Filter by office/branch |
| `limit` | integer | 100 | Max results (max 500) |
| `offset` | integer | 0 | Pagination offset |

**Response 200**
```json
[
  {
    "loanId":           10,
    "accountNo":        "000000010",
    "clientName":       "Ma Aye Myat",
    "mobileNo":         "+959xxxxxxx",
    "currency":         "MMK",
    "oldestOverdueDate": "2026-04-12",
    "daysOverdue":      30,
    "totalOverdue":     75000.00
  }
]
```

---

### `GET /reports/kyc/status-breakdown`

**Response 200**
```json
{
  "pending":       3,
  "processing":    5,
  "approved":     128,
  "rejected":       2,
  "manual_review":  1,
  "total":        139
}
```

---

## KYC Service (port 3004)

### `POST /kyc/submit`

Submit a KYC verification request.

**Request**
```json
{
  "clientRef":      "client-ext-id-123",
  "documentType":   "nrc",
  "firstName":      "Aye",
  "lastName":       "Myat",
  "dateOfBirth":    "1990-05-12",
  "documentNumber": "12/KAMANA(N)123456",
  "frontImageBase64": "<base64>",
  "backImageBase64":  "<base64>",
  "selfieBase64":     "<base64>"
}
```

`documentType` values: `national_id`, `passport`, `driving_license`, `nrc`

**Response 201**
```json
{
  "success": true,
  "data": {
    "submissionId": "abc123",
    "clientRef":    "client-ext-id-123",
    "documentType": "nrc",
    "status":       "processing",
    "providerRef":  "stub-abc123",
    "submittedAt":  "2026-05-12T09:00:00Z",
    "updatedAt":    "2026-05-12T09:00:00Z"
  }
}
```

KYC statuses: `pending` → `processing` → `approved` | `rejected` | `manual_review`

---

### `GET /kyc/status/:submissionId`

**Response 200**
```json
{
  "success": true,
  "data": { "submissionId": "abc123", "status": "approved", ... }
}
```

---

### `GET /kyc/stats`

Aggregate counts by status (consumed by reporting service).

**Response 200**
```json
{
  "success": true,
  "data": {
    "pending": 3, "processing": 5, "approved": 128,
    "rejected": 2, "manual_review": 1, "total": 139
  }
}
```

---

### `POST /webhooks/kyc`

Inbound webhook from the KYC provider (Smile Identity, Onfido, etc.). Handled by the active provider implementation.

---

## Mobile Money Service (port 3003)

These routes are called by the API gateway, not directly by clients.

### `POST /payments/kbzpay/initiate`

**Request** — `KbzPayOrderParams`
```json
{
  "orderId":       "loan-10-xK3m9pQr",
  "amount":        5000000,
  "currency":      "MMK",
  "description":   "Loan repayment for account #10",
  "customerName":  "Ma Aye Myat",
  "customerPhone": "+959xxxxxxx",
  "callbackUrl":   "https://your-domain.com/webhooks/kbzpay"
}
```

Note: `amount` is in **pyas** (MMK × 100).

**Response 200**
```json
{
  "success": true,
  "data": {
    "prepayId":   "kbz_prepay_abc123",
    "orderId":    "loan-10-xK3m9pQr",
    "expireTime": 1747141200
  }
}
```

---

### `GET /payments/kbzpay/status/:orderId`

Query payment status from KBZ Pay.

**Response 200**
```json
{
  "success": true,
  "data": {
    "orderId":       "loan-10-xK3m9pQr",
    "transactionId": "kbz_tx_xyz789",
    "status":        "success",
    "amount":        5000000,
    "paidAt":        "2026-05-12T09:30:00Z"
  }
}
```

---

### `POST /webhooks/kbzpay`

KBZ Pay server-to-server payment notification.

**Request** — signed KBZ Pay callback payload  
**Response 200** — `{ "return_code": "SUCCESS", "return_msg": "OK" }`  
**Response 400** — `{ "return_code": "FAIL", "return_msg": "invalid signature" }` (on signature mismatch)

---

## Common Error Shapes

All services return errors in the same envelope:

```json
{ "success": false, "error": "Descriptive message" }
```

| HTTP Status | Meaning |
|---|---|
| 400 | Bad request / validation failure |
| 401 | Missing or expired JWT |
| 403 | Valid JWT but insufficient role |
| 404 | Resource not found |
| 500 | Internal error (check service logs) |
