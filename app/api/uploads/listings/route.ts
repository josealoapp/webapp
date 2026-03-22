import { NextRequest, NextResponse } from "next/server";
import { createListingImageUpload, validateListingImage } from "@/lib/s3";
import { getAdminAuth } from "@/lib/firebase-admin";

type UploadRequest = {
  files?: Array<{
    name?: string;
    type?: string;
    size?: number;
  }>;
};

function getBearerToken(request: NextRequest) {
  const header = request.headers.get("authorization") || "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    return null;
  }

  return token;
}

export async function POST(request: NextRequest) {
  try {
    const token = getBearerToken(request);
    if (!token) {
      return NextResponse.json({ error: "auth/missing-token" }, { status: 401 });
    }

    const decoded = await getAdminAuth().verifyIdToken(token);
    const body = (await request.json()) as UploadRequest;
    const files = body.files || [];

    if (!files.length) {
      return NextResponse.json({ error: "upload/no-files" }, { status: 400 });
    }

    if (files.length > 10) {
      return NextResponse.json({ error: "upload/too-many-files" }, { status: 400 });
    }

    const uploads = await Promise.all(
      files.map(async (file, index) => {
        const name = file.name || `image-${index + 1}.jpg`;
        const type = file.type || "image/jpeg";
        const size = typeof file.size === "number" ? file.size : 0;

        validateListingImage({ name, type, size });

        const upload = await createListingImageUpload({
          fileName: name,
          contentType: type,
          userId: decoded.uid,
          index,
        });

        return {
          uploadUrl: upload.uploadUrl,
          fileUrl: upload.fileUrl,
          contentType: type,
        };
      })
    );

    return NextResponse.json({ uploads });
  } catch (error) {
    const message = error instanceof Error ? error.message : "upload/unknown-error";
    const status = message.startsWith("upload/") ? 400 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
