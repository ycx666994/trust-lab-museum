/* 展品 05 水印侦探 · 无头验收 */
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const FILE = join(HERE, "m5-watermark.html");
const PORT = 9348;
const EDGE_CANDS = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
];
const edge = EDGE_CANDS.find(p => { try { readFileSync(p); return true; } catch { return false; } });
const prof = mkdtempSync(join(tmpdir(), "tl-m5-"));
const child = spawn(edge, [
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${prof}`,
  "--headless=new", "--no-first-run", "--disable-gpu", "about:blank",
  "--disable-background-timer-throttling", "--disable-backgrounding-occluded-windows",
  "--disable-renderer-backgrounding", "--disable-features=IntensiveWakeUpThrottling",
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

const layout = {};
for (const w of [1440, 1000, 620, 400]) {
  await send("Emulation.setDeviceMetricsOverride", { width: w, height: 950, deviceScaleFactor: 1, mobile: false });
  await send("Page.navigate", { url });
  await sleep(1400);
  layout[w] = await evalJS(`(function(){
    const de = document.documentElement;
    return {
      hOverflow: de.scrollWidth - de.clientWidth,
      engine: !!window.TLLM,
      tabs: document.querySelectorAll(".tab").length,
      atkBtns: ["#atk10","#atk30","#atkDel"].every(s => !!document.querySelector(s)),
      backLink: !!document.querySelector('a[href="index.html"]')
    };
  })()`);
}

await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 950, deviceScaleFactor: 1, mobile: false });
await send("Page.navigate", { url });
await sleep(1500);
const fn = {};
// 故事
fn.storyRun = await evalJS(`(function(){ document.querySelector("#wPlay").click(); return true; })()`);
await sleep(6500);
fn.storyDone = await evalJS(`(function(){
  return {
    plainZ: document.querySelector("#pZ").textContent,
    markedZ: document.querySelector("#mZ").textContent,
    greenChars: document.querySelectorAll("#wMarked .g").length,
    punch: !document.querySelector("#wPunch").hidden
  };
})()`);
// 玩具：盖章 → 高 z；改写 30% → z 下降
fn.toySwitch = await evalJS(`(function(){ document.querySelectorAll(".tab")[1].click(); return true; })()`);
fn.toyStamp = await evalJS(`(function(){ document.querySelector("#tGo").click(); return true; })()`);
await sleep(4500);
fn.stampResult = await evalJS(`(function(){
  return {
    len: document.querySelector("#tOut").textContent.replace(/^月球土壤的主要成分是/, "").length,
    lamp: document.querySelector("#tLamp").className,
    frac: document.querySelector("#tFrac").textContent,
    green: document.querySelectorAll("#tOut .g").length,
    meta: document.querySelector("#tMeta").textContent
  };
})()`);
fn.atk30 = await evalJS(`(function(){ document.querySelector("#atk30").click(); return true; })()`);
await sleep(600);
fn.atkResult = await evalJS(`(function(){
  return { lamp: document.querySelector("#tLamp").className, state: document.querySelector("#tState").textContent };
})()`);
fn.quizShown = await evalJS(`document.querySelector("#quizToy").style.display !== "none"`);
fn.quizRight = await evalJS(`(function(){
  const ok = [...document.querySelectorAll("#quizOpts .opt")].find(b => b.dataset.ok === "true");
  ok.click(); return ok.classList.contains("ok");
})()`);
await sleep(400);
fn.clearedStored = await evalJS(`(function(){
  const s = JSON.parse(localStorage.getItem("tlab.v1") || "{}");
  return !!(s.got && s.got.m5);
})()`);
// 硬核扫描
fn.hardSwitch = await evalJS(`(function(){ document.querySelectorAll(".tab")[2].click(); return true; })()`);
fn.scanStart = await evalJS(`(function(){ document.querySelector("#hGo").click(); return true; })()`);
await sleep(25000);
fn.scanDone = await evalJS(`(function(){
  return {
    rows: document.querySelectorAll("#hTbl tr").length - 1,
    fp: document.querySelector("#hFp").textContent,
    minLen: document.querySelector("#hMinLen").textContent,
    prog: document.querySelector("#hProgTxt").textContent.slice(0, 8),
    pts: document.querySelectorAll("#hChart circle").length
  };
})()`);

console.log(JSON.stringify({ layout, fn, errors: errs.length ? errs : "none" }, null, 2));
child.kill(); ws.close();
try { rmSync(prof, { recursive: true, force: true }); } catch {}
process.exit(0);
