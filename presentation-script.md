# MifosX4MM — Presenter Script

> **Duration:** ~20–30 minutes total (2–3 min per slide)
> **Audience:** Team learning session — developers new to the project

---

## Slide 1 — Title

"Hey everyone, thanks for joining. Today I want to walk you through what we've been building — or more precisely, what we've been learning this past week. The project is called MifosX4MM. It's a full-stack microfinance platform built for Myanmar. By the end of this session, you should have a solid mental model of how the whole system fits together — even if you haven't touched the code yet."

---

## Slide 2 — What is MifosX4MM?

"So what is this thing exactly? At its core, MifosX4MM is a platform that helps microfinance institutions — or MFIs — manage their loan operations. Think loan officers out in the field registering clients, branch managers approving loans from the office, and customers repaying through KBZ Pay on their phones.

The big thing to understand here is that we didn't build a banking system from scratch. We built on top of Apache Fineract — that's an open-source core banking engine used by over 100 institutions worldwide. We wrap it with our own API gateway, we don't fork it. That's a key architectural decision — it means we get free upgrades and battle-tested reliability.

Quick numbers to anchor you: 7 microservices, 5 user roles, 2 databases."

---

## Slide 3 — System Architecture

"Let's look at how all the pieces connect. Reading top to bottom:

At the top are the clients — the web portal running on Next.js at port 3000, and the mobile app built with Expo React Native. Both of them talk to one thing only — the API Gateway.

The API Gateway is the brain. It runs on Fastify at port 3001. Every request from the browser or mobile app goes through here. It handles authentication using JWT tokens and authorization using role checks.

Below the gateway, you have five services: Keycloak for identity, Fineract for core banking, the mobile money service for KBZ Pay, the KYC service for identity verification, and the reporting service built in Python.

At the bottom are the databases. MySQL powers Fineract. PostgreSQL is used by both Keycloak and the reporting service — but they're separate databases.

This layered architecture means each service has one job and does it well."

---

## Slide 4 — 7 Services at a Glance

"Let me quickly name all eight services so you know what you're dealing with. I know the slide says seven — we have seven custom services plus Apache Fineract which we run as a Docker container.

**Web Portal** — the staff-facing dashboard. Branch managers and loan officers log in here to approve loans, track collections, see the dashboard.

**Mobile App** — built with Expo. This is what field loan officers use on their phones to register clients, submit KYC, and collect repayments.

**API Gateway** — the single entry point. Auth, routing, RBAC. All traffic goes through here.

**Mobile Money** — handles all KBZ Pay interactions. Payment initiation, signature verification, webhook callbacks.

**KYC Service** — identity verification with a pluggable architecture. More on that in a later slide.

**Reporting** — written in Python. Calculates PAR and collections data directly from SQL.

**Keycloak** — the identity provider. Issues JWT tokens, manages users and roles.

**Apache Fineract** — the core banking engine. Loans, clients, repayment schedules all live here."

---

## Slide 5 — Domain Knowledge: Microfinance 101

"Before you can read the code confidently, you need the domain vocabulary. Let me cover three concepts.

**What is an MFI?** A microfinance institution lends small amounts — we're talking MMK 50,000 to 2 million — to people who can't access traditional banks. They have no credit history, no collateral. The MFI uses field loan officers who physically visit clients. Apache Fineract was designed specifically for this model.

**PAR — Portfolio at Risk.** This is the headline metric of any MFI. PAR30 means: what percentage of your loan portfolio has been overdue for more than 30 days? If PAR30 is 5%, that's acceptable. If it's 20%, the institution is in trouble. We also track PAR0 — anything one day late — and PAR90 for severe cases. We calculate this directly from SQL because Fineract's own flag only updates during a nightly batch job. Our SQL is real-time.

**Loan Lifecycle.** A loan starts with client registration and KYC, moves through application, review, and approval, then gets disbursed. After that the repayment schedule is active and collections begin, usually via KBZ Pay. When all installments are paid, the loan closes. In Fineract's database, active loans have status 300 and closed loans have status 600."

> **Tip:** Pause here and ask the room: *"What does PAR30 of 20% mean for an MFI?"* before moving on.

---

## Slide 6 — Tech Stack

"Here's the full tech stack at a glance. I'll highlight the interesting choices.

On the frontend, we use Next.js 14 with the App Router pattern. React Query handles all data fetching with a 30-second stale time. The mobile app is Expo — one codebase for iOS and Android.

On the backend, the gateway and services are all TypeScript on Fastify. The reporting service breaks that pattern — it's Python with FastAPI and SQLAlchemy because direct database queries are more natural there.

For auth and security, Keycloak handles all identity. JWTs are RS256-signed and verified via JWKS — the gateway fetches Keycloak's public key once and caches it for 10 minutes. KBZ Pay uses HMAC-SHA256 request signing.

Infrastructure is Docker Compose with eight containers. The whole team runs the same environment. The monorepo uses Turborepo and pnpm workspaces with a shared TypeScript types package that all services depend on."

---

