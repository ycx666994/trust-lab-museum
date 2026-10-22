import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const PORT = 9771, W = 1440, H = 900;
const BASE = "file:///D:/wobdy%E6%B5%B7%E5%A4%96/2026-10-18-18-15-27/trust-lab";
const ROOT = "D:/wobdy海外/2026-10-18-18-15-27/trust-lab/_dev/cover";
const EDGE = ["C://Program Files (x86)//Microsoft//Edge//Application//msedge.exe","C://Program Files//Microsoft//Edge//Application//msedge.exe"].find(p=>{try{readFileSync(p);return true}catch{return false}});
const prof = mkdtempSync(join(tmpdir(),"sb-"));
const child = spawn(EDGE,[`--remote-debugging-port=${PORT}`,`--user-data-dir=${prof}`,"--headless=new","--no-first-run","--enable-unsafe-swiftshader",`--window-size=${W},${H}`,"about:blank"],{stdio:"ignore"});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function gt(){for(let i=0;i<50;i++){try{const r=await fetch(`http://127.0.0.1:${PORT}/json/list`);const pg=(await r.json()).find(t=>t.type==="page");if(pg)return pg.webSocketDebuggerUrl;}catch{}await sleep(300);}throw new Error("no target");}
const ws=new WebSocket(await gt());
let id=0;const pend=new Map();
ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pend.has(m.id)){pend.get(m.id)(m);pend.delete(m.id);}};
const send=(meth,par={})=>new Promise(r=>{const i=++id;pend.set(i,r);ws.send(JSON.stringify({id:i,method:meth,params:par}));});
const ev=async expr=>{const r=await send("Runtime.evaluate",{expression:expr,returnByValue:true,awaitPromise:true});if(r.result?.exceptionDetails)return "ERR:"+(r.result.exceptionDetails.exception?.description||"").slice(0,200);return r.result?.result?.value;};
await new Promise(r=>{ws.onopen=r;});
await send("Runtime.enable");await send("Page.enable");
await send("Emulation.setDeviceMetricsOverride",{width:W,height:H,deviceScaleFactor:1,mobile:false});
await send("Page.navigate",{url:BASE+"/index.html"});
for(let i=0;i<40;i++){ if(await ev(`!!(window.TLBG && window.TLBG.supported)`)) break; await sleep(400); }
console.log("TLBG:", await ev(`window.TLBG ? ('supported='+window.TLBG.supported+' booting='+window.TLBG.booting) : 'none'`));
for (const s of ["jinbi","gudian","qingtong","fugu"]) {
  const d = await ev(`window.TLBG.snap("${s}",1920,1080)`);
  if (typeof d === "string" && d.startsWith("data:image")) {
    writeFileSync(join(ROOT, `bg-${s}.png`), Buffer.from(d.split(",")[1], "base64"));
    console.log("saved", s, Math.round(d.length/1024)+"KB");
  } else console.log("FAIL", s, String(d).slice(0,80));
}
child.kill();ws.close();process.exit(0);
