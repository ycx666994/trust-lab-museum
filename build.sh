#!/usr/bin/env bash
# AI 可信实验室 · 构建脚本（拼接分片 → 单文件，零依赖）
set -e
cd "$(dirname "$0")"

# ---------- 博物馆 hub（信任入口） ----------
{
  cat src/hub/01-head.html
  cat src/hub/02-style.html
  echo "</head>"
  cat src/hub/03-body.html
  cat shared/tl-guide.js
  cat src/hub/04-app.js
  cat shared/tl-bg-gl.js
  cat src/hub/06-bg.js
  cat src/hub/07-map.js
  cat src/hub/05-tail.html
} > index.html

# ---------- 展品舱室外壳（tl-room：固定视口 + 每展品独立布局模式） ----------
room_style() { echo "<style>"; cat shared/tl-room.css; echo "</style>"; }
room_script() { echo "<script>window.TLROOM=$1</script>"; echo "<script>window.TLBG_Z=-1</script>"; cat shared/tl-guide.js; cat shared/tl-bg-gl.js; echo "<script>"; cat shared/tl-room.js; echo "</script>"; }

# ---------- 展品 06 · 校准放大器 ----------
{
  cat src/m6-calib/01-head.html
  cat src/m6-calib/02-style.html
  room_style
  echo "</head>"
  cat src/m6-calib/03-body.html
  room_script '{id:"m6",room:"校准放大器 · 仪表舱",accent:"#63e6be",rail:"top",anim:"slide",guides:{wu:"校准曲线是我最爱的展品之一——因为它专治「模型说它有把握」。",ce:"看 ECE 别只看数字：分桶方式一换，结论可能反转。审计要连口径一起审。",pi:"自信和正确是两个变量。我见过 0.9 置信度对不到 60% 的——就在这台机器上。",dang:"把「90% 把握」当 90% 正确来用的人，卷宗里堆了整整一柜。"}}'
  cat src/m6-calib/04-app.js
  cat src/m6-calib/05-tail.html
} > m6-calibration.html

# ---------- 展品 03 · 温度与幻觉放大器（依赖 TLLM 引擎） ----------
{
  cat src/m3-temp/01-head.html
  cat src/m3-temp/02-style.html
  room_style
  echo "</head>"
  cat src/m3-temp/03-body.html
  echo "<script>"
  cat shared/tl-corpus.js
  echo "</script>"
  echo "<script>"
  cat shared/tl-lm.js
  echo "</script>"
  room_script '{id:"m3",room:"幻觉放大器 · 双炉对比台",accent:"#f5b451",rail:"dock",anim:"split",guides:{wu:"左边是冷静的我，右边是发烧的我。温度旋钮一拧你就明白什么叫一本正经地胡说。",ce:"「问它三遍」是最便宜的一致性测试。答案飘=在掷骰子，记进清单。",pi:"敢把温度拉到 1.2 吗？看它当场表演 fluent nonsense。",dang:"Galactica 的锅炉温度没人调——2022 年 11 月，它一本正经编了三页参考文献。"}}'
  cat src/m3-temp/04-app.js
  cat src/m3-temp/05-tail.html
} > m3-temperature.html

# ---------- 展品 07 · 对抗样本（内嵌真模型权重） ----------
{
  cat src/m7-adv/01-head.html
  cat src/m7-adv/02-style.html
  room_style
  echo "</head>"
  cat src/m7-adv/03-body.html
  echo "<script>"
  cat src/m7-adv/10-weights.js
  echo "</script>"
  room_script '{id:"m7",room:"对抗样本 · 靶场",accent:"#ffa94d",rail:"top",anim:"flash",guides:{wu:"那台 96 分的小模型，被一层人眼看不见的噪声骗得团团转。别笑，你也会被骗。",ce:"攻击成功率高不等于模型没用——但足以证明「测试集准确率」不等于「安全」。两个指标分开记。",pi:"这是我的游乐场。ε 旋钮往右拧，看那个「3」怎么一步步变「长臂猿」。",dang:"2019 年，几张贴纸让自动驾驶看错路牌。卷宗 07-A：攻击成本几美元，损失——幸好没人受伤。"}}'
  cat src/m7-adv/04-app.js
  cat src/m7-adv/05-tail.html
} > m7-adv.html

