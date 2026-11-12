import type { ComponentType, SVGProps } from 'react';
import { cn } from '@/shared/utils/cn';

export type IconComponent = ComponentType<{ className?: string }>;

// Each glyph carries one accent detail: text-coloured by default, signal yellow when `data-active` is set.
function Glyph({ name, className, children, ...props }: SVGProps<SVGSVGElement> & { name: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={24}
      height={24}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      data-glyph={name}
      className={cn('group/glyph', className)}
      {...props}
    >
      {children}
    </svg>
  );
}

const plane = { fill: 'currentColor', fillOpacity: 0.14 };
const accent = 'stroke-none fill-current opacity-35 group-data-[active]/glyph:fill-signal group-data-[active]/glyph:opacity-100';
const solidAccent = 'stroke-none fill-current group-data-[active]/glyph:fill-signal';

export function BinIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Glyph name="bin" {...props}>
      <rect x="4" y="5.2" width="12" height="2.6" rx="1.3" transform="rotate(-14 4 7.8)" fill="currentColor" stroke="none" />
      <path d="M6 10h12l-1.25 9.25A2 2 0 0 1 14.77 21H9.23a2 2 0 0 1-1.98-1.75Z" {...plane} />
      <path d="M9.25 14.5h5.5" />
      <rect x="17.4" y="3" width="3.4" height="3.4" rx="0.8" transform="rotate(18 19.1 4.7)" className={accent} />
    </Glyph>
  );
}

export function FolderIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Glyph name="folder" {...props}>
      <path d="M3 18.5v-12A1.5 1.5 0 0 1 4.5 5h4.3l2.2 2.5h8.5A1.5 1.5 0 0 1 21 9v1.5" />
      <path d="M3 10.5h18v8a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5Z" {...plane} />
      <rect x="9" y="13.6" width="6" height="2.4" rx="1.2" className={accent} />
    </Glyph>
  );
}

export function FolderOpenIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Glyph name="folder-open" {...props}>
      <path d="M3 18.5v-12A1.5 1.5 0 0 1 4.5 5h4.3l2.2 2.5h7A1.5 1.5 0 0 1 19.5 9v2" />
      <path
        d="M3 18.5 5.4 12.1A1.7 1.7 0 0 1 7 11h14.2a1 1 0 0 1 .95 1.3l-1.9 6.4A1.8 1.8 0 0 1 18.5 20h-14A1.5 1.5 0 0 1 3 18.5Z"
        {...plane}
      />
      <rect x="14.4" y="14.2" width="6" height="2.4" rx="1.2" transform="skewX(-15)" className={accent} />
    </Glyph>
  );
}

export function SpaceIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Glyph name="space" {...props}>
      <path d="M9.55 9.2h5.6l-.7 5.6h-5.6Z" className={accent} />
      <path d="M10.2 4 8.2 20M15.8 4l-2 16M4.5 9.2h15.5M4 14.8h15.5" />
    </Glyph>
  );
}

export function NotebookIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Glyph name="notebook" {...props}>
      <rect x="5" y="2.5" width="14" height="17" rx="2" {...plane} />
      <path d="M8.75 2.5v17M11.75 7.5h4" />
      <path d="M13 19.5h3.2v3.3l-1.6-1.2-1.6 1.2Z" className={solidAccent} />
    </Glyph>
  );
}

export function VaultIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Glyph name="vault" {...props}>
      <path d="M8 10.5v-3a4 4 0 0 1 8 0v3" />
      <rect x="4" y="10.5" width="16" height="10.5" rx="3" {...plane} />
      <circle cx="12" cy="14.9" r="1.7" className={solidAccent} />
      <path d="M11.2 15.6h1.6l.5 2.9h-2.6Z" className={solidAccent} />
    </Glyph>
  );
}

export function BudgetIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Glyph name="budget" {...props}>
      <path d="M5.5 6.5 15.2 3.6a1.5 1.5 0 0 1 1.9 1.1l.4 1.8" />
      <rect x="3" y="6.5" width="18" height="13.5" rx="2.5" {...plane} />
      <path d="M21 11h-3.75a2.25 2.25 0 0 0 0 4.5H21" />
      <circle cx="17.25" cy="13.25" r="1.1" className={solidAccent} />
    </Glyph>
  );
}
