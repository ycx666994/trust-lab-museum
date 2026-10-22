/* 展品 06 校准放大器 · 无头验收 */
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const FILE = join(HERE, "m6-calibration.html");
const PORT = 9344;
const EDGE_CANDS = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
];
const edge = EDGE_CANDS.find(p => { try { readFileSync(p); return true; } catch { return false; } });
const prof = mkdtempSync(join(tmpdir(), "tl-m6-"));
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
    errs.push(m.params.exceptionDetails?.exception?.description?.slice(0, 140) || "exception");
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

/* 布局 */
const layout = {};
for (const w of [1440, 1000, 620, 400]) {
  await send("Emulation.setDeviceMetricsOverride", { width: w, height: 950, deviceScaleFactor: 1, mobile: false });
  await send("Page.navigate", { url });
  await sleep(1300);
  layout[w] = await evalJS(`(function(){
    const de = document.documentElement;
    return {
      hOverflow: de.scrollWidth - de.clientWidth,
      tabs: document.querySelectorAll(".tab").length,
      toyCircles: document.querySelectorAll("#toyChart circle").length,
      hardPoints: document.querySelectorAll("#hardChart circle").length,
      ece: document.querySelector("#mECE").textContent,
      backLink: !!document.querySelector('a[href="index.html"]')
    };
  })()`);
}

/* 功能流 */
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 950, deviceScaleFactor: 1, mobile: false });
await send("Page.navigate", { url });
await sleep(1500);
const fn = {};
// 故事层播放（快进：直接验证 12 天卡片与统计生成）
fn.storyRun = await evalJS(`(function(){
  document.querySelector("#storyPlay").click();
  return true;
})()`);
await sleep(18000);
fn.storyDone = await evalJS(`(function(){
  return {
    days: document.querySelectorAll(".fday.in").length,
    hits: document.querySelectorAll(".fday.hit").length,
    rate: document.querySelector("#tRate").textContent,
    punch: !document.querySelector("#storyPunch").hidden,
    nextBtn: document.querySelector("#storyNext").style.display !== "none"
  };
})()`);
// 玩具层
fn.toySwitch = await evalJS(`(function(){ document.querySelectorAll(".tab")[1].click(); return true; })()`);
fn.toyPoint = await evalJS(`(function(){
  const g = document.querySelector("#toyChart g");
  return { transform: g.getAttribute("transform"), verdict: document.querySelector("#toyVerdict").textContent.slice(0,20) };
})()`);
fn.toyMove = await evalJS(`(function(){
  const c = document.querySelector("#tConf"), a = document.querySelector("#tAcc");
  c.value = 60; c.dispatchEvent(new Event("input"));
  a.value = 60; a.dispatchEvent(new Event("input"));
  return document.querySelector("#toyVerdict").textContent.slice(0, 10);
})()`);
fn.quizShown = await evalJS(`document.querySelector("#quizToy").style.display !== "none"`);
fn.quizWrong = await evalJS(`(function(){
  const bad = [...document.querySelectorAll("#quizOpts .opt")].find(b => b.dataset.ok === "false");
  bad.click(); return bad.classList.contains("bad");
})()`);
fn.quizRight = await evalJS(`(function(){
  const ok = [...document.querySelectorAll("#quizOpts .opt")].find(b => b.dataset.ok === "true");
  ok.click(); return ok.classList.contains("ok");
})()`);
await sleep(500);
fn.clearedStored = await evalJS(`(function(){
  const s = JSON.parse(localStorage.getItem("tlab.v1") || "{}");
  return !!(s.got && s.got.m6);
})()`);
fn.resShown = await evalJS(`document.querySelector("#quizRes").classList.contains("on")`);
fn.optsDisabled = await evalJS(`[...document.querySelectorAll(".opt")].every(b => b.disabled)`);
// 硬核层
fn.hardSwitch = await evalJS(`(function(){ document.querySelectorAll(".tab")[2].click(); return true; })()`);
fn.hardBias = await evalJS(`(function(){
  const b = document.querySelector("#hBias");
  b.value = 0.35; b.dispatchEvent(new Event("input"));
  return { ece: document.querySelector("#mECE").textContent, cls: document.querySelector("#mECE").className };
})()`);
fn.hardFair = await evalJS(`(function(){
  const b = document.querySelector("#hBias");
  b.value = 0; b.dispatchEvent(new Event("input"));
  return { ece: document.querySelector("#mECE").textContent, cls: document.querySelector("#mECE").className };
})()`);
fn.hardPoints = await evalJS(`document.querySelectorAll("#hardChart circle").length`);

console.log(JSON.stringify({ layout, fn, errors: errs.length ? errs : "none" }, null, 2));
child.kill(); ws.close();
try { rmSync(prof, { recursive: true, force: true }); } catch {}
process.exit(0);
