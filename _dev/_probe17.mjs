/* v1 外壳 + 12 背景 + 导游天团 综合验收 */
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const HERE = dirname(fileURLToPath(import.meta.url));
const PORT = 9352;
const EDGE_CANDS = ["C://Program Files (x86)//Microsoft//Edge//Application//msedge.exe","C://Program Files//Microsoft//Edge//Application//msedge.exe"];
const edge = EDGE_CANDS.find(p => { try { readFileSync(p); return true; } catch { return false; } });
const prof = mkdtempSync(join(tmpdir(), "tl-trio-"));
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
const out = {};

/* --- 1. v1 场景化外壳 --- */
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 950, deviceScaleFactor: 1, mobile: false });
await send("Page.navigate", { url: "file:///" + join(HERE, "vendor/emergence-lab.html").replace(/\\/g,"/") });
await sleep(1800);
out.v1 = await evalJS(`(async function(){
  const r = {};
  const de = document.documentElement;
  r.hOverflow = de.scrollWidth - de.clientWidth;
  r.locked = getComputedStyle(document.body).overflowY === "hidden";
  r.secs = document.querySelectorAll("body>.page>section").length;
  r.onNow = document.querySelectorAll("body>.page>section.on").length;
  r.barBtns = document.querySelectorAll("#vshBar button").length;
  r.barOn = document.querySelector("#vshBar button.on").textContent;
  r.navHidden = [...document.querySelectorAll("body>div")].filter(d=>d.style.display==="none"&&d.querySelector("nav")).length > 0;
  document.dispatchEvent(new KeyboardEvent("keydown",{key:"ArrowRight",bubbles:true}));
  await new Promise(r=>setTimeout(r,150));
  r.afterRight = document.querySelector("#vshBar button.on").textContent;
  return r;
})()`);

/* --- 2+3. hub：背景 + 导游 --- */
await send("Page.navigate", { url: "file:///" + join(HERE, "index.html").replace(/\\/g,"/") });
await sleep(1600);
out.hub = await evalJS(`(async function(){
  const r = {};
  // 背景面板
  document.querySelector("#bgBtn").click();
  await new Promise(r=>setTimeout(r,150));
  r.bgOptions = document.querySelectorAll("#bgGrid .bgopt").length;
  r.bgNames = [...document.querySelectorAll("#bgGrid .bgopt .lb")].map(l=>l.firstChild.textContent).join("/");
  // 选「星海」
  [...document.querySelectorAll("#bgGrid .bgopt")].find(o=>o.dataset.bg==="xinghai").click();
  await new Promise(r=>setTimeout(r,150));
  r.bodyBgApplied = document.body.style.backgroundImage.includes("radial-gradient");
  r.persisted = localStorage.getItem("tlab.bg");
  r.swatchOn = document.querySelector('#bgGrid .bgopt.on').dataset.bg;
  document.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true}));
  // 导游天团
  r.tabs = document.querySelectorAll(".gtab").length;
  document.querySelectorAll(".gtab")[2].click();
  await new Promise(r=>setTimeout(r,500));
  r.whoAfterSwitch = document.querySelector("#gWho").textContent;
  r.typedLen = document.querySelector("#sayTxt").textContent.length;
  r.tabOn = document.querySelector(".gtab.on").title;
  // 随机抽考 → 应切到阿测
  document.querySelector("#randBtn").click();
  await new Promise(r=>setTimeout(r,300));
  r.whoAfterRandom = document.querySelector("#gWho").textContent;
  document.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true}));
  return r;
})()`);
console.log(JSON.stringify({ out, errors: errs.length ? errs : "none" }, null, 1));
child.kill(); ws.close();
try { rmSync(prof,{recursive:true,force:true}); } catch {}
process.exit(0);
