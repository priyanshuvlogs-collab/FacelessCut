import "server-only";
import { sleep } from "@/lib/utils";
import type {
  HookMetadata,
  Section,
  Style,
  TranscriptResult,
  Word,
} from "@/lib/types";

const SAMPLE_LANDSCAPE =
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";
const SAMPLE_VERTICAL =
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4";

const SCRIPT = [
  "um",
  "look",
  "I",
  "I",
  "think",
  "this",
  "this",
  "is",
  "why",
  "this",
  "is",
  "why",
  "most",
  "faceless",
  "channels",
  "stall",
  "uh",
  "after",
  "the",
  "first",
  "month",
  "you",
  "know",
  "the",
  "hook",
  "is",
  "too",
  "soft",
  "and",
  "the",
  "cut",
  "leaves",
  "dead",
  "air",
  "in",
  "the",
  "middle",
  "basically",
  "viewers",
  "leave",
  "before",
  "the",
  "payoff",
  "so",
  "here",
  "is",
  "the",
  "rule",
  "cut",
  "silence",
  "kill",
  "filler",
  "and",
  "put",
  "the",
  "promise",
  "in",
  "the",
  "first",
  "five",
  "seconds",
  "then",
  "walk",
  "the",
  "body",
  "in",
  "tight",
  "chapters",
  "and",
  "close",
  "with",
  "one",
  "clear",
  "next",
  "step",
  "subscribe",
  "if",
  "you",
  "want",
  "the",
  "full",
  "template",
];

function buildMockWords(): Word[] {
  const words: Word[] = [];
  let t = 0.42;
  SCRIPT.forEach((text, index) => {
    const duration = 0.28 + (text.length > 6 ? 0.08 : 0);
    if (index === 12 || index === 36) {
      t += 0.82;
    }
    words.push({
      text,
      start: Number(t.toFixed(3)),
      end: Number((t + duration).toFixed(3)),
      confidence: 0.94,
    });
    t += duration + 0.06;
  });
  return words;
}

export function mockTranscribe(_sourceUrl: string): TranscriptResult {
  const words = buildMockWords();
  const durationSec = words[words.length - 1]?.end ?? 40;
  return {
    words,
    durationSec,
    highlights: ["hook", "silence", "chapters"],
    chapters: [
      {
        headline: "Why faceless channels stall",
        gist: "Soft hooks and dead air lose viewers",
        start: words[0].start,
        end: words[22].end,
      },
      {
        headline: "The cleanup rule",
        gist: "Cut silence and lead with the promise",
        start: words[23].start,
        end: words[55].end,
      },
      {
        headline: "Close with a next step",
        gist: "Subscribe for the template",
        start: words[56].start,
        end: words[words.length - 1].end,
      },
    ],
  };
}

const STYLE_HOOKS: Record<Style, string> = {
  "faceless-documentary": "THE CUT IS THE HOOK",
  "reddit-story": "NOBODY EXPECTED THE CUT",
  listicle: "3 CUTS THAT KEEP VIEWS",
  "finance-calm": "ONE RULE FOR RETENTION",
  "horror-story": "THE SILENCE WAS WRONG",
};

export function mockWriteMetadata(
  transcript: string,
  style: Style,
  customHook?: string | null,
): HookMetadata {
  const hook = customHook?.trim()
    ? customHook.trim().toUpperCase()
    : STYLE_HOOKS[style];
  const firstClause = transcript.split(/[.!?]/)[0]?.slice(0, 70) || "a cleaner faceless cut";
  return {
    hook,
    title: `${hook.replace(/[.:]/g, "")} | Faceless YouTube Edit`,
    description: [
      hook,
      "",
      firstClause,
      "",
      "Chapters are generated from the cleaned speech timeline.",
      "No facts were added beyond the transcript.",
    ].join("\n"),
    punchWords: ["cut", "hook", "silence", "rule", "views", "retention"],
  };
}

export function mockRefineSections(sections: Section[]): Section[] {
  return sections;
}

export async function mockRenderOutputs(): Promise<{
  landscapeUrl: string;
  verticalUrl: string;
  shortUrl: string;
}> {
  await sleep(8000);
  return {
    landscapeUrl: SAMPLE_LANDSCAPE,
    verticalUrl: SAMPLE_VERTICAL,
    shortUrl: SAMPLE_VERTICAL,
  };
}
