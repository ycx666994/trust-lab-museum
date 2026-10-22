/* 引擎试车台 · 无头验收探针（Edge headless + CDP） */
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const FILE = join(HERE, "engine-bench.html");
const PORT = 9341;
const EDGE_CANDS = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
];
const edge = EDGE_CANDS.find(p => { try { readFileSync(p); return true; } catch { return false; } });
if (!edge) { console.error("no msedge"); process.exit(1); }

const prof = mkdtempSync(join(tmpdir(), "tl-probe-"));
const child = spawn(edge, [
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${prof}`,
  "--headless=new", "--no-first-run", "--no-default-browser-check",
  "--window-size=1440,1000", "--disable-gpu",
  "--disable-background-timer-throttling", "--disable-backgrounding-occluded-windows",
  "--disable-renderer-backgrounding", "--disable-features=IntensiveWakeUpThrottling",
  "file:///" + FILE.replace(/\\/g, "/"),
], { stdio: "ignore" });

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function getTarget() {
  for (let i = 0; i < 30; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const list = await r.json();
      const pg = list.find(t => t.type === "page" && t.url.includes("engine-bench"));
      if (pg) return pg.webSocketDebuggerUrl;
    } catch {}
    await sleep(300);
  }
  throw new Error("no CDP target");
}

const ws = new WebSocket(await getTarget());
let id = 0;
const pending = new Map();
const consoleErrs = [];
ws.onmessage = ev => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  if (m.method === "Runtime.exceptionThrown")
    consoleErrs.push(m.params.exceptionDetails?.exception?.description || "exception");
  if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error")
    consoleErrs.push(m.params.args?.map(a => a.value ?? a.description).join(" "));
};
const send = (method, params = {}) => new Promise(res => {
  const i = ++id; pending.set(i, res);
  ws.send(JSON.stringify({ id: i, method, params }));
});
const evalJS = async expr => {
  const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
  return r.result?.result?.value;
};

await new Promise(r => { ws.onopen = r; });
await send("Runtime.enable");
await send("Page.enable");
await sleep(3800);

const checks = await evalJS(`(function(){
  const out = {};
  out.lm = !!window.TLLM;
  out.stats = window.TLLM ? null : null;
  const t1 = document.querySelector("#aOut").textContent;
  out.aText = t1.slice(0, 60);
  out.aMeta = document.querySelector("#aMetaR").textContent;
  out.cands = document.querySelectorAll("#aCands .cand").length;
  out.bVerdict = document.querySelector("#bVerdict").textContent;
  out.bFrac = document.querySelector("#bFrac").textContent;
  out.cSame = document.querySelector("#cSame").textContent;
  out.cHash = document.querySelector("#cHash").textContent;
  /* 引擎级断言 */
  const LM = new TLLM.TinyLM(window.TL_CORPUS, 4);
  const low  = LM.generate({prompt:"月球土壤的主要成分是", len:120, temperature:0.3, seed:42}).text;
  const high = LM.generate({prompt:"月球土壤的主要成分是", len:120, temperature:1.2, seed:42}).text;
  out.lowT  = low.slice(0, 50);
  out.highT = high.slice(0, 50);
  out.tempDiffers = low !== high;
  const wm = LM.embed({prompt:"月球土壤的主要成分是", len:150, seed:77, delta:2.5, gamma:0.5});
  const pl = LM.generate({prompt:"月球土壤的主要成分是", len:150, seed:77, temperature:1}).text;
  const dz = LM.detect(wm.text, {gamma:0.5}).z;
  const pz = LM.detect(pl,      {gamma:0.5}).z;
  out.zWm = +dz.toFixed(2); out.zPlain = +pz.toFixed(2);
  out.wmOK = dz >= 4; out.plainOK = Math.abs(pz) <= 2;
  const again = LM.generate({prompt:"测试", len:80, temperature:0.9, seed:7}).text;
  out.reproOK = again === LM.generate({prompt:"测试", len:80, temperature:0.9, seed:7}).text;
  return out;
})()`);

const shot = await send("Page.captureScreenshot", {
  captureBeyondViewport: true,
  clip: { x: 0, y: 0, width: 1440, height: 1000, scale: 1 },
});
if (shot.result?.data) {
  const { writeFileSync } = await import("node:fs");
  writeFileSync(join(HERE, "_bench.png"), Buffer.from(shot.result.data, "base64"));
}

console.log(JSON.stringify(checks, null, 2));
console.log("console errors:", consoleErrs.length ? consoleErrs : "none");

child.kill();
ws.close();
try { rmSync(prof, { recursive: true, force: true }); } catch {}
process.exit(consoleErrs.length ? 1 : 0);
