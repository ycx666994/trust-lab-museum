import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const PORT = 9699, W = 1440, H = 900;
const BASE = "file:///D:/wobdy%E6%B5%B7%E5%A4%96/2026-10-18-18-15-27/trust-lab";
const ROOT = "D:/wobdy海外/2026-10-18-18-15-27/trust-lab/screens";
const EDGE = ["C://Program Files (x86)//Microsoft//Edge//Application//msedge.exe","C://Program Files//Microsoft//Edge//Application//msedge.exe"].find(p=>{try{readFileSync(p);return true}catch{return false}});
const prof = mkdtempSync(join(tmpdir(),"sh2-"));
const child = spawn(EDGE,[`--remote-debugging-port=${PORT}`,`--user-data-dir=${prof}`,"--headless=new","--no-first-run","--disable-gpu","--enable-unsafe-swiftshader",`--window-size=${W},${H}`,"about:blank"],{stdio:"ignore"});
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

async function shot(name){
  const s=await send("Page.captureScreenshot",{format:"png",captureBeyondViewport:false});
  writeFileSync(join(ROOT,name+".png"),Buffer.from(s.result.data,"base64"));
  console.log("saved",name);
}

await send("Page.navigate",{url:BASE+"/m2-horizon.html"});
await sleep(2200);
await ev(`document.querySelector('.tab[data-layer="hard"]').click()`);
await sleep(3500);
await ev(`document.getElementById('frameBar').scrollIntoView({block:'center'})`);
await sleep(700);
console.log("bar", await ev(`(()=>{const b=document.getElementById('frameBar').getBoundingClientRect();return 'top='+Math.round(b.top)+' inView='+(b.top>=0&&b.bottom<=innerHeight);})()`));
await shot("lab-m2-new");

await ev(`document.querySelector('.fbtn-fs').click()`);
await sleep(900);
await shot("lab-m2-fs");
await send("Input.dispatchKeyEvent",{type:"keyDown",key:"Escape",code:"Escape",windowsVirtualKeyCode:27,nativeVirtualKeyCode:27});
await send("Input.dispatchKeyEvent",{type:"keyUp",key:"Escape",code:"Escape",windowsVirtualKeyCode:27,nativeVirtualKeyCode:27});
await sleep(600);
await shot("lab-m2-back");
child.kill();ws.close();process.exit(0);
