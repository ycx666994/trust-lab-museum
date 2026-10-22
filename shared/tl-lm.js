/* ============================================================
 * AI 可信实验室 · 玩具语言模型引擎（TLLM）
 * ------------------------------------------------------------
 * 一个跑在浏览器里的字符级 n-gram 语言模型。它很小，但每个
 * 环节都是真的：
 *   - 采样：真实 softmax(logits/T) + top-p，mulberry32 定种子
 *   - 温度：对退火回退得到的概率做真实温度缩放
 *   - 水印：Kirchenbauer 绿/红名单方案的字符版——按上下文哈希
 *           划定绿名单，偏向采绿 → 检测端统计绿占比算 z-score
 *   - 检测：z = (k - γn) / sqrt(nγ(1-γ))，与论文同型
 * 纯函数 + 定种子 ⇒ 同参数永远同输出（「可复现的失效」）。
 * ============================================================ */
window.TLLM = (function () {
  "use strict";

  /* ---------- 随机与哈希 ---------- */
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function fnv1a(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  }

  /* ---------- 语言模型 ---------- */
  class TinyLM {
    constructor(corpus, order) {
      this.order = order || 4;          // 上下文最多用 order-1 个字符
      this.tables = [];                 // tables[L]: 上下文长 L → (字 → 计数)
      for (let L = 0; L < this.order; L++) this.tables.push(new Map());
      for (let i = 0; i < corpus.length; i++) {
        for (let L = 0; L < this.order; L++) {
          if (i - L < 0) continue;
          const ctx = corpus.slice(i - L, i);
          const ch = corpus[i];
          let m = this.tables[L].get(ctx);
          if (!m) { m = new Map(); this.tables[L].set(ctx, m); }
          m.set(ch, (m.get(ch) || 0) + 1);
        }
      }
      this.totals = [];                 // totals[L]: 上下文 → 该上下文总计数（预计算，避免热路径 forEach）
      for (let L = 0; L < this.order; L++) {
        const t = new Map();
        this.tables[L].forEach((m, ctx) => {
          let s = 0; m.forEach(v => s += v);
          t.set(ctx, s);
        });
        this.totals.push(t);
      }
      this.vocab = [...new Set(corpus)].filter(c => c !== "\n");
      this.stats = { chars: corpus.length, vocab: this.vocab.length };
    }

    /* 愚蠢回退：从最长上下文往回退，退一次打 0.4 折 */
    _score(ctx, ch) {
      let f = 1;
      for (let L = Math.min(this.order - 1, ctx.length); L >= 0; L--) {
        const k = ctx.slice(ctx.length - L);
        const m = this.tables[L].get(k);
        if (m && m.has(ch)) return f * (m.get(ch) / this.totals[L].get(k));
        f *= 0.4;
      }
      return 0;
    }

    /* 下一步候选分布（含水印偏置 + 温度 + top-p），返回 [{ch, p, green}] */
    nextDist(ctx, o) {
      o = o || {};
      const T = Math.max(0.05, o.temperature != null ? o.temperature : 1);
      const topP = o.topP != null ? o.topP : 1;
      const wm = o.wm || null;
      const ctxKey = ctx.slice(-(this.order - 1));
      let cand = this.vocab.map(ch => {
        const p0 = this._score(ctx, ch);
        let logit = Math.log(Math.max(p0, 1e-7));
        const green = wm ? this.isGreen(wm.key, ctxKey, ch, wm.gamma) : false;
        if (green) logit += wm.delta;
        return { ch, logit, green };
      });
      let mx = -Infinity;
      cand.forEach(c => { if (c.logit > mx) mx = c.logit; });
      let sum = 0;
      cand.forEach(c => { c.w = Math.exp((c.logit - mx) / T); sum += c.w; });
      cand.forEach(c => { c.p = c.w / sum; });
      if (topP < 1) {
        cand.sort((a, b) => b.p - a.p);
        let acc = 0, cut = cand.length;
        for (let i = 0; i < cand.length; i++) {
          acc += cand[i].p;
          if (acc >= topP) { cut = i + 1; break; }
        }
        cand = cand.slice(0, cut);
        const s2 = cand.reduce((a, c) => a + c.p, 0);
        cand.forEach(c => { c.p /= s2; });
      }
      return cand;
    }

    _pick(cand, rng) {
      let r = rng(), acc = 0;
      for (let i = 0; i < cand.length; i++) {
        acc += cand[i].p;
        if (r <= acc) return cand[i];
      }
      return cand[cand.length - 1];
    }

    /* 生成。定种子 ⇒ 完全可复现。
       T < 0.2 时走贪心（argmax，等价真实 LLM 的 greedy decoding / T→0）：
       n-gram 计数常有并列，若仍掷骰子，「低温=复读」的教学人设会崩。 */
    generate(o) {
      o = o || {};
      const T = Math.max(0.05, o.temperature != null ? o.temperature : 1);
      const greedy = T < 0.2;
      const rng = mulberry32(o.seed != null ? o.seed : 20261018);
      let ctx = (o.prompt || "").slice(-(this.order - 1));
      const len = o.len || 140;
      const minLen = o.minLen != null ? o.minLen : Math.floor(len * 0.6);
      let out = "", lastTop = null;
      for (let i = 0; i < len; i++) {
        const cand = this.nextDist(ctx, o);
        const picked = greedy
          ? cand.reduce((a, b) => (b.p > a.p ? b : a))
          : this._pick(cand, rng);
        lastTop = cand.slice().sort((a, b) => b.p - a.p).slice(0, 5);
        if (picked.ch === "\n") {
          if (out.length >= minLen) break; else continue;
        }
        out += picked.ch;
        ctx = (ctx + picked.ch).slice(-(this.order - 1));
      }
      return { text: out, lastTop };
    }

    /* ---------- 水印 ---------- */
    /* 上下文哈希 → 该字的绿/红归属。嵌入与检测共用同一判定。 */
    isGreen(key, ctxKey, ch, gamma) {
      const h = fnv1a(key + "\u0001" + ctxKey + "\u0001" + ch);
      return h / 4294967296 < (gamma != null ? gamma : 0.5);
    }
    embed(o) {
      o = o || {};
      const g = o.gamma != null ? o.gamma : 0.5;
      return this.generate({
        prompt: o.prompt, len: o.len, seed: o.seed,
        temperature: o.temperature, topP: o.topP,
        wm: { key: o.key || "trustlab", gamma: g, delta: o.delta != null ? o.delta : 2.5 }
      });
    }
    /* 检测：绿占比 + z-score。z 越高越像「盖过章的」 */
    detect(text, o) {
      o = o || {};
      const key = o.key || "trustlab";
      const gamma = o.gamma != null ? o.gamma : 0.5;
      const K = this.order - 1;
      let n = 0, k = 0;
      for (let i = K; i < text.length; i++) {
        const ch = text[i];
        if (ch === "\n") continue;
        const ctxKey = text.slice(i - K, i);
        const h = fnv1a(key + "\u0001" + ctxKey + "\u0001" + ch);
        n++;
        if (h / 4294967296 < gamma) k++;
      }
      if (n < 5) return { n: 0, k: 0, frac: 0, z: 0 };
      const frac = k / n;
      const z = (k - gamma * n) / Math.sqrt(n * gamma * (1 - gamma));
      return { n, k, frac, z };
    }
  }

  return { TinyLM, mulberry32, fnv1a };
})();
