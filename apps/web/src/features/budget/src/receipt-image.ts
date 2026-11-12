import type { ReceiptImage } from './budget-types';

const MAX_SIDE = 1600;
const QUALITY = 0.82;

// Phone photos run to several megabytes; a 1600px JPEG keeps a receipt readable at a few hundred kilobytes.
export async function shrinkReceipt(file: File): Promise<ReceiptImage> {
  if (!file.type.startsWith('image/')) throw new Error('Pick a photo of the receipt.');
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', QUALITY));
  if (!blob) throw new Error("That photo couldn't be read. Try another one.");
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  return { mediaType: 'image/jpeg', data: btoa(binary) };
}
