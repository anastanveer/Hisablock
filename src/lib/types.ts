export type Priority = "high" | "medium" | "low";
export type DebtStatus = "active" | "paid";
export type PaymentStatus = "unpaid" | "paid" | "overdue";

export interface Income {
  id: string;
  title: string;
  amount: number;
  source: string;
  income_date: string;
  is_recurring: boolean;
  notes?: string;
}

export interface Expense {
  id: string;
  title: string;
  amount: number;
  category: string;
  expense_date: string;
  payment_method: string;
  notes?: string;
}

export interface Debt {
  id: string;
  title: string;
  total_amount: number;
  remaining_amount: number;
  monthly_payment: number;
  due_date?: string;
  due_day?: number;
  priority: Priority;
  debt_type: string;
  status: DebtStatus;
  notes?: string;
}

export interface Payment {
  id: string;
  debt_id?: string;
  title: string;
  amount: number;
  due_date: string;
  paid_date?: string;
  status: PaymentStatus;
  notes?: string;
}

export interface Goal {
  id: string;
  title: string;
  target_amount: number;
  current_amount: number;
  deadline: string;
  goal_type: "saving" | "debt" | "emergency";
  notes?: string;
}

export interface Settings {
  survival_buffer: number;
  salary_day: number;
  currency: string;
}

export interface FinanceState {
  current_cash: number;
  incomes: Income[];
  expenses: Expense[];
  debts: Debt[];
  payments: Payment[];
  goals: Goal[];
  settings: Settings;
}
