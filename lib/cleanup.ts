import { roundTime } from "@/lib/utils";
import type {
  CleanupOptions,
  CleanupResult,
  DeletedRange,
  KeptRange,
  Word,
} from "@/lib/types";

const DEFAULT_SILENCE_MS = 350;
const DEFAULT_MIN_KEEP_MS = 180;
const DEFAULT_PAD_MS = 40;

const FILLER_PHRASES = [
  "you know",
  "i mean",
  "sort of",
  "kind of",
  "okay so",
  "so yeah",
  "yeah so",
];

const FILLER_WORDS = new Set([
  "um",
  "uh",
  "uhh",
  "er",
  "ah",
  "hmm",
  "huh",
  "like",
  "basically",
  "actually",
  "literally",
  "right",
  "well",
]);

const LIKE_PREV = new Set(["looks", "feels"]);
const LIKE_NEXT = new Set(["this", "that", "a", "the"]);

export function normalizeWord(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}'’]+/gu, "")
    .replace(/’/g, "'")
    .trim();
}

function wordsEqual(a: string, b: string): boolean {
  return normalizeWord(a) === normalizeWord(b);
}

function shouldKeepLike(words: Word[], index: number): boolean {
  const prev = words[index - 1] ? normalizeWord(words[index - 1].text) : "";
  const next = words[index + 1] ? normalizeWord(words[index + 1].text) : "";
  return LIKE_PREV.has(prev) || LIKE_NEXT.has(next);
}

function isFillerWord(words: Word[], index: number): boolean {
  const token = normalizeWord(words[index].text);
  if (!FILLER_WORDS.has(token)) return false;
  if (token === "like") return !shouldKeepLike(words, index);
  return true;
}

type Marked = {
  word: Word;
  reason: "filler" | "repeat" | null;
};

function markFillers(items: Marked[]): void {
  const words = items.map((item) => item.word);
  let i = 0;
  while (i < items.length) {
    let matchedPhrase = false;
    for (const phrase of FILLER_PHRASES) {
      const parts = phrase.split(" ");
      const slice = words.slice(i, i + parts.length);
      if (slice.length !== parts.length) continue;
      const matches = parts.every((part, offset) =>
        wordsEqual(slice[offset].text, part),
      );
      if (matches) {
        for (let j = 0; j < parts.length; j += 1) {
          items[i + j].reason = "filler";
        }
        i += parts.length;
        matchedPhrase = true;
        break;
      }
    }
    if (matchedPhrase) continue;
    if (isFillerWord(words, i)) {
      items[i].reason = "filler";
    }
    i += 1;
  }
}

function unmarked(items: Marked[]): Marked[] {
  return items.filter((item) => item.reason === null);
}

function markConsecutiveRepeats(items: Marked[]): void {
  const kept = unmarked(items);
  for (let i = 1; i < kept.length; i += 1) {
    if (wordsEqual(kept[i].word.text, kept[i - 1].word.text)) {
      kept[i].reason = "repeat";
    }
  }
}

function markNgramRepeats(items: Marked[]): void {
  const kept = unmarked(items);
  for (let n = 5; n >= 2; n -= 1) {
    let i = 0;
    while (i + 2 * n <= kept.length) {
      const first = kept.slice(i, i + n);
      const second = kept.slice(i + n, i + 2 * n);
      const same = first.every((item, offset) =>
        wordsEqual(item.word.text, second[offset].word.text),
      );
      if (same) {
        for (let j = 0; j < n; j += 1) {
          second[j].reason = "repeat";
        }
        i += n;
      } else {
        i += 1;
      }
    }
  }
}

