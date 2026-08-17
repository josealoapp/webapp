import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { moderateImageBuffer } from "@/lib/image-moderation";
import { uploadListingImageObject, validateListingImage } from "@/lib/s3";
import { getAdminAuth } from "@/lib/firebase-admin";

export const runtime = "nodejs";

const SERVER_IMAGE_MAX_DIMENSION = 1600;
const SERVER_WEBP_QUALITY = 82;

function getBearerToken(request: NextRequest) {
  const header = request.headers.get("authorization") || "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    return null;
  }

  return token;
}

function getWebpFileName(fileName: string, index: number) {
  const baseName = fileName.replace(/\.[^.]+$/, "") || `image-${index + 1}`;
  return `${baseName}.webp`;
}

async function optimizeImageForStorage(buffer: Buffer) {
  return sharp(buffer)
    .rotate()
    .resize({
      width: SERVER_IMAGE_MAX_DIMENSION,
      height: SERVER_IMAGE_MAX_DIMENSION,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: SERVER_WEBP_QUALITY })
    .toBuffer();
}

export async function POST(request: NextRequest) {
  try {
    const token = getBearerToken(request);
    if (!token) {
      return NextResponse.json({ error: "auth/missing-token" }, { status: 401 });
    }

    const decoded = await getAdminAuth().verifyIdToken(token);
    const formData = await request.formData();
    const files = formData
      .getAll("files")
      .filter((entry): entry is File => entry instanceof File);

    if (!files.length) {
      return NextResponse.json({ error: "upload/no-files" }, { status: 400 });
    }

    if (files.length > 10) {
      return NextResponse.json({ error: "upload/too-many-files" }, { status: 400 });
    }

    const preparedFiles = await Promise.all(
      files.map(async (file, index) => {
        const name = file.name || `image-${index + 1}.jpg`;
        const type = file.type || "image/jpeg";
        const size = typeof file.size === "number" ? file.size : 0;

        validateListingImage({ name, type, size });
        const buffer = Buffer.from(await file.arrayBuffer());
        const moderation = await moderateImageBuffer(buffer);

        if (moderation.blocked) {
          throw new Error("upload/unsafe-content");
        }
        const optimizedBuffer = await optimizeImageForStorage(buffer);

        return {
          buffer: optimizedBuffer,
          name: getWebpFileName(name, index),
          type: "image/webp",
          index,
        };
      })
    );

    const uploads = await Promise.all(
      preparedFiles.map(async (file) => {
        const upload = await uploadListingImageObject({
          fileName: file.name,
          contentType: file.type,
          userId: decoded.uid,
          index: file.index,
          body: file.buffer,
        });

        return {
          fileUrl: upload.fileUrl,
        };
      })
    );

    return NextResponse.json({ uploads });
  } catch (error) {
    const message = error instanceof Error ? error.message : "upload/unknown-error";
    const name = error instanceof Error ? error.name : "";
    const details =
      error && typeof error === "object"
        ? {
            name,
            message,
            code: "code" in error ? String((error as { code?: unknown }).code) : undefined,
            statusCode:
              "$metadata" in error &&
              error.$metadata &&
              typeof error.$metadata === "object" &&
              "httpStatusCode" in error.$metadata
                ? Number((error.$metadata as { httpStatusCode?: unknown }).httpStatusCode)
                : undefined,
          }
        : { name, message };

    console.error("uploads/listings failed", details, error);

    if (name === "AccessDenied" || message.includes("not authorized to perform: s3:PutObject")) {
      return NextResponse.json(
        {
          error: "upload/s3-access-denied",
          ...(process.env.NODE_ENV !== "production" ? { details } : {}),
        },
        { status: 500 }
      );
    }

    const status = message.startsWith("upload/") ? 400 : 500;

    return NextResponse.json(
      {
        error: message,
        ...(process.env.NODE_ENV !== "production" ? { details } : {}),
      },
      { status }
    );
  }
}
