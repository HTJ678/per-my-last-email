# per-my-last-email — 设计文档

> 日期：2026-10-06
> 状态：已由小侯确认（"没有要改的了，仓库就叫 1 吧"）

## 一句话

输入一句糙话，把它说体面。一个零依赖的纯前端网页，中英双语，一个滑块控制"体面 ↔ 带刺"。

## 目标

把"把话说得体面"这件事做成一个**打开即用、离线可用、不用 API key** 的工具，同时保留一个可选的 AI 增强模式给刁钻句子兜底。

核心洞察：**体面 = 把攻击性藏进礼貌里**。所以"往上抬"（糙话→正式）和"往下压"（火气→漂亮的刺）不是两个功能，而是同一个滑块的左右两端。

## 用户场景

1. 给导师/教授写邮件，需要美式正式格式
2. 回同事/同学，需要"客气但我不想配合"的措辞
3. 评论区回怼，需要"话很漂亮、刺还在"
4. 中英双语对照，顺便当语感参考

## 功能设计

### 三个控制项

- **Flash / Pro 开关** —— 模式切换
- **语言** —— English / 中文 / 双语对照
- **档位滑块** —— 四站标注，连续取值

### 档位滑块（核心）

从最左到最右：

| 位置 | 标签 | 效果 |
|---|---|---|
| 0 | 直白 | 只去掉脏字，原意几乎不动 |
| 33 | 礼貌 | 软化语气，正常人听了不难受 |
| 66 | 正式 | 美式邮件 / 职场书面语 |
| 100 | 隐晦 | 表面无懈可击，懂的人知道你在骂他 |

中间连续可停，输出对应档位的措辞。

### Flash 模式（默认）

- 纯前端、零依赖、"话术库"驱动
- 话术库条目结构：

```json
{
  "id": "why-no-reply",
  "intent": "对方不回消息",
  "zh": "你为什么不回我？",
  "en": "Why didn't you reply?",
  "variants": [
    { "tone": 0,   "zh": "你怎么没回我",            "en": "You didn't reply." },
    { "tone": 33,  "zh": "看到的话回我一下哈",       "en": "Just checking in — did you see my message?" },
    { "tone": 66,  "zh": "烦请确认是否收到此前邮件", "en": "Please confirm receipt of my previous email." },
    { "tone": 100, "zh": "好的呢，我按流程走。",     "en": "Per my last email, I wanted to circle back on this." }
  ],
  "scenarios": ["email", "colleague", "friend", "comment"],
  "tags": ["delay", "follow-up", "passive-aggressive"]
}
```

- 匹配流程：**归一化输入 → 意图匹配（关键词 + 标签打分）→ 取该意图的 variants → 按滑块档位插值取句 → 按语言设置渲染**
- 匹配不到时：给出"最接近的几条"提示，并提示可开 Pro

### Pro 模式（可选）

- 页面内填自己的 API key，存 `localStorage`，**只发给模型厂商本身**（默认 DeepSeek，可切换）
- 请求内容：原话 + 场景 + 档位 + 语言
- **失败兜底**：无 key / 请求失败 / 超时 → 自动退回 Flash 结果，绝不空白
- README 与 UI 都要写明：key 只存在你本地浏览器里，不上传到本项目的任何服务器（本项目根本没有服务器）

## 架构

纯静态站点，零构建、零依赖。

```
per-my-last-email/
├─ index.html          # 单页：输入框 + 三个控制项 + 结果卡片
├─ styles.css
├─ app.js              # UI 装配、事件、状态（语言/档位/模式）
├─ src/
│  ├─ matcher.js       # 意图匹配（纯函数，可测）
│  ├─ tone.js          # 档位插值 → 选 variant（纯函数，可测）
│  └─ pro.js           # Pro 模式：调 API + 兜底（网络层单独一层）
├─ data/
│  └─ phrases.json     # 话术库（v1 目标 ≥120 条）
├─ tests/
│  ├─ matcher.test.mjs
│  ├─ tone.test.mjs
│  └─ phrases.test.mjs # 校验话术库 schema 与完整性
├─ dev-server.mjs      # 本地预览（零依赖 http）
├─ README.md
└─ LICENSE (MIT)
```

### 数据流

```
输入原话
  → normalize（去空白/全半角/大小写）
  → matcher.match(): 意图 + 候选条目
  → tone.pick(): 按滑块档位选 variant
  → render(): 按语言设置出卡片（中 / 英 / 双语）
  → （Pro 开启时）pro.enhance() 覆写结果，失败则保留 Flash 结果
```

## 错误处理

- 空输入 → 不发请求，提示输入
- 话术库未命中 → 展示 top-3 相近条目 + "开 Pro 试试"
- Pro 无 key → 开关置灰 + 悬浮提示
- Pro 请求失败/超时（8s）→ 静默退回 Flash，卡片角落标注 "Flash fallback"

## 测试

`node --test "tests/**/*.test.mjs"`，零依赖。

- `matcher.test.mjs`：意图命中、多候选排序、未命中降级
- `tone.test.mjs`：四个档位取值、中间插值、边界（0 / 100）
- `phrases.test.mjs`：每条必须有 zh/en/variants/scenarios；variants 的 tone 覆盖四档且单调
- 目标：Flash 全链路离线可测，不依赖网络

## 部署

- GitHub Pages：`HTJ678/per-my-last-email`
- 站点：https://htj678.github.io/per-my-last-email/
- 上传走 PowerShell + GitHub REST API（本机 git 直推不通，见 TOOLS.md）
- 若仓库名被占，加后缀

## 非目标（YAGNI）

- 不做后端、不做账号、不做云同步
- 不做浏览器插件 / 输入法（v1 只做网页）
- 不做多模型自动路由（Pro 默认 DeepSeek 一家）
- 不做话术库的社区投稿后台

## v2 候选（先不做）

- 浏览器扩展：在任意输入框旁加一个"体面化"按钮
- 历史记录（localStorage）
- 更多语言（日/韩）
