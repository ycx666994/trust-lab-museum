/* 12 场景背景 · 验收：每主题图层结构独特 + 无报错 + 面板正常 */
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const HERE = dirname(fileURLToPath(import.meta.url));
const PORT = 9356;
const EDGE_CANDS = ["C://Program Files (x86)//Microsoft//Edge//Application//msedge.exe","C://Program Files//Microsoft//Edge//Application//msedge.exe"];
const edge = EDGE_CANDS.find(p => { try { readFileSync(p); return true; } catch { return false; } });
const prof = mkdtempSync(join(tmpdir(), "tl-bgv2-"));
const child = spawn(edge, [`--remote-debugging-port=${PORT}`,`--user-data-dir=${prof}`,"--headless=new","--no-first-run","--disable-gpu","--disable-background-timer-throttling","--disable-backgrounding-occluded-windows","--disable-renderer-backgrounding","--disable-features=IntensiveWakeUpThrottling","about:blank"], { stdio: "ignore" });
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function getTarget(){for(let i=0;i<30;i++){try{const r=await fetch(`http://127.0.0.1:${PORT}/json/list`);const pg=(await r.json()).find(t=>t.type==="page");if(pg)return pg.webSocketDebuggerUrl;}catch{}await sleep(300);}throw new Error("no target");}
const ws = new WebSocket(await getTarget());
let id=0; const pending=new Map(); const errs=[];
ws.onmessage=ev=>{const m=JSON.parse(ev.data);if(m.id&&pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id);}if(m.method==="Runtime.exceptionThrown")errs.push(m.params.exceptionDetails?.exception?.description?.slice(0,140)||"exception");};
const send=(method,params={})=>new Promise(res=>{const i=++id;pending.set(i,res);ws.send(JSON.stringify({id:i,method,params}));});
const evalJS=async expr=>{const r=await send("Runtime.evaluate",{expression:expr,returnByValue:true,awaitPromise:true});if(r.result?.exceptionDetails)return{EXC:(r.result.exceptionDetails.exception?.description||"").slice(0,200)};return r.result?.result?.value;};
await new Promise(r=>{ws.onopen=r;});
await send("Runtime.enable"); await send("Page.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 950, deviceScaleFactor: 1, mobile: false });
await send("Page.navigate", { url: "file:///" + join(HERE, "index.html").replace(/\\/g,"/") });
await sleep(1600);
const r = await evalJS(`(async function(){
  const out = {};
  document.querySelector("#bgBtn").click();
  await new Promise(r=>setTimeout(r,150));
  out.options = document.querySelectorAll("#bgGrid .bgopt").length;
  // 逐个切换，收集每主题的图层结构指纹（类名序列）
  const sigs = {};
  for (const btn of document.querySelectorAll("#bgGrid .bgopt")) {
    btn.click();
    await new Promise(r=>setTimeout(r,60));
    sigs[btn.dataset.bg] = [...document.querySelectorAll("#bgStage > *")].map(e=>e.className).join(",");
  }
  out.sigs = sigs;
  // 星海选中时：动画是否在跑（getAnimations）
  [...document.querySelectorAll("#bgGrid .bgopt")].find(o=>o.dataset.bg==="xinghai").click();
  await new Promise(r=>setTimeout(r,150));
  out.anims = document.getAnimations().length;
  out.persisted = localStorage.getItem("tlab.bg");
  // 切回默认再关面板
  [...document.querySelectorAll("#bgGrid .bgopt")].find(o=>o.dataset.bg==="def").click();
  document.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true}));
  out.stageCleared = document.querySelectorAll("#bgStage > *").length === 0;
  return out;
})()`);
console.log(JSON.stringify({ r, errors: errs.length ? errs : "none" }, null, 1));
child.kill(); ws.close();
try { rmSync(prof,{recursive:true,force:true}); } catch {}
process.exit(0);
