import { toast } from 'sonner';

const CLEAR_AFTER_MS = 30_000;

let clearTimer: ReturnType<typeof setTimeout> | undefined;

// Browsers only allow clipboard writes while the tab has focus, so clearing is best effort.
export async function copySecret(value: string): Promise<void> {
  await navigator.clipboard.writeText(value);
  clearTimeout(clearTimer);
  clearTimer = setTimeout(() => {
    if (document.hasFocus()) void navigator.clipboard.writeText('').catch(() => {});
  }, CLEAR_AFTER_MS);
}

export async function copyWithToast(value: string): Promise<void> {
  try {
    await copySecret(value);
    toast.success('Copied. Clipboard clears in 30 seconds.');
  } catch {
    toast.error('That could not be copied. Please try again.');
  }
}
