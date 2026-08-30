import { StudioForm } from "@/components/studio-form";

export default function StudioPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-20 pt-8">
      <div className="mb-8 max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary">
          Studio
        </p>
        <h1 className="mt-2 font-display text-4xl sm:text-5xl">Drop the clip. Keep the cut.</h1>
        <p className="mt-3 text-muted-foreground">
          Mock mode is on by default. The UI runs the full pipeline with a fake transcript and
          sample renders so you can learn the flow before plugging in paid keys.
        </p>
      </div>
      <StudioForm />
    </div>
  );
}
