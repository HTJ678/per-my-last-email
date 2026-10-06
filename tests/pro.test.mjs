import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPrompt, parseEnhanceResponse, requestEnhance } from "../src/pro.js";

test("buildPrompt 带上原话、场景、档位、语言，并要求 JSON", () => {
  const { system, user } = buildPrompt("你为什么不回我", {
    scenario: "email",
    tone: 66,
    lang: "both",
  });
  assert.match(user, /你为什么不回我/);
  assert.match(user, /email|邮件/);
  assert.match(user, /正式/);
  assert.match(system, /JSON/i);
  assert.match(system, /zh/);
  assert.match(system, /en/);
});

test("buildPrompt 档位不同，提示词不同", () => {
  const a = buildPrompt("随便", { tone: 0 }).user;
  const b = buildPrompt("随便", { tone: 100 }).user;
  assert.notEqual(a, b);
});

test("parseEnhanceResponse 解析纯 JSON", () => {
  const r = parseEnhanceResponse('{"zh":"好的呢","en":"Noted."}');
  assert.deepEqual(r, { zh: "好的呢", en: "Noted." });
});

test("parseEnhanceResponse 能剥掉 markdown 围栏", () => {
  const r = parseEnhanceResponse('```json\n{"zh":"收到","en":"Got it."}\n```');
  assert.equal(r.en, "Got it.");
});

test("parseEnhanceResponse 能从废话里抠出 JSON", () => {
  const r = parseEnhanceResponse('Sure! Here you go: {"zh":"好的","en":"Sure."} Hope it helps!');
  assert.equal(r.zh, "好的");
});

test("parseEnhanceResponse 缺字段 / 非法内容会抛错", () => {
  assert.throws(() => parseEnhanceResponse('{"zh":"只有中文"}'));
  assert.throws(() => parseEnhanceResponse("对不起，我不行"));
  assert.throws(() => parseEnhanceResponse(""));
});

test("requestEnhance 无 key 抛 NO_KEY", async () => {
  await assert.rejects(
    () => requestEnhance({ apiKey: "", input: "你好", fetchImpl: async () => ({ ok: true }) }),
    /NO_KEY/,
  );
});

test("requestEnhance 正常返回 {zh,en}", async () => {
  const fakeFetch = async (url, init) => {
    assert.match(url, /\/chat\/completions$/);
    assert.match(init.headers.Authorization, /^Bearer sk-test$/);
    return {
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: '{"zh":"您好","en":"Hello."}' } }] }),
    };
  };
  const r = await requestEnhance({
    apiKey: "sk-test",
    input: "你好",
    tone: 33,
    fetchImpl: fakeFetch,
  });
  assert.deepEqual(r, { zh: "您好", en: "Hello." });
});

test("requestEnhance HTTP 失败会抛错（上层好退回 Flash）", async () => {
  const fakeFetch = async () => ({ ok: false, status: 401, json: async () => ({}) });
  await assert.rejects(
    () => requestEnhance({ apiKey: "sk-bad", input: "你好", fetchImpl: fakeFetch }),
    /HTTP 401/,
  );
});

test("requestEnhance 返回内容不合法时抛错", async () => {
  const fakeFetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({ choices: [{ message: { content: "我真的不知道" } }] }),
  });
  await assert.rejects(
    () => requestEnhance({ apiKey: "sk-test", input: "你好", fetchImpl: fakeFetch }),
  );
});
