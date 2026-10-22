/* hub v2.1 · 随机抽考 + 成就系统 验收 */
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const HERE = dirname(fileURLToPath(import.meta.url));
const PORT = 9351;
const EDGE_CANDS = ["C://Program Files (x86)//Microsoft//Edge//Application//msedge.exe","C://Program Files//Microsoft//Edge//Application//msedge.exe"];
const edge = EDGE_CANDS.find(p => { try { readFileSync(p); return true; } catch { return false; } });
const prof = mkdtempSync(join(tmpdir(), "tl-ach-"));
const child = spawn(edge, [`--remote-debugging-port=${PORT}`,`--user-data-dir=${prof}`,"--headless=new","--no-first-run","--disable-gpu","--disable-background-timer-throttling","--disable-backgrounding-occluded-windows","--disable-renderer-backgrounding","--disable-features=IntensiveWakeUpThrottling","about:blank"], { stdio: "ignore" });
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function getTarget(){for(let i=0;i<30;i++){try{const r=await fetch(`http://127.0.0.1:${PORT}/json/list`);const pg=(await r.json()).find(t=>t.type==="page");if(pg)return pg.webSocketDebuggerUrl;}catch{}await sleep(300);}throw new Error("no target");}
const ws = new WebSocket(await getTarget());
let id=0; const pending=new Map(); const errs=[];
ws.onmessage=ev=>{const m=JSON.parse(ev.data);if(m.id&&pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id);}if(m.method==="Runtime.exceptionThrown")errs.push(m.params.exceptionDetails?.exception?.description?.slice(0,140)||"exception");};
const send=(method,params={})=>new Promise(res=>{const i=++id;pending.set(i,res);ws.send(JSON.stringify({id:i,method,params}));});
const evalJS=async expr=>{const r=await send("Runtime.evaluate",{expression:expr,returnByValue:true,awaitPromise:true});return r.result?.result?.value;};
await new Promise(r=>{ws.onopen=r;});
await send("Runtime.enable"); await send("Page.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 950, deviceScaleFactor: 1, mobile: false });
await send("Page.navigate", { url: "file:///" + join(HERE, "index.html").replace(/\\/g,"/") });
await sleep(1500);
const r = await evalJS(`(async function(){
  const out = {};
  // 1. 点墙上公告 → sharp_eye
  document.querySelector("#bait").click();
  await new Promise(r=>setTimeout(r,300));
  out.achSharpEye = document.querySelector("#achN").textContent;
  // 2. 随机抽考 → 抽屉打开 + 高亮
  document.querySelector("#randBtn").click();
  await new Promise(r=>setTimeout(r,200));
  out.drawerOnRandom = document.querySelector("#zoneScrim").classList.contains("on");
  out.hlCount = [...document.querySelectorAll("#zpCards .ecard")].filter(c=>c.style.outline.includes("solid")).length;
  document.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true}));
  // 3. 解锁 m1 → first_light；再解锁 2 件 → three_kills
  TLab.unlock("m1");
  await new Promise(r=>setTimeout(r,200));
  out.achN1 = document.querySelector("#achN").textContent;
  ["m2","m3"].forEach(m=>TLab.unlock(m));
  await new Promise(r=>setTimeout(r,200));
  out.achN3 = document.querySelector("#achN").textContent;
  out.state = TLab.state();
  // 4. 全解锁 → all_clear
  ["m4","m5","m6","m7","m8"].forEach(m=>TLab.unlock(m));
  await new Promise(r=>setTimeout(r,200));
  out.achNAll = document.querySelector("#achN").textContent;
  // 5. 点 achN → toast 列表
  document.querySelector("#achN").click();
  await new Promise(r=>setTimeout(r,200));
  out.toastText = (document.querySelector(".toast")||{}).textContent || "";
  // 6. 重置 → 徽章清零
  document.querySelector("#resetLink").click();
  document.querySelector("#resetLink").click();
  await new Promise(r=>setTimeout(r,200));
  out.achAfterReset = document.querySelector("#achN").textContent;
  return out;
})()`);
console.log(JSON.stringify({ r, errors: errs.length ? errs : "none" }, null, 1));
child.kill(); ws.close();
try { rmSync(prof,{recursive:true,force:true}); } catch {}
process.exit(0);
