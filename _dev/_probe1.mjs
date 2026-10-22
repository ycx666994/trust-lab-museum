/* 博物馆 hub · 无头验收（功能流 + 多宽度布局） */
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const FILE = join(HERE, "index.html");
const PORT = 9343;
const EDGE_CANDS = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
];
const edge = EDGE_CANDS.find(p => { try { readFileSync(p); return true; } catch { return false; } });
const prof = mkdtempSync(join(tmpdir(), "tl-hub-"));
const child = spawn(edge, [
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${prof}`,
  "--headless=new", "--no-first-run", "--disable-gpu",
  "--disable-background-timer-throttling", "--disable-backgrounding-occluded-windows",
  "--disable-renderer-backgrounding", "--disable-features=IntensiveWakeUpThrottling", "about:blank",
], { stdio: "ignore" });
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function getTarget() {
  for (let i = 0; i < 30; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const pg = (await r.json()).find(t => t.type === "page");
      if (pg) return pg.webSocketDebuggerUrl;
    } catch {}
    await sleep(300);
  }
  throw new Error("no target");
}
const ws = new WebSocket(await getTarget());
let id = 0; const pending = new Map(); const errs = [];
ws.onmessage = ev => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  if (m.method === "Runtime.exceptionThrown")
    errs.push(m.params.exceptionDetails?.exception?.description?.slice(0, 120) || "exception");
};
const send = (method, params = {}) => new Promise(res => {
  const i = ++id; pending.set(i, res);
  ws.send(JSON.stringify({ id: i, method, params }));
});
const evalJS = async expr => {
  const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true });
  return r.result?.result?.value;
};
await new Promise(r => { ws.onopen = r; });
await send("Runtime.enable");
await send("Page.enable");
const url = "file:///" + FILE.replace(/\\/g, "/");

/* ---------- 布局 ---------- */
const layout = {};
for (const w of [1440, 1000, 620, 400]) {
  await send("Emulation.setDeviceMetricsOverride", { width: w, height: 950, deviceScaleFactor: 1, mobile: false });
  await send("Page.navigate", { url });
  await sleep(1500);
  layout[w] = await evalJS(`(function(){
    const de = document.documentElement;
    return {
      hOverflow: de.scrollWidth - de.clientWidth,
      exhibits: document.querySelectorAll(".ex").length,
      albumCards: document.querySelectorAll(".card").length,
      guideTyped: document.querySelector("#sayTxt").textContent.length > 60,
      zonesOK: !!document.querySelector("#rowA .ex") && !!document.querySelector("#rowB .ex") && !!document.querySelector("#rowC .ex"),
      dash: document.querySelector("#dashN").textContent
    };
  })()`);
}

/* ---------- 功能流（1440 宽度下） ---------- */
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 950, deviceScaleFactor: 1, mobile: false });
await send("Page.navigate", { url });
await sleep(1600);
const fn = {};
fn.initialGot = await evalJS(`document.querySelectorAll(".card.got").length`);
fn.baitCrackedBefore = await evalJS(`document.querySelector("#bait").classList.contains("cracked")`);
// postMessage 解锁（模拟模块回传）
fn.pmUnlock = await evalJS(`(function(){ window.postMessage({type:"tlab:clear", module:"m1"}, "*"); return true; })()`);
await sleep(400);
fn.gotAfterPM = await evalJS(`document.querySelectorAll(".card.got").length`);
fn.dashAfterPM = await evalJS(`document.querySelector("#dashN").textContent`);
fn.baitCrackedAfter = await evalJS(`document.querySelector("#bait").classList.contains("cracked")`);
// 直接 API 解锁全部 → 证书
fn.unlockAll = await evalJS(`(function(){ ["m2","m3","m4","m5","m6","m7","m8"].forEach(m => TLab.unlock(m)); return TLab.state().got; })()`);
await sleep(400);
fn.certEnabled = await evalJS(`!document.querySelector("#certBtn").disabled`);
fn.certShows = await evalJS(`(function(){ document.querySelector("#certBtn").click(); return document.querySelector("#certScrim").classList.contains("on"); })()`);
fn.certDate = await evalJS(`document.querySelector("#certDate").textContent`);
fn.flipWorks = await evalJS(`(function(){ const c = document.querySelector(".card.got"); c.click(); return c.classList.contains("flip"); })()`);
// 重置
fn.resetWorks = await evalJS(`(function(){ TLab.reset(); return document.querySelectorAll(".card.got").length; })()`);
fn.dashAfterReset = await evalJS(`document.querySelector("#dashN").textContent`);

/* 截图留档 */
const shot = await send("Page.captureScreenshot", { captureBeyondViewport: true,
  clip: { x: 0, y: 0, width: 1440, height: 1400, scale: 1 } });
if (shot.result?.data) (await import("node:fs")).writeFileSync(join(HERE, "_hub.png"), Buffer.from(shot.result.data, "base64"));

console.log(JSON.stringify({ layout, fn, errors: errs.length ? errs : "none" }, null, 2));
child.kill(); ws.close();
try { rmSync(prof, { recursive: true, force: true }); } catch {}
process.exit(0);
