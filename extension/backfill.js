const origin = "https://timeguessr.com";
const replayPattern = /^[a-f0-9]{64}:[a-f0-9]{32}$/i;

// Read only the fields we need from SvelteKit's indexed JSON data. Never execute
// page scripts or deserialize arbitrary tagged objects from the remote site.
function pageData(payload) {
  const node = payload?.nodes?.at(-1);
  const values =
    node?.type === "data" && Array.isArray(node.data) ? node.data : [];
  const value = (ref) =>
    Number.isInteger(ref) && ref >= 0 && ref < values.length
      ? values[ref]
      : undefined;
  const field = (ref, name) => {
    const object = value(ref);
    return object &&
      typeof object === "object" &&
      !Array.isArray(object) &&
      Object.hasOwn(object, name)
      ? object[name]
      : undefined;
  };
  const array = (ref) => (Array.isArray(value(ref)) ? value(ref) : []);
  return { value, field, array };
}

function answersFromPage(data) {
  const images = data.array(data.field(0, "playArray")).slice(0, 5);
  if (images.length !== 5) return null;
  const answers = images.map((ref) => {
    const raw = data.value(data.field(ref, "Year"));
    const year =
      typeof raw === "string" && /^\d{1,4}$/.test(raw) ? Number(raw) : raw;
    const locationRef = data.field(ref, "Location");
    const lat = data.value(data.field(locationRef, "lat"));
    const lng = data.value(data.field(locationRef, "lng"));
    return {
      actual_year:
        Number.isInteger(year) && year >= 1 && year <= 9999 ? year : null,
      actual_location:
        typeof lat === "number" &&
        Number.isFinite(lat) &&
        Math.abs(lat) <= 90 &&
        typeof lng === "number" &&
        Number.isFinite(lng) &&
        Math.abs(lng) <= 180
          ? { lat, lng }
          : null,
    };
  });
  return answers.some(
    (a) => a.actual_year !== null || a.actual_location !== null,
  )
    ? answers
    : null;
}

/** Fetch original photograph answers for an identified saved game, without playing or submitting guesses. */
export async function fetchGameAnswers(game, request = fetch) {
  async function read(path) {
    const response = await request(`${origin}${path}`, {
      credentials: "omit",
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok)
      return {
        error:
          response.status === 429 || response.status >= 500
            ? "retry"
            : "unavailable",
      };
    return { data: pageData(await response.json()) };
  }
  try {
    let source;
    let identity;
    if (
      game.kind === "daily" &&
      /^\d{4}-\d{2}-\d{2}$/.test(game.daily_date ?? "")
    ) {
      const archive = await read(
        `/archive/__data.json?month=${game.daily_date.slice(0, 7)}`,
      );
      if (archive.error)
        return {
          status: archive.error,
          message: "Timeguessr’s archive is unavailable. Will retry.",
        };
      const data = archive.data;
      const days = data.array(data.field(data.field(0, "archive"), "days"));
      const day = days.find(
        (ref) => data.value(data.field(ref, "date")) === game.daily_date,
      );
      const link = data.value(data.field(day, "link"));
      identity = data.value(data.field(day, "dailyNumber"));
      // The archive publishes a signed identity. Do not construct or guess it.
      const match =
        typeof link === "string"
          ? /^\/play\?mode=daily&archive=(\d+-[a-f0-9]+)$/.exec(link)
          : null;
      const current =
        link === "/play?mode=daily" &&
        data.value(data.field(day, "isToday")) === true;
      if (
        !Number.isInteger(identity) ||
        !(current || (match && match[1].startsWith(`${identity}-`)))
      )
        return {
          status: "unavailable",
          message: "This daily is not available in Timeguessr’s archive yet.",
        };
      // The current daily has no signed archive token yet. Its dated archive
      // month is stable provenance; verify every returned picture's daily number.
      source = current
        ? `${origin}/archive?month=${game.daily_date.slice(0, 7)}`
        : `${origin}${link}`;
      const response = await read(
        current
          ? "/play/__data.json?mode=daily"
          : `/play/__data.json?mode=daily&archive=${match[1]}`,
      );
      if (response.error)
        return {
          status: response.error,
          message: "Timeguessr’s original daily answers are unavailable.",
        };
      const images = response.data
        .array(response.data.field(0, "playArray"))
        .slice(0, 5);
      if (
        response.data.value(response.data.field(0, "mode")) !== "daily" ||
        images.length !== 5 ||
        images.some(
          (ref) =>
            String(response.data.value(response.data.field(ref, "No"))) !==
            String(identity),
        )
      )
        return {
          status: "unavailable",
          message: "Timeguessr’s daily identity could not be verified.",
        };
      const answers = answersFromPage(response.data);
      return answers
        ? { status: "ready", answers, source }
        : {
            status: "unavailable",
            message: "Timeguessr did not return photograph answers.",
          };
    }
    const replay = game.replay_id || game.name;
    if (
      game.kind !== "custom" ||
      typeof replay !== "string" ||
      !replayPattern.test(replay)
    )
      return {
        status: "unavailable",
        message: "This game has no recoverable Timeguessr replay ID.",
      };
    const id = replay.toLowerCase();
    const response = await read(
      `/game-settings/__data.json?RA=${encodeURIComponent(id)}`,
    );
    if (response.error)
      return {
        status: response.error,
        message: "Timeguessr’s original replay answers are unavailable.",
      };
    const refs = response.data.array(response.data.field(0, "playArray"));
    if (
      refs.slice(5, 7).map(response.data.value).join(":").toLowerCase() !== id
    )
      return {
        status: "unavailable",
        message: "Timeguessr’s replay identity could not be verified.",
      };
    source = `${origin}/game-settings?RA=${encodeURIComponent(id)}`;
    const answers = answersFromPage(response.data);
    return answers
      ? { status: "ready", answers, source }
      : {
          status: "unavailable",
          message: "Timeguessr did not return photograph answers.",
        };
  } catch {
    return {
      status: "retry",
      message: "Could not read Timeguessr’s original answers. Will retry.",
    };
  }
}
