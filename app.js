import { match } from "./src/matcher.js";
import { pickVariant, toneLabel } from "./src/tone.js";
import { requestEnhance } from "./src/pro.js";

const LS_KEY = "pmle:pro-settings";
const MAX_CARDS = 4;

const el = {
  modeFlash: document.getElementById("mode-flash"),
  modePro: document.getElementById("mode-pro"),
  proBadge: document.getElementById("pro-badge"),
  input: document.getElementById("input"),
  scenario: document.getElementById("scenario"),
  lang: document.getElementById("lang"),
  tone: document.getElementById("tone"),
  toneName: document.getElementById("tone-name"),
  results: document.getElementById("results"),
  hint: document.getElementById("hint"),
  sample: document.getElementById("sample"),
  proPanel: document.getElementById("pro-panel"),
  proKey: document.getElementById("pro-key"),
  proModel: document.getElementById("pro-model"),
  proBase: document.getElementById("pro-base"),
  proSave: document.getElementById("pro-save"),
  proClear: document.getElementById("pro-clear"),
  proNote: document.getElementById("pro-note"),
};

const state = {
  library: [],
  mode: "flash",
  lang: "both",
  tone: 66,
  scenario: "email",
  pro: loadPro(),
  proBusy: false,
  proResult: null,
  proError: "",
};

function loadPro() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? "null") ?? { key: "" };
  } catch {
    return { key: "" };
  }
}

function savePro() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(state.pro));
  } catch {
    /* 隐身模式等场景忽略 */
  }
}

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const SAMPLES = [
  "你为什么不回我？",
  "这个我帮不了你",
  "你又迟到了",
  "能不能便宜点",
  "你别再改了行吗",
];

function renderLines(variant) {
  if (!variant) return "";
  const en = `<p class="line line-en">${esc(variant.en)}</p>`;
  const zh = `<p class="line line-zh">${esc(variant.zh)}</p>`;
  if (state.lang === "en") return en;
  if (state.lang === "zh") return zh;
  return en + zh;
}

function cardHtml({ intent, lines, pro, note }) {
  return `
    <article class="card${pro ? " is-pro" : ""}">
      <div class="card-head">
        <span class="card-intent">${esc(intent)}</span>
        <button class="copy" data-copy="${esc(lines.copy)}">复制</button>
      </div>
      ${lines.html}
      ${note ? `<p class="note">${esc(note)}</p>` : ""}
    </article>`;
}

function render() {
  const q = el.input.value.trim();
  const parts = [];

  if (state.mode === "pro" && state.proError) {
    parts.push(`<p class="note">Pro 没成功（${esc(state.proError)}），下面是 Flash 的结果。</p>`);
  }

  if (state.mode === "pro" && state.proResult) {
    const v = state.proResult;
    parts.push(
      cardHtml({
        intent: `Pro 改写 · ${toneLabel(state.tone)}`,
        lines: { html: renderLines(v), copy: plainText(v) },
        pro: true,
      }),
    );
  }

  if (!q) {
    parts.push('<p class="empty">上面输入一句糙话，右边拉着滑块就能看四种面孔。</p>');
    el.results.innerHTML = parts.join("");
    return;
  }

  const hits = match(q, state.library).slice(0, MAX_CARDS);

  if (hits.length === 0) {
    parts.push(
      '<p class="empty">话术库里没找到特别贴近的。换个说法，或者开 Pro 让模型现写一条。</p>',
    );
  }

  for (const { entry } of hits) {
    const variant = pickVariant(entry.variants, state.tone);
    parts.push(
      cardHtml({
        intent: entry.intent,
        lines: { html: renderLines(variant), copy: plainText(variant) },
        pro: false,
      }),
    );
  }

  el.results.innerHTML = parts.join("");
}

function plainText(variant) {
  if (!variant) return "";
  if (state.lang === "en") return variant.en;
  if (state.lang === "zh") return variant.zh;
  return `${variant.en}\n${variant.zh}`;
}

