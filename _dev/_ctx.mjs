import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const PORT = 9699, W = 1280, H = 800;
const BASE = "file:///D:/wobdy%E6%B5%B7%E5%A4%96/2026-10-18-18-15-27/trust-lab";
const EDGE = ["C://Program Files (x86)//Microsoft//Edge//Application//msedge.exe","C://Program Files//Microsoft//Edge//Application//msedge.exe"].find(p=>{try{readFileSync(p);return true}catch{return false}});
const prof = mkdtempSync(join(tmpdir(),"ctx-"));
const child = spawn(EDGE,[`--remote-debugging-port=${PORT}`,`--user-data-dir=${prof}`,"--headless=new","--no-first-run","--disable-gpu","--enable-unsafe-swiftshader",`--window-size=${W},${H}`,"about:blank"],{stdio:"ignore"});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function gt(){for(let i=0;i<50;i++){try{const r=await fetch(`http://127.0.0.1:${PORT}/json/list`);const pg=(await r.json()).find(t=>t.type==="page");if(pg)return pg.webSocketDebuggerUrl;}catch{}await sleep(300);}throw new Error("no target");}
const ws=new WebSocket(await gt());
let id=0;const pend=new Map();const ctxs=[];
ws.onmessage=e=>{const m=JSON.parse(e.data);
  if(m.id&&pend.has(m.id)){pend.get(m.id)(m);pend.delete(m.id);}
  if(m.method==="Runtime.executionContextCreated"){const c=m.params.context;ctxs.push({id:c.id,origin:c.origin,name:c.name});}
};
const send=(meth,par={})=>new Promise(r=>{const i=++id;pend.set(i,r);ws.send(JSON.stringify({id:i,method:meth,params:par}));});
const ev=async(expr,ctx)=>{const p={expression:expr,returnByValue:true,awaitPromise:true};if(ctx)p.contextId=ctx;const r=await send("Runtime.evaluate",p);if(r.result?.exceptionDetails)return "ERR:"+(r.result.exceptionDetails.exception?.description||"").slice(0,140);return r.result?.result?.value;};
await new Promise(r=>{ws.onopen=r;});
await send("Runtime.enable");await send("Page.enable");
await send("Emulation.setDeviceMetricsOverride",{width:W,height:H,deviceScaleFactor:1,mobile:false});
await send("Page.navigate",{url:BASE+"/m1-mirage.html"});
await sleep(3000);
await ev(`document.querySelector('.tab[data-layer="hard"]').click()`);
await sleep(6000);
console.log("contexts:", JSON.stringify(ctxs.filter(c=>c.name!==""||c.origin!=="://").slice(-4)));
const inner = ctxs.filter(c=>/emergence/i.test(c.name));
if(inner.length){
  const c = inner[inner.length-1];
  console.log("inner title:", await ev(`document.title`, c.id));
  console.log("inner body:", await ev(`document.body.innerText.slice(0,90).replace(/\\s+/g,' ')`, c.id));
} else {
  console.log("no inner context found; names=", ctxs.map(c=>c.name).join('|'));
}
child.kill();ws.close();process.exit(0);
