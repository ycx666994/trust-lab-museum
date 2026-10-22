import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const PORT = 9747, W = 1440, H = 900;
const BASE = "file:///D:/wobdy%E6%B5%B7%E5%A4%96/2026-10-18-18-15-27/trust-lab";
const EDGE = ["C://Program Files (x86)//Microsoft//Edge//Application//msedge.exe","C://Program Files//Microsoft//Edge//Application//msedge.exe"].find(p=>{try{readFileSync(p);return true}catch{return false}});
const prof = mkdtempSync(join(tmpdir(),"tu2-"));
const child = spawn(EDGE,[`--remote-debugging-port=${PORT}`,`--user-data-dir=${prof}`,"--headless=new","--no-first-run","--enable-unsafe-swiftshader",`--window-size=${W},${H}`,"about:blank"],{stdio:"ignore"});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function gt(){for(let i=0;i<50;i++){try{const r=await fetch(`http://127.0.0.1:${PORT}/json/list`);const pg=(await r.json()).find(t=>t.type==="page");if(pg)return pg.webSocketDebuggerUrl;}catch{}await sleep(300);}throw new Error("no target");}
const ws=new WebSocket(await gt());
let id=0;const pend=new Map();const errs=[];
ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pend.has(m.id)){pend.get(m.id)(m);pend.delete(m.id);}
 if(m.method==="Runtime.exceptionThrown") errs.push(String(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text).slice(0,180));};
const send=(meth,par={})=>new Promise(r=>{const i=++id;pend.set(i,r);ws.send(JSON.stringify({id:i,method:meth,params:par}));});
const ev=async expr=>{const r=await send("Runtime.evaluate",{expression:expr,returnByValue:true,awaitPromise:true});if(r.result?.exceptionDetails)return "ERR:"+(r.result.exceptionDetails.exception?.description||"").slice(0,200);return r.result?.result?.value;};
await new Promise(r=>{ws.onopen=r;});
await send("Runtime.enable");await send("Page.enable");
await send("Emulation.setDeviceMetricsOverride",{width:W,height:H,deviceScaleFactor:1,mobile:false});
await send("Page.navigate",{url:BASE+"/vendor/emergence-lab.html"});
await sleep(5200);
console.log("init:", await ev(`(function(){var r=document.getElementById('tld');return r.querySelector('.tld-t').textContent+' | '+r.querySelector('.tld-step').textContent;})()`));
for (var k=0;k<6;k++){
  var res = await ev(`(function(){var b=document.querySelector('#tld .tld-next');if(!b)return 'no btn';b.click();var r=document.getElementById('tld');return r.querySelector('.tld-t').textContent+' | '+r.querySelector('.tld-step').textContent;})()`);
  await sleep(750);
  var after = await ev(`(function(){var r=document.getElementById('tld');var s=document.querySelector('.vsh-root>section.on');return r.querySelector('.tld-t').textContent+' | '+r.querySelector('.tld-step').textContent+' | sec='+(s.id||'hero')+' spot='+(function(){var q=document.querySelector('#tld .tld-spot').getBoundingClientRect();return [q.left,q.top,q.width,q.height].map(Math.round).join(',');})();})()`);
  console.log("click"+(k+1)+" ->", res, "|| after:", after);
}
console.log("errs:", errs.length?errs.slice(0,3).join(" || "):"none");
child.kill();ws.close();process.exit(0);
