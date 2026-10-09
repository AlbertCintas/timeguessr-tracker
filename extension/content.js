import { captureModern, captureLegacy, legacyKeys } from "./capture.js";
let last = "";
async function capture() {
  try {
    let result = null;
    const path = location.pathname;
    if (path.endsWith("/final-score")) {
      const raw = sessionStorage.getItem("tg_final_score");
      if (raw) result = captureModern(JSON.parse(raw), location.href);
    } else if (
      path.endsWith("/finalscore") ||
      path.endsWith("/finalscoredaily")
    ) {
      const storage = path.endsWith("/finalscoredaily")
        ? localStorage
        : sessionStorage;
      const values = Object.fromEntries(
        legacyKeys.map((key) => [key, storage.getItem(key)]),
      );
      result = captureLegacy(
        values,
        location.href,
        document.getElementById("totalText")?.textContent,
      );
    }
    if (!result) {
      last = "";
      return;
    }
    const fingerprint = JSON.stringify(result);
    if (fingerprint === last) return;
    const response = await chrome.runtime.sendMessage({
      type: "capture",
      capture: result,
    });
    if (response?.accepted) last = fingerprint;
  } catch {}
}
void capture();
setInterval(capture, 2500);
