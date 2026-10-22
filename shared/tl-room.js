/* ============================================================
   tl-room.js — 舱室外壳运行时
   职责：视口锁定 class、HUD、键盘切层(1/2/3 · ←→)、Esc 回大厅。
   不重绑层切换——复用页面既有的 .tab 点击逻辑。
   ============================================================ */
(function () {
  "use strict";
  const cfg = Object.assign(
    { room: "展台", accent: "#57c7ff", rail: "top", anim: "zoom" },
    window.TLROOM || {}
  );
  const b = document.body;
  b.classList.add("tlroom");
  b.dataset.anim = cfg.anim;
  b.dataset.rail = cfg.rail;
  b.style.setProperty("--room-accent", cfg.accent);

  /* ---- HUD（房名 + 层指示点 + 当前层名） ---- */
  const tabs = [...document.querySelectorAll(".tab")];
  if (!tabs.length) return;
  const layerName = t => {
    const tt = t.querySelector(".tt");
    return tt ? tt.textContent.trim() : "";
  };
  const hud = document.createElement("div");
  hud.className = "roomhud";
  hud.innerHTML = `<b>${cfg.room}</b><span class="hl-dots">${tabs.map(() => "<i></i>").join("")}</span><span class="hl-step">—</span>`;
  document.body.appendChild(hud);
  const dots = [...hud.querySelectorAll(".hl-dots i")];
  function paintHud() {
    const i = tabs.findIndex(t => t.classList.contains("on"));
    if (i < 0) return;
    dots.forEach((d, k) => d.classList.toggle("on", k === i));
    hud.querySelector(".hl-step").textContent = `${i + 1}/${tabs.length} · ${layerName(tabs[i])}`;
  }
  const mo = new MutationObserver(paintHud);
  document.querySelectorAll(".layer").forEach(l => mo.observe(l, { attributes: true, attributeFilter: ["class"] }));
  paintHud();

  /* ---- 键盘：1/2/3 直达层，←→ 轮转，Esc 回大厅 ---- */
  function typing() {
    const t = (document.activeElement || {}).tagName;
    return t === "INPUT" || t === "TEXTAREA" || (document.activeElement && document.activeElement.isContentEditable);
  }
  function back() {
    if (window.parent !== window) parent.postMessage({ type: "tlab:back" }, "*");
    else location.href = "index.html";
  }
  addEventListener("keydown", e => {
    if (typing()) return;
    /* 内嵌工作台全屏中：所有房间快捷键让位（Esc 交给工具栏处理器退出全屏，
       方向键交给工作台内部切章），避免误触「Esc 回大厅」把整页导航走 */
    if (document.body.classList.contains("tl-fslock")) return;
    if (e.key === "Escape") { back(); return; }
    const go = t => { if (t) { t.click(); paintHud(); } };
    if (/^[1-9]$/.test(e.key) && +e.key <= tabs.length) { go(tabs[+e.key - 1]); return; }
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      const i = tabs.findIndex(t => t.classList.contains("on"));
      const j = (i + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
      go(tabs[j]);
    }
  });

  /* ---- 「回博物馆」链接：舱室内改为向大厅发消息关舱室 ---- */
  const backLink = document.querySelector(".topbar a.back, a.back");
  if (backLink) backLink.addEventListener("click", e => {
    if (window.parent !== window) { e.preventDefault(); back(); }
  });

  /* ---- 大厅背景贯穿：读取 tlab.bg 应用 GL 场景，storage/postMessage 实时同步
          （GL 引擎异步自举：booting 期间先排队，就绪后回调接线） ---- */
  const BG = window.TLBG;
  if (BG) {
    let bgWired = false;
    const wireRoomBg = () => {
      if (bgWired || !BG.supported) return;
      bgWired = true;
      function applyRoomBg() {
        const id = localStorage.getItem("tlab.bg") || "def";
        if (id === "def") {
          BG.apply("def");
          document.body.style.background = "";
        } else {
          document.body.style.background = "transparent";
          BG.apply(id);
        }
      }
      applyRoomBg();
      addEventListener("storage", e => { if (e.key === "tlab.bg") applyRoomBg(); });
      addEventListener("message", e => {
        if (e.data && e.data.type === "tlab:bg") {
          try { localStorage.setItem("tlab.bg", e.data.id); } catch {}
          applyRoomBg();
        }
      });
    };
    if (BG.booting) BG.onReady(wireRoomBg); else wireRoomBg();
  }

  /* ---- 导游气泡：贯穿全程，随层换词，可切换（与大厅共享选择） ---- */
  const G = window.TLGUIDES || {};
  if (G.order) {
    const KEY = "tlab.guide";
    let cur = localStorage.getItem(KEY) || "wu";
    if (!G[cur]) cur = "wu";
    let gi = 0, gTimer = null, gFold = false;
    const bub = document.createElement("div");
    bub.className = "rguide";
    bub.innerHTML = `
      <div class="rg-face">
        ${G.order.map(id => `<button class="rgf${id === cur ? " on" : ""}" data-g="${id}" title="${G[id].name}（${G[id].tag}）">${G[id].face}</button>`).join("")}
        <b class="rg-who" id="rgWho"></b>
        <button class="rg-fold" title="收起/展开">–</button>
      </div>
      <div class="rg-say" id="rgSay"></div>`;
    document.body.appendChild(bub);
    const sayEl = bub.querySelector("#rgSay"), whoEl = bub.querySelector("#rg-who") || bub.querySelector(".rg-who");

    function layerKey() {
      const i = tabs.findIndex(t => t.classList.contains("on"));
      return ["story", "toy", "hard"][i] || "story";
    }
    function paint() {
      const g = G[cur];
      whoEl.textContent = `${g.name}（${g.tag}）`;
      const sig = cfg.guides && cfg.guides[cur];
      const pool = [];
      if (sig) pool.push(sig);
      (g.room && g.room[layerKey()] || []).forEach(l => pool.push(l));
      sayEl.textContent = pool[gi % pool.length];
      gi++;
    }
    function rotate() {
      clearTimeout(gTimer);
      gTimer = setTimeout(() => { if (!gFold) paint(); rotate(); }, 13000);
    }
    bub.querySelectorAll(".rgf").forEach(btn => btn.addEventListener("click", () => {
      cur = btn.dataset.g;
      localStorage.setItem(KEY, cur);
      bub.querySelectorAll(".rgf").forEach(x => x.classList.toggle("on", x.dataset.g === cur));
      gi = 0; paint();
    }));
    bub.querySelector(".rg-fold").addEventListener("click", e => {
      gFold = !gFold;
      bub.classList.toggle("fold", gFold);
      e.target.textContent = gFold ? "+" : "–";
    });
    /* 切层时立即换词 */
    document.querySelectorAll(".layer").forEach(l => new MutationObserver(() => { gi = 0; paint(); })
      .observe(l, { attributes: true, attributeFilter: ["class"] }));
    paint();
    rotate();
  }
})();

