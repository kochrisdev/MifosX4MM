# What I've Set Up — Session Progress Notes
## MifosX4MM · June 17, 2026

> **Who this is for:** Jackson (DEV006)
>
> **What this document is:** A plain-English record of everything that was set up or changed during this work session. Written so you can understand exactly what was done, why, and what files were created — even if you're not yet confident reading code.
>
> **📁 Note:** This folder moved from `Desktop/mifox/jackson/` to `MifosX4MM/docs/jackson/` on June 17, 2026.

---

## ✅ Created MOBILE-DEEP-DIVE.md — Complete Mobile App Technical Reference (June 17, 2026)

**File created:** `docs/jackson/MOBILE-DEEP-DIVE.md`

**What it covers (everything about the mobile app):**
- Full folder structure with what every file does
- Environment variables and why `192.168.1.109` instead of `localhost`
- Expo Router navigation architecture — route groups, dynamic routes, NavigationGuard
- Complete auth flow — AsyncStorage tokens, silent refresh, Keycloak handshake
- The Axios API client — request/response interceptors, token handling
- Every screen explained in detail: Login, Home/Dashboard, Clients, Collections, Client Detail, Loan Detail
- All hooks: `useClients`, `useClient`, `useClientLoans`, `useLoan`, `usePostRepayment`, `useInitiateKbzPayment`
- KBZ Pay full integration trace — MMK→pyas conversion, HMAC signing, deep link, polling
- Formatting utilities: `fmt.mmk()`, `fmt.percent()`, `fmt.number()`, `fmt.date()`
- Styling system — color palette, StyleSheet.create, React Native flexbox
- React Query strategy — stale time, cache invalidation, infinite queries
- Known bugs including the critical dual-database bug (Collections tab empty, PAR = 0.0%)
- End-to-end data flow trace: app open → login → browse clients → record repayment

---

## ✅ Fixed tsconfig.json Red Error in apps/mobile (June 17, 2026)

**File changed:** `apps/mobile/tsconfig.json`

**What was broken:** The file had `"extends": "expo/tsconfig.base"` which VS Code's TypeScript server couldn't resolve. In a pnpm monorepo without a hoist config, the `expo` package only exists inside `apps/mobile/node_modules/expo` — but TypeScript looks from the project root where it doesn't exist. This caused a red error badge on the file.

**How it was fixed:** Removed the `extends` line entirely and inlined all the settings that expo's base would have provided, plus added the missing ones (`jsx`, `strict`, `skipLibCheck`, `paths` for shared-types, `include` array). The error clears after running "TypeScript: Restart TS Server" in VS Code.

---

## ✅ Created DEEP-DIVE.md — Full System Deep-Dive Document (June 17, 2026)

**What was done:** Created `docs/jackson/DEEP-DIVE.md` — a comprehensive, beginner-developer-friendly document covering the entire MifosX4MM system.

**What it covers:**
- Why the project exists (the Myanmar MFI business problem)
- Every service explained (API Gateway, Fineract, Keycloak, KBZ Pay, KYC, Reporting)
- How authentication works step-by-step with exact code traces
- The full loan lifecycle from client registration → KYC → loan creation → approval → disbursement → repayment → closure, with every API call, every database write, and every file/function named
- All API endpoints with request/response examples
- Database schema (MySQL + PostgreSQL) with all key tables explained
- KBZ Pay payment flow with the HMAC-SHA256 signing explained
- KYC provider pattern and stub behaviour
- PAR calculation method with the actual SQL query
- All known bugs explained (including *why* reporting returns zeros)
- 11 hands-on labs with exact curl commands to test everything locally

**Why it was created:** Boss's instruction from the June 17 meeting — understand the system deeply (backend services, APIs, components, loan creation flow) as a reference for future strategy and modernisation discussions.

---

## ✅ Update — Login Now Works! (June 17, 2026)

**The app login is now fully working end-to-end.** The backend services (Keycloak, Fineract, and the API gateway) are running, and the login screen successfully authenticates with the pre-filled credentials.

**Auto-fill confirmed correct:** The username auto-fills as `loan.officer` (not `loan.offer` — that was just a visual trick where the text field was too narrow to show the full text at once). Login working proves the value was always correct.

**CLAUDE.md updated:** A new rule has been added so that going forward, all tracking documents in this folder are automatically updated after every bug fix or task completion — you won't need to ask for it.

---

## ✅ Fix — Mobile `tsconfig.json` TypeScript Error (June 17, 2026)

