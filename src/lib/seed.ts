import type { FinanceState } from "./types";

export const seedState: FinanceState = {
  current_cash: 0,
  cash_accounts: [{ id: "account-main", title: "Main cash balance", amount: 0, include_in_safe: true }],
  assets: [],
  settings: {
    survival_buffer: 0,
    salary_day: 1,
    currency: "AED",
    theme: "light",
    profile_version: 4,
  },
  incomes: [],
  expenses: [],
  debts: [],
  payments: [],
  goals: [],
};
