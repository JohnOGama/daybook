'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { authClient } from '@/shared/services/auth-client';
import { AuthCardComponent } from './AuthCardComponent';
import { AuthFieldComponent } from './AuthFieldComponent';
import { withWaitingApp } from './oauth-request';

export function SignUpPageComponent() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    const { error: signUpError } = await authClient.signUp.email({
      name: email.split('@')[0],
      email,
      password,
    });
    if (signUpError) {
      setError(signUpError.message ?? 'Could not create the account.');
      setBusy(false);
      return;
    }
    router.push(withWaitingApp(`/verify?email=${encodeURIComponent(email)}`));
  }

  return (
    <AuthCardComponent
      title="Create your account"
      subtitle="We'll email you a code to confirm it's you."
      error={error}
      onSubmit={handleSubmit}
      footer={
        <Link href={withWaitingApp('/sign-in')} className="underline">
          Already have an account? Sign in
        </Link>
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
        autoComplete="new-password"
        minLength={8}
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />
      <Button type="submit" disabled={busy}>
        Create account
      </Button>
    </AuthCardComponent>
  );
}
