import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const PORT = 9705, W = 1440, H = 900;
const BASE = "file:///D:/wobdy%E6%B5%B7%E5%A4%96/2026-10-18-18-15-27/trust-lab";
const ROOT = "D:/wobdy海外/2026-10-18-18-15-27/trust-lab/screens";
const EDGE = ["C://Program Files (x86)//Microsoft//Edge//Application//msedge.exe","C://Program Files//Microsoft//Edge//Application//msedge.exe"].find(p=>{try{readFileSync(p);return true}catch{return false}});
const prof = mkdtempSync(join(tmpdir(),"vl-"));
const child = spawn(EDGE,[`--remote-debugging-port=${PORT}`,`--user-data-dir=${prof}`,"--headless=new","--no-first-run","--disable-gpu","--enable-unsafe-swiftshader",`--window-size=${W},${H}`,"about:blank"],{stdio:"ignore"});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function gt(){for(let i=0;i<50;i++){try{const r=await fetch(`http://127.0.0.1:${PORT}/json/list`);const pg=(await r.json()).find(t=>t.type==="page");if(pg)return pg.webSocketDebuggerUrl;}catch{}await sleep(300);}throw new Error("no target");}
const ws=new WebSocket(await gt());
let id=0;const pend=new Map();const logs=[];
ws.onmessage=e=>{const m=JSON.parse(e.data);
  if(m.id&&pend.has(m.id)){pend.get(m.id)(m);pend.delete(m.id);}
  if(m.method==="Runtime.exceptionThrown") logs.push("EXC "+JSON.stringify(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text).slice(0,200));
};
const send=(meth,par={})=>new Promise(r=>{const i=++id;pend.set(i,r);ws.send(JSON.stringify({id:i,method:meth,params:par}));});
const ev=async expr=>{const r=await send("Runtime.evaluate",{expression:expr,returnByValue:true,awaitPromise:true});if(r.result?.exceptionDetails)return "ERR:"+(r.result.exceptionDetails.exception?.description||"").slice(0,160);return r.result?.result?.value;};
await new Promise(r=>{ws.onopen=r;});
await send("Runtime.enable");await send("Page.enable");
await send("Emulation.setDeviceMetricsOverride",{width:W,height:H,deviceScaleFactor:1,mobile:false});
async function shot(n){const s=await send("Page.captureScreenshot",{format:"png",captureBeyondViewport:false});writeFileSync(join(ROOT,n+".png"),Buffer.from(s.result.data,"base64"));console.log("saved",n);}

for (const [file, name] of [["emergence-lab.html","vendor-v1-light"],["horizon-workbench.html","vendor-v4-light"]]) {
  logs.length=0;
  await send("Page.navigate",{url:BASE+"/vendor/"+file});
  await sleep(3800);
  console.log("--",file);
  console.log("  bg", await ev(`getComputedStyle(document.body).backgroundColor`));
  console.log("  ink", await ev(`getComputedStyle(document.body).color`));
  console.log("  scheme", await ev(`getComputedStyle(document.documentElement).colorScheme`));
  console.log("  textLen", await ev(`document.body.innerText.trim().length`));
  await shot(name);
  if(logs.length) console.log("  "+logs.slice(0,3).join("\n  ")); else console.log("  no exc");
}
child.kill();ws.close();process.exit(0);