async function runPro() {
  const q = el.input.value.trim();
  if (!q || !state.pro.key || state.proBusy) return;

  state.proBusy = true;
  state.proError = "";
  el.proNote.textContent = "Pro 正在想…";

  try {
    state.proResult = await requestEnhance({
      apiKey: state.pro.key,
      baseUrl: el.proBase.value.trim() || undefined,
      model: el.proModel.value.trim() || undefined,
      input: q,
      scenario: el.scenario.value,
      tone: state.tone,
      lang: state.lang,
    });
    el.proNote.textContent = "Pro 完成。";
  } catch (err) {
    state.proResult = null;
    state.proError = err?.message ?? "unknown";
    el.proNote.textContent = "Pro 失败，已退回 Flash。";
  } finally {
    state.proBusy = false;
    render();
  }
}

let timer = null;
function scheduleUpdate() {
  clearTimeout(timer);
  timer = setTimeout(() => {
    state.tone = Number(el.tone.value);
    state.lang = el.lang.value;
    state.scenario = el.scenario.value;
    el.toneName.textContent = toneLabel(state.tone);
    render();
    if (state.mode === "pro" && state.pro.key) runPro();
  }, 200);
}

function setMode(mode) {
  state.mode = mode;
  state.proResult = null;
  state.proError = "";
  const isPro = mode === "pro";
  el.modeFlash.classList.toggle("is-on", !isPro);
  el.modePro.classList.toggle("is-on", isPro);
  el.modeFlash.setAttribute("aria-selected", String(!isPro));
  el.modePro.setAttribute("aria-selected", String(isPro));
  el.proPanel.hidden = !isPro;
  if (isPro && !state.pro.key) el.proNote.textContent = "先把 key 填上，Pro 才工作。";
  render();
  if (isPro && state.pro.key) runPro();
}

function refreshProBadge() {
  const hasKey = Boolean(state.pro.key);
  el.proBadge.hidden = hasKey;
  el.modePro.disabled = false;
  el.modePro.title = hasKey ? "" : "还没填 key，填了才能用 Pro";
}

function initProInputs() {
  el.proKey.value = state.pro.key ?? "";
  if (state.pro.model) el.proModel.value = state.pro.model;
  if (state.pro.baseUrl) el.proBase.value = state.pro.baseUrl;
}

el.input.addEventListener("input", scheduleUpdate);
el.tone.addEventListener("input", () => {
  el.toneName.textContent = toneLabel(Number(el.tone.value));
  scheduleUpdate();
});
el.lang.addEventListener("change", scheduleUpdate);
el.scenario.addEventListener("change", scheduleUpdate);

el.modeFlash.addEventListener("click", () => setMode("flash"));
el.modePro.addEventListener("click", () => setMode("pro"));

el.sample.addEventListener("click", () => {
  el.input.value = SAMPLES[Math.floor(Math.random() * SAMPLES.length)];
  el.hint.textContent = "例子已填，拉滑块看看。";
  scheduleUpdate();
});

el.proSave.addEventListener("click", () => {
  state.pro = {
    key: el.proKey.value.trim(),
    model: el.proModel.value.trim(),
    baseUrl: el.proBase.value.trim(),
  };
  savePro();
  refreshProBadge();
  el.proNote.textContent = state.pro.key ? "已存在本机浏览器里。" : "没填 key。";
});

el.proClear.addEventListener("click", () => {
  state.pro = { key: "" };
  savePro();
  el.proKey.value = "";
  state.proResult = null;
  refreshProBadge();
  el.proNote.textContent = "已清除。";
  render();
});

el.results.addEventListener("click", async (ev) => {
  const btn = ev.target.closest(".copy");
  if (!btn) return;
  const text = btn.getAttribute("data-copy") ?? "";
  try {
    await navigator.clipboard.writeText(text);
    btn.textContent = "✓ 已复制";
    btn.classList.add("is-done");
    setTimeout(() => {
      btn.textContent = "复制";
      btn.classList.remove("is-done");
    }, 1500);
  } catch {
    btn.textContent = "复制失败";
  }
});

async function boot() {
  try {
    const res = await fetch("data/phrases.json");
    state.library = await res.json();
  } catch {
    state.library = [];
    el.hint.textContent = "话术库没加载上，Flash 暂时不可用。";
  }
  initProInputs();
  refreshProBadge();
  el.toneName.textContent = toneLabel(state.tone);
  render();
}

boot();
