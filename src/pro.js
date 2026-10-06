import { toneLabel } from "./tone.js";

const SCENARIO_LABEL = {
  email: "email / 邮件",
  colleague: "colleague / 同事沟通",
  friend: "friend / 朋友闲聊",
  comment: "public comment / 公开评论",
};

const TONE_HINT = {
  0: "keep it blunt and direct, only removing profanity",
  33: "keep it friendly and casual",
  66: "use formal American business English / 正式书面语",
  100: "surface must be impeccable and polite, but the barb must remain clearly legible to the intended reader",
};

const LANG_HINT = {
  en: "English only in the en field; zh may be a short Chinese gloss",
  zh: "Chinese only in the zh field; en may be a short English gloss",
  both: "both languages must be fully natural, not literal translations of each other",
};

export function buildPrompt(input, { scenario = "email", tone = 66, lang = "both" } = {}) {
  const label = toneLabel(tone);
  const system = [
    "You are a wording polisher. You rewrite a rough message so it lands the way the sender intends.",
    "Rules:",
    "- Never change what the sender actually means. Only change how it lands.",
    "- Higher formality hides the aggression better, but the barb must still be readable to the intended target.",
    "- No slurs, no profanity, no threats. Politeness is the container, not the point.",
    LANG_HINT[lang] ?? LANG_HINT.both,
    'Return STRICT JSON only, no prose, no code fence: {"zh":"...","en":"..."}',
    "Both fields are required and must be non-empty.",
  ].join("\n");

  const user = [
    `Original message: ${input}`,
    `Scenario: ${SCENARIO_LABEL[scenario] ?? scenario}`,
    `Target tone stop: ${label} (${tone}/100) — ${TONE_HINT[tone] ?? TONE_HINT[66]}`,
    "Rewrite it at that tone stop.",
  ].join("\n");

  return { system, user };
}

export function parseEnhanceResponse(text) {
  const raw = String(text ?? "").trim();
  if (!raw) throw new Error("EMPTY_RESPONSE");

  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("NO_JSON_FOUND");

  let parsed;
  try {
    parsed = JSON.parse(raw.slice(start, end + 1));
  } catch {
    throw new Error("INVALID_JSON");
  }

  const zh = typeof parsed.zh === "string" ? parsed.zh.trim() : "";
  const en = typeof parsed.en === "string" ? parsed.en.trim() : "";
  if (!zh || !en) throw new Error("MISSING_FIELDS");
  return { zh, en };
}

export async function requestEnhance({
  apiKey,
  baseUrl = "https://api.deepseek.com/v1",
  model = "deepseek-chat",
  input,
  scenario = "email",
  tone = 66,
  lang = "both",
  timeoutMs = 8000,
  fetchImpl = globalThis.fetch,
} = {}) {
  if (!apiKey) throw new Error("NO_KEY");

  const { system, user } = buildPrompt(input, { scenario, tone, lang });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetchImpl(`${String(baseUrl).replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.7,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
      signal: controller.signal,
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content ?? "";
    return parseEnhanceResponse(text);
  } finally {
    clearTimeout(timer);
  }
}
