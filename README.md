# per-my-last-email

**Say it nicely. Mean it anyway.**

把糙话变成体面话 —— 一个滑块，四种面孔：**直白 → 礼貌 → 正式 → 隐晦**。中英双语对照。

> 给导师写邮件、回同事、在评论区回怼，都用得上。
> 拉到最右边，话漂亮得挑不出毛病，刺还在。

---

## 它做什么

输入一句糙话，比如 `你为什么不回我？`：

| 档位 | English | 中文 |
|---|---|---|
| 直白 | You still haven't gotten back to me. | 你怎么还没回我 |
| 礼貌 | Would you mind getting back to me when you get a chance? | 有空回我一下呀 |
| 正式 | Could you kindly confirm whether you've had a chance to review my previous email? | 烦请确认是否已收到并审阅此前邮件 |
| 隐晦 | Just following up on my last email, in case it got buried in your inbox. | 谨再次跟进我上一封邮件，以免它不幸被淹没在收件箱里 |

核心洞察：**体面 = 把攻击性藏进礼貌里**。所以"往上抬"（糙话→正式）和"往下压"（火气→漂亮的刺）不是两个功能，而是同一个滑块的左右两端。

## Flash 与 Pro

- **Flash（默认）** —— 纯前端、零依赖、零请求。话术库（120+ 条中英对照）在本地跑，打开即用，断网也能用。
- **Pro（可选）** —— 填上你自己的 API key，就能改写话术库里没有的句子。
  key 存在**你自己浏览器的 localStorage** 里，只会发给你填的那家模型厂商 —— 本项目没有后端，也没有任何服务器。
  Pro 失败（没网、key 错、超时）会**自动退回 Flash 的结果**，不会给你空白页。

## 本地跑

```bash
npm run dev     # → http://localhost:8125
npm test        # 零依赖，node --test
```

Python 都不用装，只有一个 `dev-server.mjs`（100 行，零依赖静态服务器）。

## 项目结构

```
index.html          页面
styles.css
app.js              UI 装配、事件、状态
src/matcher.js      意图匹配（纯函数，可测）
src/tone.js         档位 → 措辞（纯函数，可测）
src/pro.js          Pro 模式：调 API + 兜底
data/phrases.json   话术库
tests/              node --test
```

## 帮它长大：加一条话术

话术库是它的灵魂。想加一条，往 `data/phrases.json` 里塞一个对象就行：

```json
{
  "id": "chase-reply",
  "intent": "催对方回复消息",
  "keywords": ["回我", "reply", "还没回"],
  "scenarios": ["email", "colleague", "friend"],
  "tags": ["follow-up"],
  "variants": [
    { "tone": 0,   "zh": "你怎么还没回我",   "en": "You still haven't gotten back to me." },
    { "tone": 33,  "zh": "有空回我一下呀",   "en": "Would you mind getting back to me when you get a chance?" },
    { "tone": 66,  "zh": "烦请确认是否已收到", "en": "Could you kindly confirm receipt?" },
    { "tone": 100, "zh": "好的呢，我按流程走", "en": "Per my last email, I wanted to circle back on this." }
  ]
}
```

规矩只有几条：
- `variants` 必须**恰好四档** `0 / 33 / 66 / 100`，而且四档文字互不重复（不然滑块就没意义了）
- `scenarios` 只能取 `email` / `colleague` / `friend` / `comment`
- 档位越高越体面，但**第 100 档的刺必须还在** —— 那是这个项目存在的理由

`npm test` 会强制校验这些。

## 边界

不生成侮辱、歧视、威胁内容。给的是"更得体的说法"，不是"更狠的武器"。

## License

MIT
