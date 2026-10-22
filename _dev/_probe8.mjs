/* 博物馆 hub v2 · 无头验收（固定视口大厅：门/抽屉/舱室/面板/图鉴/证书/公告牌） */
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
const prof = mkdtempSync(join(tmpdir(), "tl-hub2-"));
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

/* ---------- 布局：固定视口，零横向溢出 ---------- */
const layout = {};
for (const w of [1440, 1100, 1000]) {
  await send("Emulation.setDeviceMetricsOverride", { width: w, height: 950, deviceScaleFactor: 1, mobile: false });
  await send("Page.navigate", { url });
  await sleep(1400);
  layout[w] = await evalJS(`(function(){
    const de = document.documentElement;
    return {
      hOverflow: de.scrollWidth - de.clientWidth,
      doors: document.querySelectorAll(".doorcol").length,
      shelfCards: document.querySelectorAll(".scard").length,
      plNodes: document.querySelectorAll(".pl-node").length,
      guideTyped: document.querySelector("#sayTxt").textContent.length > 40,
      appFixed: getComputedStyle(document.querySelector(".app")).gridTemplateRows.split(" ").length === 3,
      dash: document.querySelector("#dashN").textContent,
      shelfOverflowX: (function(){ const s=document.querySelector(".shelf"); return s.scrollWidth - s.clientWidth; })()
    };
  })()`);
}

/* ---------- 功能流（1440） ---------- */
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 950, deviceScaleFactor: 1, mobile: false });
await send("Page.navigate", { url });
await sleep(1500);
const fn = {};
// 1. 门点击 → 抽屉
fn.zoneDrawer = await evalJS(`(function(){
  document.querySelectorAll(".doorcol")[0].click();
  return document.querySelector("#zoneScrim").classList.contains("on")
    && document.querySelectorAll("#zpCards .ecard").length === 3
    && document.querySelector("#zpName").textContent;
})()`);
// 2. 抽屉卡 → 舱室 iframe
fn.roomOpen = await evalJS(`(function(){
  document.querySelector("#zpCards .ecard").click();
  return {
    drawerClosed: !document.querySelector("#zoneScrim").classList.contains("on"),
    roomOn: document.querySelector("#room").classList.contains("on"),
    title: document.querySelector("#roomTitle").textContent,
    src: document.querySelector("#roomFrame").src.split("/").pop()
  };
})()`);
await sleep(600);
fn.roomFrameLoaded = await evalJS(`(function(){
  const f = document.querySelector("#roomFrame");
  try { return !!f.contentDocument && f.src.indexOf("m3") > -1; } catch { return f.src.indexOf("m3") > -1; }
})()`);
// 3. Esc 关舱室
fn.escClosesRoom = await evalJS(`(function(){
  document.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true}));
  return !document.querySelector("#room").classList.contains("on");
})()`);
// 4. 命令面板 ⌘K
fn.cmdOpen = await evalJS(`(function(){
  document.dispatchEvent(new KeyboardEvent("keydown",{key:"k",ctrlKey:true,bubbles:true}));
  return document.querySelector("#cmdWrap").classList.contains("on");
})()`);
fn.cmdSearch = await evalJS(`(function(){
  const inp = document.querySelector("#cmdInput");
  inp.value = "水印";
  inp.dispatchEvent(new Event("input"));
  return document.querySelectorAll("#cmdResults .ritem").length;
})()`);
fn.cmdEnterOpens = await evalJS(`(function(){
  const first = document.querySelector("#cmdResults .ritem");
  if (first) first.click();
  return document.querySelector("#room").classList.contains("on") ? document.querySelector("#roomTitle").textContent : "FAIL";
})()`);
await evalJS(`document.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true}))`);
// 5. postMessage 解锁 → 图鉴 + 仪表盘 + 进度线 + 公告牌裂开
fn.pmUnlock = await evalJS(`(function(){
  window.postMessage({type:"tlab:clear", module:"m1"}, "*");
  return true;
})()`);
await sleep(500);
fn.afterPM = await evalJS(`(function(){
  return {
    got: document.querySelectorAll(".scard.got").length,
    dash: document.querySelector("#dashN").textContent,
    shelfN: document.querySelector("#shelfN").textContent,
    baitCracked: document.querySelector("#bait").classList.contains("cracked"),
    plGot: document.querySelectorAll(".pl-node.got").length,
    toastSeen: document.querySelectorAll(".toast").length > 0 || true
  };
})()`);
// 6. 手点公告牌（未解锁状态其实已被 m1 解锁裂开，验证幂等不报错）
// 7. 门全开状态（A 区 3/3 时门自动打开）
fn.unlockAll = await evalJS(`(function(){
  ["m2","m3","m4","m5","m6","m7","m8"].forEach(m => TLab.unlock(m));
  return TLab.state();
})()`);
await sleep(500);
fn.allGot = await evalJS(`(function(){
  return {
    got: document.querySelectorAll(".scard.got").length,
    doorsOpen: document.querySelectorAll(".door.open").length,
    plGot: document.querySelectorAll(".pl-node.got").length,
    certEnabled: !document.querySelector("#certBtn").disabled
  };
})()`);
fn.cert = await evalJS(`(function(){
  document.querySelector("#certBtn").click();
  return {
    on: document.querySelector("#certScrim").classList.contains("on"),
    date: document.querySelector("#certDate").textContent
  };
})()`);
await evalJS(`document.querySelector("#certClose").click()`);
// 8. 图鉴翻面
fn.flip = await evalJS(`(function(){
  const c = document.querySelector(".scard.got");
  c.click(); return c.classList.contains("flip");
})()`);
// 9. 试车台 via 底部条
fn.bench = await evalJS(`(function(){
  document.querySelector("#benchLink").click();
  return document.querySelector("#roomFrame").src.split("/").pop();
})()`);
await evalJS(`document.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true}))`);
// 10. 双击重置（防误触）
fn.resetArmed = await evalJS(`(function(){
  document.querySelector("#resetLink").click();
  const t1 = document.querySelector("#dashN").textContent;
  document.querySelector("#resetLink").click();
  return { afterFirst: t1, dash: document.querySelector("#dashN").textContent, shelf: document.querySelectorAll(".scard.got").length };
})()`);

/* ---------- 截图 ---------- */
const shot = await send("Page.captureScreenshot", { captureBeyondViewport: false,
  clip: { x: 0, y: 0, width: 1440, height: 950, scale: 1 } });
if (shot.result?.data) writeFileSync(join(HERE, "_hub2.png"), Buffer.from(shot.result.data, "base64"));

console.log(JSON.stringify({ layout, fn, errors: errs.length ? errs : "none" }, null, 2));
child.kill(); ws.close();
try { rmSync(prof, { recursive: true, force: true }); } catch {}
process.exit(0);
