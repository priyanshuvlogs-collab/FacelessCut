import { z } from "zod";

export const styleSchema = z.enum([
  "faceless-documentary",
  "reddit-story",
  "listicle",
  "finance-calm",
  "horror-story",
]);

export const hookModeSchema = z.enum(["auto", "custom"]);
export const outputsSchema = z.enum(["landscape", "vertical", "both"]);
export const splitModeSchema = z.enum(["one", "chapters", "shorts"]);
export const silenceMsSchema = z.union([
  z.literal(250),
  z.literal(350),
  z.literal(500),
]);

export const signUploadSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.enum(["video/mp4", "video/quicktime", "video/webm"]),
});

export const createJobSchema = z.object({
  sourceKey: z.string().min(1),
  sourceUrl: z.string().min(1),
  style: styleSchema.default("faceless-documentary"),
  hookMode: hookModeSchema.default("auto"),
  customHook: z.string().max(240).optional().nullable(),
  outputs: outputsSchema.default("both"),
  splitMode: splitModeSchema.default("chapters"),
  silenceMs: silenceMsSchema.default(350),
  removeFillers: z.boolean().default(true),
  removeRepeats: z.boolean().default(true),
});

export const rerunJobSchema = z.object({
  style: styleSchema.optional(),
  hookMode: hookModeSchema.optional(),
  customHook: z.string().max(240).optional().nullable(),
  outputs: outputsSchema.optional(),
  splitMode: splitModeSchema.optional(),
  silenceMs: silenceMsSchema.optional(),
  removeFillers: z.boolean().optional(),
  removeRepeats: z.boolean().optional(),
});

export const sectionSchema = z.object({
  id: z.string(),
  type: z.enum(["hook", "body", "cta"]),
  title: z.string(),
  start: z.number(),
  end: z.number(),
  text: z.string(),
  hook: z.string(),
  includeInLongVideo: z.boolean(),
  includeAsShort: z.boolean(),
});

export const patchJobSchema = z.object({
  hookText: z.string().max(280).optional(),
  youtubeTitle: z.string().max(120).optional(),
  youtubeDescription: z.string().max(8000).optional(),
  sectionsJson: z.array(sectionSchema).optional(),
});

export const rerenderJobSchema = z.object({
  hookText: z.string().max(280).optional(),
  youtubeTitle: z.string().max(120).optional(),
  youtubeDescription: z.string().max(8000).optional(),
  sectionsJson: z.array(sectionSchema).optional(),
  outputs: outputsSchema.optional(),
  splitMode: splitModeSchema.optional(),
});

export type CreateJobInput = z.infer<typeof createJobSchema>;
export type RerunJobInput = z.infer<typeof rerunJobSchema>;
export type PatchJobInput = z.infer<typeof patchJobSchema>;
export type RerenderJobInput = z.infer<typeof rerenderJobSchema>;
