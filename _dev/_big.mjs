import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const PORT = 9634, W = 1460, H = 940;
const BASE = "file:///D:/wobdy%E6%B5%B7%E5%A4%96/2026-10-18-18-15-27/trust-lab";
const EDGE = ["C://Program Files (x86)//Microsoft//Edge//Application//msedge.exe","C://Program Files//Microsoft//Edge//Application//msedge.exe"].find(p=>{try{readFileSync(p);return true}catch{return false}});
const prof = mkdtempSync(join(tmpdir(),"bg1-"));
const child = spawn(EDGE,[`--remote-debugging-port=${PORT}`,`--user-data-dir=${prof}`,"--headless=new","--no-first-run","--disable-gpu","--enable-unsafe-swiftshader",`--window-size=${W},${H}`,"--disable-background-timer-throttling","--disable-features=IntensiveWakeUpThrottling","about:blank"],{stdio:"ignore"});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function gt(){for(let i=0;i<50;i++){try{const r=await fetch(`http://127.0.0.1:${PORT}/json/list`);const pg=(await r.json()).find(t=>t.type==="page");if(pg)return pg.webSocketDebuggerUrl;}catch{}await sleep(300);}throw new Error("no target");}
const ws=new WebSocket(await gt());
let id=0;const pend=new Map();const exc=[],logs=[];
ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pend.has(m.id)){pend.get(m.id)(m);pend.delete(m.id);}
 if(m.method==="Runtime.exceptionThrown")exc.push((m.params.exceptionDetails?.exception?.description||m.params.exceptionDetails?.text||"exc").slice(0,400));
 if(m.method==="Runtime.consoleAPICalled"){const a=(m.params.args||[]).map(x=>x.value||x.description||"").join(" ");if(/TLBG|shader|ERROR/i.test(a))logs.push(a.slice(0,600));}};
const send=(meth,par={})=>new Promise(r=>{const i=++id;pend.set(i,r);ws.send(JSON.stringify({id:i,method:meth,params:par}));});
const ev=async expr=>{const r=await send("Runtime.evaluate",{expression:expr,returnByValue:true,awaitPromise:true});if(r.result?.exceptionDetails)return{EXC:(r.result.exceptionDetails.exception?.description||r.result.exceptionDetails.text||"").slice(0,400)};return r.result?.result?.value;};
const shot=async(name,clip)=>{const s=await send("Page.captureScreenshot",{format:"png",captureBeyondViewport:true,clip:clip||{x:0,y:0,width:W,height:H,scale:1}});writeFileSync(join(tmpdir(),name),Buffer.from(s.result.data,"base64"));};
await new Promise(r=>{ws.onopen=r;});
await send("Runtime.enable");await send("Page.enable");
await send("Emulation.setDeviceMetricsOverride",{width:W,height:H,deviceScaleFactor:1,mobile:false});
await send("Page.navigate",{url:BASE+"/index.html"});
await sleep(2500);
for(let i=0;i<40;i++){const r=await ev(`!!(window.TLBG&&TLBG.supported)`);if(r===true)break;await sleep(300);}
const ids = process.argv.slice(2);
const names={"jinbi":"金碧辉煌","gudian":"古典穹顶","fugu":"复古画廊","menghuan":"梦幻云厅","shuimo":"水墨长卷","baihe":"未来白盒","shenhai":"深海展厅","xingkong":"星空穹幕","qingtong":"青铜古殿","wenshi":"玻璃温室","saibo":"赛博展柜","yexun":"夜巡长廊"};
const r = await ev(`(()=>{
  if(!window.TLBG||!TLBG.supported) return {ok:false};
  const ids=${JSON.stringify(ids)}, names=${JSON.stringify(names)};
  const urls={}; ids.forEach(k=>{ urls[k]=TLBG.snap(k,700,430); });
  const box=document.createElement('div');
  box.id='__sheet';
  box.style.cssText='position:fixed;inset:0;z-index:99999;background:#05070c;display:grid;grid-template-columns:repeat(2,700px);gap:8px;padding:8px;font:12px/1.3 system-ui;color:#cfe0f0';
  ids.forEach(k=>{
    const d=document.createElement('div');
    d.style.cssText='width:700px';
    d.innerHTML='<img src="'+urls[k]+'" style="width:700px;height:430px;display:block"><div style="padding:2px">'+names[k]+' <span style="opacity:.5">'+k+'</span></div>';
    box.appendChild(d);
  });
  document.body.appendChild(box);
  return {ok:true};
})()`);
console.log("SHEET:",JSON.stringify(r));
await sleep(500);
await shot("bg_big.png",{x:0,y:0,width:W,height:H,scale:1});
console.log("exceptions:",exc.length?exc:"none");
console.log("console:",logs.length?logs:"none");
child.kill();ws.close();process.exit(0);
