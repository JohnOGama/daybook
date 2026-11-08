import { Check } from 'lucide-react';
import type { FormEventHandler, ReactNode } from 'react';

type AuthCardProps = {
  title: string;
  subtitle?: string;
  error?: string;
  onSubmit: FormEventHandler<HTMLFormElement>;
  children: ReactNode;
  footer?: ReactNode;
};

export function AuthCardComponent({ title, subtitle, error, onSubmit, children, footer }: AuthCardProps) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-sidebar p-4">
      <div className="w-full max-w-sm rounded-2xl border bg-card p-6">
        <div className="mb-5 flex items-center gap-2.5 font-semibold">
          <span className="grid size-7 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Check className="size-4" strokeWidth={3} aria-hidden />
          </span>
          Daybook
        </div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
        <form onSubmit={onSubmit} className="mt-5 flex flex-col gap-4">
          {children}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </form>
        {footer && <div className="mt-4 text-sm text-muted-foreground">{footer}</div>}
      </div>
    </main>
  );
}
