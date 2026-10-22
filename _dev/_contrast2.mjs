import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const PORT = 9727, W = 1440, H = 900;
const BASE = "file:///D:/wobdy%E6%B5%B7%E5%A4%96/2026-10-18-18-15-27/trust-lab";
const EDGE = ["C://Program Files (x86)//Microsoft//Edge//Application//msedge.exe","C://Program Files//Microsoft//Edge//Application//msedge.exe"].find(p=>{try{readFileSync(p);return true}catch{return false}});
const prof = mkdtempSync(join(tmpdir(),"ct2-"));
const child = spawn(EDGE,[`--remote-debugging-port=${PORT}`,`--user-data-dir=${prof}`,"--headless=new","--no-first-run","--enable-unsafe-swiftshader",`--window-size=${W},${H}`,"about:blank"],{stdio:"ignore"});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function gt(){for(let i=0;i<50;i++){try{const r=await fetch(`http://127.0.0.1:${PORT}/json/list`);const pg=(await r.json()).find(t=>t.type==="page");if(pg)return pg.webSocketDebuggerUrl;}catch{}await sleep(300);}throw new Error("no target");}
const ws=new WebSocket(await gt());
let id=0;const pend=new Map();
ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pend.has(m.id)){pend.get(m.id)(m);pend.delete(m.id);}};
const send=(meth,par={})=>new Promise(r=>{const i=++id;pend.set(i,r);ws.send(JSON.stringify({id:i,method:meth,params:par}));});
const ev=async expr=>{const r=await send("Runtime.evaluate",{expression:expr,returnByValue:true,awaitPromise:true});if(r.result?.exceptionDetails)return "ERR:"+(r.result.exceptionDetails.exception?.description||"").slice(0,160);return r.result?.result?.value;};
await new Promise(r=>{ws.onopen=r;});
await send("Runtime.enable");await send("Page.enable");
await send("Emulation.setDeviceMetricsOverride",{width:W,height:H,deviceScaleFactor:1,mobile:false});

const AUDIT = [
"(function(){",
"var P=function(c){var m=(c||'').match(/[0-9.]+/g);if(!m)return null;return {r:+m[0],g:+m[1],b:+m[2],a:m[3]===undefined?1:+m[3]};};",
"var L=function(c){var f=function(v){v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)};return 0.2126*f(c.r)+0.7152*f(c.g)+0.0722*f(c.b)};",
"var blend=function(t,b){return {r:t.r*t.a+b.r*(1-t.a),g:t.g*t.a+b.g*(1-t.a),b:t.b*t.a+b.b*(1-t.a),a:1}};",
"var bgOf=function(el){var cur=el,acc=null;while(cur&&cur!==document.documentElement){var c=P(getComputedStyle(cur).backgroundColor);if(c&&c.a>0.02){acc=acc?blend(acc,c):c;if(acc.a>=0.98)return acc;}cur=cur.parentElement;}var b=P(getComputedStyle(document.body).backgroundColor)||{r:245,g:241,b:231,a:1};return acc?blend(acc,b):b;};",
"var out=[];",
"document.querySelectorAll('*').forEach(function(el){",
"  var t=Array.prototype.filter.call(el.childNodes,function(n){return n.nodeType===3&&n.textContent.trim();}).map(function(n){return n.textContent.trim();}).join('');",
"  if(!t||t.length<2)return;",
"  var cs=getComputedStyle(el);",
"  if(cs.display==='none'||cs.visibility==='hidden'||+cs.opacity===0)return;",
"  var r=el.getBoundingClientRect();",
"  if(r.width<6||r.height<6)return;",
"  var fg=P(cs.color);if(!fg)return;",
"  var bg=bgOf(el);",
"  var f=blend({r:fg.r,g:fg.g,b:fg.b,a:fg.a},bg);",
"  var l1=L(f),l2=L(bg);",
"  var cr=(Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05);",
"  if(cr<3.2)out.push({cr:+cr.toFixed(2),tag:el.tagName.toLowerCase(),cls:String(el.className).slice(0,20),color:cs.color,bg:'rgb('+Math.round(bg.r)+','+Math.round(bg.g)+','+Math.round(bg.b)+')',t:t.slice(0,22)});",
"});",
"out.sort(function(a,b){return a.cr-b.cr});",
"var head='LOW='+out.length;",
"return head+'\\n'+out.slice(0,12).map(function(o){return o.cr+' '+o.tag+'.'+o.cls+' fg='+o.color+' bg='+o.bg+' ['+o.t+']';}).join('\\n');",
"})()"
].join("\n");

for (const f of ["vendor/emergence-lab.html","vendor/horizon-workbench.html"]) {
  await send("Page.navigate",{url:BASE+"/"+f});
  await sleep(3200);
  if (f.includes("horizon")) { await ev(`(function(){var b=[].slice.call(document.querySelectorAll('button')).filter(function(x){return /跳过/.test(x.textContent);})[0];if(b)b.click();})()`); await sleep(900); }
  console.log("== "+f);
  console.log(await ev(AUDIT));
}
child.kill();ws.close();process.exit(0);
