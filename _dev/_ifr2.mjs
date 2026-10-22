import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const PORT = 9701, W = 1440, H = 900;
const BASE = "file:///D:/wobdy%E6%B5%B7%E5%A4%96/2026-10-18-18-15-27/trust-lab";
const EDGE = ["C://Program Files (x86)//Microsoft//Edge//Application//msedge.exe","C://Program Files//Microsoft//Edge//Application//msedge.exe"].find(p=>{try{readFileSync(p);return true}catch{return false}});
const prof = mkdtempSync(join(tmpdir(),"ifr2-"));
const child = spawn(EDGE,[`--remote-debugging-port=${PORT}`,`--user-data-dir=${prof}`,"--headless=new","--no-first-run","--disable-gpu","--enable-unsafe-swiftshader",`--window-size=${W},${H}`,"about:blank"],{stdio:"ignore"});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function gt(){for(let i=0;i<50;i++){try{const r=await fetch(`http://127.0.0.1:${PORT}/json/list`);const pg=(await r.json()).find(t=>t.type==="page");if(pg)return pg.webSocketDebuggerUrl;}catch{}await sleep(300);}throw new Error("no target");}
const ws=new WebSocket(await gt());
let id=0;const pend=new Map();
ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pend.has(m.id)){pend.get(m.id)(m);pend.delete(m.id);}};
const send=(meth,par={},s=ws)=>new Promise(r=>{const i=++id;pend.set(i,r);s.send(JSON.stringify({id:i,method:meth,params:par}));});
const ev=async expr=>{const r=await send("Runtime.evaluate",{expression:expr,returnByValue:true,awaitPromise:true});if(r.result?.exceptionDetails)return "ERR:"+(r.result.exceptionDetails.exception?.description||"").slice(0,200);return r.result?.result?.value;};
await new Promise(r=>{ws.onopen=r;});
await send("Runtime.enable");await send("Page.enable");
await send("Emulation.setDeviceMetricsOverride",{width:W,height:H,deviceScaleFactor:1,mobile:false});

await send("Page.navigate",{url:BASE+"/m1-mirage.html"});
await sleep(2200);
await ev(`document.querySelector('.tab[data-layer="hard"]').click()`);
await sleep(4000);
console.log("iframe src", await ev(`(()=>{const f=document.querySelector('#frameBox iframe');return f?f.getAttribute('src'):'NO IFRAME';})()`));
console.log("iframe box", await ev(`(()=>{const f=document.querySelector('#frameBox iframe');if(!f)return '-';const r=f.getBoundingClientRect();return [r.width,r.height].map(Math.round).join('x');})()`));

const tl = await send("Target.getTargets");
const ifr = (tl.result.targetInfos||[]).filter(t=>t.type==="iframe");
console.log("iframe targets", ifr.map(t=>t.url.split("/").pop()+"|"+t.targetId.slice(0,8)).join(" , "));
if(!ifr.length){ console.log("NO IFRAME TARGET"); child.kill(); ws.close(); process.exit(0); }

const at = await send("Target.attachToTarget",{targetId:ifr[0].targetId,flatten:true});
const sid = at.result.sessionId;
const sendS=(meth,par={})=>new Promise(r=>{const i=++id;pend.set(i,r);ws.send(JSON.stringify({id:i,sessionId:sid,method:meth,params:par}));});
await sendS("Runtime.enable");
await sleep(400);
const evS=async expr=>{const r=await sendS("Runtime.evaluate",{expression:expr,returnByValue:true,awaitPromise:true});if(r.result?.exceptionDetails)return "ERR:"+(r.result.exceptionDetails.exception?.description||"").slice(0,200);return r.result?.result?.value;};
console.log("inner text len", await evS(`document.body.innerText.trim().length`));
console.log("inner head", await evS(`document.body.innerText.trim().slice(0,120).replace(/\\n/g,' / ')`));
console.log("sections", await evS(`(()=>{const r=document.querySelector('.vsh-root');if(!r)return 'no vsh-root';const s=[...r.children].filter(e=>e.tagName==='SECTION');return 'total='+s.length+' on='+s.filter(e=>e.classList.contains('on')).length+' shown='+s.filter(e=>getComputedStyle(e).display!=='none').length;})()`));
console.log("vshbar", await evS(`(()=>{const b=document.getElementById('vshBar');if(!b)return 'none';const r=b.getBoundingClientRect();return 'btns='+b.querySelectorAll('button').length+' w='+Math.round(r.width)+' h='+Math.round(r.height)+' disp='+getComputedStyle(b).display;})()`));
console.log("body bg", await evS(`getComputedStyle(document.body).backgroundColor+' / color='+getComputedStyle(document.body).color`));
child.kill();ws.close();process.exit(0);