**The problem (plain English):** The mobile app's `apps/mobile/tsconfig.json` was showing a red TypeScript error. The error wasn't actually in our file — it was inherited from Expo's base config (`expo/tsconfig.base`), which sets an old module-resolution mode called `"node"` (TypeScript now calls it `node10`). Modern TypeScript (5.x) flags that setting as deprecated and warns it will stop working in TypeScript 7.0.

**What I changed:** I overrode the deprecated setting in our own `tsconfig.json` by adding:
```json
"compilerOptions": {
  "moduleResolution": "bundler",
  "module": "esnext"
}
```
`"bundler"` is the correct, modern resolution mode for an Expo/Metro project (Metro is a bundler), so this is both the fix and the recommended long-term setting — not just a way to silence the warning.

**Verified:** Ran `npx tsc --noEmit` inside `apps/mobile` — it now exits cleanly with no errors.

---

## The Big Picture First

Before diving into the details, here's the honest summary of where the project stands after this session:

**What we set up today:**
1. Your Android development environment (so you can test the mobile app)
2. Three helper scripts that make it easy to start the emulator in future
3. A convenience feature: the login screen now auto-fills your dev username and password when you're testing

**What is NOT fixed yet:**
- The app still can't log in (the core banking server and Keycloak need to be running first)
- The 20 code bugs in `jackson/bugs-and-errors.md` are still outstanding — but see the note at the end of this document: several critical ones have already been written by someone since those docs were created

---

## Part 1 — What Is an Android SDK and Why Did We Need It?

### The problem

The MifosX4MM mobile app is built with **Expo** and **React Native**. These are tools that let you write JavaScript code and then package it into a real Android or iOS app.

To test the mobile app on your computer (without a physical phone), you need:
1. An **Android emulator** — a virtual phone that runs on your computer
2. An **Android SDK** (Software Development Kit) — the collection of tools from Google that makes the emulator work

Neither of these came pre-installed, so the first thing we had to do was install them.

### What we installed

Everything was installed into `C:\Android\` on your computer. Here's what lives there now:

```
C:\Android\
├── cmdline-tools\latest\  ← The command-line tools from Google
├── platform-tools\        ← Contains "adb" — the Android Debug Bridge (lets your computer talk to the emulator)
├── emulator\              ← The actual emulator program
└── system-images\         ← The Android 15 operating system image that the emulator runs
```

We also told Windows where to find these tools by setting an environment variable called `ANDROID_HOME`. Think of environment variables as settings your computer looks up whenever it needs to find something. `ANDROID_HOME=C:\Android` tells all Android-related tools "look here for Android files."

### What is an AVD?

AVD stands for **Android Virtual Device**. It's the specific "phone" configuration the emulator uses. We created one called `pixel` running **Android 15 (API level 35)**. This is essentially a virtual Pixel phone.

---

## Part 2 — The Three Helper Scripts

We created three PowerShell scripts (`.ps1` files) in `C:\Users\OakkarMin\Desktop\mifox\`. These are your shortcuts for managing the Android emulator.

### Script 1: `setup-android.ps1`

**File:** `C:\Users\OakkarMin\Desktop\mifox\setup-android.ps1`

**What it does:** This is the "first-time setup" script. It:
1. Copies the Android command-line tools from your Downloads folder into `C:\Android\`
2. Sets the `ANDROID_HOME` environment variable permanently
3. Adds the Android tools to your PATH (so you can type `adb` or `emulator` in any terminal)
4. Downloads and installs Android platform-tools, the emulator, and the Android 15 system image
5. Accepts the Google SDK licences (you can't install without agreeing)
6. Creates the `pixel` AVD (the virtual phone)

**When to use it:** You only run this once, when setting up a new computer. **Do not run it again** — it will try to reinstall everything.

---

### Script 2: `fix-avd.ps1`

**File:** `C:\Users\OakkarMin\Desktop\mifox\fix-avd.ps1`

**What it does:** This script deletes the broken `pixel` AVD and creates a fresh one. It also starts the emulator at the end.

**When to use it:** Only if the emulator is broken — for example, if you see `ERROR: Unknown AVD name [pixel]` when trying to start it. Think of it as a "factory reset" for the virtual phone.

We needed this during setup because the first `setup-android.ps1` run created a broken AVD (the `--device "pixel_6"` flag caused a silent failure). `fix-avd.ps1` fixed this by recreating the AVD without that flag.

---

### Script 3: `start-emulator.ps1`

**File:** `C:\Users\OakkarMin\Desktop\mifox\start-emulator.ps1`

**What it does:** This is your everyday script for starting the emulator. It:
1. Re-loads the Android environment variables in the current terminal (because Windows doesn't always carry these over from one terminal session to another)
2. Starts the emulator with the `pixel` AVD

**When to use it:** Every time you want to test the mobile app. Run this first, wait for the emulator to fully boot (you'll see the home screen), then start Expo.

```powershell
# Contents of start-emulator.ps1 — what it actually does:
$env:ANDROID_HOME = "C:\Android"
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","User") + ";" + [System.Environment]::GetEnvironmentVariable("Path","Machine")

