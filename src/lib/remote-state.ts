import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { FinanceState } from "./types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const remoteEnabled = Boolean(url && anonKey);

let client: SupabaseClient | null = null;

export function getSupabase() {
  if (!remoteEnabled) return null;
  client ||= createClient(url!, anonKey!);
  return client;
}

export async function loadRemoteState() {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase.from("app_state").select("state").eq("id", "default").maybeSingle();
  if (error) return null;
  return (data?.state as FinanceState | undefined) || null;
}

export async function saveRemoteState(state: FinanceState) {
  const supabase = getSupabase();
  if (!supabase) return;
  await supabase.from("app_state").upsert({
    id: "default",
    state,
    updated_at: new Date().toISOString(),
  });
}
