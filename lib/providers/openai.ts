import "server-only";
import { env } from "@/lib/env";
import type { HookMetadata, Section, Style } from "@/lib/types";

type OpenAiResponse = {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
};

async function completeJson(system: string, user: string): Promise<unknown> {
  if (!env.openaiKey) {
    throw new Error("OPENAI_API_KEY is missing");
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.openaiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: env.openaiModel,
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
    cache: "no-store",
  });

  const payload = (await response.json()) as OpenAiResponse;
  if (!response.ok) {
    throw new Error(payload.error?.message || `OpenAI request failed (${response.status})`);
  }

  const content = payload.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI returned an empty response");
  }
  return JSON.parse(content) as unknown;
}

const STYLE_RULES: Record<Style, string> = {
  "faceless-documentary": "Calm authority. No hype. Speak like a measured narrator.",
  "reddit-story": "Curiosity. Use a nobody-expected angle without inventing a twist.",
  listicle: "Lead with a number plus a mistake or rule from the transcript.",
  "finance-calm": "One concrete rule or number. No get-rich claims.",
  "horror-story": "An incomplete tension sentence. Do not resolve the scare.",
};

export async function writeMetadataWithOpenAi(input: {
  transcript: string;
  style: Style;
  customHook?: string | null;
}): Promise<HookMetadata> {
  const payload = await completeJson(
    [
      "You write YouTube packaging for faceless channels.",
      "Return strict JSON: { hook, title, description, punchWords }.",
      "Never invent facts that are not in the transcript.",
      "hook: max 8 words, ALL CAPS, no emoji.",
      "title: max 70 characters.",
      "description: 2-5 short paragraphs plus a chapters placeholder.",
      "punchWords: 3-8 words that already appear in the transcript.",
      STYLE_RULES[input.style],
    ].join(" "),
    JSON.stringify({
      style: input.style,
      customHook: input.customHook ?? null,
      transcript: input.transcript.slice(0, 12000),
    }),
  );

  const record = payload as Record<string, unknown>;
  const hook =
    input.customHook?.trim() ||
    (typeof record.hook === "string" ? record.hook : "WATCH THIS CUT");

  return {
    hook: hook.toUpperCase(),
    title: typeof record.title === "string" ? record.title : "A cleaner faceless cut",
    description:
      typeof record.description === "string"
        ? record.description
        : input.transcript.slice(0, 400),
    punchWords: Array.isArray(record.punchWords)
      ? record.punchWords.filter((item): item is string => typeof item === "string")
      : [],
  };
}

export async function refineSectionsWithOpenAi(input: {
  transcript: string;
  style: Style;
  sections: Section[];
}): Promise<Section[]> {
  const payload = await completeJson(
    [
      "Refine already-split sections for a faceless YouTube cut.",
      "Return JSON: { sections: [{ id, type, title, hook }] }.",
      "type must be hook | body | cta.",
      "title: max 6 words. hook: max 8 words, ALL CAPS, no emoji.",
      "Do not invent facts. Keep the same section ids and count.",
    ].join(" "),
    JSON.stringify({
      style: input.style,
      transcript: input.transcript.slice(0, 8000),
      sections: input.sections.map((section) => ({
        id: section.id,
        type: section.type,
        title: section.title,
        text: section.text,
        start: section.start,
        end: section.end,
      })),
    }),
  );

  const record = payload as { sections?: Array<Record<string, unknown>> };
  if (!record.sections) return input.sections;

  return input.sections.map((section) => {
    const update = record.sections?.find((item) => item.id === section.id);
    if (!update) return section;
    const type =
      update.type === "hook" || update.type === "body" || update.type === "cta"
        ? update.type
        : section.type;
    return {
      ...section,
      type,
      title:
        typeof update.title === "string"
          ? update.title.split(/\s+/).slice(0, 6).join(" ")
          : section.title,
      hook:
        typeof update.hook === "string"
          ? update.hook.toUpperCase()
          : section.hook,
    };
  });
}