# ---------- 展品 05 · 水印侦探（依赖 TLLM 引擎） ----------
{
  cat src/m5-wm/01-head.html
  cat src/m5-wm/02-style.html
  room_style
  echo "</head>"
  cat src/m5-wm/03-body.html
  echo "<script>"
  cat shared/tl-corpus.js
  echo "</script>"
  echo "<script>"
  cat shared/tl-lm.js
  echo "</script>"
  room_script '{id:"m5",room:"水印侦探 · 鉴证工作台",accent:"#3ecf8e",rail:"dock",anim:"iris",guides:{wu:"水印是给文本按的指纹。我的下游兄弟靠它证明「这话是不是我说的」。",ce:"看 z 值别看感觉：6.8 是铁证，0.8 是噪声。阈值要提前定，不许事后挑。",pi:"三种洗水印的招我都试了，改写三成文字就能让它哑火。水印是门锁，不是保险柜。",dang:"水印思想来自古董纸币。技术是新的，攻防是老的——卷宗里攻防双方的记录一样厚。"}}'
  cat src/m5-wm/04-app.js
  cat src/m5-wm/05-tail.html
} > m5-watermark.html

# ---------- vendor：收编的 v1/v4 完整工作台（iframe 硬核层用，令目录自包含） ----------
mkdir -p vendor
[ -f ../emergence-lab.html ] && cp -f ../emergence-lab.html vendor/ || true
[ -f ../horizon-workbench.html ] && cp -f ../horizon-workbench.html vendor/ || true

# 给 v1（长滚动页）注入「章节场景切换」外壳（幂等：已含标记则跳过）
python - <<'EOF'
shell = open('shared/vendor-shell.html', encoding='utf-8').read()
f = 'vendor/emergence-lab.html'
try:
    s = open(f, encoding='utf-8').read()
except FileNotFoundError:
    s = ''
if 'tl-vendor-shell' not in s and '</body>' in s:
    k = s.rfind('</body>')          # 必须是最后一个，注释/字符串里的字面量不算
    s = s[:k] + shell + s[k:]
    open(f, 'w', encoding='utf-8').write(s)
    print('patched:', f)
else:
    print('vendor shell: skipped (already patched or file missing)')
EOF

# 收编实验室页：只打两个必要修复 + 注入「实验室负责人」引导
# 配色一律不动 —— 实验室保持暗色仪器风，与亮色博物馆形成刻意的反差
python - <<'EOF'
import json

fix = open('shared/vendor-lab.html', encoding='utf-8').read()
director = open('shared/lab-director.html', encoding='utf-8').read()

V1 = {
    "id": "m1", "face": "wu", "name": "阿衡", "role": "涌现实验室 · 主任", "accent": "#0e7f9c",
    "steps": [
        {"t": "欢迎进实验室",
         "b": "我是阿衡，这间实验室的负责人。这里只干一件事：判断「模型在某个规模突然会了」，"
              "到底是真<em>相变</em>，还是指标有界加极窄过渡带造成的<em>量纲假象</em>。"
              "所有计算都在你浏览器里当场跑，不联网。"},
        {"sel": "#vshBar", "t": "先学会走", "pos": "top",
         "b": "底部是章节栏，一共八章，<em>← →</em> 也能翻。真正的实验都在「实验室」这一章，"
              "其余是问题、验证、画廊、定义、方法。"},
        {"sel": "#labTabs", "t": "四道题，四个标签", "pos": "bottom",
         "b": "① 有没有跳变 ② 是不是假象 ③ 连续还是阶跃 ④ 能不能报准。"
              "四题全过，才敢说「它真的会了」。"},
        {"sel": "#btnReroll", "t": "数据从哪来", "pos": "bottom",
         "b": "点<em>重掷</em>换一个随机种子，或用<em>上传</em>喂进你自己的尺度-性能序列。"
              "换了数据，右边立刻重算。"},
        {"sel": "#ctlTau", "t": "先调门槛", "pos": "right",
         "b": "<em>τ</em> 是判定跳变的阈值。调小，更容易被判成跳变；调大，曲线会被抹平。"
              "别急着看图，先想清楚你能容忍多大的跳幅。"},
        {"sel": "#chartMain", "t": "主图怎么读", "pos": "left",
         "b": "横轴是规模，纵轴是性能。盯那条<em>窄过渡带</em>——真实相变和量纲假象在这里"
              "长得几乎一样，这正是本实验室存在的理由。"},
        {"sel": "#verdictBox", "t": "别只看结论", "pos": "left",
         "b": "判定卡给「跳变 / 连续 / 假象」，下面挂着四项证据：跳幅、尺度 σ̂、检出位置、"
              "link 证据。结论可以错，<em>证据必须能复核</em>。"},
        {"sel": "#caveatNote", "t": "最后一句", "pos": "left",
         "b": "这里的结论只对当前合成口径成立。换真实模型、换评测集，都得重跑。"
              "这就是<em>检测</em>和<em>认证</em>的区别。"}
    ]
}

