import { randomUUID } from "crypto";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }

  return value;
}

function sanitizeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function getFileExtension(fileName: string) {
  const match = fileName.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match ? `.${match[1]}` : "";
}

export function getS3Config() {
  const region = requireEnv("AWS_REGION");
  const bucket = requireEnv("AWS_S3_BUCKET");
  const publicBaseUrl =
    process.env.NEXT_PUBLIC_AWS_S3_PUBLIC_BASE_URL ||
    `https://${bucket}.s3.${region}.amazonaws.com`;

  return {
    region,
    bucket,
    publicBaseUrl: publicBaseUrl.replace(/\/+$/, ""),
  };
}

export function createS3Client() {
  const { region } = getS3Config();

  return new S3Client({
    region,
    credentials: {
      accessKeyId: requireEnv("AWS_ACCESS_KEY_ID"),
      secretAccessKey: requireEnv("AWS_SECRET_ACCESS_KEY"),
    },
  });
}

export function validateListingImage(input: { name: string; type: string; size: number }) {
  if (!input.type.startsWith("image/")) {
    throw new Error("upload/invalid-type");
  }

  if (input.size <= 0 || input.size > MAX_FILE_SIZE_BYTES) {
    throw new Error("upload/invalid-size");
  }
}

export function buildListingImageKey(fileName: string, userId: string, index: number) {
  const extension = getFileExtension(fileName);
  const safeUserId = sanitizeSegment(userId || "anonymous");
  return `listings/${safeUserId}/${Date.now()}_${index}_${randomUUID()}${extension}`;
}

export async function createListingImageUpload(input: {
  fileName: string;
  contentType: string;
  userId: string;
  index: number;
}) {
  const { bucket, publicBaseUrl } = getS3Config();
  const client = createS3Client();
  const key = buildListingImageKey(input.fileName, input.userId, input.index);

  const uploadUrl = await getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: input.contentType,
      CacheControl: "public, max-age=31536000, immutable",
    }),
    { expiresIn: 60 }
  );

  return {
    key,
    uploadUrl,
    fileUrl: `${publicBaseUrl}/${key}`,
  };
}

