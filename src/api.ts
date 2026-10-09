import { createClient } from "@supabase/supabase-js";
const env = (import.meta as ImportMeta & { env: Record<string, string> }).env;
export const configured = Boolean(
  env.VITE_SUPABASE_URL && env.VITE_SUPABASE_PUBLISHABLE_KEY,
);
export const db = configured
  ? createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY)
  : null;
export const emailFor = (username: string) =>
  `${username.trim().toLowerCase()}@players.timeguessr.invalid`;
export async function accountAction(body: Record<string, unknown>) {
  if (!db) throw new Error("The club is waiting for its database connection.");
  const { data, error } = await db.functions.invoke("accounts", { body });
  if (error) {
    const context = error.context;
    if (context instanceof Response) {
      const payload = await context.json().catch(() => null);
      throw new Error(payload?.error || error.message);
    }
    throw error;
  }
  return data;
}

export async function readAll<T>(
  table: "profiles" | "games" | "results",
): Promise<T[]> {
  if (!db) return [];
  const rows: T[] = [];
  const key = table === "results" ? "game_id" : "id";
  for (let offset = 0; ; offset += 500) {
    let query = db.from(table).select("*").order(key);
    if (table === "results") query = query.order("player_id");
    const { data, error } = await query.range(offset, offset + 499);
    if (error) throw error;
    rows.push(...(data as T[]));
    if (data.length < 500) return rows;
  }
}
