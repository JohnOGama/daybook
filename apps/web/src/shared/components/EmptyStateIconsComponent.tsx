import type { ReactNode } from 'react';

function EmptyIcon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="size-16 text-muted-foreground"
    >
      {children}
    </svg>
  );
}

const Solid = ({ children }: { children: ReactNode }) => <g className="stroke-foreground">{children}</g>;
const Missing = ({ children }: { children: ReactNode }) => <g strokeDasharray="2 5">{children}</g>;

export function EmptyDayIcon() {
  return (
    <EmptyIcon>
      <Solid>
        <rect x="10" y="14" width="44" height="40" rx="7" />
        <path d="M10 26h44M22 9v9M42 9v9" />
      </Solid>
      <Missing>
        <path d="M20 35h24M20 44h15" />
      </Missing>
    </EmptyIcon>
  );
}

export function NoFilterMatchIcon() {
  return (
    <EmptyIcon>
      <Solid>
        <path d="M8 12h38L32 29v12l-10 5V29L8 12Z" />
        <path d="m44 43 6 6m0-6-6 6" />
      </Solid>
      <Missing>
        <circle cx="47" cy="46" r="10" />
      </Missing>
    </EmptyIcon>
  );
}

export function AllFinishedIcon() {
  return (
    <EmptyIcon>
      <Solid>
        <circle cx="32" cy="32" r="16" />
        <path d="m25 32.5 5 5 9-10" />
      </Solid>
      <Missing>
        <circle cx="32" cy="32" r="25" />
      </Missing>
    </EmptyIcon>
  );
}

export function EmptyTrashIcon() {
  return (
    <EmptyIcon>
      <Solid>
        <path d="M17 24h30l-2.5 28a4 4 0 0 1-4 3.6h-17a4 4 0 0 1-4-3.6L17 24Z" />
        <g transform="rotate(-10 14 18)">
          <path d="M12 18h40M26 18v-4a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v4" />
        </g>
      </Solid>
      <Missing>
        <path d="M27 32v15M37 32v15" />
      </Missing>
    </EmptyIcon>
  );
}

export function EmptyNotebookIcon() {
  return (
    <EmptyIcon>
      <Solid>
        <path d="M32 18c-5-4-12-5-21-4v35c9-1 16 0 21 4 5-4 12-5 21-4V14c-9-1-16 0-21 4ZM32 18v35" />
      </Solid>
      <Missing>
        <path d="M18 26c3 0 6 .5 8 1.5M18 35c3 0 6 .5 8 1.5M38 27.5c2-1 5-1.5 8-1.5M38 36.5c2-1 5-1.5 8-1.5" />
      </Missing>
    </EmptyIcon>
  );
}

export function FirstSpaceIcon() {
  return (
    <EmptyIcon>
      <Missing>
        <rect x="9" y="9" width="46" height="46" rx="11" />
      </Missing>
      <Solid>
        <path d="m27 20-3 24M41 20l-3 24M20 28h27M17 36h27" />
      </Solid>
    </EmptyIcon>
  );
}
