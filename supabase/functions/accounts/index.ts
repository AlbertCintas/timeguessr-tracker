import { createClient } from "npm:@supabase/supabase-js@2";
const url = Deno.env.get("SUPABASE_URL")!;
const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});
const headers = {
  "Access-Control-Allow-Origin":
    Deno.env.get("APP_ORIGIN") || "https://albertcintas.github.io",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
const digest = async (value: string) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
  )
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers });
Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers });
  if (request.method !== "POST")
    return reply({ error: "Method not allowed" }, 405);
  try {
    const body = await request.json();
    if (body.action === "redeem") {
      const username = String(body.username || "")
        .trim()
        .toLowerCase();
      if (!/^[a-z0-9_]{3,24}$/.test(username))
        return reply(
          {
            error:
              "Username must be 3–24 lowercase letters, numbers, or underscores.",
          },
          400,
        );
      if (
        typeof body.password !== "string" ||
        body.password.length < 10 ||
        body.password.length > 128
      )
        return reply({ error: "Use a password of 10–128 characters." }, 400);
      if (typeof body.token !== "string" || !/^[a-f0-9]{64}$/.test(body.token))
        return reply({ error: "Invalid invitation." }, 400);
      const token_hash = await digest(body.token);
      const { data: claimed, error: claimError } = await admin
        .from("invitations")
        .update({ used_at: new Date().toISOString() })
        .eq("token_hash", token_hash)
        .is("used_at", null)
        .gt("expires_at", new Date().toISOString())
        .select("token_hash, make_admin")
        .maybeSingle();
      if (claimError) throw claimError;
      if (!claimed)
        return reply(
          { error: "This invitation has expired or has already been used." },
          400,
        );
      const { data, error } = await admin.auth.admin.createUser({
        email: `${username}@players.timeguessr.invalid`,
        password: body.password,
        email_confirm: true,
      });
      if (error) {
        await admin
          .from("invitations")
          .update({ used_at: null })
          .eq("token_hash", token_hash);
        return reply(
          {
            error:
              "Could not create account. Try another username or a stronger password.",
          },
          400,
        );
      }
      const { error: profileError } = await admin
        .from("profiles")
        .insert({ id: data.user.id, username, display_name: username });
      if (profileError) {
        await admin.auth.admin.deleteUser(data.user.id);
        await admin
          .from("invitations")
          .update({ used_at: null })
          .eq("token_hash", token_hash);
        throw profileError;
      }
      if (claimed.make_admin) {
        const { error: roleError } = await admin
          .from("administrators")
          .insert({ player_id: data.user.id });
        if (roleError) {
          await admin.auth.admin.deleteUser(data.user.id);
          await admin
            .from("invitations")
            .update({ used_at: null })
            .eq("token_hash", token_hash);
          throw roleError;
        }
      }
      return reply({ username });
    }
    const token = request.headers
      .get("Authorization")
      ?.replace(/^Bearer /i, "");
    if (!token) return reply({ error: "Sign in first." }, 401);
    const { data: identity, error: identityError } =
      await admin.auth.getUser(token);
    if (identityError || !identity.user)
      return reply({ error: "Sign in first." }, 401);
    const { data: role } = await admin
      .from("administrators")
      .select("player_id")
      .eq("player_id", identity.user.id)
      .maybeSingle();
    if (!role) return reply({ error: "Administrator access required." }, 403);
    if (body.action === "invite") {
      const invitation = Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map((n) => n.toString(16).padStart(2, "0"))
        .join("");
      const { error } = await admin
        .from("invitations")
        .insert({ token_hash: await digest(invitation) });
      if (error) throw error;
      return reply({ token: invitation });
    }
    if (body.action === "reset-password") {
      if (
        typeof body.password !== "string" ||
        body.password.length < 10 ||
        body.password.length > 128
      )
        return reply({ error: "Use a password of 10–128 characters." }, 400);
      const { error } = await admin.auth.admin.updateUserById(body.player_id, {
        password: body.password,
      });
      if (error) return reply({ error: "Unable to reset this password." }, 400);
      return reply({ ok: true });
    }
    return reply({ error: "Unknown action." }, 400);
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : "Account request failed",
    );
    return reply(
      { error: "Unable to complete the request. Please try again." },
      500,
    );
  }
});
