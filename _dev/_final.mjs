import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const PORT = 9723, W = 1440, H = 900;
const BASE = "file:///D:/wobdy%E6%B5%B7%E5%A4%96/2026-10-18-18-15-27/trust-lab";
const ROOT = "D:/wobdy海外/2026-10-18-18-15-27/trust-lab/screens";
const EDGE = ["C://Program Files (x86)//Microsoft//Edge//Application//msedge.exe","C://Program Files//Microsoft//Edge//Application//msedge.exe"].find(p=>{try{readFileSync(p);return true}catch{return false}});
const prof = mkdtempSync(join(tmpdir(),"fn-"));
const child = spawn(EDGE,[`--remote-debugging-port=${PORT}`,`--user-data-dir=${prof}`,"--headless=new","--no-first-run","--enable-unsafe-swiftshader",`--window-size=${W},${H}`,"about:blank"],{stdio:"ignore"});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function gt(){for(let i=0;i<50;i++){try{const r=await fetch(`http://127.0.0.1:${PORT}/json/list`);const pg=(await r.json()).find(t=>t.type==="page");if(pg)return pg.webSocketDebuggerUrl;}catch{}await sleep(300);}throw new Error("no target");}
const ws=new WebSocket(await gt());
let id=0;const pend=new Map();const logs=[];
ws.onmessage=e=>{const m=JSON.parse(e.data);
  if(m.id&&pend.has(m.id)){pend.get(m.id)(m);pend.delete(m.id);}
  if(m.method==="Runtime.exceptionThrown") logs.push("EXC "+String(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text).slice(0,160));
};
const send=(meth,par={})=>new Promise(r=>{const i=++id;pend.set(i,r);ws.send(JSON.stringify({id:i,method:meth,params:par}));});
const ev=async expr=>{const r=await send("Runtime.evaluate",{expression:expr,returnByValue:true,awaitPromise:true});if(r.result?.exceptionDetails)return "ERR:"+(r.result.exceptionDetails.exception?.description||"").slice(0,160);return r.result?.result?.value;};
await new Promise(r=>{ws.onopen=r;});
await send("Runtime.enable");await send("Page.enable");
await send("Emulation.setDeviceMetricsOverride",{width:W,height:H,deviceScaleFactor:1,mobile:false});
async function shot(n){const s=await send("Page.captureScreenshot",{format:"png"});writeFileSync(join(ROOT,n+".png"),Buffer.from(s.result.data,"base64"));console.log("saved",n);}

/* v4：跳过导览后看真实工作台 */
await send("Page.navigate",{url:BASE+"/vendor/horizon-workbench.html"});
await sleep(3400);
console.log("tourBtns:", await ev(`[...document.querySelectorAll('.ovl button,.tour-tip button')].map(b=>b.textContent.trim()).join('|')`));
console.log("skip:", await ev(`(()=>{const bs=[...document.querySelectorAll('button')];const b=bs.find(x=>/跳过|skip/i.test(x.textContent));if(!b)return 'none';b.click();return 'clicked:'+b.textContent.trim();})()`));
await sleep(1200);
console.log("ovlGone:", await ev(`(()=>{const o=document.querySelector('.ovl');return o?('cls='+o.className+' disp='+getComputedStyle(o).display):'no ovl';})()`));
await shot("vendor-v4-light2");

/* v1：hero + 实验室章节 */
await send("Page.navigate",{url:BASE+"/vendor/emergence-lab.html"});
await sleep(3400);
await shot("vendor-v1-light2");
console.log("v1 sections:", await ev(`[...document.querySelectorAll('.vsh-bar button')].map(b=>b.textContent.trim()).join('|')`));
console.log("v1 darkBox:", await ev(`(()=>{const out=[];document.querySelectorAll('.vsh-root>section.on *').forEach(e=>{const c=getComputedStyle(e).backgroundColor;const m=c.match(/\\d+/g);if(m&&m.length>2&&+m[0]<60&&+m[1]<60&&+m[2]<70&&(!m[3]||+m[3]>0.3)){const r=e.getBoundingClientRect();if(r.width>40&&r.height>20)out.push(e.tagName.toLowerCase()+'.'+String(e.className).slice(0,18)+' '+c+' '+Math.round(r.width)+'x'+Math.round(r.height));}});return out.slice(0,8).join(' | ')||'none';})()`));
if(logs.length)console.log(logs.slice(0,3).join("\n"));
child.kill();ws.close();process.exit(0);
