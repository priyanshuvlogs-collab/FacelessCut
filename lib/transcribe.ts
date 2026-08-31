import "server-only";
import { env, isMock } from "@/lib/env";
import { transcribeWithAssemblyAi } from "@/lib/providers/assemblyai";
import { mockTranscribe } from "@/lib/providers/mock";
import type { TranscriptResult } from "@/lib/types";

export async function transcribeSource(sourceUrl: string): Promise<TranscriptResult> {
  if (isMock() || !env.assemblyAiKey) {
    return mockTranscribe();
  }
  return transcribeWithAssemblyAi(sourceUrl);
}
