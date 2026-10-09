import { test } from "node:test";
import assert from "node:assert/strict";
import { start } from "geckodriver";
import { resolve } from "node:path";

test(
  "Firefox loads the add-on, signs in, keeps tokens private and signs out",
  { timeout: 60000 },
  async () => {
    const port = 44000 + Math.floor(Math.random() * 1000);
    const driver = await start({
      port,
      host: "127.0.0.1",
      allowSystemAccess: true,
      spawnOpts: { stdio: "ignore" },
    });
    const root = `http://127.0.0.1:${port}`;
    let session;
    async function request(path, body, method = "POST") {
      const response = await fetch(root + path, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(20000),
      });
      const data = await response.json();
      if (data.value?.error) throw new Error(data.value.message);
      return data.value;
    }
    try {
      for (let i = 0; i < 100; i++) {
        if (
          await fetch(root + "/status")
            .then((r) => r.ok)
            .catch(() => false)
        )
          break;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      const binary =
        process.env.FIREFOX_BINARY ||
        (process.platform === "darwin"
          ? "/Applications/Firefox.app/Contents/MacOS/firefox"
          : undefined);
      const options = { args: ["-headless"], ...(binary ? { binary } : {}) };
      const created = await request("/session", {
        capabilities: {
          alwaysMatch: {
            browserName: "firefox",
            "moz:firefoxOptions": options,
          },
        },
      });
      session = "/session/" + created.sessionId;
      const execute = (script, args = []) =>
        request(session + "/execute/sync", { script, args });
      const asyncExecute = (script, args = []) =>
        request(session + "/execute/async", { script, args });
      await request(session + "/moz/addon/install", {
        path: resolve("extension-firefox-dist"),
        temporary: true,
      });
      await request(session + "/moz/context", { context: "chrome" });
      const uuid = await execute(
        "return JSON.parse(Services.prefs.getStringPref('extensions.webextensions.uuids'))['timeguessr-club@albertcintas.github.io'];",
      );
      await request(session + "/moz/context", { context: "content" });
      await request(session + "/url", {
        url: `moz-extension://${uuid}/popup.html`,
      });
      const ready =
        await asyncExecute(`const done=arguments[arguments.length-1];browser.runtime.getBackgroundPage().then(bg=>{
      bg.fetch=async(input,options)=>{
        const url=String(input);
        if(url.includes('/auth/v1/token')) {
          const exp=Math.floor(Date.now()/1000)+3600,sub='11111111-1111-4111-8111-111111111111';
          const token=[btoa(JSON.stringify({alg:'HS256',typ:'JWT'})),btoa(JSON.stringify({exp,sub,aud:'authenticated',role:'authenticated'})),'signature'].join('.');
          return new bg.Response(JSON.stringify({access_token:token,refresh_token:'firefox-test-refresh',token_type:'bearer',expires_in:3600,expires_at:exp,user:{id:sub,aud:'authenticated',email:'alice@players.timeguessr.invalid'}}),{headers:{'Content-Type':'application/json'}});
        }
        if(url.includes('/rest/v1/profiles'))return new bg.Response(JSON.stringify({username:'alice',display_name:'Alice'}),{headers:{'Content-Type':'application/json'}});
        if(url.includes('/auth/v1/logout'))return new bg.Response(null,{status:204});
        throw new Error('Unexpected request '+url);
      };
      done(true);
    }).catch(e=>done(e.message));`);
      assert.equal(ready, true);
      await execute(
        "document.querySelector('[name=username]').value='alice';document.querySelector('[name=password]').value='firefox-test-password';document.getElementById('login').requestSubmit();",
      );
      for (let i = 0; i < 50; i++) {
        if (
          await execute(
            "return document.getElementById('player').textContent==='alice';",
          )
        )
          break;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      assert.equal(
        await execute("return document.getElementById('player').textContent;"),
        "alice",
      );
      const stored = await asyncExecute(
        "const done=arguments[arguments.length-1];browser.storage.local.get(null).then(done);",
      );
      assert.equal(stored["club-auth"], undefined);
      assert(!JSON.stringify(stored).includes("firefox-test-refresh"));
      assert(!JSON.stringify(stored).includes("firefox-test-password"));
      await request(session + "/refresh", {});
      for (let i = 0; i < 50; i++) {
        if (
          await execute(
            "return document.getElementById('player').textContent==='alice';",
          )
        )
          break;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      assert.equal(
        await execute("return document.getElementById('player').textContent;"),
        "alice",
      );
      await execute("document.getElementById('logout').click();");
      for (let i = 0; i < 50; i++) {
        if (await execute("return !document.getElementById('login').hidden;"))
          break;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      assert.equal(
        await execute("return document.getElementById('login').hidden;"),
        false,
      );
    } finally {
      if (session) await request(session, undefined, "DELETE").catch(() => {});
      driver.kill();
    }
  },
);
