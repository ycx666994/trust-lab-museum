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

  /* ---------- 曲线生成：real=真台阶（位置固定），mirage=斜坡+噪声（台阶是错觉） ---------- */
  function makeCurve(kind, seed, n) {
    n = n || 48;
    const rng = mulberry32(seed), y = [];
    for (let i = 0; i < n; i++) {
      let v;
      if (kind === "real") v = 0.15 + 0.006 * i + (i >= n / 2 ? 0.5 : 0) + (rng() - 0.5) * 0.05;
      else v = 0.15 + 0.011 * i + (rng() - 0.5) * 0.1;
      y.push(clamp(v, 0, 1));
    }
    return y;
  }

  /* ---------- SVG 折线 ---------- */
  const CW = 700, CH = 300, M = { l: 46, r: 14, t: 16, b: 30 };
  function pathOf(y, x0, x1, y0, y1, lo, hi) {
    lo = lo === undefined ? 0 : lo; hi = hi === undefined ? 1 : hi;
    const n = y.length;
    return y.map((v, i) => {
      const px = x0 + (i / (n - 1)) * (x1 - x0);
      const py = y0 - clamp((v - lo) / (hi - lo), 0, 1) * (y0 - y1);
      return `${i ? "L" : "M"}${px.toFixed(1)},${py.toFixed(1)}`;
    }).join(" ");
  }
  function axes(x0, x1, y0, y1) {
    let s = `<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y0}" stroke="#2c3849"/>
      <line x1="${x0}" y1="${y0}" x2="${x0}" y2="${y1}" stroke="#2c3849"/>`;
    for (let k = 0; k <= 4; k++) {
      const yy = y0 - k / 4 * (y0 - y1);
      s += `<line x1="${x0}" y1="${yy}" x2="${x1}" y2="${yy}" stroke="#e3dccd"/>
        <text x="${x0 - 8}" y="${yy + 3}" fill="#9d9486" font-size="10" text-anchor="end" font-family="Consolas">${k * 25}</text>`;
    }
    s += `<text x="${(x0 + x1) / 2}" y="${y0 + 24}" fill="#6d6659" font-size="11" text-anchor="middle">训练规模（对数轴）→</text>`;
    return s;
  }

  $$(".tab").forEach(t => t.onclick = () => {
    $$(".tab").forEach(x => x.classList.remove("on"));
    t.classList.add("on");
    $$(".layer").forEach(l => l.classList.remove("on"));
    $("#ly-" + t.dataset.layer).classList.add("on");
    if (t.dataset.layer === "hard") loadIFrame();
  });

  /* ==================================================
   * ① 故事
   * ================================================== */
  const storyMain = makeCurve("mirage", 20261018);
  let reran = false;
  $("#sChart").innerHTML = axes(M.l, CW - M.r, CH - M.b, M.t) +
    `<path d="${pathOf(storyMain, M.l, CW - M.r, CH - M.b, M.t)}" fill="none" stroke="#0e7f9c" stroke-width="2.4"/>` +
    `<text x="${CW - M.r - 8}" y="${M.t + 14}" fill="#b0741c" font-size="12" text-anchor="end">↑ 涌现！能力飞跃！</text>`;
  $("#sPlay").onclick = function () {
    this.disabled = true;
    $("#sRerun").style.display = "inline-block";
    $("#sLamp").className = "lamp a";
    $("#sText").innerHTML = `单次评测：台阶清晰可见——<b style="color:var(--am)">但只有一次评测，谁也无法证伪</b>`;
  };
  $("#sRerun").onclick = function () {
    if (reran) return;
    reran = true;
    let s = "";
    for (let k = 0; k < 10; k++) {
      const y = makeCurve("mirage", 1000 + k * 7);
      s += `<path d="${pathOf(y, M.l, CW - M.r, CH - M.b, M.t)}" fill="none" stroke="rgba(14,127,156,${0.14 + k * 0.02})" stroke-width="1.3"/>`;
    }
    $("#sChart").innerHTML = axes(M.l, CW - M.r, CH - M.b, M.t) + s +
      `<path d="${pathOf(storyMain, M.l, CW - M.r, CH - M.b, M.t)}" fill="none" stroke="#0e7f9c" stroke-width="2.4"/>`;
    $("#sLamp").className = "lamp r";
    $("#sText").innerHTML = `<b style="color:var(--rd)">10 次重跑：台阶的位置每次都在换</b> —— 它是噪声排队的巧合，不是涌现`;
    $("#sPunch").hidden = false;
    $("#sNext").style.display = "inline-block";
    this.disabled = true;
  };
  $("#sNext").onclick = () => $$(".tab")[1].click();

  /* ==================================================
   * ② 玩具：真假涌现 4 连测
   * ================================================== */
  const CASES = [
    { kind: "real", seed: 11 }, { kind: "mirage", seed: 23 },
    { kind: "real", seed: 37 }, { kind: "mirage", seed: 51 },
  ].sort(() => Math.random() - 0.5);
  let round = 0, score = 0, answered = false;
  function showCase() {
    answered = false;
    const c = CASES[round];
    $("#gRound").textContent = round + 1;
    $("#gMeta").textContent = "CASE " + (round + 1) + " · seed " + c.seed;
    $("#gChart").innerHTML = axes(M.l, CW - M.r, CH - M.b, M.t) +
      `<path d="${pathOf(makeCurve(c.kind, c.seed), M.l, CW - M.r, CH - M.b, M.t)}" fill="none" stroke="#0e7f9c" stroke-width="2.4"/>`;
    $("#gLamp").className = "lamp";
    $("#gVerdict").textContent = "你的判断是？";
    $("#gHint").innerHTML = "小技巧：想象这条曲线附近还有很多点被噪声埋住了——单次评测只给你一条线。";
  }
  function answer(guess) {
    if (answered) return;
    answered = true;
    const c = CASES[round];
    const ok = guess === c.kind;
    if (ok) score++;
    $("#gScore").textContent = score;
    // 揭晓：叠 8 次重跑
    let s = "";
    for (let k = 0; k < 8; k++) {
      const y = makeCurve(c.kind, c.seed + 500 + k * 13);
      s += `<path d="${pathOf(y, M.l, CW - M.r, CH - M.b, M.t)}" fill="none" stroke="rgba(14,127,156,.16)" stroke-width="1.2"/>`;
    }
    $("#gChart").innerHTML = axes(M.l, CW - M.r, CH - M.b, M.t) + s +
      `<path d="${pathOf(makeCurve(c.kind, c.seed), M.l, CW - M.r, CH - M.b, M.t)}" fill="none" stroke="#0e7f9c" stroke-width="2.4"/>`;
    const l = $("#gLamp"), v = $("#gVerdict");
    if (ok) { l.className = "lamp g"; v.innerHTML = `<b style="color:var(--gn)">答对了</b> — 这是${c.kind === "real" ? "真涌现：8 次重跑台阶都在同一处" : "海市蜃楼：8 次重跑台阶各奔东西"}`; }
    else { l.className = "lamp r"; v.innerHTML = `<b style="color:var(--rd)">看走眼了</b> — 真相：${c.kind === "real" ? "真涌现（台阶位置稳定）" : "海市蜃楼（台阶是噪声排队）"}`; }
    setTimeout(() => {
      round++;
      if (round < CASES.length) showCase();
      else {
        $("#gHint").innerHTML = `4 题结束，你判对 <b style="color:var(--cy)">${score}</b> 题。人类单靠一条线也会看走眼——所以才需要双判据检测器。`;
        $("#quizToy").style.display = "";
      }
    }, 2600);
  }
  $("#gReal").onclick = () => answer("real");
  $("#gFake").onclick = () => answer("mirage");
  showCase();

  /* ==================================================
   * ③ 硬核：iframe 懒加载
   * ================================================== */
  let frameLoaded = false;
  function loadIFrame() {
    if (frameLoaded) return;
    frameLoaded = true;
    $("#frameBox").innerHTML = `<iframe src="vendor/emergence-lab.html" title="Emergence Lab 完整工作台" loading="lazy"></iframe>`;
  }
  $("#loadFrame").onclick = loadIFrame;

  /* ==================================================
   * 通关题
   * ================================================== */
  const QUIZ = {
    q: "同一条曲线上出现了一个漂亮的台阶，最可靠的识破手段是？",
    opts: [["把台阶区域的点放大看，并多次重跑看台阶位置是否稳定（双判据）", true],
           ["看台阶的高度够不够大", false],
           ["看发表这条曲线的机构够不够权威", false],
           ["多加几个参数再测一次", false]],
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
    try { parent.postMessage({ type: "tlab:clear", module: "m1" }, "*"); } catch {}
    try {
      const s = JSON.parse(localStorage.getItem("tlab.v1") || "{}");
      s.got = s.got || {};
      if (!s.got.m1) { s.got.m1 = Date.now(); localStorage.setItem("tlab.v1", JSON.stringify(s)); }
    } catch {}
    [["#quizRes", "#confetti"], ["#quizRes2", "#confetti2"]].forEach(([r, cf]) => {
      const box = $(r);
      box.querySelector(".lamp").className = "lamp g";
      box.querySelector("span:last-child").innerHTML =
        "答对了 — <b style='color:var(--gn)'>图鉴第 1 张已点亮 ✓</b>，回博物馆看看你的收藏。";
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
