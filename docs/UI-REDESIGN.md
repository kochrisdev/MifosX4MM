# UI Redesign Plan — MifosX4MM Web Portal

## Context

The current portal has a generic sky-blue/gray Tailwind design with no distinctive character. This plan replaces it with a production-grade design appropriate for a Myanmar-focused microfinance institution portal used daily by loan officers, branch managers, and tellers.

---

## Design Direction: "Teak & Precision"

**Concept:** Myanmar's craft tradition (lacquerware, teak, amber) meets fintech precision. Dark mahogany sidebar, warm ivory workspace, single burnished-gold accent. Numbers always in monospace. Every screen feels authoritative and considered.

**Rules:**
- NO Inter/system font
- NO sky-blue primary color
- NO purple gradients
- NO 4-equal-card dashboard grid
- NO pill-background status badges

---

## Color Palette

```css
:root {
  --sidebar:      #1b2030;   /* deep blue-black */
  --sidebar-text: #8b99ab;   /* muted steel */
  --sidebar-hover:#242d42;
  --gold:         #c49a38;   /* burnished gold — single accent */
  --gold-light:   #f0d080;   /* gold text on dark backgrounds */
  --page-bg:      #f5f3ee;   /* warm ivory */
  --card:         #ffffff;
  --text-1:       #1b2030;
  --text-2:       #6b7280;
  --text-3:       #9ca3af;
  --border:       #e5e2db;   /* warm divider */
  --danger:       #c0392b;
  --success:      #1a7a4a;
  --warning:      #b8850a;
}
```

---

## Typography

Loaded via `next/font/google` (no extra dependencies required).

| Role | Font | Tailwind class |
|---|---|---|
| Headings / nav labels | **Outfit** (400, 500, 600, 700) | `font-display` |
| Body / descriptions | **DM Sans** (400, 500) | `font-sans` |
| All numbers / amounts | **DM Mono** (400, 500) | `font-mono` |

---

## Files to Change (14 files)

### Foundation (do first)

| File | Change |
|---|---|
| `apps/web/tailwind.config.ts` | New color tokens + fontFamily config |
| `apps/web/src/app/globals.css` | CSS variable block + `@tailwind` directives |
| `apps/web/src/app/layout.tsx` | Import Outfit + DM Sans + DM Mono via `next/font/google`, apply as CSS variables |

### Shell

| File | Change |
|---|---|
| `apps/web/src/components/layout/Sidebar.tsx` | **Full rewrite** — dark nav, gold active indicator |
| `apps/web/src/components/layout/TopBar.tsx` | **Full rewrite** — minimal h-12 bar |
| `apps/web/src/app/(protected)/layout.tsx` | Update `ml-60` → `ml-56` |

### Pages

| File | Change |
|---|---|
| `apps/web/src/app/login/page.tsx` | **Split-screen** — dark left panel + ivory form right |
| `apps/web/src/app/(protected)/dashboard/page.tsx` | **Full rewrite** — inline stat strip + asymmetric 2-col |
| `apps/web/src/app/(protected)/clients/page.tsx` | **Full rewrite** — clean table, dot badges, gold button |
| `apps/web/src/app/(protected)/loans/page.tsx` | **Full rewrite** — same table pattern, arrears left-border |
| `apps/web/src/app/(protected)/clients/[clientId]/page.tsx` | Redesign detail header + loan list |
| `apps/web/src/app/(protected)/loans/[loanId]/page.tsx` | Redesign amounts + schedule table |

### Components

| File | Change |
|---|---|
| `apps/web/src/components/ui/Badge.tsx` | **Full rewrite** — dot + label only, no pill background |
| `apps/web/src/lib/format.ts` | **No changes** |

---

## Key Design Decisions Per Screen

### Sidebar
- Background: `bg-[var(--sidebar)]`, width `w-56`
- Logo: "MifosX" in Outfit font + small gold square
- Active nav item: gold left-border `border-l-2 border-[var(--gold)]` + lighter background
- Footer: initials avatar + username + logout icon

### TopBar
- Height `h-12`, white background, `border-b border-[var(--border)]`
- Left: current page name in `font-display`
- Right: branch name chip + bell icon + avatar

### Dashboard
**Row 1 — Inline stat strip** (4 stats separated by vertical dividers, no card boxes):
```
Active Loans   Active Clients   PAR30   Collections Today
```
Label in small uppercase `font-display`, value in `font-mono text-2xl`.

**Row 2 — 2-column layout (2/3 + 1/3):**
- Left: Recharts `AreaChart` for portfolio outstanding (gold fill)
- Right: "Today's actions" list — pending approvals, overdue follow-ups

### Clients & Loans Lists
- `divide-y divide-[var(--border)]` rows instead of cards per row
- Status: `● Active` using dot + text, no background fill
- All account numbers: `font-mono text-xs text-[var(--text-2)]`
- "In arrears" loans: subtle red left-border `border-l-2 border-[var(--danger)]`

### Login
- Left half: `bg-[var(--sidebar)]` with "MifosX" logo in gold + decorative SVG pattern
- Right half: warm ivory, centered sign-in form, gold submit button

---

## Implementation Order

1. Design tokens (`tailwind.config.ts`, `globals.css`, `layout.tsx`)
2. Shell (`Sidebar.tsx`, `TopBar.tsx`, protected `layout.tsx`)
3. Login page
4. Dashboard page
5. Badge component
6. Clients list + Loans list
7. Client detail + Loan detail

---

## No New Dependencies Required

All fonts via `next/font/google` (built-in). Lucide icons and Recharts stay as-is. No framer-motion needed — CSS `transition-all duration-200` handles all interactions.

---

## Verification

```powershell
# Start dev server
cd apps/web && npm run dev

# Check pages at:
# http://localhost:3000/login       — split-screen login
# http://localhost:3000/dashboard   — inline stat strip
# http://localhost:3000/clients     — clean table, gold button
# http://localhost:3000/loans       — table, arrears left-border

# Check for TypeScript errors
npm run build
```
