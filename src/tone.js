export const TONE_STOPS = [0, 33, 66, 100];

export const TONE_LABELS = ["直白", "礼貌", "正式", "隐晦"];

/** 把任意输入夹到 0-100 区间；非法值一律视为 0。 */
export function clampTone(tone) {
  const n = Number(tone);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

/**
 * 返回最接近给定档位的 variant 下标。
 * 不插值、不生成新句子 —— 只在作者写好的四档里挑最近的那一档。
 */
export function nearestVariantIndex(variants, tone) {
  if (!Array.isArray(variants) || variants.length === 0) return -1;
  const target = clampTone(tone);
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < variants.length; i += 1) {
    const dist = Math.abs(Number(variants[i].tone) - target);
    if (dist < bestDist) {
      bestDist = dist;
      best = i;
    }
  }
  return best;
}

/** 取该档位对应的整条 variant；空数组返回 undefined。 */
export function pickVariant(variants, tone) {
  const i = nearestVariantIndex(variants, tone);
  return i < 0 ? undefined : variants[i];
}

/** 档位数字 → 中文标签（用于 UI 显示）。 */
export function toneLabel(tone) {
  const i = nearestVariantIndex(
    TONE_STOPS.map((t) => ({ tone: t })),
    tone,
  );
  return i < 0 ? TONE_LABELS[0] : TONE_LABELS[i];
}
