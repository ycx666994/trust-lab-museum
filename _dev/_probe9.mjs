/* hub v2 视觉几何探针：纯数值验证大厅布局 */
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const HERE = dirname(fileURLToPath(import.meta.url));
const FILE = join(HERE, "index.html");
const PORT = 9344;
const EDGE_CANDS = ["C://Program Files (x86)//Microsoft//Edge//Application//msedge.exe","C://Program Files//Microsoft//Edge//Application//msedge.exe"];
const edge = EDGE_CANDS.find(p => { try { readFileSync(p); return true; } catch { return false; } });
const prof = mkdtempSync(join(tmpdir(), "tl-geo-"));
const child = spawn(edge, [`--remote-debugging-port=${PORT}`,`--user-data-dir=${prof}`,"--headless=new","--no-first-run","--disable-gpu","--disable-background-timer-throttling","--disable-backgrounding-occluded-windows","--disable-renderer-backgrounding","--disable-features=IntensiveWakeUpThrottling","about:blank"], { stdio: "ignore" });
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function getTarget(){for(let i=0;i<30;i++){try{const r=await fetch(`http://127.0.0.1:${PORT}/json/list`);const pg=(await r.json()).find(t=>t.type==="page");if(pg)return pg.webSocketDebuggerUrl;}catch{}await sleep(300);}throw new Error("no target");}
const ws = new WebSocket(await getTarget());
let id=0; const pending=new Map(); const errs=[];
ws.onmessage=ev=>{const m=JSON.parse(ev.data);if(m.id&&pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id);}if(m.method==="Runtime.exceptionThrown")errs.push(m.params.exceptionDetails?.exception?.description?.slice(0,120)||"exception");};
const send=(method,params={})=>new Promise(res=>{const i=++id;pending.set(i,res);ws.send(JSON.stringify({id:i,method,params}));});
const evalJS=async expr=>{const r=await send("Runtime.evaluate",{expression:expr,returnByValue:true});return r.result?.result?.value;};
await new Promise(r=>{ws.onopen=r;});
await send("Runtime.enable"); await send("Page.enable");
const url="file:///"+FILE.replace(/\\/g,"/");
await send("Emulation.setDeviceMetricsOverride",{width:1440,height:950,deviceScaleFactor:1,mobile:false});
await send("Page.navigate",{url}); await sleep(1500);
const geo = await evalJS(`(function(){
  const r = el => { const b = el.getBoundingClientRect(); return {x:Math.round(b.x),y:Math.round(b.y),w:Math.round(b.width),h:Math.round(b.height)}; };
  const doors = [...document.querySelectorAll(".door")].map(r);
  const bar = r(document.querySelector(".bar"));
  const side = r(document.querySelector(".side"));
  const plaque = r(document.querySelector("#bait"));
  const pline = r(document.querySelector("#pline"));
  const guide = r(document.querySelector(".guide"));
  const shelf = r(document.querySelector(".shelf"));
  const doc = { w: document.documentElement.clientWidth, h: document.documentElement.clientHeight };
  // 门是否都在 stage 内且不重叠
  const overlaps = [];
  for (let i=0;i<doors.length;i++) for (let j=i+1;j<doors.length;j++) {
    const a=doors[i],b=doors[j];
    if (a.x < b.x+b.w && b.x < a.x+a.w && a.y < b.y+b.h && b.y < a.y+a.h) overlaps.push([i,j]);
  }
  return {
    doc, bar, side, plaque, pline, guide, shelf, doors, overlaps,
    doorHeights: doors.map(d=>d.h),
    sideColW: side.w,
    barH: bar.h,
    stripH: Math.round(document.querySelector(".strip").getBoundingClientRect().height),
    spotVar: getComputedStyle(document.querySelector("#spot")).background.slice(0,60),
    plaqueVisible: plaque.w > 100,
    plineInside: pline.y + pline.h < doc.h,
    shelfInside: shelf.y + shelf.h <= side.y + document.querySelector(".side").getBoundingClientRect().height,
    guideTextLen: document.querySelector("#sayTxt").textContent.length
  };
})()`);
console.log(JSON.stringify({geo, errors: errs.length?errs:"none"}, null, 2));
child.kill(); ws.close();
try { rmSync(prof,{recursive:true,force:true}); } catch {}
process.exit(0);
