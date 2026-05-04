<div align="center">

<!-- Animated Header -->
<img src="public/readme-banner.svg" width="100%" alt="HisabLock Banner" />

<!-- Badges -->
<p>
  <img src="https://img.shields.io/badge/Next.js-16.2-black?style=for-the-badge&logo=next.js&logoColor=white" />
  <img src="https://img.shields.io/badge/React-19.2-61DAFB?style=for-the-badge&logo=react&logoColor=black" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/Tailwind-4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" />
  <img src="https://img.shields.io/badge/Supabase-Ready-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white" />
  <img src="https://img.shields.io/badge/PWA-Installable-5A0FC8?style=for-the-badge&logo=pwa&logoColor=white" />
</p>

<br/>

> **HisabLock** — apna hisab khud rakho, kisi ko dikhane ki zaroorat nahi.  
> Mobile-first personal finance app with PIN lock, offline storage, and smart financial scoring.

<br/>

</div>

---

## What It Does

HisabLock is a **mobile-first PWA** that helps you track every dirham in and out — without the cloud, without subscriptions, and without excuses.

```
┌─────────────────────────────────────────────────────┐
│  💰 Income   →  Log salary, freelance, refunds       │
│  💸 Expenses →  Categorize every spend               │
│  🏦 Debts    →  Track loans, Tabby, credit cards     │
│  📅 Calendar →  Upcoming & overdue payment alerts    │
│  🎯 Goals    →  Savings, emergency fund, debt-free   │
│  📊 Summary  →  Financial health score out of 100    │
│  🔐 PIN Lock →  Your data, your eyes only            │
└─────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 16 App Router |
| UI | React 19 + Tailwind CSS 4 |
| Language | TypeScript 5 (strict) |
| Storage | `localStorage` (offline-first) |
| Database | Supabase PostgreSQL (schema ready) |
| Auth | PIN-based (client-side) |
| Deployment | Vercel + PWA installable |

---

## Features at a Glance

**Smart Financial Score**  
The app calculates a score (0–100) every month based on income vs expenses, shopping ratio, missed payments, and cash buffer. Scores range from *"Strong month"* to *"Serious spending problem"* — no sugarcoating.

**Safe to Spend**  
Real-time calculation: `Cash − Upcoming 15-day payments − Survival Buffer = What you can actually spend.`

**Debt Tracker**  
Manage loans, credit cards, Tabby, office deductions, family debts — with priority levels (high / medium / low) and monthly payment tracking.

**Payment Calendar**  
Never miss a due date. Payments are flagged as upcoming (7 or 15 days) or overdue — color-coded and sorted.

**Offline First**  
Everything saves to `localStorage` instantly. No internet required after first load.

---

## Quick Start

```bash
# Install dependencies
npm install

# Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

Demo data is preloaded. Set your PIN on first launch.

---

## Environment (Optional — Supabase)

```bash
cp .env.example .env.local
```

```env
NEXT_PUBLIC_SUPABASE_URL=your_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

---

## Supabase Setup

```sql
-- Run this in Supabase SQL Editor
-- File: supabase/schema.sql
```

1. Create a Supabase project
2. Open SQL Editor
3. Run `supabase/schema.sql`
4. Add env values to `.env.local`

The app works fully offline right now — Supabase sync is ready to wire in as the next layer.

---

## Deploy

```bash
npm run build
vercel
```

Add Supabase env vars in Vercel Project Settings if using Supabase.

---

## Install as App (PWA)

**Android Chrome** — open deployed URL → tap menu → *Add to Home Screen*

**iPhone Safari** — open deployed URL → tap Share → *Add to Home Screen*

---

## Project Structure

```
src/
├── app/
│   ├── page.tsx        # Full app — all tabs, sheets, state
│   ├── layout.tsx      # Root layout + metadata
│   └── globals.css     # Global styles
├── components/
│   └── ui.tsx          # Button, Card, Sheet, Input, ProgressBar…
└── lib/
    ├── types.ts        # Income, Expense, Debt, Payment, Goal, Settings
    ├── finance.ts      # All calculations (score, safe-to-spend, totals…)
    └── seed.ts         # Demo data preloaded on first launch
supabase/
└── schema.sql          # PostgreSQL schema matching app data model
```

---

<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=6,11,20&height=100&section=footer&animation=twinkling" width="100%" />

*Built with Next.js · Tailwind · TypeScript · Supabase*

</div>
