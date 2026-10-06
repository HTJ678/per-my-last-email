import { test } from "node:test";
import assert from "node:assert/strict";
import { normalize, scoreEntry, match } from "../src/matcher.js";

const LIB = [
  { id: "no-reply", intent: "对方不回消息", keywords: ["回", "reply", "回我"], tags: ["delay"], variants: [] },
  { id: "refuse", intent: "拒绝请求", keywords: ["帮", "能不能", "help"], tags: ["refuse"], variants: [] },
];

test("normalize 全角转半角、去标点空白、小写", () => {
  assert.equal(normalize("  Ｈｅｌｌｏ，Reply  "), "helloreply");
  assert.equal(normalize("你为什么不回我？"), "你为什么不回我");
  assert.equal(normalize(null), "");
  assert.equal(normalize(undefined), "");
});

test("scoreEntry 关键词命中加分", () => {
  assert.ok(scoreEntry("你怎么不回我", LIB[0]).score > 0);
  assert.equal(scoreEntry("今天天气不错", LIB[0]).score, 0);
});

test("scoreEntry 英文关键词大小写/全角都能命中", () => {
  assert.ok(scoreEntry("Please REPLY to me", LIB[0]).score > 0);
});

test("match 按分数排序并过滤 0 分", () => {
  const r = match("能不能帮我一下", LIB);
  assert.equal(r.length, 1);
  assert.equal(r[0].entry.id, "refuse");
});

test("match 命中多关键词的条目排前面", () => {
  const r = match("你能不能帮帮我", LIB);
  assert.equal(r[0].entry.id, "refuse");
  assert.ok(r[0].score >= 2);
});

test("match 无命中返回空数组", () => {
  assert.deepEqual(match("zzzzz", LIB), []);
});

test("match 空输入返回空数组", () => {
  assert.deepEqual(match("", LIB), []);
});

test("match 空库返回空数组", () => {
  assert.deepEqual(match("你怎么不回我", []), []);
});
