/* 舱室外壳 tl-room · 全馆无头验收 */
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const HERE = dirname(fileURLToPath(import.meta.url));
const PORT = 9345;
const PAGES = ["m1-mirage.html","m2-horizon.html","m3-temperature.html","m4-jailbreak.html","m5-watermark.html","m6-calibration.html","m7-adv.html","m8-goodhart.html"];
const EDGE_CANDS = ["C://Program Files (x86)//Microsoft//Edge//Application//msedge.exe","C://Program Files//Microsoft//Edge//Application//msedge.exe"];
const edge = EDGE_CANDS.find(p => { try { readFileSync(p); return true; } catch { return false; } });
const prof = mkdtempSync(join(tmpdir(), "tl-room-"));
const child = spawn(edge, [`--remote-debugging-port=${PORT}`,`--user-data-dir=${prof}`,"--headless=new","--no-first-run","--disable-gpu","--disable-background-timer-throttling","--disable-backgrounding-occluded-windows","--disable-renderer-backgrounding","--disable-features=IntensiveWakeUpThrottling","about:blank"], { stdio: "ignore" });
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function getTarget(){for(let i=0;i<30;i++){try{const r=await fetch(`http://127.0.0.1:${PORT}/json/list`);const pg=(await r.json()).find(t=>t.type==="page");if(pg)return pg.webSocketDebuggerUrl;}catch{}await sleep(300);}throw new Error("no target");}
const ws = new WebSocket(await getTarget());
let id=0; const pending=new Map(); const errs=[];
ws.onmessage=ev=>{const m=JSON.parse(ev.data);if(m.id&&pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id);}if(m.method==="Runtime.exceptionThrown")errs.push(m.params.exceptionDetails?.exception?.description?.slice(0,120)||"exception");};
const send=(method,params={})=>new Promise(res=>{const i=++id;pending.set(i,res);ws.send(JSON.stringify({id:i,method,params}));});
const evalJS=async expr=>{const r=await send("Runtime.evaluate",{expression:expr,returnByValue:true,awaitPromise:true});return r.result?.result?.value;};
await new Promise(r=>{ws.onopen=r;});
await send("Runtime.enable"); await send("Page.enable");

const out = {};
for (const page of PAGES) {
  const url = "file:///" + join(HERE, page).replace(/\\/g, "/");
  const res = {};
  for (const w of [1440, 1000]) {
    await send("Emulation.setDeviceMetricsOverride", { width: w, height: 950, deviceScaleFactor: 1, mobile: false });
    await send("Page.navigate", { url });
    await sleep(1300);
    res[w] = await evalJS(`(function(){
      const de = document.documentElement;
      const b = document.body;
      const active = document.querySelector(".layer.on");
      return {
        hOverflow: de.scrollWidth - de.clientWidth,
        pageScrollLocked: getComputedStyle(b).overflowY === "hidden",
        rail: b.dataset.rail, anim: b.dataset.anim,
        hud: !!document.querySelector(".roomhud"),
        hudStep: (document.querySelector(".hl-step")||{}).textContent || "",
        accent: b.style.getPropertyValue("--room-accent")
      };
    })()`);
  }
  // 键盘切层（1440 下）
  await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 950, deviceScaleFactor: 1, mobile: false });
  await send("Page.navigate", { url });
  await sleep(1300);
  res.keys = await evalJS(`(async function(){
    const tap = k => document.dispatchEvent(new KeyboardEvent("keydown",{key:k,bubbles:true}));
    const cur = () => document.querySelector(".layer.on").id;
    const a = cur();
    tap("2"); await new Promise(r=>setTimeout(r,120));
    const b = cur();
    tap("ArrowRight"); await new Promise(r=>setTimeout(r,120));
    const c = cur();
    tap("ArrowLeft"); await new Promise(r=>setTimeout(r,120));
    const d = cur();
    return { l1:a, key2:b, arrowR:c, arrowL:d,
      hudSync: document.querySelector(".hl-step").textContent };
  })()`);
  // Esc 发回大厅消息（监听 postMessage）
  res.escBack = await evalJS(`(function(){
    let got = null;
    window.addEventListener("message", e => { if (e.data && e.data.type === "tlab:back") got = true; });
    document.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true}));
    return new Promise(r => setTimeout(() => r(got === true), 300));
  })()`);
  out[page] = res;
}
console.log(JSON.stringify({ out, errors: errs.length ? errs : "none" }, null, 1));
child.kill(); ws.close();
try { rmSync(prof,{recursive:true,force:true}); } catch {}
process.exit(0);
