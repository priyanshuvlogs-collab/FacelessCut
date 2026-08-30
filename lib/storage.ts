import "server-only";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env, hasS3Config, isMock } from "@/lib/env";
import { slugifyFilename } from "@/lib/utils";

export type SignedUpload = {
  uploadUrl: string;
  key: string;
  publicUrl: string;
};

function objectKey(filename: string): string {
  const safe = slugifyFilename(filename) || "clip.mp4";
  return `uploads/${Date.now()}-${crypto.randomUUID()}-${safe}`;
}

function s3Client(): S3Client {
  return new S3Client({
    region: env.s3.region || "auto",
    endpoint: env.s3.endpoint || undefined,
    forcePathStyle: Boolean(env.s3.endpoint),
    credentials: {
      accessKeyId: env.s3.accessKey,
      secretAccessKey: env.s3.secretKey,
    },
  });
}

export async function signUpload(
  filename: string,
  contentType: string,
): Promise<SignedUpload> {
  const key = objectKey(filename);

  if (isMock() || !hasS3Config()) {
    const uploadUrl = `${env.appUrl}/api/uploads/local?key=${encodeURIComponent(key)}`;
    return {
      uploadUrl,
      key,
      publicUrl: uploadUrl,
    };
  }

  const command = new PutObjectCommand({
    Bucket: env.s3.bucket,
    Key: key,
    ContentType: contentType,
  });
  const uploadUrl = await getSignedUrl(s3Client(), command, { expiresIn: 60 * 15 });
  const publicUrl = env.s3.publicBaseUrl
    ? `${env.s3.publicBaseUrl}/${key}`
    : uploadUrl.split("?")[0];

  return { uploadUrl, key, publicUrl };
}

export function publicUrlForKey(key: string, fallback?: string | null): string {
  if (fallback) return fallback;
  if (hasS3Config() && env.s3.publicBaseUrl) {
    return `${env.s3.publicBaseUrl}/${key}`;
  }
  return `${env.appUrl}/api/uploads/local?key=${encodeURIComponent(key)}`;
}
