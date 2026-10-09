import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  ArrowUpRight,
  CalendarDays,
  Check,
  Clock3,
  Flag,
  LogIn,
  Plus,
  RefreshCw,
  Trophy,
  Users,
  X,
  Pencil,
  Trash2,
  Settings,
  Camera,
  Moon,
  Sun,
} from "lucide-react";
import { accountAction, configured, db, emailFor, readAll } from "./api";
import {
  madridToday,
  ranked,
  standings,
  europeanDate,
  parseEuropeanDate,
} from "./scoring";
import type { Game, Profile, Result, Standing } from "./types";
const number = new Intl.NumberFormat("en");
const gameTitle = (g: Game) =>
  g.kind === "daily" ? `Daily · ${europeanDate(g.daily_date!)}` : g.name!;
function ThemeToggle() {
  const [dark, setDark] = useState(
    document.documentElement.dataset.theme !== "light",
  );
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", dark ? "#111512" : "#f6f5f0");
    try {
      localStorage.setItem("theme", dark ? "dark" : "light");
    } catch {}
  }, [dark]);
  return (
    <button
      className="icon-button theme-toggle"
      role="switch"
      aria-label="Dark mode"
      aria-checked={dark}
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => setDark(!dark)}
    >
      {dark ? <Sun size={20} /> : <Moon size={20} />}
    </button>
  );
}
function Avatar({
  profile,
  large = false,
}: {
  profile?: Profile;
  large?: boolean;
}) {
  const image =
    profile?.avatar_path &&
    db?.storage.from("avatars").getPublicUrl(profile.avatar_path).data
      .publicUrl;
  return (
    <span className={`avatar ${large ? "large" : ""}`}>
      {image ? (
        <img src={image} alt="" />
      ) : (
        (profile?.display_name || "?").slice(0, 2).toUpperCase()
      )}
    </span>
  );
}
function Board({ rows, kind }: { rows: Standing[]; kind: "wins" | "points" }) {
  const [relative, setRelative] = useState(false);
  const metric =
    kind === "wins"
      ? relative
        ? "winRate"
        : "wins"
      : relative
        ? "average"
        : "points";
  return (
    <section className="board">
      <div className="board-top">
        <span className={`icon-box ${kind}`}>
          {kind === "wins" ? <Trophy size={22} /> : <Flag size={22} />}
        </span>
        <span className="eyebrow">
          {kind === "wins" ? "SURVIVORS’ GUILT" : "NUMBERS FOR YOUR OBITUARY"}
        </span>
      </div>
      <div className="board-heading">
        <h2>
          {kind === "wins"
            ? relative
              ? "Win percentage"
              : "Most wins"
            : relative
              ? "Average points"
              : "Most points"}
        </h2>
        <label className="switch-label">
          <span>Per game</span>
          <input
            type="checkbox"
            role="switch"
            checked={relative}
            onChange={(e) => setRelative(e.target.checked)}
          />
          <span className="switch" />
        </label>
      </div>
      <p className="board-description">
        {kind === "wins"
          ? relative
            ? "Win rate. For anyone blaming their lack of free time."
            : "The body count. Egos, mostly."
          : relative
            ? "Points per game. A smaller sample of the same tragedy."
            : "All your points. Still not a personality."}
      </p>
      <div className="table-head">
        <span>PLAYER</span>
        <span>PLAYED</span>
        <span>
          {relative
            ? kind === "wins"
              ? "WIN %"
              : "AVG. PTS"
            : kind === "wins"
              ? "WINS"
              : "POINTS"}
        </span>
      </div>
      {!rows.length ? (
        <div className="empty">
          <Users size={28} />
          <strong>No victims yet.</strong>
          <span>Log a game. Give us something to bury.</span>
        </div>
      ) : (
        ranked(rows, metric).map((p) => (
          <div className="player-row" key={p.id}>
            <div className="player">
              <span className={`rank ${p.rank === 1 ? "first" : ""}`}>
                {p.rank ?? "—"}
              </span>
              <Avatar profile={p} />
              <span>
                <strong>{p.display_name}</strong>
                <small>@{p.username}</small>
              </span>
            </div>
            <span className="played">{p.games}</span>
            <strong className="score">
              {!p.games
                ? "—"
                : relative
                  ? kind === "wins"
                    ? `${p.winRate.toFixed(1)}%`
                    : number.format(Math.round(p.average))
                  : number.format(p[kind])}
            </strong>
          </div>
        ))
      )}
      <div className="board-foot">
        <span className="dot" /> All-time standings
        {relative && <span> · No minimum games</span>}
      </div>
    </section>
  );
}
function Modal({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", handler);
    const previous = document.activeElement as HTMLElement;
    const el = document.querySelector<HTMLElement>(".modal");
    el?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !el) return;
      const targets = [
        ...el.querySelectorAll<HTMLElement>(
          'button, input, select, a[href], [tabindex="0"]',
        ),
      ].filter((n) => !n.hasAttribute("disabled"));
      const first = targets[0],
        last = targets.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    el?.addEventListener("keydown", trap);
    return () => {
      window.removeEventListener("keydown", handler);
      el?.removeEventListener("keydown", trap);
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
      >
        <div className="modal-heading">
          <h2>{title}</h2>
          <button className="icon-button" onClick={close} aria-label="Close">
            <X />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
export default function App() {
  const [profiles, setProfiles] = useState<Profile[]>([]),
    [games, setGames] = useState<Game[]>([]),
    [results, setResults] = useState<Result[]>([]);
  const [historyPage, setHistoryPage] = useState(0);
  const [session, setSession] = useState<Session | null>(null),
    [admin, setAdmin] = useState(false),
    [loading, setLoading] = useState(configured),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [modal, setModal] = useState<
    "login" | "score" | "profile" | "admin" | null
  >(location.hash.startsWith("#invite=") ? "login" : null);
  const [busy, setBusy] = useState(false),
    [invite, setInvite] = useState(
      location.hash.startsWith("#invite=") ? location.hash.slice(8) : "",
    ),
    [inviteLink, setInviteLink] = useState("");
  const [username, setUsername] = useState(""),
    [password, setPassword] = useState(""),
    [displayName, setDisplayName] = useState("");
  const [kind, setKind] = useState<"daily" | "custom">("daily"),
    [date, setDate] = useState(europeanDate(madridToday())),
    [selectedGame, setSelectedGame] = useState(""),
    [gameName, setGameName] = useState(""),
    [points, setPoints] = useState(""),
    [edit, setEdit] = useState<Result | null>(null),
    [resetPlayer, setResetPlayer] = useState("");
  const me = profiles.find((p) => p.id === session?.user.id);
  const close = () => {
    setModal(null);
    setError("");
    setPassword("");
    setInviteLink("");
  };
  async function load() {
    if (!db) return;
    setLoading(true);
    try {
      const all = await Promise.all([
        readAll<Profile>("profiles"),
        readAll<Game>("games"),
        readAll<Result>("results"),
      ]);
      setProfiles(all[0]);
      setGames(all[1]);
      setResults(all[2]);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not load scores. Please retry.",
      );
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    if (!db) return;
    db.auth.getSession().then(({ data, error }) => {
      if (error) setError(error.message);
      setSession(data.session);
    });
    const { data } = db.auth.onAuthStateChange((_event, value) =>
      setSession(value),
    );
    void load();
    const refresh = () => {
      void load();
    };
    window.addEventListener("focus", refresh);
    const timer = window.setInterval(refresh, 60000);
    return () => {
      data.subscription.unsubscribe();
      window.removeEventListener("focus", refresh);
      clearInterval(timer);
    };
  }, []);
  useEffect(() => {
    setAdmin(false);
    if (session && db)
      db.from("administrators")
        .select("player_id")
        .eq("player_id", session.user.id)
        .maybeSingle()
        .then(({ data }) => setAdmin(Boolean(data)));
  }, [session]);
  async function run(work: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await work();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Something went wrong. Please retry.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function authenticate(event: FormEvent) {
    event.preventDefault();
    await run(async () => {
      if (!db)
        throw new Error("The club is waiting for its database connection.");
      if (invite)
        await accountAction({
          action: "redeem",
          token: invite,
          username,
          password,
        });
      const { error } = await db.auth.signInWithPassword({
        email: emailFor(username),
        password,
      });
      if (error) throw error;
      if (invite) {
        history.replaceState(null, "", location.pathname);
        setInvite("");
      }
      close();
      await load();
    });
  }
  function openScore(entry?: Result) {
    setEdit(entry || null);
    setPoints(entry ? String(entry.points) : "");
    setKind("daily");
    setDate(europeanDate(madridToday()));
    setSelectedGame("");
    setGameName("");
    setError("");
    setModal(session ? "score" : "login");
  }
  async function saveScore(event: FormEvent) {
    event.preventDefault();
    await run(async () => {
      if (!db || !session) throw new Error("Sign in first.");
      const value = Number(points);
      if (
        !points.trim() ||
        !Number.isInteger(value) ||
        value < 0 ||
        value > 2147483647
      )
        throw new Error(
          "Enter a whole-number score between 0 and 2,147,483,647.",
        );
      let gameId = edit?.game_id || (kind === "custom" ? selectedGame : "");
      const dailyDate = parseEuropeanDate(date);
      if (
        !edit &&
        kind === "daily" &&
        (!dailyDate || dailyDate > madridToday())
      )
        throw new Error(
          "Enter a real date in dd/mm/yy format, no later than today.",
        );
      if (!gameId) {
        const { data, error } = await db.rpc("get_or_create_game", {
          game_date: kind === "daily" ? dailyDate : null,
          game_name: kind === "custom" ? gameName.trim() : null,
        });
        if (error) throw error;
        gameId = data;
      }
      const playerId = edit?.player_id || session.user.id;
      const existing = results.find(
        (r) => r.game_id === gameId && r.player_id === playerId,
      );
      if (existing && !edit)
        throw new Error(
          "You already entered this game. Edit it in game history.",
        );
      const query = edit
        ? db
            .from("results")
            .update({ points: value })
            .eq("game_id", gameId)
            .eq("player_id", playerId)
        : db
            .from("results")
            .insert({ game_id: gameId, player_id: playerId, points: value });
      const { error } = await query;
      if (error) throw error;
      close();
      setNotice("Score saved. Evidence secured.");
      await load();
    });
  }
  async function deleteScore(entry: Result) {
    if (!confirm("Delete this score? The leaderboards will be recalculated."))
      return;
    await run(async () => {
      const { error } = await db!
        .from("results")
        .delete()
        .eq("game_id", entry.game_id)
        .eq("player_id", entry.player_id);
      if (error) throw error;
      await load();
    });
  }
  async function upload(file?: File) {
    if (!file || !me || !db) return;
    await run(async () => {
      if (
        !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
        file.size > 2097152
      )
        throw new Error("Choose a JPEG, PNG, or WebP image under 2 MB.");
      const path = `${me.id}/${crypto.randomUUID()}.${file.type.split("/")[1]}`;
      const { error } = await db!.storage.from("avatars").upload(path, file);
      if (error) throw error;
      const saved = await db!
        .from("profiles")
        .update({ avatar_path: path })
        .eq("id", me.id);
      if (saved.error) {
        await db!.storage.from("avatars").remove([path]);
        throw saved.error;
      }
      if (me.avatar_path)
        await db!.storage.from("avatars").remove([me.avatar_path]);
      await load();
      setNotice("New face. Same questionable guesses.");
    });
  }
  const rows = standings(profiles, results),
    playedGames = games.filter((g) => results.some((r) => r.game_id === g.id));
  const historyPages = Math.max(1, Math.ceil(playedGames.length / 10));
  const currentHistoryPage = Math.min(historyPage, historyPages - 1);
  useEffect(() => {
    setHistoryPage((page) => Math.min(page, historyPages - 1));
  }, [historyPages]);
  return (
    <>
      <header className="header">
        <a className="brand" href={import.meta.env.BASE_URL}>
          <span className="brand-icon">
            <Clock3 size={24} />
          </span>
          <span>
            timeguessr<span className="brand-club">club</span>
          </span>
        </a>
        <nav>
          <ThemeToggle />
          {session ? (
            <>
              <button
                className="profile-button"
                onClick={() => {
                  setDisplayName(me?.display_name || "");
                  setModal("profile");
                }}
              >
                <Avatar profile={me} />
                <span>{me?.display_name || "My profile"}</span>
              </button>
              {admin && (
                <button
                  className="icon-button"
                  aria-label="Manage club"
                  onClick={() => setModal("admin")}
                >
                  <Settings size={20} />
                </button>
              )}
            </>
          ) : (
            <button className="subtle-button" onClick={() => setModal("login")}>
              <LogIn size={17} /> Sign in
            </button>
          )}
          <a
            className="external"
            href="https://timeguessr.com"
            target="_blank"
            rel="noreferrer"
          >
            Play Timeguessr <ArrowUpRight size={16} />
          </a>
        </nav>
      </header>
      <main>
        <section className="intro">
          <div>
            <div className="eyebrow intro-label">
              <span className="dot" /> OUR GROUP CHAT, WITH EVIDENCE
            </div>
            <h1>
              History is dead.
              <br />
              <span>So is your score.</span>
            </h1>
            <p>
              Five guesses. Zero dignity.
              <br className="desktop-break" /> A permanent record of your mates
              being confidently wrong.
            </p>
          </div>
          <div className="intro-right">
            <div className="date-stamp">
              <CalendarDays size={16} />
              {europeanDate(madridToday())}
            </div>
            <button
              className="primary"
              onClick={() => openScore()}
              disabled={!configured}
            >
              <Plus size={19} /> Add your score
            </button>
            <span className="hint">
              Daily humiliation. Extra suffering available.
            </span>
          </div>
        </section>
        {!configured && (
          <div className="setup-notice">
            <Clock3 size={20} />
            <div>
              <strong>The scoreboard is clinically offline.</strong>
              <p>
                Shared scores and sign-in will be available once the database is
                connected.
              </p>
            </div>
          </div>
        )}
        {error && (
          <div className="alert" role="alert">
            {error}
            <button
              className="subtle-button"
              onClick={() => {
                setError("");
                void load();
              }}
              disabled={busy}
            >
              Retry
            </button>
          </div>
        )}
        {notice && (
          <div className="notice" role="status">
            <Check size={17} />
            {notice}
          </div>
        )}
        <div className="section-heading">
          <div>
            <h2>
              The standings <span className="pill">ALL TIME</span>
            </h2>
            <p>Someone has to finish last. We’re keeping receipts.</p>
          </div>
          <button
            className="icon-button"
            aria-label="Refresh standings"
            onClick={() => void load()}
            disabled={loading || !configured}
          >
            <RefreshCw size={18} className={loading ? "spin" : ""} />
          </button>
        </div>
        <div className="boards" aria-busy={loading}>
          <Board rows={rows} kind="wins" />
          <Board rows={rows} kind="points" />
        </div>
        <section className="history">
          <div className="section-heading">
            <div>
              <h2>
                Game history <span className="count">{playedGames.length}</span>
              </h2>
              <p>
                The evidence locker. Deleting your browser history won’t help.
              </p>
            </div>
            <span className="history-caption">
              <Users size={15} />
              {profiles.length} {profiles.length === 1 ? "player" : "players"}{" "}
              in the club
            </span>
          </div>
          {!playedGames.length ? (
            <div className="history-empty">
              <CalendarDays size={26} />
              <div>
                <strong>Suspiciously clean record.</strong>
                <p>Submit a score. Your dignity has had a good run.</p>
              </div>
              <button
                className="subtle-button"
                disabled={!configured}
                onClick={() => openScore()}
              >
                Add a score <Plus size={16} />
              </button>
            </div>
          ) : (
            [...playedGames]
              .sort((a, b) =>
                (b.daily_date || b.created_at).localeCompare(
                  a.daily_date || a.created_at,
                ),
              )
              .slice(currentHistoryPage * 10, (currentHistoryPage + 1) * 10)
              .map((game) => {
                const entries = results
                  .filter((r) => r.game_id === game.id)
                  .sort((a, b) => b.points - a.points);
                return (
                  <details className="game" key={game.id}>
                    <summary>
                      <span className={`game-icon ${game.kind}`}>
                        <CalendarDays size={19} />
                      </span>
                      <span className="game-info">
                        <strong>{gameTitle(game)}</strong>
                        <small>
                          {entries.length}{" "}
                          {entries.length === 1
                            ? "player · only submission so far"
                            : "players"}
                          {game.kind === "custom" ? " · non-daily" : ""}
                        </small>
                      </span>
                      <span className="winner">
                        <Trophy size={15} />
                        {entries
                          .filter((r) => r.points === entries[0].points)
                          .map(
                            (r) =>
                              profiles.find((p) => p.id === r.player_id)
                                ?.display_name,
                          )
                          .join(", ")}
                      </span>
                      <span className="game-points">
                        {number.format(entries[0].points)} <small>pts</small>
                      </span>
                    </summary>
                    <div className="game-results">
                      {entries.map((entry) => {
                        const profile = profiles.find(
                          (p) => p.id === entry.player_id,
                        );
                        return (
                          <div className="result" key={entry.player_id}>
                            <Avatar profile={profile} />
                            <span>{profile?.display_name}</span>
                            <strong>{number.format(entry.points)}</strong>
                            {(admin ||
                              entry.player_id === session?.user.id) && (
                              <>
                                <button
                                  className="icon-button"
                                  aria-label={`Edit ${profile?.display_name}'s score`}
                                  disabled={busy}
                                  onClick={() => openScore(entry)}
                                >
                                  <Pencil size={15} />
                                </button>
                                <button
                                  className="icon-button"
                                  aria-label={`Delete ${profile?.display_name}'s score`}
                                  disabled={busy}
                                  onClick={() => void deleteScore(entry)}
                                >
                                  <Trash2 size={15} />
                                </button>
                              </>
                            )}
                          </div>
                        );
                      })}
                      {session &&
                        !entries.some(
                          (r) => r.player_id === session.user.id,
                        ) && (
                          <button
                            className="subtle-button"
                            onClick={() => {
                              openScore();
                              setKind(game.kind);
                              setDate(
                                europeanDate(game.daily_date || madridToday()),
                              );
                              setSelectedGame(
                                game.kind === "custom" ? game.id : "",
                              );
                            }}
                          >
                            Add my score <Plus size={16} />
                          </button>
                        )}
                    </div>
                  </details>
                );
              })
          )}
          {historyPages > 1 && (
            <nav
              className="history-pagination"
              aria-label="Game history pagination"
            >
              <button
                className="subtle-button"
                disabled={currentHistoryPage === 0}
                onClick={() => setHistoryPage(currentHistoryPage - 1)}
              >
                Newer games
              </button>
              <span role="status">
                Page {currentHistoryPage + 1} of {historyPages}
              </span>
              <button
                className="subtle-button"
                disabled={currentHistoryPage === historyPages - 1}
                onClick={() => setHistoryPage(currentHistoryPage + 1)}
              >
                Older games
              </button>
            </nav>
          )}
        </section>
        <footer>
          <span>
            <Clock3 size={15} /> Time well wasted.
          </span>
          <span>Unofficial. Unqualified. Unreasonably competitive.</span>
        </footer>
      </main>
      {modal && (
        <Modal
          title={
            modal === "login"
              ? invite
                ? "You were warned."
                : "Back for more?"
              : modal === "score"
                ? edit
                  ? "Edit score"
                  : "Add your score"
                : modal === "profile"
                  ? "Your profile"
                  : "Manage the club"
          }
          close={close}
        >
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          {modal === "login" && (
            <form onSubmit={authenticate}>
              <p className="form-intro">
                {invite
                  ? "Pick a username and password. Your mates will handle the character assassination."
                  : "Sign in. The evidence won’t incriminate itself."}
              </p>
              <label>
                Username
                <input
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  pattern="[a-zA-Z0-9_]{3,24}"
                  minLength={3}
                  maxLength={24}
                />
              </label>
              <label>
                Password
                <input
                  type="password"
                  autoComplete={invite ? "new-password" : "current-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={invite ? 10 : undefined}
                  maxLength={128}
                  required
                />
              </label>
              <button className="primary full" disabled={busy || !configured}>
                {busy ? "One moment…" : invite ? "Create account" : "Sign in"}
              </button>
              <p className="hint">
                {invite
                  ? "Usernames use letters, numbers, and underscores."
                  : "Need an invite or a password reset? Ask your club administrator."}
              </p>
            </form>
          )}
          {modal === "score" && (
            <form onSubmit={saveScore}>
              {!edit ? (
                <>
                  <div className="segmented">
                    <button
                      type="button"
                      className={kind === "daily" ? "active" : ""}
                      onClick={() => setKind("daily")}
                    >
                      Daily game
                    </button>
                    <button
                      type="button"
                      className={kind === "custom" ? "active" : ""}
                      onClick={() => setKind("custom")}
                    >
                      Non-daily game
                    </button>
                  </div>
                  {kind === "daily" ? (
                    <div className="date-field">
                      <label htmlFor="challenge-date">Challenge date</label>
                      <div className="date-control">
                        <input
                          id="challenge-date"
                          type="text"
                          inputMode="numeric"
                          placeholder="dd/mm/yy"
                          value={date}
                          required
                          pattern="[0-9]{2}/[0-9]{2}/[0-9]{2}"
                          onChange={(e) => setDate(e.target.value)}
                        />
                        <span className="calendar-picker">
                          <CalendarDays size={20} aria-hidden="true" />
                          <input
                            type="date"
                            aria-label="Choose date from calendar"
                            value={parseEuropeanDate(date) || ""}
                            max={madridToday()}
                            onChange={(e) => {
                              if (e.target.value)
                                setDate(europeanDate(e.target.value));
                            }}
                          />
                        </span>
                      </div>
                      <small>dd/mm/yy · Madrid time.</small>
                    </div>
                  ) : (
                    <>
                      <label>
                        Game
                        <select
                          value={selectedGame}
                          onChange={(e) => setSelectedGame(e.target.value)}
                        >
                          <option value="">Create a new game</option>
                          {games
                            .filter((g) => g.kind === "custom")
                            .map((g) => (
                              <option key={g.id} value={g.id}>
                                {g.name} ·{" "}
                                {europeanDate(
                                  madridToday(new Date(g.created_at)),
                                )}
                              </option>
                            ))}
                        </select>
                      </label>
                      {!selectedGame && (
                        <label>
                          Game name
                          <input
                            value={gameName}
                            onChange={(e) => setGameName(e.target.value)}
                            placeholder="Friday night damage control"
                            required
                            maxLength={80}
                          />
                        </label>
                      )}
                    </>
                  )}
                </>
              ) : (
                <p className="form-intro">
                  {gameTitle(games.find((g) => g.id === edit.game_id)!)} ·{" "}
                  {profiles.find((p) => p.id === edit.player_id)?.display_name}
                </p>
              )}
              <label>
                Final points
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  max="2147483647"
                  step="1"
                  placeholder="e.g. 42500"
                  value={points}
                  onChange={(e) => setPoints(e.target.value)}
                  required
                />
              </label>
              <p className="hint">
                The highest score wins. Ties count as a win for each player.
                Standings update immediately.
              </p>
              <button className="primary full" disabled={busy}>
                {busy ? "Saving…" : "Save score"}
              </button>
            </form>
          )}
          {modal === "profile" && me && (
            <>
              <div className="profile-photo">
                <Avatar profile={me} large />
                <label className="subtle-button">
                  <Camera size={17} />
                  Change photo
                  <input
                    className="file-input"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={busy}
                    onChange={(e) => void upload(e.target.files?.[0])}
                  />
                </label>
                <small>JPEG, PNG, or WebP · up to 2 MB</small>
              </div>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void run(async () => {
                    const { error } = await db!
                      .from("profiles")
                      .update({ display_name: displayName.trim() })
                      .eq("id", me.id);
                    if (error) throw error;
                    await load();
                    setNotice("Display name saved.");
                    close();
                  });
                }}
              >
                <label>
                  Display name
                  <input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    required
                    maxLength={40}
                  />
                </label>
                <button className="primary full" disabled={busy}>
                  Save profile
                </button>
              </form>
              <form
                className="separated"
                onSubmit={(event) => {
                  event.preventDefault();
                  void run(async () => {
                    const { error } = await db!.auth.updateUser({ password });
                    if (error) throw error;
                    setPassword("");
                    setNotice("Password changed.");
                    close();
                  });
                }}
              >
                <label>
                  New password
                  <input
                    type="password"
                    autoComplete="new-password"
                    minLength={10}
                    maxLength={128}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </label>
                <button className="subtle-button" disabled={busy}>
                  Change password
                </button>
              </form>
              <button
                className="signout"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    const { error } = await db!.auth.signOut();
                    if (error) throw error;
                    close();
                  })
                }
              >
                Sign out
              </button>
            </>
          )}
          {modal === "admin" && (
            <>
              <p className="form-intro">
                Recruit another victim. Single-use links expire after seven
                days.
              </p>
              <button
                className="primary full"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    const data = await accountAction({ action: "invite" });
                    setInviteLink(
                      `${location.origin}${location.pathname}#invite=${data.token}`,
                    );
                  })
                }
              >
                <Plus size={17} />
                Create invitation
              </button>
              {inviteLink && (
                <label>
                  Invitation link
                  <input
                    readOnly
                    value={inviteLink}
                    onFocus={(e) => e.target.select()}
                  />
                  <button
                    className="subtle-button"
                    onClick={() =>
                      void run(async () => {
                        await navigator.clipboard.writeText(inviteLink);
                        setNotice("Invitation copied.");
                      })
                    }
                  >
                    Copy link
                  </button>
                </label>
              )}
              <form
                className="separated"
                onSubmit={(event) => {
                  event.preventDefault();
                  void run(async () => {
                    await accountAction({
                      action: "reset-password",
                      player_id: resetPlayer,
                      password,
                    });
                    setPassword("");
                    setNotice(
                      "Password reset. Share it privately and ask the player to change it.",
                    );
                    close();
                  });
                }}
              >
                <h3>Reset a player’s password</h3>
                <label>
                  Player
                  <select
                    required
                    value={resetPlayer}
                    onChange={(e) => setResetPlayer(e.target.value)}
                  >
                    <option value="">Select a player</option>
                    {profiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.display_name} (@{p.username})
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Temporary password
                  <input
                    type="password"
                    autoComplete="new-password"
                    minLength={10}
                    maxLength={128}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </label>
                <button className="subtle-button" disabled={busy}>
                  Reset password
                </button>
              </form>
            </>
          )}
        </Modal>
      )}
    </>
  );
}
