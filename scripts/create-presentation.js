/**
 * MifosX4MM Team Overview Presentation
 * Generates MifosX4MM-Team-Overview.pptx
 */

const pptxgen = require("pptxgenjs");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");
const path = require("path");

// ─── icon helper ──────────────────────────────────────────────────────────────
async function iconToBase64(IconComponent, color, size = 256) {
  const svg = ReactDOMServer.renderToStaticMarkup(
    React.createElement(IconComponent, { color, size: String(size) })
  );
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  return "image/png;base64," + buf.toString("base64");
}

// ─── colours ──────────────────────────────────────────────────────────────────
const C = {
  navy:    "065A82",
  teal:    "1C7293",
  mint:    "02C39A",
  iceBlue: "F0F7FB",
  white:   "FFFFFF",
  dark:    "1E293B",
  muted:   "64748B",
  card:    "FFFFFF",
  red:     "DC2626",
  redLight:"FEF2F2",
  mintLight:"E6FBF5",
  navyDark: "03354D",
};

// ─── helper: slide title ───────────────────────────────────────────────────────
function addSlideTitle(slide, text) {
  slide.addText(text, {
    x: 0.4, y: 0.18, w: 9.2, h: 0.6,
    fontFace: "Georgia", fontSize: 26, bold: true,
    color: C.navy, margin: 0,
  });
  // mint accent bar under title
  slide.addShape("rect", {
    x: 0.4, y: 0.82, w: 1.2, h: 0.05,
    fill: { color: C.mint }, line: { color: C.mint, width: 0 },
  });
}

// ─── helper: card with left accent bar ────────────────────────────────────────
function addCard(slide, x, y, w, h, opts = {}) {
  const shadow = () => ({ type: "outer", blur: 6, offset: 2, angle: 135, color: "000000", opacity: 0.08 });
  // card bg
  slide.addShape("rect", {
    x, y, w, h,
    fill: { color: opts.bg || C.card },
    shadow: shadow(),
    line: { color: "E2E8F0", width: 0.5 },
  });
  // left accent bar
  if (!opts.noAccent) {
    slide.addShape("rect", {
      x, y, w: 0.07, h,
      fill: { color: opts.accent || C.mint },
      line: { color: opts.accent || C.mint, width: 0 },
    });
  }
}

