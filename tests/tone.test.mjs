import { test } from "node:test";
import assert from "node:assert/strict";
import { clampTone, nearestVariantIndex, pickVariant } from "../src/tone.js";

const VARIANTS = [
  { tone: 0, zh: "你怎么没回我", en: "You didn't reply." },
  { tone: 33, zh: "回我一下哈", en: "Just checking in." },
  { tone: 66, zh: "烦请确认是否收到", en: "Please confirm receipt." },
  { tone: 100, zh: "好的呢，我按流程走", en: "Per my last email." },
];

test("clampTone 夹在 0-100", () => {
  assert.equal(clampTone(-20), 0);
  assert.equal(clampTone(140), 100);
  assert.equal(clampTone(66), 66);
  assert.equal(clampTone("42"), 42);
  assert.equal(clampTone(undefined), 0);
  assert.equal(clampTone(NaN), 0);
});

test("nearestVariantIndex 取最近的档位", () => {
  assert.equal(nearestVariantIndex(VARIANTS, 0), 0);
  assert.equal(nearestVariantIndex(VARIANTS, 40), 1);
  assert.equal(nearestVariantIndex(VARIANTS, 100), 3);
  assert.equal(nearestVariantIndex(VARIANTS, 51), 2);
  assert.equal(nearestVariantIndex(VARIANTS, 999), 3);
});

test("nearestVariantIndex 对乱序输入也取最近", () => {
  const shuffled = [VARIANTS[2], VARIANTS[0], VARIANTS[3], VARIANTS[1]];
  assert.equal(shuffled[nearestVariantIndex(shuffled, 100)].tone, 100);
  assert.equal(shuffled[nearestVariantIndex(shuffled, 5)].tone, 0);
});

test("pickVariant 返回整条 variant", () => {
  assert.equal(pickVariant(VARIANTS, 100).en, "Per my last email.");
  assert.equal(pickVariant(VARIANTS, 34).zh, "回我一下哈");
});

test("pickVariant 空数组返回 undefined", () => {
  assert.equal(pickVariant([], 50), undefined);
});
