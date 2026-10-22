/* 展品 01/02 收编页 · 无头验收 */
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const PORT = 9349;
const EDGE_CANDS = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
];
const edge = EDGE_CANDS.find(p => { try { readFileSync(p); return true; } catch { return false; } });
const prof = mkdtempSync(join(tmpdir(), "tl-m12-"));
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

const out = { vendorExists: existsSync(join(HERE, "vendor", "emergence-lab.html")) && existsSync(join(HERE, "vendor", "horizon-workbench.html")) };

async function visit(file, w) {
  await send("Emulation.setDeviceMetricsOverride", { width: w, height: 950, deviceScaleFactor: 1, mobile: false });
  await send("Page.navigate", { url: "file:///" + join(HERE, file).replace(/\\/g, "/") });
  await sleep(1500);
}

/* ============ m1 ============ */
const m1 = { layout: {} };
for (const w of [1440, 620, 400]) {
  await visit("m1-mirage.html", w);
  m1.layout[w] = await evalJS(`document.documentElement.scrollWidth - document.documentElement.clientWidth`);
}
await visit("m1-mirage.html", 1440);
m1.story = await evalJS(`(function(){
  document.querySelector("#sPlay").click();
  return !!document.querySelector("#sChart path");
})()`);
await sleep(400);
m1.rerun = await evalJS(`(function(){ document.querySelector("#sRerun").click();
  return document.querySelectorAll("#sChart path").length; })()`);
m1.game = await evalJS(`(function(){
  document.querySelectorAll(".tab")[1].click();
  document.querySelector("#gReal").click();
  return true;
})()`);
await sleep(3200);
m1.gameAfter = await evalJS(`(function(){
  return { round: document.querySelector("#gRound").textContent,
           verdict: document.querySelector("#gVerdict").textContent.slice(0, 12) };
})()`);
// 连答完 4 题（直接点，等揭晓）
for (let k = 0; k < 3; k++) {
  await evalJS(`(function(){
    const btn = document.querySelector(k === -1 ? "#gReal" : "#gReal");
    (document.querySelector("#gReal") || {}).click && document.querySelector("#gReal").click();
    return 1;
  })()`);
  await sleep(3100);
}
m1.quizShown = await evalJS(`document.querySelector("#quizToy").style.display !== "none"`);
m1.quizRight = await evalJS(`(function(){
  const ok = [...document.querySelectorAll("#quizOpts .opt")].find(b => b.dataset.ok === "true");
  ok.click(); return ok.classList.contains("ok");
})()`);
await sleep(400);
m1.cleared = await evalJS(`(function(){
  const s = JSON.parse(localStorage.getItem("tlab.v1") || "{}");
  return !!(s.got && s.got.m1);
})()`);
m1.iframe = await evalJS(`(function(){
  document.querySelectorAll(".tab")[2].click();
  document.querySelector("#loadFrame").click();
  return true;
})()`);
await sleep(2500);
m1.iframeLoaded = await evalJS(`!!document.querySelector("#frameBox iframe")`);
// iframe 内部是否真的加载出工作台
m1.iframeInner = await evalJS(`(function(){
  const f = document.querySelector("#frameBox iframe");
  try { return f.contentDocument && f.contentDocument.body ? f.contentDocument.body.children.length : "cross"; }
  catch(e){ return "err"; }
})()`);

/* ============ m2 ============ */
const m2 = { layout: {} };
for (const w of [1440, 620, 400]) {
  await visit("m2-horizon.html", w);
  m2.layout[w] = await evalJS(`document.documentElement.scrollWidth - document.documentElement.clientWidth`);
}
await visit("m2-horizon.html", 1440);
m2.story = await evalJS(`(function(){ document.querySelector("#sPlay").click(); return true; })()`);
await sleep(9500);
m2.storyDone = await evalJS(`(function(){
  return { stamp: document.querySelector("#stamp").classList.contains("on"),
           beats: document.querySelectorAll(".beat.in").length,
           bars: document.querySelectorAll("#sChart rect").length };
})()`);
m2.toy = await evalJS(`(function(){
  const r = document.querySelector("#tRho"), l = document.querySelector("#tLen");
  r.value = 0.7; r.dispatchEvent(new Event("input"));
  l.value = 20; l.dispatchEvent(new Event("input"));
  return { verdict: document.querySelector("#tVerdict").textContent.slice(0, 20),
           lamp: document.querySelector("#tLamp").className };
})()`);
m2.quiz = await evalJS(`document.querySelector("#quizToy").style.display !== "none"`);
m2.quizRight = await evalJS(`(function(){
  const ok = [...document.querySelectorAll("#quizOpts .opt")].find(b => b.dataset.ok === "true");
  ok.click(); return ok.classList.contains("ok");
})()`);
await sleep(400);
m2.cleared = await evalJS(`(function(){
  const s = JSON.parse(localStorage.getItem("tlab.v1") || "{}");
  return !!(s.got && s.got.m2);
})()`);
m2.iframeLoaded = await evalJS(`(function(){
  document.querySelectorAll(".tab")[2].click();
  document.querySelector("#loadFrame").click();
  return true;
})()`);
await sleep(2500);
m2.iframeInner = await evalJS(`(function(){
  const f = document.querySelector("#frameBox iframe");
  try { return f.contentDocument && f.contentDocument.body ? f.contentDocument.body.children.length : "cross"; }
  catch(e){ return "err"; }
})()`);

out.m1 = m1; out.m2 = m2;
console.log(JSON.stringify(out, null, 2));
console.log("errors:", errs.length ? errs : "none");
child.kill(); ws.close();
try { rmSync(prof, { recursive: true, force: true }); } catch {}
process.exit(0);
