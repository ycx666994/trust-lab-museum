import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const PORT = 9600, W = 1506, H = 860;
const BASE = "file:///D:/wobdy%E6%B5%B7%E5%A4%96/2026-10-18-18-15-27/trust-lab";
const EDGE = ["C://Program Files (x86)//Microsoft//Edge//Application//msedge.exe","C://Program Files//Microsoft//Edge//Application//msedge.exe"].find(p=>{try{readFileSync(p);return true}catch{return false}});
const prof = mkdtempSync(join(tmpdir(),"map-"));
const child = spawn(EDGE,[`--remote-debugging-port=${PORT}`,`--user-data-dir=${prof}`,"--headless=new","--no-first-run","--disable-gpu","--enable-unsafe-swiftshader",`--window-size=${W},${H}`,"--disable-background-timer-throttling","--disable-backgrounding-occluded-windows","--disable-renderer-backgrounding","--disable-features=IntensiveWakeUpThrottling","about:blank"],{stdio:"ignore"});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function gt(){for(let i=0;i<40;i++){try{const r=await fetch(`http://127.0.0.1:${PORT}/json/list`);const pg=(await r.json()).find(t=>t.type==="page");if(pg)return pg.webSocketDebuggerUrl;}catch{}await sleep(300);}throw new Error("no target");}
const ws=new WebSocket(await gt());
let id=0;const pend=new Map();const exc=[];
ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pend.has(m.id)){pend.get(m.id)(m);pend.delete(m.id);}if(m.method==="Runtime.exceptionThrown")exc.push((m.params.exceptionDetails?.exception?.description||m.params.exceptionDetails?.text||"exc").slice(0,300));};
const send=(meth,par={})=>new Promise(r=>{const i=++id;pend.set(i,r);ws.send(JSON.stringify({id:i,method:meth,params:par}));});
const ev=async expr=>{const r=await send("Runtime.evaluate",{expression:expr,returnByValue:true,awaitPromise:true});if(r.result?.exceptionDetails)return{EXC:(r.result.exceptionDetails.exception?.description||"").slice(0,300)};return r.result?.result?.value;};
const shot=async(name)=>{const s=await send("Page.captureScreenshot",{format:"png",captureBeyondViewport:true,clip:{x:0,y:0,width:W,height:H,scale:1}});writeFileSync(join(tmpdir(),name),Buffer.from(s.result.data,"base64"));};
await new Promise(r=>{ws.onopen=r;});
await send("Runtime.enable");await send("Page.enable");
await send("Emulation.setDeviceMetricsOverride",{width:W,height:H,deviceScaleFactor:1,mobile:false});
await send("Page.navigate",{url:BASE+"/index.html"});
await sleep(2500);
const home = await ev(`({map:!!document.querySelector('#mapwrap svg'),wings:document.querySelectorAll('#gHome .mwing').length,tip:!!document.querySelector('#mapTip'),tipTxt:(document.querySelector('#mapTip')||{textContent:''}).textContent.slice(0,30),shelf:document.querySelectorAll('.scard').length,rooms:document.querySelectorAll('#gHome .mwing').length,svgW:Math.round(document.querySelector('#mapSvg').getBoundingClientRect().width),svgH:Math.round(document.querySelector('#mapSvg').getBoundingClientRect().height)})`);
console.log("HOME:",JSON.stringify(home));
await shot("map_home.png");
// 点 A 馆
const c1 = await ev(`(()=>{const g=document.querySelector('#gHome .mwing[data-zone="A"] .mhit');if(!g)return'no-hit';g.dispatchEvent(new MouseEvent('click',{bubbles:true}));return'clicked';})()`);
await sleep(1600);
const wing = await ev(`({wingOn:document.querySelector('#gWing').classList.contains('on'),rooms:document.querySelectorAll('#gWing .mroom').length,head:document.querySelector('#mapHead').classList.contains('on'),headTxt:document.querySelector('#mapHead').textContent.replace(/\\s+/g,' ').trim().slice(0,40),guideFace:(document.querySelector('#mapGuideFace')||{textContent:''}).textContent,tipTxt:(document.querySelector('#mapTip')||{textContent:''}).textContent.slice(0,26),curZone:window.TLMAP&&window.TLMAP.isOpen(),say:(document.querySelector('#sayTxt')||{textContent:''}).textContent.replace(/\\s+/g,' ').trim().slice(0,60)})`);
console.log("WING:",JSON.stringify(wing));
await shot("map_wingA.png");
// 点第一个展品
const c2 = await ev(`(()=>{const r=document.querySelector('#gWing .mroom .mhit');if(!r)return'no-room';r.dispatchEvent(new MouseEvent('click',{bubbles:true}));return'clicked';})()`);
await sleep(1200);
const roomOpen = await ev(`({roomOn:document.querySelector('#room').classList.contains('on'),title:document.querySelector('#roomTitle').textContent,src:(document.querySelector('#roomFrame').getAttribute('src')||'').slice(-28)})`);
console.log("ROOM:",JSON.stringify(roomOpen));
// Esc 关舱室
await ev(`dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))`);
await sleep(500);
const afterRoom = await ev(`({roomOn:document.querySelector('#room').classList.contains('on'),wingOn:document.querySelector('#gWing').classList.contains('on')})`);
console.log("ESC1:",JSON.stringify(afterRoom));
// Esc 回全馆
await ev(`dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))`);
await sleep(700);
const afterWing = await ev(`({wingOn:document.querySelector('#gWing').classList.contains('on'),head:document.querySelector('#mapHead').classList.contains('on'),homeTransform:(document.querySelector('#gHome').style.transform||'none'),open:window.TLMAP.isOpen()})`);
console.log("ESC2:",JSON.stringify(afterWing));
// 自动导览
await ev(`document.querySelector('#tourBtn').click()`);
await sleep(1200);
const t1 = await ev(`({open:window.TLMAP.isOpen(),head:document.querySelector('#mapHead').textContent.replace(/\\s+/g,' ').trim().slice(0,24)})`);
await sleep(3200);
const t2 = await ev(`({open:window.TLMAP.isOpen(),head:document.querySelector('#mapHead').textContent.replace(/\\s+/g,' ').trim().slice(0,24)})`);
await sleep(7000);
const t3 = await ev(`({open:window.TLMAP.isOpen(),head:document.querySelector('#mapHead').classList.contains('on')})`);
console.log("TOUR:",JSON.stringify({t1,t2,t3}));
await shot("map_tour_end.png");
console.log("exceptions:",exc.length?exc:"none");
child.kill();ws.close();process.exit(0);
