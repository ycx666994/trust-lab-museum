<script>
(function () {
  "use strict";
  const $ = s => document.querySelector(s);
  const LM = new TLLM.TinyLM(window.TL_CORPUS, 4);
  $("#tagStats").textContent = `vocab ${LM.stats.vocab} · 语料 ${LM.stats.chars} 字 · 4-gram`;

  /* ---------- 通用 ---------- */
  function fill(r) {
    const p = (r.value - r.min) / (r.max - r.min) * 100;
    r.style.setProperty("--fill", p + "%");
  }
  document.querySelectorAll("input[type=range]").forEach(r => {
    fill(r); r.addEventListener("input", () => fill(r));
  });
  function esc(s) { return s.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
  function hashHex(t) { return (TLLM.fnv1a(t) >>> 0).toString(16).padStart(8, "0"); }
  function typeOut(el, prompt, text, done) {
    el.innerHTML = `<span class="prompt-echo">${esc(prompt)}</span><span class="body"></span><span class="caret"></span>`;
    const body = el.querySelector(".body");
    let i = 0;
    (function step() {
      body.textContent = text.slice(0, ++i);
      if (i < text.length) setTimeout(step, 9);
      else { el.querySelector(".caret").remove(); if (done) done(); }
    })();
  }

  /* ================= A 温度采样 ================= */
  const A = { temp: $("#aTemp"), prompt: $("#aPrompt"), seed: $("#aSeed") };
  let aLast = null;
  function aOpts() {
    return { prompt: A.prompt.value || "月球土壤", len: 130,
             temperature: +A.temp.value, seed: (+A.seed.value || 0) >>> 0 };
  }
  function aRun() {
    const o = aOpts();
    const r = LM.generate(o);
    aLast = r;
    $("#aMetaR").textContent = `T=${o.temperature.toFixed(2)} · seed=${o.seed}`;
    typeOut($("#aOut"), o.prompt, r.text, () => {
      $("#aMeta").textContent = `len=${r.text.length}`;
      renderCands(r.lastTop);
    });
    $("#aMeta").textContent = "生成中…";
  }
  function renderCands(top) {
    if (!top || !top.length) return;
    const mx = Math.max(...top.map(c => c.p));
    $("#aCands").innerHTML = top.map(c =>
      `<div class="cand${c.green ? " is-g" : ""}">
        <span class="ch">${esc(c.ch)}</span>
        <span class="bar"><i style="width:${(c.p / mx * 100).toFixed(1)}%"></i></span>
        <span class="pv">${(c.p * 100).toFixed(1)}%</span>
      </div>`).join("");
  }
  A.temp.addEventListener("input", () => { $("#aTempV").textContent = (+A.temp.value).toFixed(2); });
  $("#aGo").onclick = aRun;
  $("#aAgain").onclick = aRun;                       // 同参数 ⇒ 同输出
  $("#aNew").onclick = () => { A.seed.value = (Math.random() * 1e8 | 0); aRun(); };

  /* ================= B 水印 ================= */
  const B = { delta: $("#bDelta"), gamma: $("#bGamma") };
  const KEY = "trustlab";
  let bWm = null, bPlain = null, bShown = null;
  B.delta.addEventListener("input", () => { $("#bDeltaV").textContent = (+B.delta.value).toFixed(1); });
  B.gamma.addEventListener("input", () => { $("#bGammaV").textContent = (+B.gamma.value).toFixed(2); });
  const bPrompt = () => $("#aPrompt").value || "月球土壤的主要成分是";
  function markGreen(text, prompt) {
    // 与检测同一判定：逐字着色绿名单归属
    const g = +B.gamma.value;
    let ctx = (prompt || "").slice(-3), html = "";
    for (const ch of text) {
      const isG = LM.isGreen(KEY, ctx.slice(-3), ch, g);
      html += isG ? `<span class="g">${esc(ch)}</span>` : esc(ch);
      ctx = (ctx + ch).slice(-3);
    }
    return html;
  }
  $("#bGo").onclick = () => {
    const r = LM.embed({ prompt: bPrompt(), len: 150, seed: 77,
      delta: +B.delta.value, gamma: +B.gamma.value, key: KEY });
    bWm = r.text; bShown = "wm";
    $("#bOut").innerHTML = `<span class="prompt-echo">${esc(bPrompt())}</span>` + markGreen(r.text, bPrompt());
  };
  $("#bPlain").onclick = () => {
    const r = LM.generate({ prompt: bPrompt(), len: 150, seed: 77, temperature: 1 });
    bPlain = r.text; bShown = "plain";
    $("#bOut").innerHTML = `<span class="prompt-echo">${esc(bPrompt())}</span>` + esc(r.text);
  };
  function drawGauge(z) {
    const cx = 60, cy = 66, R = 46;
    const ang = Math.max(-1, Math.min(1, z / 6)) * Math.PI / 2;   // z=6 顶格
    const nx = cx - Math.sin(ang) * (R - 6), ny = cy - Math.cos(ang) * (R - 6);
    const col = z >= 4 ? "var(--gn)" : z >= 1.5 ? "var(--am)" : "var(--rd)";
    $("#bGauge").innerHTML =
      `<path d="M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${cx + R} ${cy}" fill="none" stroke="#1a2230" stroke-width="9" stroke-linecap="round"/>
       <path d="M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${cx} ${cy - R}" fill="none" stroke="rgba(239,107,107,.55)" stroke-width="9"/>
       <path d="M ${cx} ${cy - R} A ${R} ${R} 0 0 1 ${cx + R} ${cy}" fill="none" stroke="rgba(62,207,142,.55)" stroke-width="9"/>
       <line x1="${cx}" y1="${cy}" x2="${nx}" y2="${ny}" stroke="${col}" stroke-width="3" stroke-linecap="round"/>
       <circle cx="${cx}" cy="${cy}" r="4.5" fill="${col}"/>
       <text x="${cx - R}" y="${cy + 12}" fill="var(--tx3)" font-size="9" text-anchor="middle" font-family="var(--mono)">0</text>
       <text x="${cx + R}" y="${cy + 12}" fill="var(--tx3)" font-size="9" text-anchor="middle" font-family="var(--mono)">z≥6</text>`;
  }
  function bDetect() {
    const t = bShown === "wm" ? bWm : bPlain;
    if (!t) { $("#bVerdict").textContent = "先在上方生成一段文本"; return; }
    const d = LM.detect(t, { key: KEY, gamma: +B.gamma.value });
    $("#bFrac").textContent = (d.frac * 100).toFixed(1) + "%";
    $("#bN").textContent = d.n;
    drawGauge(d.z);
    const v = $("#bVerdict"), l = $("#bLamp");
    if (d.z >= 4) { l.className = "lamp g"; v.textContent = `z = ${d.z.toFixed(1)} — 检出水印`; }
    else if (d.z >= 1.5) { l.className = "lamp a"; v.textContent = `z = ${d.z.toFixed(1)} — 可疑`; }
    else { l.className = "lamp r"; v.textContent = `z = ${d.z.toFixed(1)} — 未见水印`; }
  }
  $("#bDetect").onclick = bDetect;
  $("#bSwap").onclick = () => {
    if (!bWm && !bPlain) { bDetect(); return; }
    bShown = bShown === "wm" ? "plain" : "wm";
    bDetect();
  };

  /* ================= C 复现 ================= */
  $("#cTemp").addEventListener("input", () => { $("#cTempV").textContent = (+$("#cTemp").value).toFixed(2); });
  $("#cGo").onclick = () => {
    const o = { prompt: "月球土壤的主要成分是", len: 110, temperature: +$("#cTemp").value, seed: 20261018 };
    const r1 = LM.generate(o), r2 = LM.generate(o);
    $("#cOut1").textContent = r1.text;
    $("#cOut2").textContent = r2.text;
    const same = r1.text === r2.text;
    $("#cSame").innerHTML = same
      ? `两次输出逐字符一致 <b>✓</b>（${r1.text.length} 字）`
      : `输出不一致 <b style="color:var(--rd)">✗</b> — 引擎存在未定随机源！`;
    $("#cHash").textContent = `fnv1a #1 = ${hashHex(r1.text)} · fnv1a #2 = ${hashHex(r2.text)}`;
  };

  /* ---------- 开机自检 ---------- */
  aRun();
  $("#bGo").click(); $("#bDetect").click();
  $("#cGo").click();
})();
</script>
