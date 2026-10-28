import { test, expect, chromium } from "@playwright/test";
import { resolve } from "node:path";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";

test("installed MV3 extension signs in, captures results, uploads and hides auth storage from content", async () => {
  const directory = await mkdtemp(resolve(tmpdir(), "timeguessr-extension-"));
  const extension = resolve("extension-dist");
  const context = await chromium.launchPersistentContext(directory, {
    channel: "chromium",
    headless: true,
    args: [
      `--disable-extensions-except=${extension}`,
      `--load-extension=${extension}`,
    ],
  });
  try {
    const worker =
      context.serviceWorkers()[0] ??
      (await context.waitForEvent("serviceworker"));
    const extensionId = worker.url().split("/")[2];
    const archive = JSON.parse(
      await readFile(
        new URL("../fixtures/timeguessr/archive-october.json", import.meta.url),
        "utf8",
      ),
    );
    const daily = JSON.parse(
      await readFile(
        new URL("../fixtures/timeguessr/daily-1227.json", import.meta.url),
        "utf8",
      ),
    );
    await worker.evaluate(
      ({ archive, daily }) => {
        const runtime = globalThis as typeof globalThis & {
          uploads: unknown[];
          offline: boolean;
          answerUploads: unknown[];
          backfillComplete: boolean;
        };
        runtime.uploads = [];
        runtime.offline = false;
        runtime.answerUploads = [];
        runtime.backfillComplete = false;
        globalThis.fetch = async (input, options) => {
          const url = String(input);
          if (url.includes("/auth/v1/token")) {
            const exp = Math.floor(Date.now() / 1000) + 3600;
            const sub = "11111111-1111-4111-8111-111111111111";
            const token = [
              btoa(JSON.stringify({ alg: "HS256", typ: "JWT" })),
              btoa(
                JSON.stringify({
                  exp,
                  sub,
                  aud: "authenticated",
                  role: "authenticated",
                }),
              ),
              "signature",
            ].join(".");
            return Response.json({
              access_token: token,
              refresh_token: "test-refresh",
              token_type: "bearer",
              expires_in: 3600,
              expires_at: exp,
              user: {
                id: sub,
                aud: "authenticated",
                email: "alice@players.timeguessr.invalid",
              },
            });
          }
          if (url.includes("/rest/v1/profiles"))
            return Response.json({ username: "alice", display_name: "Alice" });
          if (url.includes("/rpc/timeguessr_backfill_candidates"))
            return Response.json(
              runtime.backfillComplete
                ? []
                : [
                    {
                      id: "saved-total-only",
                      kind: "daily",
                      daily_date: "2026-10-09",
                    },
                  ],
            );
          if (url.includes("/rpc/backfill_timeguessr_answers")) {
            runtime.answerUploads.push(JSON.parse(String(options?.body)));
            runtime.backfillComplete = true;
            return Response.json({ status: "enriched" });
          }
          if (url.startsWith("https://timeguessr.com/archive/__data.json")) {
            if (options?.credentials !== "omit")
              throw new Error("Backfill must omit site credentials");
            return Response.json(archive);
          }
          if (url.startsWith("https://timeguessr.com/play/__data.json"))
            return Response.json(daily);
          if (url.includes("/rpc/import_timeguessr_result")) {
            if (runtime.offline) throw new Error("Offline");
            runtime.uploads.push(JSON.parse(String(options?.body)));
            return Response.json({ status: "saved", game_id: "game-test" });
          }
          if (url.includes("/auth/v1/logout"))
            return new Response(null, { status: 204 });
          throw new Error("Unexpected request: " + url);
        };
      },
      { archive, daily },
    );
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.getByLabel("Tracker username").fill("alice");
    await popup.getByLabel("Password", { exact: true }).fill("test-password");
    await popup.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(popup.locator("#player")).toHaveText("alice");
    await expect(popup.locator("#backfill-status")).toContainText(
      "1 games backfilled",
    );
    const recovered = await worker.evaluate(
      () =>
        (globalThis as typeof globalThis & { answerUploads: unknown[] })
          .answerUploads,
    );
    expect(recovered).toHaveLength(1);
    expect(recovered[0]).toMatchObject({
      target_game: "saved-total-only",
      source_url:
        "https://timeguessr.com/play?mode=daily&archive=1227-c4325922368acb2a08bd",
      answers: [{ actual_year: 1986 }, {}, {}, {}, {}],
    });
    await context.route("https://timeguessr.com/**", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: `<!doctype html><title>Timeguessr fixture</title><script>sessionStorage.setItem('tg_final_score',JSON.stringify({mode:'play',score:20000,gameId:null,playArray:[...[1,2,3,4,5].map(i=>({ImageId:'picture-'+i})),'${"a".repeat(64)}','${"b".repeat(32)}'],roundResults:[1,2,3,4,5].map(i=>({totalScore:4000,guessYear:2000,actualYear:1990,actualCoords:{lat:48.8,lng:2.3},distanceMeters:1300}))}));</script><h1>20,000</h1>`,
      }),
    );
    const game = await context.newPage();
    await game.goto("https://timeguessr.com/final-score?mode=play");
    await expect
      .poll(() =>
        worker.evaluate(
          () =>
            (globalThis as typeof globalThis & { uploads: unknown[] }).uploads
              .length,
        ),
      )
      .toBe(1);
    const uploads = await worker.evaluate(
      () => (globalThis as typeof globalThis & { uploads: unknown[] }).uploads,
    );
    expect(uploads[0]).toMatchObject({
      replay_game_id: `${"a".repeat(64)}:${"b".repeat(32)}`,
      total: 20000,
      challenge_date: null,
      pictures: [
        {
          points: 4000,
          years_off: 10,
          distance_km: 1.3,
          actual_year: 1990,
          actual_location: { lat: 48.8, lng: 2.3 },
        },
        {
          points: 4000,
          years_off: 10,
          distance_km: 1.3,
          actual_year: 1990,
          actual_location: { lat: 48.8, lng: 2.3 },
        },
        {
          points: 4000,
          years_off: 10,
          distance_km: 1.3,
          actual_year: 1990,
          actual_location: { lat: 48.8, lng: 2.3 },
        },
        {
          points: 4000,
          years_off: 10,
          distance_km: 1.3,
          actual_year: 1990,
          actual_location: { lat: 48.8, lng: 2.3 },
        },
        {
          points: 4000,
          years_off: 10,
          distance_km: 1.3,
          actual_year: 1990,
          actual_location: { lat: 48.8, lng: 2.3 },
        },
      ],
    });
    await expect(popup.locator("#imports")).toContainText("Saved");
    const auth = await worker.evaluate(async () => {
      const chrome = (globalThis as any).chrome;
      return chrome.storage.local.get("club-auth");
    });
    expect(JSON.stringify(auth)).not.toContain("test-password");
    expect(JSON.stringify(auth)).toContain("test-refresh");
    const session = await context.newCDPSession(game);
    const worlds: any[] = [];
    session.on("Runtime.executionContextCreated", ({ context }) =>
      worlds.push(context),
    );
    await session.send("Runtime.enable");
    const isolated = worlds.find((world) => world.origin.includes(extensionId));
    expect(isolated, JSON.stringify(worlds)).toBeTruthy();
    const access = await session.send("Runtime.evaluate", {
      contextId: isolated.id,
      expression:
        "chrome.storage.local.get('club-auth').then(data => JSON.stringify(data)).catch(error => error.message)",
      returnByValue: true,
      awaitPromise: true,
    });
    expect(access.result.value).not.toContain("test-refresh");
    expect(access.result.value).toMatch(/not allowed|denied|not available/i);
    await game.reload();
    await new Promise((resolve) => setTimeout(resolve, 3000));
    expect(
      await worker.evaluate(
        () =>
          (globalThis as typeof globalThis & { uploads: unknown[] }).uploads
            .length,
      ),
    ).toBe(1);
    await expect(popup.locator("#version")).toHaveText(
      `v${await worker.evaluate(() => chrome.runtime.getManifest().version)}`,
    );
    await context.route("**/downloads/version.json", (route) =>
      route.fulfill({ json: { version: "99.0.0" } }),
    );
    await popup.getByRole("button", { name: "Check for updates" }).click();
    await expect(
      popup.getByRole("link", { name: "Get v99.0.0 ↗" }),
    ).toBeVisible();
    await popup.getByRole("button", { name: "Sign out" }).click();
    await expect(popup.getByLabel("Tracker username")).toBeVisible();
  } finally {
    await context.close();
    await rm(directory, { recursive: true, force: true });
  }
});
