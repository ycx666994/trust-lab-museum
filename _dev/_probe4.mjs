/* 展品 07 对抗样本 · 无头验收 */
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const FILE = join(HERE, "m7-adv.html");
const PORT = 9347;
const EDGE_CANDS = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
];
const edge = EDGE_CANDS.find(p => { try { readFileSync(p); return true; } catch { return false; } });
const prof = mkdtempSync(join(tmpdir(), "tl-m7-"));
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
      weights: !!window.TLADV && window.TLADV.W.length === 640,
      acc: document.querySelector("#accTxt").textContent,
      tabs: document.querySelectorAll(".tab").length,
      dpick: document.querySelectorAll("#dPick button").length,
      backLink: !!document.querySelector('a[href="index.html"]')
    };
  })()`);
}

await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 950, deviceScaleFactor: 1, mobile: false });
await send("Page.navigate", { url });
await sleep(1500);
const fn = {};
// 故事：4 步袭击
fn.storyRun = await evalJS(`(function(){ document.querySelector("#sPlay").click(); return true; })()`);
await sleep(9500);
fn.storyDone = await evalJS(`(function(){
  return {
    advRects: document.querySelectorAll("#sAdv rect").length,
    lamp: document.querySelector("#sLamp").className,
    punch: !document.querySelector("#sPunch").hidden,
    next: document.querySelector("#sNext").style.display !== "none"
  };
})()`);
// 玩具：默认 3 → 攻击 ε=0.3
fn.toySwitch = await evalJS(`(function(){ document.querySelectorAll(".tab")[1].click(); return true; })()`);
fn.toyBefore = await evalJS(`document.querySelector("#aVerdict").textContent`);
fn.attack = await evalJS(`(function(){
  const e = document.querySelector("#aEps");
  e.value = 0.3; e.dispatchEvent(new Event("input"));
  document.querySelector("#aGo").click();
  return {
    lamp: document.querySelector("#aLamp").className,
    verdict: document.querySelector("#aVerdict").textContent.slice(0, 30),
    noiseColored: [...document.querySelectorAll("#aNoise rect")].filter(r => r.getAttribute("fill") !== "#10151d").length
  };
})()`);
fn.quizShown = await evalJS(`document.querySelector("#quizToy").style.display !== "none"`);
// 指定目标攻击：把 3 变成 8
fn.targeted = await evalJS(`(function(){
  const e = document.querySelector("#aEps");
  e.value = 0.35; e.dispatchEvent(new Event("input"));
  const m = document.querySelector("#aMode");
  m.value = "8"; m.dispatchEvent(new Event("change"));
  document.querySelector("#aGo").click();
  return document.querySelector("#aVerdict").textContent.slice(0, 26);
})()`);
fn.quizRight = await evalJS(`(function(){
  const ok = [...document.querySelectorAll("#quizOpts .opt")].find(b => b.dataset.ok === "true");
  ok.click(); return ok.classList.contains("ok");
})()`);
await sleep(400);
fn.clearedStored = await evalJS(`(function(){
  const s = JSON.parse(localStorage.getItem("tlab.v1") || "{}");
  return !!(s.got && s.got.m7);
})()`);
// 硬核
fn.hardSwitch = await evalJS(`(function(){ document.querySelectorAll(".tab")[2].click(); return true; })()`);
fn.hardStats = await evalJS(`(function(){
  return {
    s20: document.querySelector("#mS20").textContent,
    s20cls: document.querySelector("#mS20").className,
    flip: document.querySelector("#mFlip").textContent,
    l2: document.querySelector("#mL2").textContent,
    chartPts: document.querySelectorAll("#hChart circle").length,
    flipRows: document.querySelectorAll("#flipTbl div").length
  };
})()`);

console.log(JSON.stringify({ layout, fn, errors: errs.length ? errs : "none" }, null, 2));
child.kill(); ws.close();
try { rmSync(prof, { recursive: true, force: true }); } catch {}
process.exit(0);
