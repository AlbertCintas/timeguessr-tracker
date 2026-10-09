import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  Download,
  ArrowUpRight,
  CalendarDays,
  Check,
  Clock3,
  CircleHelp,
  Shuffle,
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
  periodLabels,
  resultsForPeriod,
  type StandingsPeriod,
} from "./scoring";
import type { Game, Profile, Result, Standing, PictureResult } from "./types";
import { parseTimeguessrResults } from "./importResults";
import { shameMetrics, shameRankings, type ShameMetric } from "./shame";
import { PictureBreakdown } from "./PictureBreakdown";
import {
  gameReplayUrl,
  timeguessrGameId,
  unplayedReplayGames,
} from "./gameLinks";
const number = new Intl.NumberFormat("en");
const gameTitle = (g: Game) =>
  g.kind === "daily" ? `Daily · ${europeanDate(g.daily_date!)}` : g.name!;
function HelpTooltip({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <span
      className="extension-help"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      onKeyDown={(event) => {
        if (event.key === "Escape") setOpen(false);
      }}
    >
      <button
        className="icon-button"
        aria-label={label}
        aria-describedby={open ? id : undefined}
      >
        <CircleHelp size={18} />
      </button>
      {open && (
        <span id={id} role="tooltip">
          {children}
        </span>
      )}
    </span>
  );
}
function PendingExtensionInstall() {
  const [open, setOpen] = useState(false);
  return (
    <span
      className="extension-help extension-store-pending"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setOpen(false);
          event.stopPropagation();
        }
      }}
    >
      <button
        type="button"
        className="primary extension-download"
        aria-disabled="true"
        aria-describedby={open ? "extension-store-status" : undefined}
        onClick={() => setOpen(true)}
      >
        <Download size={18} /> Install in browser
      </button>
      {open && (
        <span id="extension-store-status" role="tooltip">
          The extension is waiting for store approval. Until then, use the
          manual installation option below.
        </span>
      )}
    </span>
  );
}
function BrowserAddress({ address }: { address: string }) {
  const [status, setStatus] = useState("");
  return (
    <>
      <button
        type="button"
        className="browser-address"
        aria-label={`Copy ${address}`}
        title="Copy address"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(address);
            setStatus("Copied — paste into the address bar.");
          } catch {
            setStatus(
              "Couldn’t copy. Select the address and copy it manually.",
            );
          }
        }}
      >
        <code>{address}</code>
      </button>
      {status && (
        <span className="hint" role="status">
          {" "}
          {status}
        </span>
      )}
    </>
  );
}
function ManualExtensionInstall() {
  const firefox = /Firefox\//i.test(navigator.userAgent);
  return (
    <>
      <h3>Manual installation — {firefox ? "Firefox" : "Chrome / Edge"}</h3>
      <p>
        For desktop {firefox ? "Firefox" : "Chrome and Edge"}. This version
        installs from a ZIP, so the browser needs a few clicks from you.
      </p>
      <a
        className="primary extension-download"
        href={
          firefox
            ? "/timeguessr-tracker/downloads/timeguessr-firefox-extension-latest.zip"
            : "/timeguessr-tracker/downloads/timeguessr-extension-latest.zip"
        }
        download={
          firefox
            ? "timeguessr-firefox-extension.zip"
            : "timeguessr-extension.zip"
        }
      >
        <Download size={18} /> Download {firefox ? "Firefox" : "Chrome / Edge"}{" "}
        extension ZIP
      </a>
      <ol>
        <li>Extract the ZIP into a folder you’ll keep.</li>
        {firefox ? (
          <>
            <li>
              Copy{" "}
              <BrowserAddress address="about:debugging#/runtime/this-firefox" />{" "}
              and paste it into Firefox’s address bar.
            </li>
            <li>
              Click <strong>Load Temporary Add-on</strong> and select{" "}
              <code>manifest.json</code> inside the extracted folder.
            </li>
          </>
        ) : (
          <>
            <li>
              Copy <BrowserAddress address="chrome://extensions" /> for Chrome,
              or <BrowserAddress address="edge://extensions" /> for Edge, and
              paste it into the address bar.
            </li>
            <li>
              Turn on <strong>Developer mode</strong>, click{" "}
              <strong>Load unpacked</strong>, and choose the extracted folder.
            </li>
          </>
        )}
        <li>
          Pin the extension, open it and sign in with your tracker username and
          password.
        </li>
        <li>
          Finish all five pictures on Timeguessr and leave the results page open
          until captured. If it was already open during installation, refresh
          it.
        </li>
      </ol>
      {firefox && (
        <p>
          This unsigned Firefox version is temporary. After restarting Firefox,
          load it again through <code>about:debugging</code>.
        </p>
      )}
      <p>
        Scores import automatically. Conflicting scores stay untouched and
        appear for review in the extension. Mobile browsers cannot install this
        version.
      </p>
      <p className="hint">
        To update, download the latest ZIP, replace the extracted files, then
        click Reload on the browser’s{" "}
        {firefox ? "about:debugging" : "extensions"} page.
      </p>
    </>
  );
}
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
function Board({
  rows,
  kind,
  period,
}: {
  rows: Standing[];
  kind: "wins" | "points";
  period: StandingsPeriod;
}) {
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
        <span className="dot" /> {periodLabels[period]} standings
        {relative && <span> · No minimum games</span>}
      </div>
    </section>
  );
}
function ShameBoard({
  profiles,
  results,
  games,
}: {
  profiles: Profile[];
  results: Result[];
  games: Game[];
}) {
  return (
    <section className="shame-section" aria-labelledby="shame-heading">
      <div className="section-heading">
        <div>
          <h2 id="shame-heading">The hall of shame</h2>
          <p>Your mates forget. The database doesn’t.</p>
        </div>
      </div>
      <div className="board shame-board">
        <table className="shame-table" aria-label="Hall of shame records">
          <thead>
            <tr>
              <th scope="col">The charge</th>
              <th scope="col">The guilty</th>
              <th scope="col">The damage</th>
            </tr>
          </thead>
          <tbody>
            {(Object.keys(shameMetrics) as ShameMetric[]).map((metric) => {
              const definition = shameMetrics[metric];
              const rows = shameRankings(profiles, results, metric);
              if (metric === "zeros" && !rows.some((row) => row.value > 0))
                return null;
              const winners = rows.filter((row) => row.rank === 1);
              return (
                <tr key={metric} data-metric={metric}>
                  <th scope="row" title={definition.description}>
                    {definition.label}
                  </th>
                  <td>
                    {winners.length ? (
                      winners.map((row) => {
                        const game = games.find(
                          (item) => item.id === row.gameId,
                        );
                        return (
                          <div className="shame-holder" key={row.id}>
                            <Avatar profile={row} />
                            <div className="shame-player">
                              <strong>{row.display_name}</strong>
                              <small>
                                {game
                                  ? `${gameTitle(game)}${row.picture ? ` · picture ${row.picture}` : ""}`
                                  : `${row.samples} pictures recorded`}
                              </small>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <span className="shame-missing">
                        {metric === "worstGame"
                          ? "No scores yet"
                          : "No picture details yet"}
                      </span>
                    )}
                  </td>
                  <td className="shame-value">
                    {winners.length ? (
                      <>
                        {new Intl.NumberFormat("en", {
                          maximumFractionDigits: 3,
                        }).format(winners[0].value)}{" "}
                        <small>{definition.unit}</small>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="board-foot">
          Ties share the blame. Picture records use detailed results only.
        </div>
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
          'button, input, select, textarea, a[href], [tabindex="0"]',
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
  const [standingsPeriod, setStandingsPeriod] =
    useState<StandingsPeriod>("all");
  const [scoreMode, setScoreMode] = useState<"manual" | "paste">("paste");
  const [shareText, setShareText] = useState("");
  const [importRead, setImportRead] = useState(false);
  const [pasteError, setPasteError] = useState("");
  const [pictureRounds, setPictureRounds] = useState<PictureResult[] | null>(
    null,
  );
  const [dailyNumber, setDailyNumber] = useState<number | null>(null);
  const [session, setSession] = useState<Session | null>(null),
    [admin, setAdmin] = useState(false),
    [loading, setLoading] = useState(configured),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [modal, setModal] = useState<
    "login" | "score" | "profile" | "admin" | "extension" | null
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
    setScoreMode(entry ? "manual" : "paste");
    setPasteError("");
    setShareText("");
    setImportRead(false);
    setPictureRounds(entry?.rounds ?? null);
    setDailyNumber(entry?.daily_number ?? null);
    setPoints(entry ? String(entry.points) : "");
    setKind("daily");
    setDate(europeanDate(madridToday()));
    setSelectedGame("");
    setGameName("");
    setError("");
    setModal(session ? "score" : "login");
  }
  function updateShareText(text: string) {
    setShareText(text);
    setImportRead(false);
    setPictureRounds(null);
    setDailyNumber(null);
    setPoints("");
    setError("");
    setPasteError("");
    if (!text.trim()) return;
    try {
      const parsed = parseTimeguessrResults(text);
      setPoints(String(parsed.points));
      setPictureRounds(parsed.rounds);
      setDailyNumber(parsed.dailyNumber);
      setImportRead(true);
    } catch (error) {
      setPasteError(
        error instanceof Error ? error.message : "Could not read results.",
      );
    }
  }
  async function saveScore(event: FormEvent) {
    event.preventDefault();
    await run(async () => {
      if (!db || !session) throw new Error("Sign in first.");
      if (scoreMode === "paste" && !importRead)
        throw new Error("Paste valid Timeguessr results before saving.");
      const value = Number(points);
      if (
        pictureRounds &&
        pictureRounds.reduce((sum, round) => sum + round.points, 0) !== value
      )
        throw new Error(
          "The total must match the picture scores. Remove picture details to enter a different total manually.",
        );
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
        const customId = kind === "custom" ? timeguessrGameId(gameName) : null;
        if (kind === "custom" && !customId)
          throw new Error(
            "Paste the full Timeguessr game link or ID, including both parts separated by a colon.",
          );
        const { data, error } = await db.rpc("get_or_create_game", {
          game_date: kind === "daily" ? dailyDate : null,
          game_name: customId,
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
            .update({
              points: value,
              rounds: pictureRounds,
              daily_number: dailyNumber,
            })
            .eq("game_id", gameId)
            .eq("player_id", playerId)
        : db.from("results").insert({
            game_id: gameId,
            player_id: playerId,
            points: value,
            rounds: pictureRounds,
            daily_number: dailyNumber,
          });
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
  const rows = standings(
      profiles,
      resultsForPeriod(games, results, standingsPeriod),
    ).filter((player) => player.games > 0),
    playedGames = games.filter((g) => results.some((r) => r.game_id === g.id));
  const historyPages = Math.max(1, Math.ceil(playedGames.length / 10));
  const randomGames = unplayedReplayGames(
    games,
    results,
    session?.user.id || null,
  );
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
            <div className="extension-actions">
              <button
                className="subtle-button"
                disabled={
                  !configured || loading || (!!session && !randomGames.length)
                }
                onClick={() => {
                  if (!session) {
                    setModal("login");
                    return;
                  }
                  const selected =
                    randomGames[Math.floor(Math.random() * randomGames.length)];
                  if (selected)
                    window.open(selected.url, "_blank", "noopener,noreferrer");
                }}
              >
                <Shuffle size={17} /> Play random unplayed game
              </button>
              <HelpTooltip
                id="random-game-tooltip"
                label="How does random unplayed game work?"
              >
                {!session
                  ? "Sign in to find games you haven’t recorded a score for. "
                  : !randomGames.length
                    ? "No unplayed games with replay links are available. "
                    : ""}
                Picks a random game from the club’s full history that someone
                has played and you haven’t submitted a score for. Only games
                with replay links are included. Opens Timeguessr in a new tab;
                it counts as played once your score is saved here.
              </HelpTooltip>
            </div>
            <div className="extension-actions">
              <button
                className="subtle-button"
                onClick={() => setModal("extension")}
              >
                <Download size={17} /> Install browser extension
              </button>
              <HelpTooltip
                id="extension-help-tooltip"
                label="What does the browser extension do?"
              >
                Automatically saves your completed Timeguessr games, including
                picture scores, year errors and distances, to this friends’
                scoreboard. Sign in with your tracker account and keep the
                results page open until captured. You can pause imports at any
                time.
              </HelpTooltip>
            </div>
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
        <div className="section-heading standings-heading">
          <div>
            <h2>The standings</h2>
            <p>Someone has to finish last. We’re keeping receipts.</p>
          </div>
          <div className="standings-controls">
            <label className="period-picker">
              <span>Period</span>
              <select
                aria-label="Standings period"
                value={standingsPeriod}
                onChange={(e) =>
                  setStandingsPeriod(e.target.value as StandingsPeriod)
                }
              >
                {Object.entries(periodLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="icon-button"
              aria-label="Refresh standings"
              onClick={() => void load()}
              disabled={loading || !configured}
            >
              <RefreshCw size={18} className={loading ? "spin" : ""} />
            </button>
          </div>
        </div>
        <div className="boards" aria-busy={loading}>
          <Board rows={rows} kind="wins" period={standingsPeriod} />
          <Board rows={rows} kind="points" period={standingsPeriod} />
        </div>
        <ShameBoard profiles={profiles} results={results} games={games} />
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
                (b.daily_date || b.played_on || b.created_at).localeCompare(
                  a.daily_date || a.played_on || a.created_at,
                ),
              )
              .slice(currentHistoryPage * 10, (currentHistoryPage + 1) * 10)
              .map((game) => {
                const replayUrl = gameReplayUrl(game);
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
                        {session &&
                          replayUrl &&
                          !entries.some(
                            (entry) => entry.player_id === session.user.id,
                          ) && (
                            <a
                              className="game-play-link"
                              href={replayUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(event) => event.stopPropagation()}
                              aria-label={`Play ${gameTitle(game)} on Timeguessr`}
                            >
                              Play game <ArrowUpRight size={14} />
                            </a>
                          )}
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
                          <div className="result-entry" key={entry.player_id}>
                            <div className="result">
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
                            {entry.rounds && (
                              <details className="result-breakdown">
                                <summary>
                                  {profile?.display_name}’s picture breakdown
                                  {entry.daily_number
                                    ? ` · #${entry.daily_number}`
                                    : ""}
                                </summary>
                                <PictureBreakdown rounds={entry.rounds} />
                              </details>
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
          <a href="/timeguessr-tracker/about.html">About</a>
          <a href="/timeguessr-tracker/privacy.html">Privacy</a>
        </footer>
      </main>
      {modal && (
        <Modal
          title={
            modal === "extension"
              ? "Let the evidence collect itself."
              : modal === "login"
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
          {modal === "extension" && (
            <div className="extension-install">
              <p className="form-intro">
                Finish a game. Let the extension report the damage. Daily and
                non-daily games, all five pictures included.
              </p>
              <PendingExtensionInstall />
              <ManualExtensionInstall />
            </div>
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
              <div className="segmented" aria-label="Score entry method">
                <button
                  type="button"
                  aria-pressed={scoreMode === "paste"}
                  className={scoreMode === "paste" ? "active" : ""}
                  onClick={() => {
                    setScoreMode("paste");
                    setError("");
                    if (shareText.trim()) updateShareText(shareText);
                    else setImportRead(false);
                  }}
                >
                  Paste results
                </button>
                <button
                  type="button"
                  aria-pressed={scoreMode === "manual"}
                  className={scoreMode === "manual" ? "active" : ""}
                  onClick={() => {
                    setScoreMode("manual");
                    setError("");
                  }}
                >
                  Manual entry
                </button>
              </div>
              {scoreMode === "paste" && (
                <div className="paste-results">
                  <label>
                    Timeguessr share text
                    <textarea
                      value={shareText}
                      maxLength={10000}
                      rows={7}
                      placeholder="Paste your Timeguessr results here — we’ll read them automatically."
                      onChange={(e) => updateShareText(e.target.value)}
                    />
                  </label>
                  <p className="hint">
                    Share results → Detailed includes picture stats. Emoji-grid
                    shares include the total only.
                  </p>
                  {pasteError && (
                    <p className="form-error" role="alert">
                      {pasteError}
                    </p>
                  )}
                  {importRead && (
                    <div className="paste-summary" role="status">
                      <Check size={19} />
                      <div>
                        <strong>{number.format(Number(points))} points</strong>
                        <span>
                          {pictureRounds
                            ? "All 5 pictures imported."
                            : "Total imported. No picture details in this share."}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {dailyNumber !== null && (
                <p className="form-intro">
                  Timeguessr #{dailyNumber}.{" "}
                  {edit
                    ? "Check this is the same challenge before saving."
                    : "The share text has no date. Check the challenge date below before saving."}
                </p>
              )}
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
                                  g.played_on ||
                                    madridToday(new Date(g.created_at)),
                                )}
                              </option>
                            ))}
                        </select>
                      </label>
                      {!selectedGame && (
                        <label>
                          Timeguessr game ID or link
                          <input
                            value={gameName}
                            onChange={(e) => setGameName(e.target.value)}
                            placeholder="https://timeguessr.com/game-settings?RA=…"
                            required
                            maxLength={2048}
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
              {scoreMode === "manual" && (
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
              )}
              <p className="hint">
                The highest score wins. Ties count as a win for each player.
                Standings update immediately.
              </p>
              {pictureRounds && (scoreMode === "manual" || importRead) && (
                <div className="import-preview">
                  <PictureBreakdown rounds={pictureRounds} />
                  <button
                    type="button"
                    className="subtle-button"
                    onClick={() => {
                      setPictureRounds(null);
                      setScoreMode("manual");
                    }}
                  >
                    Remove picture details
                  </button>
                </div>
              )}
              <button
                className="primary full"
                disabled={busy || (scoreMode === "paste" && !importRead)}
              >
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
