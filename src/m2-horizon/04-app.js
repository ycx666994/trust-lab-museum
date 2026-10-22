<script>
(function () {
  "use strict";
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const fill = r => r.style.setProperty("--fill", ((r.value - r.min) / (r.max - r.min) * 100) + "%");
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  $$(".tab").forEach(t => t.onclick = () => {
    $$(".tab").forEach(x => x.classList.remove("on"));
    t.classList.add("on");
    $$(".layer").forEach(l => l.classList.remove("on"));
    $("#ly-" + t.dataset.layer).classList.add("on");
    if (t.dataset.layer === "hard") loadIFrame();
  });

  /* ==================================================
   * ① 故事：盖章 + 衰减条带动画
   * ================================================== */
  let sStep = 0, sTimer = null;
  const RHO = 0.85;
  $("#sPlay").onclick = function () {
    if (sTimer) return;
    this.textContent = "盖章中…";
    $("#stamp").classList.add("on");
    sTimer = setInterval(() => {
      sStep++;
      const beats = $$(".beat");
      if (sStep <= beats.length) beats[sStep - 1].classList.add("in");
      if (sStep === beats.length) { drawStory(); }
      if (sStep > beats.length) {
        clearInterval(sTimer); sTimer = null;
        this.textContent = "↻ 再看一遍";
        $("#sNext").style.display = "inline-block";
        sStep = 0;
      }
    }, 1500);
  };
  $("#sNext").onclick = () => $$(".tab")[1].click();
  function drawStory() {
    // ρ^ℓ 衰减条带（ℓ=1..30）+ 三条地平线示意竖线
    const X0 = 46, X1 = 686, Y0 = 214, Y1 = 18, N = 30;
    const gx = l => X0 + (l - 1) / (N - 1) * (X1 - X0);
    const gy = v => Y0 - v * (Y0 - Y1);
    let bars = "";
    for (let l = 1; l <= N; l++) {
      const v = Math.pow(RHO, l);
      const col = v >= 0.5 ? "#1c8a5c" : v >= 0.2 ? "#b0741c" : "#c1473e";
      bars += `<rect x="${gx(l) - 5}" y="${gy(v)}" width="10" height="${Y0 - gy(v)}" rx="2" fill="${col}" opacity=".85"/>`;
    }
    $("#sChart").innerHTML = `
      <line x1="${X0}" y1="${Y0}" x2="${X1}" y2="${Y0}" stroke="#2c3849"/>
      ${[0, .25, .5, .75, 1].map(v => `
        <line x1="${X0}" y1="${gy(v)}" x2="${X1}" y2="${gy(v)}" stroke="#e3dccd"/>
        <text x="${X0 - 8}" y="${gy(v) + 3}" fill="#9d9486" font-size="10" text-anchor="end" font-family="Consolas">${v * 100}%</text>`).join("")}
      ${bars}
      <text x="${(X0 + X1) / 2}" y="${Y0 + 30}" fill="#6d6659" font-size="11" text-anchor="middle">受保护切口长度 ℓ →（ρ=0.85，覆盖率 ρ<sup>ℓ</sup>）</text>
      <text x="${gx(6) + 8}" y="${gy(Math.pow(RHO, 6)) - 6}" fill="#b0741c" font-size="10.5">默认 ℓ=6</text>
      <text x="${X1 - 6}" y="${Y1 + 12}" fill="#c1473e" font-size="10.5" text-anchor="end">远处的证书一文不值</text>`;
  }

  /* ==================================================
   * ② 玩具：证书值多少钱
   * ================================================== */
  const TX0 = 46, TX1 = 686, TY0 = 264, TY1 = 18, TN = 30;
  const tgx = l => TX0 + (l - 1) / (TN - 1) * (TX1 - TX0);
  const tgy = v => TY0 - clamp(v, 0, 1) * (TY0 - TY1);
  function toyRender() {
    fill($("#tRho")); fill($("#tLen"));
    const rho = +$("#tRho").value, L = +$("#tLen").value;
    $("#tRhoV").textContent = rho.toFixed(2);
    $("#tLenV").textContent = L;
    const v = Math.pow(rho, L);
    let bars = "";
    for (let l = 1; l <= TN; l++) {
      const lv = Math.pow(rho, l);
      const cur = l === L;
      const col = lv >= 0.5 ? "#1c8a5c" : lv >= 0.2 ? "#b0741c" : "#c1473e";
      bars += `<rect x="${tgx(l) - 5}" y="${tgy(lv)}" width="10" height="${TY0 - tgy(lv)}" rx="2" fill="${col}" opacity="${cur ? 1 : 0.3}"/>`;
    }
    $("#tChart").innerHTML = `
      <line x1="${TX0}" y1="${TY0}" x2="${TX1}" y2="${TY0}" stroke="#2c3849"/>
      ${[0, .25, .5, .75, 1].map(x => `
        <line x1="${TX0}" y1="${tgy(x)}" x2="${TX1}" y2="${tgy(x)}" stroke="#e3dccd"/>
        <text x="${TX0 - 8}" y="${tgy(x) + 3}" fill="#9d9486" font-size="10" text-anchor="end" font-family="Consolas">${x * 100}%</text>`).join("")}
      ${bars}
      <text x="${(TX0 + TX1) / 2}" y="${TY0 + 30}" fill="#6d6659" font-size="11" text-anchor="middle">切口长度 ℓ →</text>
      <line x1="${tgx(L)}" y1="${TY1}" x2="${tgx(L)}" y2="${TY0}" stroke="#b0741c" stroke-width="1.4" stroke-dasharray="4 3"/>
      <circle cx="${tgx(L)}" cy="${tgy(v)}" r="6" fill="#b0741c" stroke="#f5f1e7" stroke-width="2"/>`;
    const l = $("#tLamp");
    if (v >= 0.5) { l.className = "lamp g"; $("#tVerdict").innerHTML = `<b style="color:var(--gn)">证书坚挺</b> — ρ<sup>${L}</sup> = ${(v * 100).toFixed(1)}% 的行为仍可被验证`; }
    else if (v >= 0.2) { l.className = "lamp a"; $("#tVerdict").innerHTML = `<b style="color:var(--am)">勉强及格</b> — 只剩 ${(v * 100).toFixed(1)}%，审计要抓紧了`; }
    else { l.className = "lamp r"; $("#tVerdict").innerHTML = `<b style="color:var(--rd)">证书过期</b> — 只剩 ${(v * 100).toFixed(1)}%，和抛硬币猜没有区别`; }
    $("#tNote").innerHTML = v < 0.2
      ? `注意衰减有多快：ρ=${rho.toFixed(2)} 意味着每多走一步就再打 <b>${(rho * 100).toFixed(0)} 折</b>。30 步之后只剩 ${(Math.pow(rho, 30) * 100).toFixed(2)}%——指数不跟你讲情面。提高 ρ（更可信的单步验证）比延长 ℓ 划算得多。`
      : `把 ℓ 往右拉，感受指数衰减的加速感；或把 ρ 拉高一点，看整条曲线整体抬升——<b>可信度是乘法，不是加法</b>。`;
    if (toyTouched) $("#quizToy").style.display = "";
  }
  let toyTouched = false;
  ["tRho", "tLen"].forEach(id => $("#" + id).addEventListener("input", () => { toyTouched = true; toyRender(); }));
  toyRender();

  /* ==================================================
   * ③ 硬核：iframe 懒加载
   * ================================================== */
  let frameLoaded = false;
  function loadIFrame() {
    if (frameLoaded) return;
    frameLoaded = true;
    $("#frameBox").innerHTML = `<iframe src="vendor/horizon-workbench.html" title="认证地平线完整工作台" loading="lazy"></iframe>`;
  }
  $("#loadFrame").onclick = loadIFrame;

  /* ==================================================
   * 通关题
   * ================================================== */
  const QUIZ = {
    q: "模型今天通过了全部测试，能不能证明它「永远可靠」？",
    opts: [["能——测试全过就是可靠", false],
           ["不能——证据只覆盖有限的受保护切口，覆盖率按 ρ^ℓ 指数衰减，证书只在认证地平线 ℓ* 之内有效", true],
           ["能——只要模型参数足够多", false],
           ["与测试无关，可靠是玄学", false]],
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
    try { parent.postMessage({ type: "tlab:clear", module: "m2" }, "*"); } catch {}
    try {
      const s = JSON.parse(localStorage.getItem("tlab.v1") || "{}");
      s.got = s.got || {};
      if (!s.got.m2) { s.got.m2 = Date.now(); localStorage.setItem("tlab.v1", JSON.stringify(s)); }
    } catch {}
    [["#quizRes", "#confetti"], ["#quizRes2", "#confetti2"]].forEach(([r, cf]) => {
      const box = $(r);
      box.querySelector(".lamp").className = "lamp g";
      box.querySelector("span:last-child").innerHTML =
        "答对了 — <b style='color:var(--gn)'>图鉴第 2 张已点亮 ✓</b>，回博物馆看看你的收藏。";
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
