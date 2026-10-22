import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const PORT = 9751, W = 1440, H = 900;
const BASE = "file:///D:/wobdy%E6%B5%B7%E5%A4%96/2026-10-18-18-15-27/trust-lab";
const EDGE = ["C://Program Files (x86)//Microsoft//Edge//Application//msedge.exe","C://Program Files//Microsoft//Edge//Application//msedge.exe"].find(p=>{try{readFileSync(p);return true}catch{return false}});
const prof = mkdtempSync(join(tmpdir(),"tu3-"));
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
await send("Page.navigate",{url:BASE+"/vendor/emergence-lab.html"});
for(var i=0;i<30;i++){ if(await ev(`!!document.getElementById('tld')`)) break; await sleep(400); }
await sleep(900);
const DUMP = `(function(){
  var st=document.querySelector('#tld .tld-step').textContent;
  var sp=document.querySelector('#tld .tld-spot').getBoundingClientRect();
  var cd=document.querySelector('#tld .tld-card').getBoundingClientRect();
  var sec=document.querySelector('.vsh-root>section.on');
  var tgt=null, sel=null;
  /* 找当前步的目标：把 8 个候选都量一遍 */
  var cands=['#vshBar','#labTabs','#btnReroll','#ctlTau','#chartMain','#verdictBox','#caveatNote'];
  var info=cands.map(function(s){var e=document.querySelector(s);if(!e)return s+':missing';var r=e.getBoundingClientRect();return s+':'+[r.left,r.top,r.width,r.height].map(Math.round).join(',');}).join(' | ');
  return st+'\\n   spot='+[sp.left,sp.top,sp.width,sp.height].map(Math.round).join(',')+
    '\\n   card='+[cd.left,cd.top,cd.width,cd.height].map(Math.round).join(',')+
    '\\n   sec='+(sec.id||'hero')+' scrollTop='+Math.round(sec.scrollTop)+
    '\\n   '+info;
})()`;
for (var k=1;k<=6;k++){
  console.log("--- step",k);
  console.log(await ev(DUMP));
  await ev(`document.querySelector('#tld .tld-next').click()`);
  await sleep(1200);
}
child.kill();ws.close();process.exit(0);
