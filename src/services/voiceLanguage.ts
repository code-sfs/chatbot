/** Detect English / Hindi / Hinglish from a voice transcript for TTS + query language. */

const DEVANAGARI_RE = /[\u0900-\u097F]/g;

const HINGLISH_HINTS = new Set([
  "kya",
  "hai",
  "hain",
  "nahi",
  "nahin",
  "kaise",
  "kitne",
  "kitna",
  "kitni",
  "batao",
  "bataiye",
  "dikhao",
  "dikhaiye",
  "mujhe",
  "mera",
  "meri",
  "mere",
  "aap",
  "aapka",
  "aapki",
  "karo",
  "kariye",
  "chahiye",
  "chahie",
  "abhi",
  "kal",
  "aaj",
  "kyun",
  "kyu",
  "theek",
  "thik",
  "accha",
  "achha",
  "bahut",
  "zyada",
  "kuch",
  "koi",
  "woh",
  "yeh",
  "hum",
  "hamara",
]);

export type VoiceLang = "en" | "hi" | "hinglish";

export function detectVoiceLanguage(
  text: string,
  hint?: string,
): VoiceLang {
  const raw = (text || "").trim();
  const hintNorm = (hint || "").trim().toLowerCase();

  if (hintNorm === "hi-in" || hintNorm === "hi" || hintNorm === "hindi") {
    return "hi";
  }
  if (hintNorm === "hinglish") {
    return "hinglish";
  }

  if (!raw) return "en";

  const devChars = (raw.match(DEVANAGARI_RE) || []).length;
  const latinChars = (raw.match(/[A-Za-z]/g) || []).length;
  const total = devChars + latinChars;
  if (total === 0) return "en";

  if (devChars > 0 && devChars >= Math.max(3, Math.floor(0.35 * total))) {
    return latinChars >= 8 ? "hinglish" : "hi";
  }

  const tokens = new Set(
    (raw.toLowerCase().match(/[a-z']+/g) || []).filter(Boolean),
  );
  let hits = 0;
  for (const t of tokens) {
    if (HINGLISH_HINTS.has(t)) hits += 1;
  }
  if (hits >= 2) return "hinglish";
  if (
    hits >= 1 &&
    latinChars >= 6 &&
    ["kya", "hai", "hain", "nahi", "batao", "dikhao", "kaise", "kitne"].some(
      (t) => tokens.has(t),
    )
  ) {
    return "hinglish";
  }
  if (devChars > 0 && latinChars > 0) return "hinglish";

  return "en";
}

/** Sarvam TTS target_language_code */
export function voiceLangToTtsBcp47(lang: VoiceLang): string {
  if (lang === "hi" || lang === "hinglish") return "hi-IN";
  return "en-IN";
}

export function voiceLangToApiHint(lang: VoiceLang): string {
  if (lang === "hi") return "hi-IN";
  if (lang === "hinglish") return "hinglish";
  return "en-IN";
}
