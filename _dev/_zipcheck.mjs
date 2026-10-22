import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const PORT = 9761, W = 1440, H = 900;
const BASE = "file:///D:/wobdy%E6%B5%B7%E5%A4%96/2026-10-18-18-15-27/_ziptest/trust-lab-museum";
const ROOT = "D:/wobdy海外/2026-10-18-18-15-27/trust-lab/screens";
const EDGE = ["C://Program Files (x86)//Microsoft//Edge//Application//msedge.exe","C://Program Files//Microsoft//Edge//Application//msedge.exe"].find(p=>{try{readFileSync(p);return true}catch{return false}});
const prof = mkdtempSync(join(tmpdir(),"zc-"));
const child = spawn(EDGE,[`--remote-debugging-port=${PORT}`,`--user-data-dir=${prof}`,"--headless=new","--no-first-run","--enable-unsafe-swiftshader",`--window-size=${W},${H}`,"about:blank"],{stdio:"ignore"});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function gt(){for(let i=0;i<50;i++){try{const r=await fetch(`http://127.0.0.1:${PORT}/json/list`);const pg=(await r.json()).find(t=>t.type==="page");if(pg)return pg.webSocketDebuggerUrl;}catch{}await sleep(300);}throw new Error("no target");}
const ws=new WebSocket(await gt());
let id=0;const pend=new Map();const errs=[];const fails=[];
ws.onmessage=e=>{const m=JSON.parse(e.data);
 if(m.id&&pend.has(m.id)){pend.get(m.id)(m);pend.delete(m.id);}
 if(m.method==="Runtime.exceptionThrown") errs.push(String(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text).slice(0,150));
 if(m.method==="Network.loadingFailed") fails.push(String(m.params.errorText||"").slice(0,80));
 if(m.method==="Network.responseReceived"&&m.params.response.status>=400) fails.push(m.params.response.status+" "+m.params.response.url.split("/").pop());
};
const send=(meth,par={})=>new Promise(r=>{const i=++id;pend.set(i,r);ws.send(JSON.stringify({id:i,method:meth,params:par}));});
const ev=async expr=>{const r=await send("Runtime.evaluate",{expression:expr,returnByValue:true,awaitPromise:true});if(r.result?.exceptionDetails)return "ERR:"+(r.result.exceptionDetails.exception?.description||"").slice(0,160);return r.result?.result?.value;};
await new Promise(r=>{ws.onopen=r;});
await send("Runtime.enable");await send("Page.enable");await send("Network.enable");
await send("Emulation.setDeviceMetricsOverride",{width:W,height:H,deviceScaleFactor:1,mobile:false});

for (const p of ["index.html","m1-mirage.html","m2-horizon.html","m8-goodhart.html"]) {
  errs.length=0; fails.length=0;
  await send("Page.navigate",{url:BASE+"/"+p});
  await sleep(3000);
  console.log("==",p);
  console.log("  title:", await ev(`document.title`));
  console.log("  textLen:", await ev(`document.body.innerText.replace(/\\s/g,'').length`));
  console.log("  gl:", await ev(`(function(){var c=document.querySelector('canvas');if(!c)return 'no canvas';return c.width+'x'+c.height;})()`));
  console.log("  overflow:", await ev(`document.documentElement.scrollWidth+'/'+document.documentElement.clientWidth`));
  console.log("  errs:", errs.length?errs.slice(0,2).join(" || "):"none");
  console.log("  netFail:", fails.length?fails.slice(0,3).join(" || "):"none");
}
const s = await send("Page.captureScreenshot",{format:"png"});
writeFileSync(join(ROOT,"zip-index.png"),Buffer.from(s.result.data,"base64"));
console.log("saved zip-index.png");
child.kill();ws.close();process.exit(0);
