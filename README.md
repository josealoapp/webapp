This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## AWS S3 uploads

Listing image uploads now pass through the app server first. Each image is optimized to WebP on the client, scanned for NSFW content with the open-source `nsfwjs` model on the server, and only then written to AWS S3.

Add these server environment variables before running the app:

```bash
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_S3_BUCKET=your-bucket-name
NEXT_PUBLIC_AWS_S3_PUBLIC_BASE_URL=https://your-bucket-name.s3.us-east-1.amazonaws.com
```

Notes:

- The bucket must allow public reads for the uploaded listing images, or `NEXT_PUBLIC_AWS_S3_PUBLIC_BASE_URL` should point to a public CloudFront distribution in front of the bucket.
- The IAM credentials used by the app must allow at least `s3:PutObject` on the target bucket path, or uploads will fail with `upload/s3-access-denied`.
- Optional moderation tuning:

```bash
NSFW_BLOCK_HENTAI_THRESHOLD=0.7
NSFW_BLOCK_PORN_THRESHOLD=0.7
NSFW_BLOCK_SEXY_THRESHOLD=0.85
```

- Firebase Auth and Firestore are still used by the app; only image storage moved to S3.
- Marketplace chat and offer permissions are defined in `firestore.rules` and must be deployed to Firebase before offers can be created successfully.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
