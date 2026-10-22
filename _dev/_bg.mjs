import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const PORT = 9633, W = 1320, H = 880;
const BASE = "file:///D:/wobdy%E6%B5%B7%E5%A4%96/2026-10-18-18-15-27/trust-lab";
const EDGE = ["C://Program Files (x86)//Microsoft//Edge//Application//msedge.exe","C://Program Files//Microsoft//Edge//Application//msedge.exe"].find(p=>{try{readFileSync(p);return true}catch{return false}});
const prof = mkdtempSync(join(tmpdir(),"bg-"));
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
await send("Runtime.enable");await send("Page.enable");await send("Log.enable");
await send("Emulation.setDeviceMetricsOverride",{width:W,height:H,deviceScaleFactor:1,mobile:false});
await send("Page.navigate",{url:BASE+"/index.html"});
await sleep(2000);
// 等 GL 自举完成
let ready=null;
for(let i=0;i<40;i++){
  ready=await ev(`({sup:!!(window.TLBG&&TLBG.supported),boot:!!(window.TLBG&&TLBG.booting)})`);
  if(ready && ready.sup===true) break;
  if(ready && ready.boot===false && ready.sup===false) break;
  await sleep(500);
}
console.log("GL:",JSON.stringify(ready));
const info = await ev(`(()=>{const c=document.querySelector('#bgGL');return {canvas:!!c,w:c?c.width:0,h:c?c.height:0,op:c?c.style.opacity:null};})()`);
console.log("CANVAS:",JSON.stringify(info));

// 生成 12 张联系表
const ids=["jinbi","gudian","fugu","menghuan","shuimo","baihe","shenhai","xingkong","qingtong","wenshi","saibo","yexun"];
const names={"jinbi":"金碧辉煌","gudian":"古典穹顶","fugu":"复古画廊","menghuan":"梦幻云厅","shuimo":"水墨长卷","baihe":"未来白盒","shenhai":"深海展厅","xingkong":"星空穹幕","qingtong":"青铜古殿","wenshi":"玻璃温室","saibo":"赛博展柜","yexun":"夜巡长廊"};
const sheet = await ev(`(()=>{
  if(!window.TLBG||!TLBG.supported) return {ok:false};
  const ids=${JSON.stringify(ids)}, names=${JSON.stringify(names)};
  const urls={}; ids.forEach(k=>{ urls[k]=TLBG.snap(k,320,200); });
  const box=document.createElement('div');
  box.id='__sheet';
  box.style.cssText='position:fixed;inset:0;z-index:99999;background:#05070c;display:grid;grid-template-columns:repeat(4,320px);gap:10px;padding:10px;font:12px/1.4 system-ui;color:#cfe0f0';
  ids.forEach(k=>{
    const d=document.createElement('div');
    d.style.cssText='width:320px';
    d.innerHTML='<img src="'+urls[k]+'" style="width:320px;height:200px;display:block;border-radius:6px"><div style="padding:4px 2px">'+names[k]+' <span style="opacity:.5;font-size:10px">'+k+'</span></div>';
    box.appendChild(d);
  });
  document.body.appendChild(box);
  return {ok:true,count:ids.length,blank:Object.entries(urls).filter(([k,v])=>v.length<2000).map(([k])=>k)};
})()`);
console.log("SHEET:",JSON.stringify(sheet));
await sleep(600);
await shot("bg_sheet.png",{x:0,y:0,width:W,height:H,scale:1});

// 逐张应用真实页面背景截图（取 4 个代表）
for (const k of ["jinbi","fugu","shenhai","xingkong"]) {
  await ev(`(()=>{const b=[...document.querySelectorAll('#bgGrid .bgopt')];const t=b.find(x=>x.dataset.bg==='${k}');if(t)t.click();})()`);
  await sleep(1400);
  await shot(`bg_${k}.png`);
}
// 恢复默认
await ev(`(()=>{const b=[...document.querySelectorAll('#bgGrid .bgopt')];const t=b.find(x=>x.dataset.bg==='def');if(t)t.click();})()`);
await sleep(600);
// 移除联系表后测选择器 UI
await ev(`(()=>{const s=document.getElementById('__sheet');if(s)s.remove();document.getElementById('bgBtn').click();})()`);
await sleep(900);
await shot("bg_picker.png");
console.log("exceptions:",exc.length?exc:"none");
console.log("console:",logs.length?logs:"none");
child.kill();ws.close();process.exit(0);
