import { roundTime } from "@/lib/utils";
import type { KeptRange, RemappedWord, Word } from "@/lib/types";

export function originalToClean(time: number, keptRanges: KeptRange[]): number {
  let elapsed = 0;
  for (const range of keptRanges) {
    if (time < range.start) {
      return roundTime(elapsed);
    }
    if (time <= range.end) {
      return roundTime(elapsed + (time - range.start));
    }
    elapsed += range.end - range.start;
  }
  return roundTime(elapsed);
}

export function remapWords(words: Word[], keptRanges: KeptRange[]): RemappedWord[] {
  const remapped: RemappedWord[] = [];

  for (const word of words) {
    const range = keptRanges.find(
      (item) => word.start < item.end && word.end > item.start,
    );
    if (!range) continue;

    const clampedStart = Math.max(word.start, range.start);
    const clampedEnd = Math.min(word.end, range.end);
    if (clampedEnd <= clampedStart) continue;

    const prior = keptRanges
      .filter((item) => item.end <= range.start)
      .reduce((sum, item) => sum + (item.end - item.start), 0);

    remapped.push({
      text: word.text,
      start: roundTime(prior + (clampedStart - range.start)),
      end: roundTime(prior + (clampedEnd - range.start)),
      confidence: word.confidence,
      originalStart: word.start,
      originalEnd: word.end,
    });
  }

  return remapped;
}

export function cleanRangeLengthBefore(keptRanges: KeptRange[], range: KeptRange): number {
  return keptRanges
    .filter((item) => item.end <= range.start)
    .reduce((sum, item) => sum + (item.end - item.start), 0);
}

export function remapKeptRanges(keptRanges: KeptRange[]): KeptRange[] {
  let cursor = 0;
  return keptRanges.map((range) => {
    const length = range.end - range.start;
    const remapped = {
      start: roundTime(cursor),
      end: roundTime(cursor + length),
      text: range.text,
    };
    cursor += length;
    return remapped;
  });
}
