<script>
(function () {
  "use strict";
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];

  /* ---------- 小工具 ---------- */
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function fill(r) {
    const p = (r.value - r.min) / (r.max - r.min) * 100;
    r.style.setProperty("--fill", p + "%");
  }
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  /* ---------- 层切换 ---------- */
  $$(".tab").forEach(t => t.onclick = () => {
    $$(".tab").forEach(x => x.classList.remove("on"));
    t.classList.add("on");
    $$(".layer").forEach(l => l.classList.remove("on"));
    $("#ly-" + t.dataset.layer).classList.add("on");
  });

  /* ==================================================
   * ① 故事：天气预报员
   * ================================================== */
  const DAYS = 12, RAINS = 5;
  let storyStarted = false;
  function buildStrip() {
    const rng = mulberry32(2026);
    const seq = Array(DAYS).fill(false);
    while (seq.filter(Boolean).length < RAINS) seq[(rng() * DAYS) | 0] = true;
    return seq;
  }
  $("#storyPlay").onclick = function () {
    if (storyStarted) return;
    storyStarted = true;
    this.textContent = "播放中…";
    const seq = buildStrip();
    const strip = $("#storyStrip");
    const LINES = ["今天降水概率，90%。", "明天也是，90%。", "我从不报别的数，90%。", "放心，90%。", "90%，谢谢。"];
    strip.innerHTML = seq.map(() =>
      `<div class="fday"><div>DAY</div><div class="pr">90%</div><div class="rs"></div></div>`).join("");
    let d = 0;
    (function next() {
      if (d < LINES.length) $("#storyBubble").textContent = LINES[d];
      const card = strip.children[d];
      card.classList.add("in");
      setTimeout(() => {
        if (seq[d]) { card.classList.add("hit"); card.querySelector(".rs").textContent = "🌧️"; }
        else card.querySelector(".rs").textContent = "☀️";
        $("#tSays").textContent = (d + 1) + " 次";
        $("#tRains").textContent = seq.slice(0, d + 1).filter(Boolean).length + " 天";
        $("#tRate").textContent = Math.round(seq.slice(0, d + 1).filter(Boolean).length / (d + 1) * 100) + "%";
        d++;
        if (d < DAYS) setTimeout(next, 420);
        else {
          $("#tRate").textContent = Math.round(RAINS / DAYS * 100) + "%";
          $("#storyTally").style.opacity = 1;
          $("#storyPunch").hidden = false;
          $("#storyBubble").textContent = "……你们为什么都不带伞？";
          $("#storyNext").style.display = "inline-block";
          $("#storyPlay").textContent = "↻ 再播一遍";
          storyStarted = false;
        }
      }, 380);
    })();
  };
  $("#storyNext").onclick = () => $$(".tab")[1].click();

  /* ==================================================
   * ② 玩具：把握 vs 实际
   * ================================================== */
  const P = { x0: 48, x1: 440, y0: 296, y1: 16 };   // 绘图区
  const px = v => P.x0 + (v / 100) * (P.x1 - P.x0);
  const py = v => P.y0 - (v / 100) * (P.y0 - P.y1);
  let toyTouched = { c: false, a: false };

  function toyChart() {
    const c = +$("#tConf").value, a = +$("#tAcc").value;
    // 区域着色：对角线下方=过度自信（红），上方=过度谦虚（蓝）
    $("#toyChart").innerHTML = `
      <polygon points="${P.x0},${P.y0} ${P.x1},${P.y1} ${P.x0},${P.y1}" fill="rgba(176,116,28,.05)"/>
      <polygon points="${P.x0},${P.y0} ${P.x1},${P.y1} ${P.x1},${P.y0}" fill="rgba(193,71,62,.06)"/>
      ${[0,25,50,75,100].map(v => `
        <line x1="${px(v)}" y1="${P.y0}" x2="${px(v)}" y2="${P.y1}" stroke="#161d29" stroke-width="1"/>
        <line x1="${P.x0}" y1="${py(v)}" x2="${P.x1}" y2="${py(v)}" stroke="#161d29" stroke-width="1"/>
        <text x="${px(v)}" y="${P.y0 + 16}" fill="#9d9486" font-size="10" text-anchor="middle">${v}</text>
        <text x="${P.x0 - 8}" y="${py(v) + 3}" fill="#9d9486" font-size="10" text-anchor="end">${v}</text>`).join("")}
      <text x="${(P.x0 + P.x1) / 2}" y="${P.y0 + 34}" fill="#6d6659" font-size="11" text-anchor="middle">嘴上的把握 %</text>
      <text x="14" y="${(P.y0 + P.y1) / 2}" fill="#6d6659" font-size="11" text-anchor="middle" transform="rotate(-90 14 ${(P.y0 + P.y1) / 2})">实际正确率 %</text>
      <line x1="${P.x0}" y1="${P.y0}" x2="${P.x1}" y2="${P.y1}" stroke="#1c8a5c" stroke-width="1.6" stroke-dasharray="5 4"/>
      <text x="${px(83)}" y="${py(95)}" fill="#1c8a5c" font-size="10.5" text-anchor="end">诚实线</text>
      <text x="${px(97)}" y="${py(46)}" fill="#c1473e" font-size="10.5" text-anchor="end">过度自信区</text>
      <text x="${px(14)}" y="${py(93)}" fill="#b0741c" font-size="10.5">过度谦虚区</text>
      <line x1="${px(c)}" y1="${py(a)}" x2="${px(c)}" y2="${P.y0}" stroke="#2c3849" stroke-width="1" stroke-dasharray="3 3"/>
      <line x1="${px(c)}" y1="${py(a)}" x2="${P.x0}" y2="${py(a)}" stroke="#2c3849" stroke-width="1" stroke-dasharray="3 3"/>
      <g style="transition:transform .22s ease" transform="translate(${px(c)},${py(a)})">
        <circle r="9" fill="rgba(123,79,208,.18)" stroke="#7b4fd0" stroke-width="1.4"/>
        <circle r="3.4" fill="#7b4fd0"/>
      </g>`;
  }
  function toyDots() {
    const c = +$("#tConf").value, a = +$("#tAcc").value;
    const cell = (n, cls) => Array.from({ length: 30 }, (_, i) => `<i class="${i < n ? cls : ""}"></i>`).join("");
    $("#cellsC").innerHTML = cell(Math.round(c / 100 * 30), "c");
    $("#cellsA").innerHTML = cell(Math.round(a / 100 * 30), "a");
  }
  function toyVerdict() {
    const c = +$("#tConf").value, a = +$("#tAcc").value, gap = c - a;
    const l = $("#toyLamp"), v = $("#toyVerdict");
    if (Math.abs(gap) <= 3) { l.className = "lamp g"; v.innerHTML = `<b style="color:var(--gn)">校准良好</b> — 说的和做的基本一致`; }
    else if (gap > 0) {
      l.className = "lamp r";
      v.innerHTML = `<b style="color:var(--rd)">过度自信</b> — 吹牛差 +${gap}：按 ${c}% 下注，长期只有 ${a}% 命中`;
    } else {
      l.className = "lamp a";
      v.innerHTML = `<b style="color:var(--am)">过度谦虚</b> — 差 ${gap}：其实比嘴上说的更靠谱`;
    }
    const f = $("#gapFill");
    if (gap >= 0) { f.style.left = "50%"; f.style.right = "auto"; f.style.width = (clamp(gap, 0, 50) / 50 * 50) + "%"; f.style.background = "linear-gradient(90deg,rgba(193,71,62,.45),rgba(193,71,62,.85))"; }
    else { f.style.left = "auto"; f.style.right = "50%"; f.style.width = (clamp(-gap, 0, 50) / 50 * 50) + "%"; f.style.background = "linear-gradient(90deg,rgba(14,127,156,.85),rgba(14,127,156,.45))"; }
    $("#gapLbl").textContent = gap >= 0 ? `吹牛差 +${gap}` : `谦虚差 ${gap}`;
    $("#toyNote").innerHTML = gap > 3
      ? `如果银行按他的「${c}%」给贷款定价、医院按「${c}%」分配床位，每 100 次决策里就有约 <b style="color:var(--tx)">${gap}</b> 次建立在多出来的信心上。这就是为什么 ECE 是审计模型的必查项。`
      : `试试把两个滑块都拉到对角线上 —— 当把握与频率一致，预报员才值得被信任。模型也一样。`;
  }
  function toyUpdate() {
    fill($("#tConf")); fill($("#tAcc"));
    $("#tConfV").textContent = $("#tConf").value + "%";
    $("#tAccV").textContent = $("#tAcc").value + "%";
    toyChart(); toyDots(); toyVerdict();
  }
  ["tConf", "tAcc"].forEach(id => $("#" + id).addEventListener("input", () => {
    toyTouched[id === "tConf" ? "c" : "a"] = true;
    if (toyTouched.c && toyTouched.a) $("#quizToy").style.display = "";
    toyUpdate();
  }));
  toyUpdate();

  /* ==================================================
   * ③ 硬核：可靠性图 + ECE / MCE / Brier
   * ================================================== */
  function gauss(rng) {
    let u = 0, v = 0;
    while (u === 0) u = rng();
    while (v === 0) v = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  function simulate() {
    const n = +$("#hN").value, bias = +$("#hBias").value, noise = +$("#hNoise").value;
    const rng = mulberry32(1000 + (+$("#hSeed").value) * 77);
    const B = 10, bins = Array.from({ length: B }, () => ({ n: 0, sc: 0, sy: 0 }));
    let brier = 0, accN = 0;
    for (let i = 0; i < n; i++) {
      const t = 0.05 + rng() * 0.9;                                   // 真实概率
      const c = clamp(t + bias + gauss(rng) * noise, 0.02, 0.98);     // 模型嘴上的置信度
      const y = rng() < t ? 1 : 0;
      const b = bins[clamp((c * B) | 0, 0, B - 1)];
      b.n++; b.sc += c; b.sy += y;
      brier += (c - y) * (c - y);
      accN += y === (c >= 0.5 ? 1 : 0) ? 1 : 0;
    }
    const pts = bins.map(b => b.n ? { conf: b.sc / b.n, acc: b.sy / b.n, n: b.n } : null).filter(Boolean);
    const ece = pts.reduce((s, p) => s + (p.n / n) * Math.abs(p.acc - p.conf), 0);
    const mce = Math.max(...pts.map(p => Math.abs(p.acc - p.conf)));
    return { pts, ece, mce, brier: brier / n, acc: accN / n, n };
  }
  const H = { x0: 54, x1: 546, y0: 330, y1: 20, hY: 386 };  // 主图区 + 直方图底
  const hx = v => H.x0 + v * (H.x1 - H.x0);
  const hy = v => H.y0 - v * (H.y0 - H.y1);
  function hardChart(S) {
    const B = 10, bw = (H.x1 - H.x0) / B;
    const maxN = Math.max(...S.pts.map(p => p.n));
    $("#hardChart").innerHTML = `
      ${[0, .25, .5, .75, 1].map(v => `
        <line x1="${H.x0}" y1="${hy(v)}" x2="${H.x1}" y2="${hy(v)}" stroke="#161d29"/>
        <line x1="${hx(v)}" y1="${H.y0}" x2="${hx(v)}" y2="${H.y1}" stroke="#161d29"/>
        <text x="${H.x0 - 8}" y="${hy(v) + 3}" fill="#9d9486" font-size="10" text-anchor="end">${v * 100}</text>
        <text x="${hx(v)}" y="${H.y0 + 16}" fill="#9d9486" font-size="10" text-anchor="middle">${v * 100}</text>`).join("")}
      <text x="${(H.x0 + H.x1) / 2}" y="${H.y0 + 34}" fill="#6d6659" font-size="11" text-anchor="middle">模型置信度 %（10 箱）</text>
      <text x="16" y="${(H.y0 + H.y1) / 2}" fill="#6d6659" font-size="11" text-anchor="middle" transform="rotate(-90 16 ${(H.y0 + H.y1) / 2})">实际准确率 %</text>
      <line x1="${H.x0}" y1="${H.y0}" x2="${H.x1}" y2="${H.y1}" stroke="#1c8a5c" stroke-width="1.6" stroke-dasharray="5 4"/>
      <text x="${hx(.8)}" y="${hy(.94)}" fill="#1c8a5c" font-size="10.5">完美校准</text>
      ${S.pts.map(p => {
        const x = hx(p.conf), y = hy(p.acc);
        const eb = 1.96 * Math.sqrt(Math.max(p.acc * (1 - p.acc), 0.0001) / p.n);
        const r = 3 + Math.sqrt(p.n / maxN) * 13;
        const col = Math.abs(p.acc - p.conf) < 0.06 ? "#1c8a5c" : Math.abs(p.acc - p.conf) < 0.15 ? "#b0741c" : "#c1473e";
        return `<line x1="${x}" y1="${hy(clamp(p.acc + eb, 0, 1))}" x2="${x}" y2="${hy(clamp(p.acc - eb, 0, 1))}" stroke="#3a4759" stroke-width="1.4"/>
          <line x1="${x - 4}" y1="${hy(clamp(p.acc + eb, 0, 1))}" x2="${x + 4}" y2="${hy(clamp(p.acc + eb, 0, 1))}" stroke="#3a4759" stroke-width="1.4"/>
          <line x1="${x - 4}" y1="${hy(clamp(p.acc - eb, 0, 1))}" x2="${x + 4}" y2="${hy(clamp(p.acc - eb, 0, 1))}" stroke="#3a4759" stroke-width="1.4"/>
          <line x1="${x}" y1="${y}" x2="${x}" y2="${hy(p.conf)}" stroke="${col}" stroke-width="1" stroke-dasharray="2 3" opacity=".6"/>
          <circle cx="${x}" cy="${y}" r="${r.toFixed(1)}" fill="${col}22" stroke="${col}" stroke-width="1.6">
            <title>置信度 ${(p.conf * 100).toFixed(1)}% · 准确率 ${(p.acc * 100).toFixed(1)}% · n=${p.n}</title>
          </circle>`;
      }).join("")}
      ${S.pts.map((p, i) => {
        const h = (p.n / maxN) * 36;
        return `<rect x="${H.x0 + i * bw + 2}" y="${H.hY - h}" width="${bw - 4}" height="${h}" fill="#1c2736" rx="2"/>`;
      }).join("")}
      <text x="${H.x0}" y="${H.hY + 14}" fill="#9d9486" font-size="9.5">↓ 各箱样本量</text>`;
  }
  function hardUpdate() {
    ["hN", "hBias", "hNoise", "hSeed"].forEach(id => fill($("#" + id)));
    $("#hNV").textContent = $("#hN").value;
    $("#hBiasV").textContent = (+$("#hBias").value >= 0 ? "+" : "") + (+$("#hBias").value).toFixed(2);
    $("#hNoiseV").textContent = (+$("#hNoise").value).toFixed(2);
    $("#hSeedV").textContent = $("#hSeed").value;
    const S = simulate();
    $("#mECE").textContent = S.ece.toFixed(3);
    $("#mECE").className = S.ece < 0.05 ? "g" : S.ece < 0.10 ? "a" : "r";
    $("#mMCE").textContent = S.mce.toFixed(3);
    $("#mMCE").className = S.mce < 0.10 ? "g" : S.mce < 0.25 ? "a" : "r";
    $("#mBrier").textContent = S.brier.toFixed(3);
    $("#mAcc").textContent = (S.acc * 100).toFixed(1) + "%";
    const l = $("#hLamp"), v = $("#hVerdict");
    if (S.ece < 0.05) { l.className = "lamp g"; v.innerHTML = `<b style="color:var(--gn)">校准良好</b> — ECE ${S.ece.toFixed(3)} < 0.05`; }
    else if (S.ece < 0.10) { l.className = "lamp a"; v.innerHTML = `<b style="color:var(--am)">轻度失准</b> — ECE ${S.ece.toFixed(3)}`; }
    else { l.className = "lamp r"; v.innerHTML = `<b style="color:var(--rd)">严重失准</b> — ECE ${S.ece.toFixed(3)}：置信度系统性偏离事实`; }
    hardChart(S);
  }
  ["hN", "hBias", "hNoise", "hSeed"].forEach(id => $("#" + id).addEventListener("input", hardUpdate));
  hardUpdate();

  /* ==================================================
   * 通关题（两处同题，任一答对即点亮图鉴）
   * ================================================== */
  const QUIZ = {
    q: "预报员连续 100 天都报「降水概率 80%」，事后统计其中正好 80 天下了雨。他的校准情况是？",
    opts: [["过度自信 — 实际远低于 80%", false],
           ["校准良好 — 说 80% 的事 80% 发生", true],
           ["严重不自信 — 他应该报 90%", false],
           ["无法判断 — 样本太少", false]],
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
    try { parent.postMessage({ type: "tlab:clear", module: "m6" }, "*"); } catch {}
    try {
      const s = JSON.parse(localStorage.getItem("tlab.v1") || "{}");
      s.got = s.got || {};
      if (!s.got.m6) { s.got.m6 = Date.now(); localStorage.setItem("tlab.v1", JSON.stringify(s)); }
    } catch {}
    [["#quizRes", "#confetti"], ["#quizRes2", "#confetti2"]].forEach(([r, cf]) => {
      const box = $(r);
      box.querySelector(".lamp").className = "lamp g";
      box.querySelector("span:last-child").innerHTML =
        "答对了 — <b style='color:var(--gn)'>图鉴第 6 张已点亮 ✓</b>，回博物馆看看你的收藏。";
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
