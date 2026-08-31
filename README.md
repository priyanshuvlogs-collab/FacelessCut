# FacelessCut

Private studio for faceless YouTube channels.

Upload a clip (stock/B-roll + voiceover, or a raw VO take). FacelessCut transcribes it, removes silence / fillers / repeats, splits the cleaned speech into Hook / Body / CTA, writes a hook + title/description, burns captions on the **clean** timeline, and renders 16:9 plus optional 9:16 Shorts.

This is not a talking-head zoom app and not a text-to-video generator.

## Local setup

```bash
npm install
npx prisma generate
npx prisma db push
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

`USE_MOCK=true` is the default in `.env.local`. The UI, cleanup, segregation, packaging, and renderer all run without paid keys. Mock transcription writes ~80 words over ~40 seconds (including `um` / `uh`, `I I`, `this is why this is why`, and 0.8s gaps). The mock renderer waits 8 seconds, then attaches public sample MP4s.

Copy `.env.example` if you need a fresh env file. Prisma uses `DATABASE_URL=file:./dev.db` (created next to `prisma/schema.prisma`).

## Plug in real providers later

Set `USE_MOCK=false` and fill the keys in `.env.local`.

1. **Storage** — `S3_BUCKET`, `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_PUBLIC_BASE_URL` for Cloudflare R2 or AWS S3. Uploads are presigned PUTs. If S3 is empty, the app still stores files locally at `/api/uploads/local`.
2. **AssemblyAI** — `ASSEMBLYAI_API_KEY`. Word-level timestamps, `auto_chapters`, `auto_highlights`. Times are stored in seconds.
3. **OpenAI** — `OPENAI_API_KEY` and `OPENAI_MODEL` (default `gpt-4o-mini`). Writes hook / title / description JSON and can refine section titles. Never invents facts outside the transcript. `hookMode=custom` keeps your hook and still writes packaging.
4. **Shotstack** — `SHOTSTACK_API_KEY`, `SHOTSTACK_ENV` (`stage` or `v1`), optional `SHOTSTACK_OWNER_ID`. Builds an Edit JSON: one clip per kept range from the same source, hook overlay 0–3s, captions in the bottom 18% safe zone with punch words in `#F5D547`.

## Pipeline

- Transcribe with word-level timestamps (AssemblyAI or mock).
- Clean fillers, consecutive/n-gram repeats, and silence gaps.
- Remap every kept word onto the compressed timeline.
- Segregate cleaned speech into Hook / Body / CTA sections (chapters or Shorts).
- Write hook + YouTube title/description from the cleaned transcript.
- Group remapped words into 2–4 word caption cues (max 32 characters).
- Render 16:9 and/or 9:16 from the original source using kept-range trims.
- Persist status after every step so `/jobs/[id]` can poll.

## Known limits

- Do not render inside tiny serverless timeouts for long videos. v1 mock/local is fine.
- Aggressive silence cuts can kill dramatic pauses. Use Loose 500ms for horror/story.
- Always caption from remapped times, never the original transcript times.

## Scripts

```bash
npm run dev
npm test
```

`postinstall` runs `prisma generate`.
