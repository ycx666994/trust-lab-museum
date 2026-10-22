// 线上 Pages 实测：渲染 / WebGL / 字体 / 溢出 / 报错
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PORT = 9796, W = 1440, H = 900;
const BASE = "https://ycx666994.github.io/trust-lab-museum";
const EDGE = ["C://Program Files (x86)//Microsoft//Edge//Application//msedge.exe",
              "C://Program Files//Microsoft//Edge//Application//msedge.exe"]
             .find(p => { try { readFileSync(p); return true; } catch { return false; } });
const prof = mkdtempSync(join(tmpdir(), "live-"));
const child = spawn(EDGE, [`--remote-debugging-port=${PORT}`, `--user-data-dir=${prof}`,
  "--headless=new", "--no-first-run", "--enable-unsafe-swiftshader",
  "--proxy-server=http://127.0.0.1:7897",
  `--window-size=${W},${H}`, "about:blank"], { stdio: "ignore" });
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function gt() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const pg = (await r.json()).find(t => t.type === "page");
      if (pg) return pg.webSocketDebuggerUrl;
    } catch {}
    await sleep(300);
  }
  throw new Error("no target");
}
const ws = new WebSocket(await gt());
let id = 0; const pend = new Map(); const errs = [], fails = [];
ws.onmessage = e => {
  const m = JSON.parse(e.data);
  if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); }
  if (m.method === "Runtime.exceptionThrown")
    errs.push(String(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text).slice(0, 120));
  if (m.method === "Network.loadingFailed")
    fails.push(String(m.params.errorText || "").slice(0, 60));
};
const send = (meth, par = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: meth, params: par })); });
const ev = async expr => {
  const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.result?.exceptionDetails) return "ERR:" + (r.result.exceptionDetails.exception?.description || "").slice(0, 120);
  return r.result?.result?.value;
};
await new Promise(r => { ws.onopen = r; });
await send("Runtime.enable"); await send("Page.enable"); await send("Network.enable");
await send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: 1, mobile: false });

const pages = ["/", "/m1-mirage.html", "/m3-temperature.html", "/m5-watermark.html", "/m8-goodhart.html"];
let bad = 0;
for (const p of pages) {
  errs.length = 0; fails.length = 0;
  await send("Page.navigate", { url: BASE + p });
  await sleep(4500);
  const title = await ev(`document.title`);
  const chars = await ev(`document.body.innerText.replace(/\\s/g,'').length`);
  const gl = await ev(`(function(){var c=document.querySelector('canvas');return c?c.width+'x'+c.height:'none';})()`);
  const ofl = await ev(`document.documentElement.scrollWidth+'/'+document.documentElement.clientWidth`);
  // 字体是否真的加载（Noto Serif SC 本地 woff2）
  const font = await ev(`(function(){try{return document.fonts.check('900 100px "Noto Serif SC"')}catch(e){return 'x'}})()`);
  const ok = !errs.length && !fails.length && chars > 200;
  if (!ok) bad++;
  console.log(`${ok ? "OK " : "BAD"} ${p.padEnd(20)} chars=${String(chars).padEnd(5)} gl=${gl} ovf=${ofl} font=${font}`);
  if (errs.length) console.log("     ERR:", errs[0]);
  if (fails.length) console.log("     NET:", fails.slice(0, 2).join(" || "));
  if (p === "/") {
    const s = await send("Page.captureScreenshot", { format: "png" });
    writeFileSync("D:/wobdy海外/2026-10-18-18-15-27/trust-lab/screens/_live-home.png", Buffer.from(s.result.data, "base64"));
  }
}
console.log(`\n线上结论：${pages.length - bad}/${pages.length} 通过`);
child.kill(); ws.close(); process.exit(0);
