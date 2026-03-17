/**
 * Upload and optimize meal photos for thumbnails.
 * Uses Vercel Blob for storage and Sharp for resizing.
 *
 * Requires BLOB_READ_WRITE_TOKEN (create a Blob store in Vercel dashboard).
 */

import { put } from "@vercel/blob";
import sharp from "sharp";

const THUMBNAIL_SIZE = 400; // max width/height in px
const JPEG_QUALITY = 80;

export async function uploadMealPhoto(
  imageBuffer: Buffer,
  userId: string,
  timestamp: string
): Promise<string | null> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return null;
  }

  try {
    const optimized = await sharp(imageBuffer)
      .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: JPEG_QUALITY })
      .toBuffer();

    const safeTs = timestamp.replace(/[:.]/g, "-").slice(0, 19);
    const path = `meal-photos/${userId}/${safeTs}-${Date.now()}.jpg`;
    const blob = await put(path, optimized, {
      access: "public",
      contentType: "image/jpeg",
    });

    return blob.url;
  } catch (err) {
    console.error("Meal photo upload error:", err);
    return null;
  }
}
