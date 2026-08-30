export type Word = {
  text: string;
  start: number;
  end: number;
  confidence: number;
};

export type KeptRange = {
  start: number;
  end: number;
  text: string;
};

export type DeletedReason = "silence" | "filler" | "repeat";

export type DeletedRange = {
  start: number;
  end: number;
  reason: DeletedReason;
};

export type CleanupStats = {
  silenceSec: number;
  fillerCount: number;
  repeatCount: number;
  originalSec: number;
  cleanSec: number;
};

export type CleanupResult = {
  keptRanges: KeptRange[];
  deleted: DeletedRange[];
  stats: CleanupStats;
};

export type RemappedWord = Word & {
  originalStart: number;
  originalEnd: number;
};

export type SectionType = "hook" | "body" | "cta";

export type Section = {
  id: string;
  type: SectionType;
  title: string;
  start: number;
  end: number;
  text: string;
  hook: string;
  includeInLongVideo: boolean;
  includeAsShort: boolean;
};

export type HookMetadata = {
  hook: string;
  title: string;
  description: string;
  punchWords: string[];
};

export type CaptionCue = {
  text: string;
  start: number;
  end: number;
  highlight: string[];
};

export type ShortOutput = {
  sectionId: string;
  title: string;
  url: string | null;
  status: "pending" | "ready" | "skipped" | "failed";
};

export type TranscriptChapter = {
  gist?: string;
  headline?: string;
  summary?: string;
  start: number;
  end: number;
};

export type TranscriptResult = {
  words: Word[];
  chapters: TranscriptChapter[];
  highlights: string[];
  durationSec: number;
};

export type Style =
  | "faceless-documentary"
  | "reddit-story"
  | "listicle"
  | "finance-calm"
  | "horror-story";

export type HookMode = "auto" | "custom";
export type Outputs = "landscape" | "vertical" | "both";
export type SplitMode = "one" | "chapters" | "shorts";

export type JobStatus =
  | "uploading"
  | "transcribing"
  | "cleaning"
  | "segregating"
  | "writing"
  | "rendering"
  | "ready"
  | "failed";

export type CleanupOptions = {
  silenceMs?: number;
  removeFillers?: boolean;
  removeRepeats?: boolean;
  minKeepMs?: number;
  padMs?: number;
};

export const STYLES: Style[] = [
  "faceless-documentary",
  "reddit-story",
  "listicle",
  "finance-calm",
  "horror-story",
];

export const JOB_STEPS: JobStatus[] = [
  "uploading",
  "transcribing",
  "cleaning",
  "segregating",
  "writing",
  "rendering",
  "ready",
];
