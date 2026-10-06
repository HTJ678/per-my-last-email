# per-my-last-email Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 构建 per-my-last-email —— 一个零依赖纯前端网页，把糙话转成体面/隐晦的中英双语措辞。

**Architecture:** 单页静态站点，无构建、无运行时依赖。核心逻辑（意图匹配 `matcher.js`、档位插值 `tone.js`）写成可在 Node 与浏览器双向运行的纯 ESM 函数，用 `node --test` 做 TDD；UI 层 `app.js` 只负责装配；可选 `pro.js` 调外部 API 并在失败时退回 Flash 结果。数据在 `data/phrases.json`。

**Tech Stack:** HTML/CSS/原生 JS (ESM)、`node --test`（零依赖）、本地 `dev-server.mjs` 预览、GitHub Pages 部署。

**约定：**
- 工作目录：`D:\OpenClaw-new\workspace\per-my-last-email`
- git 命令前需 `$env:Path += ';D:\Git\cmd'`
- 所有文件用 **node 写**（避免 PS 5.1 的 BOM/GBK 坑）；Windows 上用 `read`/`write` 工具，不用 `Set-Content`
- 测试命令：`node --test "tests/**/*.test.mjs"`

---

## Task 0: 项目骨架

**Files:**
- Create: `package.json`, `dev-server.mjs`, `index.html`, `styles.css`, `.gitignore`

**Step 1:** 写 `package.json`（零依赖，声明 ESM）

```json
{
  "name": "per-my-last-email",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "node dev-server.mjs",
    "test": "node --test \"tests/**/*.test.mjs\""
  }
}
```

**Step 2:** 写 `dev-server.mjs` —— 零依赖静态服务器，端口 **8125**，根目录 `.`，`.json` 用 `application/json`，其余按扩展名给 MIME，找不到回 404。

**Step 3:** 写最小 `index.html`（只有 `<h1>per-my-last-email</h1>` 和一个 `<script type="module" src="app.js">` 占位）与空 `styles.css`，`.gitignore` 写 `node_modules/`。

**Step 4:** 启动验证

Run: `node dev-server.mjs`（后台），然后 `curl.exe -s --noproxy "*" http://127.0.0.1:8125/`
Expected: 返回 HTML，含 `per-my-last-email`

**Step 5: Commit**

```bash
git add -A && git commit -m "chore: project scaffold"
```

---

## Task 1: tone.js —— 档位 → variant 选择（TDD）

**Files:**
- Create: `src/tone.js`, `tests/tone.test.mjs`

**设计：** 每个条目有 4 个 variant（tone: 0/33/66/100）。滑块给 0–100 的连续值，取**最近的 variant**（不做插值生成新句子，避免编造）。同时提供 `clampTone` 与 `nearestVariantIndex`。

**Step 1: 写失败的测试** `tests/tone.test.mjs`

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { clampTone, nearestVariantIndex, pickVariant } from "../src/tone.js";

const VARIANTS = [
  { tone: 0,   zh: "你怎么没回我", en: "You didn't reply." },
  { tone: 33,  zh: "回我一下哈",   en: "Just checking in." },
  { tone: 66,  zh: "烦请确认是否收到", en: "Please confirm receipt." },
  { tone: 100, zh: "好的呢，我按流程走", en: "Per my last email." },
];

test("clampTone 夹在 0-100", () => {
  assert.equal(clampTone(-20), 0);
  assert.equal(clampTone(140), 100);
  assert.equal(clampTone(66), 66);
});

test("nearestVariantIndex 取最近的档位", () => {
  assert.equal(nearestVariantIndex(VARIANTS, 0), 0);
  assert.equal(nearestVariantIndex(VARIANTS, 40), 1);
  assert.equal(nearestVariantIndex(VARIANTS, 100), 3);
  assert.equal(nearestVariantIndex(VARIANTS, 51), 2); // 51 距 33=18、距 66=15
});

test("pickVariant 返回整条 variant", () => {
  const v = pickVariant(VARIANTS, 100);
  assert.equal(v.en, "Per my last email.");
});
```

**Step 2: 跑测试确认失败**

Run: `node --test "tests/tone.test.mjs"`
Expected: FAIL —— `Cannot find module '../src/tone.js'`

**Step 3: 实现** `src/tone.js`

```js
export const TONE_STOPS = [0, 33, 66, 100];
export const TONE_LABELS = ["直白", "礼貌", "正式", "隐晦"];

