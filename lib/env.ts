import "server-only";

function read(name: string, fallback = ""): string {
  return process.env[name] ?? fallback;
}

export function isMock(): boolean {
  const value = read("USE_MOCK", "true").toLowerCase();
  return value !== "false" && value !== "0";
}

export const env = {
  useMock: isMock(),
  databaseUrl: read("DATABASE_URL", "file:./dev.db"),
  appUrl: read("APP_URL", "http://localhost:3000").replace(/\/$/, ""),
  s3: {
    bucket: read("S3_BUCKET"),
    endpoint: read("S3_ENDPOINT"),
    region: read("S3_REGION", "auto"),
    accessKey: read("S3_ACCESS_KEY"),
    secretKey: read("S3_SECRET_KEY"),
    publicBaseUrl: read("S3_PUBLIC_BASE_URL").replace(/\/$/, ""),
  },
  assemblyAiKey: read("ASSEMBLYAI_API_KEY"),
  openaiKey: read("OPENAI_API_KEY"),
  openaiModel: read("OPENAI_MODEL", "gpt-4o-mini"),
  shotstack: {
    apiKey: read("SHOTSTACK_API_KEY"),
    env: read("SHOTSTACK_ENV", "stage"),
    ownerId: read("SHOTSTACK_OWNER_ID"),
  },
};

export function hasS3Config(): boolean {
  return Boolean(env.s3.bucket && env.s3.accessKey && env.s3.secretKey);
}
