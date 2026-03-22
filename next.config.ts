import type { NextConfig } from "next";

const s3PublicBaseUrl = process.env.NEXT_PUBLIC_AWS_S3_PUBLIC_BASE_URL;
const s3Hostname = s3PublicBaseUrl
  ? new URL(s3PublicBaseUrl).hostname
  : process.env.AWS_S3_BUCKET && process.env.AWS_REGION
    ? `${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com`
    : null;

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      ...(s3Hostname
        ? [
            {
              protocol: "https" as const,
              hostname: s3Hostname,
            },
          ]
        : []),
    ],
  },
};

export default nextConfig;
