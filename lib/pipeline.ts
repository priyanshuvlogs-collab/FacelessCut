import "server-only";
import { Prisma } from "@prisma/client";
import { buildCaptions } from "@/lib/captions";
import { cleanupWords } from "@/lib/cleanup";
import { prisma } from "@/lib/db";
import { writePackaging } from "@/lib/hooks";
import { remapWords } from "@/lib/remap";
import { renderOutputs } from "@/lib/shotstack";
import { publicUrlForKey } from "@/lib/storage";
import { segregateSpeech } from "@/lib/segregate";
import { transcribeSource } from "@/lib/transcribe";
import type {
  CleanupResult,
  HookMode,
  Outputs,
  RemappedWord,
  Section,
  SplitMode,
  Style,
  TranscriptChapter,
  Word,
} from "@/lib/types";

type PipelineMode = "full" | "rerun" | "rerender";

function asJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  return value as T;
}

async function failJob(id: string, error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : "Pipeline failed";
  await prisma.job.update({
    where: { id },
    data: { status: "failed", error: message },
  });
}

async function setStatus(id: string, status: string, extra: Prisma.JobUpdateInput = {}) {
  await prisma.job.update({
    where: { id },
    data: { status, error: null, ...extra },
  });
}

export async function runPipeline(jobId: string, mode: PipelineMode = "full"): Promise<void> {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) return;

  try {
    const sourceUrl = publicUrlForKey(job.sourceKey, job.sourceUrl);
    let words = parseJson<Word[]>(job.wordsJson, []);
    let chapters: TranscriptChapter[] = [];

    if (mode === "full" || words.length === 0) {
      await setStatus(jobId, "transcribing");
      const transcript = await transcribeSource(sourceUrl);
      words = transcript.words;
      chapters = transcript.chapters;
      await prisma.job.update({
        where: { id: jobId },
        data: {
          wordsJson: asJson(words),
          originalDurationSec: transcript.durationSec,
        },
      });
    }

    let cleanup: CleanupResult;
    let remapped: RemappedWord[];
    let sections: Section[];

    if (mode === "rerender") {
      cleanup = parseJson<CleanupResult>(job.cleanupJson, {
        keptRanges: [],
        deleted: [],
        stats: {
          silenceSec: 0,
          fillerCount: 0,
          repeatCount: 0,
          originalSec: 0,
          cleanSec: 0,
        },
      });
      remapped = parseJson<RemappedWord[]>(job.remappedWordsJson, []);
      sections = parseJson<Section[]>(job.sectionsJson, []);
    } else {
      await setStatus(jobId, "cleaning");
      cleanup = cleanupWords(words, {
        silenceMs: job.silenceMs,
        removeFillers: job.removeFillers,
        removeRepeats: job.removeRepeats,
      });
      remapped = remapWords(words, cleanup.keptRanges);
      await prisma.job.update({
        where: { id: jobId },
        data: {
          cleanupJson: asJson(cleanup),
          remappedWordsJson: asJson(remapped),
          originalDurationSec: cleanup.stats.originalSec,
          cleanDurationSec: cleanup.stats.cleanSec,
        },
      });

      await setStatus(jobId, "segregating");
      sections = await segregateSpeech({
        words: remapped,
        keptRanges: cleanup.keptRanges,
        chapters,
        style: job.style as Style,
        splitMode: job.splitMode as SplitMode,
      });
      await prisma.job.update({
        where: { id: jobId },
        data: { sectionsJson: asJson(sections) },
      });

      await setStatus(jobId, "writing");
      const metadata = await writePackaging({
        transcript: remapped.map((word) => word.text).join(" "),
        style: job.style as Style,
        hookMode: job.hookMode as HookMode,
        customHook: job.customHook,
        sections,
      });
      await prisma.job.update({
        where: { id: jobId },
        data: {
          hookText: metadata.hook,
          youtubeTitle: metadata.title,
          youtubeDescription: metadata.description,
        },
      });
    }

    const latest = await prisma.job.findUniqueOrThrow({ where: { id: jobId } });
    const latestSections = parseJson<Section[]>(latest.sectionsJson, sections);
    const punchSource = latest.hookText ?? "";
    const captions = buildCaptions(
      remapped,
      punchSource.split(/\s+/).filter((word) => word.length > 2),
    );

    await setStatus(jobId, "rendering");
    const rendered = await renderOutputs({
      sourceUrl,
      keptRanges: cleanup.keptRanges,
      hookText: latest.hookText || "WATCH THIS",
      captions,
      sections: latestSections,
      outputs: (latest.outputs as Outputs) ?? "both",
      splitMode: (latest.splitMode as SplitMode) ?? "chapters",
    });

    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: "ready",
        error: null,
        outputLandscapeUrl: rendered.landscapeUrl,
        outputVerticalUrl: rendered.verticalUrl,
        shortsJson: asJson(rendered.shorts),
      },
    });
  } catch (error) {
    await failJob(jobId, error);
  }
}
