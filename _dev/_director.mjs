import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const PORT = 9741, W = 1440, H = 900;
const BASE = "file:///D:/wobdy%E6%B5%B7%E5%A4%96/2026-10-18-18-15-27/trust-lab";
const ROOT = "D:/wobdy海外/2026-10-18-18-15-27/trust-lab/screens";
const EDGE = ["C://Program Files (x86)//Microsoft//Edge//Application//msedge.exe","C://Program Files//Microsoft//Edge//Application//msedge.exe"].find(p=>{try{readFileSync(p);return true}catch{return false}});
const prof = mkdtempSync(join(tmpdir(),"dir-"));
const child = spawn(EDGE,[`--remote-debugging-port=${PORT}`,`--user-data-dir=${prof}`,"--headless=new","--no-first-run","--enable-unsafe-swiftshader",`--window-size=${W},${H}`,"about:blank"],{stdio:"ignore"});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function gt(){for(let i=0;i<50;i++){try{const r=await fetch(`http://127.0.0.1:${PORT}/json/list`);const pg=(await r.json()).find(t=>t.type==="page");if(pg)return pg.webSocketDebuggerUrl;}catch{}await sleep(300);}throw new Error("no target");}
const ws=new WebSocket(await gt());
let id=0;const pend=new Map();const errs=[];
ws.onmessage=e=>{const m=JSON.parse(e.data);
  if(m.id&&pend.has(m.id)){pend.get(m.id)(m);pend.delete(m.id);}
  if(m.method==="Runtime.exceptionThrown") errs.push(String(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text).slice(0,200));
};
const send=(meth,par={})=>new Promise(r=>{const i=++id;pend.set(i,r);ws.send(JSON.stringify({id:i,method:meth,params:par}));});
const ev=async expr=>{const r=await send("Runtime.evaluate",{expression:expr,returnByValue:true,awaitPromise:true});if(r.result?.exceptionDetails)return "ERR:"+(r.result.exceptionDetails.exception?.description||"").slice(0,200);return r.result?.result?.value;};
await new Promise(r=>{ws.onopen=r;});
await send("Runtime.enable");await send("Page.enable");
await send("Emulation.setDeviceMetricsOverride",{width:W,height:H,deviceScaleFactor:1,mobile:false});
async function shot(n){const s=await send("Page.captureScreenshot",{format:"png"});writeFileSync(join(ROOT,n+".png"),Buffer.from(s.result.data,"base64"));console.log("   saved",n);}

const STATE = `(function(){var r=document.getElementById('tld');var f=document.getElementById('tldFab');
  if(!r)return 'NO TLD';
  return 'on='+r.classList.contains('on')+' disp='+getComputedStyle(r).display+
  ' step='+(r.querySelector('.tld-step').textContent||'-')+
  ' title='+(r.querySelector('.tld-t').textContent||'-')+
  ' fabHidden='+f.classList.contains('hide');})()`;
const SPOT = `(function(){var s=document.querySelector('#tld .tld-spot');var c=document.querySelector('#tld .tld-card');
  var sr=s.getBoundingClientRect(),cr=c.getBoundingClientRect();
  return 'spot='+[sr.left,sr.top,sr.width,sr.height].map(Math.round).join(',')+
  ' card='+[cr.left,cr.top,cr.width,cr.height].map(Math.round).join(',')+
  ' inView='+(cr.left>=0&&cr.top>=0&&cr.right<=innerWidth&&cr.bottom<=innerHeight);})()`;

for (const [file,key,name] of [["vendor/emergence-lab.html","tl.dir.m1","dir-v1"],["vendor/horizon-workbench.html","tl.dir.m2","dir-v4"]]) {
  errs.length=0;
  await send("Page.navigate",{url:BASE+"/"+file});
  await sleep(3000);
  console.log("=="+file);
  console.log("  auto:", await ev(STATE));
  await shot(name+"-1");
  for (let k=2;k<=4;k++){
    await ev(`document.querySelector('#tld .tld-next').click()`);
    await sleep(650);
    console.log("  step"+k+":", await ev(STATE));
    console.log("     ", await ev(SPOT));
  }
  await shot(name+"-mid");
  console.log("  prev:", await ev(`(function(){document.querySelector('#tld .tld-prev').click();return 'ok';})()`));
  await sleep(600);
  console.log("  afterPrev:", await ev(STATE));
  /* 一路点完 */
  for (let k=0;k<12;k++){ await ev(`(function(){var r=document.getElementById('tld');if(r.classList.contains('on'))document.querySelector('#tld .tld-next').click();})()`); await sleep(160); }
  await sleep(400);
  console.log("  done:", await ev(STATE), "| ls:", await ev(`(function(){try{return localStorage.getItem('${key}');}catch(e){return 'ERR';}})()`));
  console.log("  suppress:", await ev(`(function(){try{return 'horizon.seen='+localStorage.getItem('horizon.seen');}catch(e){return 'ERR';}})()`));
  console.log("  fab:", await ev(`(function(){var f=document.getElementById('tldFab');var r=f.getBoundingClientRect();return Math.round(r.left)+','+Math.round(r.top)+' '+Math.round(r.width)+'x'+Math.round(r.height)+' vis='+(getComputedStyle(f).opacity);})()`));
  /* 叫回 */
  await ev(`document.getElementById('tldFab').click()`);
  await sleep(700);
  console.log("  reopen:", await ev(STATE));
  await shot(name+"-reopen");
  console.log("  errs:", errs.length?errs.slice(0,2).join(" || "):"none");
}
child.kill();ws.close();process.exit(0);
