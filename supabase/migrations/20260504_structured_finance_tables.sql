create extension if not exists "pgcrypto";

create table if not exists accounts (
  id text primary key,
  title text not null,
  amount numeric(12,2) not null default 0,
  include_in_safe boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists assets (
  id text primary key,
  title text not null,
  amount numeric(12,2) not null default 0,
  currency text not null default 'AED',
  include_in_safe boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists incomes (
  id text primary key,
  title text not null,
  amount numeric(12,2) not null default 0,
  source text not null,
  income_date date not null,
  is_recurring boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists expenses (
  id text primary key,
  title text not null,
  amount numeric(12,2) not null default 0,
  category text not null,
  expense_date date not null,
  payment_method text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists debts (
  id text primary key,
  title text not null,
  total_amount numeric(12,2) not null default 0,
  remaining_amount numeric(12,2) not null default 0,
  monthly_payment numeric(12,2) not null default 0,
  used_amount numeric(12,2),
  available_limit numeric(12,2),
  total_limit numeric(12,2),
  due_date date,
  due_day int,
  reminder_day int,
  priority text not null default 'medium',
  debt_type text not null default 'other',
  icon text,
  status text not null default 'active',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists payments (
  id text primary key,
  debt_id text,
  title text not null,
  amount numeric(12,2) not null default 0,
  due_date date not null,
  paid_date date,
  status text not null default 'unpaid',
  category text,
  priority text,
  balance_before numeric(12,2),
  balance_after numeric(12,2),
  is_recurring boolean not null default false,
  recurring_day int,
  reminder_day int,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists payment_history (
  id text primary key,
  debt_id text not null,
  bill_id text,
  title text not null,
  amount numeric(12,2) not null default 0,
  payment_date date not null,
  category text,
  notes text,
  balance_before numeric(12,2) not null,
  balance_after numeric(12,2) not null,
  created_at timestamptz not null default now()
);

create table if not exists app_settings (
  id text primary key default 'default',
  survival_buffer numeric(12,2) not null default 500,
  salary_day int not null default 1,
  currency text not null default 'AED',
  theme text not null default 'light',
  updated_at timestamptz not null default now()
);

alter table debts add column if not exists used_amount numeric(12,2);
alter table debts add column if not exists available_limit numeric(12,2);
alter table debts add column if not exists total_limit numeric(12,2);
alter table debts add column if not exists reminder_day int;
alter table debts add column if not exists icon text;

alter table payments add column if not exists category text;
alter table payments add column if not exists priority text;
alter table payments add column if not exists balance_before numeric(12,2);
alter table payments add column if not exists balance_after numeric(12,2);
alter table payments add column if not exists is_recurring boolean not null default false;
alter table payments add column if not exists recurring_day int;
alter table payments add column if not exists reminder_day int;

insert into accounts (id, title, amount, include_in_safe)
values ('real-account-nbd', 'NBD/current bank balance', 4247.56, true)
on conflict (id) do update set title = excluded.title, amount = excluded.amount, include_in_safe = excluded.include_in_safe;

insert into assets (id, title, amount, currency, include_in_safe, notes)
values ('real-asset-binance', 'Binance USDT Asset', 300, 'USDT', false, 'Crypto asset only. Not included in Safe to Spend.')
on conflict (id) do update set title = excluded.title, amount = excluded.amount, currency = excluded.currency, include_in_safe = excluded.include_in_safe, notes = excluded.notes;

insert into incomes (id, title, amount, source, income_date, is_recurring, notes)
values ('real-income-salary', 'Monthly Salary', 8000, 'Salary', '2026-05-01', true, 'Recurring monthly salary.')
on conflict (id) do update set title = excluded.title, amount = excluded.amount, source = excluded.source, income_date = excluded.income_date, is_recurring = excluded.is_recurring, notes = excluded.notes;

insert into debts (id, title, total_amount, remaining_amount, monthly_payment, used_amount, available_limit, total_limit, due_date, due_day, reminder_day, priority, debt_type, icon, status, notes)
values
  ('real-debt-sukuk', 'Sukuk Finance Loan', 45000, 40266.67, 1610.67, null, null, null, null, 30, 29, 'high', 'finance_loan', 'bank', 'active', 'Actual due date every month 30th. App reminder one day early on 29th.'),
  ('real-debt-noon', 'ENBD Noon Credit Card', 3714.05, 3714.05, 0, 3714.05, null, null, null, 10, 9, 'high', 'credit_card', 'card', 'active', null),
  ('real-debt-mastercard', 'Emirates NBD Titanium Mastercard', 6914.84, 6914.84, 0, 6914.84, null, null, null, 3, 2, 'high', 'credit_card', 'card', 'active', null),
  ('real-debt-aafaq', 'Aafaq Credit Card', 10000.90, 1376, 0, 1376, 8624.90, 10000.90, null, null, null, 'medium_high', 'credit_card', 'card', 'active', 'Total limit approx AED 10,000.90.'),
  ('real-debt-tabby-statement', 'Tabby Statement', 1604.54, 1604.54, 1604.54, null, null, null, '2026-06-02', null, null, 'high', 'tabby', 'tabby', 'active', null),
  ('real-debt-tabby-later', 'Tabby Pay Later / Installments', 892.17, 892.17, 0, null, null, null, null, null, null, 'medium_high', 'installment', 'tabby', 'active', null),
  ('real-debt-office', 'Office Loan / Office Balance', 4000, 4000, 500, null, null, null, null, 1, 1, 'medium', 'office_loan', 'office', 'active', 'AED 500 monthly deduction from salary.')
on conflict (id) do update set
  title = excluded.title,
  total_amount = excluded.total_amount,
  remaining_amount = greatest(debts.remaining_amount, excluded.remaining_amount),
  monthly_payment = excluded.monthly_payment,
  used_amount = excluded.used_amount,
  available_limit = excluded.available_limit,
  total_limit = excluded.total_limit,
  due_date = excluded.due_date,
  due_day = excluded.due_day,
  reminder_day = excluded.reminder_day,
  priority = excluded.priority,
  debt_type = excluded.debt_type,
  icon = excluded.icon,
  status = excluded.status,
  notes = excluded.notes;

insert into payments (id, debt_id, title, amount, due_date, status, category, priority, is_recurring, recurring_day, reminder_day, notes)
values
  ('real-pay-rent-may', null, 'Rent Payment', 4200, '2026-05-10', 'unpaid', 'Rent', 'critical', true, 10, 9, 'Current cash is reserved for this rent payment.'),
  ('real-pay-mastercard-may', 'real-debt-mastercard', 'Emirates NBD Titanium Reminder', 6914.84, '2026-05-02', 'unpaid', 'Debt Payment', 'high', true, 2, 2, null),
  ('real-pay-noon-may', 'real-debt-noon', 'ENBD Noon Card Reminder', 3714.05, '2026-05-09', 'unpaid', 'Debt Payment', 'high', true, 9, 9, null),
  ('real-pay-office-may', 'real-debt-office', 'Office Loan Deduction', 500, '2026-05-01', 'unpaid', 'Office Deduction', 'medium', true, 1, 1, null),
  ('real-pay-sukuk-may', 'real-debt-sukuk', 'Sukuk Finance Reminder', 1610.67, '2026-05-29', 'unpaid', 'Debt Payment', 'high', true, 29, 29, null),
  ('real-pay-tabby-statement', 'real-debt-tabby-statement', 'Tabby Statement', 1604.54, '2026-06-02', 'unpaid', 'Debt Payment', 'high', false, null, null, null),
  ('real-pay-tabby-2-june', 'real-debt-tabby-later', 'Tabby Installment', 231.29, '2026-06-02', 'unpaid', 'Debt Payment', 'high', false, null, null, null),
  ('real-pay-tabby-8-june', 'real-debt-tabby-later', 'Tabby Installment', 25.97, '2026-06-08', 'unpaid', 'Debt Payment', 'medium', false, null, null, null),
  ('real-pay-tabby-23-june', 'real-debt-tabby-later', 'Tabby Installment', 36.59, '2026-06-23', 'unpaid', 'Debt Payment', 'medium', false, null, null, null)
on conflict (id) do nothing;

insert into app_settings (id, survival_buffer, salary_day, currency, theme)
values ('default', 500, 1, 'AED', 'light')
on conflict (id) do update set survival_buffer = excluded.survival_buffer, salary_day = excluded.salary_day, currency = excluded.currency;

create or replace function record_debt_payment(p_debt_id text, p_payment_id text, p_amount numeric)
returns table(balance_before numeric, balance_after numeric)
language plpgsql
as $$
declare
  v_before numeric;
  v_after numeric;
  v_title text;
  v_category text;
  v_notes text;
begin
  select remaining_amount, title, notes into v_before, v_title, v_notes
  from debts
  where id = p_debt_id
  for update;

  if v_before is null then
    raise exception 'Debt not found: %', p_debt_id;
  end if;

  v_after := greatest(0, v_before - p_amount);

  select coalesce(title, v_title), category, coalesce(notes, v_notes)
  into v_title, v_category, v_notes
  from payments
  where id = p_payment_id;

  update debts
  set remaining_amount = v_after,
      status = case when v_after = 0 then 'paid' else 'active' end,
      updated_at = now()
  where id = p_debt_id;

  update payments
  set status = 'paid',
      paid_date = current_date,
      balance_before = v_before,
      balance_after = v_after,
      updated_at = now()
  where id = p_payment_id;

  insert into payment_history (id, debt_id, bill_id, title, amount, payment_date, category, notes, balance_before, balance_after)
  values (gen_random_uuid()::text, p_debt_id, p_payment_id, v_title, p_amount, current_date, coalesce(v_category, 'Debt Payment'), v_notes, v_before, v_after);

  return query select v_before, v_after;
end;
$$;
