import type { Debt, Expense, FinanceState, Payment } from "./types";

export const money = (value: number, currency = "AED") =>
  `${currency} ${value.toLocaleString("en-AE", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;

export const uid = () => crypto.randomUUID();

export const todayISO = () => new Date().toISOString().slice(0, 10);

export const daysFromNow = (date: string) => {
  const start = new Date(todayISO()).getTime();
  const end = new Date(date).getTime();
  return Math.ceil((end - start) / 86400000);
};

export const isSameMonth = (date: string) => {
  const now = new Date();
  const target = new Date(date);
  return now.getFullYear() === target.getFullYear() && now.getMonth() === target.getMonth();
};

export const sum = <T>(items: T[], pick: (item: T) => number) =>
  items.reduce((total, item) => total + pick(item), 0);

export const upcoming = (payments: Payment[], days: number) =>
  payments.filter((p) => p.status !== "paid" && daysFromNow(p.due_date) >= 0 && daysFromNow(p.due_date) <= days);

export const dueTomorrow = (payments: Payment[]) =>
  payments.filter((p) => p.status !== "paid" && daysFromNow(p.due_date) === 1);

export const overdue = (payments: Payment[]) =>
  payments.filter((p) => p.status !== "paid" && daysFromNow(p.due_date) < 0);

export const monthlyIncome = (state: FinanceState) =>
  sum(state.incomes.filter((i) => isSameMonth(i.income_date)), (i) => i.amount);

export const monthlyExpenses = (state: FinanceState) =>
  sum(state.expenses.filter((e) => isSameMonth(e.expense_date)), (e) => e.amount);

export const totalDebt = (debts: Debt[]) =>
  sum(debts.filter((d) => d.status === "active"), (d) => d.remaining_amount);

export const rentDue = (state: FinanceState) =>
  sum(state.payments.filter((p) => p.status !== "paid" && p.category === "Rent"), (p) => p.amount);

export const freeCashAfterRent = (state: FinanceState) =>
  safeCash(state) - rentDue(state);

export const safeCash = (state: FinanceState) =>
  state.cash_accounts?.length
    ? sum(state.cash_accounts.filter((account) => account.include_in_safe), (account) => account.amount)
    : state.current_cash;

export const safeToSpend = (state: FinanceState) =>
  Math.max(
    0,
    safeCash(state) -
      rentDue(state) -
      sum(upcoming(state.payments, 15).filter((payment) => payment.category !== "Rent"), (p) => p.amount) -
      state.settings.survival_buffer,
  );

export const debtPaidThisMonth = (state: FinanceState) =>
  sum(state.payments.filter((p) => p.debt_id && p.status === "paid" && p.paid_date && isSameMonth(p.paid_date)), (p) => p.amount);

export const shoppingGiftTotal = (expenses: Expense[]) =>
  sum(expenses.filter((e) => isSameMonth(e.expense_date) && ["Shopping", "Wife/Gifts"].includes(e.category)), (e) => e.amount);

export const categoryTotals = (expenses: Expense[]) => {
  const map = new Map<string, number>();
  expenses.filter((e) => isSameMonth(e.expense_date)).forEach((e) => map.set(e.category, (map.get(e.category) || 0) + e.amount));
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
};

export const financialScore = (state: FinanceState) => {
  const income = monthlyIncome(state);
  const expenses = monthlyExpenses(state);
  const shopping = shoppingGiftTotal(state.expenses);
  const missed = overdue(state.payments).length;
  let score = 100;
  if (expenses > income) score -= 25;
  if (shopping > income * 0.12) score -= 15;
  if (missed) score -= Math.min(25, missed * 8);
  if (income - expenses <= 0) score -= 20;
  if (state.current_cash < state.settings.survival_buffer) score -= 10;
  return Math.max(0, score);
};

export const scoreLabel = (score: number) => {
  if (score >= 80) return "Strong month";
  if (score >= 60) return "Controlled but needs improvement";
  if (score >= 40) return "Risky month";
  return "Serious spending problem";
};
