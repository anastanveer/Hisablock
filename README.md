# Money Control / Hisab Pro

Premium mobile-first personal finance control app for salary, expenses, debts, credit cards, installments, upcoming payments, and monthly savings.

Built for daily personal use with a simple banking-app feel.

![Next.js](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-Ready-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-38BDF8?style=for-the-badge&logo=tailwindcss&logoColor=white)
![PWA](https://img.shields.io/badge/PWA-Ready-10B981?style=for-the-badge)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3FCF8E?style=for-the-badge&logo=supabase&logoColor=white)

## Preview

Mobile banking style interface with:

- PIN login
- Safe-to-spend dashboard
- Income and expense tracking
- Debt and credit card tracker
- Upcoming payment calendar
- Monthly score and summary
- Savings/debt goals
- PWA install support

## Core Idea

Most finance apps are too complex for daily use. Hisab Pro focuses on one question:

> After my bills, debts, installments, and buffer, how much is actually safe to spend?

Formula:

```txt
Safe to Spend = Current Cash - Upcoming 15 Days Payments - Survival Buffer
```

If safe-to-spend is negative, the app warns the user immediately.

## Features

### Dashboard

- Current cash balance
- Monthly income
- Monthly expenses
- Total remaining debt
- Upcoming payments in 7 and 15 days
- Safe-to-spend card
- Debt progress
- Monthly saving/loss status

### Income

- Add, edit, delete income
- Salary, Fiverr, Upwork, client payment, refund, other
- Recurring income option
- Notes support

### Expenses

- Add, edit, delete expenses
- Category filters
- Today, week, month filters
- Warning for non-essential shopping and gifts
- Payment method support

### Debts

- Credit cards
- Loans
- Tabby/installments
- Office/family debts
- Monthly payment tracking
- Remaining balance progress
- Mark payment as paid

### Payment Calendar

- Due today
- This week
- This month
- Overdue
- Mark paid
- Link payment to debt

### Monthly Summary

- Total income
- Total expenses
- Debt paid
- Savings/loss
- Shopping/gifts total
- Top spending categories
- Financial score out of 100

### Goals

- Emergency fund
- Debt clearance
- Savings goals
- Deadline and progress tracking

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
    layout.tsx        Metadata, PWA config
    globals.css       Global theme
  components/
    ui.tsx            Reusable UI components
  lib/
    finance.ts        Finance calculations
    seed.ts           Demo data
    types.ts          TypeScript models
public/
  manifest.webmanifest
  sw.js
  icon.svg
supabase/
  schema.sql
```

## Demo Data

Included by default:

- Salary: AED 8,000
- Current cash: AED 4,247.56
- Sukuk Finance
- ENBD Noon Card
- Mastercard Titanium
- Tabby Statement
- Tabby Pay Later
- Office Balance
- Upcoming payments for May/June

## Getting Started

Install dependencies:

```bash
npm install
```

Run locally:

```bash
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

## Environment Variables

Create `.env.local`:

```bash
cp .env.example .env.local
```

Example:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

## Supabase Setup

1. Create a Supabase project.
2. Open SQL Editor.
3. Run:

```sql
-- See full schema:
supabase/schema.sql
```

Tables included:

- `profiles`
- `incomes`
- `expenses`
- `debts`
- `payments`
- `goals`
- `settings`

Current MVP stores data locally for instant personal use. The Supabase schema is ready for the next sync/auth layer.

## Build

```bash
npm run build
```

## Deploy on Vercel

```bash
npm run build
vercel
```

Add Supabase environment variables in Vercel if database sync is enabled.

## Install as PWA

Android Chrome:

```txt
Open app URL -> Menu -> Add to Home screen
```

iPhone Safari:

```txt
Open app URL -> Share -> Add to Home Screen
```

## Financial Score Logic

Starts from `100`, then subtracts points for:

- Overspending
- High shopping/gifts spending
- Missed payments
- No savings
- Low available cash

Score labels:

```txt
80-100  Strong month
60-79   Controlled but needs improvement
40-59   Risky month
0-39    Serious spending problem
```

## Roadmap

- Supabase Auth sync
- Multi-device backup
- Monthly PDF report
- Payment reminders
- Recurring debt auto-schedule
- Charts and trend insights
- Export CSV
- Dark mode

## Commands

```bash
npm run dev
npm run build
npm run lint
```

## License

Personal project. Use and customize freely.
