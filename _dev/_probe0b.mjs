/* 布局探针：三档宽度查横向溢出 + 关键元素可见 */
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const FILE = join(HERE, "engine-bench.html");
const PORT = 9342;
const EDGE_CANDS = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
];
const edge = EDGE_CANDS.find(p => { try { readFileSync(p); return true; } catch { return false; } });
const prof = mkdtempSync(join(tmpdir(), "tl-layout-"));
const child = spawn(edge, [
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${prof}`,
  "--headless=new", "--no-first-run", "--disable-gpu",
  "--disable-background-timer-throttling", "--disable-backgrounding-occluded-windows",
  "--disable-renderer-backgrounding", "--disable-features=IntensiveWakeUpThrottling",
  "about:blank",
], { stdio: "ignore" });
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function getTarget() {
  for (let i = 0; i < 30; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const list = await r.json();
      const pg = list.find(t => t.type === "page");
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
  if (m.method === "Runtime.exceptionThrown") errs.push("exception");
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

const out = {};
for (const w of [1440, 1000, 620, 400]) {
  await send("Emulation.setDeviceMetricsOverride", { width: w, height: 950, deviceScaleFactor: 1, mobile: false });
  await send("Page.navigate", { url: "file:///" + FILE.replace(/\\/g, "/") });
  await sleep(1600);
  out[w] = await evalJS(`(function(){
    const de = document.documentElement;
    const vis = s => { const e = document.querySelector(s); if(!e) return "MISSING";
      const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    return {
      hOverflow: de.scrollWidth - de.clientWidth,
      panelA: vis(".panel:nth-of-type(1)"), panelB: vis(".panel:nth-of-type(2)"), panelC: vis(".panel:nth-of-type(3)"),
      term: vis("#aOut"), gauge: vis("#bGauge"), btns: vis("#aGo") && vis("#bDetect") && vis("#cGo"),
      gridCols: getComputedStyle(document.querySelector(".grid")).gridTemplateColumns.split(" ").length
    };
  })()`);
}
console.log(JSON.stringify(out, null, 2));
console.log("errors:", errs.length ? errs : "none");
child.kill(); ws.close();
try { rmSync(prof, { recursive: true, force: true }); } catch {}
process.exit(0);
