import type { Job } from "@prisma/client";
import type {
  CleanupResult,
  RemappedWord,
  Section,
  ShortOutput,
  Word,
} from "@/lib/types";

function parseJson<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  return value as T;
}

export function serializeJob(job: Job) {
  const cleanup = parseJson<CleanupResult | null>(job.cleanupJson, null);
  const sections = parseJson<Section[]>(job.sectionsJson, []);
  const shorts = parseJson<ShortOutput[]>(job.shortsJson, []);
  const words = parseJson<Word[]>(job.wordsJson, []);
  const remapped = parseJson<RemappedWord[]>(job.remappedWordsJson, []);

  return {
    id: job.id,
    status: job.status,
    sourceKey: job.sourceKey,
    sourceUrl: job.sourceUrl,
    originalDurationSec: job.originalDurationSec,
    cleanDurationSec: job.cleanDurationSec,
    style: job.style,
    hookMode: job.hookMode,
    customHook: job.customHook,
    outputs: job.outputs,
    splitMode: job.splitMode,
    silenceMs: job.silenceMs,
    removeFillers: job.removeFillers,
    removeRepeats: job.removeRepeats,
    words,
    remappedWords: remapped,
    cleanup,
    sections,
    hookText: job.hookText,
    youtubeTitle: job.youtubeTitle,
    youtubeDescription: job.youtubeDescription,
    outputLandscapeUrl: job.outputLandscapeUrl,
    outputVerticalUrl: job.outputVerticalUrl,
    shorts,
    stats: cleanup?.stats ?? null,
    error: job.error,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
  };
}

export type SerializedJob = ReturnType<typeof serializeJob>;