// ─── main ─────────────────────────────────────────────────────────────────────
async function main() {
  const {
    FaServer, FaShieldAlt, FaDatabase, FaKey, FaChartBar,
    FaMobileAlt, FaDesktop, FaCodeBranch, FaCheckCircle,
    FaExclamationTriangle, FaUsers, FaLock, FaArrowRight,
  } = require("react-icons/fa");
  const { MdPayment } = require("react-icons/md");

  // pre-render icons
  const icons = {
    server:  await iconToBase64(FaServer,       C.white, 256),
    shield:  await iconToBase64(FaShieldAlt,    C.white, 256),
    db:      await iconToBase64(FaDatabase,     C.white, 256),
    key:     await iconToBase64(FaKey,          C.white, 256),
    chart:   await iconToBase64(FaChartBar,     C.white, 256),
    mobile:  await iconToBase64(FaMobileAlt,    C.white, 256),
    desktop: await iconToBase64(FaDesktop,      C.white, 256),
    code:    await iconToBase64(FaCodeBranch,   C.white, 256),
    check:   await iconToBase64(FaCheckCircle,  C.mint,  256),
    warn:    await iconToBase64(FaExclamationTriangle, C.red, 256),
    users:   await iconToBase64(FaUsers,        C.white, 256),
    lock:    await iconToBase64(FaLock,         C.white, 256),
    arrow:   await iconToBase64(FaArrowRight,   C.mint,  256),
    payment: await iconToBase64(MdPayment,      C.white, 256),
  };

  const pres = new pptxgen();
  pres.layout = "LAYOUT_16x9";
  pres.title   = "MifosX4MM Team Overview";
  pres.author  = "MifosX4MM Team";

  // ══════════════════════════════════════════════════════════════════════════
  // SLIDE 1 — TITLE
  // ══════════════════════════════════════════════════════════════════════════
  {
    const sl = pres.addSlide();
    sl.background = { color: C.navyDark };

    // decorative teal block top-left
    sl.addShape("rect", { x: 0, y: 0, w: 3.5, h: 0.08, fill: { color: C.mint }, line: { color: C.mint, width: 0 } });

    // main title
    sl.addText("MifosX4MM", {
      x: 0.6, y: 1.1, w: 8.8, h: 1.2,
      fontFace: "Georgia", fontSize: 54, bold: true, color: C.white, margin: 0,
    });

    // mint accent line
    sl.addShape("rect", { x: 0.6, y: 2.42, w: 2.8, h: 0.07, fill: { color: C.mint }, line: { color: C.mint, width: 0 } });

    // subtitle
    sl.addText("Myanmar Microfinance Platform", {
      x: 0.6, y: 2.6, w: 8.4, h: 0.5,
      fontFace: "Calibri", fontSize: 22, color: "A8D8EA", margin: 0,
    });

    sl.addText("Full-Stack Architecture · Apache Fineract · Keycloak JWT · React + Python", {
      x: 0.6, y: 3.15, w: 8.4, h: 0.4,
      fontFace: "Calibri", fontSize: 14, color: "7FBBCC", margin: 0,
    });

    // bottom tag
    sl.addText("Team Learning Overview  ·  Jun 2026", {
      x: 0.6, y: 5.1, w: 8.8, h: 0.3,
      fontFace: "Calibri", fontSize: 11, color: "4E8FA3", margin: 0,
    });

    // decorative mint dot
    sl.addShape("ellipse", { x: 8.8, y: 0.9, w: 0.9, h: 0.9, fill: { color: C.mint, transparency: 70 }, line: { color: C.mint, width: 0 } });
    sl.addShape("ellipse", { x: 9.1, y: 1.7, w: 0.55, h: 0.55, fill: { color: C.teal, transparency: 60 }, line: { color: C.teal, width: 0 } });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SLIDE 2 — WHAT IS MifosX4MM?
  // ══════════════════════════════════════════════════════════════════════════
  {
    const sl = pres.addSlide();
    sl.background = { color: C.iceBlue };
    addSlideTitle(sl, "What is MifosX4MM?");

    // description block left
    addCard(sl, 0.4, 1.05, 5.5, 4.2);
    sl.addText([
      { text: "A full-stack microfinance platform", options: { bold: true, breakLine: true } },
      { text: "built for Myanmar MFIs.\n\n", options: { breakLine: true } },
      { text: "Purpose", options: { bold: true, color: C.navy, breakLine: true } },
      { text: "Help loan officers and branch managers manage their entire loan portfolio — from client registration and KYC identity checks to loan approval, disbursement, and mobile repayment.\n\n", options: { breakLine: true } },
      { text: "Built on Apache Fineract", options: { bold: true, color: C.navy, breakLine: true } },
      { text: "Battle-tested open-source core banking engine used by 100+ institutions worldwide. We wrap it with a custom API gateway, not fork it.", options: {} },
    ], {
      x: 0.6, y: 1.2, w: 5.1, h: 3.85,
      fontFace: "Calibri", fontSize: 13, color: C.dark,
      valign: "top",
    });

    // KPI cards right
    const kpis = [
      { n: "7",    label: "Microservices",  col: C.navy  },
      { n: "5",    label: "User Roles",     col: C.teal  },
      { n: "2",    label: "Databases",      col: C.mint  },
      { n: "100+", label: "MFIs Worldwide use Fineract", col: "1E5F74" },
    ];
    kpis.forEach((k, i) => {
      const x = 6.2 + (i % 2) * 1.95;
      const y = 1.05 + Math.floor(i / 2) * 2.15;
      sl.addShape("rect", {
        x, y, w: 1.8, h: 1.95,
        fill: { color: k.col },
        shadow: () => ({ type: "outer", blur: 8, offset: 3, angle: 135, color: "000000", opacity: 0.15 }),
      });
      sl.addText(k.n, {
        x: x + 0.05, y: y + 0.25, w: 1.7, h: 0.85,
        fontFace: "Georgia", fontSize: 34, bold: true, color: C.white, align: "center", margin: 0,
      });
      sl.addText(k.label, {
        x: x + 0.05, y: y + 1.1, w: 1.7, h: 0.6,
        fontFace: "Calibri", fontSize: 11, color: "D0EAF5", align: "center",
      });
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SLIDE 3 — ARCHITECTURE DIAGRAM
  // ══════════════════════════════════════════════════════════════════════════
  {
    const sl = pres.addSlide();
    sl.background = { color: C.iceBlue };
    addSlideTitle(sl, "System Architecture");

    const mkBox = (x, y, w, h, label, sublabel, bg, fg) => {
      sl.addShape("rect", { x, y, w, h, fill: { color: bg }, line: { color: "AACFE0", width: 0.8 } });
      sl.addText(label, { x: x + 0.05, y: y + 0.05, w: w - 0.1, h: h * 0.55, fontFace: "Calibri", fontSize: 10, bold: true, color: fg || C.white, align: "center", margin: 0 });
      if (sublabel) sl.addText(sublabel, { x: x + 0.05, y: y + h * 0.55, w: w - 0.1, h: h * 0.4, fontFace: "Calibri", fontSize: 8, color: fg ? C.muted : "C8E6F5", align: "center", margin: 0 });
    };
    const arrow = (x1, y1, x2, y2) => {
      sl.addShape("line", { x: x1, y: y1, w: x2 - x1, h: y2 - y1, line: { color: C.mint, width: 1.5, dashType: "dash" } });
    };

    // LAYER 0 — Clients
    sl.addShape("rect", { x: 0.3, y: 0.95, w: 9.4, h: 0.85, fill: { color: "E8F4FA" }, line: { color: "AACFE0", width: 0.8 } });
    sl.addText("CLIENTS", { x: 0.35, y: 0.97, w: 1, h: 0.25, fontFace: "Calibri", fontSize: 8, color: C.muted, bold: true });
    mkBox(0.5,  1.08, 2.2, 0.55, "Web Portal (Next.js)", ":3000", C.teal, C.white);
    mkBox(3.0,  1.08, 2.2, 0.55, "Mobile App (Expo RN)", "iOS / Android", C.teal, C.white);
    sl.addText("JWT RS256", { x: 5.4, y: 1.05, w: 1.1, h: 0.55, fontFace: "Calibri", fontSize: 8, color: C.muted, italic: true, align: "center" });

    // arrows down
    arrow(1.6, 1.63, 1.6, 2.05);
    arrow(4.1, 1.63, 4.1, 2.05);

    // LAYER 1 — API Gateway
    sl.addShape("rect", { x: 0.3, y: 2.05, w: 9.4, h: 0.8, fill: { color: C.navy }, line: { color: C.teal, width: 1 } });
    sl.addText("API GATEWAY  (Fastify :3001)  —  /auth  /clients  /loans  /payments  /dashboard  —  JWT auth + RBAC", {
      x: 0.45, y: 2.1, w: 9.1, h: 0.65,
      fontFace: "Calibri", fontSize: 11, bold: true, color: C.white, align: "center",
    });

    // arrows down from gateway
    const gx = [0.7, 2.5, 4.3, 6.1, 8.0];
    gx.forEach(x => arrow(x + 0.6, 2.85, x + 0.6, 3.2));

    // LAYER 2 — services
    mkBox(0.35, 3.2, 1.6, 0.75, "Keycloak", ":8180", "1E5F74");
    mkBox(2.15, 3.2, 1.6, 0.75, "Fineract", ":8080", C.navy);
    mkBox(3.95, 3.2, 1.65, 0.75, "Mobile Money", ":3003", "0E7490");
    mkBox(5.75, 3.2, 1.6, 0.75, "KYC Svc", ":3004", "065F46");
    mkBox(7.55, 3.2, 1.9, 0.75, "Reporting", ":3005 (Python)", "7C3AED");

    // arrows to DB
    arrow(1.15, 3.95, 1.15, 4.35);
    arrow(2.95, 3.95, 2.95, 4.35);
    arrow(8.5,  3.95, 8.5,  4.35);

    // LAYER 3 — databases
    mkBox(0.35, 4.35, 1.6, 0.95, "PostgreSQL", "(keycloak) :5432", "334155", C.white);
    mkBox(2.15, 4.35, 1.6, 0.95, "MySQL", "(fineract) :3306", "334155", C.white);
    mkBox(7.55, 4.35, 1.9, 0.95, "PostgreSQL", "(fineract_default) :5432", "334155", C.white);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SLIDE 4 — 7 SERVICES AT A GLANCE
  // ══════════════════════════════════════════════════════════════════════════
  {
    const sl = pres.addSlide();
    sl.background = { color: C.iceBlue };
    addSlideTitle(sl, "7 Services at a Glance");

    // 2 rows × 4 columns — card w=2.1", gap=0.13", start x=0.42"
    const services = [
      { icon: icons.desktop, title: "Web Portal",      sub: "Next.js 14 + React Query\n:3000 — Staff dashboard",             col: C.teal    },
      { icon: icons.mobile,  title: "Mobile App",      sub: "Expo React Native\niOS/Android — Field officers",              col: "0E7490"  },
      { icon: icons.server,  title: "API Gateway",     sub: "Fastify + TypeScript\n:3001 — Auth, RBAC, routing",            col: C.navy    },
      { icon: icons.payment, title: "Mobile Money",    sub: "KBZ Pay integration\n:3003 — HMAC-signed payments",           col: "0E6655"  },
      { icon: icons.shield,  title: "KYC Service",     sub: "Pluggable providers\n:3004 — Stub / Smile / Onfido",          col: "065F46"  },
      { icon: icons.chart,   title: "Reporting",       sub: "Python FastAPI + SQL\n:3005 — PAR, collections, stats",       col: "7C3AED"  },
      { icon: icons.key,     title: "Keycloak",        sub: "OIDC / JWT RS256\n:8180 — Identity provider",                 col: "1E5F74"  },
      { icon: icons.db,      title: "Apache Fineract", sub: "Core banking engine\n:8080 — Java / Docker only",             col: "334155"  },
    ];

    const CW = 2.1, GAP = 0.13, SX = 0.42, SY = 1.05, CH = 1.88, RG = 0.2;
    services.forEach((s, i) => {
      const c = i % 4;
      const r = Math.floor(i / 4);
      const x = SX + c * (CW + GAP);
      const y = SY + r * (CH + RG);

      sl.addShape("rect", { x, y, w: CW, h: CH, fill: { color: C.white }, line: { color: "E2E8F0", width: 0.5 } });
      sl.addShape("rect", { x, y, w: CW, h: 0.4, fill: { color: s.col }, line: { color: s.col, width: 0 } });
      sl.addImage({ data: s.icon, x: x + 0.1, y: y + 0.06, w: 0.27, h: 0.27 });
      sl.addText(s.title, { x: x + 0.42, y: y + 0.07, w: CW - 0.5, h: 0.26, fontFace: "Calibri", fontSize: 11, bold: true, color: C.white, margin: 0, valign: "middle" });
      sl.addText(s.sub, { x: x + 0.12, y: y + 0.47, w: CW - 0.2, h: 1.28, fontFace: "Calibri", fontSize: 10, color: C.dark });
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SLIDE 5 — DOMAIN KNOWLEDGE
  // ══════════════════════════════════════════════════════════════════════════
  {
    const sl = pres.addSlide();
    sl.background = { color: C.iceBlue };
    addSlideTitle(sl, "Domain Knowledge: Microfinance 101");

    const cols = [
      {
        title: "What is an MFI?",
        color: C.navy,
        body: [
          "A Microfinance Institution provides small loans to low-income borrowers who lack access to traditional banks.",
          "",
          "Unlike a bank, an MFI:",
          "• Lends in small amounts (MMK 50K–2M)",
          "• Uses group-lending models",
          "• Relies on loan officers in the field",
          "• Works with clients who have no credit history",
          "",
          "Apache Fineract exists precisely to power MFIs — it has the loan lifecycle baked in.",
        ],
      },
      {
        title: "PAR — Portfolio at Risk",
        color: C.teal,
        body: [
          "PAR measures what % of your loan portfolio is at risk of default.",
          "",
          "PAR0   — any loan 1+ day overdue",
          "PAR30 — 30+ days overdue (headline KPI)",
          "PAR90 — 90+ days overdue (severe)",
          "",
          "Calculated via direct SQL on repayment schedule:",
          "days_in_arrears = TODAY − oldest unpaid due date",
          "",
          "Why SQL, not Fineract API?",
          "Fineract's inArrears flag only updates after a scheduled batch job. Direct SQL is real-time.",
        ],
      },
      {
        title: "Loan Lifecycle",
        color: "065F46",
        body: [
          "1. Client registration + KYC",
          "2. Loan application submitted",
          "3. Loan officer review",
          "4. Branch manager approval",
          "5. Disbursement (funds sent)",
          "6. Repayment schedule active",
          "7. Collections (via KBZ Pay)",
          "8. Loan closed (status 600)",
          "",
          "status_id 300 = Active loan",
          "status_id 600 = Closed loan",
          "",
          "In Fineract: m_loan table",
        ],
      },
    ];

    cols.forEach((c, i) => {
      const x = 0.35 + i * 3.15;
      addCard(sl, x, 1.05, 3.0, 4.3, { accent: c.color });
      sl.addShape("rect", { x, y: 1.05, w: 3.0, h: 0.48, fill: { color: c.color }, line: { color: c.color, width: 0 } });
      sl.addText(c.title, { x: x + 0.15, y: 1.1, w: 2.7, h: 0.38, fontFace: "Georgia", fontSize: 13, bold: true, color: C.white, margin: 0 });
      sl.addText(c.body.join("\n"), {
        x: x + 0.18, y: 1.6, w: 2.72, h: 3.6,
        fontFace: "Calibri", fontSize: 10.5, color: C.dark, valign: "top",
      });
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SLIDE 6 — TECH STACK
  // ══════════════════════════════════════════════════════════════════════════
  {
    const sl = pres.addSlide();
    sl.background = { color: C.iceBlue };
    addSlideTitle(sl, "Tech Stack");

    const groups = [
      {
        label: "Frontend",
        color: C.teal,
        items: ["Next.js 14 (App Router)", "React 18 + Tailwind CSS", "React Query (data fetching)", "Recharts (charts)", "Expo React Native (mobile)"],
      },
      {
        label: "Backend",
        color: C.navy,
        items: ["Fastify 4 (API gateway)", "TypeScript everywhere", "Apache Fineract (Java)", "Python FastAPI (reporting)", "SQLAlchemy async + asyncpg"],
      },
      {
        label: "Auth & Security",
        color: "1E5F74",
        items: ["Keycloak 24 (OIDC)", "JWT RS256 via JWKS", "RBAC with role decorators", "KBZ Pay HMAC-SHA256", "Pluggable KYC providers"],
      },
      {
        label: "Infrastructure",
        color: "334155",
        items: ["Docker Compose (8 containers)", "MySQL (Fineract data)", "PostgreSQL (Keycloak + reporting)", "Turborepo + pnpm monorepo", "Shared TypeScript types package"],
      },
    ];

    groups.forEach((g, i) => {
      const x = 0.35 + (i % 2) * 4.85;
      const y = 1.05 + Math.floor(i / 2) * 2.3;

      addCard(sl, x, y, 4.6, 2.1, { accent: g.color });
      sl.addShape("rect", { x, y, w: 4.6, h: 0.42, fill: { color: g.color }, line: { color: g.color, width: 0 } });
      sl.addText(g.label, { x: x + 0.15, y: y + 0.07, w: 4.3, h: 0.28, fontFace: "Georgia", fontSize: 13, bold: true, color: C.white, margin: 0 });
      g.items.forEach((item, j) => {
        sl.addImage({ data: icons.arrow, x: x + 0.15, y: y + 0.52 + j * 0.31, w: 0.16, h: 0.16 });
        sl.addText(item, { x: x + 0.38, y: y + 0.5 + j * 0.31, w: 4.1, h: 0.25, fontFace: "Calibri", fontSize: 11, color: C.dark, margin: 0 });
      });
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SLIDE 7 — AUTH FLOW
  // ══════════════════════════════════════════════════════════════════════════
  {
    const sl = pres.addSlide();
    sl.background = { color: C.iceBlue };
    addSlideTitle(sl, "Auth Flow: JWT + Keycloak");

    const steps = [
      { n: "1", text: "User submits username + password via the web portal login form." },
      { n: "2", text: "API Gateway calls Keycloak using ROPC flow → receives JWT access token (RS256) + refresh token." },
      { n: "3", text: "Subsequent requests include the JWT in the Authorization header." },
      { n: "4", text: "app.authenticate hook fires → req.jwtVerify() called → jwks-rsa fetches Keycloak's public key (cached 10 min)." },
      { n: "5", text: "JWT signature, issuer, and expiry are verified — no database call needed on every request." },
      { n: "6", text: "formatUser() maps Keycloak claims → AuthUser { id, username, email, roles }." },
      { n: "7", text: "app.authorize(['branch_manager']) decorator checks roles before route handler runs." },
    ];

    steps.forEach((s, i) => {
      const y = 1.1 + i * 0.62;
      // circle
      sl.addShape("ellipse", { x: 0.4, y: y - 0.02, w: 0.4, h: 0.4, fill: { color: i < 5 ? C.navy : C.mint }, line: { color: "AACFE0", width: 0 } });
      sl.addText(s.n, { x: 0.4, y: y - 0.02, w: 0.4, h: 0.4, fontFace: "Calibri", fontSize: 12, bold: true, color: C.white, align: "center", valign: "middle", margin: 0 });
      // connector line
      if (i < steps.length - 1) sl.addShape("line", { x: 0.6, y: y + 0.38, w: 0, h: 0.26, line: { color: "C0D8E4", width: 1.5 } });
      // text — capped at 5.1" to avoid overlapping the callout card (x=6.2)
      sl.addText(s.text, { x: 0.95, y: y, w: 5.1, h: 0.36, fontFace: "Calibri", fontSize: 12, color: C.dark, margin: 0, valign: "middle" });
    });

    // callout box
    addCard(sl, 6.2, 1.05, 3.5, 1.6, { accent: C.mint, bg: C.mintLight });
    sl.addText("JWT Payload contains:", { x: 6.4, y: 1.12, w: 3.1, h: 0.28, fontFace: "Calibri", fontSize: 11, bold: true, color: C.navy, margin: 0 });
    sl.addText("preferred_username  →  your username\nrealm_access.roles  →  assigned roles\nexp  →  expiry (~15 min from login)\niss  →  Keycloak realm URL", {
      x: 6.4, y: 1.42, w: 3.1, h: 1.05,
      fontFace: "Calibri", fontSize: 10, color: C.dark,
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SLIDE 8 — API GATEWAY
  // ══════════════════════════════════════════════════════════════════════════
  {
    const sl = pres.addSlide();
    sl.background = { color: C.iceBlue };
    addSlideTitle(sl, "API Gateway: The Brain of the System");

    // routes table left
    addCard(sl, 0.4, 1.05, 5.7, 4.25);
    sl.addShape("rect", { x: 0.4, y: 1.05, w: 5.7, h: 0.45, fill: { color: C.navy }, line: { color: C.navy, width: 0 } });
    sl.addText("Route File", { x: 0.55, y: 1.1, w: 2.2, h: 0.34, fontFace: "Calibri", fontSize: 11, bold: true, color: C.white, margin: 0 });
    sl.addText("Endpoints", { x: 2.85, y: 1.1, w: 3.1, h: 0.34, fontFace: "Calibri", fontSize: 11, bold: true, color: C.white, margin: 0 });

    const rows = [
      { file: "routes/auth.ts",      desc: "login, refresh, logout, /me" },
      { file: "routes/clients.ts",   desc: "list, get, create, update client" },
      { file: "routes/loans.ts",     desc: "list, detail, repay, approve / disburse / reject" },
      { file: "routes/payments.ts",  desc: "initiate KBZ Pay order (out of scope wk1)" },
      { file: "routes/dashboard.ts", desc: "fan-out to reporting service → aggregate stats" },
    ];
    rows.forEach((r, i) => {
      const y = 1.55 + i * 0.72;
      const bg = i % 2 === 0 ? "F8FAFC" : C.white;
      sl.addShape("rect", { x: 0.47, y, w: 5.55, h: 0.66, fill: { color: bg }, line: { color: "E2E8F0", width: 0.3 } });
      sl.addText(r.file, { x: 0.55, y: y + 0.1, w: 2.2, h: 0.46, fontFace: "Calibri", fontSize: 10, color: C.navy, bold: true, margin: 0 });
      sl.addText(r.desc, { x: 2.85, y: y + 0.1, w: 3.0, h: 0.46, fontFace: "Calibri", fontSize: 10, color: C.dark, margin: 0 });
    });

    // RBAC card right
    addCard(sl, 6.4, 1.05, 3.25, 4.25, { accent: C.teal });
    sl.addShape("rect", { x: 6.4, y: 1.05, w: 3.25, h: 0.45, fill: { color: C.teal }, line: { color: C.teal, width: 0 } });
    sl.addText("RBAC Roles", { x: 6.55, y: 1.1, w: 2.95, h: 0.34, fontFace: "Calibri", fontSize: 12, bold: true, color: C.white, margin: 0 });

    const roles = [
      { role: "super_admin",     perms: "Full access" },
      { role: "branch_manager",  perms: "Approve / reject / disburse loans" },
      { role: "loan_officer",    perms: "Register clients, originate loans" },
      { role: "teller",          perms: "Collect repayments only" },
      { role: "customer",        perms: "Mobile self-service (future)" },
    ];
    roles.forEach((r, i) => {
      const y = 1.58 + i * 0.75;
      sl.addShape("rect", { x: 6.47, y, w: 3.1, h: 0.68, fill: { color: i % 2 === 0 ? "F0F7FF" : C.white }, line: { color: "E2E8F0", width: 0.3 } });
      sl.addText(r.role, { x: 6.58, y: y + 0.04, w: 3.0, h: 0.28, fontFace: "Calibri", fontSize: 10, bold: true, color: C.navy, margin: 0 });
      sl.addText(r.perms, { x: 6.58, y: y + 0.34, w: 3.0, h: 0.25, fontFace: "Calibri", fontSize: 9.5, color: C.muted, margin: 0 });
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SLIDE 9 — KYC + REPORTING
  // ══════════════════════════════════════════════════════════════════════════
  {
    const sl = pres.addSlide();
    sl.background = { color: C.iceBlue };
    addSlideTitle(sl, "Supporting Services: KYC + Reporting");

    // KYC left
    addCard(sl, 0.4, 1.05, 4.55, 4.3, { accent: "065F46" });
    sl.addShape("rect", { x: 0.4, y: 1.05, w: 4.55, h: 0.45, fill: { color: "065F46" }, line: { color: "065F46", width: 0 } });
    sl.addText("KYC Service — Pluggable Pattern", { x: 0.58, y: 1.1, w: 4.2, h: 0.34, fontFace: "Georgia", fontSize: 12, bold: true, color: C.white, margin: 0 });

    sl.addText([
      { text: "KycProvider interface (4 methods):\n", options: { bold: true, breakLine: true } },
      { text: "submit()         ", options: { bold: true } }, { text: "→ start verification\n", options: {} },
      { text: "getStatus()    ", options: { bold: true } }, { text: "→ check current status\n", options: {} },
      { text: "handleWebhook()", options: { bold: true } }, { text: " → async callback\n", options: {} },
      { text: "getStats()       ", options: { bold: true } }, { text: "→ counts by status\n\n", options: {} },
      { text: "Providers (swap via KYC_PROVIDER env):\n", options: { bold: true, breakLine: true } },
      { text: "stub          ", options: { bold: true, color: C.teal } }, { text: "— in-memory, auto-approves (dev)\n", options: {} },
      { text: "smile_identity", options: { bold: true, color: C.teal } }, { text: "— national ID (Myanmar)\n", options: {} },
      { text: "onfido        ", options: { bold: true, color: C.teal } }, { text: "— global biometric\n\n", options: {} },
      { text: "Routes never import the provider directly — they call provider.submit(). This is the pluggable pattern.", options: { italic: true, color: C.muted } },
    ], { x: 0.6, y: 1.58, w: 4.15, h: 3.6, fontFace: "Calibri", fontSize: 11, color: C.dark });

    // Reporting right
    addCard(sl, 5.2, 1.05, 4.55, 4.3, { accent: "7C3AED" });
    sl.addShape("rect", { x: 5.2, y: 1.05, w: 4.55, h: 0.45, fill: { color: "7C3AED" }, line: { color: "7C3AED", width: 0 } });
    sl.addText("Reporting Service — Python + SQL", { x: 5.38, y: 1.1, w: 4.2, h: 0.34, fontFace: "Georgia", fontSize: 12, bold: true, color: C.white, margin: 0 });

    sl.addText([
      { text: "Stack: ", options: { bold: true } }, { text: "FastAPI + SQLAlchemy async + asyncpg\n\n", options: {} },
      { text: "Why direct SQL (not Fineract REST)?\n", options: { bold: true, breakLine: true } },
      { text: "Fineract's inArrears flag only updates after a scheduled batch job. Direct SQL is real-time and more accurate for PAR.\n\n", options: {} },
      { text: "3 routers:\n", options: { bold: true, breakLine: true } },
      { text: "portfolio   ", options: { bold: true, color: "7C3AED" } }, { text: "→ PAR calculation via CTE\n", options: {} },
      { text: "collections ", options: { bold: true, color: "7C3AED" } }, { text: "→ SUM(repayments today)\n", options: {} },
      { text: "kyc_summary ", options: { bold: true, color: "7C3AED" } }, { text: "→ pulls from KYC service\n\n", options: {} },
      { text: "Startup check: SELECT 1 — fails fast if PostgreSQL is unreachable.", options: { italic: true, color: C.muted } },
    ], { x: 5.4, y: 1.58, w: 4.15, h: 3.6, fontFace: "Calibri", fontSize: 11, color: C.dark });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SLIDE 10 — BUGS
  // ══════════════════════════════════════════════════════════════════════════
  {
    const sl = pres.addSlide();
    sl.background = { color: C.iceBlue };
    addSlideTitle(sl, "Bugs We Found — Know Before You Code");

    const bugs = [
      {
        n: "Bug #3",
        title: "Reporting Service Has No Authentication",
        severity: "SECURITY",
        file: "services/reporting/main.py",
        detail: "curl http://localhost:3005/reports/portfolio/summary\n# No token needed. Returns PAR figures,\n# outstanding amounts, overdue totals.\n# This is a live security hole.",
        impact: "Any unauthenticated caller can read sensitive portfolio financial data. Fix: add JWT middleware to all reporting routes.",
        fixWeek: "Week 2",
      },
      {
        n: "Bug #4",
        title: "KYC Data Lost on Container Restart",
        severity: "DATA LOSS",
        file: "services/kyc/src/providers/stub.ts",
        detail: "private submissions = new Map<string, KycSubmission>()\n// In-memory store. Container restart\n// = all KYC records gone.",
        impact: "Stub provider uses JavaScript Map — ephemeral, not persisted. All submissions disappear when the container restarts. Fix: persist to database.",
        fixWeek: "Week 2",
      },
    ];

    bugs.forEach((b, i) => {
      const x = 0.4 + i * 4.9;
      // card
      sl.addShape("rect", { x, y: 1.05, w: 4.6, h: 4.3, fill: { color: C.redLight }, line: { color: "FCA5A5", width: 0.8 } });
      sl.addShape("rect", { x, y: 1.05, w: 0.07, h: 4.3, fill: { color: C.red }, line: { color: C.red, width: 0 } });
      // header
      sl.addShape("rect", { x, y: 1.05, w: 4.6, h: 0.5, fill: { color: C.red }, line: { color: C.red, width: 0 } });
      sl.addImage({ data: icons.warn, x: x + 0.12, y: 1.1, w: 0.3, h: 0.3 });
      sl.addText(`${b.n} — ${b.severity}`, { x: x + 0.5, y: 1.1, w: 4.0, h: 0.3, fontFace: "Calibri", fontSize: 11, bold: true, color: C.white, margin: 0 });

      sl.addText(b.title, { x: x + 0.18, y: 1.65, w: 4.3, h: 0.45, fontFace: "Georgia", fontSize: 12, bold: true, color: "991B1B", margin: 0 });
      sl.addText("File: " + b.file, { x: x + 0.18, y: 2.12, w: 4.3, h: 0.25, fontFace: "Calibri", fontSize: 9, color: C.muted, italic: true, margin: 0 });

      // code block
      sl.addShape("rect", { x: x + 0.15, y: 2.42, w: 4.3, h: 0.88, fill: { color: "1E293B" }, line: { color: "334155", width: 0.5 } });
      sl.addText(b.detail, { x: x + 0.25, y: 2.47, w: 4.1, h: 0.78, fontFace: "Courier New", fontSize: 8.5, color: "A8D8EA", margin: 0 });

      sl.addText("Impact:", { x: x + 0.18, y: 3.38, w: 4.3, h: 0.22, fontFace: "Calibri", fontSize: 10.5, bold: true, color: "991B1B", margin: 0 });
      sl.addText(b.impact, { x: x + 0.18, y: 3.6, w: 4.25, h: 0.75, fontFace: "Calibri", fontSize: 10, color: C.dark });
      sl.addShape("rect", { x: x + 0.15, y: 4.92, w: 1.1, h: 0.27, fill: { color: C.red }, line: { color: C.red, width: 0 } });
      sl.addText("Fix: " + b.fixWeek, { x: x + 0.17, y: 4.93, w: 1.06, h: 0.25, fontFace: "Calibri", fontSize: 9.5, bold: true, color: C.white, margin: 0 });
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SLIDE 11 — WEEK 1 MASTERY CHECKLIST
  // ══════════════════════════════════════════════════════════════════════════
  {
    const sl = pres.addSlide();
    sl.background = { color: C.iceBlue };
    addSlideTitle(sl, "Week 1 Mastery: What You Should Know");

    const checks = [
      "All 7 services running locally (health endpoints return ok)",
      "Dashboard shows real KPI numbers after pnpm seed",
      "Can explain PAR, loan disbursement vs repayment, and MFI vs bank",
      "JWT decoded live in jwt.io — roles visible in payload",
      "Keycloak admin explored: users, roles, clients all understood",
      "All 5 API gateway route files read and understood",
      "Fineract Swagger explored — at least 5 endpoints examined",
      "A loan fetch traced end-to-end: Browser → Gateway → Fineract → MySQL",
      "KYC pluggable pattern understood — stub provider read fully",
      "Bug #4 (KYC data loss) demonstrated live with docker restart",
      "Reporting service Python code read and understood",
      "PAR SQL query run live in psql — result matches dashboard",
      "Bug #3 (reporting no auth) demonstrated live with curl",
      "All 10 mastery questions answered without looking at code",
    ];

    const half = Math.ceil(checks.length / 2);
    [checks.slice(0, half), checks.slice(half)].forEach((col, ci) => {
      const x = 0.4 + ci * 4.85;
      col.forEach((item, j) => {
        const y = 1.08 + j * 0.62;
        addCard(sl, x, y, 4.6, 0.52, { noAccent: false, accent: C.mint });
        sl.addImage({ data: icons.check, x: x + 0.1, y: y + 0.13, w: 0.26, h: 0.26 });
        sl.addText(item, { x: x + 0.42, y: y + 0.08, w: 4.05, h: 0.36, fontFace: "Calibri", fontSize: 10.5, color: C.dark, margin: 0, valign: "middle" });
      });
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SLIDE 12 — SUMMARY / ROADMAP (dark closing)
  // ══════════════════════════════════════════════════════════════════════════
  {
    const sl = pres.addSlide();
    sl.background = { color: C.navyDark };

    sl.addShape("rect", { x: 0, y: 0, w: 10, h: 0.08, fill: { color: C.mint }, line: { color: C.mint, width: 0 } });

    sl.addText("Summary & Roadmap", {
      x: 0.6, y: 0.22, w: 8.8, h: 0.65,
      fontFace: "Georgia", fontSize: 32, bold: true, color: C.white, margin: 0,
    });
    sl.addText("From learning to a fully running system — two clear phases", {
      x: 0.6, y: 0.9, w: 8.8, h: 0.35,
      fontFace: "Calibri", fontSize: 14, color: "7FBBCC", margin: 0,
    });

    // ── Phase 1 card ─────────────────────────────────────────────────────
    sl.addShape("rect", { x: 0.4, y: 1.42, w: 4.55, h: 3.8, fill: { color: "062E44" }, line: { color: C.teal, width: 1.2 } });
    sl.addShape("rect", { x: 0.4, y: 1.42, w: 4.55, h: 0.6, fill: { color: C.teal }, line: { color: C.teal, width: 0 } });

    // phase label
    sl.addText("WEEKS 2 – 3", { x: 0.55, y: 1.47, w: 2.5, h: 0.2, fontFace: "Calibri", fontSize: 9, bold: true, color: "D0EAF5", margin: 0 });
    // badge
    sl.addShape("rect", { x: 3.35, y: 1.49, w: 1.45, h: 0.26, fill: { color: "02C39A" }, line: { color: "02C39A", width: 0 } });
    sl.addText("FIX & LAUNCH", { x: 3.35, y: 1.49, w: 1.45, h: 0.26, fontFace: "Calibri", fontSize: 8.5, bold: true, color: C.navyDark, align: "center", valign: "middle", margin: 0 });
    sl.addText("Fix Bugs + All Core Functions Running", {
      x: 0.55, y: 2.08, w: 4.2, h: 0.36,
      fontFace: "Georgia", fontSize: 13, bold: true, color: C.white, margin: 0,
    });

    const p1items = [
      "Fix all critical security bugs (SQL injection, missing auth)",
      "KYC service — persist data + wire real provider",
      "KBZ Pay webhook → Fineract repayment fully connected",
      "All 8 services stable, health-checked, and production-ready",
      "Every core user flow works end-to-end with no workarounds",
    ];
    p1items.forEach((item, j) => {
      sl.addImage({ data: icons.arrow, x: 0.55, y: 2.55 + j * 0.49, w: 0.18, h: 0.18 });
      sl.addText(item, { x: 0.8, y: 2.52 + j * 0.49, w: 3.98, h: 0.42, fontFace: "Calibri", fontSize: 10.5, color: "C8E6F5" });
    });

    // ── Phase 2 card ─────────────────────────────────────────────────────
    sl.addShape("rect", { x: 5.1, y: 1.42, w: 4.55, h: 3.8, fill: { color: "0A1F35" }, line: { color: "7C3AED", width: 1.2 } });
    sl.addShape("rect", { x: 5.1, y: 1.42, w: 4.55, h: 0.6, fill: { color: "7C3AED" }, line: { color: "7C3AED", width: 0 } });

    sl.addText("WEEKS 4+", { x: 5.25, y: 1.47, w: 2.5, h: 0.2, fontFace: "Calibri", fontSize: 9, bold: true, color: "D0EAF5", margin: 0 });
    sl.addShape("rect", { x: 7.95, y: 1.49, w: 1.55, h: 0.26, fill: { color: "7C3AED" }, line: { color: "A78BFA", width: 1 } });
    sl.addText("GROW", { x: 7.95, y: 1.49, w: 1.55, h: 0.26, fontFace: "Calibri", fontSize: 8.5, bold: true, color: C.white, align: "center", valign: "middle", margin: 0 });
    sl.addText("Customization, Integration & Extension", {
      x: 5.25, y: 2.08, w: 4.2, h: 0.36,
      fontFace: "Georgia", fontSize: 13, bold: true, color: C.white, margin: 0,
    });

    const p2items = [
      "Customize loan products, fees, and repayment rules",
      "Integrate real KYC provider (Smile Identity for Myanmar)",
      "Extend mobile app — notifications, offline support",
      "Production deployment — cloud, monitoring, alerting",
      "New features based on MFI feedback and business needs",
    ];
    p2items.forEach((item, j) => {
      sl.addImage({ data: icons.arrow, x: 5.25, y: 2.55 + j * 0.49, w: 0.18, h: 0.18 });
      sl.addText(item, { x: 5.5, y: 2.52 + j * 0.49, w: 3.98, h: 0.42, fontFace: "Calibri", fontSize: 10.5, color: "C8E6F5" });
    });

    // ── bottom quote ──────────────────────────────────────────────────────
    sl.addText("Week 1 = understand the system.  Weeks 2–3 = make it run.  Week 4+ = make it yours.", {
      x: 0.6, y: 5.3, w: 8.8, h: 0.25,
      fontFace: "Calibri", fontSize: 10.5, italic: true, color: "4E8FA3", align: "center", margin: 0,
    });
  }

  // ─── write file ──────────────────────────────────────────────────────────
  const outPath = path.join(__dirname, "..", "MifosX4MM-Team-Overview.pptx");
  await pres.writeFile({ fileName: outPath });
  console.log("✅  Written:", outPath);
}

main().catch(err => { console.error(err); process.exit(1); });
