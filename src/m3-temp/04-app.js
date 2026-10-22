<script>
(function () {
  "use strict";
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const esc = s => s.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  /* ---------- 引擎（懒加载：构造 + 语料建模耗时数秒，绝不能阻塞解析/绑定） ---------- */
  let LM = null;
  const getLM = () => (LM || (LM = new TLLM.TinyLM(window.TL_CORPUS, 4)));

  /* ---------- 工具 ---------- */
  function fill(r) { r.style.setProperty("--fill", ((r.value - r.min) / (r.max - r.min) * 100) + "%"); }
  function typeInto(el, text, speed, done) {
    const body = el.querySelector(".body") || el;
    const caret = el.querySelector(".caret");
    let i = 0;
    (function step() {
      body.textContent = text.slice(0, ++i);
      if (i < text.length) setTimeout(step, speed);
      else { if (caret) caret.remove(); if (done) done(); }
    })();
  }
  function trigrams(s) {
    const set = new Set();
    for (let i = 0; i + 2 < s.length; i++) set.add(s.slice(i, i + 3));
    return set;
  }
  function jaccard(a, b) {
    const A = trigrams(a), B = trigrams(b);
    if (!A.size || !B.size) return 0;
    let inter = 0;
    A.forEach(t => { if (B.has(t)) inter++; });
    return inter / (A.size + B.size - inter);
  }
  const TOPICS = [
    { name: "月球", kw: ["月", "硅酸盐", "氧化铁", "玻璃", "氦", "撞击"] },
    { name: "深海", kw: ["热泉", "深海", "硫化", "海水", "管虫", "洋流"] },
    { name: "材料", kw: ["晶格", "位错", "退火", "合金", "疲劳", "腐蚀", "晶粒"] },
    { name: "天文", kw: ["光谱", "红移", "望远镜", "恒星", "星系", "宇宙"] },
    { name: "AI", kw: ["模型", "训练", "采样", "参数", "过拟合"] },
    { name: "测量", kw: ["误差", "标定", "置信", "测量", "不确定"] },
  ];
  const topicsHit = t => TOPICS.filter(tp => tp.kw.some(k => t.includes(k)));

  /* ---------- 层切换 ---------- */
  $$(".tab").forEach(t => t.onclick = () => {
    $$(".tab").forEach(x => x.classList.remove("on"));
    t.classList.add("on");
    $$(".layer").forEach(l => l.classList.remove("on"));
    $("#ly-" + t.dataset.layer).classList.add("on");
  });

  /* ==================================================
   * ① 故事：两副面孔（同一道题 · 温度 0.2 vs 1.2）
   * ================================================== */
  const Q = "月球土壤的主要成分是";
  let ansA = "", ansB = "";   /* 解析期不阻塞外壳——延迟到首帧后台计算 */
  setTimeout(() => {
    ansA = getLM().generate({ prompt: Q, len: 96, temperature: 0.15, seed: 42 }).text;
    ansB = getLM().generate({ prompt: Q, len: 96, temperature: 1.2, seed: 42 }).text;
    hardThree(); scan();   /* 开机首绘同样挪到后台——解析期零阻塞 */
  }, 40);
  let storyStarted = false;
  $("#storyPlay").onclick = function () {
    if (storyStarted) return;
    if (!ansA) {   /* 后台计算未完成——等它，不空转 */
      this.textContent = "作答中…";
      const self = this;
      setTimeout(() => { storyStarted = false; self.click(); }, 150);
      return;
    }
    storyStarted = true;
    this.textContent = "作答中…";
    let doneN = 0;
    const fin = () => {
      if (++doneN < 2) return;
      $("#mA").textContent = `串线主题 ${topicsHit(ansA).length}/6 · 与低温基准一致`;
      $("#mB").textContent = `串线主题 ${topicsHit(ansB).length}/6 · 混入「${topicsHit(ansB).map(t => t.name).join("、") || "—"}」的记忆`;
      $("#storyPunch").hidden = false;
      $("#storyNext").style.display = "inline-block";
      $("#storyPlay").textContent = "↻ 重播";
      storyStarted = false;
    };
    typeInto($("#fA"), ansA, 17, fin);
    typeInto($("#fB"), ansB, 17, fin);
  };
  $("#storyNext").onclick = () => $$(".tab")[1].click();

  /* ==================================================
   * ② 玩具：拖温度，看串线
   * ================================================== */
  let seed = 7, genCount = 0;
  function chipRow(hit) {
    $("#tChips").innerHTML = TOPICS.map(t =>
      `<span class="chip${hit.includes(t) ? " hit" : ""}">${t.name}</span>`).join("");
  }
  function renderCands(top) {
    const mx = Math.max(...top.map(c => c.p));
    $("#tCands").innerHTML = top.map(c =>
      `<div class="cand">
        <span class="ch">${esc(c.ch)}</span>
        <span class="bar"><i style="width:${(c.p / mx * 100).toFixed(1)}%"></i></span>
        <span class="pv">${(c.p * 100).toFixed(1)}%</span>
      </div>`).join("");
  }
  function toyGen() {
    if (!LM) return;   /* 引擎后台建模中，等开机首绘 */
    fill($("#tTemp"));
    $("#tTempV").textContent = (+$("#tTemp").value).toFixed(2);
    const prompt = $("#tPrompt").value, T = +$("#tTemp").value;
    const r = getLM().generate({ prompt, len: 110, temperature: T, seed });
    const hit = topicsHit(r.text);
    $("#tOut").innerHTML = `<span class="body"></span><span class="caret"></span>`;
    typeInto($("#tOut"), r.text, 10, () => {
      renderCands(r.lastTop);
      chipRow(hit);
      $("#tMeta").textContent = `T=${T.toFixed(2)} · seed=${seed} · 串线 ${hit.length}/6`;
      if (++genCount >= 2) $("#quizToy").style.display = "";
    });
  }
  $("#tGo").onclick = toyGen;
  $("#tSeed").onclick = () => { seed = (Math.random() * 1e6) | 0; toyGen(); };
  $("#tTemp").addEventListener("input", () => { fill($("#tTemp")); $("#tTempV").textContent = (+$("#tTemp").value).toFixed(2); });
  $("#tPrompt").addEventListener("change", toyGen);
  chipRow([]);

  /* ==================================================
   * ③ 硬核：问三遍 + 温度扫描
   * ================================================== */
  function hardThree() {
    if (!LM) return;   /* 引擎后台建模中，等开机首绘 */
    fill($("#hTemp"));
    $("#hTempV").textContent = (+$("#hTemp").value).toFixed(2);
    const prompt = $("#hPrompt").value, T = +$("#hTemp").value;
    const texts = [0, 1, 2].map(i => getLM().generate({ prompt, len: 84, temperature: T, seed: 1000 + i * 17 }).text);
    [$("#h1"), $("#h2"), $("#h3")].forEach((el, i) => el.textContent = texts[i]);
    const sim = (jaccard(texts[0], texts[1]) + jaccard(texts[0], texts[2]) + jaccard(texts[1], texts[2])) / 3;
    const mix = Math.max(...texts.map(t => topicsHit(t).length));
    $("#hSim").textContent = (sim * 100).toFixed(0) + "%";
    $("#hMix").textContent = mix + " / 6";
    const l = $("#hLamp"), v = $("#hVerdict"), rd = $("#hRead");
    if (sim > 0.85) { l.className = "lamp g"; rd.textContent = "三遍几乎一样"; v.innerHTML = `<b style="color:var(--gn)">可复现</b> — 像在背书，答案稳定（但也可能只是稳定地复读）`; }
    else if (sim > 0.45) { l.className = "lamp a"; rd.textContent = "有共同骨架"; v.innerHTML = `<b style="color:var(--am)">部分可复现</b> — 大方向在，细节在漂`; }
    else { l.className = "lamp r"; rd.textContent = "三遍各说各话"; v.innerHTML = `<b style="color:var(--rd)">不可复现</b> — T=${T.toFixed(2)} 下每一步都在掷骰子；问三遍是识破它的最快手段`; }
  }
  $("#hGo").onclick = hardThree;
  $("#hTemp").addEventListener("input", hardThree);
  $("#hPrompt").addEventListener("change", hardThree);

  function scan() {
    if (!LM) return;   /* 引擎后台建模中，等开机首绘 */
    const prompt = $("#hPrompt").value;
    const ref = getLM().generate({ prompt, len: 84, temperature: 0.1, seed: 500 }).text;
    const xs = [], sims = [], mixes = [];
    for (let i = 1; i <= 12; i++) {
      const T = +(i / 10).toFixed(1);
      const t = getLM().generate({ prompt, len: 84, temperature: T, seed: 500 + i * 13 }).text;
      xs.push(T); sims.push(jaccard(t, ref));
      mixes.push(topicsHit(t).length / 6);
    }
    const X0 = 58, X1 = 700, Y0 = 258, Y1 = 20;
    const gx = T => X0 + (T - 0.1) / 1.1 * (X1 - X0);
    const gy = v => Y0 - v * (Y0 - Y1);
    const path = arr => arr.map((v, i) => `${i ? "L" : "M"}${gx(xs[i]).toFixed(1)},${gy(v).toFixed(1)}`).join(" ");
    $("#hChart").innerHTML = `
      ${[0, .25, .5, .75, 1].map(v => `
        <line x1="${X0}" y1="${gy(v)}" x2="${X1}" y2="${gy(v)}" stroke="#161d29"/>
        <text x="${X0 - 8}" y="${gy(v) + 3}" fill="#9d9486" font-size="10" text-anchor="end">${v * 100}%</text>`).join("")}
      ${xs.filter((_, i) => i % 2 === 0).map(T => `
        <line x1="${gx(T)}" y1="${Y0}" x2="${gx(T)}" y2="${Y1}" stroke="#121926"/>
        <text x="${gx(T)}" y="${Y0 + 16}" fill="#9d9486" font-size="10" text-anchor="middle">${T}</text>`).join("")}
      <text x="${(X0 + X1) / 2}" y="${Y0 + 34}" fill="#6d6659" font-size="11" text-anchor="middle">采样温度 T</text>
      <path d="${path(sims)}" fill="none" stroke="#0e7f9c" stroke-width="2.2" style="filter:drop-shadow(0 0 5px rgba(14,127,156,.4))"/>
      <path d="${path(mixes)}" fill="none" stroke="#b0741c" stroke-width="2.2" style="filter:drop-shadow(0 0 5px rgba(176,116,28,.35))"/>
      ${xs.map((T, i) => `<circle cx="${gx(T)}" cy="${gy(sims[i])}" r="3" fill="#0e7f9c"/>
        <circle cx="${gx(T)}" cy="${gy(mixes[i])}" r="3" fill="#b0741c"/>`).join("")}`;
  }

  /* ==================================================
   * 通关题（两处同题，任一答对即点亮）
   * ================================================== */
  const QUIZ = {
    q: "同一个问题问模型三遍，得到三个明显不同的答案。最可能的原因是？",
    opts: [["模型坏掉了，需要重新训练", false],
           ["采样温度大于 0：每一步生成都在掷骰子", true],
           ["训练数据不够多", false],
           ["答案其实一样，是显示出了错", false]],
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
    try { parent.postMessage({ type: "tlab:clear", module: "m3" }, "*"); } catch {}
    try {
      const s = JSON.parse(localStorage.getItem("tlab.v1") || "{}");
      s.got = s.got || {};
      if (!s.got.m3) { s.got.m3 = Date.now(); localStorage.setItem("tlab.v1", JSON.stringify(s)); }
    } catch {}
    [["#quizRes", "#confetti"], ["#quizRes2", "#confetti2"]].forEach(([r, cf]) => {
      const box = $(r);
      box.querySelector(".lamp").className = "lamp g";
      box.querySelector("span:last-child").innerHTML =
        "答对了 — <b style='color:var(--gn)'>图鉴第 3 张已点亮 ✓</b>，回博物馆看看你的收藏。";
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

  /* ---------- 开机：LM 后台建好后由 setTimeout 首绘，此处不再同步跑 ---------- */
})();
</script>
