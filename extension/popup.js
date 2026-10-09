const $ = (id) => document.getElementById(id);
const labels = {
  saved: "Saved",
  enriched: "Picture details added",
  already_saved: "Already saved",
  pending: "Pending upload",
  conflict: "Needs review",
  review: "Needs review",
  date_review: "Check challenge date",
};
async function send(type, fields = {}) {
  const response = await chrome.runtime.sendMessage({ type, ...fields });
  if (response?.error) throw new Error(response.error);
  return response;
}
function showError(error) {
  $("error").textContent = error.message;
  $("error").hidden = false;
}
function button(text, action) {
  const el = document.createElement("button");
  el.textContent = text;
  el.className = "quiet";
  el.onclick = () => {
    el.disabled = true;
    action()
      .then(render)
      .catch(showError)
      .finally(() => {
        el.disabled = false;
      });
  };
  return el;
}
async function render() {
  const data = await send("state");
  $("login").hidden = Boolean(data.account);
  $("connected").hidden = !data.account;
  if (!data.account) return;
  $("player").textContent = data.account.username;
  $("enabled").checked = data.enabled;
  $("message").textContent =
    data.message ||
    (!data.enabled
      ? "Auto-import is paused."
      : "Waiting for the next crime against geography.");
  $("imports").replaceChildren();
  const items = [...data.queue, ...data.history].slice(0, 30);
  if (!items.length) $("imports").textContent = "No games captured yet.";
  for (const item of items) {
    const row = document.createElement("div");
    row.className = "entry";
    const title = document.createElement("strong");
    title.textContent = `${item.capture.daily_number ? `Daily #${item.capture.daily_number}` : "Non-daily game"} · ${item.capture.points.toLocaleString("en")} pts`;
    const status = document.createElement("p");
    status.textContent = labels[item.status] || item.status;
    row.append(title, status);
    if (item.message) {
      const message = document.createElement("p");
      message.textContent = item.message;
      row.append(message);
    }
    if (item.status === "date_review") {
      const label = document.createElement("label");
      label.textContent = "Challenge date";
      const date = document.createElement("input");
      date.type = "text";
      date.placeholder = "dd/mm/yy";
      date.pattern = "[0-9]{2}/[0-9]{2}/[0-9]{2}";
      date.dataset.challengeDate = "true";
      const proposed = new Date(
        Date.UTC(2026, 9, 9) + (item.capture.daily_number - 1227) * 86400000,
      )
        .toISOString()
        .slice(0, 10);
      const [year, month, day] = proposed.split("-");
      date.value = `${day}/${month}/${year.slice(-2)}`;
      label.append(date);
      row.append(
        label,
        button("Use this date", () =>
          send("date", {
            id: item.id,
            date: /^\d{2}\/\d{2}\/\d{2}$/.test(date.value)
              ? `20${date.value.slice(6)}-${date.value.slice(3, 5)}-${date.value.slice(0, 2)}`
              : "",
          }),
        ),
      );
    }
    if (["pending", "conflict", "review", "date_review"].includes(item.status))
      row.append(
        button("Dismiss import", () => send("discard", { id: item.id })),
      );
    if (["conflict", "review"].includes(item.status)) {
      const link = document.createElement("a");
      link.href = "https://albertcintas.github.io/timeguessr-tracker/";
      link.target = "_blank";
      link.rel = "noopener";
      link.textContent = "Review in tracker ↗";
      row.append(link);
    }
    $("imports").append(row);
  }
}
$("login").onsubmit = async (event) => {
  event.preventDefault();
  $("error").hidden = true;
  const form = event.currentTarget;
  const submit = form.querySelector("button");
  submit.disabled = true;
  try {
    await send("login", {
      username: form.elements.username.value,
      password: form.elements.password.value,
    });
    form.reset();
    await render();
  } catch (error) {
    showError(error);
  } finally {
    form.elements.password.value = "";
    submit.disabled = false;
  }
};
$("logout").onclick = () => send("logout").then(render).catch(showError);
$("enabled").onchange = (event) =>
  send("toggle", { enabled: event.target.checked })
    .then(render)
    .catch(showError);
$("retry").onclick = () => send("retry").then(render).catch(showError);
void render().catch(showError);
setInterval(() => {
  if (!document.querySelector("input[data-challenge-date]:focus"))
    void render().catch(showError);
}, 3000);
