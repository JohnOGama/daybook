'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { authClient } from '@/shared/services/auth-client';
import { AuthCardComponent } from './AuthCardComponent';
import { AuthFieldComponent } from './AuthFieldComponent';

export function VerifyPageComponent() {
  const router = useRouter();
  const email = useSearchParams().get('email') ?? '';
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    setNotice(undefined);
    const { error: verifyError } = await authClient.emailOtp.verifyEmail({ email, otp });
    if (verifyError) {
      setError(verifyError.message ?? 'That code did not work.');
      setBusy(false);
      return;
    }
    router.push('/sign-in');
  }

  async function handleResend() {
    setError(undefined);
    setNotice(undefined);
    const { error: resendError } = await authClient.emailOtp.sendVerificationOtp({
      email,
      type: 'email-verification',
    });
    if (resendError) setError(resendError.message ?? 'Could not send a new code.');
    else setNotice('We sent a new code.');
  }

  return (
    <AuthCardComponent
      title="Enter your code"
      subtitle={`We emailed a 6-digit code to ${email}.`}
      error={error}
      onSubmit={handleSubmit}
      footer={notice}
    >
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
      <Button type="submit" disabled={busy}>
        Verify
      </Button>
      <Button type="button" variant="ghost" onClick={handleResend}>
        Resend code
      </Button>
    </AuthCardComponent>
  );
}
