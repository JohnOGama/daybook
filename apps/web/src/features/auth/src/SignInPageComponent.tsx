'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { authClient } from '@/shared/services/auth-client';
import { AuthCardComponent } from './AuthCardComponent';
import { AuthFieldComponent } from './AuthFieldComponent';
import { leaveFor, withWaitingApp } from './oauth-request';

export function SignInPageComponent() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    const result = await authClient.signIn.email({ email, password });
    if (result.error?.code === 'EMAIL_NOT_VERIFIED') {
      await authClient.emailOtp.sendVerificationOtp({ email, type: 'email-verification' });
      router.push(withWaitingApp(`/verify?email=${encodeURIComponent(email)}`));
      return;
    }
    if (result.error) {
      setError(result.error.message ?? 'Could not sign in.');
      setBusy(false);
      return;
    }
    // Reached from an app's authorization: Better Auth answers with where to continue.
    const next = result.data as { redirect?: boolean; url?: unknown } | null;
    if (next?.redirect && typeof next.url === 'string') {
      leaveFor(next.url);
      return;
    }
    router.push('/list');
  }

  return (
    <AuthCardComponent
      title="Sign in"
      error={error}
      onSubmit={handleSubmit}
      footer={
        <div className="flex justify-between">
          <Link href={withWaitingApp('/sign-up')} className="underline">
            Create an account
          </Link>
          <Link href={withWaitingApp('/forgot-password')} className="underline">
            Forgot password?
          </Link>
        </div>
      }
    >
      <AuthFieldComponent
        id="email"
        label="Email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />
      <AuthFieldComponent
        id="password"
        label="Password"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />
      <Button type="submit" disabled={busy}>
        Sign in
      </Button>
    </AuthCardComponent>
  );
}
