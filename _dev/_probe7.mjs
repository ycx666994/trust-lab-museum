/* 展品 04/08 · 无头验收 */
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const PORT = 9350;
const EDGE_CANDS = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
];
const edge = EDGE_CANDS.find(p => { try { readFileSync(p); return true; } catch { return false; } });
const prof = mkdtempSync(join(tmpdir(), "tl-m48-"));
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

async function visit(file, w) {
  await send("Emulation.setDeviceMetricsOverride", { width: w, height: 950, deviceScaleFactor: 1, mobile: false });
  await send("Page.navigate", { url: "file:///" + join(HERE, file).replace(/\\/g, "/") });
  await sleep(1400);
}

/* ============ m4 ============ */
const m4 = { layout: {} };
for (const w of [1440, 620, 400]) {
  await visit("m4-jailbreak.html", w);
  m4.layout[w] = await evalJS(`document.documentElement.scrollWidth - document.documentElement.clientWidth`);
}
await visit("m4-jailbreak.html", 1440);
m4.story = await evalJS(`(function(){ document.querySelector("#sPlay").click(); return true; })()`);
await sleep(6500);
m4.storyDone = await evalJS(`(function(){
  return { beats: document.querySelectorAll("#sBeats .beat.in").length,
           hacked: document.querySelectorAll("#sFlow .fnode.hacked").length };
})()`);
m4.toySwitch = await evalJS(`(function(){ document.querySelectorAll(".tab")[1].click(); return true; })()`);
m4.attackDefault = await evalJS(`(function(){
  document.querySelector('#aCards .acard[data-i="1"]').click();   // 分段拆解
  document.querySelector("#tGo").click();
  return { lamp: document.querySelector("#tLamp").className,
           verdict: document.querySelector("#tVerdict").textContent.slice(0, 14) };
})()`);
m4.runAllDefault = await evalJS(`(function(){
  document.querySelector("#tAll").click();
  return document.querySelector("#tVerdict").textContent.slice(0, 12);
})()`);
m4.fixDefenses = await evalJS(`(function(){
  ["sys","out","ctx"].forEach(id => {
    const r = document.querySelector('.defrow[data-id="' + id + '"]');
    if (!r.classList.contains("on")) r.click();
  });
  document.querySelector("#tAll").click();
  return document.querySelector("#tVerdict").textContent.slice(0, 16);
})()`);
m4.quizShown = await evalJS(`document.querySelector("#quizToy").style.display !== "none"`);
m4.quizRight = await evalJS(`(function(){
  const ok = [...document.querySelectorAll("#quizOpts .opt")].find(b => b.dataset.ok === "true");
  ok.click(); return ok.classList.contains("ok");
})()`);
await sleep(400);
m4.cleared = await evalJS(`(function(){
  const s = JSON.parse(localStorage.getItem("tlab.v1") || "{}");
  return !!(s.got && s.got.m4);
})()`);
m4.matrix = await evalJS(`(function(){
  document.querySelectorAll(".tab")[2].click();
  return document.querySelectorAll("#hMatrix tr").length;
})()`);

/* ============ m8 ============ */
const m8 = { layout: {} };
for (const w of [1440, 620, 400]) {
  await visit("m8-goodhart.html", w);
  m8.layout[w] = await evalJS(`document.documentElement.scrollWidth - document.documentElement.clientWidth`);
}
await visit("m8-goodhart.html", 1440);
m8.story = await evalJS(`(function(){ document.querySelector("#sPlay").click(); return true; })()`);
await sleep(12000);
m8.storyDone = await evalJS(`(function(){
  return { beats: document.querySelectorAll("#sBeats .beat.in").length,
           score: document.querySelector("#sScore").textContent,
           clean: document.querySelector("#sClean").textContent,
           dirty: document.querySelectorAll("#sGrid circle").length };
})()`);
m8.toySwitch = await evalJS(`(function(){ document.querySelectorAll(".tab")[1].click(); return true; })()`);
m8.pieceMax = await evalJS(`(function(){
  const r = document.querySelector("#tRounds");
  r.value = 100; r.dispatchEvent(new Event("input"));
  return { lamp: document.querySelector("#tLamp").className,
           verdict: document.querySelector("#tVerdict").textContent.slice(0, 18) };
})()`);
m8.ruleClean = await evalJS(`(function(){
  document.querySelector('#tRule button[data-r="clean"]').click();
  return { lamp: document.querySelector("#tLamp").className,
           verdict: document.querySelector("#tVerdict").textContent.slice(0, 12) };
})()`);
m8.quizShown = await evalJS(`document.querySelector("#quizToy").style.display !== "none"`);
m8.quizRight = await evalJS(`(function(){
  const ok = [...document.querySelectorAll("#quizOpts .opt")].find(b => b.dataset.ok === "true");
  ok.click(); return ok.classList.contains("ok");
})()`);
await sleep(400);
m8.cleared = await evalJS(`(function(){
  const s = JSON.parse(localStorage.getItem("tlab.v1") || "{}");
  return !!(s.got && s.got.m8);
})()`);
m8.table = await evalJS(`(function(){
  document.querySelectorAll(".tab")[2].click();
  return document.querySelectorAll("#hTbl tr").length - 1;
})()`);

console.log(JSON.stringify({ m4, m8, errors: errs.length ? errs : "none" }, null, 2));
child.kill(); ws.close();
try { rmSync(prof, { recursive: true, force: true }); } catch {}
process.exit(0);
