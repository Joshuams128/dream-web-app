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

/** Decode a blob to an <img> for canvas work, or null if the browser can't. */
async function tryDecode(blob: Blob): Promise<HTMLImageElement | null> {
  try {
    return await loadImage(await readAsDataUrl(blob));
  } catch {
    return null;
  }
}

/**
 * Prepare an uploaded file for the extraction API and always hand back a
 * JPEG the API accepts:
 *
 *  1. Try to decode the file directly. Most browsers do this natively and
 *     instantly — including iOS Safari for HEIC — so iPhone photos need no
 *     conversion at all.
 *  2. Only if that fails and the file is HEIC/HEIF, fall back to the slower
 *     JS decoder (heic2any) to turn it into JPEG, then decode that.
 *  3. Downscale to <= 2000px on the long edge and re-encode as JPEG (~0.85),
 *     which also keeps the upload small so it goes through quickly.
 *
 * Falls back to sending the raw bytes only if nothing can decode the image.
 */
export async function prepareImage(
  file: File,
  onStage?: (stage: PrepStage) => void,
): Promise<PreparedImage> {
  let blob: Blob = file;

  // Fast path: let the browser decode it (native HEIC support on iOS Safari).
  let img = await tryDecode(blob);

  // Slow path: browser can't read this HEIC/HEIF — convert it in JS.
  if (!img && isHeic(file)) {
    onStage?.("converting");
    try {
      const heic2any = (await import("heic2any")).default;
      const converted = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.92 });
      blob = Array.isArray(converted) ? converted[0] : converted;
      img = await tryDecode(blob);
    } catch {
      // Conversion failed outright — handled by the raw-bytes fallback below.
    }
  }

  if (!img) {
    // Couldn't decode for canvas re-encoding. Send the best bytes we have; a
    // successful HEIC conversion above means `blob` is already JPEG.
    const dataUrl = await readAsDataUrl(blob);
    const converted = blob !== file; // true once heic2any produced a JPEG
    const mediaType = converted ? "image/jpeg" : blob.type || "image/jpeg";
    return { base64: dataUrl.split(",")[1] ?? "", mediaType };
  }

  onStage?.("compressing");
  const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    const dataUrl = await readAsDataUrl(blob);
    const mediaType = blob !== file ? "image/jpeg" : blob.type || "image/jpeg";
    return { base64: dataUrl.split(",")[1] ?? "", mediaType };
  }

  ctx.drawImage(img, 0, 0, w, h);
  const jpeg = canvas.toDataURL("image/jpeg", 0.85);
  return { base64: jpeg.split(",")[1] ?? "", mediaType: "image/jpeg" };
}
