import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const PORT = 9731, W = 1440, H = 900;
const BASE = "file:///D:/wobdy%E6%B5%B7%E5%A4%96/2026-10-18-18-15-27/trust-lab";
const EDGE = ["C://Program Files (x86)//Microsoft//Edge//Application//msedge.exe","C://Program Files//Microsoft//Edge//Application//msedge.exe"].find(p=>{try{readFileSync(p);return true}catch{return false}});
const prof = mkdtempSync(join(tmpdir(),"an-"));
const child = spawn(EDGE,[`--remote-debugging-port=${PORT}`,`--user-data-dir=${prof}`,"--headless=new","--no-first-run","--enable-unsafe-swiftshader",`--window-size=${W},${H}`,"about:blank"],{stdio:"ignore"});
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

await send("Page.navigate",{url:BASE+"/vendor/emergence-lab.html#lab"});
await sleep(3400);
console.log("on section:", await ev(`(function(){var s=document.querySelector('.vsh-root>section.on');return s?s.id+'|'+s.className:'none';})()`));
console.log("LAB IDS:", await ev(`(function(){var s=document.getElementById('lab');if(!s)return 'no lab';var out=[];s.querySelectorAll('[id]').forEach(function(e){var r=e.getBoundingClientRect();if(r.width<20||r.height<10)return;out.push(e.id+':'+e.tagName.toLowerCase()+(e.className?'.'+String(e.className).split(' ')[0]:'')+' '+Math.round(r.width)+'x'+Math.round(r.height));});return out.join(' | ');})()`));
console.log("LABTABS:", await ev(`(function(){var t=document.getElementById('labTabs');if(!t)return 'none';return t.innerHTML.replace(/\\s+/g,' ').slice(0,260);})()`));
console.log("vshbar:", await ev(`(function(){var b=document.getElementById('vshBar');return b?b.innerText.replace(/\\n/g,'/').slice(0,120):'none';})()`));

await send("Page.navigate",{url:BASE+"/vendor/horizon-workbench.html"});
await sleep(3200);
await ev(`(function(){var b=[].slice.call(document.querySelectorAll('button')).filter(function(x){return /跳过/.test(x.textContent);})[0];if(b)b.click();})()`);
await sleep(600);
console.log("V4 anchors:", await ev(`(function(){var ids=['rail','canvas','insp','dock','btnPreset','btnPal'];return ids.map(function(i){var e=document.getElementById(i);if(!e)return i+':MISSING';var r=e.getBoundingClientRect();return i+' '+Math.round(r.left)+','+Math.round(r.top)+' '+Math.round(r.width)+'x'+Math.round(r.height);}).join(' | ');})()`));
console.log("V4 title:", await ev(`(function(){var e=document.querySelector('.ovl');return e?e.className:'no ovl';})()`));
child.kill();ws.close();process.exit(0);
