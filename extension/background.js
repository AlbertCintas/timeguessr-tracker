import { createClient } from "@supabase/supabase-js";
import { validateCapture, dailyDate, externalKey } from "./capture.js";
const URL = "https://xymaqcuhpmjimfbwpenr.supabase.co";
const KEY = "sb_publishable_TZh1TA51sJWotfDszbJzTw_jl-3RnBt";
const trustedStorage = Boolean(chrome.storage.local.setAccessLevel);
const ready = trustedStorage
  ? chrome.storage.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" })
  : Promise.resolve();
let authDatabase;
async function privateAuthStore(method, key, value) {
  authDatabase ??= new Promise((resolve, reject) => {
    const request = indexedDB.open("club-private-auth", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("session");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  const database = await authDatabase;
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(
      "session",
      method === "get" ? "readonly" : "readwrite",
    );
    const store = transaction.objectStore("session");
    const request =
      method === "put" ? store.put(value, key) : store[method](key);
    transaction.oncomplete = () => resolve(request.result ?? null);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}
const authStorage = {
  async getItem(key) {
    await ready;
    return trustedStorage
      ? ((await chrome.storage.local.get(key))[key] ?? null)
      : privateAuthStore("get", key);
  },
  async setItem(key, value) {
    await ready;
    if (trustedStorage) await chrome.storage.local.set({ [key]: value });
    else await privateAuthStore("put", key, value);
  },
  async removeItem(key) {
    await ready;
    if (trustedStorage) await chrome.storage.local.remove(key);
    else await privateAuthStore("delete", key);
  },
};
const db = createClient(URL, KEY, {
  auth: {
    storage: authStorage,
    storageKey: "club-auth",
    persistSession: true,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
  global: {
    fetch: (url, options) =>
      fetch(url, { ...options, signal: AbortSignal.timeout(15000) }),
  },
});
let chain = ready;
function serial(task) {
  const next = chain.then(task);
  chain = next.catch(() => {});
  return next;
}
async function state() {
  await ready;
  const data = await chrome.storage.local.get([
    "account",
    "enabled",
    "queue",
    "history",
    "message",
  ]);
  return {
    account: data.account ?? null,
    enabled: data.enabled !== false,
    queue: data.queue ?? [],
    history: data.history ?? [],
    message: data.message ?? "",
  };
}
async function badge(data) {
  const pending = data.queue.filter(
    (item) => item.uid === data.account?.id,
  ).length;
  await chrome.action.setBadgeText({ text: pending ? String(pending) : "" });
  await chrome.action.setBadgeBackgroundColor({ color: "#d5a94e" });
}
async function save(data) {
  await chrome.storage.local.set(data);
  await badge(data);
}
async function sessionFor(account) {
  let {
    data: { session },
    error,
  } = await db.auth.getSession();
  if (!error && session && session.expires_at * 1000 < Date.now() + 60000) {
    const refreshed = await db.auth.refreshSession();
    session = refreshed.data.session;
    error = refreshed.error;
  }
  if (error || !session || session.user.id !== account.id)
    throw new Error("Sign in again to upload your pending games.");
  return session;
}
async function processQueue() {
  const data = await state();
  if (!data.account || !data.enabled) return;
  try {
    await sessionFor(data.account);
  } catch (error) {
    data.message = error.message;
    await save(data);
    return;
  }
  let metadata;
  for (const item of data.queue
    .filter(
      (entry) => entry.uid === data.account.id && entry.status === "pending",
    )
    .slice(0, 20)) {
    try {
      if (item.capture.mode === "daily" && !item.challenge_date) {
        if (!metadata) {
          const response = await fetch(
            "https://timeguessr.com/final-score?mode=daily",
            {
              credentials: "omit",
              cache: "no-store",
              signal: AbortSignal.timeout(15000),
            },
          );
          if (!response.ok)
            throw new Error("Timeguessr is unavailable. Will retry.");
          metadata = await response.text();
        }
        try {
          item.challenge_date = dailyDate(item.capture.daily_number, metadata);
        } catch (error) {
          item.status = "date_review";
          item.message = error.message;
          await save(data);
          continue;
        }
      }
      const { data: result, error } = await db.rpc("import_timeguessr_result", {
        challenge_date: item.challenge_date ?? null,
        challenge_number: item.capture.daily_number,
        source_key: item.external_key,
        played_date: item.capture.played_on,
        total: item.capture.points,
        pictures: item.capture.rounds,
        timer_seconds: item.capture.timer_seconds,
        replay_game_id: item.capture.replay_id ?? null,
      });
      if (error) {
        if (
          error.code?.startsWith("22") ||
          error.code === "P0001" ||
          error.code?.startsWith("23")
        ) {
          item.status = "review";
          item.message = error.message;
          await save(data);
          continue;
        }
        throw error;
      }
      if (result?.status === "conflict") {
        item.status = "conflict";
        item.message =
          "A different score or picture detail is already saved. Review it in the tracker.";
      } else if (
        ["saved", "enriched", "already_saved"].includes(result?.status)
      ) {
        data.queue = data.queue.filter((entry) => entry.id !== item.id);
        data.history = [
          {
            ...item,
            status: result.status,
            message: "",
            game_id: result.game_id,
          },
          ...data.history,
        ].slice(0, 20);
      } else throw new Error("Unexpected server response. Will retry.");
      data.message = "";
      await save(data);
    } catch (error) {
      item.message = error.message || "Upload failed. Will retry.";
      data.message = item.message;
      await save(data);
      break;
    }
  }
}
async function handle(message, sender) {
  const popup =
    sender.id === chrome.runtime.id &&
    sender.url?.startsWith(chrome.runtime.getURL("popup.html"));
  if (message?.type === "capture") {
    if (
      !sender.tab ||
      !/^https:\/\/(www\.)?timeguessr\.com\//.test(sender.url ?? "")
    )
      throw new Error("Unknown result source.");
    const data = await state();
    if (!data.account || !data.enabled) return { accepted: false };
    const capture = validateCapture(message.capture);
    const key = await externalKey(capture);
    const identity =
      capture.mode === "daily" ? `daily:${capture.daily_number}` : key;
    const id = `${data.account.id}:${identity}`;
    if (!data.queue.some((entry) => entry.id === id)) {
      const previous = data.history.find((entry) => entry.id === id);
      if (
        previous &&
        previous.capture.rounds.every((round, i) =>
          ["points", "years_off", "distance_km"].every(
            (key) => round[key] === capture.rounds[i][key],
          ),
        ) &&
        previous.capture.points === capture.points &&
        (previous.capture.replay_id ?? null) === capture.replay_id
      )
        return { accepted: true };
      if (data.queue.length >= 200) {
        data.message =
          "Import queue is full. Review pending games in the extension.";
        await save(data);
        return { accepted: false };
      }
      data.queue.push({
        id,
        uid: data.account.id,
        capture,
        external_key: key,
        status: "pending",
        message: "",
      });
      await save(data);
    } else {
      const queued = data.queue.find((entry) => entry.id === id);
      if (capture.replay_id && !queued.capture.replay_id) {
        queued.capture.replay_id = capture.replay_id;
        await save(data);
      }
    }
    void serial(processQueue);
    return { accepted: true };
  }
  if (!popup) throw new Error("Open the extension to manage imports.");
  if (message.type === "state") {
    const data = await state();
    return {
      ...data,
      queue: data.queue.filter((item) => item.uid === data.account?.id),
      history: data.history.filter((item) => item.uid === data.account?.id),
    };
  }
  if (message.type === "login") {
    const username = String(message.username ?? "")
      .trim()
      .toLowerCase();
    if (!/^[a-z0-9_]{3,24}$/.test(username))
      throw new Error("Enter your tracker username.");
    const { data: auth, error } = await db.auth.signInWithPassword({
      email: `${username}@players.timeguessr.invalid`,
      password: String(message.password ?? ""),
    });
    if (error) throw error;
    const { data: profile, error: profileError } = await db
      .from("profiles")
      .select("username,display_name")
      .eq("id", auth.user.id)
      .single();
    if (profileError) {
      await db.auth.signOut({ scope: "local" });
      throw profileError;
    }
    const data = await state();
    data.account = {
      id: auth.user.id,
      username: profile.username,
      display_name: profile.display_name,
    };
    data.message = "";
    await save(data);
    void serial(processQueue);
    return { ok: true };
  }
  if (message.type === "logout") {
    await db.auth.signOut({ scope: "local" });
    const data = await state();
    data.account = null;
    data.message = "";
    await save(data);
    return { ok: true };
  }
  if (message.type === "toggle") {
    const data = await state();
    data.enabled = Boolean(message.enabled);
    await save(data);
    if (data.enabled) void serial(processQueue);
    return { ok: true };
  }
  if (["retry", "discard", "date"].includes(message.type)) {
    const data = await state();
    const item = data.queue.find(
      (entry) => entry.id === message.id && entry.uid === data.account?.id,
    );
    if (message.type !== "retry" && !item)
      throw new Error("Pending result not found.");
    if (message.type === "discard")
      data.queue = data.queue.filter((entry) => entry !== item);
    if (message.type === "date") {
      const value = message.date;
      if (
        typeof value !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
        new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) !== value
      )
        throw new Error("Choose a valid challenge date.");
      item.challenge_date = value;
      item.status = "pending";
      item.message = "";
    }
    if (message.type === "retry")
      for (const entry of data.queue)
        if (entry.uid === data.account?.id && entry.status === "review")
          entry.status = "pending";
    await save(data);
    void serial(processQueue);
    return { ok: true };
  }
  throw new Error("Unknown action.");
}
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  serial(() => handle(message, sender)).then(respond, (error) =>
    respond({ error: error.message || "Something went wrong." }),
  );
  return true;
});
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "retry-imports") void serial(processQueue);
});
chrome.runtime.onStartup.addListener(() => {
  void serial(processQueue);
});
void ready.then(() =>
  chrome.alarms.create("retry-imports", { periodInMinutes: 1 }),
);
