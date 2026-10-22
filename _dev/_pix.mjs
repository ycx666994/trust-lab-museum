import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const PORT = 9642, W = 1400, H = 900;
const BASE = "file:///D:/wobdy%E6%B5%B7%E5%A4%96/2026-10-18-18-15-27/trust-lab";
const EDGE = ["C://Program Files (x86)//Microsoft//Edge//Application//msedge.exe","C://Program Files//Microsoft//Edge//Application//msedge.exe"].find(p=>{try{readFileSync(p);return true}catch{return false}});
const prof = mkdtempSync(join(tmpdir(),"pix-"));
const child = spawn(EDGE,[`--remote-debugging-port=${PORT}`,`--user-data-dir=${prof}`,"--headless=new","--no-first-run","--disable-gpu","--enable-unsafe-swiftshader",`--window-size=${W},${H}`,"about:blank"],{stdio:"ignore"});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function gt(){for(let i=0;i<50;i++){try{const r=await fetch(`http://127.0.0.1:${PORT}/json/list`);const pg=(await r.json()).find(t=>t.type==="page");if(pg)return pg.webSocketDebuggerUrl;}catch{}await sleep(300);}throw new Error("no target");}
const ws=new WebSocket(await gt());
let id=0;const pend=new Map();
const logs=[];
ws.onmessage=e=>{const m=JSON.parse(e.data);
  if(m.id&&pend.has(m.id)){pend.get(m.id)(m);pend.delete(m.id);}
  if(m.method==="Runtime.exceptionThrown") logs.push("EXC "+JSON.stringify(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text));
  if(m.method==="Runtime.consoleAPICalled") logs.push("LOG "+m.params.args.map(a=>a.value).join(" "));
};
const send=(meth,par={})=>new Promise(r=>{const i=++id;pend.set(i,r);ws.send(JSON.stringify({id:i,method:meth,params:par}));});
const ev=async expr=>{const r=await send("Runtime.evaluate",{expression:expr,returnByValue:true,awaitPromise:true});if(r.result?.exceptionDetails)return "ERR:"+(r.result.exceptionDetails.exception?.description||"").slice(0,300);return r.result?.result?.value;};
await new Promise(r=>{ws.onopen=r;});
await send("Runtime.enable");await send("Page.enable");
await send("Emulation.setDeviceMetricsOverride",{width:W,height:H,deviceScaleFactor:1,mobile:false});
await send("Page.navigate",{url:BASE+"/index.html"});
await sleep(2500);
let ok=false;
for(let i=0;i<40;i++){const r=await ev(`!!(window.TLBG&&TLBG.supported)`);if(r===true){ok=true;break;}await sleep(300);}
if(!ok) console.log("GL NOT READY");
const scene = process.argv[2] || "shuimo";
const out = await ev(`(async()=>{
  const url=TLBG.snap('${scene}',1200,760);
  if(!url) return 'SNAP-EMPTY';
  const im=new Image(); im.src=url; await im.decode();
  const c=document.createElement('canvas'); c.width=1200; c.height=760;
  const g=c.getContext('2d'); g.drawImage(im,0,0);
  const rows=[];
  for(let y=100;y<=700;y+=100){
    let line='y'+y+': ';
    for(let x=100;x<=1100;x+=100){
      const d=g.getImageData(x,y,1,1).data;
      line+=d[0]+'/'+d[1]+'/'+d[2]+' ';
    }
    rows.push(line);
  }
  return rows.join('\\n');
})()`);
console.log(typeof out === "string" ? out : JSON.stringify(out));
if(logs.length) console.log(logs.slice(0,6).join("\n"));
child.kill();ws.close();process.exit(0);
