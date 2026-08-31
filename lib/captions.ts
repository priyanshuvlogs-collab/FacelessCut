import type { CaptionCue, RemappedWord } from "@/lib/types";

const MAX_WORDS = 4;
const MIN_WORDS = 2;
const MAX_CHARS = 32;

function normalizeToken(text: string): string {
  return text.toLowerCase().replace(/[^\p{L}\p{N}'’]+/gu, "");
}

export function buildCaptions(
  words: RemappedWord[],
  punchWords: string[] = [],
): CaptionCue[] {
  if (words.length === 0) return [];

  const punches = new Set(punchWords.map((word) => normalizeToken(word)).filter(Boolean));
  const cues: CaptionCue[] = [];
  let buffer: RemappedWord[] = [];

  const flush = () => {
    if (buffer.length === 0) return;
    const text = buffer.map((word) => word.text).join(" ");
    cues.push({
      text,
      start: buffer[0].start,
      end: buffer[buffer.length - 1].end,
      highlight: buffer
        .map((word) => word.text)
        .filter((word) => punches.has(normalizeToken(word))),
    });
    buffer = [];
  };

  for (const word of words) {
    const next = [...buffer, word];
    const nextText = next.map((item) => item.text).join(" ");
    const wouldOverflow =
      next.length > MAX_WORDS || nextText.length > MAX_CHARS;
    if (buffer.length >= MIN_WORDS && wouldOverflow) {
      flush();
    }
    buffer.push(word);
    if (buffer.length >= MAX_WORDS) {
      flush();
    }
  }
  flush();
  return cues;
}
