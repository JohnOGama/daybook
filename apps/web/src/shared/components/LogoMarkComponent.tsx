import { cn } from '@/shared/utils/cn';

// Daybook's mark: a sun rising over the day's line, white on the black (white in dark) tile. app/icon.svg is the same drawing.
export function LogoMarkComponent({ className }: { className?: string }) {
  return (
    <span className={cn('grid size-7 shrink-0 place-items-center rounded-[28%] bg-primary text-primary-foreground', className)} aria-hidden>
      <svg viewBox="0 0 24 24" fill="currentColor" className="size-[64%]">
        <path d="M4 14a8 8 0 0 1 16 0z" />
        <rect x="3" y="16" width="18" height="3" rx="1.5" />
      </svg>
    </span>
  );
}
