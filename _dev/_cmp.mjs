import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const PORT = 9693, W = 1280, H = 800;
const BASE = "file:///D:/wobdy%E6%B5%B7%E5%A4%96/2026-10-18-18-15-27/trust-lab";
const EDGE = ["C://Program Files (x86)//Microsoft//Edge//Application//msedge.exe","C://Program Files//Microsoft//Edge//Application//msedge.exe"].find(p=>{try{readFileSync(p);return true}catch{return false}});
const prof = mkdtempSync(join(tmpdir(),"cmp-"));
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

for (const [page, name] of [["m1-mirage.html","cmp-m1"],["m2-horizon.html","cmp-m2"]]) {
  await send("Page.navigate",{url:BASE+"/"+page});
  await sleep(2000);
  await ev(`document.querySelector('.tab[data-layer="hard"]').click()`);
  await sleep(2600);
  await ev(`window.scrollTo(0, document.getElementById('ly-hard').offsetTop - 10)`);
  await sleep(400);
  const s = await send("Page.captureScreenshot",{format:"png",captureBeyondViewport:false});
  writeFileSync(join(tmpdir(), name+".png"), Buffer.from(s.result.data,"base64"));
  console.log(name, await ev(`(()=>{const b=document.getElementById('frameBar');const p=b.parentElement.querySelector('p[style]');return 'barHidden='+b.hidden+' barCls='+b.className+' fsBtn='+!!b.querySelector('.fbtn-fs');})()`));
}
child.kill();ws.close();process.exit(0);
