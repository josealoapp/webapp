import * as tf from "@tensorflow/tfjs";
import { load, type PredictionType } from "nsfwjs";
import sharp from "sharp";

const DEFAULT_THRESHOLDS = {
  hentai: 0.7,
  porn: 0.7,
  sexy: 0.85,
} as const;

type ModerationCategory = "Hentai" | "Porn" | "Sexy";

type ModerationResult = {
  blocked: boolean;
  blockedCategories: ModerationCategory[];
  predictions: PredictionType[];
};

type NsfwModel = Awaited<ReturnType<typeof load>>;

declare global {
  // Keep the model cached across Next.js dev module reloads to avoid
  // duplicate TensorFlow variable registration like "Conv1/kernel".
  var __josealoNsfwModelPromise: Promise<NsfwModel> | undefined;
}

function getThreshold(name: "hentai" | "porn" | "sexy") {
  const envName = `NSFW_BLOCK_${name.toUpperCase()}_THRESHOLD`;
  const rawValue = process.env[envName];

  if (!rawValue) {
    return DEFAULT_THRESHOLDS[name];
  }

  const parsed = Number(rawValue);
  if (Number.isNaN(parsed) || parsed < 0 || parsed > 1) {
    return DEFAULT_THRESHOLDS[name];
  }

  return parsed;
}

function getModel() {
  if (!globalThis.__josealoNsfwModelPromise) {
    globalThis.__josealoNsfwModelPromise = load();
  }

  return globalThis.__josealoNsfwModelPromise;
}

function findProbability(predictions: PredictionType[], className: ModerationCategory) {
  return predictions.find((prediction) => prediction.className === className)?.probability ?? 0;
}

export async function moderateImageBuffer(buffer: Buffer): Promise<ModerationResult> {
  const image = sharp(buffer).rotate().removeAlpha().toColourspace("srgb");
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });

  const tensor = tf.tensor3d(new Uint8Array(data), [info.height, info.width, info.channels], "int32");

  try {
    const model = await getModel();
    const predictions = await model.classify(tensor);
    const blockedCategories: ModerationCategory[] = [];

    if (findProbability(predictions, "Hentai") >= getThreshold("hentai")) {
      blockedCategories.push("Hentai");
    }

    if (findProbability(predictions, "Porn") >= getThreshold("porn")) {
      blockedCategories.push("Porn");
    }

    if (findProbability(predictions, "Sexy") >= getThreshold("sexy")) {
      blockedCategories.push("Sexy");
    }

    return {
      blocked: blockedCategories.length > 0,
      blockedCategories,
      predictions,
    };
  } finally {
    tensor.dispose();
  }
}
