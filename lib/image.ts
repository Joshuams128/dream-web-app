// Browser-only image prep: convert iPhone HEIC → JPEG and downscale/compress
// every image before it is uploaded. This keeps payloads small (so uploads
// never hit "image too large") and gives Claude a clean, high-enough-res JPEG
// for reliable handwriting OCR. All DOM/heic2any access happens inside the
// exported functions, so this module is safe to import from client components.

const HEIC_TYPES = ["image/heic", "image/heif"];

/** True for iPhone HEIC/HEIF files (by MIME type, or extension when the
 *  browser reports an empty type — common for HEIC on some devices). */
export function isHeic(file: File): boolean {
  const type = (file.type || "").toLowerCase();
  const name = file.name.toLowerCase();
  return HEIC_TYPES.includes(type) || name.endsWith(".heic") || name.endsWith(".heif");
}

export interface PreparedImage {
  base64: string; // no data-URL prefix
  mediaType: string; // always an API-accepted type after prep
}

export type PrepStage = "converting" | "compressing";

const MAX_EDGE = 2000; // long-edge cap; plenty for reading handwritten notes

function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read image"));
    reader.readAsDataURL(blob);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not decode image"));
    img.src = src;
  });
}

/**
 * Prepare an uploaded file for the extraction API:
 *  1. If it's a HEIC/HEIF photo, convert it to JPEG in-browser (heic2any).
 *  2. Downscale to <= 2000px on the long edge and re-encode as JPEG (~0.85).
 * Returns base64 + media type ready to POST. Falls back gracefully if the
 * browser can't decode the image for canvas re-encoding.
 */
export async function prepareImage(
  file: File,
  onStage?: (stage: PrepStage) => void,
): Promise<PreparedImage> {
  let blob: Blob = file;

  if (isHeic(file)) {
    onStage?.("converting");
    const heic2any = (await import("heic2any")).default;
    const converted = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 });
    blob = Array.isArray(converted) ? converted[0] : converted;
  }

  onStage?.("compressing");
  const dataUrl = await readAsDataUrl(blob);

  let img: HTMLImageElement;
  try {
    img = await loadImage(dataUrl);
  } catch {
    // Browser couldn't decode it for canvas — send the (already-converted)
    // bytes as-is. Any remaining unsupported type is caught by the server.
    return { base64: dataUrl.split(",")[1] ?? "", mediaType: blob.type || "image/jpeg" };
  }

  const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { base64: dataUrl.split(",")[1] ?? "", mediaType: blob.type || "image/jpeg" };

  ctx.drawImage(img, 0, 0, w, h);
  const jpeg = canvas.toDataURL("image/jpeg", 0.85);
  return { base64: jpeg.split(",")[1] ?? "", mediaType: "image/jpeg" };
}
