'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { authClient } from '@/shared/services/auth-client';
import { AuthCardComponent } from './AuthCardComponent';
import { AuthFieldComponent } from './AuthFieldComponent';
import { withWaitingApp } from './oauth-request';

export function ForgotPasswordPageComponent() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    const { error: requestError } = codeSent
      ? await authClient.emailOtp.resetPassword({ email, otp, password })
      : await authClient.emailOtp.sendVerificationOtp({ email, type: 'forget-password' });
    setBusy(false);
    if (requestError) {
      setError(requestError.message ?? 'Something went wrong. Please try again.');
    } else if (codeSent) {
      router.push(withWaitingApp('/sign-in'));
    } else {
      setCodeSent(true);
    }
  }

  return (
    <AuthCardComponent
      title="Reset your password"
      subtitle={codeSent ? `If ${email} has an account, a code is on its way.` : undefined}
      error={error}
      onSubmit={handleSubmit}
      footer={
        <Link href={withWaitingApp('/sign-in')} className="underline">
          Back to sign in
        </Link>
      }
    >
      {codeSent ? (
        <>
          <AuthFieldComponent
            id="otp"
            label="6-digit code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            value={otp}
            onChange={(event) => setOtp(event.target.value)}
          />
          <AuthFieldComponent
            id="password"
            label="New password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </>
      ) : (
        <AuthFieldComponent
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      )}
      <Button type="submit" disabled={busy}>
        {codeSent ? 'Reset password' : 'Send code'}
      </Button>
    </AuthCardComponent>
  );
}
