import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { FinanceState } from "./types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const remoteEnabled = Boolean(url && anonKey);

export const supabase: SupabaseClient | null = remoteEnabled ? createClient(url!, anonKey!) : null;

export async function loadRemoteState() {
  if (!supabase) return null;
  const { data, error } = await supabase.from("app_state").select("state").eq("id", "default").maybeSingle();
  if (error) return null;
  return (data?.state as FinanceState | undefined) || null;
}

export async function saveRemoteState(state: FinanceState) {
  if (!supabase) return;
  await supabase.from("app_state").upsert({
    id: "default",
    state,
    updated_at: new Date().toISOString(),
  });
}
