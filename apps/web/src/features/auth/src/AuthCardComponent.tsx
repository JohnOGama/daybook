import { LogoMarkComponent } from '@/shared/components/LogoMarkComponent';
import type { FormEventHandler, ReactNode } from 'react';
import { useRedirectIfSignedIn } from '../hooks/useRedirectIfSignedIn';
import { AuthCardSkeletonComponent } from './AuthCardSkeletonComponent';

type AuthCardProps = {
  title: string;
  subtitle?: string;
  error?: string;
  onSubmit: FormEventHandler<HTMLFormElement>;
  children: ReactNode;
  footer?: ReactNode;
  // For pages only a signed-in person sees, like the OAuth consent page.
  signedIn?: boolean;
};

export function AuthCardComponent({ title, subtitle, error, onSubmit, children, footer, signedIn = false }: AuthCardProps) {
  const { isSignedOut } = useRedirectIfSignedIn(!signedIn);
  if (!signedIn && !isSignedOut) return <AuthCardSkeletonComponent />;

  return (
    <main className="flex min-h-dvh items-center justify-center bg-sidebar p-4">
      <div className="w-full max-w-sm rounded-2xl border bg-card p-6">
        <div className="mb-5 flex items-center gap-2.5 font-semibold">
          <LogoMarkComponent />
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
