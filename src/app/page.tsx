"use client";

import type { ChangeEvent, Dispatch, FormEvent, ReactNode, SetStateAction } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Card, Field, GhostButton, Input, ProgressBar, Select, Sheet, StatCard, Textarea } from "@/components/ui";
import { categoryTotals, daysFromNow, debtPaidThisMonth, dueTomorrow, financialScore, freeCashAfterRent, money, monthlyExpenses, monthlyIncome, overdue, recordDebtPayment, rentDue, safeCash, safeToSpend, scoreLabel, shoppingGiftTotal, sum, todayISO, totalDebt, uid, upcoming } from "@/lib/finance";
import { getRemoteStatus, getSupabase, loadRemoteState, remoteEnabled, saveRemoteState } from "@/lib/remote-state";
import { seedState } from "@/lib/seed";
import type { Debt, Expense, FinanceState, Goal, Income, Payment, PaymentHistory } from "@/lib/types";

const DATA_KEY = "hisab-pro-state-v1";
const BACKUP_KEY = "hisab-pro-state-backup-v1";
const PIN_KEY = "hisab-pro-pin";
const AUTH_KEY = "hisab-pro-unlocked-until";
const LAST_NOTIFY_KEY = "hisab-pro-last-notify";
const DB_NAME = "hisablock-finance-db";
const DB_STORE = "finance-state";
const DEFAULT_PIN = "1122";
const SESSION_MS = 30 * 24 * 60 * 60 * 1000;
const incomeSources = ["Salary", "Fiverr", "Upwork", "Client payment", "Refund", "Other"];
const expenseCategories = ["Rent", "Food", "Transport", "Mobile", "Family Support", "Shopping", "Wife/Gifts", "Debt Payment", "Office Deduction", "Emergency", "Other"];
const debtTypes = ["Credit Card", "Finance Loan", "Tabby / Installment", "Installment", "Office Loan", "family", "other"];
const paymentMethods = ["Cash", "Debit Card", "Credit Card", "Bank Transfer", "Other"];

type Tab = "Home" | "Add" | "Calendar" | "Debts" | "Summary";
type IconName = "home" | "plus" | "calendar" | "card" | "chart" | "income" | "expense" | "settings" | "sun" | "moon" | "wallet" | "bank" | "warning" | "crypto" | "office" | "check";
type SheetKind = "income" | "expense" | "debt" | "payment" | "goal" | "settings";

const navItems: { tab: Tab; icon: IconName }[] = [
  { tab: "Home", icon: "home" },
  { tab: "Calendar", icon: "calendar" },
  { tab: "Add", icon: "plus" },
  { tab: "Debts", icon: "card" },
  { tab: "Summary", icon: "chart" },
];

const demoIds = new Set([
  "account-main",
  "account-bank",
  "account-other",
  "asset-binance",
  "income-salary",
  "debt-sukuk",
  "debt-noon",
  "debt-mastercard",
  "debt-aafaq",
  "debt-tabby-statement",
  "debt-tabby-later",
  "debt-office",
  "pay-rent-may",
  "pay-mastercard-may",
  "pay-noon-may",
  "pay-office-may",
  "pay-sukuk-may",
  "pay-tabby-statement",
  "pay-tabby-2-june",
  "pay-tabby-8-june",
  "pay-tabby-23-june",
  "goal-emergency",
  "goal-tabby",
]);

const removeDemo = <T extends { id: string }>(items?: T[]) => (items || []).filter((item) => !demoIds.has(item.id));

const mergeById = <T extends { id: string }>(base: T[], saved?: T[]) => {
  const items = new Map(base.map((item) => [item.id, item]));
  saved?.forEach((item) => items.set(item.id, { ...items.get(item.id), ...item }));
  return [...items.values()];
};

const stateSignature = (value: FinanceState) => JSON.stringify(value);

const normalizeState = (value?: Partial<FinanceState> | null): FinanceState => {
  if (!value || typeof value !== "object") return seedState;
  const addRealDefaults = (value.settings?.profile_version || 0) < seedState.settings.profile_version;
  return {
    ...seedState,
    ...value,
    current_cash: addRealDefaults && !value.current_cash ? seedState.current_cash : value.current_cash ?? seedState.current_cash,
    cash_accounts: mergeById(seedState.cash_accounts, removeDemo(value.cash_accounts)),
    assets: addRealDefaults ? mergeById(seedState.assets, removeDemo(value.assets)) : removeDemo(value.assets),
    incomes: addRealDefaults ? mergeById(seedState.incomes, removeDemo(value.incomes)) : removeDemo(value.incomes),
    expenses: removeDemo(value.expenses),
    debts: addRealDefaults ? mergeById(seedState.debts, removeDemo(value.debts)) : removeDemo(value.debts),
    payments: addRealDefaults ? mergeById(seedState.payments, removeDemo(value.payments)) : removeDemo(value.payments),
    payment_history: value.payment_history || [],
    goals: addRealDefaults ? mergeById(seedState.goals, removeDemo(value.goals)) : removeDemo(value.goals),
    settings: {
      ...seedState.settings,
      ...value.settings,
      profile_version: seedState.settings.profile_version,
    },
  };
};

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char] || char);

const notifyDuePayments = (payments: Payment[], currency: string, force = false) => {
  if (typeof window === "undefined" || !("Notification" in window) || Notification.permission !== "granted") return;
  const due = payments.filter((payment) => payment.status !== "paid" && daysFromNow(payment.due_date) >= 0 && daysFromNow(payment.due_date) <= 1);
  if (!due.length) return;
  const key = `${todayISO()}:${due.map((payment) => payment.id).join(",")}`;
  if (!force && localStorage.getItem(LAST_NOTIFY_KEY) === key) return;
  localStorage.setItem(LAST_NOTIFY_KEY, key);
  const first = due[0];
  const label = daysFromNow(first.due_date) === 0 ? "today" : "tomorrow";
  new Notification("HisabLock Payment Reminder", {
    body: `${first.title}: ${money(first.amount, currency)} due ${label}${due.length > 1 ? ` +${due.length - 1} more` : ""}`,
    tag: "hisablock-payment-reminder",
  });
};

const openFinanceDb = () =>
  new Promise<IDBDatabase | null>((resolve) => {
    if (typeof indexedDB === "undefined") return resolve(null);
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });

const loadFromIndexedDb = async () => {
  const db = await openFinanceDb();
  if (!db) return null;
  return new Promise<FinanceState | null>((resolve) => {
    const request = db.transaction(DB_STORE, "readonly").objectStore(DB_STORE).get("current");
    request.onsuccess = () => {
      db.close();
      resolve(request.result?.state ? normalizeState(request.result.state) : null);
    };
    request.onerror = () => {
      db.close();
      resolve(null);
    };
  });
};

const saveToIndexedDb = async (state: FinanceState) => {
  const db = await openFinanceDb();
  if (!db) return;
  const tx = db.transaction(DB_STORE, "readwrite");
  tx.objectStore(DB_STORE).put({ id: "current", updated_at: new Date().toISOString(), state });
  tx.oncomplete = () => db.close();
  tx.onerror = () => db.close();
};

const loadFromLocalStorage = () => {
  const saved = localStorage.getItem(DATA_KEY) || localStorage.getItem(BACKUP_KEY);
  return saved ? normalizeState(JSON.parse(saved)) : null;
};

const saveFinanceState = (state: FinanceState) => {
  const payload = JSON.stringify(state);
  localStorage.setItem(DATA_KEY, payload);
  localStorage.setItem(BACKUP_KEY, payload);
  void saveToIndexedDb(state);
};