function joinText(words: Word[]): string {
  return words
    .map((word) => word.text)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function padRanges(ranges: KeptRange[], padSec: number): KeptRange[] {
  return ranges.map((range, index) => {
    const prevEnd = index > 0 ? ranges[index - 1].end : 0;
    const nextStart = index < ranges.length - 1 ? ranges[index + 1].start : Number.POSITIVE_INFINITY;
    const start = Math.max(prevEnd, range.start - padSec);
    const end = Math.min(nextStart, range.end + padSec);
    return {
      ...range,
      start: roundTime(Math.max(0, start)),
      end: roundTime(Math.max(start, end)),
    };
  });
}

export function cleanupWords(
  words: Word[],
  options: CleanupOptions = {},
): CleanupResult {
  const silenceMs = options.silenceMs ?? DEFAULT_SILENCE_MS;
  const minKeepMs = options.minKeepMs ?? DEFAULT_MIN_KEEP_MS;
  const padMs = options.padMs ?? DEFAULT_PAD_MS;
  const removeFillers = options.removeFillers ?? true;
  const removeRepeats = options.removeRepeats ?? true;
  const silenceSec = silenceMs / 1000;
  const minKeepSec = minKeepMs / 1000;
  const padSec = padMs / 1000;

  if (words.length === 0) {
    return {
      keptRanges: [],
      deleted: [],
      stats: {
        silenceSec: 0,
        fillerCount: 0,
        repeatCount: 0,
        originalSec: 0,
        cleanSec: 0,
      },
    };
  }

  const items: Marked[] = words.map((word) => ({ word, reason: null }));
  if (removeFillers) markFillers(items);
  if (removeRepeats) {
    markConsecutiveRepeats(items);
    markNgramRepeats(items);
  }

  const deleted: DeletedRange[] = [];
  for (const item of items) {
    if (item.reason) {
      deleted.push({
        start: item.word.start,
        end: item.word.end,
        reason: item.reason,
      });
    }
  }

  const keptWords = unmarked(items).map((item) => item.word);
  const first = words[0];
  const last = words[words.length - 1];
  const originalSec = roundTime(Math.max(0, last.end - Math.min(0, first.start)));

  if (keptWords.length === 0) {
    deleted.push({ start: first.start, end: last.end, reason: "silence" });
    return {
      keptRanges: [],
      deleted,
      stats: {
        silenceSec: originalSec,
        fillerCount: deleted.filter((item) => item.reason === "filler").length,
        repeatCount: deleted.filter((item) => item.reason === "repeat").length,
        originalSec,
        cleanSec: 0,
      },
    };
  }

  if (keptWords[0].start > 0) {
    deleted.push({ start: 0, end: keptWords[0].start, reason: "silence" });
  }

  for (let i = 1; i < keptWords.length; i += 1) {
    const gap = keptWords[i].start - keptWords[i - 1].end;
    if (gap > silenceSec) {
      deleted.push({
        start: keptWords[i - 1].end,
        end: keptWords[i].start,
        reason: "silence",
      });
    }
  }

  const clusters: Word[][] = [];
  let current: Word[] = [keptWords[0]];
  for (let i = 1; i < keptWords.length; i += 1) {
    const gap = keptWords[i].start - keptWords[i - 1].end;
    if (gap > silenceSec) {
      clusters.push(current);
      current = [keptWords[i]];
    } else {
      current.push(keptWords[i]);
    }
  }
  clusters.push(current);

  const rawRanges: KeptRange[] = [];
  for (const cluster of clusters) {
    const start = cluster[0].start;
    const end = cluster[cluster.length - 1].end;
    if (end - start < minKeepSec) {
      deleted.push({ start, end, reason: "silence" });
      continue;
    }
    rawRanges.push({
      start,
      end,
      text: joinText(cluster),
    });
  }

  const keptRanges = padRanges(rawRanges, padSec);
  const cleanSec = roundTime(
    keptRanges.reduce((sum, range) => sum + (range.end - range.start), 0),
  );
  const silenceRemoved = roundTime(
    deleted
      .filter((item) => item.reason === "silence")
      .reduce((sum, item) => sum + Math.max(0, item.end - item.start), 0),
  );

  return {
    keptRanges,
    deleted,
    stats: {
      silenceSec: silenceRemoved,
      fillerCount: deleted.filter((item) => item.reason === "filler").length,
      repeatCount: deleted.filter((item) => item.reason === "repeat").length,
      originalSec,
      cleanSec,
    },
  };
}

export function cleanedTextFromResult(result: CleanupResult): string {
  return result.keptRanges
    .map((range) => range.text)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}
