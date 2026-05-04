create extension if not exists "pgcrypto";

create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  name text,
  email text unique,
  pin text,
  created_at timestamptz not null default now()
);

create table if not exists incomes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  amount numeric(12,2) not null check (amount >= 0),
  source text not null,
  income_date date not null,
  is_recurring boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  amount numeric(12,2) not null check (amount >= 0),
  category text not null,
  expense_date date not null,
  payment_method text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  total_amount numeric(12,2) not null check (total_amount >= 0),
  remaining_amount numeric(12,2) not null check (remaining_amount >= 0),
  monthly_payment numeric(12,2) not null default 0,
  due_date date,
  due_day int check (due_day between 1 and 31),
  priority text not null check (priority in ('high', 'medium', 'low')),
  debt_type text not null check (debt_type in ('credit card', 'loan', 'Tabby', 'office', 'family', 'other')),
  status text not null default 'active' check (status in ('active', 'paid')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  debt_id uuid references debts(id) on delete set null,
  title text not null,
  amount numeric(12,2) not null check (amount >= 0),
  due_date date not null,
  paid_date date,
  status text not null default 'unpaid' check (status in ('unpaid', 'paid', 'overdue')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  target_amount numeric(12,2) not null check (target_amount >= 0),
  current_amount numeric(12,2) not null default 0,
  deadline date,
  goal_type text not null check (goal_type in ('saving', 'debt', 'emergency')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references profiles(id) on delete cascade,
  survival_buffer numeric(12,2) not null default 1000,
  salary_day int not null default 1 check (salary_day between 1 and 31),
  currency text not null default 'AED',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists incomes_updated_at on incomes;
create trigger incomes_updated_at before update on incomes for each row execute function set_updated_at();

drop trigger if exists expenses_updated_at on expenses;
create trigger expenses_updated_at before update on expenses for each row execute function set_updated_at();

drop trigger if exists debts_updated_at on debts;
create trigger debts_updated_at before update on debts for each row execute function set_updated_at();

drop trigger if exists payments_updated_at on payments;
create trigger payments_updated_at before update on payments for each row execute function set_updated_at();

drop trigger if exists goals_updated_at on goals;
create trigger goals_updated_at before update on goals for each row execute function set_updated_at();

drop trigger if exists settings_updated_at on settings;
create trigger settings_updated_at before update on settings for each row execute function set_updated_at();
