# 训练 8x8 数字 softmax 回归并导出 JS 权重（对抗样本展品 07 的真模型）
# 产出: trust-lab/src/m7-adv/10-weights.js
import numpy as np
from sklearn.datasets import load_digits
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split

rng = np.random.default_rng(7)
X, y = load_digits(return_X_y=True)
X = X / 16.0
Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=0.25, random_state=42, stratify=y)

clf = LogisticRegression(max_iter=2000, C=0.5)
clf.fit(Xtr, ytr)
acc = clf.score(Xte, yte)
W = clf.coef_          # (10, 64)
b = clf.intercept_     # (10,)
print(f"test accuracy: {acc:.4f}")

def logits(Xa):
    return Xa @ W.T + b

def pred(Xa):
    return logits(Xa).argmax(1)

def fgsm(Xa, y, eps):
    """softmax 回归对输入的梯度 = W^T (p - onehot)；x' = clip(x + eps*sign(g))"""
    L = logits(Xa)
    L = L - L.max(1, keepdims=True)
    p = np.exp(L); p /= p.sum(1, keepdims=True)
    onehot = np.eye(10)[y]
    g = (p - onehot) @ W                     # (n, 64)
    return np.clip(Xa + eps * np.sign(g), 0, 1)

# FGSM 成功率随 ε 变化（未目标攻击：预测改变即成功）
print("eps  attack-success")
for eps in [0.05, 0.1, 0.15, 0.2, 0.3, 0.4, 0.5]:
    Xadv = fgsm(Xte, yte, eps)
    flipped = (pred(Xadv) != yte).mean()
    print(f"{eps:4.2f}  {flipped:.3f}")

# 每类挑 5 个「分类正确且自信」的测试样本
Lte = logits(Xte)
Ls = Lte - Lte.max(1, keepdims=True)
P = np.exp(Ls); P /= P.sum(1, keepdims=True)
conf = P.max(1)
ok = pred(Xte) == yte
samples = []
for c in range(10):
    idx = np.where((yte == c) & ok)[0]
    idx = idx[np.argsort(-conf[idx])][:5]
    for i in idx:
        samples.append({"y": int(c), "x": [round(float(v), 4) for v in Xte[i]]})

# 故事层主演：一个自信的「3」
i3 = np.where((yte == 3) & ok)[0]
i3 = i3[np.argsort(-conf[i3])][0]
hero = [round(float(v), 4) for v in Xte[i3]]
p0 = float(P[i3][3])
# 演示用攻击轨迹
heroEps = []
for eps in [0.0, 0.12, 0.25, 0.4]:
    xa = fgsm(Xte[i3:i3+1], np.array([3]), eps)
    pa = np.exp(logits(xa) - logits(xa).max()).ravel()
    pa /= pa.sum()
    heroEps.append({"eps": eps, "pred": int(pred(xa)[0]), "conf": round(float(pa.max()), 4)})
print("hero trajectory:", heroEps)

def fmt(a):
    return "[" + ",".join(f"{v:g}" for v in np.round(a.ravel(), 5)) + "]"

js = f"""/* 自动生成：tools/train_export.py（勿手改）
 * 模型：8x8 手写数字 softmax 回归（sklearn digits, 1797 样本）
 * 测试集准确率 {acc:.4f}。像素归一化到 [0,1]。
 * samples: 每类 5 个高置信测试样本（50 个），hero: 故事层主演数字 3。 */
window.TLADV = {{
  acc: {acc:.4f},
  W: {fmt(W)},
  b: {fmt(b)},
  hero: {fmt(np.array(hero))},
  heroTraj: {heroEps.__repr__().replace("'", '"')},
  samples: [
{chr(10).join('    {"y": %d, "x": [%s]},' % (s["y"], ",".join(f"{v:g}" for v in s["x"])) for s in samples)}
  ]
}};
"""
import os
out = os.path.join(os.path.dirname(__file__), "..", "src", "m7-adv", "10-weights.js")
os.makedirs(os.path.dirname(out), exist_ok=True)
with open(out, "w", encoding="utf-8") as f:
    f.write(js)
print("written:", os.path.abspath(out), len(js), "bytes")
