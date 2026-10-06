import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, "..", "data", "phrases.json");

const ALLOWED_SCENARIOS = ["email", "colleague", "friend", "comment"];
const TONES = [0, 33, 66, 100];

let lib;
try {
  lib = JSON.parse(await readFile(DATA, "utf8"));
} catch {
  lib = null;
}

test("话术库存在且是数组", () => {
  assert.ok(lib !== null, `data/phrases.json 读不到（${DATA}）`);
  assert.ok(Array.isArray(lib), "顶层必须是数组");
});

test("条数 >= 120", () => {
  assert.ok(lib.length >= 120, `只有 ${lib.length} 条，目标 >= 120`);
});

test("id 唯一且为 kebab-case", () => {
  const seen = new Set();
  for (const e of lib) {
    assert.match(e.id, /^[a-z0-9]+(-[a-z0-9]+)*$/, `id 不合规: ${e.id}`);
    assert.ok(!seen.has(e.id), `id 重复: ${e.id}`);
    seen.add(e.id);
  }
});

test("每条必有 intent / keywords / scenarios", () => {
  for (const e of lib) {
    assert.ok(typeof e.intent === "string" && e.intent.trim(), `${e.id} 缺 intent`);
    assert.ok(Array.isArray(e.keywords) && e.keywords.length >= 1, `${e.id} 缺 keywords`);
    for (const kw of e.keywords) {
      assert.ok(typeof kw === "string" && kw.trim(), `${e.id} keywords 有空值`);
    }
    assert.ok(Array.isArray(e.scenarios) && e.scenarios.length >= 1, `${e.id} 缺 scenarios`);
    for (const s of e.scenarios) {
      assert.ok(ALLOWED_SCENARIOS.includes(s), `${e.id} 场景非法: ${s}`);
    }
  }
});

test("每条 variants 恰好覆盖四档且递增", () => {
  for (const e of lib) {
    assert.ok(Array.isArray(e.variants), `${e.id} 缺 variants`);
    assert.equal(e.variants.length, 4, `${e.id} variants 不是 4 档`);
    assert.deepEqual(
      e.variants.map((v) => v.tone),
      TONES,
      `${e.id} 档位不是 [0,33,66,100]`,
    );
  }
});

test("每档中文英文都非空", () => {
  for (const e of lib) {
    for (const v of e.variants) {
      assert.ok(typeof v.zh === "string" && v.zh.trim(), `${e.id}@${v.tone} zh 为空`);
      assert.ok(typeof v.en === "string" && v.en.trim(), `${e.id}@${v.tone} en 为空`);
    }
  }
});

test("同一条内四档文字互不重复（否则滑块没意义）", () => {
  for (const e of lib) {
    const zh = new Set(e.variants.map((v) => v.zh.trim()));
    const en = new Set(e.variants.map((v) => v.en.trim()));
    assert.equal(zh.size, 4, `${e.id} 中文有重复`);
    assert.equal(en.size, 4, `${e.id} 英文有重复`);
  }
});

test("keywords 覆盖了足够多的场景（库的整体健康度）", () => {
  const scenarios = new Set(lib.flatMap((e) => e.scenarios));
  for (const s of ALLOWED_SCENARIOS) {
    assert.ok(scenarios.has(s), `没有任何条目覆盖场景 ${s}`);
  }
});