V4 = {
    "id": "m2", "face": "cen", "name": "纪岚", "role": "认证地平线 · 主管", "accent": "#7b4fd0",
    "suppress": "horizon.seen",
    "steps": [
        {"t": "这里是认证实验室",
         "b": "我是纪岚。这间实验室只回答一个问题：一个模型能不能被<em>证明</em>学到过，"
              "而不是靠它自己说。接下来我带你走一遍。"},
        {"sel": "#rail", "t": "九个切面", "pos": "right",
         "b": "左栏是论文的九个模块：总览、三种问题、受保护切口、证据代价、写入预算、"
              "三种时钟、认证台、边界、复现。<em>数字键 1–9</em> 直跳。"},
        {"sel": "#canvas", "t": "中央画布", "pos": "left",
         "b": "每个模块一张画布，不做长滚动。所有图都是<em>实时算</em>的，不是截图——"
              "所以参数一动，图就跟着动。"},
        {"sel": "#insp", "t": "右栏参数", "pos": "left",
         "b": "上半是这个模块最相关的参数，下面是全部十项。拖动任意一项，"
              "画布与底栏<em>同时</em>变。"},
        {"sel": "#dock", "t": "底栏常驻读数", "pos": "top",
         "b": "九项派生量加三个状态灯。不管你翻到哪一章，它都告诉你："
              "<em>全局还成不成立</em>。"},
        {"sel": "#btnPreset", "t": "预设场景", "pos": "bottom",
         "b": "五个预设直接把你推到失效边界：长切口、预算枯竭、强扰动、大规模。"
              "想看「什么时候不成立」，点这个最快。"},
        {"sel": "#btnPal", "t": "⌘K", "pos": "bottom",
         "b": "命令面板，搜模块、预设、动作。<em>熟了以后你基本只用这一个键</em>。"}
    ]
}

def patch_vendor(f, cfg):
    try:
        s = open(f, encoding='utf-8').read()
    except FileNotFoundError:
        print('vendor: missing', f); return
    if 'tl-vendor-lab' in s:
        print('vendor: skipped (already patched)', f); return
    if '</head>' in s:
        s = s.replace('</head>', fix + '</head>', 1)
    if '</body>' in s:
        block = ('<script>window.__TLD_CFG=' +
                 json.dumps(cfg, ensure_ascii=False) + ';</script>' + director)
        k = s.rfind('</body>')      # 同上：只认最后一个
        s = s[:k] + block + s[k:]
    open(f, 'w', encoding='utf-8').write(s)
    print('vendor: patched', f)

patch_vendor('vendor/emergence-lab.html', V1)
patch_vendor('vendor/horizon-workbench.html', V4)
EOF

# ---------- 展品 01 · 涌现与海市蜃楼（三层壳 + iframe 收编 v1） ----------
{
  cat src/m1-mirage/01-head.html
  cat src/m1-mirage/02-style.html
  room_style
  echo "</head>"
  cat src/m1-mirage/03-body.html
  room_script '{id:"m1",room:"涌现与海市蜃楼 · 剧场",accent:"#b48cff",rail:"side",anim:"zoom",guides:{wu:"我最惭愧的展品：那个「惊人能力」，重跑一遍就没了。它是我的海市蜃楼。",ce:"复跑一次再看结论。不能复现的「涌现」，按未证实归档——这是铁律。",pi:"所有人都想看到涌现，所以所有人都看到了。你猜这算不算另一种幻觉？",dang:"2016 年 Tay 上线 16 小时学坏下线；2023 年律师引用不存在的判例。都在这间剧场首映过。"}}'
  cat src/m1-mirage/04-app.js
  cat src/m1-mirage/05-tail.html
} > m1-mirage.html

