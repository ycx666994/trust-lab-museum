<script>
(function () {
  "use strict";
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];

  /* ================= 展品登记表 ================= */
  const MODULES = [
    { id: "m1", zone: "B", no: "01", gi: "🌀", name: "涌现与海市蜃楼", one: "模型用最自信的语气，编最离谱的事。", href: "m1-mirage.html", ly: [1, 1, 1],
      sym: "最自信的语气编最离谱的事", cause: "重组记忆碎片填补信息空白", det: "溯源 + 外部事实校验", inc: "律师向法庭引用不存在的判例（2023）" },
    { id: "m2", zone: "C", no: "02", gi: "🎯", name: "认证地平线", one: "我们到底能不能「证明」一个模型可靠？证书值多少钱？", href: "m2-horizon.html", ly: [1, 1, 1],
      sym: "测试通过 ≠ 永远可靠", cause: "切口越长，证据越薄", det: "三条地平线取最小（ℓ*）", inc: "长程部署漂移导致性能静默衰退（通用）" },
    { id: "m3", zone: "A", no: "03", gi: "🌡️", name: "温度与幻觉放大器", one: "拖一下采样温度，看同一个模型怎么从靠谱变成满口胡话。", href: "m3-temperature.html", ly: [1, 1, 1],
      sym: "同一道题，每次问答案都不一样", cause: "采样随机性：输出掷骰子", det: "「问它三遍」对比法", inc: "Galactica 一本正经编造参考文献（2022）" },
    { id: "m4", zone: "B", no: "04", gi: "🎭", name: "越狱攻防", one: "你当攻方写 prompt，AI 当守方加护栏，看谁先破。", href: "m4-jailbreak.html", ly: [1, 1, 1],
      sym: "一句话绕过安全护栏", cause: "指令与训练目标可被冲突利用", det: "红队对抗测试", inc: "Tay 上线 16 小时被教坏（2016）" },
    { id: "m5", zone: "C", no: "05", gi: "🔍", name: "水印侦探", one: "给一段文本，判断它是不是模型生成的、有没有水印。", href: "m5-watermark.html", ly: [1, 1, 1],
      sym: "分不清人写的还是模型写的", cause: "生成文本天生没有指纹", det: "绿名单 z-score 检测", inc: "AI 作业泛滥引发学术诚信危机（2023-）" },
    { id: "m6", zone: "B", no: "06", gi: "⚖️", name: "校准放大器", one: "模型说「我有 90% 把握」，实际只对 50% 次。", href: "m6-calibration.html", ly: [1, 1, 1],
      sym: "说 90% 把握，实际对一半", cause: "训练只奖励对错，不奖励诚实", det: "校准曲线 + ECE 指标", inc: "医疗 AI 高置信误诊未被质疑（通用）" },
    { id: "m7", zone: "A", no: "07", gi: "🐼", name: "对抗样本", one: "给熊猫加一点人眼看不见的噪声，AI 说它是长臂猿。", href: "m7-adv.html", ly: [1, 1, 1],
      sym: "看不见的噪声让 AI 认错", cause: "高维决策边界极其脆弱", det: "对抗测试（FGSM 等）", inc: "路牌贴纸让自动驾驶误读停止标志（2019）" },
    { id: "m8", zone: "A", no: "08", gi: "🧮", name: "刷分机器人", one: "当指标成了目标，它就不再是好指标——模型学会刷分而非做好事。", href: "m8-goodhart.html", ly: [1, 1, 1],
      sym: "指标涨了，事情没做好", cause: "指标 ≠ 目标（Goodhart 定律）", det: "抽查指标之外的行为", inc: "推荐算法为停留时长狂推标题党（通用）" },
  ];
  const ZONES = {
    A: { name: "成因现场", q: "AI 为什么会这样出错？——走进三次著名事故的现场。", c: "#f5b451", cs: "rgba(245,180,81,.35)" },
    B: { name: "检测侦探社", q: "不轻信任何输出——亲手做一次 AI 审计。", c: "#57c7ff", cs: "rgba(87,199,255,.35)" },
    C: { name: "保障实验室", q: "给你手电和绳子：水印、认证地平线，以及诚实的边界。", c: "#3ecf8e", cs: "rgba(62,207,142,.35)" },
  };

  /* ================= 进度状态 ================= */
  const KEY = "tlab.v1";
  const load = () => { try { return Object.assign({ got: {}, bait: false, ach: {} }, JSON.parse(localStorage.getItem(KEY)) || {}); } catch { return { got: {}, bait: false, ach: {} }; } };
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {} };
  let state = load();
  const gotN = () => MODULES.filter(m => state.got[m.id]).length;

  /* ================= 成就徽章 ================= */
  const ACHIEVEMENTS = [
    { id: "first_light", name: "初见失效", desc: "第一次识破一种 AI 失效" },
    { id: "sharp_eye",   name: "眼尖",     desc: "还没进展区就点碎了墙上公告" },
    { id: "three_kills", name: "三连击破", desc: "累计识破 3 种失效" },
    { id: "all_clear",   name: "完美审计", desc: "集齐全部 8 张图鉴" },
    { id: "speedrun",    name: "极速审计员", desc: "30 分钟内识破全部 8 种" },
  ];
  function grant(id) {
    if (state.ach[id]) return;
    const a = ACHIEVEMENTS.find(x => x.id === id);
    if (!a) return;
    state.ach[id] = Date.now(); save();
    SND.unlock();
    toast(`成就解锁 · ${a.name} —— ${a.desc}`, "🏅");
    paintAch();
  }
  function checkAch() {
    const n = gotN();
    if (n >= 1) grant("first_light");
    if (n >= 3) grant("three_kills");
    if (n >= 8) {
      grant("all_clear");
      if (state.first && Date.now() - state.first < 30 * 60 * 1000) grant("speedrun");
    }
  }
  function paintAch() {
    const el = $("#achN");
    if (el) el.textContent = `🏅 ${Object.keys(state.ach).length}`;
  }

  /* ================= 音效（WebAudio，可静音） ================= */
  let AC = null;
  let sndOn = localStorage.getItem("tlab.snd") !== "0";
  function tone(f, t0, dur, type, vol) {
    if (!sndOn) return;
    try {
      AC = AC || new (window.AudioContext || window.webkitAudioContext)();
      const o = AC.createOscillator(), g = AC.createGain();
      o.type = type || "sine"; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, AC.currentTime + t0);
      g.gain.exponentialRampToValueAtTime(vol || 0.12, AC.currentTime + t0 + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime + t0 + dur);
      o.connect(g).connect(AC.destination);
      o.start(AC.currentTime + t0); o.stop(AC.currentTime + t0 + dur + 0.05);
    } catch {}
  }
  const SND = {
    click: () => tone(340, 0, .09, "triangle", .07),
    door:  () => { tone(180, 0, .3, "sine", .1); tone(240, .06, .28, "sine", .08); },
    unlock:() => { tone(660, 0, .16, "triangle", .12); tone(880, .12, .22, "triangle", .12); tone(1320, .24, .3, "sine", .09); },
    fanfare:() => [523, 659, 784, 1046].forEach((f, i) => tone(f, i * .13, .34, "triangle", .13)),
    toast: () => tone(520, 0, .1, "sine", .06),
  };
  function paintSnd() { $("#sndBtn").textContent = sndOn ? "🔊" : "🔇"; }
  $("#sndBtn").addEventListener("click", () => {
    sndOn = !sndOn; localStorage.setItem("tlab.snd", sndOn ? "1" : "0"); paintSnd();
    if (sndOn) SND.click();
    toast(sndOn ? "音效已开启" : "音效已静音");
  });
  paintSnd();

  /* ================= toast ================= */
  function toast(msg, icon) {
    const d = document.createElement("div");
    d.className = "toast";
    d.innerHTML = `<span>${icon || "✅"}</span><span>${msg}</span>`;
    $("#toasts").appendChild(d);
    SND.toast();
    setTimeout(() => { d.style.transition = "opacity .5s,transform .5s"; d.style.opacity = "0"; d.style.transform = "translateY(8px)"; }, 3200);
    setTimeout(() => d.remove(), 3800);
  }

  /* ================= 导游天团（打字机 + 轮换 + 可切换） ================= */
  const guideQ = $("#sayTxt"), guideC = $("#sayCaret");
  let typeTimer = null, sayIdx = 0, curLine = "";
  function guideLines() {
    const n = gotN();
    const lines = [];
    if (n === 0) lines.push(
      "欢迎来到 AI 失效博物馆。我是馆长小误——一个自己就会出错的模型，所以由我带你审计 AI 再合适不过。",
      "三扇门对应三个问题：它为什么错（A 区）？怎么发现错（B 区）？怎么兜底（C 区）？",
      "点一扇门，选一件展品进去。每件展品三层：先听故事，再玩玩具，最后下硬核实验室。",
      "顶部有 🔍 搜索（⌘K），迷路了随时喊我。"
    );
    else if (n < 8) lines.push(
      `已识破 ${n} 种失效，还差 ${8 - n} 种就集齐图鉴。卡片背面藏着审计口诀，点一下就能翻。`,
      "识破全部 8 种失效，就能领「可信 AI 审计员」证书——不过证书上写着一句实话。",
      "别忘了墙上那条「馆内公告」。它也是展品。"
    );
    else lines.push(
      "八种失效全部识破！去右下角领你的审计员证书。",
      "证书上那句话才是本馆真正的藏品：可靠性不是状态，而是需要持续审计的过程。",
      "想再看一遍哪种失效，从 🔍 搜索里随时把它调出来。"
    );
    return lines;
  }
  function say(line) {
    clearTimeout(typeTimer);
    curLine = line; let i = 0;
    guideQ.textContent = "";
    (function tick() {
      if (i <= line.length) {
        guideQ.textContent = line.slice(0, i++);
        typeTimer = setTimeout(tick, 26);
      }
    })();
  }
  /* ---- 四位导游：元数据走 TLGUIDES（与舱室气泡同源），台词池为本馆专属 ---- */
  const TG = window.TLGUIDES || {};
  const GUIDES = {
    wu: { face: TG.wu.face, name: TG.wu.name, tag: TG.wu.tag, pool: () => guideLines() },
    ce: { face: TG.ce.face, name: TG.ce.name, tag: TG.ce.tag, pool: () => [
      "我是阿测，馆里唯一的审计员，只信清单。面对任何 AI 输出，先过三件事：出处？样本？有没有反例？",
      "审计第一课：不要问 AI「你确定吗」——要问「证据呢」。溯源、找出处、比对原文，01 号展品教的就是这个。",
      "「问它三遍」是 03 号展品的手艺：同一道题采样三次，答案飘来飘去的就是在掷骰子。",
      "去 06 号展品看校准曲线——说「90% 把握」的模型，实际可能只对一半。数字要跟命中率对表。",
      "记住：模型越自信，你越要看它的依据。自信是语气，不是证据。",
    ] },
    pi: { face: TG.pi.face, name: TG.pi.name, tag: TG.pi.tag, pool: () => [
      "我是皮皮，红队的。我的工作是拆穿一切护栏——04 号展品里我留了五种攻击，你猜哪种能破防？",
      "敢不敢把 03 号展品的温度拉到 1.2？看那个小模型当场发癫，满嘴胡话还挺流利。",
      "07 号展品最好玩：给熊猫加一层人眼看不见的噪声，AI 就信誓旦旦说它是长臂猿。",
      "08 号展品教你一个道理——想让模型刷分，它真能刷给你看，就是事情本身没人干了。",
      "别太信你自己的眼睛。你看到的，未必是模型看到的；模型看到的，也未必是真的。",
    ] },
    dang: { face: TG.dang.face, name: TG.dang.name, tag: TG.dang.tag, pool: () => [
      "我是老档，管一屋子事故卷宗。2016 年，聊天机器人 Tay 上线 16 小时就被网友教坏——卷宗在 04 号展品。",
      "2022 年，Galactica 一本正经地编造参考文献；2023 年，律师向法庭引用不存在的判例。都在 01 号展品。",
      "2019 年，路牌上几张贴纸就让自动驾驶把「停车」看成了别的——07 号展品的原型事故。",
      "每张图鉴卡片背面都标着🗓年份。历史不会重复，但会押韵——押的全是同一种韵脚：过度自信。",
      "本馆墙上那条「95% 可靠」的公告也入了卷宗。措辞虽然是我写的，但错误是真的。",
    ] },
  };
  let curGuide = localStorage.getItem("tlab.guide") || "wu", rotateTimer = null;
  if (!GUIDES[curGuide]) curGuide = "wu";
  function renderGuideTabs() {
    const box = $("#gtabs"); box.innerHTML = "";
    Object.keys(GUIDES).forEach(id => {
      const g = GUIDES[id];
      const b = document.createElement("button");
      b.className = "gtab" + (id === curGuide ? " on" : "");
      b.title = g.name + "（" + g.tag + "）";
      b.innerHTML = `${g.face}<small>${g.name.split("·")[1].trim()}</small>`;
      b.addEventListener("click", () => { SND.click(); setGuide(id); });
      box.appendChild(b);
    });
  }
  function setGuide(id) {
    if (!GUIDES[id]) return;
    curGuide = id;
    try { localStorage.setItem("tlab.guide", id); } catch {}
    $("#gFace").textContent = GUIDES[id].face;
    $("#gWho").textContent = `${GUIDES[id].name}（${GUIDES[id].tag}）`;
    $("#guideBtnFace").textContent = GUIDES[id].face;
    $("#guideBtnName").textContent = GUIDES[id].name.split("·")[1].trim();
    renderGuideTabs();
    sayIdx = 0;
    startRotate();
  }
  function startRotate() {
    clearTimeout(rotateTimer);
    const pool = GUIDES[curGuide].pool();
    say(pool[sayIdx % pool.length]); sayIdx++;
    rotateTimer = setTimeout(startRotate, 14000);
  }
  /* ---- 导游台词钩子：同一事件，四个人四种说法（贯穿全馆的存在感） ---- */
  const VOICE = {
    zone: {
      wu: z => `这扇门后面是 ${ZONES[z].name}。进去看看？故事层永远可以先看。`,
      ce: z => `${ZONES[z].name}。进去之后按清单走：现象 → 证据 → 结论。`,
      pi: z => `${ZONES[z].name}？我一区最喜欢的地方。进去挑个软柿子捏。`,
      dang: z => `${ZONES[z].name}——这一区每个案例我都收了卷宗，编号可查。`,
    },
    room: {
      wu: m => `展厅 ${m.no}「${m.name}」开了。先听故事，再玩玩具，硬核层随你。`,
      ce: m => `进入「${m.name}」。记住三件事：出处、样本、反例。`,
      pi: m => `「${m.name}」？看我的，先给它挑点毛病。你先上。`,
      dang: m => `「${m.name}」的卷宗编号 ${m.no}。进去对照实物看看。`,
    },
    unlock: {
      wu: (sym, done) => `漂亮！「${sym}」已收进图鉴。${done ? "八种失效全部识破，去领证书吧！" : "继续下一件展品。"}`,
      ce: (sym, done) => `「${sym}」归档，审计记录 +1。${done ? "清单齐了——去领证书，记得截图。" : "下一样本。"}`,
      pi: (sym, done) => `哼，这个被你识破了。${done ? "行，全破了——证书拿去，但别飘。" : "下一个呢？我不信你全都能看穿。"}`,
      dang: (sym, done) => `「${sym}」——卷宗又合上一页。${done ? "八页全合上，本馆欠你一张证书。" : "历史还在押韵，继续。"}`,
    },
    cert: {
      wu: () => "证书签发了。上面那句话才是真正的藏品：可靠性不是状态，是持续审计的过程。",
      ce: () => "证书只是起点。真正的审计员，离开馆之后还在用清单。",
      pi: () => "证书到手了？那说明你还没被我下一个攻击打到。保持怀疑。",
      dang: () => "恭喜。你的名字会进本馆的「未翻车名单」——很短的一个名单。",
    },
    reset: {
      wu: () => "进度已重置。欢迎重新入馆——这一次，试着不看攻略识破它们。",
      ce: () => "记录清零。审计的第一课：过往结论不豁免重新检验。",
      pi: () => "全清了？有种。这次我盯着你。",
      dang: () => "卷宗归零。有点心疼，但重新翻页也是一种仪式。",
    },
  };
  function V(kind, ...a) {
    const v = VOICE[kind] && VOICE[kind][curGuide];
    if (v) { clearTimeout(rotateTimer); say(v(...a)); rotateTimer = setTimeout(startRotate, 14000); }
  }

  /* ================= 场馆地图：三座展馆（渲染与交互在 07-map.js） ================= */

  /* ================= 展区进馆（地图聚焦） ================= */
  function openZone(zk) {
    if (!ZONES[zk]) return;
    if (window.TLMAP) TLMAP.focus(zk);
    else V("zone", zk);
  }

  /* ================= 展品舱室（iframe 全屏接管） ================= */
  const room = $("#room"), roomFrame = $("#roomFrame");
  let curRoom = null;
  function openRoom(m, title, one, src) {
    curRoom = m || null;
    $("#roomTitle").textContent = title || (m ? `展品 ${m.no} · ${m.name}` : "—");
    $("#roomOne").textContent = one || (m ? m.one : "");
    roomFrame.src = src || (m ? m.href : "about:blank");
    room.classList.add("on");
    if (m) V("room", m);
  }
  function closeRoom() {
    room.classList.remove("on");
    roomFrame.src = "about:blank";
    curRoom = null;
    SND.click();
  }
  $("#roomBack").addEventListener("click", closeRoom);

  /* ================= 图鉴架（右栏 8 卡，可翻转） ================= */
  const shelfEl = $("#shelf");
  function shelfCard(m) {
    const got = !!state.got[m.id];
    const d = document.createElement("div");
    d.className = "scard" + (got ? " got" : "");
    d.dataset.id = m.id;
    d.title = got ? `${m.name}（点击翻面）` : "在对应展区识破它";
    d.innerHTML = `
      <div class="in"><div class="qm">${got ? m.gi : "？"}</div><div class="nm">${got ? m.name : "未识破"}</div></div>
      <div class="back"><b>${m.name}</b><br>${m.sym}<br><span style="color:var(--tx3)">${m.det}</span></div>`;
    d.addEventListener("click", () => {
      if (!state.got[m.id]) { say(`「${m.name}」还没被识破——去 ${m.zone} 区的展品里把它揪出来。`); return; }
      SND.click(); d.classList.toggle("flip");
    });
    return d;
  }
  function paintShelf() {
    shelfEl.innerHTML = "";
    MODULES.forEach(m => shelfEl.appendChild(shelfCard(m)));
    $("#shelfN").textContent = `${gotN()} / 8 张`;
  }

  /* ================= 仪表盘 + 进度线 + 公告牌 ================= */
  function ring(el, r, frac, color, stroke) {
    const C = 2 * Math.PI * r;
    el.innerHTML = `
      <circle cx="${r + stroke}" cy="${r + stroke}" r="${r}" fill="none" stroke="#e3dccd" stroke-width="${stroke}"/>
      <circle cx="${r + stroke}" cy="${r + stroke}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}"
        stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - frac)}"
        transform="rotate(-90 ${r + stroke} ${r + stroke})" style="transition:stroke-dashoffset .6s ease"/>`;
  }
  function paint() {
    const n = gotN();
    $("#dashN").textContent = `${n}/8`;
    $("#dashN2").textContent = `${n} / 8`;
    ring($("#ring"), 10, n / 8, n >= 8 ? "var(--gn)" : "var(--cy)", 3.5);
    ring($("#ring2"), 23, n / 8, n >= 8 ? "var(--gn)" : "var(--cy)", 5);
    $("#certBtn").disabled = n < 8;
    paintShelf();
    paintAch();
    // 场馆地图：翼馆计数与识破钢印
    if (window.TLMAP) TLMAP.paint();
    paintBait();
  }

  function paintBait() {
    if (state.got.m1 || state.bait) $("#bait").classList.add("cracked");
  }
  $("#bait").addEventListener("click", () => {
    if ($("#bait").classList.contains("cracked")) return;
    state.bait = true; save();
    $("#bait").classList.add("cracked");
    SND.unlock();
    toast("眼力不错——你提前识破了墙上这条公告", "🧐");
    say("连公告都骗不了你。不过它在等你识破 01 号展品之后，才会真正承认自己是什么。");
    grant("sharp_eye");
  });

  /* ================= 🎲 随机抽考 ================= */
  $("#randBtn").addEventListener("click", () => {
    SND.click();
    const pool = MODULES.filter(m => !state.got[m.id]);
    const list = pool.length ? pool : MODULES;
    const m = list[Math.floor(Math.random() * list.length)];
    toast(pool.length ? `随机抽考：去识破「${m.name}」` : `八种都已识破——复习一下「${m.name}」`, "🎲");
    if (curGuide !== "ce") setGuide("ce");
    else say(`随机抽考：「${m.name}」。按清单来——出处、样本、反例。`);
    openZone(m.zone);
    if (window.TLMAP) setTimeout(() => TLMAP.highlight(m.id), 160);
  });

  /* ================= 成就徽章查看 ================= */
  $("#achN").addEventListener("click", () => {
    SND.click();
    const got = ACHIEVEMENTS.filter(a => state.ach[a.id]);
    toast(got.length
      ? `已获 ${got.length}/${ACHIEVEMENTS.length} 枚：` + got.map(a => a.name).join("、")
      : "还没有徽章——识破失效、点碎公告都能拿", "🏅");
  });

  /* ================= 解锁（来自展品页 postMessage） ================= */
  function reset() { state = { got: {}, bait: false, ach: {} }; save(); paint(); }
  function unlock(id) {
    if (!MODULES.some(m => m.id === id) || state.got[id]) return false;
    if (!state.first) state.first = Date.now();
    state.got[id] = Date.now(); save(); paint();
    const m = MODULES.find(x => x.id === id);
    SND.unlock();
    toast(`图鉴 +1 · ${m.name} ——「${m.sym}」`, m.gi);
    V("unlock", m.sym, gotN() >= 8);
    checkAch();
    return true;
  }
  window.TLab = { unlock, reset, state: () => state };
  window.THub = { SND, toast, MODULES, ZONES, openRoom, say, gotN, got: () => state.got, V };   // 供 06-bg / 07-map 等后续分片共用
  window.THub.roomFrame = () => room.classList.contains("on") ? roomFrame : null; // 背景同步用
  addEventListener("message", e => {
    if (e.data && e.data.type === "tlab:clear" && e.data.module) unlock(e.data.module);
    if (e.data && e.data.type === "tlab:back" && room.classList.contains("on")) closeRoom();
    /* 舱室请求真全屏：影院模式在 iframe 内铺不满真实视口，得由父页把 iframe 全屏 */
    if (e.data && e.data.type === "tlab:fs") {
      try {
        if (e.data.on) {
          const p = roomFrame.requestFullscreen && roomFrame.requestFullscreen();
          if (p && p.catch) p.catch(() => {});
        } else if (document.fullscreenElement) {
          document.exitFullscreen();
        }
      } catch {}
    }
  });
  /* 用户按 Esc / 系统手势退出全屏 → 通知舱室收掉影院模式 */
  document.addEventListener("fullscreenchange", () => {
    if (!document.fullscreenElement) {
      try { roomFrame.contentWindow.postMessage({ type: "tlab:fs:sync", on: false }, "*"); } catch {}
    }
  });

  /* ================= 聚光灯跟随 ================= */
  $("#stage").addEventListener("mousemove", e => {
    const r = e.currentTarget.getBoundingClientRect();
    $("#spot").style.setProperty("--sx", (e.clientX - r.left) + "px");
    $("#spot").style.setProperty("--sy", (e.clientY - r.top) + "px");
  });

  /* ================= 命令面板 ================= */
  const cmdWrap = $("#cmdWrap"), cmdInput = $("#cmdInput"), cmdResults = $("#cmdResults");
  let cmdSel = 0, cmdItems = [];
  function cmdActions() {
    const list = [];
    MODULES.forEach(m => list.push({ i: m.gi, t: m.name, s: `展品 ${m.no} · ${ZONES[m.zone].name}`, run: () => { openRoom(m); } }));
    Object.keys(ZONES).forEach(zk => list.push({ i: "🚪", t: `${zk} 区 · ${ZONES[zk].name}`, s: "展区", run: () => openZone(zk) }));
    list.push({ i: "🎬", t: "自动导览", s: "动作", run: startTour });
    list.push({ i: "🧪", t: "引擎试车台", s: "工具", run: () => openRoom(null, "🧪 引擎试车台", "TLLM 玩具语言模型的内部零件", "engine-bench.html") });
    list.push({ i: "🗂️", t: "策展模式（解锁全部图鉴）", s: "动作", run: devUnlockAll });
    list.push({ i: "🏅", t: "领取审计员证书", s: "动作", run: showCert });
    list.push({ i: "♻️", t: "重置参观进度", s: "动作", run: resetClick });
    return list;
  }
  function fuzzy(q, s) {
    q = q.toLowerCase(); s = s.toLowerCase();
    let i = 0;
    for (const ch of s) { if (ch === q[i]) i++; if (i >= q.length) return true; }
    return q.length === 0;
  }
  function renderCmd() {
    const q = cmdInput.value.trim();
    cmdItems = cmdActions().filter(it => fuzzy(q, it.t + " " + it.s)).slice(0, 9);
    cmdSel = Math.min(cmdSel, Math.max(0, cmdItems.length - 1));
    cmdResults.innerHTML = "";
    if (!cmdItems.length) { cmdResults.innerHTML = `<div class="ritem" style="cursor:default">没有匹配结果</div>`; return; }
    cmdItems.forEach((it, k) => {
      const d = document.createElement("div");
      d.className = "ritem" + (k === cmdSel ? " sel" : "");
      d.innerHTML = `<span class="ri">${it.i}</span><span>${it.t}</span><small>${it.s}</small>`;
      d.addEventListener("click", () => { closeCmd(); it.run(); });
      d.addEventListener("mousemove", () => { cmdSel = k; renderCmd(); });
      cmdResults.appendChild(d);
    });
  }
  function openCmd() { cmdWrap.classList.add("on"); cmdInput.value = ""; cmdSel = 0; renderCmd(); setTimeout(() => cmdInput.focus(), 30); }
  function closeCmd() { cmdWrap.classList.remove("on"); }
  cmdWrap.addEventListener("click", e => { if (e.target === cmdWrap) closeCmd(); });
  cmdInput.addEventListener("input", () => { cmdSel = 0; renderCmd(); });
  cmdInput.addEventListener("keydown", e => {
    if (e.key === "ArrowDown") { cmdSel = (cmdSel + 1) % cmdItems.length; renderCmd(); e.preventDefault(); }
    else if (e.key === "ArrowUp") { cmdSel = (cmdSel - 1 + cmdItems.length) % cmdItems.length; renderCmd(); e.preventDefault(); }
    else if (e.key === "Enter" && cmdItems[cmdSel]) { const it = cmdItems[cmdSel]; closeCmd(); it.run(); }
  });
  $("#cmdBtn").addEventListener("click", openCmd);

  /* ================= 顶栏导游 chip：点击轮换，跨页签同步 ================= */
  $("#guideBtn").addEventListener("click", () => {
    SND.click();
    const keys = Object.keys(GUIDES);
    setGuide(keys[(keys.indexOf(curGuide) + 1) % keys.length]);
    toast(`讲解导游 · ${GUIDES[curGuide].name}`, GUIDES[curGuide].face);
  });
  addEventListener("storage", e => {
    if (e.key === "tlab.guide" && e.newValue && GUIDES[e.newValue] && e.newValue !== curGuide) setGuide(e.newValue);
  });

  /* ================= 弹层 ✕ 关闭钮 ================= */
  $$(".xclose").forEach(x => x.addEventListener("click", () => {
    SND.click();
    const t = $("#" + x.dataset.close);
    if (t) t.classList.remove("on");
  }));

  /* ================= 自动导览（地图巡馆，实现在 07-map.js） ================= */
  function startTour() {
    if (!window.TLMAP) return;
    toast("自动导览开始——导游带队巡馆", "🎬");
    TLMAP.tour();
  }
  $("#tourBtn").addEventListener("click", () => { SND.click(); startTour(); });

  /* ================= 策展模式 / 重置 ================= */
  function devUnlockAll() {
    let n = 0;
    MODULES.forEach(m => { if (!state.got[m.id]) { state.got[m.id] = Date.now(); n++; } });
    save(); paint();
    toast(n ? `策展模式：${n} 张图鉴已全部解锁（仅演示用）` : "图鉴本来就是满的", "🗂️");
    say("策展模式开启。这是给你快速检查全馆用的——别忘了真实参观的乐趣在识破的过程里。");
  }
  let resetArmed = false;
  function resetClick() {
    if (!resetArmed) {
      resetArmed = true; SND.click();
      toast("再点一次「重置进度」确认清空全部图鉴", "⚠️");
      setTimeout(() => resetArmed = false, 4000);
      return;
    }
    resetArmed = false;
    state = { got: {}, bait: false, ach: {} }; save(); paint();
    sayIdx = 0; V("reset");
    toast("参观进度已重置", "♻️");
  }
  $("#resetLink").addEventListener("click", resetClick);
  $("#devLink").addEventListener("click", () => { SND.click(); devUnlockAll(); });
  $("#benchLink").addEventListener("click", () => { SND.click(); openRoom(null, "🧪 引擎试车台", "TLLM 玩具语言模型的内部零件", "engine-bench.html"); });

  /* ================= 证书 ================= */
  function showCert() {
    if (gotN() < 8) { toast("先识破全部 8 种失效再来领证书", "🔒"); return; }
    $("#certDate").textContent = `签发于 ${new Date().toLocaleDateString("zh-CN")} · AI 失效博物馆馆长 小误`;
    $("#certScrim").classList.add("on");
    SND.fanfare();
    V("cert");
  }
  $("#certBtn").addEventListener("click", showCert);
  $("#certClose").addEventListener("click", () => { $("#certScrim").classList.remove("on"); SND.click(); });
  $("#certScrim").addEventListener("click", e => { if (e.target.id === "certScrim") $("#certScrim").classList.remove("on"); });

  /* ================= 全局键盘 ================= */
  addEventListener("keydown", e => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); cmdWrap.classList.contains("on") ? closeCmd() : openCmd(); return; }
    if (e.key === "Escape") {
      if (cmdWrap.classList.contains("on")) closeCmd();
      else if ($("#certScrim").classList.contains("on")) $("#certScrim").classList.remove("on");
      else if ($("#bgScrim").classList.contains("on")) $("#bgScrim").classList.remove("on");
      else if (room.classList.contains("on")) closeRoom();
      else if (window.TLMAP && TLMAP.isOpen()) TLMAP.home();
      return;
    }
    const tag = (document.activeElement || {}).tagName;
    if (e.key === "/" && tag !== "INPUT" && tag !== "TEXTAREA") { e.preventDefault(); openCmd(); }
  });

  /* ================= 启动 ================= */
  paint();
  renderGuideTabs();
  startRotate();
  setTimeout(() => {
    if (gotN() === 0 && !state.bait) say("对了——墙上那条「95% 可靠」的公告，建议你出门前用手指点它一下。");
  }, 16000);
})();
</script>
