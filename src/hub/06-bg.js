<script>
/* ============================================================
   06-bg.js — 12 种博物馆厅堂背景（双引擎）
   WebGL 可用 → shared/tl-bg-gl.js 程序化厅堂场景（真·缩略图）
   WebGL 不可用 → 本文件内置 CSS 图层方案兜底（纯渐变 + 颗粒 + 暗角）
   ============================================================ */
(function () {
  "use strict";
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const { SND, toast } = window.THub;
  const GL = window.TLBG || { supported: false };

  const VIG = '<div class="bgm-vig"></div><div class="bgm-grain"></div>';

  const BGS = [
    { id: "def", name: "馆内原色", tag: "默认 · 极简展馆",
      base: "#f5f1e7 radial-gradient(ellipse 1000px 560px at 50% -100px,rgba(14,127,156,.06),transparent)",
      thumb: "radial-gradient(ellipse 70% 60% at 50% 0%,rgba(14,127,156,.16),transparent 70%),#f5f1e7",
      scene: "" },

    /* 1 金碧辉煌 */
    { id: "jinbi", name: "金碧辉煌", tag: "金箔穹顶 · 红毯 · 吊灯",
      base: "radial-gradient(ellipse 900px 520px at 50% 8%,rgba(255,226,172,.62),transparent 62%)," +
            "radial-gradient(ellipse 620px 420px at 50% 104%,rgba(206,92,74,.32),transparent 66%)," +
            "linear-gradient(180deg,#f8f0de,#e8dbc2)",
      thumb: "radial-gradient(circle 26px at 50% 14%,rgba(255,238,196,.95),transparent 70%)," +
             "linear-gradient(180deg,#ecd8ac,#c9a86c 55%,#b8624c)",
      scene: VIG },

    /* 2 古典穹顶 */
    { id: "gudian", name: "古典穹顶", tag: "石柱环廊 · 天窗光柱",
      base: "radial-gradient(circle 420px at 50% 2%,rgba(255,255,255,.92),transparent 62%)," +
            "radial-gradient(ellipse 700px 500px at 50% 92%,rgba(168,180,198,.30),transparent 70%)," +
            "linear-gradient(180deg,#eef1f5,#d4d9e2)",
      thumb: "radial-gradient(circle 22px at 50% 6%,#ffffff,transparent 70%)," +
             "linear-gradient(180deg,#e2e7ee,#b6bfcd)",
      scene: VIG },

    /* 3 复古画廊 */
    { id: "fugu", name: "复古画廊", tag: "木饰面 · 镀金画框 · 壁灯",
      base: "radial-gradient(ellipse 780px 460px at 50% 22%,rgba(216,172,116,.40),transparent 64%)," +
            "radial-gradient(ellipse 560px 380px at 50% 100%,rgba(150,96,52,.30),transparent 68%)," +
            "linear-gradient(180deg,#f0e2ce,#d6c0a2)",
      thumb: "radial-gradient(circle 14px at 24% 44%,rgba(255,216,152,.88),transparent 66%)," +
             "radial-gradient(circle 14px at 76% 44%,rgba(255,216,152,.80),transparent 66%)," +
             "linear-gradient(180deg,#cbaa7a,#8a6238)",
      scene: VIG },

    /* 4 梦幻云厅 */
    { id: "menghuan", name: "梦幻云厅", tag: "玻璃天窗 · 漂浮光球",
      base: "radial-gradient(ellipse 820px 500px at 50% 6%,rgba(228,222,255,.78),transparent 64%)," +
            "radial-gradient(ellipse 620px 420px at 50% 100%,rgba(168,158,220,.34),transparent 68%)," +
            "linear-gradient(180deg,#eae7f7,#cec9e5)",
      thumb: "radial-gradient(circle 20px at 50% 18%,rgba(255,255,255,.95),transparent 70%)," +
             "linear-gradient(180deg,#dbd6f0,#a8a1cc)",
      scene: VIG },

    /* 5 水墨长卷 */
    { id: "shuimo", name: "水墨长卷", tag: "宣纸立轴 · 淡墨远山 · 朱印",
      base: "radial-gradient(ellipse 760px 460px at 50% 44%,rgba(255,255,255,.80),transparent 66%)," +
            "linear-gradient(180deg,#ddd9d1,#c4bfb4)",
      thumb: "linear-gradient(180deg,#f0ede7 0%,#f0ede7 60%,#dcd7cc 60%,#c8c2b5)",
      scene: VIG },

    /* 6 未来白盒 */
    { id: "baihe", name: "未来白盒", tag: "LED 灯带 · 发光展台",
      base: "radial-gradient(ellipse 760px 520px at 50% 0%,rgba(255,255,255,.96),transparent 70%)," +
            "linear-gradient(180deg,#f3f5f8,#dde1e7)",
      thumb: "radial-gradient(circle 24px at 50% 10%,#ffffff,transparent 72%)," +
             "linear-gradient(180deg,#f0f3f7,#cbd1da)",
      scene: VIG },

    /* 7 深海展厅 */
    { id: "shenhai", name: "深海展厅", tag: "水族展窗 · 焦散 · 光柱",
      base: "radial-gradient(ellipse 820px 520px at 62% 30%,rgba(152,224,234,.58),transparent 66%)," +
            "radial-gradient(ellipse 620px 420px at 50% 104%,rgba(96,168,180,.32),transparent 68%)," +
            "linear-gradient(180deg,#e8f3f4,#c5dcdf)",
      thumb: "radial-gradient(circle 26px at 62% 24%,rgba(214,250,253,.95),transparent 70%)," +
             "linear-gradient(180deg,#d2ecf0,#8fc4cb)",
      scene: VIG },

    /* 8 星空穹幕 */
    { id: "xingkong", name: "星空穹幕", tag: "球幕星图 · 星座连线 · 座椅",
      base: "radial-gradient(circle 460px at 50% -6%,rgba(255,255,255,.78),transparent 62%)," +
            "linear-gradient(180deg,#d2dcec,#a9b7d1)",
      thumb: "radial-gradient(1.5px 1.5px at 30% 24%,#5b6b8c,transparent)," +
             "radial-gradient(1.5px 1.5px at 64% 36%,#7b8bab,transparent)," +
             "radial-gradient(circle 20px at 50% 8%,#ffffff,transparent 68%)," +
             "linear-gradient(180deg,#bcc9de,#8d9bbb)",
      scene: VIG },

    /* 9 青铜古殿 */
    { id: "qingtong", name: "青铜古殿", tag: "铜绿浮雕 · 火把 · 沙尘",
      base: "radial-gradient(ellipse 800px 500px at 50% 10%,rgba(228,200,152,.46),transparent 64%)," +
            "radial-gradient(ellipse 600px 420px at 50% 104%,rgba(96,132,116,.30),transparent 68%)," +
            "linear-gradient(180deg,#e8dec8,#c1af91)",
      thumb: "radial-gradient(circle 12px at 20% 50%,rgba(255,224,164,.85),transparent 70%)," +
             "radial-gradient(circle 12px at 80% 50%,rgba(255,224,164,.75),transparent 70%)," +
             "linear-gradient(180deg,#ab8f64,#6f6046)",
      scene: VIG },

    /* 10 玻璃温室 */
    { id: "wenshi", name: "玻璃温室", tag: "玻璃格天窗 · 藤蔓 · 挂灯",
      base: "radial-gradient(ellipse 820px 520px at 50% 0%,rgba(240,255,234,.88),transparent 66%)," +
            "radial-gradient(ellipse 620px 420px at 50% 104%,rgba(120,168,110,.28),transparent 68%)," +
            "linear-gradient(180deg,#eaf3e5,#c8dbc0)",
      thumb: "radial-gradient(circle 22px at 50% 8%,#ffffff,transparent 70%)," +
             "linear-gradient(180deg,#deedd6,#a6c59a)",
      scene: VIG },

    /* 11 赛博展柜 */
    { id: "saibo", name: "赛博展柜", tag: "全息展柜 · 霓虹边光",
      base: "radial-gradient(ellipse 760px 500px at 26% 30%,rgba(122,212,255,.44),transparent 62%)," +
            "radial-gradient(ellipse 700px 480px at 76% 34%,rgba(255,122,200,.38),transparent 64%)," +
            "linear-gradient(180deg,#eff3f9,#ccd6e4)",
      thumb: "radial-gradient(circle 20px at 30% 30%,rgba(142,226,255,.95),transparent 70%)," +
             "radial-gradient(circle 20px at 72% 34%,rgba(255,142,215,.95),transparent 70%)," +
             "linear-gradient(180deg,#e6edf6,#b7c2d5)",
      scene: VIG },

    /* 12 夜巡长廊 */
    { id: "yexun", name: "夜巡长廊", tag: "一束顶光 · 一幅画 · 尘埃",
      base: "radial-gradient(ellipse 780px 480px at 50% 12%,rgba(255,234,190,.58),transparent 64%)," +
            "radial-gradient(ellipse 620px 420px at 50% 104%,rgba(150,116,78,.28),transparent 68%)," +
            "linear-gradient(180deg,#f3e9d8,#d7c6aa)",
      thumb: "radial-gradient(circle 16px at 50% 12%,rgba(255,240,200,.92),transparent 70%)," +
             "linear-gradient(180deg,#dfcba8,#a98d64)",
      scene: VIG },
  ];

  const bgScrim = $("#bgScrim");
  let glThumbs = null;

  function applyBg(id) {
    const b = BGS.find(x => x.id === id) || BGS[0];
    document.body.style.background = b.base;
    if (GL.supported || GL.booting) {
      /* GL 就绪或自举中：走 GL 路径（booting 时场景入队，就绪后自动补播） */
      $("#bgStage").innerHTML = "";
      GL.apply(b.id);
    } else {
      $("#bgStage").innerHTML = b.scene || "";
    }
    localStorage.setItem("tlab.bg", id);
    $$("#bgGrid .bgopt").forEach(o => o.classList.toggle("on", o.dataset.bg === b.id));
    /* 同步到打开中的舱室（postMessage 直达，storage 事件兜底其他标签页） */
    try {
      const f = window.THub.roomFrame && window.THub.roomFrame();
      if (f && f.contentWindow) f.contentWindow.postMessage({ type: "tlab:bg", id: b.id }, "*");
    } catch {}
  }
  function renderBgs() {
    const grid = $("#bgGrid"); grid.innerHTML = "";
    /* 空结果不缓存：GL 自举未完成时下次打开会重试 */
    const empty = !glThumbs || !Object.keys(glThumbs).length;
    if (GL.supported && empty) { try { glThumbs = GL.thumbs(168, 104) || {}; } catch { glThumbs = {}; } }
    BGS.forEach(b => {
      const btn = document.createElement("button");
      btn.className = "bgopt";
      btn.dataset.bg = b.id;
      btn.title = b.tag;
      /* GL 真缩略图用 background-image 显式声明；CSS 兜底才用 background 简写 */
      const hasGL = !!(GL.supported && glThumbs && glThumbs[b.id]);
      const th = hasGL
        ? `background-image:url(${glThumbs[b.id]});background-size:cover;background-position:center`
        : `background:${b.thumb}`;
      btn.innerHTML = `<span class="th" style="${th}"></span><span class="lb">${b.name}<i>${b.tag}</i></span>`;
      btn.addEventListener("click", () => { SND.click(); applyBg(b.id); toast(`厅堂氛围已切换 · ${b.name}`, "🎨"); });
      grid.appendChild(btn);
    });
  }
  $("#bgBtn").addEventListener("click", () => { SND.click(); renderBgs(); bgScrim.classList.add("on"); });
  bgScrim.addEventListener("click", e => { if (e.target === bgScrim) { SND.click(); bgScrim.classList.remove("on"); } });
  applyBg(localStorage.getItem("tlab.bg") || "def");
})();
</script>
