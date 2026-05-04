"use client";

/* eslint-disable react-hooks/set-state-in-effect */
import type { Dispatch, FormEvent, ReactNode, SetStateAction } from "react";
import { useEffect, useMemo, useState } from "react";
import { Button, Card, Field, GhostButton, Input, ProgressBar, Select, Sheet, StatCard, Textarea } from "@/components/ui";
import { categoryTotals, debtPaidThisMonth, financialScore, money, monthlyExpenses, monthlyIncome, overdue, safeToSpend, scoreLabel, shoppingGiftTotal, sum, todayISO, totalDebt, uid, upcoming } from "@/lib/finance";
import { seedState } from "@/lib/seed";
import type { Debt, Expense, FinanceState, Goal, Income, Payment } from "@/lib/types";

const DATA_KEY = "hisab-pro-state-v1";
const PIN_KEY = "hisab-pro-pin";
const incomeSources = ["Salary", "Fiverr", "Upwork", "Client payment", "Refund", "Other"];
const expenseCategories = ["Rent", "Food", "Transport", "Mobile", "Family Support", "Shopping", "Wife/Gifts", "Debt Payment", "Office Deduction", "Emergency", "Other"];
const debtTypes = ["credit card", "loan", "Tabby", "office", "family", "other"];
const paymentMethods = ["Cash", "Debit Card", "Credit Card", "Bank Transfer", "Other"];

type Tab = "Home" | "Add" | "Calendar" | "Debts" | "Summary";
type IconName = "home" | "plus" | "calendar" | "card" | "chart" | "income" | "expense" | "settings" | "sun" | "moon";
type SheetKind = "income" | "expense" | "debt" | "payment" | "goal" | "settings";

const navItems: { tab: Tab; icon: IconName }[] = [
  { tab: "Home", icon: "home" },
  { tab: "Calendar", icon: "calendar" },
  { tab: "Add", icon: "plus" },
  { tab: "Debts", icon: "card" },
  { tab: "Summary", icon: "chart" },
];

