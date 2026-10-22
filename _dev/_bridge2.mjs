import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const PORT = 9697, W = 1280, H = 800;
const BASE = "file:///D:/wobdy%E6%B5%B7%E5%A4%96/2026-10-18-18-15-27/trust-lab";
const EDGE = ["C://Program Files (x86)//Microsoft//Edge//Application//msedge.exe","C://Program Files//Microsoft//Edge//Application//msedge.exe"].find(p=>{try{readFileSync(p);return true}catch{return false}});
const prof = mkdtempSync(join(tmpdir(),"br2-"));
const child = spawn(EDGE,[`--remote-debugging-port=${PORT}`,`--user-data-dir=${prof}`,"--headless=new","--no-first-run","--disable-gpu","--enable-unsafe-swiftshader",`--window-size=${W},${H}`,"about:blank"],{stdio:"ignore"});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function gt(){for(let i=0;i<50;i++){try{const r=await fetch(`http://127.0.0.1:${PORT}/json/list`);const pg=(await r.json()).find(t=>t.type==="page");if(pg)return pg.webSocketDebuggerUrl;}catch{}await sleep(300);}throw new Error("no target");}
const ws=new WebSocket(await gt());
let id=0;const pend=new Map();const logs=[];
ws.onmessage=e=>{const m=JSON.parse(e.data);
  if(m.id&&pend.has(m.id)){pend.get(m.id)(m);pend.delete(m.id);}
  if(m.method==="Runtime.exceptionThrown") logs.push("EXC "+JSON.stringify(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text));
};
const send=(meth,par={})=>new Promise(r=>{const i=++id;pend.set(i,r);ws.send(JSON.stringify({id:i,method:meth,params:par}));});
const ev=async expr=>{const r=await send("Runtime.evaluate",{expression:expr,returnByValue:true,awaitPromise:true});if(r.result?.exceptionDetails)return "ERR:"+(r.result.exceptionDetails.exception?.description||"").slice(0,160);return r.result?.result?.value;};
await new Promise(r=>{ws.onopen=r;});
await send("Runtime.enable");await send("Page.enable");
await send("Emulation.setDeviceMetricsOverride",{width:W,height:H,deviceScaleFactor:1,mobile:false});

/* m2 单独打开：工具栏是否在首屏 + 影院全屏 + Esc 复原 */
await send("Page.navigate",{url:BASE+"/m2-horizon.html"});
await sleep(2000);
await ev(`document.querySelector('.tab[data-layer="hard"]').click()`);
await sleep(3200);
console.log("barInView", await ev(`(()=>{const b=document.getElementById('frameBar');const r=b.getBoundingClientRect();return 'hidden='+b.hidden+' top='+Math.round(r.top)+' bottom='+Math.round(r.bottom)+' vh='+innerHeight;})()`));
console.log("before", await ev(`(()=>{const r=document.getElementById('frameBox').getBoundingClientRect();return [r.x,r.y,r.width,r.height].map(Math.round).join(',');})()`));
await ev(`document.querySelector('.fbtn-fs').click()`);
await sleep(700);
console.log("fsOn", await ev(`(()=>{const e=document.getElementById('frameBox');const r=e.getBoundingClientRect();const b=document.getElementById('frameBar').getBoundingClientRect();return e.className+' box='+[r.x,r.y,r.width,r.height].map(Math.round).join(',')+' barTop='+Math.round(b.top);})()`));
await send("Input.dispatchKeyEvent",{type:"keyDown",key:"Escape",code:"Escape",windowsVirtualKeyCode:27,nativeVirtualKeyCode:27});
await send("Input.dispatchKeyEvent",{type:"keyUp",key:"Escape",code:"Escape",windowsVirtualKeyCode:27,nativeVirtualKeyCode:27});
await sleep(600);
console.log("escBack", await ev(`(()=>{const e=document.getElementById('frameBox');const r=e.getBoundingClientRect();const p=e.parentNode;return e.className+' '+[r.x,r.y,r.width,r.height].map(Math.round).join(',')+' parent='+p.className;})()`));
console.log("orderOK", await ev(`(()=>{const bar=document.getElementById('frameBar');const box=document.getElementById('frameBox');return bar.compareDocumentPosition(box)===4;})()`));
if(logs.length) console.log(logs.slice(0,4).join("\n")); else console.log("no exc");
child.kill();ws.close();process.exit(0);
