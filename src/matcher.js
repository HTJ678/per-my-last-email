/**
 * 归一化：全角转半角 → 去标点/空白 → 小写。
 * 中文按子串匹配，英文按词匹配，所以先统一形态。
 */
export function normalize(input) {
  return String(input ?? "")
    .replace(/[\uFF01-\uFF5E]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/[\u3000-\u303F]/g, "")
    .replace(/[\s，。！？、,.!?:;'"“”‘’()（）\-—_/\\]/g, "")
    .trim()
    .toLowerCase();
}

/**
 * 给单条话术库条目打分。
 * 命中一个关键词 +1，命中 intent 全文再 +1。
 */
export function scoreEntry(input, entry) {
  const q = normalize(input);
  const empty = { score: 0, matched: [], entry };
  if (!q || !entry) return empty;

  const matched = [];
  for (const kw of entry.keywords ?? []) {
    const needle = normalize(kw);
    if (needle && q.includes(needle)) matched.push(kw);
  }
  const intent = normalize(entry.intent);
  if (intent && q.includes(intent)) matched.push(entry.intent);

  return { score: matched.length, matched, entry };
}

/**
 * 在话术库里找匹配条目，按分数降序，过滤 0 分。
 * 无命中返回空数组（UI 据此走"未命中"降级提示）。
 */
export function match(input, lib) {
  if (!Array.isArray(lib) || lib.length === 0) return [];
  if (!normalize(input)) return [];
  return lib
    .map((entry) => scoreEntry(input, entry))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);
}

/** 取前 n 条匹配结果，只返回 entry（UI 常用形态）。 */
export function matchEntries(input, lib, n = 3) {
  return match(input, lib).slice(0, n).map((r) => r.entry);
}
