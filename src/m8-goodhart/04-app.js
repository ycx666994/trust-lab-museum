<script>
(function () {
  "use strict";
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  /* ---------- 奖励设计的确定性模拟（简化模型，说清机制） ---------- */
  /* dumpP: 作弊倾向；score: 考核分；clean: 真实清洁度 */
  function simulate(rule, rounds) {
    const t = rounds / 100;
    if (rule === "piece") {
      const dumpP = clamp(rounds / 60, 0, 1);
      return { dumpP, score: 100 + 90 * dumpP + rounds * 0.1, clean: clamp(100 - 80 * dumpP, 5, 100) };
    }
    if (rule === "clean") {
      return { dumpP: 0, score: 100 + rounds * 0.15, clean: clamp(100 - rounds * 0.05, 95, 100) };
    }
    if (rule === "mix") {
      const dumpP = clamp(rounds / 120, 0, 0.5);   // 双指标制衡 → 作弊空间减半
      return { dumpP, score: 100 + 45 * dumpP + rounds * 0.12, clean: clamp(100 - 40 * dumpP, 80, 100) };
    }
    /* audit: 计件 + 10% 抽查，被抓罚 3 倍 → 作弊变得不划算 */
    const dumpP = clamp(rounds / 60, 0, 1) * 0.12;
    return { dumpP, score: 100 + 12 * dumpP + rounds * 0.1, clean: clamp(100 - 12 * dumpP, 96, 100) };
  }
  const DESIGNS = [
    { rule: "piece", name: "只按捡到垃圾数" },
    { rule: "clean", name: "只按房间清洁度" },
    { rule: "mix",   name: "双指标各半" },
    { rule: "audit", name: "计件 + 反作弊审计" },
  ];

  $$(".tab").forEach(t => t.onclick = () => {
    $$(".tab").forEach(x => x.classList.remove("on"));
    t.classList.add("on");
    $$(".layer").forEach(l => l.classList.remove("on"));
    $("#ly-" + t.dataset.layer).classList.add("on");
  });

  /* ---------- 8×8 网格 ---------- */
  const CELL = 20;
  function drawGrid(svgId, dirtyCells, robot, dumpFlash) {
    dirtyCells = dirtyCells || new Set();
    let s = `<rect width="160" height="160" fill="#0a0e14"/>`;
    for (let i = 0; i < 64; i++) {
      const r = (i / 8) | 0, c = i % 8;
      if (dirtyCells.has(i)) s += `<circle cx="${c * CELL + 10}" cy="${r * CELL + 10}" r="5" fill="#8a6d3b"/>`;
    }
    if (robot != null) {
      const r = (robot / 8) | 0, c = robot % 8;
      s += `<rect x="${c * CELL + 2}" y="${r * CELL + 2}" width="16" height="16" rx="4" fill="rgba(123,79,208,.85)"/>
            <text x="${c * CELL + 10}" y="${r * CELL + 14}" font-size="10" text-anchor="middle">🤖</text>`;
    }
    if (dumpFlash != null) {
      const r = (dumpFlash / 8) | 0, c = dumpFlash % 8;
      s += `<rect x="${c * CELL}" y="${r * CELL}" width="20" height="20" fill="rgba(193,71,62,.4)"/>`;
    }
    $("#" + svgId).innerHTML = s;
  }

  /* ==================================================
   * ① 故事动画
   * ================================================== */
  let dirty = new Set(), robot = 0, sBusy = false;
  dirty = new Set(Array.from({ length: 26 }, (_, i) => (i * 13 + 7) % 64));
  drawGrid("sGrid", dirty, null, null);
  $("#sPlay").onclick = function () {
    if (sBusy) return;
    sBusy = true;
    this.textContent = "播放中…";
    const beats = $$("#sBeats .beat");
    beats.forEach(b => b.classList.remove("in"));
    let score = 0, clean = 100, step = 0;
    const spots = [...dirty];
    const timer = setInterval(() => {
      if (step === 0) { beats[0].classList.add("in"); $("#sPhase").textContent = "第 1 天 · 老实捡垃圾"; }
      if (step < 8) {
        // 老实阶段：挨个捡
        const cell = spots[step % spots.length];
        robot = cell;
        if (dirty.has(cell)) { dirty.delete(cell); score += 10; }
      } else if (step === 8) {
        beats[1].classList.add("in");
        $("#sPhase").textContent = "第 30 天 · 绝招上线：倒出来再捡";
        for (let i = 0; i < 10; i++) dirty.add((i * 7 + 3) % 64);   // 重新出现更多垃圾
      } else if (step < 16) {
        const cells = [...dirty];
        const cell = cells[(step * 3) % cells.length];
        robot = cell;
        // 作弊循环：捡 → 倒回 → 再捡，分数照涨，清洁度崩
        dirty.add(cell);                    // 倒回
        drawGrid("sGrid", dirty, robot, cell);
        score += 10;
        clean = Math.max(8, clean - 6);
        drawGrid("sGrid", dirty, robot, cell);
      } else if (step === 16) {
        beats[2].classList.add("in");
        $("#sPhase").textContent = "月底复盘 · 分数新高，房间更脏";
        $("#sNext").style.display = "inline-block";
        this.textContent = "↻ 再看一遍";
        clearInterval(timer); sBusy = false;
        drawGrid("sGrid", dirty, robot, null);
        return;
      }
      $("#sScore").textContent = score;
      $("#sScoreBar").style.width = clamp(score / 2.2, 0, 100) + "%";
      $("#sClean").textContent = Math.round(clean) + "%";
      $("#sCleanBar").style.width = clean + "%";
      $("#sCleanBar").style.background = clean > 60 ? "var(--gn)" : clean > 30 ? "var(--am)" : "var(--rd)";
      drawGrid("sGrid", dirty, robot, null);
      step++;
    }, 620);
  };
  $("#sNext").onclick = () => $$(".tab")[1].click();

  /* ==================================================
   * ② 玩具：你当训练官
   * ================================================== */
  let rule = "piece", touched = false;
  const X0 = 52, X1 = 686, Y0 = 262, Y1 = 18;
  $("#tRule").addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    $$("#tRule button").forEach(x => x.classList.remove("on"));
    b.classList.add("on");
    rule = b.dataset.r;
    touched = true;
    toyRender();
  });
  $("#tRounds").addEventListener("input", () => {
    fill($("#tRounds"));
    $("#tRoundsV").textContent = $("#tRounds").value;
    touched = true;
    toyRender();
  });
  function fill(r) { r.style.setProperty("--fill", ((r.value - r.min) / (r.max - r.min) * 100) + "%"); }
  function toyRender() {
    const rounds = +$("#tRounds").value;
    const cur = simulate(rule, rounds);
    // 曲线
    const pts = [];
    for (let r = 0; r <= 100; r += 5) pts.push({ r, ...simulate(rule, r) });
    const gx = r => X0 + r / 100 * (X1 - X0);
    const gyC = v => Y0 - v / 100 * (Y0 - Y1);                 // 清洁度 0-100
    const gyS = v => Y0 - clamp((v - 80) / 120, 0, 1) * (Y0 - Y1);  // 分数 80-200
    const path = (key, fn) => pts.map((p, i) => `${i ? "L" : "M"}${gx(p.r).toFixed(1)},${fn(p[key]).toFixed(1)}`).join(" ");
    $("#tChart").innerHTML = `
      ${[0, .25, .5, .75, 1].map(v => `
        <line x1="${X0}" y1="${gyC(v * 100)}" x2="${X1}" y2="${gyC(v * 100)}" stroke="#e3dccd"/>
        <text x="${X0 - 8}" y="${gyC(v * 100) + 3}" fill="#9d9486" font-size="10" text-anchor="end" font-family="Consolas">${v * 100}</text>`).join("")}
      ${[0, 25, 50, 75, 100].map(r => `
        <line x1="${gx(r)}" y1="${Y0}" x2="${gx(r)}" y2="${Y1}" stroke="#121926"/>
        <text x="${gx(r)}" y="${Y0 + 16}" fill="#9d9486" font-size="10" text-anchor="middle">${r}</text>`).join("")}
      <text x="${(X0 + X1) / 2}" y="${Y0 + 32}" fill="#6d6659" font-size="11" text-anchor="middle">训练轮数</text>
      <text x="14" y="${(Y0 + Y1) / 2}" fill="#6d6659" font-size="10.5" text-anchor="middle" transform="rotate(-90 14 ${(Y0 + Y1) / 2})">清洁度%</text>
      <text x="${X1 - 4}" y="${Y1 + 10}" fill="#9d9486" font-size="10" text-anchor="end" font-family="Consolas">分数轴（右移 80 起算）</text>
      <line x1="${gx(rounds)}" y1="${Y0}" x2="${gx(rounds)}" y2="${Y1}" stroke="var(--ac)" stroke-dasharray="4 3"/>
      <path d="${path("score", gyS)}" fill="none" stroke="#7b4fd0" stroke-width="2.4"/>
      <path d="${path("clean", gyC)}" fill="none" stroke="#1c8a5c" stroke-width="2.4"/>
      <circle cx="${gx(rounds)}" cy="${gyS(cur.score)}" r="5" fill="#7b4fd0" stroke="#f5f1e7" stroke-width="2"/>
      <circle cx="${gx(rounds)}" cy="${gyC(cur.clean)}" r="5" fill="#1c8a5c" stroke="#f5f1e7" stroke-width="2"/>`;
    // 判定
    const l = $("#tLamp"), v = $("#tVerdict");
    if (rule === "piece") {
      l.className = "lamp " + (cur.dumpP > 0.5 ? "r" : cur.dumpP > 0.2 ? "a" : "g");
      v.innerHTML = cur.dumpP > 0.2
        ? `<b style="color:var(--rd)">Goodhart 现场</b> — 分数 ${cur.score.toFixed(0)}（↑），真实清洁度 ${cur.clean.toFixed(0)}%（↓）`
        : `暂时正常 — 作弊倾向刚萌芽（${(cur.dumpP * 100).toFixed(0)}%），继续训练试试`;
      $("#tNote").innerHTML = `优化器不认识「干净」，只认识你写的分数。计件规则下，<b>倒出来再捡</b>是它的最优解——这不是 bug，是它忠实地执行了你真正写下的目标。`;
    } else {
      l.className = "lamp g";
      v.innerHTML = `<b style="color:var(--gn)">老实工作</b> — 分数 ${cur.score.toFixed(0)}，清洁度 ${cur.clean.toFixed(0)}%，两者同步`;
      $("#tNote").innerHTML = `清洁度传感器很难靠「倒出来再捡」刷分——作弊成本高于收益。教训：<b>奖励离真实目标越近，可钻的空子越少</b>。但传感器也可能有别的漏洞（把垃圾藏到传感器死角），防御永远是进行时。`;
    }
    if (touched) $("#quizToy").style.display = "";
  }
  toyRender();

  /* ==================================================
   * ③ 硬核：四种设计对比
   * ================================================== */
  $("#hTbl").innerHTML = `<tr><th>奖励设计</th><th>最终分数</th><th>真实清洁度</th><th>结论</th></tr>` +
    DESIGNS.map(d => {
      const s = simulate(d.rule, 100);
      const concl = d.rule === "piece" ? "💥 被彻底钻穿" : d.rule === "clean" ? "✅ 基本可信" : d.rule === "mix" ? "🟡 空子减半" : "✅ 作弊无利可图";
      return `<tr><td>${d.name}</td><td><b>${s.score.toFixed(0)}</b></td><td><b>${s.clean.toFixed(0)}%</b></td><td>${concl}</td></tr>`;
    }).join("");

  /* ==================================================
   * 通关题
   * ================================================== */
  const QUIZ = {
    q: "分数涨了 90%，房间却更脏了——这个现象在机器学习里的名字是？",
    opts: [["过拟合（多加数据就能好）", false],
           ["Goodhart 定律：当指标成了目标，它就不再是好指标", true],
           ["欠拟合（模型太简单）", false],
           ["随机波动，重跑一次就好", false]],
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
    try { parent.postMessage({ type: "tlab:clear", module: "m8" }, "*"); } catch {}
    try {
      const s = JSON.parse(localStorage.getItem("tlab.v1") || "{}");
      s.got = s.got || {};
      if (!s.got.m8) { s.got.m8 = Date.now(); localStorage.setItem("tlab.v1", JSON.stringify(s)); }
    } catch {}
    [["#quizRes", "#confetti"], ["#quizRes2", "#confetti2"]].forEach(([r, cf]) => {
      const box = $(r);
      box.querySelector(".lamp").className = "lamp g";
      box.querySelector("span:last-child").innerHTML =
        "答对了 — <b style='color:var(--gn)'>图鉴第 8 张已点亮 ✓</b>，八张集齐，回博物馆领证书！";
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
