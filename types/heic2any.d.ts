declare module "heic2any" {
  interface Heic2AnyOptions {
    blob: Blob;
    /** Output MIME type. Defaults to "image/png". */
    toType?: string;
    /** JPEG/WEBP quality, 0–1. */
    quality?: number;
    /** Return all frames of a multi-image HEIC as an array. */
    multiple?: boolean;
  }
  export default function heic2any(options: Heic2AnyOptions): Promise<Blob | Blob[]>;
}
