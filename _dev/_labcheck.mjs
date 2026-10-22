// 验证 LAB 层（hard）在 file:// 下 iframe 能否加载两个实验室
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PORT = 9794, W = 1440, H = 900;
const BASE = "file:///D:/wobdy%E6%B5%B7%E5%A4%96/2026-10-18-18-15-27/trust-lab";
const EDGE = ["C://Program Files (x86)//Microsoft//Edge//Application//msedge.exe",
              "C://Program Files//Microsoft//Edge//Application//msedge.exe"]
             .find(p => { try { readFileSync(p); return true; } catch { return false; } });
const prof = mkdtempSync(join(tmpdir(), "lab-"));
const child = spawn(EDGE, [`--remote-debugging-port=${PORT}`, `--user-data-dir=${prof}`,
  "--headless=new", "--no-first-run", "--enable-unsafe-swiftshader",
  `--window-size=${W},${H}`, "about:blank"], { stdio: "ignore" });
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function gt() {
  for (let i = 0; i < 50; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const pg = (await r.json()).find(t => t.type === "page");
      if (pg) return pg.webSocketDebuggerUrl;
    } catch {}
    await sleep(300);
  }
  throw new Error("no target");
}
const ws = new WebSocket(await gt());
let id = 0; const pend = new Map(); const errs = [];
ws.onmessage = e => {
  const m = JSON.parse(e.data);
  if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); }
  if (m.method === "Runtime.exceptionThrown")
    errs.push(String(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text).slice(0, 110));
};
const send = (meth, par = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method: meth, params: par })); });
const ev = async expr => {
  const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.result?.exceptionDetails) return "ERR:" + (r.result.exceptionDetails.exception?.description || "").slice(0, 110);
  return r.result?.result?.value;
};
await new Promise(r => { ws.onopen = r; });
await send("Runtime.enable"); await send("Page.enable");
await send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: 1, mobile: false });

for (const [page, tag] of [["m1-mirage.html", "m1"], ["m2-horizon.html", "m2"]]) {
  errs.length = 0;
  await send("Page.navigate", { url: BASE + "/" + page });
  await sleep(2200);
  // 点 hard 层
  console.log("==", page, "点击 hard 层:", await ev(`(function(){var b=document.querySelector('[data-layer="hard"]');if(!b)return 'no-tab';b.click();return 'clicked';})()`));
  await sleep(3000);
  console.log("   iframe 数:", await ev(`document.querySelectorAll('iframe').length`),
              "| src:", await ev(`(function(){var f=document.querySelector('iframe');return f?(f.getAttribute('src')||''):'-'})()`),
              "| 尺寸:", await ev(`(function(){var f=document.querySelector('iframe');return f?f.clientWidth+'x'+f.clientHeight:'-'})()`));
  console.log("   内容可读:", await ev(`(function(){var f=document.querySelector('iframe');if(!f)return '-';
      try{var d=f.contentDocument;if(!d)return 'null-doc';return d.body?d.body.innerText.replace(/\\s/g,'').length:'no-body'}catch(e){return 'blocked:'+e.name}})()`));
  console.log("   异常:", errs.length ? errs[0] : "none");
  const s = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(`D:/wobdy海外/2026-10-18-18-15-27/trust-lab/screens/_lab-${tag}.png`, Buffer.from(s.result.data, "base64"));
}
child.kill(); ws.close(); process.exit(0);
