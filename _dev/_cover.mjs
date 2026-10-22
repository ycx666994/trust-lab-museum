import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const PORT = 9781, W = 1920, H = 1080;
const SRC = process.argv[2] || "cover.html";
const OUT = process.argv[3] || "cover-v1";
const BASE = "file:///D:/wobdy%E6%B5%B7%E5%A4%96/2026-10-18-18-15-27/trust-lab/cover";
const ROOT = "D:/wobdy海外/2026-10-18-18-15-27/trust-lab/screens";
const EDGE = ["C://Program Files (x86)//Microsoft//Edge//Application//msedge.exe","C://Program Files//Microsoft//Edge//Application//msedge.exe"].find(p=>{try{readFileSync(p);return true}catch{return false}});
const prof = mkdtempSync(join(tmpdir(),"cv-"));
const child = spawn(EDGE,[`--remote-debugging-port=${PORT}`,`--user-data-dir=${prof}`,"--headless=new","--no-first-run","--enable-unsafe-swiftshader","--force-device-scale-factor=1",`--window-size=${W},${H}`,"about:blank"],{stdio:"ignore"});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function gt(){for(let i=0;i<50;i++){try{const r=await fetch(`http://127.0.0.1:${PORT}/json/list`);const pg=(await r.json()).find(t=>t.type==="page");if(pg)return pg.webSocketDebuggerUrl;}catch{}await sleep(300);}throw new Error("no target");}
const ws=new WebSocket(await gt());
let id=0;const pend=new Map();const errs=[];
ws.onmessage=e=>{const m=JSON.parse(e.data);
 if(m.id&&pend.has(m.id)){pend.get(m.id)(m);pend.delete(m.id);}
 if(m.method==="Runtime.exceptionThrown") errs.push(String(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text).slice(0,160));
};
const send=(meth,par={})=>new Promise(r=>{const i=++id;pend.set(i,r);ws.send(JSON.stringify({id:i,method:meth,params:par}));});
const ev=async expr=>{const r=await send("Runtime.evaluate",{expression:expr,returnByValue:true,awaitPromise:true});if(r.result?.exceptionDetails)return "ERR:"+(r.result.exceptionDetails.exception?.description||"").slice(0,200);return r.result?.result?.value;};
await new Promise(r=>{ws.onopen=r;});
await send("Runtime.enable");await send("Page.enable");
await send("Emulation.setDeviceMetricsOverride",{width:W,height:H,deviceScaleFactor:1,mobile:false});
await send("Page.navigate",{url:BASE+"/"+SRC});
await sleep(1200);
await ev(`document.fonts.ready.then(()=>1)`);
await sleep(900);
console.log("fonts:", await ev(`document.fonts.status+' / serif='+document.fonts.check('900 100px SerifSC')`));
console.log("size:", await ev(`document.documentElement.scrollWidth+'x'+document.documentElement.scrollHeight+' client='+document.documentElement.clientWidth+'x'+document.documentElement.clientHeight`));
console.log("overflow:", await ev(`(document.documentElement.scrollWidth>document.documentElement.clientWidth||document.documentElement.scrollHeight>document.documentElement.clientHeight)`));
console.log("h1:", await ev(`(function(){var h=document.querySelector('h1');var r=h.getBoundingClientRect();return Math.round(r.width)+'x'+Math.round(r.height)+'@'+Math.round(r.left)+','+Math.round(r.top);})()`));
console.log("cards:", await ev(`document.querySelectorAll('.card').length`));
console.log("blocks:", await ev(`[".top",".headline",".quote",".grid",".foot"].map(s=>{const e=document.querySelector(s);if(!e)return s+":-";const r=e.getBoundingClientRect();return s+" "+Math.round(r.top)+"~"+Math.round(r.bottom);}).join(" | ")`));
console.log("cardTextFit:", await ev(`[...document.querySelectorAll('.card')].map(c=>{const n=c.querySelector('.nm');return Math.round(n.getBoundingClientRect().width)+'/'+Math.round(c.clientWidth-44);}).join(' ')`));
console.log("errs:", errs.length?errs.slice(0,2).join(" || "):"none");
const s = await send("Page.captureScreenshot",{format:"png",captureBeyondViewport:true,clip:{x:0,y:0,width:W,height:H,scale:1}});
writeFileSync(join(ROOT, OUT+".png"), Buffer.from(s.result.data,"base64"));
/* 投票页缩略图尺寸验证 */
const t = await send("Page.captureScreenshot",{format:"png",captureBeyondViewport:true,clip:{x:0,y:0,width:W,height:H,scale:400/1920}});
writeFileSync(join(ROOT, OUT+"-thumb.png"), Buffer.from(t.result.data,"base64"));
console.log("saved", OUT+"-thumb.png");
/* JPG 备用（多数投稿页更吃 JPG） */
const j = await send("Page.captureScreenshot",{format:"jpeg",quality:93,captureBeyondViewport:true,clip:{x:0,y:0,width:W,height:H,scale:1}});
writeFileSync(join(ROOT, OUT+".jpg"), Buffer.from(j.result.data,"base64"));
console.log("saved", OUT+".jpg");
console.log("saved", OUT+".png");
child.kill();ws.close();process.exit(0);
