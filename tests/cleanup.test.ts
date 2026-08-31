import { describe, expect, it } from "vitest";
import { cleanedTextFromResult, cleanupWords } from "@/lib/cleanup";
import { remapWords } from "@/lib/remap";
import type { Word } from "@/lib/types";

function timedWords(text: string, start = 0, duration = 0.25, gap = 0.05): Word[] {
  let cursor = start;
  return text.split(/\s+/).map((token) => {
    const word: Word = {
      text: token,
      start: cursor,
      end: cursor + duration,
      confidence: 0.99,
    };
    cursor += duration + gap;
    return word;
  });
}

describe("cleanupWords", () => {
  it("strips fillers and repeats from a messy sentence", () => {
    const words = timedWords("um I I think this this is why this is why it works");
    const result = cleanupWords(words, {
      silenceMs: 350,
      removeFillers: true,
      removeRepeats: true,
    });
    const cleaned = cleanedTextFromResult(result);

    expect(cleaned).toContain("I think this is why it works");
    expect(result.stats.fillerCount).toBeGreaterThanOrEqual(1);
    expect(result.stats.repeatCount).toBeGreaterThanOrEqual(1);
  });

  it("deletes a 0.80s gap when silenceMs is 350", () => {
    const words: Word[] = [
      { text: "hello", start: 0, end: 0.3, confidence: 1 },
      { text: "world", start: 1.1, end: 1.4, confidence: 1 },
    ];
    const result = cleanupWords(words, { silenceMs: 350 });
    const silence = result.deleted.find(
      (item) => item.reason === "silence" && item.end - item.start >= 0.79,
    );
    expect(silence).toBeTruthy();
  });

  it("keeps like in looks like this", () => {
    const words = timedWords("looks like this");
    const result = cleanupWords(words);
    const cleaned = cleanedTextFromResult(result);
    expect(cleaned.toLowerCase()).toContain("like");
    expect(result.deleted.some((item) => item.reason === "filler")).toBe(false);
  });

  it("drops keep ranges shorter than 180ms", () => {
    const words: Word[] = [
      { text: "hi", start: 0, end: 0.12, confidence: 1 },
      { text: "there", start: 1.2, end: 1.7, confidence: 1 },
    ];
    const result = cleanupWords(words, { minKeepMs: 180, silenceMs: 350 });
    expect(result.keptRanges.some((range) => range.end - range.start < 0.18)).toBe(
      false,
    );
    expect(result.keptRanges.length).toBe(1);
    expect(result.keptRanges[0].text).toContain("there");
  });

  it("remaps the first kept word near 0", () => {
    const words = timedWords("um keep going", 0.6);
    const result = cleanupWords(words);
    const remapped = remapWords(words, result.keptRanges);
    expect(remapped.length).toBeGreaterThan(0);
    expect(remapped[0].start).toBeLessThan(0.1);
  });
});