const applyCashDelta = (state: FinanceState, delta: number): FinanceState => ({
  ...state,
  current_cash: state.current_cash + delta,
  cash_accounts: state.cash_accounts?.length
    ? state.cash_accounts.map((account, index, accounts) =>
        index === accounts.length - 1 ? { ...account, amount: account.amount + delta } : account,
      )
    : state.cash_accounts,
});

export default function Home() {
  const [state, setState] = useState<FinanceState>(seedState);
  const [hydrated, setHydrated] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [hasPin, setHasPin] = useState(false);
  const [pin, setPin] = useState("");
  const [tab, setTab] = useState<Tab>("Home");
  const [sheet, setSheet] = useState<{ kind: SheetKind; id?: string } | null>(null);
  const [expenseFilter, setExpenseFilter] = useState("This month");
  const [remoteReady, setRemoteReady] = useState(false);
  const [syncStatus, setSyncStatus] = useState("Checking sync...");
  const remoteSignature = useRef("");
  const cloudPullTimer = useRef<number | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      let next = seedState;
      try {
        next = (await loadRemoteState()) || loadFromLocalStorage() || (await loadFromIndexedDb()) || seedState;
      } catch {
        next = (await loadFromIndexedDb()) || seedState;
      }
      if (!active) return;
      setState(next);
      saveFinanceState(next);
      getRemoteStatus().then((status) => {
        if (active) setSyncStatus(status.label);
      });
      remoteSignature.current = stateSignature(next);
      setRemoteReady(true);
      if (!localStorage.getItem(PIN_KEY)) localStorage.setItem(PIN_KEY, DEFAULT_PIN);
      setHasPin(Boolean(localStorage.getItem(PIN_KEY)));
      setAuthed(Number(localStorage.getItem(AUTH_KEY) || 0) > Date.now());
      if ("serviceWorker" in navigator) {
        if (process.env.NODE_ENV === "production") {
          navigator.serviceWorker.register("/sw.js").catch(() => undefined);
        } else {
          navigator.serviceWorker.getRegistrations().then((items) => items.forEach((item) => item.unregister()));
          caches?.keys().then((keys) => keys.forEach((key) => caches.delete(key)));
        }
      }
      setHydrated(true);
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (hydrated) saveFinanceState(state);
  }, [hydrated, state]);

  useEffect(() => {
    if (!hydrated || !remoteReady) return;
    const signature = stateSignature(state);
    if (remoteSignature.current === signature) return;
    remoteSignature.current = signature;
    void saveRemoteState(state);
  }, [hydrated, remoteReady, state]);

  useEffect(() => {
    const client = getSupabase();
    if (!client) return;
    const pullRemote = () => {
      if (cloudPullTimer.current) window.clearTimeout(cloudPullTimer.current);
      cloudPullTimer.current = window.setTimeout(async () => {
        const remote = await loadRemoteState();
        if (!remote) return;
        const signature = stateSignature(remote);
        if (remoteSignature.current === signature) return;
        remoteSignature.current = signature;
        setState(remote);
        getRemoteStatus().then((status) => setSyncStatus(status.label));
      }, 250);
    };
    const channel = client
      .channel("finance-cloud-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "app_state", filter: "id=eq.default" }, (payload) => {
        const remote = payload.new && "state" in payload.new ? (payload.new.state as FinanceState) : null;
        if (!remote) return;
        const next = normalizeState(remote);
        const signature = stateSignature(next);
        if (remoteSignature.current === signature) return;
        remoteSignature.current = signature;
        setState(next);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "accounts" }, pullRemote)
      .on("postgres_changes", { event: "*", schema: "public", table: "assets" }, pullRemote)
      .on("postgres_changes", { event: "*", schema: "public", table: "incomes" }, pullRemote)
      .on("postgres_changes", { event: "*", schema: "public", table: "expenses" }, pullRemote)
      .on("postgres_changes", { event: "*", schema: "public", table: "debts" }, pullRemote)
      .on("postgres_changes", { event: "*", schema: "public", table: "payments" }, pullRemote)
      .on("postgres_changes", { event: "*", schema: "public", table: "payment_history" }, pullRemote)
      .on("postgres_changes", { event: "*", schema: "public", table: "app_settings" }, pullRemote)
      .subscribe();
    const interval = window.setInterval(pullRemote, 8000);
    return () => {
      window.clearInterval(interval);
      if (cloudPullTimer.current) window.clearTimeout(cloudPullTimer.current);
      void client.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (hydrated && authed) notifyDuePayments(state.payments, state.settings.currency);
  }, [authed, hydrated, state.payments, state.settings.currency]);

  const currency = state.settings.currency;
  const isDark = state.settings.theme === "dark";
  const availableCash = safeCash(state);
  const income = monthlyIncome(state);
  const expenses = monthlyExpenses(state);
  const debt = totalDebt(state.debts);
  const upcoming7 = upcoming(state.payments, 7);
  const upcoming15 = upcoming(state.payments, 15);
  const rentAmount = rentDue(state);
  const freeAfterRent = freeCashAfterRent(state);
  const upcoming7Total = sum(upcoming7.filter((payment) => payment.category !== "Rent"), (p) => p.amount);
  const upcoming15Total = sum(upcoming15.filter((payment) => payment.category !== "Rent"), (p) => p.amount);
  const safe = safeToSpend(state);
  const score = financialScore(state);
  const nextPayment = [...state.payments]
    .filter((p) => p.status !== "paid" && new Date(p.due_date).getTime() >= new Date(todayISO()).getTime())
    .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())[0];
  const binanceAsset = state.assets.find((asset) => asset.id === "asset-binance");

  const filteredExpenses = useMemo(() => {
    const now = new Date();
    return state.expenses.filter((expense) => {
      const date = new Date(expense.expense_date);
      if (expenseFilter === "Today") return expense.expense_date === todayISO();
      if (expenseFilter === "This week") return (now.getTime() - date.getTime()) / 86400000 <= 7;
      if (expenseFilter === "This month") return now.getMonth() === date.getMonth() && now.getFullYear() === date.getFullYear();
      return expense.category === expenseFilter;
    });
  }, [expenseFilter, state.expenses]);

  function login(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const saved = localStorage.getItem(PIN_KEY);
    if (!saved && pin.length >= 4) {
      localStorage.setItem(PIN_KEY, pin);
      localStorage.setItem(AUTH_KEY, String(Date.now() + SESSION_MS));
      setHasPin(true);
      setAuthed(true);
    }
    if (saved === pin) {
      localStorage.setItem(AUTH_KEY, String(Date.now() + SESSION_MS));
      setAuthed(true);
    }
  }

  async function enableNotifications() {
    if (!("Notification" in window)) {
      alert("Notifications are not supported on this device/browser.");
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission === "granted") notifyDuePayments(state.payments, currency, true);
  }

  function exportMonthlyPdf() {
    const month = new Date().toLocaleString("en-AE", { month: "long", year: "numeric" });
    const categories = categoryTotals(state.expenses).slice(0, 5);
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<!doctype html><html><head><title>HisabLock ${escapeHtml(month)}</title><style>
      body{font-family:Arial,sans-serif;margin:0;padding:28px;color:#0f172a;background:#f8fafc}
      .page{max-width:760px;margin:auto;background:white;border-radius:22px;padding:28px;box-shadow:0 18px 60px #dbe3ee}
      h1{margin:0;font-size:30px}.muted{color:#64748b}.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin:20px 0}
      .box{border:1px solid #e2e8f0;border-radius:16px;padding:14px}.label{font-size:12px;color:#64748b;font-weight:700}.value{font-size:22px;font-weight:900;margin-top:5px}
      table{width:100%;border-collapse:collapse;margin-top:14px}td,th{border-bottom:1px solid #e2e8f0;padding:10px;text-align:left;font-size:13px}th{color:#64748b}
      .red{color:#ef4444}.green{color:#10b981}.amber{color:#b45309}@media print{body{background:white;padding:0}.page{box-shadow:none;border-radius:0}}
    </style></head><body><div class="page">
      <p class="muted">HisabLock Monthly Record</p><h1>${escapeHtml(month)}</h1>
      <div class="grid">
        <div class="box"><div class="label">Current Cash</div><div class="value">${money(availableCash, currency)}</div></div>
        <div class="box"><div class="label">Reserved Rent</div><div class="value amber">${money(rentAmount, currency)}</div></div>
        <div class="box"><div class="label">Safe To Spend</div><div class="value red">${money(safe, currency)}</div></div>
        <div class="box"><div class="label">Total Debt</div><div class="value red">${money(debt, currency)}</div></div>
        <div class="box"><div class="label">Income</div><div class="value green">${money(income, currency)}</div></div>
        <div class="box"><div class="label">Expenses</div><div class="value red">${money(expenses, currency)}</div></div>
      </div>
      <h2>Payments</h2><table><tr><th>Title</th><th>Due</th><th>Status</th><th>Amount</th></tr>${state.payments.map((p) => `<tr><td>${escapeHtml(p.title)}</td><td>${p.due_date}</td><td>${p.status}</td><td>${money(p.amount, currency)}</td></tr>`).join("")}</table>
      <h2>Debts</h2><table><tr><th>Name</th><th>Type</th><th>Priority</th><th>Remaining</th></tr>${state.debts.map((d) => `<tr><td>${escapeHtml(d.title)}</td><td>${escapeHtml(d.debt_type)}</td><td>${d.priority}</td><td>${money(d.remaining_amount, currency)}</td></tr>`).join("")}</table>
      <h2>Top Categories</h2><table><tr><th>Category</th><th>Total</th></tr>${categories.map(([name, value]) => `<tr><td>${escapeHtml(name)}</td><td>${money(value, currency)}</td></tr>`).join("") || "<tr><td>No expenses</td><td>AED 0.00</td></tr>"}</table>
    </div><script>window.print()</script></body></html>`);
    win.document.close();
  }

  function resetData() {
    saveFinanceState(seedState);
    setState(seedState);
  }

  function toggleTheme() {
    setState((s) => ({ ...s, settings: { ...s.settings, theme: s.settings.theme === "dark" ? "light" : "dark" } }));
  }

  function deleteRecord(kind: SheetKind, id: string) {
    setState((s) => {
      if (kind === "income") {
        const item = s.incomes.find((i) => i.id === id);
        return { ...applyCashDelta(s, -(item?.amount || 0)), incomes: s.incomes.filter((i) => i.id !== id) };
      }
      if (kind === "expense") {
        const item = s.expenses.find((i) => i.id === id);
        return { ...applyCashDelta(s, item?.amount || 0), expenses: s.expenses.filter((i) => i.id !== id) };
      }
      if (kind === "debt") return { ...s, debts: s.debts.filter((d) => d.id !== id), payments: s.payments.filter((p) => p.debt_id !== id) };
      if (kind === "payment") return { ...s, payments: s.payments.filter((p) => p.id !== id) };
      if (kind === "goal") return { ...s, goals: s.goals.filter((g) => g.id !== id) };
      return s;
    });
  }

  function markPaymentPaid(payment: Payment) {
    if (payment.status === "paid") return;
    setState((s) => payment.debt_id ? recordDebtPayment(s, payment.debt_id, payment.id, payment.amount) : {
      ...applyCashDelta(s, -payment.amount),
      payments: s.payments.map((p) => (p.id === payment.id ? { ...p, status: "paid", paid_date: todayISO() } : p)),
    });
  }

  function payDebtInstallment(debtItem: Debt) {
    const amount = debtItem.monthly_payment || debtItem.remaining_amount;
    setState((s) => recordDebtPayment(s, debtItem.id, undefined, amount));
  }

  if (!authed) {
    return (
    <main className={`${isDark ? "dark" : ""} min-w-0 overflow-x-hidden flex min-h-dvh items-center justify-center bg-[#F3F6FA] px-5 dark:bg-slate-950`}>
        <Card className="w-full max-w-sm p-6">
          <div className="mb-8">
            <p className="text-sm font-semibold text-emerald-600">HisabLock</p>
            <h1 className="mt-2 text-3xl font-black text-slate-950 dark:text-white">Unlock your money plan</h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{hasPin ? "Enter your PIN" : "PIN is 1122 by default"}</p>
          </div>
          <form className="grid gap-4" onSubmit={login}>
            <Input inputMode="numeric" minLength={4} maxLength={8} type="password" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="PIN" required />
            <Button>{hasPin ? "Unlock HisabLock" : "Create PIN"}</Button>
          </form>
        </Card>
      </main>
    );
  }

  return (
    <main className={`${isDark ? "dark" : ""} min-h-dvh min-w-0 overflow-x-hidden bg-[#F5F7FB] text-slate-950 dark:bg-[radial-gradient(circle_at_top,#064E3B_0,#020617_42%,#0F172A_100%)] dark:text-white`}>
      <div className="mx-auto min-h-dvh w-full max-w-md min-w-0 overflow-x-hidden bg-[linear-gradient(180deg,#FFFFFF_0%,#F3F7FB_48%,#EEF4F8_100%)] pb-[calc(10rem+env(safe-area-inset-bottom))] shadow-2xl dark:bg-[linear-gradient(180deg,#07131F_0%,#020617_100%)] md:my-6 md:min-h-[900px] md:overflow-hidden md:rounded-[34px]">
        <header className="sticky top-0 z-20 bg-white/75 px-5 pb-3 pt-[calc(1.1rem+env(safe-area-inset-top))] backdrop-blur-2xl dark:bg-slate-950/70">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-600">HisabLock</p>
              <h1 className="text-2xl font-black tracking-tight">Good evening</h1>
              <p className="mt-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-300">{syncStatus}</p>
            </div>
            <div className="flex gap-2">
              <button className="grid h-11 w-11 place-items-center rounded-2xl bg-white text-slate-900 shadow-[0_10px_28px_rgba(15,23,42,0.10)] dark:bg-white/10 dark:text-white" onClick={toggleTheme} aria-label="Toggle theme">
                <Icon name={isDark ? "sun" : "moon"} />
              </button>
              <button className="grid h-11 w-11 place-items-center rounded-2xl bg-white text-slate-900 shadow-[0_10px_28px_rgba(15,23,42,0.10)] dark:bg-white/10 dark:text-white" onClick={() => setSheet({ kind: "settings" })} aria-label="Settings">
                <Icon name="settings" />
              </button>
            </div>
          </div>
        </header>

        <div className="grid min-w-0 gap-4 overflow-x-hidden px-5 pb-[calc(11rem+env(safe-area-inset-bottom))] pt-4">
          {tab === "Home" && (
            <>
              <Card className="overflow-hidden !bg-[linear-gradient(145deg,#111827_0%,#020617_100%)] p-5 !text-white ring-1 ring-white/40 dark:!bg-slate-900">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-300">Current Cash</p>
                    <p className="mt-2 text-4xl font-black tracking-tight">{money(availableCash, currency)}</p>
                    <p className="mt-3 text-sm text-slate-300">Salary {money(8000, currency)}/month</p>
                  </div>
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-400 text-slate-950 shadow-[0_14px_34px_rgba(16,185,129,0.32)]">
                    <Icon name="wallet" />
                  </span>
                </div>
                <div className="mt-5 grid gap-2">
                  {state.cash_accounts.map((account) => (
                    <div key={account.id} className="flex items-center justify-between rounded-2xl bg-white/[0.08] px-3 py-2 text-sm">
                      <span className="text-slate-300">{account.title}</span>
                      <span className="font-black">{money(account.amount, currency)}</span>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="border-emerald-100 bg-white p-4 dark:border-emerald-500/15 dark:bg-emerald-500/10">
                <div className="grid min-w-0 grid-cols-2 gap-3">
                  <Mini label="Reserved for Rent" value={money(rentAmount, currency)} />
                  <Mini label="Free After Rent" value={money(freeAfterRent, currency)} />
                </div>
                <p className="mt-3 rounded-2xl bg-amber-100 px-3 py-2 text-sm font-black text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">Rent must be paid first</p>
              </Card>

              <Card className={`${safe < 100 ? "!bg-red-600 !text-white" : safe < 500 ? "!bg-amber-500 !text-white" : "!bg-white !text-slate-950 dark:!bg-slate-900 dark:!text-white"} p-5`}>
                <p className="text-sm font-semibold opacity-75">Safe to Spend</p>
                <p className="mt-2 text-4xl font-black tracking-tight">{money(safe, currency)}</p>
                <p className="mt-3 text-sm opacity-85">{safe < 100 ? "Your available cash is already reserved for rent. Do not spend extra." : "After rent, 15 day payments and AED 500 buffer."}</p>
              </Card>

              {safe >= 100 && upcoming15Total + rentAmount > availableCash && <Alert text="Upcoming payments are greater than your available cash." tone="red" />}

              <Card className="border-red-100 bg-white p-5 dark:border-red-500/15 dark:bg-red-500/10">
                <p className="text-sm font-bold text-slate-500 dark:text-slate-400">Total Pending Debt</p>
                <p className="mt-2 text-4xl font-black tracking-tight text-red-600 dark:text-red-300">{money(debt, currency)}</p>
                <div className="mt-4">
                  <Mini label="Debt Reduced This Month" value={money(debtPaidThisMonth(state), currency)} />
                </div>
              </Card>

              <div className="grid min-w-0 grid-cols-2 gap-3">
                <StatCard label="Upcoming 7 days" value={money(upcoming7Total, currency)} tone="amber" />
                <StatCard label="Upcoming 15 days" value={money(upcoming15Total, currency)} tone="amber" />
                <StatCard label="Total Debt" value={money(debt, currency)} tone="red" />
                <StatCard label="Binance Asset" value={`${binanceAsset?.amount || 0} USDT`} tone="green" />
              </div>

              {binanceAsset && <AssetCard title={binanceAsset.title} value={`${binanceAsset.amount} ${binanceAsset.currency}`} note="Asset only, not included in Safe to Spend." />}

              {nextPayment && (
                <Card className="border-amber-200 bg-amber-50/90 dark:border-amber-500/20 dark:bg-amber-500/10">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.12em] text-amber-600 dark:text-amber-300">Next payment</p>
                      <h2 className="mt-1 text-lg font-black text-slate-950 dark:text-white">{nextPayment.title}</h2>
                      <p className="text-sm text-slate-500 dark:text-slate-400">Due {nextPayment.due_date}</p>
                    </div>
                    <p className="text-right text-xl font-black text-amber-600 dark:text-amber-300">{money(nextPayment.amount, currency)}</p>
                  </div>
                </Card>
              )}

              <Card>
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold">Debt Progress</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{money(debt, currency)} remaining</p>
                  </div>
                  <p className="text-sm font-black">{Math.round(100 - (debt / Math.max(1, sum(state.debts, (d) => d.total_amount))) * 100)}%</p>
                </div>
                <ProgressBar value={100 - (debt / Math.max(1, sum(state.debts, (d) => d.total_amount))) * 100} />
              </Card>

              <div className="grid min-w-0 grid-cols-4 gap-2">
                <Quick icon="income" label="Income" onClick={() => setSheet({ kind: "income" })} />
                <Quick icon="expense" label="Expense" onClick={() => setSheet({ kind: "expense" })} />
                <Quick icon="card" label="Debt" onClick={() => setSheet({ kind: "debt" })} />
                <Quick icon="calendar" label="Pay" onClick={() => setSheet({ kind: "payment" })} />
              </div>

              <Card>
                <h2 className="mb-2 text-base font-bold">This Month</h2>
                <p className={`text-2xl font-black ${income - expenses >= 0 ? "text-emerald-600" : "text-red-600"}`}>{money(income - expenses, currency)}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">{income - expenses >= 0 ? "Saving this month" : "Loss this month"}</p>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <Mini label="Debt Paid" value={money(debtPaidThisMonth(state), currency)} />
                  <Mini label="Debt Remaining" value={money(debt, currency)} />
                </div>
              </Card>

              <Card className="!bg-white !text-slate-950 dark:!bg-slate-900 dark:!text-white">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-base font-bold">Upcoming Payments</h2>
                  <button className="text-xs font-black text-emerald-600" onClick={() => setTab("Calendar")}>View all</button>
                </div>
                <ListPayments payments={upcoming15.slice(0, 3)} currency={currency} onPaid={markPaymentPaid} onEdit={(id) => setSheet({ kind: "payment", id })} />
              </Card>
            </>
          )}

          {tab === "Add" && (
            <>
              <Card>
                <h2 className="mb-3 text-lg font-black">Quick Add</h2>
                <div className="grid gap-3">
                  <Button onClick={() => setSheet({ kind: "income" })}>Add Income</Button>
                  <Button className="bg-red-600" onClick={() => setSheet({ kind: "expense" })}>Add Expense</Button>
                  <Button className="bg-amber-500" onClick={() => setSheet({ kind: "debt" })}>Add Debt</Button>
                  <Button className="bg-emerald-600" onClick={() => setSheet({ kind: "payment" })}>Add Payment</Button>
                </div>
              </Card>
              <Card>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-base font-bold">Income</h2>
                  <button className="text-sm font-bold text-emerald-600" onClick={() => setSheet({ kind: "income" })}>Add</button>
                </div>
                <TransactionList items={state.incomes} type="income" currency={currency} onEdit={(id) => setSheet({ kind: "income", id })} onDelete={(id) => deleteRecord("income", id)} />
              </Card>
              <Card>
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h2 className="text-base font-bold">Expenses</h2>
                  <FilterDropdown value={expenseFilter} options={["Today", "This week", "This month", ...expenseCategories]} onChange={setExpenseFilter} />
                </div>
                <TransactionList items={filteredExpenses} type="expense" currency={currency} onEdit={(id) => setSheet({ kind: "expense", id })} onDelete={(id) => deleteRecord("expense", id)} />
              </Card>
            </>
          )}

          {tab === "Calendar" && (
            <>
              <SectionTitle title="Payment Calendar" action="Add" onClick={() => setSheet({ kind: "payment" })} />
              <PaymentGroup title="Overdue" payments={overdue(state.payments)} currency={currency} onPaid={markPaymentPaid} onEdit={(id) => setSheet({ kind: "payment", id })} onDelete={(id) => deleteRecord("payment", id)} />
              <PaymentGroup title="Due today" payments={state.payments.filter((p) => p.status !== "paid" && p.due_date === todayISO())} currency={currency} onPaid={markPaymentPaid} onEdit={(id) => setSheet({ kind: "payment", id })} onDelete={(id) => deleteRecord("payment", id)} />
              <PaymentGroup title="Due tomorrow" payments={dueTomorrow(state.payments)} currency={currency} onPaid={markPaymentPaid} onEdit={(id) => setSheet({ kind: "payment", id })} onDelete={(id) => deleteRecord("payment", id)} />
              <PaymentGroup title="This week" payments={upcoming(state.payments, 7)} currency={currency} onPaid={markPaymentPaid} onEdit={(id) => setSheet({ kind: "payment", id })} onDelete={(id) => deleteRecord("payment", id)} />
              <PaymentGroup title="This month" payments={state.payments.filter((p) => p.status !== "paid" && new Date(p.due_date).getMonth() === new Date().getMonth())} currency={currency} onPaid={markPaymentPaid} onEdit={(id) => setSheet({ kind: "payment", id })} onDelete={(id) => deleteRecord("payment", id)} />
            </>
          )}

          {tab === "Debts" && (
            <>
              <SectionTitle title="Debt Tracker" action="Add" onClick={() => setSheet({ kind: "debt" })} />
              <StatCard label="Total debt remaining" value={money(debt, currency)} tone="amber" />
              {state.debts.map((item) => (
                <DebtCard key={item.id} item={item} currency={currency} onPay={() => payDebtInstallment(item)} onEdit={() => setSheet({ kind: "debt", id: item.id })} onDelete={() => deleteRecord("debt", item.id)} />
              ))}
            </>
          )}

          {tab === "Summary" && (
            <>
              <Card>
                <h2 className="mb-3 text-base font-bold">Monthly Records</h2>
                <div className="grid gap-3">
                  <Button type="button" onClick={exportMonthlyPdf}>Export monthly PDF</Button>
                  <GhostButton type="button" onClick={enableNotifications}>Enable payment reminders</GhostButton>
                </div>
                <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">{remoteEnabled ? "Cloud sync is active across browsers." : "Cloud sync needs Supabase env keys. Local backup is active."}</p>
              </Card>
              <Card>
                <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Financial Score</p>
                <p className="mt-1 text-5xl font-black">{score}</p>
                <p className="mt-1 text-sm font-bold text-emerald-600">{scoreLabel(score)}</p>
                <ProgressBar value={score} tone={score >= 80 ? "emerald" : score >= 60 ? "amber" : "red"} />
              </Card>
              <div className="grid min-w-0 grid-cols-2 gap-3">
                <StatCard label="Income" value={money(income, currency)} tone="green" />
                <StatCard label="Expenses" value={money(expenses, currency)} tone="red" />
                <StatCard label="Debt paid" value={money(debtPaidThisMonth(state), currency)} />
                <StatCard label="Shopping/Gifts" value={money(shoppingGiftTotal(state.expenses), currency)} tone="amber" />
              </div>
              <Card>
                <h2 className="mb-3 text-base font-bold">Top Categories</h2>
                <div className="grid gap-3">
                  {categoryTotals(state.expenses).slice(0, 5).map(([name, value]) => <Mini key={name} label={name} value={money(value, currency)} />)}
                  {!categoryTotals(state.expenses).length && <Empty text="No expenses yet." />}
                </div>
              </Card>
              <Card>
                <h2 className="mb-3 text-base font-bold">Debt Payment History</h2>
                <PaymentHistoryList items={state.payment_history || []} debts={state.debts} currency={currency} />
              </Card>
              <Card>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-base font-bold">Goals</h2>
                  <button className="text-sm font-bold text-emerald-600" onClick={() => setSheet({ kind: "goal" })}>Add</button>
                </div>
                <div className="grid gap-3">
                  {state.goals.map((goal) => <GoalCard key={goal.id} goal={goal} currency={currency} onEdit={() => setSheet({ kind: "goal", id: goal.id })} onDelete={() => deleteRecord("goal", goal.id)} />)}
                </div>
              </Card>
            </>
          )}
        </div>

        <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-md min-w-0 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-8 md:bottom-6">
          <div className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-32 bg-gradient-to-t from-[#EEF4F8] via-[#EEF4F8]/90 to-transparent dark:from-[#020617] dark:via-[#020617]/90" />
          <div className="grid h-[76px] grid-cols-5 items-end gap-1 rounded-[30px] border border-white/70 bg-white/95 p-2 shadow-[0_20px_55px_rgba(15,23,42,0.20)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/[0.94] dark:shadow-[0_22px_70px_rgba(0,0,0,0.45)]">
            {navItems.map((item) => {
              const active = tab === item.tab;
              const isAdd = item.tab === "Add";
              return (
                <button
                  key={item.tab}
                  onClick={() => setTab(item.tab)}
                  className={`relative flex min-w-0 flex-col items-center justify-center gap-1 rounded-2xl text-[11px] font-black transition active:scale-95 ${isAdd ? "-mt-8 h-[88px]" : "h-14"} ${active ? "text-slate-950 dark:text-white" : "text-slate-400 dark:text-slate-500"}`}
                >
                  <span className={`grid place-items-center ${isAdd ? "h-16 w-16 rounded-full bg-emerald-500 text-white shadow-[0_16px_34px_rgba(16,185,129,0.48)] ring-4 ring-[#F3F6FA] dark:ring-slate-950" : `h-8 w-8 rounded-2xl ${active ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950" : "bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-400"}`}`}>
                    <Icon name={item.icon} />
                  </span>
                  <span>{item.tab}</span>
                </button>
              );
            })}
          </div>
        </nav>
      </div>
      {sheet && <FinanceSheet sheet={sheet} state={state} setState={setState} close={() => setSheet(null)} resetData={resetData} />}
    </main>
  );
}

function FinanceSheet({ sheet, state, setState, close, resetData }: { sheet: { kind: SheetKind; id?: string }; state: FinanceState; setState: Dispatch<SetStateAction<FinanceState>>; close: () => void; resetData: () => void }) {
  const currency = state.settings.currency;
  const income = state.incomes.find((i) => i.id === sheet.id);
  const expense = state.expenses.find((i) => i.id === sheet.id);
  const debt = state.debts.find((i) => i.id === sheet.id);
  const payment = state.payments.find((i) => i.id === sheet.id);
  const goal = state.goals.find((i) => i.id === sheet.id);

  function saveIncome(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const next: Income = {
      id: income?.id || uid(),
      title: String(data.get("title")),
      amount: Number(data.get("amount")),
      source: String(data.get("source")),
      income_date: String(data.get("date")),
      is_recurring: data.get("recurring") === "on",
      notes: String(data.get("notes") || ""),
    };
    setState((s) => ({ ...applyCashDelta(s, -(income?.amount || 0) + next.amount), incomes: income ? s.incomes.map((i) => (i.id === next.id ? next : i)) : [next, ...s.incomes] }));
    close();
  }

  function saveExpense(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const category = String(data.get("category"));
    if (["Shopping", "Wife/Gifts"].includes(category) && !confirm("This is not a necessary expense. Are you sure you want to add it?")) return;
    const next: Expense = {
      id: expense?.id || uid(),
      title: String(data.get("title")),
      amount: Number(data.get("amount")),
      category,
      expense_date: String(data.get("date")),
      payment_method: String(data.get("method")),
      notes: String(data.get("notes") || ""),
    };
    setState((s) => ({ ...applyCashDelta(s, (expense?.amount || 0) - next.amount), expenses: expense ? s.expenses.map((i) => (i.id === next.id ? next : i)) : [next, ...s.expenses] }));
    close();
  }

  function saveDebt(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const next: Debt = {
      id: debt?.id || uid(),
      title: String(data.get("title")),
      total_amount: Number(data.get("total")),
      remaining_amount: Number(data.get("remaining")),
      monthly_payment: Number(data.get("monthly")),
      due_date: String(data.get("due_date") || ""),
      due_day: Number(data.get("due_day") || 0) || undefined,
      priority: String(data.get("priority")) as Debt["priority"],
      debt_type: String(data.get("type")),
      status: String(data.get("status")) as Debt["status"],
      notes: String(data.get("notes") || ""),
    };
    setState((s) => ({ ...s, debts: debt ? s.debts.map((i) => (i.id === next.id ? next : i)) : [next, ...s.debts] }));
    close();
  }

  function savePayment(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const next: Payment = {
      id: payment?.id || uid(),
      debt_id: String(data.get("debt_id") || "") || undefined,
      title: String(data.get("title")),
      amount: Number(data.get("amount")),
      due_date: String(data.get("due_date")),
      paid_date: payment?.paid_date,
      status: String(data.get("status")) as Payment["status"],
      category: String(data.get("category") || ""),
      priority: String(data.get("priority") || "medium") as Payment["priority"],
      balance_before: payment?.balance_before,
      balance_after: payment?.balance_after,
      is_recurring: data.get("recurring") === "on",
      recurring_day: Number(data.get("recurring_day") || 0) || undefined,
      reminder_day: Number(data.get("reminder_day") || 0) || undefined,
      notes: String(data.get("notes") || ""),
    };
    setState((s) => {
      if (!payment && next.status === "paid" && next.debt_id) {
        return recordDebtPayment({ ...s, payments: [next, ...s.payments] }, next.debt_id, next.id, next.amount);
      }
      return { ...s, payments: payment ? s.payments.map((i) => (i.id === next.id ? next : i)) : [next, ...s.payments] };
    });
    close();
  }

  function saveGoal(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const next: Goal = {
      id: goal?.id || uid(),
      title: String(data.get("title")),
      target_amount: Number(data.get("target")),
      current_amount: Number(data.get("current")),
      deadline: String(data.get("deadline")),
      goal_type: String(data.get("type")) as Goal["goal_type"],
      notes: String(data.get("notes") || ""),
    };
    setState((s) => ({ ...s, goals: goal ? s.goals.map((i) => (i.id === next.id ? next : i)) : [next, ...s.goals] }));
    close();
  }

  function saveSettings(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const cash = Number(data.get("cash"));
    setState((s) => ({
      ...s,
      current_cash: cash,
      cash_accounts: s.cash_accounts.map((account, index, accounts) =>
        index === accounts.length - 1 ? { ...account, amount: cash - sum(accounts.slice(0, -1), (item) => item.amount) } : account,
      ),
      settings: { survival_buffer: Number(data.get("buffer")), salary_day: Number(data.get("salary_day")), currency: String(data.get("currency")), theme: String(data.get("theme")) as FinanceState["settings"]["theme"], profile_version: seedState.settings.profile_version },
    }));
    close();
  }

  function exportBackup() {
    const blob = new Blob([JSON.stringify({ exported_at: new Date().toISOString(), state }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `hisablock-backup-${todayISO()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function importBackup(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const parsed = JSON.parse(await file.text());
    const restored = normalizeState(parsed.state || parsed);
    saveFinanceState(restored);
    setState(restored);
    e.target.value = "";
    alert("Backup restored.");
  }

  return (
    <Sheet title={sheet.kind === "settings" ? "Settings" : `${sheet.id ? "Edit" : "Add"} ${sheet.kind}`} onClose={close}>
      {sheet.kind === "income" && (
        <Form onSubmit={saveIncome}>
          <Field label="Title"><Input name="title" defaultValue={income?.title} required /></Field>
          <Field label="Amount"><Input name="amount" type="number" step="0.01" defaultValue={income?.amount} required /></Field>
          <Field label="Source"><Select name="source" defaultValue={income?.source}>{incomeSources.map((x) => <option key={x}>{x}</option>)}</Select></Field>
          <Field label="Date"><Input name="date" type="date" defaultValue={income?.income_date || todayISO()} required /></Field>
          <label className="flex items-center gap-2 text-sm font-semibold"><input name="recurring" type="checkbox" defaultChecked={income?.is_recurring} /> Recurring</label>
          <Field label="Notes"><Textarea name="notes" defaultValue={income?.notes} /></Field>
        </Form>
      )}
      {sheet.kind === "expense" && (
        <Form onSubmit={saveExpense}>
          <Field label="Title"><Input name="title" defaultValue={expense?.title} required /></Field>
          <Field label="Amount"><Input name="amount" type="number" step="0.01" defaultValue={expense?.amount} required /></Field>
          <Field label="Category"><Select name="category" defaultValue={expense?.category}>{expenseCategories.map((x) => <option key={x}>{x}</option>)}</Select></Field>
          <Field label="Date"><Input name="date" type="date" defaultValue={expense?.expense_date || todayISO()} required /></Field>
          <Field label="Payment method"><Select name="method" defaultValue={expense?.payment_method}>{paymentMethods.map((x) => <option key={x}>{x}</option>)}</Select></Field>
          <Field label="Notes"><Textarea name="notes" defaultValue={expense?.notes} /></Field>
        </Form>
      )}
      {sheet.kind === "debt" && (
        <Form onSubmit={saveDebt}>
          <Field label="Title"><Input name="title" defaultValue={debt?.title} required /></Field>
          <Field label="Total amount"><Input name="total" type="number" step="0.01" defaultValue={debt?.total_amount} required /></Field>
          <Field label="Remaining amount"><Input name="remaining" type="number" step="0.01" defaultValue={debt?.remaining_amount} required /></Field>
          <Field label="Monthly payment"><Input name="monthly" type="number" step="0.01" defaultValue={debt?.monthly_payment || 0} required /></Field>
          <Field label="Due date"><Input name="due_date" type="date" defaultValue={debt?.due_date} /></Field>
          <Field label="Due day"><Input name="due_day" type="number" min="1" max="31" defaultValue={debt?.due_day} /></Field>
          <Field label="Priority"><Select name="priority" defaultValue={debt?.priority || "medium"}><option>critical</option><option>high</option><option>medium_high</option><option>medium</option><option>low</option></Select></Field>
          <Field label="Type"><Select name="type" defaultValue={debt?.debt_type}>{debtTypes.map((x) => <option key={x}>{x}</option>)}</Select></Field>
          <Field label="Status"><Select name="status" defaultValue={debt?.status || "active"}><option>active</option><option>paid</option></Select></Field>
          <Field label="Notes"><Textarea name="notes" defaultValue={debt?.notes} /></Field>
        </Form>
      )}
      {sheet.kind === "payment" && (
        <Form onSubmit={savePayment}>
          <Field label="Title"><Input name="title" defaultValue={payment?.title} required /></Field>
          <Field label="Amount"><Input name="amount" type="number" step="0.01" defaultValue={payment?.amount} required /></Field>
          <Field label="Due date"><Input name="due_date" type="date" defaultValue={payment?.due_date || todayISO()} required /></Field>
          <Field label="Linked debt"><Select name="debt_id" defaultValue={payment?.debt_id || ""}><option value="">None</option>{state.debts.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}</Select></Field>
          <Field label="Category"><Select name="category" defaultValue={payment?.category || "Other"}>{expenseCategories.map((x) => <option key={x}>{x}</option>)}</Select></Field>
          <Field label="Priority"><Select name="priority" defaultValue={payment?.priority || "medium"}><option>critical</option><option>high</option><option>medium_high</option><option>medium</option><option>low</option></Select></Field>
          <Field label="Status"><Select name="status" defaultValue={payment?.status || "unpaid"}><option>unpaid</option><option>paid</option><option>overdue</option></Select></Field>
          <div className="grid min-w-0 grid-cols-2 gap-3">
            <Field label="Recurring day"><Input name="recurring_day" type="number" min="1" max="31" defaultValue={payment?.recurring_day} /></Field>
            <Field label="Reminder day"><Input name="reminder_day" type="number" min="1" max="31" defaultValue={payment?.reminder_day} /></Field>
          </div>
          <label className="flex items-center gap-2 text-sm font-semibold"><input name="recurring" type="checkbox" defaultChecked={payment?.is_recurring} /> Monthly recurring</label>
          <Field label="Notes"><Textarea name="notes" defaultValue={payment?.notes} /></Field>
        </Form>
      )}
      {sheet.kind === "goal" && (
        <Form onSubmit={saveGoal}>
          <Field label="Title"><Input name="title" defaultValue={goal?.title} required /></Field>
          <Field label="Target amount"><Input name="target" type="number" step="0.01" defaultValue={goal?.target_amount} required /></Field>
          <Field label="Current amount"><Input name="current" type="number" step="0.01" defaultValue={goal?.current_amount || 0} required /></Field>
          <Field label="Deadline"><Input name="deadline" type="date" defaultValue={goal?.deadline || todayISO()} required /></Field>
          <Field label="Type"><Select name="type" defaultValue={goal?.goal_type || "saving"}><option>saving</option><option>debt</option><option>emergency</option></Select></Field>
          <Field label="Notes"><Textarea name="notes" defaultValue={goal?.notes} /></Field>
        </Form>
      )}
      {sheet.kind === "settings" && (
        <Form onSubmit={saveSettings}>
          <Field label="Current cash"><Input name="cash" type="number" step="0.01" defaultValue={state.current_cash} required /></Field>
          <Field label="Survival buffer"><Input name="buffer" type="number" step="0.01" defaultValue={state.settings.survival_buffer} required /></Field>
          <Field label="Salary day"><Input name="salary_day" type="number" min="1" max="31" defaultValue={state.settings.salary_day} required /></Field>
          <Field label="Currency"><Input name="currency" defaultValue={currency} required /></Field>
          <Field label="Theme"><Select name="theme" defaultValue={state.settings.theme}><option value="light">Light</option><option value="dark">Dark</option></Select></Field>
          <div className="grid gap-3 rounded-2xl bg-slate-50 p-3 dark:bg-white/[0.07]">
            <p className="text-sm font-black">Data safety</p>
            <GhostButton type="button" onClick={exportBackup}>Download backup</GhostButton>
            <label className="grid h-12 cursor-pointer place-items-center rounded-2xl bg-white px-4 text-sm font-black text-slate-950 shadow-[0_10px_24px_rgba(15,23,42,0.08)] ring-1 ring-slate-200 dark:bg-slate-950 dark:text-white dark:ring-white/10">
              Restore backup
              <input className="hidden" type="file" accept="application/json" onChange={importBackup} />
            </label>
          </div>
          <GhostButton type="button" onClick={resetData}>Reset to real starting data</GhostButton>
        </Form>
      )}
    </Sheet>
  );
}

function Form({ children, onSubmit }: { children: ReactNode; onSubmit: (e: FormEvent<HTMLFormElement>) => void }) {
  return <form className="grid min-w-0 gap-4 overflow-x-hidden" onSubmit={onSubmit}>{children}<Button>Save</Button></form>;
}

function Alert({ text, tone }: { text: string; tone: "red" | "amber" }) {
  return <div className={`rounded-2xl px-4 py-3 text-sm font-bold text-white ${tone === "red" ? "bg-red-600" : "bg-amber-500"}`}>{text}</div>;
}

function Quick({ icon, label, onClick }: { icon: IconName; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="min-w-0 flex flex-col items-center gap-2 rounded-[22px] bg-white p-3 text-center text-xs font-black text-slate-700 shadow-[0_10px_28px_rgba(15,23,42,0.06)] ring-1 ring-slate-100 active:scale-[0.98] dark:bg-slate-900/88 dark:text-slate-200 dark:ring-white/10">
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-slate-950 text-white shadow-[0_10px_22px_rgba(15,23,42,0.18)] dark:bg-emerald-500 dark:text-slate-950">
        <Icon name={icon} />
      </span>
      <span className="max-w-full truncate">{label}</span>
    </button>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-100 dark:bg-white/[0.07] dark:ring-white/10"><p className="truncate text-xs text-slate-500 dark:text-slate-400">{label}</p><p className="truncate font-black">{value}</p></div>;
}

function AssetCard({ title, value, note }: { title: string; value: string; note: string }) {
  return (
    <Card className="border-emerald-200 bg-white/95 dark:border-emerald-500/20 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-black">{title}</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{note}</p>
        </div>
        <span className="flex items-center gap-2 rounded-2xl bg-emerald-100 px-3 py-2 text-sm font-black text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
          <Icon name="crypto" />
          {value}
        </span>
      </div>
    </Card>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500 dark:bg-white/[0.07] dark:text-slate-400">{text}</p>;
}

function SectionTitle({ title, action, onClick }: { title: string; action: string; onClick: () => void }) {
  return <div className="flex min-w-0 items-center justify-between gap-3"><h2 className="min-w-0 truncate text-xl font-black">{title}</h2><button className="shrink-0 rounded-2xl bg-slate-950 px-4 py-2 text-sm font-bold text-white shadow-[0_10px_24px_rgba(15,23,42,0.18)] dark:bg-emerald-500 dark:text-slate-950" onClick={onClick}>{action}</button></div>;
}

function FilterDropdown({ value, options, onChange }: { value: string; options: string[]; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative w-40 max-w-[58vw] shrink-0">
      <button
        type="button"
        onClick={() => setOpen((item) => !item)}
        className={`flex h-12 w-full items-center justify-between rounded-2xl border px-4 text-left text-sm font-bold shadow-[0_10px_28px_rgba(15,23,42,0.08)] transition active:scale-[0.98] ${open ? "border-emerald-500 bg-emerald-50 text-slate-950 dark:bg-emerald-500/12 dark:text-white" : "border-slate-200 bg-white text-slate-950 dark:border-white/10 dark:bg-slate-950/60 dark:text-white"}`}
      >
        <span className="truncate">{value}</span>
        <span className={`text-emerald-500 transition ${open ? "rotate-180" : ""}`}>⌄</span>
      </button>
      {open && (
        <div className="absolute bottom-14 right-0 z-[90] w-[min(14rem,calc(100vw-3.5rem))] overflow-hidden rounded-3xl border border-white/70 bg-white/95 p-2 shadow-[0_22px_60px_rgba(15,23,42,0.22)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/95 dark:shadow-[0_22px_70px_rgba(0,0,0,0.45)]">
          <div className="premium-scroll max-h-56 overflow-y-auto pr-1">
            {options.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => {
                  onChange(item);
                  setOpen(false);
                }}
                className={`mb-1 flex w-full items-center justify-between rounded-2xl px-3 py-2.5 text-left text-sm font-bold transition last:mb-0 ${item === value ? "bg-emerald-500 text-white shadow-[0_10px_24px_rgba(16,185,129,0.25)]" : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10"}`}
              >
                <span>{item}</span>
                {item === value && <span>✓</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TransactionList({ items, type, currency, onEdit, onDelete }: { items: (Income[] | Expense[])[number][]; type: "income" | "expense"; currency: string; onEdit: (id: string) => void; onDelete: (id: string) => void }) {
  if (!items.length) return <Empty text={`No ${type} records yet.`} />;
  return (
    <div className="grid gap-2">
      {items.map((item) => {
        const date = "income_date" in item ? item.income_date : item.expense_date;
        const meta = "source" in item ? item.source : item.category;
        return (
          <div key={item.id} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 p-3 dark:bg-white/[0.07]">
            <div><p className="text-sm font-bold">{item.title}</p><p className="text-xs text-slate-500 dark:text-slate-400">{meta} · {date}</p></div>
            <div className="text-right"><p className={`text-sm font-black ${type === "income" ? "text-emerald-600" : "text-red-600"}`}>{money(item.amount, currency)}</p><RowActions onEdit={() => onEdit(item.id)} onDelete={() => onDelete(item.id)} /></div>
          </div>
        );
      })}
    </div>
  );
}

function ListPayments({ payments, currency, onPaid, onEdit }: { payments: Payment[]; currency: string; onPaid: (p: Payment) => void; onEdit: (id: string) => void }) {
  if (!payments.length) return <Empty text="No upcoming payments." />;
  return <div className="grid gap-2">{payments.map((p) => <PaymentCard key={p.id} payment={p} currency={currency} onPaid={() => onPaid(p)} onEdit={() => onEdit(p.id)} />)}</div>;
}

function PaymentGroup({ title, payments, currency, onPaid, onEdit, onDelete }: { title: string; payments: Payment[]; currency: string; onPaid: (p: Payment) => void; onEdit: (id: string) => void; onDelete: (id: string) => void }) {
  return (
    <Card>
      <h2 className="mb-3 text-base font-bold">{title}</h2>
      {!payments.length && <Empty text="Nothing here." />}
      <div className="grid gap-2">{payments.map((p) => <PaymentCard key={p.id} payment={p} currency={currency} onPaid={() => onPaid(p)} onEdit={() => onEdit(p.id)} onDelete={() => onDelete(p.id)} />)}</div>
    </Card>
  );
}

function PaymentHistoryList({ items, debts, currency }: { items: PaymentHistory[]; debts: Debt[]; currency: string }) {
  if (!items.length) return <Empty text="No debt payments recorded yet." />;
  return (
    <div className="grid gap-2">
      {items.slice(0, 8).map((item) => {
        const debt = debts.find((d) => d.id === item.debt_id);
        return (
          <div key={item.id} className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-100 dark:bg-white/[0.07] dark:ring-white/10">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-black">{item.title}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{item.payment_date} · {debt?.title || "Linked debt"}</p>
              </div>
              <p className="shrink-0 text-sm font-black text-emerald-600 dark:text-emerald-300">{money(item.amount, currency)}</p>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Mini label="Before" value={money(item.balance_before, currency)} />
              <Mini label="After" value={money(item.balance_after, currency)} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PaymentCard({ payment, currency, onPaid, onEdit, onDelete }: { payment: Payment; currency: string; onPaid: () => void; onEdit: () => void; onDelete?: () => void }) {
  const critical = payment.priority === "critical" || payment.category === "Rent";
  return (
    <div className={`rounded-2xl p-3 ${critical ? "bg-red-50 ring-1 ring-red-100 dark:bg-red-500/10 dark:ring-red-500/20" : "bg-slate-50 ring-1 ring-slate-100 dark:bg-white/[0.07] dark:ring-white/10"}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-slate-950 dark:text-white">{payment.title}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Due {payment.due_date} · {payment.category || "Payment"} · {payment.status}</p>
        </div>
        <p className={`text-sm font-black ${critical ? "text-red-600 dark:text-red-300" : "text-slate-950 dark:text-white"}`}>{money(payment.amount, currency)}</p>
      </div>
      {critical && <p className="mt-2 rounded-xl bg-red-100 px-3 py-2 text-xs font-black text-red-700 dark:bg-red-500/15 dark:text-red-300">Rent must be paid first</p>}
      {payment.status === "paid" && payment.balance_before !== undefined && payment.balance_after !== undefined && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Mini label="Before" value={money(payment.balance_before, currency)} />
          <Mini label="After" value={money(payment.balance_after, currency)} />
        </div>
      )}
      <div className="mt-3 flex gap-2">
        {payment.status !== "paid" && <GhostButton className="flex-1 py-2" onClick={onPaid}>Paid</GhostButton>}
        <GhostButton className="flex-1 py-2" onClick={onEdit}>Edit</GhostButton>
        {onDelete && <GhostButton className="flex-1 py-2 text-red-600" onClick={onDelete}>Delete</GhostButton>}
      </div>
    </div>
  );
}

function DebtCard({ item, currency, onPay, onEdit, onDelete }: { item: Debt; currency: string; onPay: () => void; onEdit: () => void; onDelete: () => void }) {
  const paid = 100 - (item.remaining_amount / Math.max(1, item.total_amount)) * 100;
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div><p className="font-black">{item.title}</p><p className="text-xs text-slate-500 dark:text-slate-400">{item.debt_type} · {item.priority}</p></div>
        <span className={`rounded-full px-2 py-1 text-xs font-bold ${item.status === "paid" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" : "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"}`}>{item.status}</span>
      </div>
      <div className="my-4 grid grid-cols-2 gap-3">
        <Mini label="Remaining" value={money(item.remaining_amount, currency)} />
        <Mini label="Monthly" value={money(item.monthly_payment, currency)} />
      </div>
      <ProgressBar value={paid} tone="amber" />
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Due {item.due_date || `day ${item.due_day || "-"}`}</p>
      <div className="mt-4 flex gap-2">
        {item.status !== "paid" && <GhostButton className="flex-1 py-2" onClick={onPay}>Mark paid</GhostButton>}
        <GhostButton className="flex-1 py-2" onClick={onEdit}>Edit</GhostButton>
        <GhostButton className="flex-1 py-2 text-red-600" onClick={onDelete}>Delete</GhostButton>
      </div>
    </Card>
  );
}

function GoalCard({ goal, currency, onEdit, onDelete }: { goal: Goal; currency: string; onEdit: () => void; onDelete: () => void }) {
  const progress = (goal.current_amount / Math.max(1, goal.target_amount)) * 100;
  return (
    <div className="rounded-2xl bg-slate-50 p-3 dark:bg-white/[0.07]">
      <div className="flex items-center justify-between gap-3">
        <div><p className="text-sm font-bold">{goal.title}</p><p className="text-xs text-slate-500 dark:text-slate-400">{goal.goal_type} · {Math.round(progress)}%</p></div>
        <p className="text-sm font-black">{money(goal.current_amount, currency)}</p>
      </div>
      <div className="mt-3"><ProgressBar value={progress} /></div>
      <div className="mt-3 flex gap-2">
        <GhostButton className="flex-1 py-2" onClick={onEdit}>Edit</GhostButton>
        <GhostButton className="flex-1 py-2 text-red-600" onClick={onDelete}>Delete</GhostButton>
      </div>
    </div>
  );
}

function RowActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return <div className="mt-1 flex justify-end gap-2 text-xs font-bold"><button onClick={onEdit}>Edit</button><button className="text-red-600" onClick={onDelete}>Delete</button></div>;
}

function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, string> = {
    home: "M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
    plus: "M12 5v14M5 12h14",
    calendar: "M7 3v4M17 3v4M4 8h16M5 5h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z",
    card: "M4 7h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1zM3 11h18M7 15h4",
    chart: "M4 19V5M4 19h17M8 16v-5M13 16V8M18 16v-9",
    income: "M12 19V5M6 11l6-6 6 6",
    expense: "M12 5v14M6 13l6 6 6-6",
    settings: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM4 12h2M18 12h2M12 4v2M12 18v2M5.6 5.6 7 7M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4",
    sun: "M12 4V2M12 22v-2M4 12H2M22 12h-2M5 5 3.6 3.6M20.4 20.4 19 19M19 5l1.4-1.4M3.6 20.4 5 19M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8",
    moon: "M21 14.5A7.5 7.5 0 0 1 9.5 3a8.5 8.5 0 1 0 11.5 11.5",
    wallet: "M4 7h15a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h12M16 13h5M17 13.5h.01",
    bank: "M3 10h18M5 10l7-5 7 5M6 10v8M10 10v8M14 10v8M18 10v8M4 18h16M3 21h18",
    warning: "M12 9v4M12 17h.01M10.3 4.4 2.6 18a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 4.4a2 2 0 0 0-3.4 0Z",
    crypto: "M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3ZM8 9.5h6a2 2 0 0 1 0 4H8M9.5 7v10M13 7v2.5M13 13.5V17",
    office: "M4 21V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v16M8 7h1M12 7h1M8 11h1M12 11h1M8 15h1M12 15h1M3 21h18",
    check: "M20 6 9 17l-5-5",
  };

  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={paths[name]} />
    </svg>
  );
}