## Slide 7 — Auth Flow: JWT + Keycloak

"Authentication is one of the most important flows to understand. Let me walk through it step by step.

**Step 1:** You log into the web portal with your username and password.

**Step 2:** The API Gateway calls Keycloak using the Resource Owner Password Credentials flow — that's ROPC. Keycloak returns a JWT access token and a refresh token.

**Step 3:** Every subsequent request includes that JWT in the Authorization header.

**Step 4:** The gateway's `app.authenticate` hook fires. It calls `req.jwtVerify()`, which uses the `jwks-rsa` library to fetch Keycloak's public key. This key is cached for 10 minutes — so there's no call to Keycloak on every request.

**Step 5:** The token's RS256 signature, issuer, and expiry are all verified locally.

**Step 6:** A `formatUser()` function maps the raw Keycloak claims into a clean `AuthUser` object with id, username, email, and roles.

**Step 7:** Now `app.authorize(['branch_manager'])` can check the roles before the route handler runs.

On the right you can see what's inside the JWT payload — the username, the roles, the expiry. You can decode any token live at jwt.io to see this."

> **Tip:** Ask the room: *"Why don't we call Keycloak on every request to check the token?"* — answer is the JWKS public key cache.

---

## Slide 8 — API Gateway: The Brain of the System

"Let's look inside the API Gateway. It has five route files, each owning a different domain.

`auth.ts` handles login, token refresh, logout, and a `/me` endpoint to get the current user.

`clients.ts` is a clean proxy to Fineract — list clients, get a single client, create, update.

`loans.ts` is the most complex route — list loans, get loan detail, post a repayment, and the approval workflow: approve, disburse, reject.

`payments.ts` initiates KBZ Pay orders. This is out of scope for Week 1.

`dashboard.ts` fans out to the reporting service to aggregate stats.

On the right you see the five roles. The key insight is that authorization is enforced at the gateway level — the frontend doesn't control it. A loan officer literally cannot call the approve endpoint, even directly. The check is `app.authorize(['branch_manager', 'super_admin'])` in the route definition."

---

## Slide 9 — KYC + Reporting

"Two supporting services worth understanding in depth.

**KYC Service.** This follows what's called the pluggable provider pattern. There's a `KycProvider` interface with exactly four methods: submit, getStatus, handleWebhook, and getStats. The routes never import a provider directly — they just call `provider.submit()`. Which provider runs is determined by a single environment variable: `KYC_PROVIDER`. In development that's `stub`, which auto-approves after two seconds. In production you'd swap in Smile Identity for Myanmar national IDs, or Onfido for global biometric verification. Adding a new provider means implementing one file and adding one case to the resolver. Nothing else changes.

**Reporting Service.** Written in Python with FastAPI. It has three routers: portfolio for PAR calculations using a CTE query, collections for today's repayment totals, and kyc_summary which pulls stats from the KYC service. The reason we query PostgreSQL directly instead of calling Fineract's REST API is accuracy — Fineract's `inArrears` flag only updates after a scheduled batch job. Our SQL query looks at the repayment schedule table in real time, so the dashboard always shows the true current PAR."

---

## Slide 10 — Summary & Roadmap

"So to close out — let's talk about where we are and where we're going.

Week 1 was about understanding the system. And you now have that understanding. You know the architecture, the auth flow, the five roles, the domain vocabulary, the PAR formula, the loan lifecycle. That's a real foundation.

Now here's the path forward — two clear phases.

**Weeks 2–3: Fix and Launch.** We take everything we learned and make it run correctly and securely. That means fixing all the critical bugs — the SQL injection, the missing auth on the reporting service, the KYC data that disappears on restart. We also wire KBZ Pay webhook callbacks properly into Fineract repayments, and we get all eight services stable, health-checked, and production-ready. By end of Week 3, every core user flow works end-to-end with no workarounds.

**Weeks 4 and beyond: Grow.** Once the system is solid, we extend it. We bring in a real KYC provider — Smile Identity for Myanmar national IDs. We extend the mobile app with notifications and offline support. We do a real production deployment to the cloud with monitoring and alerting. And then we start building the features that actual MFIs need, based on real feedback.

The framing I want to leave you with is this: Week 1 is understand. Weeks 2–3 is make it run. Week 4 and beyond is make it yours.

Any questions?"

---

## Delivery Tips

| Tip | Detail |
|-----|--------|
| **Total time** | 20–30 minutes. Budget 2–3 min per slide. |
| **Slide 3** | Draw the architecture on a whiteboard in parallel — helps the audience trace the layers. |
| **Slide 5** | Ask questions before revealing answers — *"What does PAR mean?"*, *"Why two databases?"* |
| **Slide 7** | Ask *"Why don't we hit Keycloak on every request?"* — pause for answers first. |
| **Slide 10** | End on energy — the roadmap is exciting. Frame Weeks 2–3 as "now we build on what we know." |
| **Q&A** | Common questions: *"Why Python for reporting?"* (direct SQL is cleaner), *"Why not just use Fineract's API for everything?"* (accuracy + real-time). |