& "C:\Android\emulator\emulator.exe" -avd pixel
```

In plain English: "Set up the Android paths, then run the emulator with our virtual phone."

---

## Part 3 — How to Start the App for Testing (Your Daily Workflow)

Here's the step-by-step workflow for running the mobile app going forward:

### Step 1: Start the emulator

Open a PowerShell terminal and navigate to the mifox folder:

```powershell
cd C:\Users\OakkarMin\Desktop\mifox
.\start-emulator.ps1
```

Wait until you see the Android home screen in the emulator window. This takes about 30–60 seconds.

### Step 2: Start the Expo Metro server (in a new terminal)

Open a **second** PowerShell terminal:

```powershell
cd C:\Users\OakkarMin\Desktop\mifox\MifosX4MM\apps\mobile
pnpm start
```

### Step 3: Connect the emulator to Expo

In the Metro terminal, press `a`. This tells Expo: "open the app on the Android emulator."

The first time this runs, it installs Expo Go on the emulator (takes ~60 seconds). If you get an error about "APK install failed", wait a bit longer for the emulator to finish booting, then press `a` again.

### Step 4: Log in

The login screen will auto-fill with:
- Username: `loan.officer`
- Password: `Officer@1234`

> ⚠️ **Important:** This only works if the backend services are also running (Keycloak, Fineract, API gateway). Right now they're not running locally — you'll see "Invalid username or password" which is actually a "can't connect to server" error. The backend setup is a separate task.

---

## Part 4 — The Login Pre-fill (Dev Credentials)

### The problem

Every time you test the app, you'd have to manually type `loan.officer` and `Officer@1234` into the login screen. When you're debugging and restarting the app 20 times a day, this gets annoying fast.

### What we changed

We modified two files so that the login form automatically fills in the test credentials when you're running in development mode (not in production).

**File 1 changed: `MifosX4MM/apps/mobile/app/(auth)/login.tsx`**

This is the login screen code. We changed the username and password state to start pre-filled with values from environment variables:

```tsx
// Before our change:
const [username, setUsername] = useState('');
const [password, setPassword] = useState('');

// After our change:
const [username, setUsername] = useState(
  __DEV__ ? (process.env.EXPO_PUBLIC_DEV_USERNAME ?? '') : ''
);
const [password, setPassword] = useState(
  __DEV__ ? (process.env.EXPO_PUBLIC_DEV_PASSWORD ?? '') : ''
);
```

**What does this mean in plain English?**

- `__DEV__` is a special React Native variable that is `true` when you're running in development mode, and `false` in a production build. This means the pre-fill only happens during testing — a real user downloading from the app store would never see it.
- `process.env.EXPO_PUBLIC_DEV_USERNAME` reads the username from a configuration file (the `.env` file we created).
- `?? ''` means "use this value, or an empty string if it's missing."

So: when you run the app during development, the form is pre-filled. When a real user runs the production app, the form is blank.

**File 2 created: `MifosX4MM/apps/mobile/.env`**

This is a new file. A `.env` file (pronounced "dot env") is a simple text file where you put configuration values that you don't want to hard-code directly in your code. We created it with:

```env
EXPO_PUBLIC_API_URL=http://192.168.1.109:3001
EXPO_PUBLIC_REPORTING_URL=http://192.168.1.109:3005

