import { Suspense } from 'react';
import { VerifyPageComponent } from '@/features/auth';

export default function VerifyPage() {
  return (
    <Suspense>
      <VerifyPageComponent />
    </Suspense>
  );
}
