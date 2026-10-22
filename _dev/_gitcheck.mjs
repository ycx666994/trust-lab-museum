// file:// 协议下全站体检（验证「双击打开」承诺是否成立，含 iframe 实验室）
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PORT = 9793, W = 1440, H = 900;
const BASE = "file:///D:/wobdy%E6%B5%B7%E5%A4%96/2026-10-18-18-15-27/trust-lab";
const EDGE = ["C://Program Files (x86)//Microsoft//Edge//Application//msedge.exe",
              "C://Program Files//Microsoft//Edge//Application//msedge.exe"]
             .find(p => { try { readFileSync(p); return true; } catch { return false; } });

const prof = mkdtempSync(join(tmpdir(), "git-"));
const child = spawn(EDGE, [`--remote-debugging-port=${PORT}`, `--user-data-dir=${prof}`,
  "--headless=new", "--no-first-run", "--enable-unsafe-swiftshader",
  `--window-size=${W},${H}`, "about:blank"], { stdio: "ignore" });

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function gt() {
  for (let i = 0; i < 50; i++) {
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
    fails.push(String(m.params.errorText || "").slice(0, 50) + " " + (m.params.requestId || ""));
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

const pages = ["index.html", "m1-mirage.html", "m2-horizon.html", "m3-temperature.html",
               "m4-jailbreak.html", "m5-watermark.html", "m6-calibration.html",
               "m7-adv.html", "m8-goodhart.html", "engine-bench.html"];

let bad = 0;
for (const p of pages) {
  errs.length = 0; fails.length = 0;
  await send("Page.navigate", { url: BASE + "/" + p });
  await sleep(2600);
  const title = await ev(`document.title`);
  const chars = await ev(`document.body.innerText.replace(/\\s/g,'').length`);
  const gl = await ev(`(function(){var c=document.querySelector('canvas');return c?c.width+'x'+c.height:'none';})()`);
  const ofl = await ev(`document.documentElement.scrollWidth+'/'+document.documentElement.clientWidth`);
  const ifr = await ev(`(function(){var f=document.querySelectorAll('iframe');if(!f.length)return '-';
      return Array.from(f).map(function(x){try{return (x.contentDocument?x.contentDocument.body.innerText.replace(/\\s/g,'').length:0)}catch(e){return 'X'}}).join(',');})()`);
  const ok = !errs.length && !fails.length && chars > 200;
  if (!ok) bad++;
  console.log(`${ok ? "OK " : "BAD"} ${p.padEnd(20)} title=${String(title).slice(0, 18).padEnd(18)} chars=${chars} gl=${gl} ovf=${ofl} iframe=${ifr}`);
  if (errs.length) console.log("     ERR:", errs[0]);
  if (fails.length) console.log("     NET:", fails.slice(0, 2).join(" || "));
}

console.log(`\n结论：${pages.length - bad}/${pages.length} 通过（file:// 协议）`);
child.kill(); ws.close(); process.exit(0);