# Dev credentials (auto-filled on login screen in dev builds only)
EXPO_PUBLIC_DEV_USERNAME=loan.officer
EXPO_PUBLIC_DEV_PASSWORD=Officer@1234
```

> **Why does `EXPO_PUBLIC_` matter?** Expo only passes environment variables to your React Native code if they start with `EXPO_PUBLIC_`. Any other variable stays server-side and can't be read by the app. This is a security feature.

**File 3 updated: `MifosX4MM/.env` (the root `.env`)**

The main project-level `.env` already existed with database and service URLs. We added the dev credentials section at the bottom:

```env
# ── Dev credentials (auto-filled in login screen, dev only) ──
EXPO_PUBLIC_DEV_USERNAME=loan.officer
EXPO_PUBLIC_DEV_PASSWORD=Officer@1234
```

---

## Part 5 — Login Status ✅

**Login is now working.** The backend services are running and the app authenticates successfully with:
- Username: `loan.officer` (auto-filled)
- Password: `Officer@1234` (auto-filled)

The earlier "Invalid username or password" error was not a credentials problem — it was a network error (the backend wasn't running yet). Once the backend started, login worked immediately with the auto-filled values.

**Services that need to be running for login to work:**
1. MySQL database (Fineract's data)
2. Keycloak (the login security server)
3. Apache Fineract (the core banking engine)
4. The Fastify API gateway (`apps/api`)
5. The Python reporting service (`services/reporting`)

---

## Part 6 — Bugs Fixed Before This Session (Great News!)

When the `jackson/bugs-and-errors.md` document was written on June 15, **7 critical bugs were listed as missing files**. Those files now exist in the codebase. This means the work was already done (likely by you or Merlin between June 15 and now):

| Bug | What was missing | Status now |
|-----|-----------------|------------|
| BUG-01 | `apps/api/src/routes/loans.ts` | ✅ File exists — fully implemented |
| BUG-02 | `apps/api/src/plugins/keycloak.ts` | ✅ File exists — fully implemented |
| BUG-03 | `services/reporting/db.py` | ✅ File exists — supports MySQL + PostgreSQL |
| BUG-04 | `services/reporting/routers/portfolio.py` | ✅ File exists — full SQL queries written |
| BUG-05 | `services/reporting/routers/collections.py` | ✅ File exists — full SQL queries written |
| BUG-06 | `apps/web/src/hooks/useClients.ts` | ✅ File exists — Merlin's work |
| BUG-07 | `apps/web/src/hooks/useLoans.ts` | ✅ File exists — Merlin's work |
| BUG-19 | `/documents` and `/settings` web pages | ✅ Both exist with "coming soon" placeholders |

**The API server can now start!** BUG-01 and BUG-02 were the ones crashing it before. With both files in place, `cd apps/api && pnpm dev` should work (once the `.env` variables are pointing at running services).

---

## Part 7 — What's Still Left for You (Jackson's Remaining Bugs)

Based on the current code, here are the bugs you still need to fix, in priority order:

| Bug | What to fix | Priority |
|-----|-------------|----------|
| BUG-08 | `payments.ts` — duplicate repayment recorded on every status poll | 🟠 High |
| BUG-09 | `kbzpay/client.ts` — `parseCallback()` treats `'0'` as success (should be `'1'`) | 🟠 High |
| BUG-10 | `shared-types` — `FineractClient.dateOfBirth` typed as `string`, Fineract sends `number[]` | 🟠 High |
| BUG-11 | `shared-types` — `FineractLoanAccount` missing `inArrears`, `repaymentSchedule`, `transactions`, `displaySymbol`, `totalRepayment` | 🟠 High |
| BUG-14 | `loans/[loanId].tsx` — `handleCash()` has no try/catch, button gets stuck on error | 🟠 High |
| BUG-15 | `mobile/src/lib/api.ts` — on token refresh failure, doesn't redirect to login screen | 🟠 High |
| BUG-18 | `clients.tsx` — mobile sends `offset/limit` but API reads `page/pageSize` + `autoCapitalize="words"` on search | 🟡 Medium |

See `jackson/jackson-task-guide.md` for step-by-step fix instructions for each of these.

---

## Quick Reference — Files Changed This Session

| File | What changed |
|------|-------------|
| `C:\Users\OakkarMin\Desktop\mifox\setup-android.ps1` | **Created** — One-time Android SDK installer |
| `C:\Users\OakkarMin\Desktop\mifox\fix-avd.ps1` | **Created** — Recreates broken AVD + starts emulator |
| `C:\Users\OakkarMin\Desktop\mifox\start-emulator.ps1` | **Created** — Your daily emulator launcher |
| `MifosX4MM/apps/mobile/app/(auth)/login.tsx` | **Modified** — Added dev credential pre-fill |
| `MifosX4MM/apps/mobile/.env` | **Created** — Mobile app environment variables incl. dev credentials |
| `MifosX4MM/.env` | **Updated** — Added `EXPO_PUBLIC_DEV_USERNAME` and `EXPO_PUBLIC_DEV_PASSWORD` |

---

| `MifosX4MM/docs/jackson/` | **Moved here** — jackson folder relocated from `Desktop/mifox/jackson/` |
| `C:\Users\OakkarMin\Desktop\mifox\CLAUDE.md` | **Updated** — Added rule: always update docs after every fix |

---

*Written: June 17, 2026 · MifosX4MM Mobile Dev Setup Session*
*Updated: June 17, 2026 · Login confirmed working · jackson folder moved · CLAUDE.md updated*
