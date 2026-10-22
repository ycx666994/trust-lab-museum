import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const PORT = 9681, W = 1440, H = 900;
const BASE = "file:///D:/wobdy%E6%B5%B7%E5%A4%96/2026-10-18-18-15-27/trust-lab";
const EDGE = ["C://Program Files (x86)//Microsoft//Edge//Application//msedge.exe","C://Program Files//Microsoft//Edge//Application//msedge.exe"].find(p=>{try{readFileSync(p);return true}catch{return false}});
const prof = mkdtempSync(join(tmpdir(),"dk-"));
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
await send("Page.navigate",{url:BASE+"/"+(process.argv[2]||"m1-mirage.html")});
await sleep(2600);
const out = await ev(`(()=>{
  const lum=c=>{const m=c.match(/rgba?\\((\\d+), (\\d+), (\\d+)(?:, ([\\d.]+))?\\)/);if(!m)return null;const a=m[4]===undefined?1:parseFloat(m[4]);if(a<.4)return null;return (0.299*m[1]+0.587*m[2]+0.114*m[3])/255;};
  const bad=[];
  document.querySelectorAll('body *').forEach(el=>{
    const cs=getComputedStyle(el);const l=lum(cs.backgroundColor);
    if(l!==null&&l<.28){const r=el.getBoundingClientRect();if(r.width*r.height<400)return;
      bad.push((el.tagName+'.'+(el.className||'')).slice(0,42)+' bg='+cs.backgroundColor+' '+Math.round(r.width)+'x'+Math.round(r.height));}
  });
  const tt=document.querySelector('.tab .tt');
  return bad.slice(0,12).join(' || ')+' ### hud='+(document.querySelector('.roomhud')?getComputedStyle(document.querySelector('.roomhud')).backgroundColor+' color='+getComputedStyle(document.querySelector('.roomhud')).color:'none')+' ### tabtt='+(tt?getComputedStyle(tt).color:'none');
})()`);
console.log(out);
child.kill();ws.close();process.exit(0);