const normalizeState = (value: FinanceState): FinanceState => ({
  ...value,
  settings: {
    ...seedState.settings,
    ...value.settings,
  },
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

  useEffect(() => {
    try {
      const saved = localStorage.getItem(DATA_KEY);
      setState(saved ? normalizeState(JSON.parse(saved)) : seedState);
    } catch {
      localStorage.setItem(DATA_KEY, JSON.stringify(seedState));
      setState(seedState);
    }
    setHasPin(Boolean(localStorage.getItem(PIN_KEY)));
    if ("serviceWorker" in navigator) {
      if (process.env.NODE_ENV === "production") {
        navigator.serviceWorker.register("/sw.js").catch(() => undefined);
      } else {
        navigator.serviceWorker.getRegistrations().then((items) => items.forEach((item) => item.unregister()));
        caches?.keys().then((keys) => keys.forEach((key) => caches.delete(key)));
      }
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(DATA_KEY, JSON.stringify(state));
  }, [hydrated, state]);

  const currency = state.settings.currency;
  const isDark = state.settings.theme === "dark";
  const income = monthlyIncome(state);
  const expenses = monthlyExpenses(state);
  const debt = totalDebt(state.debts);
  const upcoming7 = upcoming(state.payments, 7);
  const upcoming15 = upcoming(state.payments, 15);
  const upcoming15Total = sum(upcoming15, (p) => p.amount);
  const safe = safeToSpend(state);
  const score = financialScore(state);

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
      setHasPin(true);
      setAuthed(true);
    }
    if (saved === pin) setAuthed(true);
  }

  function resetData() {
    localStorage.setItem(DATA_KEY, JSON.stringify(seedState));
    setState(seedState);
  }

  function toggleTheme() {
    setState((s) => ({ ...s, settings: { ...s.settings, theme: s.settings.theme === "dark" ? "light" : "dark" } }));
  }

  function deleteRecord(kind: SheetKind, id: string) {
    setState((s) => {
      if (kind === "income") {
        const item = s.incomes.find((i) => i.id === id);
        return { ...s, current_cash: s.current_cash - (item?.amount || 0), incomes: s.incomes.filter((i) => i.id !== id) };
      }
      if (kind === "expense") {
        const item = s.expenses.find((i) => i.id === id);
        return { ...s, current_cash: s.current_cash + (item?.amount || 0), expenses: s.expenses.filter((i) => i.id !== id) };
      }
      if (kind === "debt") return { ...s, debts: s.debts.filter((d) => d.id !== id), payments: s.payments.filter((p) => p.debt_id !== id) };
      if (kind === "payment") return { ...s, payments: s.payments.filter((p) => p.id !== id) };
      if (kind === "goal") return { ...s, goals: s.goals.filter((g) => g.id !== id) };
      return s;
    });
  }

  function markPaymentPaid(payment: Payment) {
    if (payment.status === "paid") return;
    setState((s) => ({
      ...s,
      current_cash: s.current_cash - payment.amount,
      payments: s.payments.map((p) => (p.id === payment.id ? { ...p, status: "paid", paid_date: todayISO() } : p)),
      debts: s.debts.map((d) => {
        if (d.id !== payment.debt_id) return d;
        const remaining = Math.max(0, d.remaining_amount - payment.amount);
        return { ...d, remaining_amount: remaining, status: remaining === 0 ? "paid" : "active" };
      }),
    }));
  }

  function payDebtInstallment(debtItem: Debt) {
    const amount = debtItem.monthly_payment || debtItem.remaining_amount;
    const remaining = Math.max(0, debtItem.remaining_amount - amount);
    setState((s) => ({
      ...s,
      current_cash: s.current_cash - amount,
      debts: s.debts.map((d) => (d.id === debtItem.id ? { ...d, remaining_amount: remaining, status: remaining === 0 ? "paid" : "active" } : d)),
      payments: [{ id: uid(), debt_id: debtItem.id, title: debtItem.title, amount, due_date: todayISO(), paid_date: todayISO(), status: "paid" }, ...s.payments],
    }));
  }

  if (!authed) {
    return (
      <main className={`${isDark ? "dark" : ""} flex min-h-dvh items-center justify-center bg-[#F3F6FA] px-5 dark:bg-slate-950`}>
        <Card className="w-full max-w-sm p-6">
          <div className="mb-8">
            <p className="text-sm font-semibold text-emerald-600">Hisab Pro</p>
            <h1 className="mt-2 text-3xl font-black text-slate-950 dark:text-white">Money Control</h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{hasPin ? "Enter your PIN" : "Create a 4 digit PIN"}</p>
          </div>
          <form className="grid gap-4" onSubmit={login}>
            <Input inputMode="numeric" minLength={4} maxLength={8} type="password" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="PIN" required />
            <Button>{hasPin ? "Unlock" : "Create PIN"}</Button>
          </form>
        </Card>
      </main>
    );
  }

  return (
    <main className={`${isDark ? "dark" : ""} min-h-dvh bg-[radial-gradient(circle_at_top,#dff8ef_0,#f3f6fa_42%,#eef2f7_100%)] text-slate-950 dark:bg-[radial-gradient(circle_at_top,#064E3B_0,#020617_42%,#0F172A_100%)] dark:text-white`}>
      <div className="mx-auto min-h-dvh w-full max-w-md bg-transparent pb-28 shadow-2xl md:my-6 md:min-h-[900px] md:overflow-hidden md:rounded-[34px]">
        <header className="sticky top-0 z-20 bg-[#F3F6FA]/80 px-5 pb-3 pt-5 backdrop-blur-xl dark:bg-slate-950/65">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-600">Hisab Pro</p>
              <h1 className="text-2xl font-black">Money Control</h1>
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

        <div className="grid gap-4 px-5 pt-4">
          {tab === "Home" && (
            <>
              <Card className={`${safe < 0 ? "bg-red-600" : "bg-slate-950"} overflow-hidden p-5 text-white ring-1 ring-white/40`}>
                <p className="text-sm font-semibold opacity-75">Safe to Spend</p>
                <p className="mt-2 text-4xl font-black">{money(safe, currency)}</p>
                <p className="mt-3 text-sm opacity-85">{safe < 0 ? "You should not spend anything extra right now." : "After upcoming 15 day payments and buffer."}</p>
              </Card>
              {upcoming15Total > state.current_cash && <Alert text="Upcoming payments are greater than your available cash." tone="red" />}
              <div className="grid grid-cols-2 gap-3">
                <StatCard label="Cash" value={money(state.current_cash, currency)} />
                <StatCard label="Income" value={money(income, currency)} tone="green" />
                <StatCard label="Expenses" value={money(expenses, currency)} tone="red" />
                <StatCard label="Debt" value={money(debt, currency)} tone="amber" />
              </div>
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
              <div className="grid grid-cols-2 gap-3">
                <Quick icon="income" label="Add Income" onClick={() => setSheet({ kind: "income" })} />
                <Quick icon="expense" label="Add Expense" onClick={() => setSheet({ kind: "expense" })} />
                <Quick icon="card" label="Add Debt" onClick={() => setSheet({ kind: "debt" })} />
                <Quick icon="calendar" label="Add Payment" onClick={() => setSheet({ kind: "payment" })} />
              </div>
              <Card>
                <h2 className="mb-3 text-base font-bold">Upcoming</h2>
                <div className="grid grid-cols-2 gap-3">
                  <Mini label="Next 7 days" value={money(sum(upcoming7, (p) => p.amount), currency)} />
                  <Mini label="Next 15 days" value={money(upcoming15Total, currency)} />
                </div>
                <div className="mt-3">
                  <ListPayments payments={upcoming15} currency={currency} onPaid={markPaymentPaid} onEdit={(id) => setSheet({ kind: "payment", id })} />
                </div>
              </Card>
              <Card>
                <h2 className="mb-2 text-base font-bold">Monthly Result</h2>
                <p className={`text-2xl font-black ${income - expenses >= 0 ? "text-emerald-600" : "text-red-600"}`}>{money(income - expenses, currency)}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">{income - expenses >= 0 ? "Saving this month" : "Loss this month"}</p>
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
                <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Financial Score</p>
                <p className="mt-1 text-5xl font-black">{score}</p>
                <p className="mt-1 text-sm font-bold text-emerald-600">{scoreLabel(score)}</p>
                <ProgressBar value={score} tone={score >= 80 ? "emerald" : score >= 60 ? "amber" : "red"} />
              </Card>
              <div className="grid grid-cols-2 gap-3">
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

        <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md px-4 pb-4 md:bottom-6">
          <div className="grid grid-cols-5 items-end gap-1 rounded-[30px] border border-white/70 bg-white/95 p-2 shadow-[0_20px_55px_rgba(15,23,42,0.20)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/[0.94] dark:shadow-[0_22px_70px_rgba(0,0,0,0.45)]">
            {navItems.map((item) => {
              const active = tab === item.tab;
              const isAdd = item.tab === "Add";
              return (
                <button
                  key={item.tab}
                  onClick={() => setTab(item.tab)}
                  className={`flex flex-col items-center justify-center gap-1 rounded-2xl text-[11px] font-black transition active:scale-95 ${isAdd ? "-mt-8" : "h-14"} ${active ? "text-slate-950 dark:text-white" : "text-slate-400 dark:text-slate-500"}`}
                >
                  <span className={`grid place-items-center ${isAdd ? "h-16 w-16 rounded-full bg-emerald-500 text-white shadow-[0_14px_32px_rgba(16,185,129,0.45)] ring-4 ring-[#F3F6FA] dark:ring-slate-950" : `h-8 w-8 rounded-2xl ${active ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950" : "bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-400"}`}`}>
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
    setState((s) => ({ ...s, current_cash: s.current_cash - (income?.amount || 0) + next.amount, incomes: income ? s.incomes.map((i) => (i.id === next.id ? next : i)) : [next, ...s.incomes] }));
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
    setState((s) => ({ ...s, current_cash: s.current_cash + (expense?.amount || 0) - next.amount, expenses: expense ? s.expenses.map((i) => (i.id === next.id ? next : i)) : [next, ...s.expenses] }));
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
      notes: String(data.get("notes") || ""),
    };
    setState((s) => ({ ...s, payments: payment ? s.payments.map((i) => (i.id === next.id ? next : i)) : [next, ...s.payments] }));
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
    setState((s) => ({ ...s, current_cash: Number(data.get("cash")), settings: { survival_buffer: Number(data.get("buffer")), salary_day: Number(data.get("salary_day")), currency: String(data.get("currency")), theme: String(data.get("theme")) as FinanceState["settings"]["theme"] } }));
    close();
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
          <Field label="Priority"><Select name="priority" defaultValue={debt?.priority || "medium"}><option>high</option><option>medium</option><option>low</option></Select></Field>
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
          <Field label="Status"><Select name="status" defaultValue={payment?.status || "unpaid"}><option>unpaid</option><option>paid</option><option>overdue</option></Select></Field>
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
          <GhostButton type="button" onClick={resetData}>Reset demo data</GhostButton>
        </Form>
      )}
    </Sheet>
  );
}

function Form({ children, onSubmit }: { children: ReactNode; onSubmit: (e: FormEvent<HTMLFormElement>) => void }) {
  return <form className="grid gap-4" onSubmit={onSubmit}>{children}<Button>Save</Button></form>;
}

function Alert({ text, tone }: { text: string; tone: "red" | "amber" }) {
  return <div className={`rounded-2xl px-4 py-3 text-sm font-bold text-white ${tone === "red" ? "bg-red-600" : "bg-amber-500"}`}>{text}</div>;
}

function Quick({ icon, label, onClick }: { icon: IconName; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-3 rounded-[22px] bg-white/92 p-4 text-left text-sm font-black shadow-[0_12px_35px_rgba(15,23,42,0.08)] ring-1 ring-white active:scale-[0.98] dark:bg-slate-900/88 dark:ring-white/10">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-slate-950 text-white dark:bg-emerald-500 dark:text-slate-950">
        <Icon name={icon} />
      </span>
      {label}
    </button>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl bg-slate-50 p-3 dark:bg-white/[0.07]"><p className="text-xs text-slate-500 dark:text-slate-400">{label}</p><p className="font-black">{value}</p></div>;
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500 dark:bg-white/[0.07] dark:text-slate-400">{text}</p>;
}

function SectionTitle({ title, action, onClick }: { title: string; action: string; onClick: () => void }) {
  return <div className="flex items-center justify-between"><h2 className="text-xl font-black">{title}</h2><button className="rounded-2xl bg-slate-950 px-4 py-2 text-sm font-bold text-white shadow-[0_10px_24px_rgba(15,23,42,0.18)] dark:bg-emerald-500 dark:text-slate-950" onClick={onClick}>{action}</button></div>;
}

function FilterDropdown({ value, options, onChange }: { value: string; options: string[]; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative w-44">
      <button
        type="button"
        onClick={() => setOpen((item) => !item)}
        className={`flex h-12 w-full items-center justify-between rounded-2xl border px-4 text-left text-sm font-bold shadow-[0_10px_28px_rgba(15,23,42,0.08)] transition active:scale-[0.98] ${open ? "border-emerald-500 bg-emerald-50 text-slate-950 dark:bg-emerald-500/12 dark:text-white" : "border-slate-200 bg-white text-slate-950 dark:border-white/10 dark:bg-slate-950/60 dark:text-white"}`}
      >
        <span className="truncate">{value}</span>
        <span className={`text-emerald-500 transition ${open ? "rotate-180" : ""}`}>⌄</span>
      </button>
      {open && (
        <div className="absolute right-0 top-14 z-40 max-h-72 w-56 overflow-hidden rounded-3xl border border-white/70 bg-white/95 p-2 shadow-[0_22px_60px_rgba(15,23,42,0.22)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/95 dark:shadow-[0_22px_70px_rgba(0,0,0,0.45)]">
          <div className="premium-scroll max-h-64 overflow-y-auto pr-1">
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

function PaymentCard({ payment, currency, onPaid, onEdit, onDelete }: { payment: Payment; currency: string; onPaid: () => void; onEdit: () => void; onDelete?: () => void }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3 dark:bg-white/[0.07]">
      <div className="flex items-center justify-between gap-3">
        <div><p className="text-sm font-bold">{payment.title}</p><p className="text-xs text-slate-500 dark:text-slate-400">Due {payment.due_date} · {payment.status}</p></div>
        <p className="text-sm font-black">{money(payment.amount, currency)}</p>
      </div>
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
  };

  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={paths[name]} />
    </svg>
  );
}
