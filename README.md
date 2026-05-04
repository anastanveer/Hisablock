<p align="center">
  <img src="./public/readme-banner.svg" alt="Money Control / Hisab Pro animated banner" width="100%" />
</p>

<h1 align="center">Money Control / Hisab Pro</h1>

<p align="center">
  Premium mobile-first personal finance control PWA for salary, expenses, debts, credit cards, installments, payments, and savings.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js" />
  <img src="https://img.shields.io/badge/TypeScript-Ready-3178C6?style=for-the-badge&logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/Tailwind-CSS-38BDF8?style=for-the-badge&logo=tailwindcss&logoColor=white" />
  <img src="https://img.shields.io/badge/PWA-Ready-10B981?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Supabase-PostgreSQL-3FCF8E?style=for-the-badge&logo=supabase&logoColor=white" />
</p>

---

## App Feel

Hisab Pro is designed like a simple mobile banking app, not a normal website.

| Dashboard | Money Tracking | Debt Control |
|---|---|---|
| Safe-to-spend card | Income and expenses | Credit cards, loans, Tabby |
| Cash visibility | Category filters | Payment progress |
| Monthly result | Shopping warnings | Upcoming dues |

## Main Formula

```txt
Safe to Spend = Current Cash - Upcoming 15 Days Payments - Survival Buffer
```

If safe-to-spend is below zero, the app shows a direct spending warning.

## Features

| Module | Included |
|---|---|
| Auth | Simple personal PIN login |
| Dashboard | Cash, income, expenses, debt, safe-to-spend |
| Income | Add, edit, delete, recurring option |
| Expenses | Categories, filters, payment method, notes |
| Debts | Remaining amount, monthly payment, due date, progress |
| Calendar | Today, week, month, overdue payments |
| Summary | Savings/loss, top categories, score out of 100 |
| Goals | Saving, debt, emergency goals |
| PWA | Installable on mobile home screen |

## Tech Stack

```txt
Next.js App Router
TypeScript
Tailwind CSS
Supabase PostgreSQL schema
Simple PIN login
LocalStorage offline-first persistence
PWA manifest + service worker
Vercel-ready deployment
```

## Project Structure

```txt
src/
  app/
    page.tsx          Main app UI and flows
    layout.tsx        Metadata and PWA config
    globals.css       Global theme
  components/
    ui.tsx            Reusable UI components
  lib/
    finance.ts        Finance calculations
    seed.ts           Demo data
    types.ts          TypeScript models
public/
  readme-banner.svg   Animated README hero
  manifest.webmanifest
  sw.js
  icon.svg
supabase/
  schema.sql
```

## Demo Data

| Item | Amount |
|---|---:|
| Salary | AED 8,000 |
| Current Cash | AED 4,247.56 |
| Sukuk Finance | AED 40,266.67 |
| ENBD Noon Card | AED 3,714.05 |
| Mastercard Titanium | AED 6,914.84 |
| Tabby Statement | AED 1,604.54 |
| Tabby Pay Later | AED 892.17 |
| Office Balance | AED 4,000 |

## Run Locally

```bash
npm install
npm run dev
```

Open:

```txt
http://localhost:3000
```

First launch:

```txt
Create your own PIN.
```

## Environment

```bash
cp .env.example .env.local
```

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

## Supabase Setup

1. Create a Supabase project.
2. Open SQL Editor.
3. Run `supabase/schema.sql`.
4. Add env values to `.env.local`.

Tables:

```txt
profiles
incomes
expenses
debts
payments
goals
settings
```

## Build

```bash
npm run build
```

## Deploy

```bash
npm run build
vercel
```

## PWA Install

| Platform | Steps |
|---|---|
| Android Chrome | Open URL -> Menu -> Add to Home screen |
| iPhone Safari | Open URL -> Share -> Add to Home Screen |

## Financial Score

Starts at `100`, then subtracts points for overspending, high shopping/gifts, missed payments, no savings, and low available cash.

| Score | Result |
|---:|---|
| 80-100 | Strong month |
| 60-79 | Controlled but needs improvement |
| 40-59 | Risky month |
| 0-39 | Serious spending problem |

## Roadmap

- Supabase Auth sync
- Multi-device backup
- Monthly PDF report
- Payment reminders
- Recurring debt auto-schedule
- Charts and trend insights
- CSV export
- Dark mode

## Commands

```bash
npm run dev
npm run build
npm run lint
```

## License

Personal project. Use and customize freely.
