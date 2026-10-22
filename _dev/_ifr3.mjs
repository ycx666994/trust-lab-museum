import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const PORT = 9703, W = 1440, H = 900;
const BASE = "file:///D:/wobdy%E6%B5%B7%E5%A4%96/2026-10-18-18-15-27/trust-lab";
const EDGE = ["C://Program Files (x86)//Microsoft//Edge//Application//msedge.exe","C://Program Files//Microsoft//Edge//Application//msedge.exe"].find(p=>{try{readFileSync(p);return true}catch{return false}});
const prof = mkdtempSync(join(tmpdir(),"ifr3-"));
const child = spawn(EDGE,[`--remote-debugging-port=${PORT}`,`--user-data-dir=${prof}`,"--headless=new","--no-first-run","--disable-gpu","--enable-unsafe-swiftshader",`--window-size=${W},${H}`,"about:blank"],{stdio:"ignore"});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function gt(){for(let i=0;i<50;i++){try{const r=await fetch(`http://127.0.0.1:${PORT}/json/list`);const pg=(await r.json()).find(t=>t.type==="page");if(pg)return pg.webSocketDebuggerUrl;}catch{}await sleep(300);}throw new Error("no target");}
const ws=new WebSocket(await gt());
let id=0;const pend=new Map();const ctxs=[];
ws.onmessage=e=>{const m=JSON.parse(e.data);
  if(m.id&&pend.has(m.id)){pend.get(m.id)(m);pend.delete(m.id);}
  if(m.method==="Runtime.executionContextCreated") ctxs.push(m.params.context);
};
const send=(meth,par={})=>new Promise(r=>{const i=++id;pend.set(i,r);ws.send(JSON.stringify({id:i,method:meth,params:par}));});
const ev=async expr=>{const r=await send("Runtime.evaluate",{expression:expr,returnByValue:true,awaitPromise:true});if(r.result?.exceptionDetails)return "ERR:"+(r.result.exceptionDetails.exception?.description||"").slice(0,200);return r.result?.result?.value;};
await new Promise(r=>{ws.onopen=r;});
await send("Runtime.enable");await send("Page.enable");
await send("Emulation.setDeviceMetricsOverride",{width:W,height:H,deviceScaleFactor:1,mobile:false});

await send("Page.navigate",{url:BASE+"/m1-mirage.html"});
await sleep(2200);
await ev(`document.querySelector('.tab[data-layer="hard"]').click()`);
await sleep(4500);

const ft = await send("Page.getFrameTree");
const child_frames=[];
(function walk(n){ (n.childFrames||[]).forEach(c=>{child_frames.push(c.frame); walk(c);}); })(ft.result.frameTree);
console.log("frames", child_frames.map(f=>(f.url.split("/").pop()||"(blank)")+" id="+f.id.slice(0,8)).join(" , "));

const target = child_frames.find(f=>/emergence-lab/.test(f.url)) || child_frames[0];
if(!target){ console.log("NO CHILD FRAME"); child.kill(); ws.close(); process.exit(0); }
const cw = await send("Page.createIsolatedWorld",{frameId:target.id,worldName:"probe",grantUniveralAccess:true});
const ctx = cw.result.executionContextId;
const evC=async expr=>{const r=await send("Runtime.evaluate",{expression:expr,returnByValue:true,awaitPromise:true,contextId:ctx});if(r.result?.exceptionDetails)return "ERR:"+(r.result.exceptionDetails.exception?.description||"").slice(0,200);return r.result?.result?.value;};

console.log("readyState", await evC(`document.readyState`));
console.log("textLen", await evC(`document.body.innerText.trim().length`));
console.log("head", await evC(`document.body.innerText.trim().slice(0,150).replace(/\\n/g,' / ')`));
console.log("sections", await evC(`(()=>{const r=document.querySelector('.vsh-root');if(!r)return 'no vsh-root';const s=[...r.children].filter(e=>e.tagName==='SECTION');return 'total='+s.length+' on='+s.filter(e=>e.classList.contains('on')).length+' shown='+s.filter(e=>getComputedStyle(e).display!=='none').length;})()`));
console.log("vshbar", await evC(`(()=>{const b=document.getElementById('vshBar');if(!b)return 'none';const r=b.getBoundingClientRect();return 'btns='+b.querySelectorAll('button').length+' w='+Math.round(r.width)+' h='+Math.round(r.height)+' disp='+getComputedStyle(b).display;})()`));
console.log("bg", await evC(`getComputedStyle(document.body).backgroundColor`));
console.log("scriptErr", await evC(`window.__vshErr||'none'`));
child.kill();ws.close();process.exit(0);
