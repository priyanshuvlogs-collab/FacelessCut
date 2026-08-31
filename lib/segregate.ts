import { env, isMock } from "@/lib/env";
import { refineSectionsWithOpenAi } from "@/lib/providers/openai";
import { originalToClean } from "@/lib/remap";
import { roundTime } from "@/lib/utils";
import type {
  KeptRange,
  RemappedWord,
  Section,
  SplitMode,
  Style,
  TranscriptChapter,
} from "@/lib/types";

const MIN_SECTION_SEC = 8;
const MAX_SECTIONS = 8;
const CTA_WORDS = ["subscribe", "follow", "link", "lesson", "comment", "watch next"];

function titleFromText(text: string, fallback: string): string {
  const cleaned = text.replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
  const words = cleaned.split(" ").filter(Boolean).slice(0, 6);
  return words.join(" ") || fallback;
}

function hookFromText(text: string, fallback: string): string {
  const words = text
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 8)
    .join(" ");
  return (words || fallback).toUpperCase();
}

function looksLikeCta(text: string): boolean {
  const lower = text.toLowerCase();
  return CTA_WORDS.some((word) => lower.includes(word));
}

function wordsInRange(words: RemappedWord[], start: number, end: number): RemappedWord[] {
  return words.filter((word) => word.start < end && word.end > start);
}

function sectionFromBounds(
  id: string,
  type: Section["type"],
  start: number,
  end: number,
  words: RemappedWord[],
  splitMode: SplitMode,
): Section {
  const slice = wordsInRange(words, start, end);
  const text = slice.map((word) => word.text).join(" ");
  const duration = end - start;
  return {
    id,
    type,
    title: titleFromText(text, type === "hook" ? "Opening hook" : "Chapter"),
    start: roundTime(start),
    end: roundTime(end),
    text,
    hook: hookFromText(text, type === "cta" ? "WATCH NEXT" : "KEEP WATCHING"),
    includeInLongVideo: true,
    includeAsShort: splitMode === "shorts" && duration >= 12 && duration <= 45,
  };
}

function mergeTinySections(sections: Section[], words: RemappedWord[], splitMode: SplitMode): Section[] {
  if (sections.length === 0) return [];
  const merged: Section[] = [];
  for (const section of sections) {
    const duration = section.end - section.start;
    if (merged.length > 0 && duration < MIN_SECTION_SEC) {
      const prev = merged[merged.length - 1];
      const next = sectionFromBounds(prev.id, prev.type, prev.start, section.end, words, splitMode);
      merged[merged.length - 1] = next;
    } else {
      merged.push(section);
    }
  }
  return merged.slice(0, MAX_SECTIONS);
}

function fromChapters(
  chapters: TranscriptChapter[],
  keptRanges: KeptRange[],
  words: RemappedWord[],
  splitMode: SplitMode,
): Section[] {
  const mapped = chapters
    .map((chapter, index) => {
      const start = originalToClean(chapter.start, keptRanges);
      const end = originalToClean(chapter.end, keptRanges);
      if (end - start < 1) return null;
      return sectionFromBounds(
        `section-${index + 1}`,
        index === 0 ? "hook" : "body",
        start,
        end,
        words,
        splitMode,
      );
    })
    .filter((section): section is Section => section !== null);

  if (mapped.length === 0) return [];
  mapped[0].type = "hook";
  const last = mapped[mapped.length - 1];
  if (looksLikeCta(last.text)) last.type = "cta";
  return mergeTinySections(mapped, words, splitMode);
}

function heuristicSplit(words: RemappedWord[], splitMode: SplitMode): Section[] {
  const cleanEnd = words[words.length - 1]?.end ?? 0;
  if (cleanEnd <= 0) return [];

  const hookEnd = Math.min(8, Math.max(3, cleanEnd * 0.12));
  const bounds: Array<{ start: number; end: number; type: Section["type"] }> = [
    { start: 0, end: hookEnd, type: "hook" },
  ];

  let cursor = hookEnd;
  while (cursor < cleanEnd - 0.5 && bounds.length < MAX_SECTIONS) {
    const remaining = cleanEnd - cursor;
    const isLastWindow = bounds.length === MAX_SECTIONS - 1 || remaining <= 40;
    const length = isLastWindow ? remaining : Math.min(28, Math.max(12, remaining / 2));
    const end = Math.min(cleanEnd, cursor + length);
    bounds.push({
      start: cursor,
      end,
      type: "body",
    });
    cursor = end;
  }

  if (bounds.length > 1) {
    const last = bounds[bounds.length - 1];
    const text = wordsInRange(words, last.start, last.end)
      .map((word) => word.text)
      .join(" ");
    if (looksLikeCta(text) || last.end - last.start <= 16) {
      last.type = "cta";
    }
  }

  return mergeTinySections(
    bounds.map((bound, index) =>
      sectionFromBounds(`section-${index + 1}`, bound.type, bound.start, bound.end, words, splitMode),
    ),
    words,
    splitMode,
  );
}

export async function segregateSpeech(input: {
  words: RemappedWord[];
  keptRanges: KeptRange[];
  chapters?: TranscriptChapter[];
  style: Style;
  splitMode: SplitMode;
}): Promise<Section[]> {
  const { words, keptRanges, chapters = [], style, splitMode } = input;
  if (words.length === 0) return [];

  let sections =
    chapters.length > 0
      ? fromChapters(chapters, keptRanges, words, splitMode)
      : heuristicSplit(words, splitMode);

  if (sections.length === 0) {
    sections = heuristicSplit(words, splitMode);
  }

  const transcript = words.map((word) => word.text).join(" ");
  if (!isMock() && env.openaiKey && sections.length > 0) {
    try {
      sections = await refineSectionsWithOpenAi({ transcript, style, sections });
    } catch {
      // Heuristic sections are enough if the LLM is unavailable.
    }
  }

  return sections.map((section) => ({
    ...section,
    includeAsShort:
      splitMode === "shorts" &&
      section.end - section.start >= 12 &&
      section.end - section.start <= 45,
  }));
}
