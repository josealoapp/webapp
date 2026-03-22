const MAX_DIMENSION = 1600;
const WEBP_QUALITY = 0.82;

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("upload/image-load-failed"));
    };

    image.src = objectUrl;
  });
}

function getTargetSize(width: number, height: number) {
  if (width <= MAX_DIMENSION && height <= MAX_DIMENSION) {
    return { width, height };
  }

  if (width >= height) {
    return {
      width: MAX_DIMENSION,
      height: Math.round((height / width) * MAX_DIMENSION),
    };
  }

  return {
    width: Math.round((width / height) * MAX_DIMENSION),
    height: MAX_DIMENSION,
  };
}

function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("upload/webp-conversion-failed"));
          return;
        }

        resolve(blob);
      },
      "image/webp",
      WEBP_QUALITY
    );
  });
}

export async function optimizeListingImage(file: File, index: number) {
  if (file.type === "image/webp" && file.size <= 1.5 * 1024 * 1024) {
    return file;
  }

  const image = await loadImage(file);
  const target = getTargetSize(image.naturalWidth, image.naturalHeight);
  const canvas = document.createElement("canvas");
  canvas.width = target.width;
  canvas.height = target.height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("upload/canvas-not-supported");
  }

  context.drawImage(image, 0, 0, target.width, target.height);
  const blob = await canvasToBlob(canvas);
  const baseName = file.name.replace(/\.[^.]+$/, "") || `image-${index + 1}`;

  return new File([blob], `${baseName}.webp`, {
    type: "image/webp",
    lastModified: Date.now(),
  });
}

