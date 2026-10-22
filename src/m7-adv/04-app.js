<script>
(function () {
  "use strict";
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const M = window.TLADV;                    // {acc, W(10x64), b(10), hero(64), samples:50}
  const W = M.W, B = M.b;

  /* ---------- 模型 ---------- */
  function logits(x) {
    const o = new Array(10);
    for (let c = 0; c < 10; c++) {
      let s = B[c], w = c * 64;
      for (let i = 0; i < 64; i++) s += W[w + i] * x[i];
      o[c] = s;
    }
    return o;
  }
  function softmax(l) {
    const m = Math.max(...l), e = l.map(v => Math.exp(v - m));
    const s = e.reduce((a, b) => a + b, 0);
    return e.map(v => v / s);
  }
  const predict = x => { const p = softmax(logits(x)); return { p, cls: p.indexOf(Math.max(...p)) }; };
  /* 梯度 = W^T (p - onehot)；target<0 未目标，target>=0 指定目标（朝目标降） */
  function fgsm(x, eps, target) {
    const { p, cls } = predict(x);
    const y = target >= 0 ? target : cls;
    const g = new Array(64).fill(0);
    for (let c = 0; c < 10; c++) {
      const coef = (c === y ? p[c] - 1 : p[c]) * (target >= 0 ? -1 : 1);
      const w = c * 64;
      for (let i = 0; i < 64; i++) g[i] += W[w + i] * coef;
    }
    return x.map((v, i) => Math.max(0, Math.min(1, v + eps * Math.sign(g[i]))));
  }

  /* ---------- 层切换 ---------- */
  $$(".tab").forEach(t => t.onclick = () => {
    $$(".tab").forEach(x => x.classList.remove("on"));
    t.classList.add("on");
    $$(".layer").forEach(l => l.classList.remove("on"));
    $("#ly-" + t.dataset.layer).classList.add("on");
  });

  /* ---------- SVG 网格 ---------- */
  const CELL = 20;
  function grid(svgId, data, opts) {
    opts = opts || {};
    const parts = [`<rect width="160" height="160" fill="#0a0e14"/>`];
    for (let i = 0; i < 64; i++) {
      const r = Math.floor(i / 8), c = i % 8;
      let fill;
      if (opts.noise) {
        const d = data[i];
        fill = Math.abs(d) < 0.02 ? "#10151d"
          : d > 0 ? `rgba(255,255,255,${Math.min(1, Math.abs(d) * opts.noiseGain)})`
          : `rgba(193,71,62,${Math.min(1, Math.abs(d) * opts.noiseGain)})`;
      } else {
        fill = `rgba(232,238,246,${Math.max(0.03, data[i]).toFixed(3)})`;
      }
      parts.push(`<rect x="${c * CELL}" y="${r * CELL}" width="${CELL - 1}" height="${CELL - 1}" rx="2.5" fill="${fill}"/>`);
    }
    document.getElementById(svgId).innerHTML = parts.join("");
  }
  /* 置信度条（top-5） */
  function bars(svgId, p, trueCls) {
    const idx = p.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]).slice(0, 5);
    const parts = [`<rect width="190" height="160" fill="transparent"/>`];
    idx.forEach(([v, c], k) => {
      const y = 12 + k * 30, w = v * 120;
      parts.push(`<text x="10" y="${y + 9}" fill="${c === trueCls ? "#1c8a5c" : "#6d6659"}" font-size="12" font-family="Consolas">${c}</text>`);
      parts.push(`<rect x="26" y="${y}" width="120" height="13" rx="3" fill="#e3dccd"/>`);
      parts.push(`<rect x="26" y="${y}" width="${Math.max(2, w)}" height="13" rx="3" fill="${k === 0 ? (c === trueCls ? "#1c8a5c" : "#c1473e") : "#31435f"}"/>`);
      parts.push(`<text x="${28 + Math.max(2, w)}" y="${y + 10.5}" fill="#9d9486" font-size="10" font-family="Consolas">${(v * 100).toFixed(0)}%</text>`);
    });
    document.getElementById(svgId).innerHTML = parts.join("");
  }

  /* ==================================================
   * ① 故事：一次安静的袭击（主演数字 3）
   * ================================================== */
  const hero = Array.from(M.hero);
  $("#accTxt").textContent = (M.acc * 100).toFixed(0) + "%";
  grid("sOrig", hero);
  const STEPS = [
    { eps: 0,    say: "攻击前：模型自信满满——「99% 是 3」。一切正常。" },
    { eps: 0.12, say: "第一阶段：ε=0.12。每个像素被悄悄挪动了一点，模型开始犹豫（「3」的把握掉到 84%）。你已经看出差别了吗？" },
    { eps: 0.25, say: "第二阶段：ε=0.25。模型改口了——现在是「8」。人眼看到的仍然是 3。这就是对抗样本。" },
    { eps: 0.4,  say: "第三阶段：ε=0.4。扰动依然填不满一个像素宽度的一半，但模型已经彻底倒向「8」。它不是看错了形状——它从来没有看过形状。" },
  ];
  let sStep = -1, sTimer = null;
  grid("sAdv", hero); bars("sBars", predict(hero).p, 3);
  function sApply(i) {
    const st = STEPS[i];
    const adv = st.eps === 0 ? hero.slice() : fgsm(hero, st.eps, -1);
    grid("sAdv", adv);
    const pr = predict(adv);
    bars("sBars", pr.p, 3);
    $("#sText").textContent = st.say;
    $("#sLamp").className = "lamp " + (st.eps === 0 ? "g" : st.eps < 0.25 ? "a" : "r");
  }
  $("#sPlay").onclick = function () {
    clearInterval(sTimer);
    sStep = -1;
    this.textContent = "袭击中…";
    sTimer = setInterval(() => {
      sStep++;
      if (sStep >= STEPS.length) {
        clearInterval(sTimer);
        $("#sPunch").hidden = false;
        $("#sNext").style.display = "inline-block";
        this.textContent = "↻ 再来一次";
        return;
      }
      sApply(sStep);
    }, 1900);
    sApply(0);
  };

  /* ==================================================
   * ② 玩具：亲手攻击
   * ================================================== */
  let curDigit = 3;
  let base = null, advX = null, attacked = false;
  const byDigit = {};
  M.samples.forEach(s => { if (!byDigit[s.y]) byDigit[s.y] = s.x; });
  $("#dPick").innerHTML = Array.from({ length: 10 }, (_, d) =>
    `<button data-d="${d}" class="${d === 3 ? "on" : ""}">${d}</button>`).join("");
  $("#dPick").addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    $$("#dPick button").forEach(x => x.classList.remove("on"));
    b.classList.add("on");
    curDigit = +b.dataset.d;
    attacked = false;
    toyReset();
  });
  function drawPairs(before, after, trueCls) {
    const idx = after.map((v, i) => i).sort((a, b) => after[b] - after[a]).slice(0, 6);
    $("#aPairs").innerHTML = idx.map(c => `
      <div class="pair${after[c] > before[c] && c !== trueCls && after[c] > 0.3 ? " isTop" : ""}">
        <span class="d">${c}</span>
        <span class="pb before"><i style="width:${before[c] * 100}%"></i></span>
        <span class="pb after"><i style="width:${after[c] * 100}%"></i></span>
        <span class="pvl"><b>${(after[c] * 100).toFixed(1)}%</b> <span style="color:#9d9486">${(before[c] * 100).toFixed(0)}%</span></span>
      </div>`).join("");
  }
  function l2(a, b) { return Math.sqrt(a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0)); }
  function toyRender() {
    const eps = +$("#aEps").value;
    fill($("#aEps"));
    $("#aEpsV").textContent = eps.toFixed(2);
    grid("aOrig", base);
    if (attacked) {
      grid("aNoise", advX.map((v, i) => v - base[i]), { noise: true, noiseGain: 8 });
      grid("aAdv", advX);
      const pb = predict(base), pa = predict(advX);
      const target = +$("#aMode").value;
      drawPairs(pb.p, pa.p, curDigit);
      $("#aMeta").textContent = `ε=${eps.toFixed(2)} · ${target >= 0 ? `目标 ${target}` : "无目标"}`;
      const l = $("#aLamp"), v = $("#aVerdict");
      if (target >= 0) {
        if (pa.cls === target && curDigit !== target) { l.className = "lamp r"; v.innerHTML = `<b style="color:var(--rd)">目标达成</b> — 模型现在 ${Math.round(pa.p[target] * 100)}% 确信这是 ${target}`; }
        else if (pa.cls === target) { l.className = "lamp a"; v.innerHTML = `目标本来就是 ${target}，换个目标试试`; }
        else { l.className = "lamp a"; v.innerHTML = `还没骗过去 — 现在它说是 ${pa.cls}（${Math.round(pa.p[pa.cls] * 100)}%），再加大 ε`; }
      } else {
        if (pa.cls !== curDigit) { l.className = "lamp r"; v.innerHTML = `<b style="color:var(--rd)">得手</b> — 人眼看到 ${curDigit}，模型说 ${pa.cls}（${Math.round(pa.p[pa.cls] * 100)}%）`; }
        else if (pa.p[curDigit] < pb.p[curDigit] - 0.05) { l.className = "lamp a"; v.innerHTML = `在动摇 — 「${curDigit}」的把握 ${Math.round(pb.p[curDigit] * 100)}% → ${Math.round(pa.p[curDigit] * 100)}%`; }
        else { l.className = "lamp g"; v.innerHTML = `模型稳如泰山（ε=${eps.toFixed(2)} 太小）`; }
      }
      if (pa.cls !== curDigit || (target >= 0 && pa.cls === target)) quizOpen = true, showQuiz();
    } else {
      grid("aNoise", new Array(64).fill(0), { noise: true, noiseGain: 8 });
      grid("aAdv", base);
      const pb = predict(base);
      drawPairs(pb.p, pb.p, curDigit);
      $("#aMeta").textContent = "未攻击";
      $("#aLamp").className = "lamp g";
      $("#aVerdict").innerHTML = `模型看它是 <b style="color:var(--gn)">${pb.cls}</b>（${Math.round(pb.p[pb.cls] * 100)}%）`;
    }
  }
  function toyReset() {
    base = byDigit[curDigit].slice();
    advX = base.slice();
    attacked = false;
    toyRender();
  }
  function fill(r) { r.style.setProperty("--fill", ((r.value - r.min) / (r.max - r.min) * 100) + "%"); }
  $("#aEps").addEventListener("input", () => {
    fill($("#aEps"));
    $("#aEpsV").textContent = (+$("#aEps").value).toFixed(2);
  });
  $("#aGo").onclick = () => {
    const eps = +$("#aEps").value, target = +$("#aMode").value;
    advX = fgsm(base, eps, target);
    attacked = true;
    toyRender();
  };
  $("#aReset").onclick = toyReset;
  toyReset();

  /* ==================================================
   * ③ 硬核：50 个样本全体参战
   * ================================================== */
  const S = M.samples.map(s => ({ x: s.x, y: s.y }));
  function sweep() {
    const xs = [], sr = [];
    for (let k = 0; k <= 25; k++) {
      const eps = k / 50;
      let hit = 0;
      S.forEach(s => { if (predict(fgsm(s.x, eps, -1)).cls !== s.y) hit++; });
      xs.push(eps); sr.push(hit / S.length);
    }
    return { xs, sr };
  }
  const H = { x0: 54, x1: 690, y0: 268, y1: 18 };
  function hardChart() {
    const { xs, sr } = sweep();
    const gx = e => H.x0 + e / 0.5 * (H.x1 - H.x0);
    const gy = v => H.y0 - v * (H.y0 - H.y1);
    const path = sr.map((v, i) => `${i ? "L" : "M"}${gx(xs[i]).toFixed(1)},${gy(v).toFixed(1)}`).join(" ");
    $("#hChart").innerHTML = `
      ${[0, .25, .5, .75, 1].map(v => `
        <line x1="${H.x0}" y1="${gy(v)}" x2="${H.x1}" y2="${gy(v)}" stroke="#161d29"/>
        <text x="${H.x0 - 8}" y="${gy(v) + 3}" fill="#9d9486" font-size="10" text-anchor="end">${v * 100}%</text>`).join("")}
      ${[0, .1, .2, .3, .4, .5].map(e => `
        <line x1="${gx(e)}" y1="${H.y0}" x2="${gx(e)}" y2="${H.y1}" stroke="#121926"/>
        <text x="${gx(e)}" y="${H.y0 + 16}" fill="#9d9486" font-size="10" text-anchor="middle">${e.toFixed(1)}</text>`).join("")}
      <text x="${(H.x0 + H.x1) / 2}" y="${H.y0 + 34}" fill="#6d6659" font-size="11" text-anchor="middle">噪声强度 ε（像素满刻度 = 1）</text>
      <text x="16" y="${(H.y0 + H.y1) / 2}" fill="#6d6659" font-size="11" text-anchor="middle" transform="rotate(-90 16 ${(H.y0 + H.y1) / 2})">攻击成功率</text>
      <line x1="${H.x0}" y1="${gy(0.5)}" x2="${H.x1}" y2="${gy(0.5)}" stroke="#2c3849" stroke-dasharray="4 4"/>
      <path d="${path}" fill="none" stroke="#c1473e" stroke-width="2.4" style="filter:drop-shadow(0 0 6px rgba(193,71,62,.4))"/>
      ${xs.map((e, i) => `<circle cx="${gx(e)}" cy="${gy(sr[i])}" r="3" fill="#c1473e">
        <title>ε=${e.toFixed(2)} → 成功率 ${(sr[i] * 100).toFixed(0)}%</title></circle>`).join("")}`;
    return { xs, sr };
  }
  function hardStats() {
    $("#mAcc").textContent = (M.acc * 100).toFixed(0) + "%";
    // 每个样本的翻转 ε（步长 0.02）
    const flips = [];
    let l2sum = 0;
    S.forEach(s => {
      for (let k = 1; k <= 25; k++) {
        const eps = k * 0.02;
        const adv = fgsm(s.x, eps, -1);
        if (predict(adv).cls !== s.y) { flips.push(eps); l2sum += l2(adv, s.x); break; }
      }
    });
    flips.sort((a, b) => a - b);
    $("#mFlip").textContent = flips.length ? flips[Math.floor(flips.length / 2)].toFixed(2) : "—";
    $("#mL2").textContent = (l2sum / S.length).toFixed(3);
    const { sr } = hardChart();
    const s20 = sr[Math.round(0.2 * 50)];
    $("#mS20").textContent = (s20 * 100).toFixed(0) + "%";
    $("#mS20").className = s20 > 0.8 ? "r" : s20 > 0.4 ? "a" : "g";
    const perDigit = {};
    flips.forEach(f => perDigit[f] = (perDigit[f] || 0) + 1);
    $("#flipTbl").innerHTML = Array.from({ length: 10 }, (_, d) => {
      const sample = S.filter(s => s.y === d);
      let fe = "—";
      for (let k = 1; k <= 25; k++) {
        const eps = k * 0.02;
        if (sample.some(s => predict(fgsm(s.x, eps, -1)).cls !== s.y)) { fe = "ε=" + eps.toFixed(2); break; }
      }
      return `<div><span>数字 ${d}</span><span>${fe}</span></div>`;
    }).join("");
  }

  /* ==================================================
   * 通关题
   * ================================================== */
  let quizOpen = false, cleared = false;
  function showQuiz() { $("#quizToy").style.display = ""; }
  const QUIZ = {
    q: "对抗图和原图的人眼差异几乎为零，模型却集体认错。最合理的解释是？",
    opts: [["图片文件在传输中被损坏了", false],
           ["模型看的不是形状，而是 64 个像素的加权和——攻击正好顺着这份加权和的梯度走", true],
           ["模型训练得不够久，多练就能避免", false],
           ["人类的眼睛其实有完全相同的弱点", false]],
  };
  function renderQuiz(optsId, qId) {
    const order = QUIZ.opts.map((o, i) => i).sort(() => Math.random() - .5);
    $("#" + qId).textContent = QUIZ.q;
    $("#" + optsId).innerHTML = order.map(i =>
      `<button class="opt" data-ok="${QUIZ.opts[i][1]}">${QUIZ.opts[i][0]}</button>`).join("");
  }
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
    try { parent.postMessage({ type: "tlab:clear", module: "m7" }, "*"); } catch {}
    try {
      const s = JSON.parse(localStorage.getItem("tlab.v1") || "{}");
      s.got = s.got || {};
      if (!s.got.m7) { s.got.m7 = Date.now(); localStorage.setItem("tlab.v1", JSON.stringify(s)); }
    } catch {}
    [["#quizRes", "#confetti"], ["#quizRes2", "#confetti2"]].forEach(([r, cf]) => {
      const box = $(r);
      box.querySelector(".lamp").className = "lamp g";
      box.querySelector("span:last-child").innerHTML =
        "答对了 — <b style='color:var(--gn)'>图鉴第 7 张已点亮 ✓</b>，回博物馆看看你的收藏。";
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

  /* ---------- 开机 ---------- */
  hardStats();
})();
</script>
