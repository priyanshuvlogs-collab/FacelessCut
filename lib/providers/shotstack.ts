import "server-only";
import { env } from "@/lib/env";
import { sleep } from "@/lib/utils";

type ShotstackCreateResponse = {
  success?: boolean;
  message?: string;
  response?: { id?: string };
};

type ShotstackStatusResponse = {
  response?: {
    id?: string;
    status?: string;
    url?: string;
    error?: string;
  };
};

export type ShotstackRenderRequest = {
  timeline: Record<string, unknown>;
  output: Record<string, unknown>;
};

function baseUrl(): string {
  const stage = env.shotstack.env === "v1" ? "v1" : env.shotstack.env || "stage";
  return `https://api.shotstack.io/${stage}`;
}

async function shotstackFetch<T>(path: string, init?: RequestInit): Promise<T> {
  if (!env.shotstack.apiKey) {
    throw new Error("SHOTSTACK_API_KEY is missing");
  }
  const response = await fetch(`${baseUrl()}${path}`, {
    ...init,
    headers: {
      "x-api-key": env.shotstack.apiKey,
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  const payload = (await response.json()) as T & { message?: string };
  if (!response.ok) {
    throw new Error(payload.message || `Shotstack request failed (${response.status})`);
  }
  return payload;
}

export async function submitShotstackRender(
  edit: ShotstackRenderRequest,
): Promise<string> {
  const created = await shotstackFetch<ShotstackCreateResponse>("/render", {
    method: "POST",
    body: JSON.stringify(edit),
  });
  const id = created.response?.id;
  if (!id) {
    throw new Error(created.message || "Shotstack did not return a render id");
  }
  return id;
}

export async function waitForShotstackRender(id: string): Promise<string> {
  for (let attempt = 0; attempt < 180; attempt += 1) {
    const status = await shotstackFetch<ShotstackStatusResponse>(`/render/${id}`);
    const state = status.response?.status;
    if (state === "done") {
      if (!status.response?.url) {
        throw new Error("Shotstack finished without a URL");
      }
      return status.response.url;
    }
    if (state === "failed") {
      throw new Error(status.response?.error || "Shotstack render failed");
    }
    await sleep(2500);
  }
  throw new Error("Shotstack render timed out");
}
