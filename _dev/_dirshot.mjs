import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const PORT = 9743, W = 1440, H = 900;
const BASE = "file:///D:/wobdy%E6%B5%B7%E5%A4%96/2026-10-18-18-15-27/trust-lab";
const ROOT = "D:/wobdy海外/2026-10-18-18-15-27/trust-lab/screens";
const EDGE = ["C://Program Files (x86)//Microsoft//Edge//Application//msedge.exe","C://Program Files//Microsoft//Edge//Application//msedge.exe"].find(p=>{try{readFileSync(p);return true}catch{return false}});
const prof = mkdtempSync(join(tmpdir(),"ds-"));
const child = spawn(EDGE,[`--remote-debugging-port=${PORT}`,`--user-data-dir=${prof}`,"--headless=new","--no-first-run","--enable-unsafe-swiftshader",`--window-size=${W},${H}`,"about:blank"],{stdio:"ignore"});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function gt(){for(let i=0;i<50;i++){try{const r=await fetch(`http://127.0.0.1:${PORT}/json/list`);const pg=(await r.json()).find(t=>t.type==="page");if(pg)return pg.webSocketDebuggerUrl;}catch{}await sleep(300);}throw new Error("no target");}
const ws=new WebSocket(await gt());
let id=0;const pend=new Map();
ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pend.has(m.id)){pend.get(m.id)(m);pend.delete(m.id);}};
const send=(meth,par={})=>new Promise(r=>{const i=++id;pend.set(i,r);ws.send(JSON.stringify({id:i,method:meth,params:par}));});
const ev=async expr=>{const r=await send("Runtime.evaluate",{expression:expr,returnByValue:true,awaitPromise:true});if(r.result?.exceptionDetails)return "ERR:"+(r.result.exceptionDetails.exception?.description||"").slice(0,160);return r.result?.result?.value;};
await new Promise(r=>{ws.onopen=r;});
await send("Runtime.enable");await send("Page.enable");
await send("Emulation.setDeviceMetricsOverride",{width:W,height:H,deviceScaleFactor:1,mobile:false});
async function shot(n){const s=await send("Page.captureScreenshot",{format:"png"});writeFileSync(join(ROOT,n+".png"),Buffer.from(s.result.data,"base64"));console.log("  saved",n);}

/* V1 */
await send("Page.navigate",{url:BASE+"/vendor/emergence-lab.html"});
await sleep(5200);
console.log("v1 auto:", await ev(`(function(){var r=document.getElementById('tld');return r?('on='+r.classList.contains('on')+' t='+r.querySelector('.tld-t').textContent):'NO TLD';})()`));
await shot("dir-v1-intro");
for (var k=0;k<4;k++){ await ev(`document.querySelector('#tld .tld-next').click()`); await sleep(700); }
console.log("v1 step5:", await ev(`(function(){var r=document.getElementById('tld');return r.querySelector('.tld-t').textContent+' | '+r.querySelector('.tld-step').textContent;})()`));
await shot("dir-v1-tau");
for (var k=0;k<2;k++){ await ev(`document.querySelector('#tld .tld-next').click()`); await sleep(700); }
console.log("v1 step7:", await ev(`document.querySelector('#tld .tld-t').textContent`));
await shot("dir-v1-verdict");

/* V4 */
await send("Page.navigate",{url:BASE+"/vendor/horizon-workbench.html"});
await sleep(4200);
console.log("v4 auto:", await ev(`(function(){var r=document.getElementById('tld');return r?('on='+r.classList.contains('on')+' t='+r.querySelector('.tld-t').textContent):'NO TLD';})()`));
await shot("dir-v4-intro");
await ev(`document.querySelector('#tld .tld-next').click()`); await sleep(800);
await shot("dir-v4-rail");
child.kill();ws.close();process.exit(0);
