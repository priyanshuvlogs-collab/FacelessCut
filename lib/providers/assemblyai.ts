import "server-only";
import { env } from "@/lib/env";
import { sleep } from "@/lib/utils";
import type { TranscriptChapter, TranscriptResult, Word } from "@/lib/types";

type AssemblyWord = {
  text?: string;
  start?: number;
  end?: number;
  confidence?: number;
};

type AssemblyChapter = {
  gist?: string;
  headline?: string;
  summary?: string;
  start?: number;
  end?: number;
};

type AssemblyTranscript = {
  id?: string;
  status?: string;
  error?: string;
  audio_duration?: number;
  words?: AssemblyWord[];
  chapters?: AssemblyChapter[];
  auto_highlights_result?: {
    results?: Array<{ text?: string }>;
  };
};

const API = "https://api.assemblyai.com/v2";

async function assemblyFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      authorization: env.assemblyAiKey,
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error || `AssemblyAI request failed (${response.status})`);
  }
  return payload;
}

export async function transcribeWithAssemblyAi(audioUrl: string): Promise<TranscriptResult> {
  if (!env.assemblyAiKey) {
    throw new Error("ASSEMBLYAI_API_KEY is missing");
  }

  const created = await assemblyFetch<AssemblyTranscript>("/transcript", {
    method: "POST",
    body: JSON.stringify({
      audio_url: audioUrl,
      speech_model: "best",
      punctuate: true,
      format_text: true,
      auto_chapters: true,
      auto_highlights: true,
    }),
  });

  if (!created.id) {
    throw new Error("AssemblyAI did not return a transcript id");
  }

  let transcript: AssemblyTranscript = created;
  for (let attempt = 0; attempt < 180; attempt += 1) {
    transcript = await assemblyFetch<AssemblyTranscript>(`/transcript/${created.id}`);
    if (transcript.status === "completed") break;
    if (transcript.status === "error") {
      throw new Error(transcript.error || "AssemblyAI transcription failed");
    }
    await sleep(2000);
  }

  if (transcript.status !== "completed") {
    throw new Error("AssemblyAI transcription timed out");
  }

  const words: Word[] = (transcript.words ?? []).map((word) => ({
    text: word.text ?? "",
    start: (word.start ?? 0) / 1000,
    end: (word.end ?? 0) / 1000,
    confidence: word.confidence ?? 0,
  }));

  const chapters: TranscriptChapter[] = (transcript.chapters ?? []).map((chapter) => ({
    gist: chapter.gist,
    headline: chapter.headline,
    summary: chapter.summary,
    start: (chapter.start ?? 0) / 1000,
    end: (chapter.end ?? 0) / 1000,
  }));

  const highlights =
    transcript.auto_highlights_result?.results
      ?.map((item) => item.text ?? "")
      .filter(Boolean) ?? [];

  return {
    words,
    chapters,
    highlights,
    durationSec: transcript.audio_duration ?? words[words.length - 1]?.end ?? 0,
  };
}