/* ============================================================
 * 内嵌工作台工具栏 + 影院全屏（m1/m2 硬核层 iframe）
 *  - iframe 由各展品自己的 04-app.js 懒加载插入 #frameBox
 *  - 这里用 MutationObserver 感知 iframe 出现后显示工具栏，
 *    与各展品的加载时机解耦（点 tab 自动加载 / 点按钮加载都覆盖）
 *  - 全屏：优先原生 Fullscreen API，失败/被禁则回落「影院模式」
 *    （把内嵌框铺满视口，Esc 或 ✕ 退出）
 * ============================================================ */
(function () {
  const FB = document.querySelector("#frameBox");
  const BAR = document.querySelector("#frameBar");
  if (!FB || !BAR) return;
  const btnFs = BAR.querySelector(".fbtn-fs");
  const btnEx = BAR.querySelector(".fbtn-exit");
  const btnRl = BAR.querySelector(".fbtn-reload");
  let fsing = false;
  let fbHome = null, fbNext = null, barHome = null, barNext = null;

  function fsOn() {
    /* 关键：卡片带着入场动画留下的 transform（哪怕单位矩阵）会成为 fixed 的
       包含块，导致全屏框被钉死在卡片内。故进入全屏时把框与工具栏整体迁到
       body 下，退出时按原 nextSibling 精确搬回。 */
    if (FB.parentNode !== document.body) {
      fbHome = FB.parentNode; fbNext = FB.nextSibling;
      barHome = BAR.parentNode; barNext = BAR.nextSibling;
      document.body.appendChild(FB);
      document.body.appendChild(BAR);
    }
    document.body.classList.add("tl-fslock");
    FB.classList.add("fs");
    BAR.classList.add("fs");
    if (btnEx) btnEx.hidden = false;
    if (btnFs) btnFs.hidden = true;
  }
  function fsOff() {
    if (window.parent !== window) {
      try { parent.postMessage({ type: "tlab:fs", on: false }, "*"); } catch {}
    }
    document.body.classList.remove("tl-fslock");
    FB.classList.remove("fs");
    BAR.classList.remove("fs");
    if (btnEx) btnEx.hidden = true;
    if (btnFs) btnFs.hidden = false;
    try {
      if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen();
    } catch {}
    /* 搬回原位（先工具栏后展示框，保证插入顺序正确） */
    if (barHome) {
      if (barNext && barNext.parentNode === barHome) barHome.insertBefore(BAR, barNext);
      else barHome.appendChild(BAR);
    }
    if (fbHome) {
      if (fbNext && fbNext.parentNode === fbHome) fbHome.insertBefore(FB, fbNext);
      else fbHome.appendChild(FB);
    }
    fbHome = barHome = null;
  }
  /* iframe 出现 → 显示工具栏（只观察一次） */
  const mo = new MutationObserver(() => {
    if (FB.querySelector("iframe")) { BAR.hidden = false; mo.disconnect(); }
  });
  mo.observe(FB, { childList: true });
  if (btnFs) btnFs.addEventListener("click", () => {
    if (fsing) return;
    fsing = true;
    fsOn();
    /* 顶层页面：影院模式本身就铺满真实视口，且工具栏留在视野内（✕ 可点）。
       嵌在博物馆 iframe 里时，影院模式最多只能铺满 iframe——必须请父窗口
       把本页 iframe 全屏，才能真正铺满视口。 */
    if (window.parent !== window) {
      try { parent.postMessage({ type: "tlab:fs", on: true }, "*"); } catch {}
    }
  });
  if (btnEx) btnEx.addEventListener("click", () => { fsing = false; fsOff(); });
  if (btnRl) btnRl.addEventListener("click", () => {
    const f = FB.querySelector("iframe");
    if (!f) return;
    const src = f.getAttribute("src");
    f.setAttribute("src", "about:blank");
    setTimeout(() => f.setAttribute("src", src), 60);
  });
  addEventListener("keydown", e => { if (e.key === "Escape" && fsing) { fsing = false; fsOff(); } });
  /* 父窗口退出全屏（Esc / 系统手势）后，同步收掉影院模式 */
  addEventListener("message", e => {
    const d = e.data;
    if (d && d.type === "tlab:fs:sync" && d.on === false && fsing) { fsing = false; fsOff(); }
  });
})();
