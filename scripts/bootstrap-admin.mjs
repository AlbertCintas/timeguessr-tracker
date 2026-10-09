import { createClient } from "@supabase/supabase-js";
import { randomBytes, createHash } from "node:crypto";
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY)
  throw new Error(
    "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your shell.",
  );
const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const { count, error } = await db
  .from("administrators")
  .select("*", { count: "exact", head: true });
if (error) throw error;
if (count)
  throw new Error(
    "An administrator already exists. Sign in and use Manage club.",
  );
const token = randomBytes(32).toString("hex");
const inserted = await db
  .from("invitations")
  .insert({
    token_hash: createHash("sha256").update(token).digest("hex"),
    make_admin: true,
    expires_at: new Date(Date.now() + 86400000).toISOString(),
  });
if (inserted.error) throw inserted.error;
console.log(
  `Open this private administrator invitation within 24 hours:\nhttps://albertcintas.github.io/timeguessr-tracker/#invite=${token}`,
);
