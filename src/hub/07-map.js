<script>
/* ============================================================
 * 07-map · 博物馆场馆地图 v2（零依赖 SVG 等距建模）
 *  - 全馆总览：中央穹顶大厅 + 三翼展馆（A/B/C），参观动线、信标、进度
 *  - 展馆内部：等距楼层平面，展品为独立小馆（编号/图标/铭牌/识破钢印）
 *  - 导游带队：馆内化身立于中庭；自动导览沿 A→B→C 巡馆
 *  - 对外 API：window.TLMAP = { focus(zk), home(), isOpen(), highlight(mid), paint(), tour() }
 * ============================================================ */
(function () {
  "use strict";
  const H = window.THub;
  if (!H || !H.MODULES || !H.ZONES) return;
  const MODULES = H.MODULES, ZONES = H.ZONES;
  const ZK = Object.keys(ZONES);

  /* ---------- 颜色工具 ---------- */
  function h2r(h) {
    h = String(h).replace("#", "");
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  function r2h(a) {
    return "#" + a.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
  }
  function mix(a, b, t) { const A = h2r(a), B = h2r(b); return r2h([0, 1, 2].map(i => A[i] + (B[i] - A[i]) * t)); }
  function al(c, a) { const A = h2r(c); return "rgba(" + A[0] + "," + A[1] + "," + A[2] + "," + a + ")"; }

  /* ---------- 注入样式 ---------- */
  const css = `
.mapwrap{position:absolute;inset:0;z-index:10;overflow:hidden}
/* 纸色薄纱：让背景厅堂透出来，但地图区域保持可读 */
.mapwrap::before{content:"";position:absolute;inset:0;pointer-events:none;
  background:radial-gradient(ellipse 66% 70% at 50% 58%,rgba(248,244,235,.94),rgba(248,244,235,.72) 58%,rgba(248,244,235,.16) 100%)}
.mapwrap svg{position:absolute;inset:0;width:100%;height:100%}
.mapwrap text{user-select:none}
.mono{font-family:var(--mono)}
.serif{font-family:'SerifSC','Noto Serif SC',serif;font-weight:900;letter-spacing:2px}
/* 信标呼吸 */
@keyframes mapPulse{0%,100%{opacity:.22;transform:scale(.7)}50%{opacity:.85;transform:scale(1.3)}}
.mring{transform-box:fill-box;transform-origin:center;animation:mapPulse 2.8s ease-in-out infinite}
/* 路径流光 */
@keyframes mapDash{to{stroke-dashoffset:-46}}
.mpath{stroke-dasharray:2 9;animation:mapDash 1.6s linear infinite}
/* 悬浮招牌 / 导游化身 */
@keyframes mapFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
.mfloat{animation:mapFloat 3.4s ease-in-out infinite;transform-box:fill-box}
@keyframes mapBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
.mbob{animation:mapBob 2.4s ease-in-out infinite;transform-box:fill-box}
/* 尘埃微粒 */
@keyframes mapTw{0%,100%{opacity:.08}50%{opacity:.8}}
.mtw{animation:mapTw 5.4s ease-in-out infinite}
/* 扫光 */
@keyframes mapSweep{from{transform:translateX(-360px) skewX(-24deg)}to{transform:translateX(1600px) skewX(-24deg)}}
.msweep{animation:mapSweep 11s linear infinite}
/* 旋转虚线环 */
@keyframes mapSpin{to{transform:rotate(360deg)}}
.mspin{transform-box:fill-box;transform-origin:center;animation:mapSpin 26s linear infinite}
@keyframes mapSpinR{to{transform:rotate(-360deg)}}
.mspinr{transform-box:fill-box;transform-origin:center;animation:mapSpinR 38s linear infinite}
/* 展馆交互 */
.mwing{cursor:pointer;transition:transform .45s cubic-bezier(.25,1.3,.5,1),filter .4s;transform-box:fill-box}
.mwing:hover{transform:translateY(-10px);filter:drop-shadow(0 16px 26px rgba(140,118,80,.14))}
.mwing .mhover{opacity:0;transition:opacity .4s}
.mwing:hover .mhover{opacity:1}
.mroom{cursor:pointer;transition:transform .4s cubic-bezier(.25,1.3,.5,1);transform-box:fill-box}
.mroom:hover{transform:translateY(-8px)}
.mroom .mhover{opacity:0;transition:opacity .35s}
.mroom:hover .mhover{opacity:1}
/* 抽中考高亮 */
@keyframes mapHL{0%,100%{filter:drop-shadow(0 0 0 rgba(176,116,28,0))}50%{filter:drop-shadow(0 0 16px rgba(176,116,28,.85))}}
.mroom.hl{animation:mapHL 1s ease-in-out 3}
/* 视图切换 */
#gHome{transition:transform .78s cubic-bezier(.3,1,.4,1),opacity .5s ease}
#gWing{opacity:0;transform:translateY(26px) scale(.965);transition:opacity .5s ease,transform .6s cubic-bezier(.25,1.2,.5,1);pointer-events:none}
#gWing.on{opacity:1;transform:none;pointer-events:auto}
/* 顶部展馆信息条 */
.map-head{position:absolute;top:14px;left:50%;transform:translateX(-50%);z-index:14;display:flex;align-items:center;gap:12px;
  background:linear-gradient(160deg,rgba(255,253,248,.95),rgba(248,241,229,.92));border:1px solid var(--line);border-radius:13px;
  padding:8px 16px;backdrop-filter:blur(12px);opacity:0;pointer-events:none;transition:all .45s cubic-bezier(.25,1.2,.5,1);white-space:nowrap;
  box-shadow:0 14px 40px -14px rgba(140,118,80,.22);max-width:calc(100% - 32px)}
.map-head.on{opacity:1;pointer-events:auto;transform:translateX(-50%) translateY(0)}
.map-head .mh-z{font-family:var(--mono);font-size:11px;border:1px solid;border-radius:6px;padding:2px 8px;flex:none}
.map-head .mh-n{font-size:16px;letter-spacing:2px;flex:none}
.map-head .mh-q{font-size:11px;color:var(--tx2);max-width:400px;overflow:hidden;text-overflow:ellipsis}
.map-back{cursor:pointer;border:1px solid var(--line);background:rgba(120,100,66,.06);color:var(--tx2);border-radius:8px;
  padding:6px 11px;font-size:12px;font-family:inherit;transition:all .18s;flex:none}
.map-back:hover{color:var(--tx);border-color:#cbbfa9}
/* 底部信息条 */
.map-tip{position:absolute;left:50%;bottom:14px;transform:translateX(-50%);z-index:14;width:min(880px,94%);
  display:flex;align-items:center;gap:10px;background:linear-gradient(160deg,rgba(255,253,248,.94),rgba(248,241,229,.90));
  border:1px solid var(--line);border-radius:12px;padding:9px 16px;font-size:12px;color:var(--tx2);
  backdrop-filter:blur(10px);transition:border-color .3s}
.map-tip .t-gi{font-size:20px;flex:none}
.map-tip b{color:var(--tx)}
.map-tip .t-one{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.map-tip .t-badges{display:flex;gap:5px;flex:none}
.map-tip .t-b{font-family:var(--mono);font-size:9.5px;border:1px solid var(--line);border-radius:4px;padding:1px 6px;color:var(--tx3)}
.map-tip .t-b.on{color:var(--cy);border-color:rgba(14,127,156,.4)}
.map-tip .t-acc{flex:none;font-size:10.5px;color:var(--tx3);max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
/* 识破钢印 */
.mroom .m-seal{opacity:0;transition:opacity .4s}
.mroom.got .m-seal{opacity:1}
.mroom.got .m-lock{opacity:0}
.mroom .m-lock{transition:opacity .4s}
.mwing.done .m-neon{filter:drop-shadow(0 0 8px rgba(28,138,92,.95))}
@media(max-width:900px){.map-tip .t-acc{display:none}.map-head .mh-q{display:none}}
`;
  const styleEl = document.createElement("style");
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  /* ---------- 挂载 ---------- */
  const stage = document.getElementById("stage");
  if (!stage) return;
  const wrap = document.createElement("div");
  wrap.className = "mapwrap";
  wrap.id = "mapwrap";
  stage.appendChild(wrap);

  /* ---------- 场景常量 ---------- */
  const WING_POS = {
    A: { x: 262, y: 372, hw: 118, hd: 58, h: 94 },
    B: { x: 600, y: 214, hw: 132, hd: 64, h: 96 },
    C: { x: 938, y: 372, hw: 118, hd: 58, h: 94 },
  };
  const PLATE_Y = { A: 438, B: 288, C: 438 };
  const ROTO = { x: 600, y: 524, rx: 104, ry: 48, h: 58 };
  const PATHS = {
    A: `M ${ROTO.x - 78} ${ROTO.y - 16} Q 402 486 336 436`,
    B: `M ${ROTO.x} ${ROTO.y - 54} L ${ROTO.x} 338`,
    C: `M ${ROTO.x + 78} ${ROTO.y - 16} Q 798 486 864 436`,
  };

  /* ---------- 渐变 / 滤镜 ---------- */
  let defs = `
  <defs>
    <filter id="fGlow" x="-90%" y="-90%" width="280%" height="280%">
      <feGaussianBlur stdDeviation="4.5" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="fSoft" x="-70%" y="-70%" width="240%" height="240%">
      <feGaussianBlur stdDeviation="11"/>
    </filter>
    <filter id="fSoft2" x="-70%" y="-70%" width="240%" height="240%">
      <feGaussianBlur stdDeviation="4"/>
    </filter>
    <radialGradient id="gSkyWash" cx=".5" cy=".34" r=".62">
      <stop offset="0" stop-color="rgba(176,150,104,.14)"/>
      <stop offset=".55" stop-color="rgba(150,128,88,.05)"/>
      <stop offset="1" stop-color="rgba(0,0,0,0)"/>
    </radialGradient>
    <radialGradient id="gFloor" cx=".5" cy=".62" r=".6">
      <stop offset="0" stop-color="rgba(14,127,156,.09)"/>
      <stop offset=".6" stop-color="rgba(14,127,156,.03)"/>
      <stop offset="1" stop-color="rgba(87,199,255,0)"/>
    </radialGradient>
    <linearGradient id="gSweep" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="rgba(255,255,255,0)"/>
      <stop offset=".5" stop-color="rgba(255,255,255,.55)"/>
      <stop offset="1" stop-color="rgba(255,255,255,0)"/>
    </linearGradient>
    <linearGradient id="gDome" x1=".16" y1="0" x2=".84" y2="1">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset=".22" stop-color="#eef4fb"/>
      <stop offset=".5" stop-color="#dde7f1"/>
      <stop offset=".76" stop-color="#ccd9e7"/>
      <stop offset=".93" stop-color="#bccbdb"/>
      <stop offset="1" stop-color="#a9b8ca"/>
    </linearGradient>
    <linearGradient id="gWater" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="rgba(120,190,215,.35)"/>
      <stop offset=".5" stop-color="rgba(150,205,225,.22)"/>
      <stop offset="1" stop-color="rgba(180,220,235,.14)"/>
    </linearGradient>
    <radialGradient id="gHalo" cx=".5" cy=".5" r=".5">
      <stop offset="0" stop-color="rgba(176,150,104,.10)"/>
      <stop offset=".55" stop-color="rgba(176,150,104,.05)"/>
      <stop offset="1" stop-color="rgba(90,140,210,0)"/>
    </radialGradient>
    <linearGradient id="gDrum" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#efe6d4"/>
      <stop offset=".28" stop-color="#fbf5e8"/>
      <stop offset=".55" stop-color="#fffdf8"/>
      <stop offset=".82" stop-color="#f4ecdd"/>
      <stop offset="1" stop-color="#e7ddc9"/>
    </linearGradient>
    <linearGradient id="gCol" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#f2e9d9"/>
      <stop offset=".45" stop-color="#fffdf8"/>
      <stop offset="1" stop-color="#f2e9d9"/>
    </linearGradient>
    <linearGradient id="gDoor" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0" stop-color="rgba(240,205,140,.95)"/>
      <stop offset=".6" stop-color="rgba(228,180,100,.45)"/>
      <stop offset="1" stop-color="rgba(228,180,100,.10)"/>
    </linearGradient>
    <linearGradient id="gFloorPlane" x1=".1" y1="0" x2=".9" y2="1">
      <stop offset="0" stop-color="rgba(255,253,248,.99)"/>
      <stop offset=".5" stop-color="rgba(247,240,227,.99)"/>
      <stop offset="1" stop-color="rgba(238,229,212,.99)"/>
    </linearGradient>
    <clipPath id="cpWing"><polygon points="600,150 1088,398 600,646 112,398"/></clipPath>
  </defs>`;

  ZK.forEach(zk => {
    const c = ZONES[zk].c;
    defs += `
    <linearGradient id="gTop${zk}" x1=".1" y1="0" x2=".8" y2="1">
      <stop offset="0" stop-color="${mix("#fffdf8", c, .26)}"/>
      <stop offset=".55" stop-color="${mix("#f9f2e4", c, .17)}"/>
      <stop offset="1" stop-color="${mix("#f2e9d9", c, .11)}"/>
    </linearGradient>
    <linearGradient id="gL${zk}" x1="0" y1="0" x2="1" y2=".25">
      <stop offset="0" stop-color="${mix("#faf3e6", c, .17)}"/>
      <stop offset=".55" stop-color="${mix("#f0e7d6", c, .11)}"/>
      <stop offset="1" stop-color="#e4dac6"/>
    </linearGradient>
    <linearGradient id="gR${zk}" x1="1" y1="0" x2="0" y2=".25">
      <stop offset="0" stop-color="${mix("#fffdf8", c, .26)}"/>
      <stop offset=".55" stop-color="${mix("#f8f1e2", c, .16)}"/>
      <stop offset="1" stop-color="#e2d8c4"/>
    </linearGradient>
    <linearGradient id="gSky${zk}" x1=".2" y1="0" x2=".8" y2="1">
      <stop offset="0" stop-color="${al(c, .24)}"/>
      <stop offset=".5" stop-color="${al(c, .10)}"/>
      <stop offset="1" stop-color="${al(c, .04)}"/>
    </linearGradient>
    <radialGradient id="gPool${zk}" cx=".5" cy=".5" r=".5">
      <stop offset="0" stop-color="${al(c, .26)}"/>
      <stop offset=".55" stop-color="${al(c, .08)}"/>
      <stop offset="1" stop-color="${al(c, 0)}"/>
    </radialGradient>
    <radialGradient id="gBeacon${zk}" cx=".5" cy=".5" r=".5">
      <stop offset="0" stop-color="${c}" stop-opacity=".85"/>
      <stop offset=".4" stop-color="${c}" stop-opacity=".34"/>
      <stop offset="1" stop-color="${c}" stop-opacity="0"/>
    </radialGradient>`;
  });

  wrap.innerHTML = `
  <svg id="mapSvg" viewBox="0 0 1200 640" preserveAspectRatio="xMidYMid meet" aria-label="博物馆场馆地图">
    ${defs}
    <g id="gHome"></g>
    <g id="gWing"></g>
  </svg>
  <div class="map-head" id="mapHead">
    <button class="map-back" id="mapBack">← 返回全馆</button>
    <span class="mh-z" id="mhZ"></span>
    <span class="mh-n serif" id="mhN"></span>
    <span class="mh-q" id="mhQ"></span>
  </div>
  <div class="map-tip" id="mapTip"></div>`;

  const gHome = document.getElementById("gHome");
  const gWing = document.getElementById("gWing");
  const mapHead = document.getElementById("mapHead");
  const mapTip = document.getElementById("mapTip");

  /* ---------- 基础构件 ---------- */
  function box(cx, cy, hw, hd, h, zk) {
    /* 等距长方体：投影 → 左立面 → 右立面 → 顶面 → 霓虹棱线 */
    const z = ZONES[zk];
    const top = `${cx},${cy - hd - h} ${cx + hw},${cy - h} ${cx},${cy + hd - h} ${cx - hw},${cy - h}`;
    const left = `${cx - hw},${cy - h} ${cx},${cy + hd - h} ${cx},${cy + hd} ${cx - hw},${cy}`;
    const right = `${cx + hw},${cy - h} ${cx},${cy + hd - h} ${cx},${cy + hd} ${cx + hw},${cy}`;
    return `
    <ellipse cx="${cx}" cy="${cy + hd * .42}" rx="${hw * 1.5}" ry="${hd * 1.15}" fill="url(#gPool${zk})"/>
    <ellipse cx="${cx + 6}" cy="${cy + hd * .3}" rx="${hw * 1.15}" ry="${hd * .72}" fill="rgba(140,118,80,.14)" filter="url(#fSoft)"/>
    <polygon points="${left}" fill="url(#gL${zk})" stroke="${al(z.c, .10)}"/>
    <polygon points="${right}" fill="url(#gR${zk})" stroke="${al(z.c, .10)}"/>
    <polygon points="${top}" fill="url(#gTop${zk})" stroke="${al(z.c, .16)}"/>
    <polygon points="${top}" fill="none" stroke="${al(z.c, .72)}" stroke-width="1.5" class="m-neon"/>`;
  }
  /* 立面窗：沿 u 轴均布，按 (i,j) 伪随机点亮 */
  function faceWins(cx, cy, hw, hd, h, zk, side, cols, rows) {
    const c = ZONES[zk].c;
    const bw = .075, bh = .14;
    let s = "";
    const P = (u, v) => side < 0
      ? `${(cx - hw * (1 - u)).toFixed(1)},${(cy + hd * u - h * v).toFixed(1)}`
      : `${(cx + hw * (1 - u)).toFixed(1)},${(cy + hd * u - h * v).toFixed(1)}`;
    /* 竖向分格（幕墙竖梃） */
    for (let i = 0; i <= cols; i++) {
      const u = .10 + i * (.80 / cols);
      s += `<line x1="${(cx + (side < 0 ? -hw * (1 - u) : hw * (1 - u))).toFixed(1)}" y1="${(cy + hd * u).toFixed(1)}"
        x2="${(cx + (side < 0 ? -hw * (1 - u) : hw * (1 - u))).toFixed(1)}" y2="${(cy + hd * u - h).toFixed(1)}"
        stroke="${al(c, .07)}" stroke-width="1"/>`;
    }
    for (let i = 0; i < cols; i++) {
      const u0 = .10 + i * (.80 / cols), u1 = u0 + bw;
      for (let j = 0; j < rows; j++) {
        const v0 = .16 + j * .40, v1 = v0 + bh;
        const k = (i * 5 + j * 3 + (side > 0 ? 2 : 0)) % 6;
        const op = k === 0 ? .78 : k === 1 ? .12 : .26 + (k - 2) * .08;
        s += `<polygon points="${P(u0, v0)} ${P(u1, v0)} ${P(u1, v1)} ${P(u0, v1)}"
          fill="${c}" opacity="${op.toFixed(2)}" ${k === 0 ? 'class="mtw" style="animation-duration:4.4s"' : ""}/>`;
      }
    }
    return s;
  }
  function beacon(x, y, zk, r) {
    const c = ZONES[zk].c;
    return `<g>
      <line x1="${x}" y1="${y + 30}" x2="${x}" y2="${y}" stroke="${al(c, .45)}" stroke-width="1.8"/>
      <circle cx="${x}" cy="${y}" r="${(r || 26) * 2.2}" fill="url(#gBeacon${zk})" class="mring"/>
      <circle cx="${x}" cy="${y}" r="4.5" fill="${c}" filter="url(#fGlow)"/>
    </g>`;
  }
  function rrect(x, y, w, h, rx, fill, stroke) {
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" stroke="${stroke || "none"}"/>`;
  }
  function txt(x, y, str, cls, size, fill, extra) {
    return `<text x="${x}" y="${y}" text-anchor="middle" class="${cls}" font-size="${size}" fill="${fill || "#2b2822"}" ${extra || ""}>${str}</text>`;
  }

  /* ---------- 全馆总览 ---------- */
  function buildHome() {
    const r = ROTO;
    let s = "";

    /* 1 · 天幕 + 地面网格 */
    s += `<ellipse cx="600" cy="290" rx="760" ry="430" fill="url(#gSkyWash)"/>`;
    s += `<ellipse cx="600" cy="420" rx="660" ry="340" fill="url(#gFloor)"/>`;
    let grid = "";
    for (let i = 0; i < 10; i++) grid += `<line x1="${-120 + i * 190}" y1="700" x2="${520 + i * 190}" y2="60"/>`;
    for (let i = 0; i < 10; i++) grid += `<line x1="${1320 - i * 190}" y1="700" x2="${680 - i * 190}" y2="60"/>`;
    s += `<g stroke="rgba(150,124,80,.10)" stroke-width="1">${grid}</g>`;

    /* 2 · 中央广场：环带 + 放射铺装 */
    let plaza = "";
    [1.5, 1.95, 2.45].forEach((k, i) => {
      plaza += `<ellipse cx="${r.x}" cy="${r.y + 18}" rx="${r.rx * k}" ry="${r.ry * k}"
        fill="none" stroke="rgba(120,175,235,${.16 - i * .04})" stroke-width="1.4" ${i === 1 ? 'stroke-dasharray="3 8"' : ""}/>`;
    });
    for (let i = 0; i < 12; i++) {
      const a = Math.PI * (i + .5) / 12;
      plaza += `<line x1="${(r.x + Math.cos(a) * r.rx * 1.1).toFixed(1)}" y1="${(r.y + 18 + Math.sin(a) * r.ry * 1.1).toFixed(1)}"
        x2="${(r.x + Math.cos(a) * r.rx * 2.45).toFixed(1)}" y2="${(r.y + 18 + Math.sin(a) * r.ry * 2.45).toFixed(1)}"
        stroke="rgba(150,124,80,.09)"/>`;
    }
    s += `<g>${plaza}</g>`;

    /* 3 · 扫光 + 尘埃 */
    s += `<rect x="0" y="0" width="230" height="640" fill="url(#gSweep)" class="msweep" opacity=".85"/>`;
    s += [[128, 128], [348, 86], [512, 148], [860, 104], [1054, 158], [78, 452], [1136, 470], [430, 600], [772, 610], [986, 578], [214, 268], [668, 54]]
      .map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="${1.4 + (i % 3) * .5}" fill="rgba(140,116,74,.55)" class="mtw" style="animation-delay:${(i * .42).toFixed(2)}s"/>`).join("");

    /* 4 · 参观动线 */
    s += ZK.map(zk => `
      <path id="mp${zk}" d="${PATHS[zk]}" fill="none" stroke="${al(ZONES[zk].c, .55)}" stroke-width="2.6" class="mpath"/>
      <circle r="3.2" fill="${ZONES[zk].c}" filter="url(#fGlow)">
        <animateMotion dur="${3.2 + ZK.indexOf(zk) * .8}s" repeatCount="indefinite"><mpath href="#mp${zk}"/></animateMotion>
      </circle>
      <circle r="1.6" fill="#b0741c" opacity=".7">
        <animateMotion dur="${3.2 + ZK.indexOf(zk) * .8}s" begin=".35s" repeatCount="indefinite"><mpath href="#mp${zk}"/></animateMotion>
      </circle>`).join("");

    /* 5 · 三翼展馆（远→近） */
    const order = ZK.slice().sort((a, b) => WING_POS[a].y - WING_POS[b].y);
    order.forEach(zk => {
      const z = ZONES[zk], w = WING_POS[zk];
      const topY = w.y - w.hd - w.h;
      const inset = .60;
      const skylight = `${w.x},${topY - w.hd * inset} ${w.x + w.hw * inset},${topY} ${w.x},${topY + w.hd * inset} ${w.x - w.hw * inset},${topY}`;
      s += `
      <g class="mwing" data-zone="${zk}">
        <!-- 台基（两级） -->
        <polygon points="${w.x},${w.y - w.hd * 1.26 + 9} ${w.x + w.hw * 1.26},${w.y + 9} ${w.x},${w.y + w.hd * 1.26 + 9} ${w.x - w.hw * 1.26},${w.y + 9}"
          fill="#ece3d1" stroke="${al(z.c, .13)}"/>
        <polygon points="${w.x},${w.y - w.hd * 1.14 + 4} ${w.x + w.hw * 1.14},${w.y + 4} ${w.x},${w.y + w.hd * 1.14 + 4} ${w.x - w.hw * 1.14},${w.y + 4}"
          fill="#f8f1e3" stroke="${al(z.c, .22)}"/>
        ${box(w.x, w.y, w.hw, w.hd, w.h, zk)}
        ${faceWins(w.x, w.y, w.hw, w.hd, w.h, zk, -1, 3, 2)}
        ${faceWins(w.x, w.y, w.hw, w.hd, w.h, zk, 1, 3, 2)}
        <!-- 顶部玻璃天窗 -->
        <polygon points="${skylight}" fill="url(#gSky${zk})" stroke="${al(z.c, .55)}" stroke-width="1"/>
        ${[.42, .72].map(k => `<polygon points="${w.x},${(topY - w.hd * inset * k).toFixed(1)} ${(w.x + w.hw * inset * k).toFixed(1)},${topY} ${w.x},${(topY + w.hd * inset * k).toFixed(1)} ${(w.x - w.hw * inset * k).toFixed(1)},${topY}"
          fill="none" stroke="${al(z.c, .22)}"/>`).join("")}
        <!-- 屋顶棱线高光 -->
        <line x1="${w.x}" y1="${topY - w.hd}" x2="${w.x + w.hw}" y2="${topY}" stroke="${al(z.c, .55)}" stroke-width="1.6"/>
        <line x1="${w.x}" y1="${topY - w.hd}" x2="${w.x - w.hw}" y2="${topY}" stroke="${al(z.c, .38)}" stroke-width="1.6"/>
        <!-- 角旗 -->
        ${[-1, 1].map(sd => {
          const px = w.x + sd * w.hw * .92, py = topY + w.hd * .08;
          return `<line x1="${px}" y1="${py}" x2="${px}" y2="${py - 40}" stroke="${al(z.c, .55)}" stroke-width="1.4"/>
            <path d="M ${px} ${py - 40} l ${sd * 20} 5 l ${-sd * 20} 8 z" fill="${al(z.c, .5)}" stroke="${al(z.c, .9)}" stroke-width=".8"/>`;
        }).join("")}
        <!-- 正门：双立面拱门 + 台阶 -->
        ${(() => {
          const dx = w.x, dy = w.y + w.hd, dh = w.h * .52;
          return `<g>
            <path d="M ${dx - 17} ${dy} L ${dx - 17} ${dy - dh + 12} A 17 10 0 0 1 ${dx + 17} ${dy - dh + 12} L ${dx + 17} ${dy} Z" fill="url(#gDoor)" stroke="${al(z.c, .85)}" stroke-width="1.2"/>
            <ellipse cx="${dx}" cy="${dy + 6}" rx="42" ry="13" fill="${al(z.c, .18)}" filter="url(#fSoft2)"/>
            <path d="M ${dx - 30} ${dy + 8} L ${dx} ${dy + 20} L ${dx + 30} ${dy + 8}" fill="none" stroke="${al(z.c, .45)}"/>
            <path d="M ${dx - 22} ${dy + 12} L ${dx} ${dy + 21} L ${dx + 22} ${dy + 12}" fill="none" stroke="${al(z.c, .3)}"/>
            <rect x="${dx - 9}" y="${dy - dh + 16}" width="18" height="6" rx="3" fill="${al(z.c, .8)}" filter="url(#fGlow)"/>
          </g>`;
        })()}
        ${beacon(w.x, Math.max(topY - 30, 52), zk, 22)}
        <!-- 铭牌 -->
        <g>
          ${rrect(w.x - 112, PLATE_Y[zk], 224, 46, 11, "rgba(255,253,248,.94)", al(z.c, .45))}
          <circle cx="${w.x - 86}" cy="${PLATE_Y[zk] + 23}" r="13" fill="${al(z.c, .10)}" stroke="${z.c}" stroke-width="1.6"/>
          ${txt(w.x - 86, PLATE_Y[zk] + 28, zk, "mono", 13, z.c)}
          ${txt(w.x + 4, PLATE_Y[zk] + 20, z.name, "serif", 17, "#2b2822")}
          ${txt(w.x + 4, PLATE_Y[zk] + 37, "WING " + zk + " · " + MODULES.filter(m => m.zone === zk).length + " 展品", "mono", 8.5, "#8a8172", "letter-spacing='2'")}
          ${txt(w.x + 94, PLATE_Y[zk] + 19, "0/0", "mono chipdn", 13, "#1c8a5c", 'data-zone="' + zk + '"')}
          ${txt(w.x + 94, PLATE_Y[zk] + 35, "识破", "mono", 8, "#8a8172")}
        </g>
        <polygon class="mhit" points="${w.x - w.hw - 24},${topY - 54} ${w.x + w.hw + 24},${topY - 54} ${w.x + w.hw + 24},${PLATE_Y[zk] + 52} ${w.x - w.hw - 24},${PLATE_Y[zk] + 52}" fill="transparent"/>
      </g>`;
    });

    /* 6 · 中央穹顶大厅（最前，压住动线尾端） */
    const drx = r.rx * .87, dry = r.ry * 1.78;
    const apexY = r.y - r.h - dry;
    let cols = "";
    const colList = [];
    for (let i = 0; i <= 14; i++) {
      const a = Math.PI * i / 14;
      colList.push({ x: r.x - r.rx * Math.cos(a), y: r.y + r.ry * Math.sin(a) * .98 });
    }
    colList.sort((p, q) => p.y - q.y).forEach(p => {
      cols += `<rect x="${(p.x - 2.6).toFixed(1)}" y="${(p.y - r.h).toFixed(1)}" width="5.2" height="${r.h}" rx="2.6" fill="url(#gCol)"/>
        <rect x="${(p.x - 3.6).toFixed(1)}" y="${(p.y - r.h - 3).toFixed(1)}" width="7.2" height="3.4" rx="1.4" fill="${al("#7d8fa6", .40)}"/>`;
    });
    let winStrip = "";
    for (let i = 0; i < 20; i++) {
      const a = Math.PI * i / 20;
      const x = r.x - (r.rx - 6) * Math.cos(a), y = r.y + (r.ry - 2) * Math.sin(a) * .98;
      winStrip += `<rect x="${(x - 3).toFixed(1)}" y="${(y - r.h * .52).toFixed(1)}" width="6" height="${(r.h * .30).toFixed(1)}" fill="#b0741c" opacity="${(.18 + (i % 4) * .16).toFixed(2)}" ${i % 5 === 0 ? 'class="mtw" style="animation-duration:5s"' : ""}/>`;
    }
    s += `
    <ellipse cx="${r.x}" cy="${r.y - 70}" rx="300" ry="200" fill="url(#gHalo)"/>
    <g id="roto" style="cursor:pointer">
      <ellipse cx="${r.x}" cy="${r.y + 26}" rx="${r.rx * 1.8}" ry="${r.ry * 1.75}" fill="rgba(140,118,80,.16)" filter="url(#fSoft)"/>
      <!-- 台阶 -->
      ${[1.34, 1.19, 1.06].map((k, i) => `<ellipse cx="${r.x}" cy="${r.y + 8 + i * 5}" rx="${(r.rx * k).toFixed(1)}" ry="${(r.ry * k).toFixed(1)}"
        fill="${mix("#f6eede", "#b9c6d6", .07 + i * .05)}" stroke="rgba(150,124,80,.22)"/>`).join("")}
      <!-- 鼓座 -->
      <path d="M ${r.x - r.rx} ${r.y - r.h} L ${r.x - r.rx} ${r.y} A ${r.rx} ${r.ry} 0 0 1 ${r.x + r.rx} ${r.y} L ${r.x + r.rx} ${r.y - r.h} Z"
        fill="url(#gDrum)" stroke="rgba(150,124,80,.20)"/>
      ${winStrip}
      ${cols}
      <!-- 檐口（凸出的一圈，撑住穹顶） -->
      <ellipse cx="${r.x}" cy="${r.y - r.h + 3}" rx="${(r.rx * 1.04).toFixed(1)}" ry="${(r.ry * 1.04).toFixed(1)}" fill="#f8f1e2" stroke="rgba(150,124,80,.28)"/>
      <ellipse cx="${r.x}" cy="${r.y - r.h}" rx="${r.rx}" ry="${r.ry}" fill="#fffdf8" stroke="rgba(120,96,60,.45)"/>
      <ellipse cx="${r.x}" cy="${r.y - r.h}" rx="${(r.rx * .94).toFixed(1)}" ry="${(r.ry * .94).toFixed(1)}" fill="none" stroke="rgba(176,116,28,.42)"/>
      <!-- 穹顶（顶弧 + 近侧底缘，闭合成立体剪影） -->
      <path d="M ${r.x - drx} ${r.y - r.h} A ${drx} ${dry} 0 0 1 ${r.x + drx} ${r.y - r.h} A ${drx} ${(r.ry * .94).toFixed(1)} 0 0 1 ${r.x - drx} ${r.y - r.h} Z"
        fill="url(#gDome)" stroke="rgba(120,140,165,.55)" stroke-width="1.4"/>
      ${[.26, .5, .74].map(k => `<path d="M ${(r.x - drx * k).toFixed(1)} ${r.y - r.h} A ${(drx * k).toFixed(1)} ${(dry * k).toFixed(1)} 0 0 1 ${(r.x + drx * k).toFixed(1)} ${r.y - r.h}" fill="none" stroke="rgba(140,158,182,.35)"/>`).join("")}
      ${[.3, .58, .84].map(k => {
        const y2 = r.y - r.h - dry + dry * k;
        const w2 = drx * Math.sqrt(Math.max(0, 1 - (1 - k) * (1 - k)));
        return `<path d="M ${(r.x - w2).toFixed(1)} ${y2.toFixed(1)} A ${w2.toFixed(1)} ${(dry * k * .14).toFixed(1)} 0 0 1 ${(r.x + w2).toFixed(1)} ${y2.toFixed(1)}" fill="none" stroke="rgba(140,158,182,.28)"/>`;
      }).join("")}
      <!-- 球面高光 -->
      ${(() => {
        const base = r.y - r.h;
        const A = 196 * Math.PI / 180, B = 236 * Math.PI / 180;
        const p1 = [r.x + drx * Math.cos(A), base + dry * Math.sin(A)];
        const p2 = [r.x + drx * Math.cos(B), base + dry * Math.sin(B)];
        return `<path d="M ${p1[0].toFixed(1)} ${p1[1].toFixed(1)} A ${drx} ${dry} 0 0 1 ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}"
          fill="none" stroke="rgba(255,255,255,.85)" stroke-width="2.2" stroke-linecap="round"/>`;
      })()}
      <!-- 采光亭 + 顶饰 -->
      <ellipse cx="${r.x}" cy="${apexY}" rx="12" ry="5.4" fill="#efe5d2" stroke="rgba(120,140,165,.65)"/>
      <path d="M ${r.x} ${apexY - 4} L ${r.x} ${apexY - 13}" stroke="rgba(110,130,155,.7)" stroke-width="1.8"/>
      <circle cx="${r.x}" cy="${apexY - 15}" r="3.4" fill="#0e7f9c" filter="url(#fGlow)" class="mtw" style="animation-duration:3.2s"/>
      <!-- 光束 -->
      <path d="M ${r.x - 10} ${apexY - 2} L ${r.x - 168} ${apexY - 108} L ${r.x - 110} ${apexY - 120} Z" fill="rgba(255,255,255,.40)"/>
      <path d="M ${r.x + 10} ${apexY - 2} L ${r.x + 176} ${apexY - 112} L ${r.x + 118} ${apexY - 124} Z" fill="rgba(255,255,255,.32)"/>
      <!-- 正门 + 门毯 -->
      <path d="M ${r.x - 27} ${r.y + r.ry * .92} L ${r.x - 27} ${r.y - r.h * .5} A 27 17 0 0 1 ${r.x + 27} ${r.y - r.h * .5} L ${r.x + 27} ${r.y + r.ry * .92} Z"
        fill="url(#gDoor)" stroke="rgba(176,116,28,.55)" stroke-width="1.3"/>
      <ellipse cx="${r.x}" cy="${r.y + r.ry * .92 + 4}" rx="62" ry="18" fill="rgba(224,180,110,.28)" filter="url(#fSoft2)"/>
      <path d="M ${r.x - 16} ${r.y + 52} L ${r.x + 16} ${r.y + 52} L ${r.x + 60} ${r.y + 112} L ${r.x - 60} ${r.y + 112} Z"
        fill="rgba(176,116,28,.10)" stroke="rgba(176,116,28,.35)"/>
      <path d="M ${r.x - 9} ${r.y + 56} L ${r.x + 9} ${r.y + 56} L ${r.x + 44} ${r.y + 106} L ${r.x - 44} ${r.y + 106} Z"
        fill="none" stroke="rgba(176,116,28,.25)" stroke-dasharray="4 7" class="mpath"/>
      ${txt(r.x, r.y + 96, "中央大厅 · TRUST LAB", "mono", 10, "#8a5c10", "letter-spacing='3'")}
      ${txt(r.x, r.y + 110, "环廊 · 导览起点", "mono", 8, "#8a8172", "letter-spacing='2'")}
    </g>`;

    /* 7 · 罗盘 + 比例尺 */
    s += `
    <g opacity=".85">
      <circle cx="1100" cy="556" r="25" fill="rgba(255,253,248,.85)" stroke="#cbbfa9"/>
      <circle cx="1100" cy="556" r="19" fill="none" stroke="#d8cdb8" stroke-dasharray="2 5"/>
      <path d="M 1100 537 L 1105 561 L 1100 556 L 1095 561 Z" fill="#0e7f9c"/>
      ${txt(1100, 596, "N", "mono", 9, "#9a9284")}
      ${rrect(70, 562, 92, 4, 2, "none", "#cbbfa9")}
      <line x1="70" y1="558" x2="70" y2="571" stroke="#cbbfa9"/><line x1="116" y1="558" x2="116" y2="571" stroke="#cbbfa9"/><line x1="162" y1="558" x2="162" y2="571" stroke="#cbbfa9"/>
      ${txt(116, 588, "比例 1 : ∞ · 可信度另计", "mono", 9, "#9a9284")}
    </g>`;

    gHome.innerHTML = s;

    /* 交互 */
    gHome.querySelectorAll(".mwing").forEach(g => {
      const zk = g.dataset.zone;
      const hit = g.querySelector(".mhit");
      hit.addEventListener("click", () => { if (H.SND) H.SND.door(); focus(zk); });
      hit.addEventListener("mouseenter", () => tipZone(zk));
      hit.addEventListener("mouseleave", tipDefault);
    });
    const roto = document.getElementById("roto");
    if (roto) roto.addEventListener("click", () => {
      if (H.SND) H.SND.click();
      if (H.toast) H.toast("穹顶之下，没有模型敢说 100%。", "🏛");
    });
  }

  /* ---------- 展馆内部 ---------- */
  const roomEls = {};
  let guideFace = null;
  function buildWing(zk) {
    const z = ZONES[zk];
    const mods = MODULES.filter(m => m.zone === zk);
    const pos3 = [[366, 296], [834, 296], [600, 186]];
    const pos2 = [[428, 296], [772, 296]];
    const spots = mods.length === 3 ? pos3 : pos2;
    const DAIS = { x: 600, y: 432, rx: 88, ry: 44 };

    /* 地砖：两组平行斜线（沿菱形两轴），裁进平台 */
    let tiles = "";
    const SL = 250 / 488;
    for (let k = -12; k <= 12; k++) {
      const b = 398 + k * 42;
      tiles += `<line x1="80" y1="${(b - (600 - 80) * SL).toFixed(1)}" x2="1120" y2="${(b + (1120 - 600) * SL).toFixed(1)}"/>`;
      tiles += `<line x1="80" y1="${(b + (600 - 80) * SL).toFixed(1)}" x2="1120" y2="${(b - (1120 - 600) * SL).toFixed(1)}"/>`;
    }

    let s = `
    <!-- 平台 -->
    <polygon points="600,150 1088,398 600,646 112,398" fill="url(#gFloorPlane)" stroke="${al(z.c, .55)}" stroke-width="1.8"/>
    <g clip-path="url(#cpWing)" stroke="${al(z.c, .13)}" stroke-width="1">${tiles}</g>
    <ellipse cx="600" cy="400" rx="470" ry="230" fill="url(#gPool${zk})" opacity=".5"/>
    <polygon points="600,168 1062,398 600,628 138,398" fill="none" stroke="${al(z.c, .22)}"/>
    <polygon points="600,186 1036,398 600,610 164,398" fill="none" stroke="${al(z.c, .10)}" stroke-dasharray="3 9"/>
    <!-- 展廊栏杆 -->
    ${(() => {
      const V = [[600, 150], [1088, 398], [600, 646], [112, 398]];
      let g = "";
      for (let e = 0; e < 4; e++) {
        const a = V[e], b = V[(e + 1) % 4];
        g += `<line x1="${a[0]}" y1="${a[1] - 26}" x2="${b[0]}" y2="${b[1] - 26}" stroke="${al(z.c, .34)}" stroke-width="2"/>`;
        g += `<line x1="${a[0]}" y1="${a[1] - 15}" x2="${b[0]}" y2="${b[1] - 15}" stroke="${al(z.c, .14)}"/>`;
        for (let i = 1; i < 9; i++) {
          const t = i / 9;
          const px = a[0] + (b[0] - a[0]) * t, py = a[1] + (b[1] - a[1]) * t;
          g += `<line x1="${px.toFixed(1)}" y1="${py.toFixed(1)}" x2="${px.toFixed(1)}" y2="${(py - 26).toFixed(1)}" stroke="${al(z.c, .22)}" stroke-width="1.6"/>`;
        }
      }
      return `<g>${g}</g>`;
    })()}
    <!-- 平台四角灯柱 -->
    ${[[600, 150], [1088, 398], [600, 646], [112, 398]].map(p => `
      <g>
        <line x1="${p[0]}" y1="${p[1]}" x2="${p[0]}" y2="${p[1] - 34}" stroke="${al(z.c, .5)}" stroke-width="1.6"/>
        <circle cx="${p[0]}" cy="${p[1] - 37}" r="4.5" fill="${z.c}" filter="url(#fGlow)" class="mtw" style="animation-duration:4.6s"/>
        <circle cx="${p[0]}" cy="${p[1] - 37}" r="13" fill="url(#gBeacon${zk})" class="mring"/>
      </g>`).join("")}
    <rect x="0" y="0" width="230" height="640" fill="url(#gSweep)" class="msweep" opacity=".55"/>
    ${[[176, 196], [1024, 232], [286, 566], [944, 546], [600, 92], [760, 600], [420, 610]].map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="1.6" fill="rgba(215,235,255,.8)" class="mtw" style="animation-delay:${(i * .5).toFixed(2)}s"/>`).join("")}
    <!-- 入口长廊 -->
    <path d="M 536 646 L 664 646 L 624 500 L 576 500 Z" fill="rgba(6,10,17,.85)" stroke="${al(z.c, .30)}"/>
    <path d="M 556 646 L 644 646 L 616 516 L 584 516 Z" fill="none" stroke="${al(z.c, .6)}" stroke-width="2" class="mpath"/>
    ${[0, 1, 2].map(i => `<line x1="${552 - i * 8}" y1="${636 - i * 34}" x2="${648 + i * 8}" y2="${636 - i * 34}" stroke="${al(z.c, .16)}"/>`).join("")}
    ${txt(600, 486, "· " + zk + " 馆入口 ·", "mono", 10, z.c, "letter-spacing='5'")}
    <!-- 中庭基座 -->
    <ellipse cx="${DAIS.x}" cy="${DAIS.y + 6}" rx="${DAIS.rx * 1.25}" ry="${DAIS.ry * 1.2}" fill="rgba(0,0,0,.45)" filter="url(#fSoft)"/>
    <ellipse cx="${DAIS.x}" cy="${DAIS.y}" rx="${DAIS.rx}" ry="${DAIS.ry}" fill="rgba(12,18,29,.92)" stroke="${al(z.c, .5)}" stroke-width="1.6"/>
    <ellipse cx="${DAIS.x}" cy="${DAIS.y}" rx="${DAIS.rx * .78}" ry="${DAIS.ry * .78}" fill="none" stroke="${al(z.c, .28)}" stroke-dasharray="4 10" class="mspin"/>
    <ellipse cx="${DAIS.x}" cy="${DAIS.y}" rx="${DAIS.rx * .52}" ry="${DAIS.ry * .52}" fill="none" stroke="${al(z.c, .18)}"/>
    ${txt(DAIS.x, DAIS.y + 6, zk, "serif", 34, al(z.c, .30), "letter-spacing='0'")}
    ${txt(DAIS.x, DAIS.y + 26, "HALL " + zk, "mono", 8, al(z.c, .55), "letter-spacing='6'")}
    <!-- 导游化身 -->
    <g class="mbob" id="mapGuide">
      <ellipse cx="${DAIS.x}" cy="${DAIS.y - 2}" rx="21" ry="7" fill="rgba(0,0,0,.5)"/>
      <circle cx="${DAIS.x}" cy="${DAIS.y - 34}" r="18" fill="rgba(16,22,33,.96)" stroke="#ffe4b8" stroke-width="1.6" filter="url(#fGlow)"/>
      <text x="${DAIS.x}" y="${DAIS.y - 27}" text-anchor="middle" font-size="18" id="mapGuideFace">🤖</text>
      <line x1="${DAIS.x}" y1="${DAIS.y - 16}" x2="${DAIS.x}" y2="${DAIS.y - 2}" stroke="rgba(255,228,184,.5)" stroke-width="2"/>
      ${rrect(DAIS.x - 46, DAIS.y - 78, 92, 18, 9, "rgba(10,14,22,.94)", "rgba(255,213,143,.45)")}
      ${txt(DAIS.x, DAIS.y - 65, "跟我来 →", "mono", 9, "#ffe4b8", "letter-spacing='1'")}
    </g>`;

    mods.forEach((m, i) => {
      const [x, y] = spots[i];
      const h = 54 + (i % 3) * 12;
      const hw = 82, hd = 42;
      const topY = y - hd - h;
      s += `
      <g class="mroom" data-mid="${m.id}" data-zk="${zk}">
        <ellipse cx="${x}" cy="${y + 6}" rx="${hw * 1.5}" ry="${hd * 1.25}" fill="${al(z.c, .10)}" filter="url(#fSoft2)"/>
        ${box(x, y, hw, hd, h, zk)}
        ${faceWins(x, y, hw, hd, h, zk, -1, 2, 2)}
        ${faceWins(x, y, hw, hd, h, zk, 1, 2, 2)}
        <polygon points="${x},${topY - hd * .58} ${x + hw * .58},${topY} ${x},${topY + hd * .58} ${x - hw * .58},${topY}"
          fill="url(#gSky${zk})" stroke="${al(z.c, .45)}"/>
        <!-- 展柜光锥 -->
        <path d="M ${x - 30} ${topY - 96} L ${x + 30} ${topY - 96} L ${x + hw * .62} ${topY + 8} L ${x - hw * .62} ${topY + 8} Z"
          fill="${al(z.c, .07)}" stroke="none"/>
        <!-- 悬浮招牌 -->
        <g class="mfloat" style="animation-delay:${(i * .6).toFixed(1)}s">
          <line x1="${x}" y1="${topY - 4}" x2="${x}" y2="${topY - 40}" stroke="${al(z.c, .5)}" stroke-width="1.6"/>
          <circle cx="${x}" cy="${topY - 60}" r="22" fill="rgba(11,16,26,.96)" stroke="${z.c}" stroke-width="1.6" filter="url(#fGlow)"/>
          <circle cx="${x}" cy="${topY - 60}" r="27" fill="none" stroke="${al(z.c, .25)}" stroke-dasharray="2 6" class="mspin"/>
          <text x="${x}" y="${topY - 52}" text-anchor="middle" font-size="21">${m.gi}</text>
        </g>
        <!-- 编号徽章 -->
        <g transform="translate(${x - hw - 10},${y - hd * .55 - 26})">
          ${rrect(-26, -14, 52, 27, 7, "rgba(10,14,22,.95)", al(z.c, .55))}
          ${txt(0, 5, "展品 " + m.no, "mono", 11, z.c)}
        </g>
        <!-- 铭牌 -->
        <g>
          ${rrect(x - 120, y + hd + 18, 240, 42, 9, "rgba(9,13,21,.94)", al(z.c, .35))}
          ${txt(x, y + hd + 34, m.name, "serif", 15.5, "#2b2822")}
          ${txt(x, y + hd + 50, "① 故事 · ② 玩具 · ③ 硬核", "mono", 8.5, "#8a8172")}
        </g>
        <!-- 识破钢印 / 待识破 -->
        <g class="m-seal" transform="translate(${x + hw - 2},${y - hd * .45 - 30}) rotate(12)">
          ${rrect(-44, -12, 88, 23, 5, "rgba(62,207,142,.16)", "rgba(62,207,142,.7)")}
          ${txt(0, 4, "已识破 ✓", "mono", 10, "#1c8a5c", "letter-spacing='2'")}
        </g>
        <g class="m-lock">
          <circle cx="${x + hw + 2}" cy="${y - hd * .45 - 20}" r="11" fill="rgba(10,14,22,.92)" stroke="#cbbfa9"/>
          ${txt(x + hw + 2, y - hd * .45 - 15.5, "?", "mono", 12, "#8a8172")}
        </g>
        <polygon class="mhit" points="${x - hw - 66},${topY - 92} ${x + hw + 66},${topY - 92} ${x + hw + 66},${y + hd + 66} ${x - hw - 66},${y + hd + 66}" fill="transparent"/>
      </g>`;
    });

    /* 导览路：中庭 → 各展柜 */
    const src = `M ${DAIS.x} ${DAIS.y - 6}`;
    s += `<path d="${spots.map(p => `${src} Q ${(DAIS.x + p[0]) / 2 + (p[0] < 600 ? -30 : p[0] > 600 ? 30 : 0)} ${(DAIS.y + p[1]) / 2} ${p[0]} ${p[1] + 52}`).join(" ")}"
      fill="none" stroke="${al(z.c, .38)}" stroke-width="1.8" class="mpath"/>`;

    gWing.innerHTML = s;

    /* 交互 */
    gWing.querySelectorAll(".mroom").forEach(g => {
      const mid = g.dataset.mid;
      const m = MODULES.find(x => x.id === mid);
      const hit = g.querySelector(".mhit");
      hit.addEventListener("click", () => { if (H.SND) H.SND.click(); H.openRoom(m); });
      hit.addEventListener("mouseenter", () => tipRoom(m));
      hit.addEventListener("mouseleave", () => tipZone(zk));
      roomEls[mid] = { grp: g, zk };
    });
    guideFace = document.getElementById("mapGuideFace");
    if (guideFace && window.TLGUIDES) {
      const cur = localStorage.getItem("tlab.guide") || "wu";
      if (window.TLGUIDES[cur]) guideFace.textContent = window.TLGUIDES[cur].face;
    }
  }
  function onGuideSync(e) {
    if (e.key === "tlab.guide" && guideFace && window.TLGUIDES && window.TLGUIDES[e.newValue]) {
      guideFace.textContent = window.TLGUIDES[e.newValue].face;
    }
  }
  addEventListener("storage", onGuideSync);

  /* ---------- 信息条 ---------- */
  function tipZone(zk) {
    const z = ZONES[zk], mods = MODULES.filter(m => m.zone === zk);
    const got = mods.filter(m => H.got()[m.id]).length;
    mapTip.innerHTML = `
      <span class="t-gi">🏛</span>
      <span><b>${zk} 区 · ${z.name}</b>　<span class="mono" style="font-size:10px;color:${z.c}">WING ${zk}</span></span>
      <span class="t-one">${z.q}</span>
      <span class="t-badges"><span class="t-b on">${got}/${mods.length} 已识破</span></span>
      <span class="t-acc">点击展柜进入 · Esc 返回</span>`;
    mapTip.style.borderColor = al(z.c, .35);
  }
  function tipRoom(m) {
    mapTip.innerHTML = `
      <span class="t-gi">${m.gi}</span>
      <span><b>展品 ${m.no} · ${m.name}</b>${H.got()[m.id] ? '　<span style="color:var(--gn);font-size:10px">✓ 已识破</span>' : ""}</span>
      <span class="t-one">${m.one}</span>
      <span class="t-badges"><span class="t-b on">① 故事</span><span class="t-b on">② 玩具</span><span class="t-b on">③ 硬核</span></span>
      <span class="t-acc">🗓 ${m.inc}</span>`;
    mapTip.style.borderColor = al(ZONES[m.zone].c, .35);
  }
  function tipDefault() {
    mapTip.innerHTML = `
      <span class="t-gi">🗺️</span>
      <span><b>全馆总览</b>　<span class="mono" style="font-size:10px;color:var(--tx3)">GRAND TOUR MAP</span></span>
      <span class="t-one">三翼展馆环抱中央穹顶大厅——点击任一展馆查看内部展区与展品位置，导游会在馆内等你。</span>
      <span class="t-badges"><span class="t-b on">A 成因现场</span><span class="t-b on">B 检测侦探社</span><span class="t-b on">C 保障实验室</span></span>
      <span class="t-acc">📜 墙上公告也是展品</span>`;
    mapTip.style.borderColor = "";
  }

  /* ---------- 视图切换 ---------- */
  const ZLINES = {
    A: "A 馆 · 成因现场——AI 出错的源头：掷骰子的采样、脆弱的高维边界、被误当目标的指标。",
    B: "B 馆 · 检测侦探社——幻觉、失真的自信、被绕过的护栏：学会像审计员一样怀疑一切输出。",
    C: "C 馆 · 保障实验室——水印、认证地平线：可靠不是一张证书，而是持续审计的过程。",
  };
  let curZone = null, animT = null;
  function focus(zk, quiet) {
    if (!ZONES[zk] || curZone === zk) return;
    curZone = zk;
    const z = ZONES[zk];
    const w = WING_POS[zk];
    const vx = 600, vy = 320, S = 2.35;
    gHome.style.transform = `translate(${(vx - S * w.x).toFixed(1)}px, ${(vy - S * w.y).toFixed(1)}px) scale(${S})`;
    gHome.style.opacity = "0";
    clearTimeout(animT);
    animT = setTimeout(() => {
      buildWing(zk);
      gWing.classList.add("on");
      paintWing();
    }, 430);
    const hz = document.getElementById("mhZ");
    hz.textContent = zk + " 馆";
    hz.style.color = z.c;
    hz.style.borderColor = al(z.c, .55);
    document.getElementById("mhN").textContent = z.name;
    document.getElementById("mhN").style.color = z.c;
    document.getElementById("mhQ").textContent = z.q;
    mapHead.classList.add("on");
    tipZone(zk);
    if (H.V) H.V("zone", zk);
    if (!quiet && H.say) H.say(ZLINES[zk]);
  }
  function home(silent) {
    if (!curZone) return;
    curZone = null;
    clearTimeout(animT);
    gWing.classList.remove("on");
    gHome.style.transform = "";
    gHome.style.opacity = "1";
    mapHead.classList.remove("on");
    tipDefault();
    if (!silent && H.SND) H.SND.click();
  }
  function isOpen() { return !!curZone; }

  /* ---------- 进度刷新 ---------- */
  function paintHome() {
    ZK.forEach(zk => {
      const mods = MODULES.filter(m => m.zone === zk);
      const k = mods.filter(m => H.got()[m.id]).length;
      const chip = gHome.querySelector(`.chipdn[data-zone="${zk}"]`);
      if (chip) chip.textContent = `${k}/${mods.length}`;
      const grp = gHome.querySelector(`.mwing[data-zone="${zk}"]`);
      if (grp) grp.classList.toggle("done", k === mods.length && mods.length > 0);
    });
  }
  function paintWing() {
    Object.keys(roomEls).forEach(mid => {
      if (roomEls[mid].grp) roomEls[mid].grp.classList.toggle("got", !!H.got()[mid]);
    });
  }
  function paint() { paintHome(); if (curZone) paintWing(); }

  /* ---------- 抽中考高亮 ---------- */
  function highlight(mid) {
    const m = MODULES.find(x => x.id === mid);
    if (!m) return;
    if (curZone !== m.zone) { home(true); setTimeout(() => focus(m.zone), 120); }
    setTimeout(() => {
      const r = roomEls[mid];
      if (!r) return;
      r.grp.classList.remove("hl");
      void r.grp.getBoundingClientRect();
      r.grp.classList.add("hl");
      tipRoom(m);
      setTimeout(() => r.grp.classList.remove("hl"), 3200);
    }, curZone === m.zone ? 60 : 760);
  }

  /* ---------- 自动导览：导游带队巡馆 ---------- */
  let tourTimers = [];
  function tour() {
    tourTimers.forEach(clearTimeout);
    tourTimers = [];
    home(true);
    const lines = {
      A: "第一站 A 馆 · 成因现场——AI 出错的源头：掷骰子的采样、脆弱的高维边界、被误当目标的指标。",
      B: "第二站 B 馆 · 检测侦探社——幻觉、失真的自信、被绕过的护栏：学会像审计员一样怀疑一切输出。",
      C: "第三站 C 馆 · 保障实验室——水印、认证地平线：可靠不是一张证书，而是持续审计的过程。",
    };
    ZK.forEach((zk, i) => {
      tourTimers.push(setTimeout(() => {
        focus(zk, true);
        if (H.say) H.say(lines[zk]);
      }, 320 + i * 3000));
    });
    tourTimers.push(setTimeout(() => {
      home(true);
      if (H.say) H.say("导览结束。三座展馆都在等你——记住：先听故事，再玩玩具，最后下硬核实验室。");
      if (H.toast) H.toast("导览结束，自己挑一座展馆进去吧", "🏛");
    }, 320 + ZK.length * 3000));
  }

  /* ---------- 返回钮 ---------- */
  document.getElementById("mapBack").addEventListener("click", () => home());

  /* ---------- 启动 ---------- */
  buildHome();
  paintHome();
  tipDefault();
  window.TLMAP = { focus, home, isOpen, highlight, paint, tour };
})();
</script>
