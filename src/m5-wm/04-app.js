<script>
(function () {
  "use strict";
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const KEY = "trustlab";
  let LM = null;   /* 懒加载：构造 + 语料建模耗时数秒，不能阻塞解析/绑定 */
  const getLM = () => (LM || (LM = new TLLM.TinyLM(window.TL_CORPUS, 4)));
  const esc = s => s.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  function fill(r) { r.style.setProperty("--fill", ((r.value - r.min) / (r.max - r.min) * 100) + "%"); }
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* 绿字高亮 html（与检测同判定） */
  function markGreen(text, prompt, gamma) {
    let ctx = (prompt || "").slice(-3), out = "";
    for (const ch of text) {
      const g = getLM().isGreen(KEY, ctx.slice(-3), ch, gamma);
      out += g ? `<span class="g">${esc(ch)}</span>` : esc(ch);
      ctx = (ctx + ch).slice(-3);
    }
    return out;
  }
  /* 打字机（含绿字） */
  function typeInto(el, prompt, text, gamma, speed, done) {
    const spans = [];
    {
      let ctx = (prompt || "").slice(-3);
      for (const ch of text) {
        const g = getLM().isGreen(KEY, ctx.slice(-3), ch, gamma);
        spans.push(g ? `<span class="g">${esc(ch)}</span>` : esc(ch));
        ctx = (ctx + ch).slice(-3);
      }
    }
    el.innerHTML = `<span class="prompt-echo">${esc(prompt)}</span><span class="body"></span><span class="caret"></span>`;
    const body = el.querySelector(".body");
    let i = 0;
    (function step() {
      body.innerHTML = spans.slice(0, ++i).join("");
      if (i < text.length) setTimeout(step, speed);
      else { el.querySelector(".caret").remove(); if (done) done(); }
    })();
  }
  /* z 仪表 */
  function drawGauge(svgId, z) {
    const cx = 60, cy = 66, R = 46;
    const ang = clamp(z / 6, -1, 1) * Math.PI / 2;
    const nx = cx - Math.sin(ang) * (R - 6), ny = cy - Math.cos(ang) * (R - 6);
    const col = z >= 4 ? "var(--gn)" : z >= 1.5 ? "var(--am)" : "var(--rd)";
    $("#" + svgId).innerHTML =
      `<path d="M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${cx + R} ${cy}" fill="none" stroke="#e3dccd" stroke-width="9" stroke-linecap="round"/>
       <path d="M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${cx} ${cy - R}" fill="none" stroke="rgba(193,71,62,.55)" stroke-width="9"/>
       <path d="M ${cx} ${cy - R} A ${R} ${R} 0 0 1 ${cx + R} ${cy}" fill="none" stroke="rgba(28,138,92,.55)" stroke-width="9"/>
       <line x1="${cx}" y1="${cy}" x2="${nx}" y2="${ny}" stroke="${col}" stroke-width="3" stroke-linecap="round"/>
       <circle cx="${cx}" cy="${cy}" r="4.5" fill="${col}"/>
       <text x="${cx - R}" y="${cy + 12}" fill="var(--tx3)" font-size="9" text-anchor="middle" font-family="Consolas">0</text>
       <text x="${cx + R}" y="${cy + 12}" fill="var(--tx3)" font-size="9" text-anchor="middle" font-family="Consolas">z≥6</text>`;
  }
  function verdictOf(z) {
    if (z >= 4) return { lamp: "g", txt: `z = ${z.toFixed(1)} — 检出水印` };
    if (z >= 1.5) return { lamp: "a", txt: `z = ${z.toFixed(1)} — 可疑` };
    return { lamp: "r", txt: `z = ${z.toFixed(1)} — 未见水印` };
  }

  $$(".tab").forEach(t => t.onclick = () => {
    $$(".tab").forEach(x => x.classList.remove("on"));
    t.classList.add("on");
    $$(".layer").forEach(l => l.classList.remove("on"));
    $("#ly-" + t.dataset.layer).classList.add("on");
  });

  /* ==================================================
   * ① 故事：两段文字
   * ================================================== */
  const SP = "月球土壤的主要成分是";
  let sBusy = false;
  $("#wPlay").onclick = async function () {
    if (!LM) {   /* 引擎后台建模中——稍候自动重试，不空转 */
      this.textContent = "引擎建模中…";
      const self = this;
      setTimeout(() => self.click(), 200);
      return;
    }
    if (sBusy) return;
    sBusy = true;
    this.textContent = "生成中…";
    const plain = getLM().generate({ prompt: SP, len: 130, seed: 42, temperature: 0.9 }).text;
    const marked = getLM().embed({ prompt: SP, len: 130, seed: 42, delta: 2.5, gamma: 0.5 }).text;
    typeInto($("#wPlain"), "", plain, 0.5, 8, () => {
      const z = getLM().detect(plain, { gamma: 0.5 });
      const v = verdictOf(z.z);
      $("#pLamp").className = "lamp " + v.lamp;
      $("#pZ").textContent = v.txt + `（绿占比 ${(z.frac * 100).toFixed(0)}%）`;
    });
    typeInto($("#wMarked"), "", marked, 0.5, 8, () => {
      const z = getLM().detect(marked, { gamma: 0.5 });
      const v = verdictOf(z.z);
      $("#mLamp").className = "lamp " + v.lamp;
      $("#mZ").textContent = v.txt + `（绿占比 ${(z.frac * 100).toFixed(0)}%）`;
      $("#wPunch").hidden = false;
      $("#wNext").style.display = "inline-block";
      this.textContent = "↻ 再来一次";
      sBusy = false;
    });
  };
  $("#wNext").onclick = () => $$(".tab")[1].click();

  /* ==================================================
   * ② 玩具：盖章 / 检测 / 洗水印
   * ================================================== */
  let curText = null, curPrompt = "", curGamma = 0.5, curKind = "none";
  function tParams() {
    fill($("#tDelta")); fill($("#tGamma")); fill($("#tLen"));
    $("#tDeltaV").textContent = (+$("#tDelta").value).toFixed(1);
    $("#tGammaV").textContent = (+$("#tGamma").value).toFixed(2);
    $("#tLenV").textContent = $("#tLen").value;
    return { d: +$("#tDelta").value, g: +$("#tGamma").value, len: +$("#tLen").value };
  }
  function tRender(html, meta, fullText) {
    $("#tOut").innerHTML = `<span class="prompt-echo">${esc(curPrompt)}</span>` + html;
    $("#tMeta").textContent = meta;
    const d = getLM().detect(curPrompt + fullText, { gamma: curGamma });
    drawGauge("tGauge", d.z);
    $("#tFrac").textContent = (d.frac * 100).toFixed(1) + "%";
    $("#tN").textContent = d.n;
    const v = verdictOf(d.z);
    $("#tLamp").className = "lamp " + v.lamp;
    const kindTxt = curKind === "wm" ? "带水印原文" : curKind === "atk10" ? "改写 10% 后" : curKind === "atk30" ? "改写 30% 后" : curKind === "del" ? "删 20% 字后" : "无水印对照";
    $("#tState").textContent = kindTxt;
    $("#tVerdict").innerHTML = v.txt + (curKind !== "wm" && curKind !== "none"
      ? ` — <b>对照原文 z 曾更高</b>，攻击确实磨损了指纹`
      : curKind === "wm" ? " — 这段文字的来源可以被统计指控" : "");
    return d;
  }
  function tGen(kind) {
    if (!LM) return;   /* 引擎后台建模中，等就绪后再点 */
    const { d, g, len } = tParams();
    curGamma = g; curPrompt = $("#tPrompt").value; curKind = kind;
    if (kind === "wm" || kind === "atk10" || kind === "atk30" || kind === "del") {
      const r = getLM().embed({ prompt: curPrompt, len, seed: 77, delta: d, gamma: g });
      curText = r.text;
    } else {
      curText = getLM().generate({ prompt: curPrompt, len, seed: 77, temperature: 1 }).text;
    }
    if (kind === "atk10" || kind === "atk30") {
      const rng = mulberry32(9 + (kind === "atk30" ? 1 : 0));
      const frac = kind === "atk30" ? 0.3 : 0.1;
      const arr = curText.split("");
      const vocab = getLM().vocab;
      for (let i = 0; i < arr.length * frac; i++) arr[(rng() * arr.length) | 0] = vocab[(rng() * vocab.length) | 0];
      curText = arr.join("");
    } else if (kind === "del") {
      const rng = mulberry32(99);
      curText = curText.split("").filter(() => rng() > 0.2).join("");
    }
    const html = kind === "none"
      ? esc(curText)
      : markGreen(curText, curPrompt, curGamma);
    tRender(html, `${kindTxt2()} · δ=${d.toFixed(1)} · γ=${g.toFixed(2)}`, curText);
    if (genCount < 2) genCount++;
    if (genCount >= 2) $("#quizToy").style.display = "";
  }
  function kindTxt2() {
    return { wm: "带水印", none: "无水印", atk10: "攻击后", atk30: "攻击后", del: "攻击后" }[curKind];
  }
  let genCount = 0;
  $("#tGo").onclick = () => tGen("wm");
  $("#tPlain").onclick = () => tGen("none");
  $("#atk10").onclick = () => { if (curText) tGen("atk10"); };
  $("#atk30").onclick = () => { if (curText) tGen("atk30"); };
  $("#atkDel").onclick = () => { if (curText) tGen("del"); };
  ["tDelta", "tGamma", "tLen"].forEach(id => $("#" + id).addEventListener("input", tParams));
  $("#tPrompt").addEventListener("change", () => tGen("wm"));
  tParams();

  /* ==================================================
   * ③ 硬核：长度 × 检出率扫描
   * ================================================== */
  const LENS = [40, 80, 120, 180];
  const TRIALS = 24;
  let labBusy = false;
  const sleep0 = () => new Promise(r => setTimeout(r, 0));
  $("#hGo").onclick = async function () {
    if (!LM) return;   /* 引擎后台建模中，等就绪后再点 */
    if (labBusy) return;
    labBusy = true;
    this.disabled = true;
    const d = +$("#tDelta").value, g = +$("#tGamma").value;
    $("#hDelta").textContent = d.toFixed(1);
    $("#hGamma").textContent = g.toFixed(2);
    const rows = [];
    const total = LENS.length * TRIALS * 2;
    let done = 0;
    for (const L of LENS) {
      let hits = 0, fps = 0, zsum = 0;
      for (let t = 0; t < TRIALS; t++) {
        const wm = getLM().embed({ prompt: SP, len: L, seed: 300 + t, delta: d, gamma: g }).text;
        const zw = getLM().detect(SP + wm, { gamma: g }).z;
        if (zw >= 4) hits++;
        zsum += zw;
        const pl = getLM().generate({ prompt: SP, len: L, seed: 300 + t + 1000, temperature: 1 }).text;
        const zp = getLM().detect(SP + pl, { gamma: g }).z;
        if (zp >= 4) fps++;
        done += 2;
        $("#hProg").style.width = (done / total * 100) + "%";
        $("#hProgTxt").innerHTML = `扫描中… 长度 ${L}（${t + 1}/${TRIALS}）`;
        await sleep0();
      }
      rows.push({ L, rate: hits / TRIALS, fp: fps / TRIALS, avgZ: zsum / TRIALS });
      drawLab(rows, d, g);
    }
    const fpAll = rows.reduce((s, r) => s + r.fp, 0) / rows.length;
    $("#hFp").textContent = (fpAll * 100).toFixed(1) + "%";
    $("#hFp").className = fpAll <= 0.05 ? "g" : "a";
    const ok = rows.filter(r => r.rate >= 0.9);
    $("#hMinLen").textContent = ok.length ? ok[0].L + " 字" : "> 180 字";
    $("#hProgTxt").innerHTML = `扫描完成。判定阈值 z ≥ 4。`;
    this.disabled = false;
    labBusy = false;
  };
  function drawLab(rows, d, g) {
    const X0 = 58, X1 = 690, Y0 = 268, Y1 = 20;
    const gx = L => X0 + (L - 30) / 160 * (X1 - X0);
    const gy = v => Y0 - v * (Y0 - Y1);
    const path = key => rows.map((r, i) => `${i ? "L" : "M"}${gx(r.L).toFixed(1)},${gy(r[key]).toFixed(1)}`).join(" ");
    $("#hChart").innerHTML = `
      ${[0, .25, .5, .75, 1].map(v => `
        <line x1="${X0}" y1="${gy(v)}" x2="${X1}" y2="${gy(v)}" stroke="#161d29"/>
        <text x="${X0 - 8}" y="${gy(v) + 3}" fill="#9d9486" font-size="10" text-anchor="end">${v * 100}%</text>`).join("")}
      ${rows.map(r => `
        <line x1="${gx(r.L)}" y1="${Y0}" x2="${gx(r.L)}" y2="${Y1}" stroke="#121926"/>
        <text x="${gx(r.L)}" y="${Y0 + 16}" fill="#9d9486" font-size="10" text-anchor="middle">${r.L}</text>`).join("")}
      <text x="${(X0 + X1) / 2}" y="${Y0 + 34}" fill="#6d6659" font-size="11" text-anchor="middle">文本长度（字）</text>
      <line x1="${X0}" y1="${gy(0.9)}" x2="${X1}" y2="${gy(0.9)}" stroke="#2c3849" stroke-dasharray="4 4"/>
      <text x="${X0 + 6}" y="${gy(0.9) - 6}" fill="#9d9486" font-size="9.5">90% 可靠线</text>
      <path d="${path("rate")}" fill="none" stroke="#1c8a5c" stroke-width="2.4" style="filter:drop-shadow(0 0 6px rgba(28,138,92,.4))"/>
      <path d="${path("fp")}" fill="none" stroke="#9d9486" stroke-width="2"/>
      ${rows.map(r => `<circle cx="${gx(r.L)}" cy="${gy(r.rate)}" r="4" fill="#1c8a5c"><title>${r.L} 字 → 检出 ${(r.rate * 100).toFixed(0)}%</title></circle>
        <circle cx="${gx(r.L)}" cy="${gy(r.fp)}" r="3.4" fill="#9d9486"/>`).join("")}`;
    $("#hTbl").innerHTML = `<tr><th>文本长度</th><th>检出率</th><th>误报率</th><th>平均 z（带水印）</th></tr>` +
      rows.map(r => `<tr><td><b>${r.L}</b> 字</td><td><b>${(r.rate * 100).toFixed(0)}%</b></td><td>${(r.fp * 100).toFixed(1)}%</td><td>${r.avgZ.toFixed(1)}</td></tr>`).join("");
  }

  /* ==================================================
   * 通关题
   * ================================================== */
  const QUIZ = {
    q: "检测器报出 z = 6.5，作者却坚称文章是自己手写的。最专业的回应是？",
    opts: [["z 这么大一定是检测器坏了", false],
           ["z = 6.5 意味着「碰巧这么绿」的概率不到十亿分之一——统计上足以支撑质疑，但最终结论仍需更强证据", true],
           ["把文本抄写一遍就能洗掉水印，所以不用理他", false],
           ["水印能 100% 确定作者，直接定罪", false]],
  };
  function renderQuiz(optsId, qId) {
    const order = QUIZ.opts.map((o, i) => i).sort(() => Math.random() - .5);
    $("#" + qId).textContent = QUIZ.q;
    $("#" + optsId).innerHTML = order.map(i =>
      `<button class="opt" data-ok="${QUIZ.opts[i][1]}">${QUIZ.opts[i][0]}</button>`).join("");
  }
  let cleared = false;
  function confetti(host) {
    const cols = ["#0e7f9c", "#1c8a5c", "#7b4fd0", "#b0741c"];
    host.innerHTML = Array.from({ length: 26 }, (_, i) => {
      const ang = (i / 26) * Math.PI * 2, d = 46 + Math.random() * 60;
      return `<i style="left:50%;background:${cols[i % 4]};--dx:${Math.cos(ang) * d}px;--dy:${Math.sin(ang) * d}px;animation-delay:${(i % 5) * 60}ms"></i>`;
    }).join("");
  }
  function complete() {
    if (cleared) return;
    cleared = true;
    try { parent.postMessage({ type: "tlab:clear", module: "m5" }, "*"); } catch {}
    try {
      const s = JSON.parse(localStorage.getItem("tlab.v1") || "{}");
      s.got = s.got || {};
      if (!s.got.m5) { s.got.m5 = Date.now(); localStorage.setItem("tlab.v1", JSON.stringify(s)); }
    } catch {}
    [["#quizRes", "#confetti"], ["#quizRes2", "#confetti2"]].forEach(([r, cf]) => {
      const box = $(r);
      box.querySelector(".lamp").className = "lamp g";
      box.querySelector("span:last-child").innerHTML =
        "答对了 — <b style='color:var(--gn)'>图鉴第 5 张已点亮 ✓</b>，回博物馆看看你的收藏。";
      box.classList.add("on");
      confetti($(cf));
    });
    $$(".opt").forEach(b => b.disabled = true);
  }
  [["quizOpts", "quizRes", "confetti", "quizQ"], ["quizOpts2", "quizRes2", "confetti2", "quizQ2"]].forEach(([o, r, c, q]) => {
    renderQuiz(o, q);
    $("#" + o).addEventListener("click", e => {
      const b = e.target.closest(".opt");
      if (!b || cleared) return;
      if (b.dataset.ok === "true") { b.classList.add("ok"); complete(); }
      else { b.classList.add("bad"); setTimeout(() => b.classList.remove("bad"), 700); }
    });
  });
})();
</script>