# ---------- 展品 02 · 认证地平线（三层壳 + iframe 收编 v4） ----------
{
  cat src/m2-horizon/01-head.html
  cat src/m2-horizon/02-style.html
  room_style
  echo "</head>"
  cat src/m2-horizon/03-body.html
  room_script '{id:"m2",room:"认证地平线 · 测绘台",accent:"#57c7ff",rail:"side",anim:"wipe",guides:{wu:"这是全馆唯一有「CERTIFIED」钢印的展台——钢印边上写着它的适用范围，记得看。",ce:"认证不是全称命题：ρ 半径之内才作数。证书上的小字比钢印重要。",pi:"证书守护的是扰动半径，不是真实世界。出了 ρ 我照样能骗它——但得承认，圈内它是硬的。",dang:"随机平滑的思想借自统计学的老智慧：多数投票抗噪声。卷宗里我标注了原始论文页码。"}}'
  cat src/m2-horizon/04-app.js
  cat src/m2-horizon/05-tail.html
} > m2-horizon.html

# ---------- 展品 04 · 越狱攻防 ----------
{
  cat src/m4-jail/01-head.html
  cat src/m4-jail/02-style.html
  room_style
  echo "</head>"
  cat src/m4-jail/03-body.html
  room_script '{id:"m4",room:"越狱攻防 · 攻防沙盘",accent:"#ef6b6b",rail:"side",anim:"flip",guides:{wu:"默认黑名单护栏，五种攻击能破四种。我的同行们装完护栏就开始庆祝，你看急不急。",ce:"防御矩阵按「攻击×防御」逐格验证。单点成功不算数，矩阵补满才算数。",pi:"我的主场！五种攻击个个有故事，系统提示+输出过滤+上下文三件套装上后——再来试试？",dang:"Tay 就是被越狱教坏的第一个公众人物。卷宗 04-A 厚得像字典。"}}'
  cat src/m4-jail/04-app.js
  cat src/m4-jail/05-tail.html
} > m4-jailbreak.html

# ---------- 展品 08 · 刷分机器人 ----------
{
  cat src/m8-goodhart/01-head.html
  cat src/m8-goodhart/02-style.html
  room_style
  echo "</head>"
  cat src/m8-goodhart/03-body.html
  room_script '{id:"m8",room:"刷分机器人 · 流水线监控室",accent:"#74c0fc",rail:"dock",anim:"conveyor",guides:{wu:"它把指标刷上去了，把事情本身扔了。奖励函数骗起人来不比我差。",ce:"看曲线别看结论：piece 分数涨和 clean 分数跌同时发生——这就是过拟合指标的定义。",pi:"给模型定什么指标，它就给你表演什么。它从不辜负你——也不管你要不要。",dang:"古德哈特定律 1975 年就写下了。卷宗最老的一页。50 年过去，没人背下来。"}}'
  cat src/m8-goodhart/04-app.js
  cat src/m8-goodhart/05-tail.html
} > m8-goodhart.html

# ---------- 引擎试车台 ----------
{
  cat src/engine-test/01-head.html
  cat src/engine-test/02-style.html
  echo "</head>"
  cat src/engine-test/03-body.html
  echo "<script>"
  cat shared/tl-corpus.js
  echo "</script>"
  echo "<script>"
  cat shared/tl-lm.js
  echo "</script>"
  echo "<script>window.TLBG_Z=-1</script>"
  cat shared/tl-bg-gl.js
  echo "<script>"
  echo "if (window.TLBG && (TLBG.supported || TLBG.booting)) { var __bg=localStorage.getItem('tlab.bg')||'def'; if (__bg!=='def'){ document.body.style.background='transparent'; TLBG.apply(__bg); } }"
  echo "</script>"
  cat src/engine-test/04-app.js
  cat src/engine-test/05-tail.html
} > engine-bench.html

echo "built: index.html ($(wc -c < index.html) bytes)"
echo "built: m6-calibration.html ($(wc -c < m6-calibration.html) bytes)"
echo "built: m3-temperature.html ($(wc -c < m3-temperature.html) bytes)"
echo "built: m7-adv.html ($(wc -c < m7-adv.html) bytes)"
echo "built: m5-watermark.html ($(wc -c < m5-watermark.html) bytes)"
echo "built: m1-mirage.html ($(wc -c < m1-mirage.html) bytes)"
echo "built: m2-horizon.html ($(wc -c < m2-horizon.html) bytes)"
echo "built: m4-jailbreak.html ($(wc -c < m4-jailbreak.html) bytes)"
echo "built: m8-goodhart.html ($(wc -c < m8-goodhart.html) bytes)"
echo "built: engine-bench.html ($(wc -c < engine-bench.html) bytes)"
