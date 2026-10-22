import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const PORT = 9707, W = 1440, H = 900;
const BASE = "file:///D:/wobdy%E6%B5%B7%E5%A4%96/2026-10-18-18-15-27/trust-lab";
const EDGE = ["C://Program Files (x86)//Microsoft//Edge//Application//msedge.exe","C://Program Files//Microsoft//Edge//Application//msedge.exe"].find(p=>{try{readFileSync(p);return true}catch{return false}});
const prof = mkdtempSync(join(tmpdir(),"pl-"));
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
await send("Page.navigate",{url:BASE+"/"+(process.argv[2]||"vendor/emergence-lab.html")});
await sleep(3600);

const probe = `(()=>{
  const lum=c=>{const m=c.match(/[\\d.]+/g);if(!m)return 0;const [r,g,b]=m.map(Number);return (0.299*r+0.587*g+0.114*b)/255;};
  const out=[];
  document.querySelectorAll('*').forEach(el=>{
    const t=[...el.childNodes].filter(n=>n.nodeType===3&&n.textContent.trim()).map(n=>n.textContent.trim()).join('');
    if(!t) return;
    const cs=getComputedStyle(el);
    if(cs.display==='none'||cs.visibility==='hidden'||parseFloat(cs.opacity)===0) return;
    const r=el.getBoundingClientRect();
    if(r.width<2||r.height<2) return;
    const c=cs.color, L=lum(c);
    if(L>0.62) out.push({tag:el.tagName.toLowerCase(),cls:(el.className&&el.className.baseVal!==undefined?el.className.baseVal:el.className||'').toString().slice(0,40),color:c,L:+L.toFixed(2),t:t.slice(0,34)});
  });
  return JSON.stringify(out.slice(0,26),null,1);
})()`;
console.log(await ev(probe));
child.kill();ws.close();process.exit(0);
