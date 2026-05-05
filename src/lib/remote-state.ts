import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { seedState } from "./seed";
import type { Asset, CashAccount, Debt, Expense, FinanceState, Income, Payment, PaymentHistory } from "./types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const remoteEnabled = Boolean(url && anonKey);

let client: SupabaseClient | null = null;

export function getSupabase() {
  if (!remoteEnabled) return null;
  client ||= createClient(url!, anonKey!);
  return client;
}

const maybeSingle = async <T>(query: PromiseLike<{ data: T | null; error: unknown }>) => {
  const { data, error } = await query;
  return error ? null : data;
};

const selectAll = async <T>(supabase: SupabaseClient, table: string) => {
  const { data, error } = await supabase.from(table).select("*");
  return error ? [] : (data || []) as T[];
};

function appSettingsToState(row: Record<string, unknown> | null): FinanceState["settings"] {
  return {
    survival_buffer: Number(row?.survival_buffer ?? seedState.settings.survival_buffer),
    salary_day: Number(row?.salary_day ?? seedState.settings.salary_day),
    currency: String(row?.currency ?? "AED"),
    theme: row?.theme === "dark" ? "dark" : "light",
    profile_version: seedState.settings.profile_version,
  };
}

async function loadStructuredState(supabase: SupabaseClient) {
  const [accounts, assets, incomes, expenses, debts, payments, paymentHistory, settings] = await Promise.all([
    selectAll<CashAccount>(supabase, "accounts"),
    selectAll<Asset>(supabase, "assets"),
    selectAll<Income>(supabase, "incomes"),
    selectAll<Expense>(supabase, "expenses"),
    selectAll<Debt>(supabase, "debts"),
    selectAll<Payment>(supabase, "payments"),
    selectAll<PaymentHistory>(supabase, "payment_history"),
    maybeSingle<Record<string, unknown>>(supabase.from("app_settings").select("*").eq("id", "default").maybeSingle()),
  ]);

  if (!accounts.length && !assets.length && !incomes.length && !debts.length && !payments.length && !paymentHistory.length) return null;

  return {
    current_cash: accounts.filter((account) => account.include_in_safe).reduce((total, account) => total + Number(account.amount || 0), 0),
    cash_accounts: accounts,
    assets,
    incomes,
    expenses,
    debts,
    payments,
    payment_history: paymentHistory,
    goals: [],
    settings: appSettingsToState(settings),
  } satisfies FinanceState;
}

async function syncTable<T extends { id: string }>(supabase: SupabaseClient, table: string, rows: T[]) {
  const { data } = await supabase.from(table).select("id");
  const existingIds = ((data || []) as { id: string }[]).map((item) => item.id);
  const nextIds = rows.map((item) => item.id);
  const stale = existingIds.filter((id) => !nextIds.includes(id));
  if (stale.length) await supabase.from(table).delete().in("id", stale);
  if (rows.length) await supabase.from(table).upsert(rows);
}

async function saveStructuredState(supabase: SupabaseClient, state: FinanceState) {
  await Promise.all([
    syncTable(supabase, "accounts", state.cash_accounts),
    syncTable(supabase, "assets", state.assets),
    syncTable(supabase, "incomes", state.incomes),
    syncTable(supabase, "expenses", state.expenses),
    syncTable(supabase, "debts", state.debts),
    syncTable(supabase, "payments", state.payments),
    syncTable(supabase, "payment_history", state.payment_history || []),
    supabase.from("app_settings").upsert({
      id: "default",
      survival_buffer: state.settings.survival_buffer,
      salary_day: state.settings.salary_day,
      currency: state.settings.currency,
      theme: state.settings.theme,
      updated_at: new Date().toISOString(),
    }),
  ]);
}

export async function loadRemoteState() {
  const supabase = getSupabase();
  if (!supabase) return null;
  const structured = await loadStructuredState(supabase);
  if (structured) return structured;
  const { data, error } = await supabase.from("app_state").select("state").eq("id", "default").maybeSingle();
  if (error) return null;
  const fallback = (data?.state as FinanceState | undefined) || null;
  if (fallback) await saveStructuredState(supabase, fallback);
  if (fallback) return fallback;
  await saveStructuredState(supabase, seedState);
  await supabase.from("app_state").upsert({
    id: "default",
    state: seedState,
    updated_at: new Date().toISOString(),
  });
  return seedState;
}

export async function getRemoteStatus() {
  const supabase = getSupabase();
  if (!supabase) return { label: "Local mode", ok: false };
  const [accounts, debts, payments] = await Promise.all([
    supabase.from("accounts").select("id", { count: "exact", head: true }),
    supabase.from("debts").select("id", { count: "exact", head: true }),
    supabase.from("payments").select("id", { count: "exact", head: true }),
  ]);
  const count = (accounts.count || 0) + (debts.count || 0) + (payments.count || 0);
  return count > 0 ? { label: "Cloud tables synced", ok: true } : { label: "Cloud connected, no finance rows", ok: false };
}

export async function saveRemoteState(state: FinanceState) {
  const supabase = getSupabase();
  if (!supabase) return;
  await saveStructuredState(supabase, state);
  await supabase.from("app_state").upsert({
    id: "default",
    state,
    updated_at: new Date().toISOString(),
  });
}