export function clampTone(t) {
  const n = Number(t);
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

export function nearestVariantIndex(variants, tone) {
  const t = clampTone(tone);
  let best = 0, bestDist = Infinity;
  variants.forEach((v, i) => {
    const d = Math.abs(v.tone - t);
    if (d < bestDist) { bestDist = d; best = i; }
  });
  return best;
}

export function pickVariant(variants, tone) {
  return variants[nearestVariantIndex(variants, tone)];
}
```

**Step 4: 跑测试确认通过**

Run: `node --test "tests/tone.test.mjs"`
Expected: PASS（3 tests）

**Step 5: Commit**

```bash
git add src/tone.js tests/tone.test.mjs && git commit -m "feat(tone): tone level to variant mapping"
```

---

## Task 2: matcher.js —— 意图匹配（TDD）

**Files:**
- Create: `src/matcher.js`, `tests/matcher.test.mjs`

**设计：** 输入原话 + 话术库 → 打分排序，返回 `{ entry, score, matchedTags }` 数组。打分规则：
- `intent` 或任一 `tags` 的关键词在输入里出现 → 每条命中 +1
- 中文按子串匹配，英文按小写词匹配
- 归一化：去首尾空白、全角转半角、英文转小写
- 命中为空时返回空数组（UI 走降级提示）

**Step 1: 写失败的测试** `tests/matcher.test.mjs`

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalize, scoreEntry, match } from "../src/matcher.js";

const LIB = [
  { id: "no-reply", intent: "对方不回消息", keywords: ["回", "reply", "回我"], tags: ["delay"], variants: [] },
  { id: "refuse",   intent: "拒绝请求",     keywords: ["帮", "能不能", "help"],   tags: ["refuse"], variants: [] },
];

test("normalize 全角转半角并小写", () => {
  assert.equal(normalize("  Ｈｅｌｌｏ，Reply  "), "hello,reply");
});

test("scoreEntry 关键词命中加分", () => {
  assert.ok(scoreEntry("你怎么不回我", LIB[0]).score > 0);
  assert.equal(scoreEntry("今天天气不错", LIB[0]).score, 0);
});

test("match 按分数排序并过滤 0 分", () => {
  const r = match("能不能帮我一下", LIB);
  assert.equal(r.length, 1);
  assert.equal(r[0].entry.id, "refuse");
});

test("match 无命中返回空数组", () => {
  assert.deepEqual(match("zzzzz", LIB), []);
});
```

**Step 2: 跑测试确认失败** → `node --test "tests/matcher.test.mjs"`，Expected: FAIL（模块不存在）

**Step 3: 实现** `src/matcher.js`

```js
export function normalize(s) {
  return String(s ?? "")
    .replace(/[\uFF01-\uFF5E]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    .replace(/[\s，。！？、,\.!\?]/g, "")
    .trim()
    .toLowerCase();
}

export function scoreEntry(input, entry) {
  const q = normalize(input);
  const hits = [];
  for (const kw of entry.keywords ?? []) {
    if (q.includes(normalize(kw))) hits.push(kw);
  }
  if (q.includes(normalize(entry.intent))) hits.push(entry.intent);
  return { score: hits.length, matched: hits, entry };
}

export function match(input, lib) {
  return lib
    .map((e) => scoreEntry(input, e))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);
}
```

**Step 4: 跑测试确认通过** → PASS（4 tests）

**Step 5: Commit**

```bash
git add src/matcher.js tests/matcher.test.mjs && git commit -m "feat(matcher): intent matching with scoring"
```

---

## Task 3: 话术库 data/phrases.json（≥120 条）+ schema 测试

**Files:**
- Create: `data/phrases.json`, `tests/phrases.test.mjs`

**每条的硬约束（测试强制）：**
- 必含 `id`（唯一）、`intent`、`keywords`（≥1）、`scenarios`（≥1）、`variants`
- `variants` 恰好覆盖 tone `[0,33,66,100]` 四档，且 tone 严格递增
- 每条 variant 都有非空 `zh` 与 `en`
- 档位越高，"礼貌度"越高（由人写，测试只验结构，不验语义）

**覆盖场景（各 ≥15 条）：** 邮件催办、拒绝请求、表达不满、会议上被插话、对方拖延、要求改东西、客气地骂人、道歉、催对方回复、装作无所谓、划清边界、结束对话、请求延期、指出对方错误、冷处理。

**Step 1:** 写 `tests/phrases.test.mjs`：读 JSON，断言条数 ≥120、id 唯一、每条四档齐全、zh/en 非空、字段齐全。

**Step 2:** 跑 → FAIL（文件不存在）

**Step 3:** 写 `data/phrases.json` —— 分 4-6 批写（每批 20-30 条），**注意 JSON 逗号与引号必须合法**，中文标点用中文。写完跑测试。

**Step 4:** 跑 `node --test "tests/phrases.test.mjs"` → PASS

**Step 5: Commit**

```bash
git add data/phrases.json tests/phrases.test.mjs && git commit -m "feat(data): phrase library v1 with schema tests"
```

---

## Task 4: app.js + index.html —— Flash 全链路 UI

**Files:**
- Modify: `index.html`, `styles.css`
- Create: `app.js`

**UI 结构：**
- 顶部：标题 + `Flash | Pro` 分段开关（Pro 未填 key 时置灰）
- 输入区：`<textarea>` + 场景下拉（邮件 / 同事 / 朋友 / 评论区）
- 控件：语言单选（English / 中文 / 双语）、档位滑块（`input[type=range]`，上方四站标注，右侧实时显示当前档位名）
- 结果区：卡片列表（每条：语言两行 + 复制按钮）；未命中 → top-3 相近提示 + "开 Pro 试试"
- Pro 展开区：API key 输入（`type=password`）+ 模型选择 + "仅存本地"说明

**行为：**
- 输入/滑块/语言任一变化 → 防抖 200ms 重算
- 空输入 → 清空结果，不报错
- 复制按钮 → `navigator.clipboard.writeText`，成功后按钮文案变 "✓ 已复制" 1.5s

**Step 1:** 写 `index.html` 完整结构（含 `type="module"` 引入 app.js）
**Step 2:** 写 `app.js`：加载 `data/phrases.json`（fetch）、装配事件、调用 matcher+tone、渲染卡片
**Step 3:** 写 `styles.css`：深色简洁风，滑块与卡片是视觉重点，移动端单列
**Step 4:** 手动验证（起 dev-server，用 curl 确认 200；UI 交互在此任务末尾用浏览器开一次确认无 console 报错）
**Step 5: Commit** `feat(ui): flash mode end-to-end`

---

## Task 5: pro.js —— 可选 AI 增强 + 兜底

**Files:**
- Create: `src/pro.js`, `tests/pro.test.mjs`
- Modify: `app.js`（Pro 开启时调用，失败保留 Flash 结果）

**设计：**
- `buildPrompt(input, { scenario, tone, lang })` —— 纯函数，可测：要求模型输出严格 JSON：`{ zh: "...", en: "..." }`
- `enhance({ apiKey, baseUrl, model, ... })` —— fetch OpenAI 兼容接口，`AbortController` 8s 超时；任何失败 → `throw`，由 app.js catch 后保留 Flash 结果并在卡片角标 "Flash fallback"
- key 只从 `localStorage` 读，只发往 `baseUrl`

**Step 1:** 写测试：`buildPrompt` 含场景与档位、要求 JSON 输出；`parseEnhanceResponse` 对合法 JSON / 带 ```json 围栏 / 非法内容 三种输入的行为
**Step 2:** 跑 → FAIL
**Step 3:** 实现 `src/pro.js`
**Step 4:** 跑 → PASS
**Step 5:** 接入 app.js，手动验证"无 key 时置灰、填错 key 时退回 Flash"
**Step 6: Commit** `feat(pro): optional ai enhancement with flash fallback`

---

## Task 6: README + LICENSE + 收尾

**Files:** Create `README.md`, `LICENSE`

README 必含：一句话简介、"Say it nicely. Mean it anyway."、在线地址、本地运行（`npm run dev`）、测试（`npm test`）、Flash vs Pro 说明、**隐私声明（key 只在本地浏览器）**、话术库贡献方式（提 PR 加条目）。

**Commit** `docs: readme and license`

---

## Task 7: 部署 GitHub Pages

**Step 1:** 用 PowerShell + GitHub REST API 上传（见 TOOLS.md「🐙 GitHub 上传套路」）：
- pre-seed：`PUT /repos/HTJ678/per-my-last-email/contents/.seed`
- blobs → trees → commits → `PATCH /git/refs/heads/main`
- 若仓库名被占 → 加后缀 `-site`
**Step 2:** `POST /repos/HTJ678/per-my-last-email/pages`，body `{"source":{"branch":"main","path":"/"}}`（需先有文件，否则 409/404）
**Step 3:** 等 1-2 分钟，验证 https://htj678.github.io/per-my-last-email/ 返回 200
**Step 4:** 把在线地址回报给小侯

---

## 验收清单

- [ ] `npm test` 全绿（tone / matcher / phrases / pro）
- [ ] 本地 `npm run dev` → http://localhost:8125 可交互，无 console 报错
- [ ] 话术库 ≥120 条，四档齐全
- [ ] 滑块四站都有明显不同的输出
- [ ] 中/英/双语三种渲染正常
- [ ] Pro 无 key 置灰；错误 key 时退回 Flash 且标注 fallback
- [ ] Pages 线上可访问
